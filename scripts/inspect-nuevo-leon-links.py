#!/usr/bin/env python3
"""Fixed public HTML research capture. No corpus approval or production egress."""
import argparse
import contextlib
import hashlib
import json
import math
import os
from pathlib import Path
import re
import signal
import ssl
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, HTTPSHandler, ProxyHandler, Request, build_opener

REPO = Path(__file__).resolve().parents[1]
ORIGIN = 'https://www.hcnl.gob.mx'
AGENT = 'LexAI-PublicSourceInspector/0.1'
DOCUMENTS = (
    ('nl-civil', ORIGIN + '/trabajo_legislativo/leyes/codigos/codigo_civil_para_el_estado_de_nuevo_leon/'),
    ('nl-penal', ORIGIN + '/trabajo_legislativo/leyes/codigos/codigo_penal_para_el_estado_de_nuevo_leon/'),
)
ROBOTS = ORIGIN + '/robots.txt'
BOUNDS = {'maxRequests': 4, 'maxHtmlBytes': 2*1024*1024, 'maxTotalBytes': 4*1024*1024,
          'maxRobotsBytes': 128*1024, 'gapSeconds': 2, 'requestSeconds': 15,
          'batchSeconds': 120, 'concurrency': 1, 'retries': 0, 'redirects': 0}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def plan():
    return {'schemaVersion': 1, 'action': 'plan', 'dataClass': 'public-development',
            'productionEnabled': False, 'approvedForAcquisition': False,
            'scope': 'fixed public HTML research snapshots in quarantine; no PDF fetches',
            'robotsUrl': ROBOTS, 'documents': [{'id': key, 'url': url} for key, url in DOCUMENTS],
            'limits': dict(BOUNDS), 'outputRoot': 'artifacts/public-corpus',
            'rightsReview': 'pending', 'versionBindingReview': 'pending'}


def candidate_url(raw, base):
    """Literal same-origin PDF/Word candidate only; never authorization to fetch."""
    if not isinstance(raw, str) or not raw or len(raw) > 2048 or raw != raw.strip():
        raise ValueError('missing or oversized literal URL')
    if re.search(r'[\x00-\x1f\x7f\\?#]', raw):
        raise ValueError('controls, query, fragment or backslash unsupported')
    parts = urlsplit(raw)
    if parts.scheme and parts.scheme != 'https':
        raise ValueError('unsupported scheme')
    path = parts.path
    if re.search(r'%(?![0-9a-fA-F]{2})', path):
        raise ValueError('invalid percent encoding')
    decoded = unquote(path, errors='strict')
    if (re.search(r'[\x00-\x1f\x7f\\]', decoded) or re.search(r'%[0-9a-fA-F]{2}', decoded)
            or re.search(r'%(?:2e|2f|5c)', path, re.I)
            or any(part in ('.', '..') for part in decoded.split('/'))):
        raise ValueError('encoded or literal traversal unsupported')
    target = urlsplit(urljoin(base, raw))
    if target.scheme != 'https' or target.netloc != 'www.hcnl.gob.mx' or target.username or target.password:
        raise ValueError('destination is outside exact HTTPS origin')
    extension = Path(unquote(target.path)).suffix.lower()
    if extension not in ('.pdf', '.doc', '.docx'):
        raise ValueError('not a supported PDF/Word literal')
    normalized = ORIGIN + quote(unquote(target.path), safe='/-._~')
    return normalized, extension[1:]


