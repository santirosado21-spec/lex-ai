import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/inspect-nuevo-leon-links.py'
SPEC = importlib.util.spec_from_file_location('nl_link_inspector', SCRIPT)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)
HTML = b'''<html><h3>CODIGO CIVIL</h3><h5>Ultima Reforma</h5>
<a href="/trabajo_legislativo/leyes/pdf/CODIGO%20CIVIL.pdf">PDF</a>
<button onclick="window.open('/trabajo_legislativo/leyes/doc/CIVIL.docx', '_blank')">Word</button>
<script>fetch('https://evil.invalid/private'); window.open('/fake.pdf')</script></html>'''
ROBOTS = b'User-agent: *\nAllow: /\n'


class Clock:
    def __init__(self):
        self.value, self.waits = 0, []
    def __call__(self):
        return self.value
    def sleep(self, seconds):
        self.waits.append(seconds)
        self.value += seconds


class Response:
    def __init__(self, url, body, status=200, mime='text/html', headers=None, clock=None, delay=0):
        self.status, self.body, self.url = status, io.BytesIO(body), url
        self.headers = {'Content-Type': mime, **(headers or {})}
        self.clock, self.delay = clock, delay
    def geturl(self):
        return self.url
    def read1(self, count):
        if self.clock:
            self.clock.value += self.delay
        return self.body.read(count)


class InspectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.root_patch = patch.object(module, 'REPO', self.root)
        self.root_patch.start()
        self.clock, self.calls = Clock(), []
    def tearDown(self):
        self.root_patch.stop()
        self.temp.cleanup()
    def transport(self, responses=None):
        queue = responses or [Response(module.ROBOTS, ROBOTS, mime='text/plain'),
                              *(Response(url, HTML) for _, url in module.DOCUMENTS)]
        @contextlib.contextmanager
        def execute(url, timeout):
            self.calls.append((url, timeout, self.clock()))
            response = queue[len(self.calls)-1]
            yield response
        return execute
    def run_capture(self, name='fixture', **kwargs):
        return module.inspect_live(name, transport=kwargs.pop('transport', self.transport()),
                                   clock=self.clock, sleep=self.clock.sleep,
                                   now=lambda: '2026-11-10T18:00:00.000Z', **kwargs)

    def test_plan_cli_never_touches_network_or_files_and_arbitrary_url_rejected(self):
        with patch.object(module, 'inspect_live', side_effect=AssertionError('live called')):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(module.main([]), 0)
            self.assertEqual(json.loads(output.getvalue())['action'], 'plan')
            with contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit): module.main(['--url', 'https://evil.invalid'])
                with self.assertRaises(SystemExit): module.main(['--plan', '--live'])
                with self.assertRaises(SystemExit): module.main(['--out-name', 'fixture'])
        self.assertFalse((self.root/'artifacts').exists())

    def test_fixed_requests_immutable_snapshots_and_hash_bound_receipts(self):
        report = self.run_capture()
        self.assertEqual(report['state'], 'complete-quarantine')
        self.assertEqual([call[0] for call in self.calls], [module.ROBOTS, *(u for _, u in module.DOCUMENTS)])
        self.assertEqual(self.clock.waits, [2, 2])
        directory = self.root/report['artifactDirectory']
        for receipt in report['requests']:
            raw = (directory/receipt['snapshotPath']).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), receipt['sha256'])
            self.assertEqual(len(raw), receipt['bodyBytes'])
            self.assertEqual((directory/receipt['snapshotPath']).stat().st_mode & 0o222, 0)
        self.assertEqual(json.loads((directory/'report.json').read_text()), report)
        self.assertTrue(all(not d['approvedForAcquisition'] and d['effectiveAt'] is None for d in report['documents']))
        before = {p.name:p.read_bytes() for p in directory.iterdir()}
        calls = len(self.calls)
        with self.assertRaises(FileExistsError): self.run_capture()
        self.assertEqual(len(self.calls), calls)
        self.assertEqual(before, {p.name:p.read_bytes() for p in directory.iterdir()})

    def test_html_and_onclick_are_inert_and_only_literal_same_origin_candidates_survive(self):
        parser = module.LinkInspector(module.DOCUMENTS[0][1])
        parser.feed(HTML.decode()+'''<base href="https://evil.invalid/">
        <a href="javascript:window.open('/bad.pdf')">run</a>
        <a href="https://evil.invalid/offhost.pdf">off</a>
        <a href="/safe.pdf?private=case">query</a>
        <button onclick="window.open('/a' + '.pdf')">concat</button>
        <button onclick="window.open('/safe.pdf'); fetch('/unreviewed')">extra</button>
        <!-- <a href='/comment.pdf'> -->
        <template><a href='/template.pdf'></a></template>''')
        result = parser.result()
        self.assertEqual({x['format'] for x in result['candidates']}, {'pdf', 'docx'})
        self.assertEqual(len(result['candidates']), 2)
        self.assertEqual(len(result['rejectedLinks']), 3)
        self.assertEqual(len(result['unresolved']), 3)
        self.assertTrue(all(x['url'].startswith(module.ORIGIN+'/trabajo_legislativo/') for x in result['candidates']))
        self.assertTrue(all(x['literal'].startswith('/trabajo_legislativo/') and x['htmlLine'] > 0 for x in result['candidates']))
        parser.feed('<h5>Última Reforma</h5><span>26 de Junio 2026</span>')
        self.assertIn('26 de Junio 2026',parser.result()['declaredReformRawSnippet'])
        self.assertIsNone(parser.result()['effectiveAt'])

    def test_candidate_url_rejects_origin_traversal_credentials_and_encoded_ambiguity(self):
        for value in ['http://www.hcnl.gob.mx/a.pdf','https://hcnl.gob.mx/a.pdf','https://user@www.hcnl.gob.mx/a.pdf',
                      'https://www.hcnl.gob.mx:443/a.pdf','//evil.invalid/a.pdf','../a.pdf','/a/../b.pdf','/%2e%2e/a.pdf',
                      '/%252e%252e/a.pdf','/a%2fb.pdf','/a.pdf?','/a.pdf#','/a\\b.pdf','data:text/plain,a.pdf',
                      'https://127.0.0.1/a.pdf','/a%00.pdf','/a%XX.pdf']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                module.candidate_url(value, module.DOCUMENTS[0][1])
        self.assertEqual(module.candidate_url('/pdf/CODIGO CIVIL.pdf', module.DOCUMENTS[0][1])[0], module.ORIGIN+'/pdf/CODIGO%20CIVIL.pdf')

    def test_redirects_403_406_never_follow_or_retry_and_preserve_failed_receipt(self):
        for code in [301,302,307,308,403,406,404]:
            self.calls.clear()
            report = self.run_capture('status-'+str(code), transport=self.transport([
                Response(module.ROBOTS,b'blocked',status=code,mime='text/plain',headers={'Location':module.DOCUMENTS[0][1]})]))
            self.assertEqual(report['state'], 'blocked')
            self.assertEqual(len(self.calls), 1)
            self.assertEqual(report['requests'][0]['status'], code)
            self.assertEqual(report['requests'][0]['bodyBytes'], 0)
            self.assertEqual(len(report['notCaptured']), 2)
            self.assertEqual(list((self.root/report['artifactDirectory']).glob('*.html')), [])

    def test_robots_specific_agent_longest_rule_and_crawl_delay(self):
        text = 'User-agent: *\nDisallow: /\nUser-agent: LexAI-PublicSourceInspector\nDisallow: /private/\nAllow: /private/public.pdf$\nCrawl-delay: 3\n'
        self.assertTrue(module.robots_policy(text,module.ORIGIN+'/private/public.pdf')['allowed'])
        self.assertFalse(module.robots_policy(text,module.ORIGIN+'/private/hidden.pdf')['allowed'])
        # A blank line does not silently drop a restrictive directive.
        self.assertFalse(module.robots_policy('User-agent: *\n\nDisallow: /',module.DOCUMENTS[0][1])['allowed'])
        robots = b'User-agent: *\nAllow: /\nCrawl-delay: 3\n'
        report = self.run_capture(transport=self.transport([Response(module.ROBOTS,robots,mime='text/plain'),*(Response(u,HTML) for _,u in module.DOCUMENTS)]))
        self.assertEqual(report['state'], 'complete-quarantine')
        self.assertEqual(self.clock.waits, [3,3])

    def test_robots_disallow_unknown_or_unaffordable_delay_blocks_before_html(self):
        for i,body in enumerate([b'User-agent: *\nDisallow: /',b'<html>error</html>',b'User-agent: *\nCrawl-delay: nan',b'User-agent: *\nCrawl-delay: 121',b'User-agent: *\nRequest-rate: 1/10']):
            self.calls.clear()
            report = self.run_capture('robots-'+str(i),transport=self.transport([Response(module.ROBOTS,body,mime='text/plain')]))
            self.assertEqual(report['state'], 'blocked')
            self.assertEqual(len(self.calls),1)

    def test_robots_encoded_absolute_and_nonpath_rules_fail_closed(self):
        unsupported=['/trabajo%5Flegislativo/','/trabajo%5flegislativo/',
                     module.ORIGIN+'/trabajo_legislativo/','//www.hcnl.gob.mx/trabajo_legislativo/',
                     'trabajo_legislativo/','/trabajo_legislativo/?kind=pdf','/a/../trabajo_legislativo/',
                     '/trabajo_legislativo/$/suffix','/trabajo_legislativo/\\civil']
        for rule in unsupported:
            for directive in ('Allow','Disallow'):
                with self.subTest(rule=rule,directive=directive), self.assertRaisesRegex(ValueError,'unsupported robots path rule'):
                    module.robots_policy('User-agent: *\n'+directive+': '+rule,module.DOCUMENTS[0][1])
        self.assertFalse(module.robots_policy('User-agent: *\nDisallow: /trabajo_legislativo/',module.DOCUMENTS[0][1])['allowed'])

    def test_robots_mixed_allow_deny_cannot_mask_unsupported_rule(self):
        for rules in ['Allow: /\nDisallow: /trabajo%5Flegislativo/',
                      'Disallow: /\nAllow: /trabajo%5Flegislativo/',
                      'Allow: /\nDisallow: '+module.ORIGIN+'/trabajo_legislativo/',
                      'Disallow: /\nAllow: '+module.ORIGIN+'/trabajo_legislativo/']:
            with self.subTest(rules=rules), self.assertRaises(ValueError):
                module.robots_policy('User-agent: *\n'+rules,module.DOCUMENTS[0][1])

    def test_robots_unrelated_groups_are_still_validated_and_do_not_override_wildcard(self):
        valid='User-agent: OtherBot\nDisallow: /\nUser-agent: *\nAllow: /\n'
        self.assertTrue(module.robots_policy(valid,module.DOCUMENTS[0][1])['allowed'])
        restricted='User-agent: OtherBot\nAllow: /\nUser-agent: *\nDisallow: /trabajo_legislativo/\n'
        self.assertFalse(module.robots_policy(restricted,module.DOCUMENTS[0][1])['allowed'])
        for directive in ('Allow','Disallow'):
            text='User-agent: OtherBot\n'+directive+': /trabajo%5Flegislativo/\nUser-agent: *\nAllow: /'
            with self.assertRaises(ValueError):module.robots_policy(text,module.DOCUMENTS[0][1])
        with self.assertRaisesRegex(ValueError,'no user-agent'):
            module.robots_policy('Disallow: /trabajo_legislativo/\nUser-agent: *\nAllow: /',module.DOCUMENTS[0][1])

    def test_unsupported_robots_retains_receipt_and_blocks_all_html_requests(self):
        for i,rule in enumerate(['/trabajo%5Flegislativo/',module.ORIGIN+'/trabajo_legislativo/']):
            self.calls.clear()
            body=('User-agent: *\nAllow: /\nDisallow: '+rule).encode()
            report=self.run_capture('robots-unsupported-'+str(i),transport=self.transport([Response(module.ROBOTS,body,mime='text/plain')]))
            self.assertEqual(report['state'],'blocked')
            self.assertEqual(len(self.calls),1)
            self.assertEqual(report['requests'][0]['sha256'],hashlib.sha256(body).hexdigest())
            self.assertEqual(report['requests'][0]['snapshotPath'],'robots.txt')
            self.assertEqual(report['documents'],[])
            self.assertEqual(len(report['notCaptured']),2)
            self.assertIn('unsupported robots path rule',report['error'])

    def test_request_budget_stops_before_second_html_and_no_attachment_requests_occur(self):
        limits = {**module.BOUNDS,'maxRequests':2}
        report = self.run_capture(bounds=limits)
        self.assertEqual(len(self.calls),2)
        self.assertEqual(report['state'],'blocked')
        self.assertEqual(len(report['documents']),1)
        self.assertEqual(report['notCaptured'][0]['id'],'nl-penal')
        self.assertNotIn('.pdf', '|'.join(call[0] for call in self.calls))

    def test_body_per_document_total_and_content_length_budgets(self):
        for i,(limit,headers) in enumerate([({'maxHtmlBytes':32},{}),({'maxTotalBytes':len(ROBOTS)+32},{}),({}, {'Content-Length':str(module.BOUNDS['maxHtmlBytes']+1)}),({}, {'Content-Length':'999'})]):
            self.calls.clear()
            report = self.run_capture('body-'+str(i),bounds={**module.BOUNDS,**limit},transport=self.transport([
                Response(module.ROBOTS,ROBOTS,mime='text/plain'),Response(module.DOCUMENTS[0][1],HTML,headers=headers)]))
            self.assertEqual(report['state'],'blocked')
            self.assertEqual(len(self.calls),2)
            self.assertIsNone(report['requests'][1]['snapshotPath'])

    def test_request_and_batch_absolute_time_budgets(self):
        report = self.run_capture('timeout',transport=self.transport([
            Response(module.ROBOTS,ROBOTS,mime='text/plain',clock=self.clock,delay=16)]))
        self.assertEqual(report['state'],'blocked')
        self.assertIn('deadline',report['error'])
        self.assertEqual(len(self.calls),1)
        self.calls.clear();self.clock=Clock()
        report = self.run_capture('batch',bounds={**module.BOUNDS,'batchSeconds':1})
        self.assertEqual(report['state'],'blocked')
        self.assertEqual(len(self.calls),1)
        self.assertEqual(self.clock.waits,[])

    def test_mime_encoding_and_truncation_never_approve_or_invent_snapshot(self):
        cases=[Response(module.DOCUMENTS[0][1],b'%PDF-1.7',mime='application/pdf'),
               Response(module.DOCUMENTS[0][1],HTML,headers={'Content-Encoding':'gzip'}),
               Response(module.DOCUMENTS[0][1],b'')]
        for i,response in enumerate(cases):
            self.calls.clear()
            report=self.run_capture('mime-'+str(i),transport=self.transport([Response(module.ROBOTS,ROBOTS,mime='text/plain'),response]))
            self.assertEqual(report['state'],'blocked')
            self.assertEqual(len(report['documents']),0)
            self.assertIsNone(report['requests'][1]['snapshotPath'])

    def test_path_escape_existing_leaf_and_symlink_rejected_before_network(self):
        for name in ['../escape','/tmp/escape','x/y','x.json']:
            with self.assertRaises(ValueError):self.run_capture(name)
        (self.root/'artifacts').mkdir()
        (self.root/'artifacts'/'public-corpus').symlink_to(self.root,target_is_directory=True)
        with self.assertRaises(OSError):self.run_capture()
        self.assertEqual(self.calls,[])

    def test_config_cannot_expand_policy_and_duplicate_attributes_fail_closed(self):
        for key,value in [('gapSeconds',0),('maxRequests',5),('maxTotalBytes',10**9),('retries',1),('concurrency',2),('redirects',1)]:
            with self.assertRaises(ValueError):self.run_capture(bounds={**module.BOUNDS,key:value})
        parser=module.LinkInspector(module.DOCUMENTS[0][1])
        with self.assertRaises(ValueError):parser.feed('<a href="/a.pdf" href="https://evil.invalid/b.pdf">')
        self.assertEqual(self.calls,[])


if __name__ == '__main__':
    unittest.main()
