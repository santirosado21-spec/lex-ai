#!/usr/bin/env python3
"""Two exact public PDF research captures, bound to reviewed HTML evidence."""
import argparse
import contextlib
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import ssl
import stat
import time
from typing import NamedTuple
from urllib.error import HTTPError
from urllib.request import HTTPSHandler, ProxyHandler, Request, build_opener

REPO = Path(__file__).resolve().parents[1]
HELPER_PATH = Path(__file__).resolve().with_name('inspect-nuevo-leon-links.py')
HELPER_SHA256 = '0294d183590c126bf7d6228f588b96968b320ec03828b3076b638de4016cbad7'
SOURCE_DIRECTORY = 'artifacts/public-corpus/nl-links-revision-01'
SOURCE_REPORT = SOURCE_DIRECTORY + '/report.json'
SOURCE_REPORT_SHA256 = '05ad65a4b84f011905f6336e4b94cece7800ffb71c010e863bf542b5f503a719'
ROBOTS = 'https://www.hcnl.gob.mx/robots.txt'
AGENT = 'LexAI-PublicSourceInspector/0.1'
LIMITS = {'maxRequests': 3, 'maxPdfBytes': 10*1024*1024, 'maxTotalBytes': 20*1024*1024,
          'maxRobotsBytes': 128*1024, 'gapSeconds': 2, 'requestSeconds': 15,
          'batchSeconds': 120, 'concurrency': 1, 'retries': 0, 'redirects': 0}


class Capability(NamedTuple):
    id: str
    url: str
    htmlUrl: str
    htmlSnapshotPath: str
    htmlSha256: str
    htmlLine: int


CAPABILITIES = (
    Capability('nl-civil',
        'https://www.hcnl.gob.mx/trabajo_legislativo/leyes/pdf/CODIGO%20CIVIL%20PARA%20EL%20ESTADO%20DE%20NUEVO%20LEON%20.pdf?2026-06-26',
        'https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos/codigo_civil_para_el_estado_de_nuevo_leon/',
        SOURCE_DIRECTORY+'/nl-civil.html',
        '7ad6ac47640688a911f135a690080677f6e4e2cf5927e17e2d70637e601925c9', 556),
    Capability('nl-penal',
        'https://www.hcnl.gob.mx/trabajo_legislativo/leyes/pdf/CODIGO%20PENAL%20PARA%20EL%20ESTADO%20DE%20%20NUEVO%20LEON.pdf?2026-06-15',
        'https://www.hcnl.gob.mx/trabajo_legislativo/leyes/codigos/codigo_penal_para_el_estado_de_nuevo_leon/',
        SOURCE_DIRECTORY+'/nl-penal.html',
        'f087c1a18f6784c0fa46ca9d7fae62dda745795109b226153ca481a09b57b356', 556),
)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def validate_request_url(url):
    # Exact capability membership, deliberately NOT a general query-bearing URL policy.
    if not isinstance(url, str) or url not in (ROBOTS, *(cap.url for cap in CAPABILITIES)):
        raise ValueError('request outside the three exact public research destinations')
    return url


def plan():
    proposal = {'schemaVersion': 1, 'action': 'plan', 'dataClass': 'public-development',
        'productionEnabled': False, 'approvedForAcquisition': False,
        'scope': 'two public statutory PDF originals in research quarantine; no extraction/ingestion',
        'robotsUrl': ROBOTS, 'documents': [cap._asdict() for cap in CAPABILITIES],
        'sourceReportPath': SOURCE_REPORT, 'sourceReportSha256': SOURCE_REPORT_SHA256,
        'reviewedHelperSha256': HELPER_SHA256, 'limits': dict(LIMITS),
        'outputRoot': 'artifacts/public-corpus', 'rightsReview': 'pending',
        'versionBindingReview': 'pending', 'effectiveAt': None,
        'querySemantics': 'opaque exact source href; not an effective date or verified legal version'}
    encoded = json.dumps(proposal, sort_keys=True, separators=(',', ':')).encode()
    return {**proposal, 'proposalSha256': sha(encoded)}


def load_reviewed_helpers():
    if sha(HELPER_PATH.read_bytes()) != HELPER_SHA256:
        raise ValueError('reviewed robots/deadline helper changed; a new review is required')
    spec = importlib.util.spec_from_file_location('reviewed_nl_link_helpers', HELPER_PATH)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    if sha(HELPER_PATH.read_bytes()) != HELPER_SHA256 or helper.AGENT != AGENT:
        raise ValueError('reviewed helper drift or user-agent mismatch')
    return helper