class LinkInspector(HTMLParser):
    """HTML/onclick are inert input; only a small literal grammar is recognized."""
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base, self.candidates, self.rejected, self.unresolved = base, [], [], []
        self.visible, self.headings, self.hidden, self.heading = [], [], 0, None
        self.visible_chars, self.link_count = 0, 0

    def add(self, literal, via):
        self.link_count += 1
        if self.link_count > 2000:
            raise ValueError('HTML link count exceeds bounded inspection')
        try:
            url, kind = candidate_url(literal, self.base)
            record = {'url': url, 'literal': literal, 'htmlLine': self.getpos()[0], 'format': kind, 'via': via,
                      'approvedForAcquisition': False, 'versionBindingReview': 'pending'}
            if record not in self.candidates:
                self.candidates.append(record)
        except (ValueError, UnicodeError) as error:
            self.rejected.append({'literal': literal[:256], 'via': via, 'reason': str(error)})

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'template'):
            self.hidden += 1
        if self.hidden:
            return
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'title'):
            self.heading = []
        values = {}
        for key, value in attrs:
            if key in values and key in ('href', 'onclick'):
                raise ValueError('ambiguous duplicate link attribute')
            values[key] = value
        if tag == 'base':  # Cannot change resolution origin or base path.
            self.unresolved.append({'via': 'base', 'reason': 'HTML base element ignored'})
        if tag == 'a' and values.get('href'):
            self.add(values['href'], 'href')
        onclick = values.get('onclick')
        if onclick:
            # No eval, no general JavaScript parser, concatenation or function calls.
            pattern = r'''\s*(?:window\.open\(\s*(['"])([^'"\r\n]+)\1\s*(?:,\s*(['"])_blank\3\s*)?\)|(?:window\.)?location\.href\s*=\s*(['"])([^'"\r\n]+)\4)\s*;?\s*'''
            match = re.fullmatch(pattern, onclick)
            if match:
                self.add(match.group(2) or match.group(5), 'onclick-literal')
            else:
                self.unresolved.append({'via': 'onclick', 'snippet': onclick[:256],
                                        'reason': 'unsupported literal grammar; no JavaScript executed'})
        if len(self.unresolved) > 2000:
            raise ValueError('HTML unresolved-link count exceeds bounded inspection')

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'template') and self.hidden:
            self.hidden -= 1
            return
        if self.hidden:
            return
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'title') and self.heading is not None:
            if len(self.headings) < 32:
                self.headings.append(' '.join(''.join(self.heading).split())[:256])
            self.heading = None

    def handle_data(self, data):
        if self.hidden:
            return
        if self.visible_chars < 20000:
            self.visible.append(data[:20000-self.visible_chars])
            self.visible_chars += len(self.visible[-1])
        if self.heading is not None and sum(map(len, self.heading)) < 512:
            self.heading.append(data[:512])

    def result(self):
        text = ' '.join(' '.join(self.visible).split())
        reform = re.search(r'última\s+reforma.{0,180}', text, re.I)
        return {'headingCandidates': self.headings, 'declaredReformRawSnippet': reform.group(0) if reform else None,
                'declaredReformStatus': 'publisher text only; legal dates/current applicability unreviewed',
                'effectiveAt': None, 'candidates': self.candidates, 'rejectedLinks': self.rejected,
                'unresolved': self.unresolved, 'versionBindingReview': 'pending'}


def robots_policy(text, target):
    groups, agents, rules, delays = [], [], [], []
    def flush():
        if agents:
            groups.append((list(agents), list(rules), list(delays)))
        agents.clear(); rules.clear(); delays.clear()
    for raw in text.splitlines():
        line = raw.split('#', 1)[0].strip()
        if not line:
            continue
        if ':' not in line:
            raise ValueError('unreadable robots policy')
        key, value = (part.strip() for part in line.split(':', 1))
        key = key.lower()
        if key == 'user-agent':
            if rules or delays:
                flush()
            agents.append(value.lower())
        elif key in ('allow', 'disallow'):
            # This narrow inspector does not implement RFC percent normalization.
            # Validate every group, including unrelated agents, rather than silently
            # converting an unsupported restriction into an effective allow.
            if not agents:
                raise ValueError('robots path rule has no user-agent group')
            if value:
                if (not value.startswith('/') or value.startswith('//')
                        or not re.fullmatch(r'/[A-Za-z0-9/_~!.()*$-]*', value)
                        or ('$' in value and (not value.endswith('$') or value.count('$') != 1))
                        or any(part in ('.', '..') for part in value.split('/'))):
                    raise ValueError('unsupported robots path rule; percent/absolute/nonpath policy needs review')
                rules.append((key == 'allow', value))
        elif key == 'crawl-delay' and agents:
            delay = float(value)
            if not math.isfinite(delay) or delay < 0:
                raise ValueError('unsupported robots crawl-delay')
            delays.append(delay)
        elif key == 'request-rate':
            raise ValueError('robots request-rate needs separate review')
    flush()
    if not groups:
        raise ValueError('robots has no readable user-agent policy')
    scores = [(max((len(a) for a in aa if a != '*' and a in AGENT.lower()), default=1 if '*' in aa else -1), rr, dd) for aa, rr, dd in groups]
    best = max(score for score, _, _ in scores)
    selected = [(rr, dd) for score, rr, dd in scores if score == best and score >= 0]
    matches = []
    for rr, _ in selected:
        for allowed, pattern in rr:
            end = pattern.endswith('$')
            body = pattern[:-1] if end else pattern
            expression = '^' + '.*'.join(re.escape(piece) for piece in body.split('*')) + ('$' if end else '')
            if re.search(expression, urlsplit(target).path):
                matches.append((len(body.replace('*', '')), allowed))
    return {'allowed': max(matches)[1] if matches else True,
            'crawlDelaySeconds': max([0] + [delay for _, dd in selected for delay in dd])}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@contextlib.contextmanager