def read_public_snapshot(relative, maximum):
    parts = relative.split('/')
    if parts[:2] != ['artifacts', 'public-corpus'] or any(not re.fullmatch(r'[a-z0-9.-]+', p) or p in ('.', '..') for p in parts):
        raise ValueError('source snapshot must remain inside public artifact tree')
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    fd = os.open(REPO, flags)
    try:
        for part in parts[:-1]:
            next_fd = os.open(part, flags, dir_fd=fd)
            os.close(fd); fd = next_fd
        file_fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW, dir_fd=fd)
        with os.fdopen(file_fd, 'rb') as handle:
            info = os.fstat(handle.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_size > maximum:
                raise ValueError('source snapshot is not a bounded regular file')
            data = handle.read(maximum+1)
            if len(data) > maximum:
                raise ValueError('source snapshot size changed or exceeds limit')
            return data
    finally:
        os.close(fd)


class AnchorEvidence(HTMLParser):
    def __init__(self, capability):
        super().__init__(convert_charrefs=True)
        self.capability, self.matches, self.hidden = capability, [], 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'template'):
            self.hidden += 1
        if self.hidden or tag != 'a' or self.getpos()[0] != self.capability.htmlLine:
            return
        hrefs = [value for key, value in attrs if key == 'href']
        if len(hrefs) != 1:
            raise ValueError('ambiguous source anchor href')
        if hrefs[0] == self.capability.url:
            self.matches.append({'literal': hrefs[0], 'htmlLine': self.getpos()[0],
                                 'rawStartTag': self.get_starttag_text()})
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'template') and self.hidden:
            self.hidden -= 1


def verify_source_binding(capability, html, source_report):
    if sha(html) != capability.htmlSha256:
        raise ValueError('source HTML SHA-256 mismatch')
    parser = AnchorEvidence(capability)
    parser.feed(html.decode('utf-8-sig', errors='strict')); parser.close()
    if len(parser.matches) != 1:
        raise ValueError('exact source href and line not uniquely corroborated')
    documents = [d for d in source_report.get('documents', []) if d.get('id') == capability.id]
    receipts = [r for r in source_report.get('requests', []) if r.get('url') == capability.htmlUrl]
    if len(documents) != 1 or len(receipts) != 1:
        raise ValueError('source capture report has missing or duplicate provenance')
    document, receipt = documents[0], receipts[0]
    if (document.get('url') != capability.htmlUrl or document.get('snapshotSha256') != capability.htmlSha256
            or receipt.get('sha256') != capability.htmlSha256 or receipt.get('status') != 200
            or receipt.get('mime') != 'text/html' or receipt.get('finalUrl') != capability.htmlUrl
            or receipt.get('bodyBytes') != len(html) or receipt.get('snapshotPath') != capability.id+'.html'
            or receipt.get('error') is not None):
        raise ValueError('source capture receipt or document metadata mismatch')
    return {**capability._asdict(), **parser.matches[0],
            'htmlRequestedAt': receipt.get('requestedAt'), 'htmlFinishedAt': receipt.get('finishedAt'),
            'sourceReportPath': SOURCE_REPORT, 'sourceReportSha256': SOURCE_REPORT_SHA256,
            'querySemantics': 'opaque exact source href; not an effective date or verified legal version',
            'versionBindingReview': 'pending', 'effectiveAt': None}


def source_preflight():
    raw_report = read_public_snapshot(SOURCE_REPORT, 1024*1024)
    if sha(raw_report) != SOURCE_REPORT_SHA256:
        raise ValueError('original HTML capture report SHA-256 mismatch')
    source_report = json.loads(raw_report)
    if source_report.get('schemaVersion') != 1 or source_report.get('state') != 'complete-quarantine':
        raise ValueError('source capture report is not the reviewed quarantine capture')
    result = []
    for cap in CAPABILITIES:
        html = read_public_snapshot(cap.htmlSnapshotPath, 2*1024*1024)
        result.append((cap, html, verify_source_binding(cap, html, source_report)))
    return raw_report, result


class CaptureDirectory:
    def __init__(self, name):
        if not re.fullmatch(r'[a-z][a-z0-9-]{0,79}', name):
            raise ValueError('new canonical output leaf required')
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
        fd = os.open(REPO, flags)
        try:
            for part in ('artifacts', 'public-corpus'):
                try: os.mkdir(part, mode=0o700, dir_fd=fd)
                except FileExistsError: pass
                next_fd = os.open(part, flags, dir_fd=fd)
                os.close(fd); fd = next_fd
            os.mkdir(name, mode=0o700, dir_fd=fd)
            self.fd = os.open(name, flags, dir_fd=fd)
        finally:
            os.close(fd)
        self.relative = 'artifacts/public-corpus/'+name
    def write(self, name, data):
        if not re.fullmatch(r'[a-z][a-z0-9-]*\.(?:pdf|html|json|txt)', name):
            raise ValueError('noncanonical snapshot filename')
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=self.fd)
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data); handle.flush(); os.fsync(handle.fileno()); os.fchmod(handle.fileno(), 0o400)
    def close(self):
        os.close(self.fd)


@contextlib.contextmanager
def response_for(url, timeout):
    validate_request_url(url)
    helper = load_reviewed_helpers()
    opener = build_opener(ProxyHandler({}), helper.NoRedirect(), HTTPSHandler(context=ssl.create_default_context()))
    request = Request(url, headers={'User-Agent': AGENT, 'Accept': 'text/plain' if url == ROBOTS else 'application/pdf',
                                    'Accept-Encoding': 'identity'})
    try:
        response = opener.open(request, timeout=timeout)
    except HTTPError as error:
        response = error
    try:
        yield response
    finally:
        response.close()


def checked_limits(bounds):
    limits = dict(LIMITS) if bounds is None else dict(bounds)
    if set(limits) != set(LIMITS):
        raise ValueError('exact bounded configuration required')
    for key, value in limits.items():
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
            raise ValueError('invalid limits')
        if key.startswith('max') and not isinstance(value, int):
            raise ValueError('integer request/byte limits required')
        if key == 'gapSeconds':
            if value < LIMITS[key]: raise ValueError('cannot reduce request gap')
        elif key in ('concurrency', 'retries', 'redirects'):
            if value != LIMITS[key]: raise ValueError('cannot change execution policy')
        elif value <= 0 or value > LIMITS[key]:
            raise ValueError('cannot expand capture budget')
    return limits