def response_for(url, timeout):
    opener = build_opener(ProxyHandler({}), NoRedirect(), HTTPSHandler(context=ssl.create_default_context()))
    request = Request(url, headers={'User-Agent': AGENT, 'Accept': 'text/plain' if url == ROBOTS else 'text/html', 'Accept-Encoding': 'identity'})
    try:
        response = opener.open(request, timeout=timeout)
    except HTTPError as error:
        response = error  # Preserve status in receipt, never follow a redirect.
    try:
        yield response
    finally:
        response.close()


@contextlib.contextmanager
def request_deadline(seconds):
    if not hasattr(signal, 'setitimer') or signal.getitimer(signal.ITIMER_REAL)[0]:
        raise ValueError('absolute request deadline unavailable; use supported Unix development environment')
    prior = signal.getsignal(signal.SIGALRM)
    def expired(_signum, _frame):
        raise TimeoutError('absolute request deadline exceeded')
    signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, prior)


class CaptureDirectory:
    def __init__(self, name):
        if not re.fullmatch(r'[a-z][a-z0-9-]{0,79}', name):
            raise ValueError('output name must be a new canonical leaf under artifacts/public-corpus')
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
        fd = os.open(REPO, flags)
        try:
            for leaf in ('artifacts', 'public-corpus'):
                try:
                    os.mkdir(leaf, mode=0o700, dir_fd=fd)
                except FileExistsError:
                    pass
                next_fd = os.open(leaf, flags, dir_fd=fd)
                os.close(fd); fd = next_fd
            os.mkdir(name, mode=0o700, dir_fd=fd)  # Never reuse an existing run, even empty.
            self.fd = os.open(name, flags, dir_fd=fd)
        finally:
            os.close(fd)
        self.relative = 'artifacts/public-corpus/' + name

    def write(self, name, data):
        if not re.fullmatch(r'[a-z][a-z0-9-]*\.(?:html|txt|json)', name):
            raise ValueError('noncanonical capture filename')
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=self.fd)
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data); handle.flush(); os.fsync(handle.fileno()); os.fchmod(handle.fileno(), 0o400)

    def close(self):
        os.close(self.fd)