def capture_live(output_name, *, transport=response_for, clock=time.monotonic, sleep=time.sleep, now=utc_now, bounds=None):
    limits, started = checked_limits(bounds), clock()
    helper = load_reviewed_helpers()
    raw_source_report, bindings = source_preflight()  # No output or network before corroboration.
    report = {**plan(), 'action': 'live-public-pdf-research', 'state': 'running', 'startedAt': now(),
              'limits': limits, 'requests': [], 'documents': [], 'consumedBodyBytes': 0,
              'sourceBindings': [binding for _, _, binding in bindings]}
    directory = CaptureDirectory(output_name)
    report['artifactDirectory'] = directory.relative
    last_start = None
    def remaining():
        left = limits['batchSeconds']-(clock()-started)
        if left <= 0: raise TimeoutError('batch deadline exceeded')
        return left
    def request(url, maximum, delay, filename):
        nonlocal last_start
        validate_request_url(url)
        if len(report['requests']) >= limits['maxRequests']:
            raise ValueError('request budget exhausted')
        wait = max(0, delay-(clock()-last_start)) if last_start is not None else 0
        if wait >= remaining(): raise TimeoutError('required robots delay exceeds remaining batch')
        if wait: sleep(wait)
        remaining(); last_start = clock()
        receipt = {'url': url, 'requestedAt': now(), 'status': None, 'mime': None, 'finalUrl': None,
                   'bodyBytes': 0, 'sha256': None, 'snapshotPath': None, 'error': None}
        report['requests'].append(receipt)
        def check_deadline():
            remaining()
            if clock()-last_start >= limits['requestSeconds']:
                raise TimeoutError('absolute request deadline exceeded')
        try:
            with helper.request_deadline(min(limits['requestSeconds'], remaining())):
                with transport(url, min(limits['requestSeconds'], remaining())) as response:
                    check_deadline()
                    receipt.update(status=response.status, finalUrl=response.geturl(), contentType=response.headers.get('Content-Type', ''))
                    receipt['mime'] = receipt['contentType'].split(';', 1)[0].strip().lower()
                    if 300 <= response.status < 400:
                        receipt['redirectLocationLiteral'] = response.headers.get('Location')
                    if response.status != 200 or response.geturl() != url:
                        raise ValueError('non-200 or redirected response blocked; no retry')
                    if hasattr(response.headers, 'get_all'):
                        for key in ('Content-Type', 'Content-Length', 'Content-Encoding'):
                            if len(response.headers.get_all(key, [])) > 1:
                                raise ValueError('ambiguous duplicate response header')
                    if receipt['mime'] != ('text/plain' if url == ROBOTS else 'application/pdf'):
                        raise ValueError('unsupported response MIME')
                    if response.headers.get('Content-Encoding', 'identity').lower() != 'identity':
                        raise ValueError('compressed body unsupported')
                    declared = response.headers.get('Content-Length')
                    if declared is not None and (not declared.isdigit() or int(declared) > maximum):
                        raise ValueError('invalid or excessive Content-Length')
                    chunks = []
                    while True:
                        check_deadline()
                        chunk = response.read1(min(65536, maximum-receipt['bodyBytes']+1,
                                                   limits['maxTotalBytes']-report['consumedBodyBytes']+1))
                        if not chunk: break
                        receipt['bodyBytes'] += len(chunk)
                        report['consumedBodyBytes'] += len(chunk)
                        if receipt['bodyBytes'] > maximum or report['consumedBodyBytes'] > limits['maxTotalBytes']:
                            raise ValueError('body byte budget exceeded')
                        chunks.append(chunk)
                    check_deadline()
                    data = b''.join(chunks)
                    if not data or (declared is not None and len(data) != int(declared)):
                        raise ValueError('empty or truncated response body')
                    receipt['sha256'] = sha(data)
                    if url != ROBOTS and not data.startswith(b'%PDF-'):
                        raise ValueError('PDF magic mismatch; no PDF snapshot')
                    directory.write(filename, data)
                    receipt['snapshotPath'], receipt['finishedAt'] = filename, now()
                    return data
        except Exception as error:
            receipt['error'] = type(error).__name__+': '+str(error)[:256]
            raise
        finally:
            receipt['elapsedMs'] = round((clock()-last_start)*1000, 3)
    try:
        directory.write('source-report.json', raw_source_report)
        for cap, html, _ in bindings:
            directory.write('source-'+cap.id+'.html', html)
        remaining()
        robots = request(ROBOTS, limits['maxRobotsBytes'], limits['gapSeconds'], 'robots.txt').decode('utf-8', errors='strict')
        policies = {cap.url: helper.robots_policy(robots, cap.url) for cap in CAPABILITIES}
        report['robotsPolicies'] = policies
        if not all(policy['allowed'] for policy in policies.values()):
            raise ValueError('robots blocks one or more exact PDF destinations')
        for cap, _, binding in bindings:
            data = request(cap.url, limits['maxPdfBytes'], max(limits['gapSeconds'], policies[cap.url]['crawlDelaySeconds']), cap.id+'.pdf')
            report['documents'].append({'id': cap.id, 'url': cap.url, 'sha256': sha(data), 'bytes': len(data),
                'snapshotPath': cap.id+'.pdf', 'sourceBinding': binding, 'state': 'captured-quarantine',
                'rightsReview': 'pending', 'textReview': 'pending', 'legalReview': 'pending',
                'versionBindingReview': 'pending', 'effectiveAt': None, 'approvedForAcquisition': False,
                'extracted': False, 'indexed': False, 'published': False})
            remaining()
        report['state'] = 'complete-quarantine'
    except Exception as error:
        report['state'] = 'blocked'
        report['error'] = type(error).__name__+': '+str(error)[:256]
    finally:
        captured = {d['id'] for d in report['documents']}
        report['notCaptured'] = [{'id': cap.id, 'url': cap.url, 'state': 'pending-research-capture'} for cap in CAPABILITIES if cap.id not in captured]
        report['finishedAt'], report['elapsedMs'] = now(), round((clock()-started)*1000, 3)
        try:
            directory.write('report.json', (json.dumps(report, ensure_ascii=False, indent=2)+'\n').encode())
        finally:
            directory.close()
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--plan', action='store_true')
    mode.add_argument('--live', action='store_true')
    parser.add_argument('--out-name', help='new canonical leaf below artifacts/public-corpus')
    args = parser.parse_args(argv)
    if not args.live:
        if args.out_name: parser.error('--out-name requires --live')
        print(json.dumps(plan(), ensure_ascii=False, indent=2))
        return 0
    name = args.out_name or 'nl-pdfs-'+datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    report = capture_live(name)
    print(json.dumps({'state': report['state'], 'artifactDirectory': report['artifactDirectory'],
                      'requests': len(report['requests']), 'consumedBodyBytes': report['consumedBodyBytes'],
                      'approvedForAcquisition': False}, ensure_ascii=False))
    return 0 if report['state'] == 'complete-quarantine' else 1


if __name__ == '__main__':
    raise SystemExit(main())