def inspect_live(output_name, *, transport=response_for, clock=time.monotonic, sleep=time.sleep, now=utc_now, bounds=None):
    limits = dict(BOUNDS)
    if bounds is not None:  # Internal test seam permits stricter bounds only, never broader policy.
        if set(bounds) != set(BOUNDS):
            raise ValueError('exact bounded configuration required')
        limits = dict(bounds)
        for key, value in limits.items():
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
                raise ValueError('invalid bounds')
            if key.startswith('max') and not isinstance(value, int):
                raise ValueError('integer request and byte limits required')
            if key == 'gapSeconds':
                if value < BOUNDS[key]: raise ValueError('cannot reduce request gap')
            elif key in ('concurrency', 'retries', 'redirects'):
                if value != BOUNDS[key]: raise ValueError('cannot change execution policy')
            elif value <= 0 or value > BOUNDS[key]:
                raise ValueError('cannot expand request budgets')
    started = clock()
    report = {**plan(), 'action': 'live-public-html-research', 'state': 'running', 'startedAt': now(),
              'limits': limits, 'requests': [], 'documents': [], 'consumedBodyBytes': 0}
    directory = CaptureDirectory(output_name)
    report['artifactDirectory'] = directory.relative
    last_start = None
    def remaining():
        value = limits['batchSeconds'] - (clock() - started)
        if value <= 0:
            raise TimeoutError('batch deadline exceeded')
        return value
    def request(url, max_bytes, delay, filename):
        nonlocal last_start
        if url not in (ROBOTS, *(url for _, url in DOCUMENTS)):
            raise ValueError('only fixed research request URLs are permitted')
        if len(report['requests']) >= limits['maxRequests']:
            raise ValueError('request budget exhausted')
        wait = max(0, delay - (clock()-last_start)) if last_start is not None else 0
        if wait >= remaining():
            raise TimeoutError('required crawl delay exceeds remaining batch')
        if wait: sleep(wait)
        remaining(); last_start = clock()
        receipt = {'url': url, 'requestedAt': now(), 'status': None, 'mime': None, 'finalUrl': None,
                   'bodyBytes': 0, 'sha256': None, 'snapshotPath': None, 'error': None}
        report['requests'].append(receipt)
        def request_remaining():
            remaining()
            if clock()-last_start >= limits['requestSeconds']:
                raise TimeoutError('absolute request deadline exceeded')
        try:
            with request_deadline(min(limits['requestSeconds'], remaining())):
                with transport(url, min(limits['requestSeconds'], remaining())) as response:
                    request_remaining()
                    receipt['status'] = response.status
                    receipt['finalUrl'] = response.geturl()
                    receipt['contentType'] = response.headers.get('Content-Type', '')
                    if 300 <= response.status < 400:
                        receipt['redirectLocationLiteral'] = response.headers.get('Location')
                    receipt['mime'] = response.headers.get('Content-Type', '').split(';', 1)[0].strip().lower()
                    if response.geturl() != url or response.status != 200:
                        raise ValueError('redirect or non-200 response blocked; no retry')
                    if receipt['mime'] != ('text/plain' if url == ROBOTS else 'text/html'):
                        raise ValueError('unsupported response MIME')
                    if response.headers.get('Content-Encoding', 'identity').lower() != 'identity':
                        raise ValueError('compressed response unsupported')
                    declared = response.headers.get('Content-Length')
                    if declared is not None and (not declared.isdigit() or int(declared) > max_bytes):
                        raise ValueError('invalid or excessive Content-Length')
                    chunks = []
                    while True:
                        request_remaining()
                        chunk = response.read1(min(65536, max_bytes-receipt['bodyBytes']+1,
                                                   limits['maxTotalBytes']-report['consumedBodyBytes']+1))
                        if not chunk: break
                        receipt['bodyBytes'] += len(chunk)
                        report['consumedBodyBytes'] += len(chunk)
                        if receipt['bodyBytes'] > max_bytes or report['consumedBodyBytes'] > limits['maxTotalBytes']:
                            raise ValueError('response body budget exceeded')
                        chunks.append(chunk)
                    request_remaining()
                    data = b''.join(chunks)
                    if declared is not None and len(data) != int(declared):
                        raise ValueError('truncated response body')
                    if not data:
                        raise ValueError('empty response body')
                    receipt['sha256'] = sha(data)
                    directory.write(filename, data)
                    receipt['snapshotPath'] = filename
                    receipt['finishedAt'] = now()
                    return data
        except Exception as error:
            receipt['error'] = type(error).__name__ + ': ' + str(error)[:256]
            raise
        finally:
            receipt['elapsedMs'] = round((clock()-last_start)*1000, 3)
    try:
        robots = request(ROBOTS, limits['maxRobotsBytes'], limits['gapSeconds'], 'robots.txt').decode('utf-8', errors='strict')
        policies = {url: robots_policy(robots, url) for _, url in DOCUMENTS}
        report['robotsPolicies'] = policies
        if not all(policy['allowed'] for policy in policies.values()):
            raise ValueError('robots policy blocks one or more fixed documents')
        for key, url in DOCUMENTS:
            data = request(url, limits['maxHtmlBytes'], max(limits['gapSeconds'], policies[url]['crawlDelaySeconds']), key+'.html')
            inspector = LinkInspector(url)
            inspector.feed(data.decode('utf-8-sig', errors='strict')); inspector.close()
            report['documents'].append({'id': key, 'url': url, 'snapshotSha256': sha(data),
                                         'state': 'captured-quarantine', 'rightsReview': 'pending',
                                         'approvedForAcquisition': False, **inspector.result()})
            remaining()
        report['state'] = 'complete-quarantine'
    except Exception as error:
        report['state'] = 'blocked'
        report['error'] = type(error).__name__ + ': ' + str(error)[:256]
    finally:
        captured = {doc['id'] for doc in report['documents']}
        report['notCaptured'] = [{'id': key, 'url': url, 'state': 'not-captured; see receipts'} for key, url in DOCUMENTS if key not in captured]
        report['finishedAt'] = now()
        report['elapsedMs'] = round((clock()-started)*1000, 3)
        try:
            directory.write('report.json', (json.dumps(report, ensure_ascii=False, indent=2)+'\n').encode('utf-8'))
        finally:
            directory.close()
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--plan', action='store_true')
    mode.add_argument('--live', action='store_true')
    parser.add_argument('--out-name', help='new leaf under artifacts/public-corpus; never an arbitrary path')
    args = parser.parse_args(argv)
    if not args.live:
        if args.out_name:
            parser.error('--out-name requires --live')
        print(json.dumps(plan(), ensure_ascii=False, indent=2))
        return 0
    name = args.out_name or 'nl-links-' + datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    report = inspect_live(name)
    print(json.dumps({'state': report['state'], 'artifactDirectory': report['artifactDirectory'],
                      'requests': len(report['requests']), 'consumedBodyBytes': report['consumedBodyBytes'],
                      'approvedForAcquisition': False}, ensure_ascii=False))
    return 0 if report['state'] == 'complete-quarantine' else 1


if __name__ == '__main__':
    raise SystemExit(main())
