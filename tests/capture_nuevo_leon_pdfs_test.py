import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1]/'scripts/capture-nuevo-leon-pdfs.py'
SPEC = importlib.util.spec_from_file_location('nl_pdf_research', SCRIPT)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)
PDF = b'%PDF-1.7\nSynthetic public research test, not legal text.\n%%EOF\n'
ROBOTS = b'User-agent: *\nAllow: /\n'


class Clock:
    def __init__(self): self.value, self.waits = 0, []
    def __call__(self): return self.value
    def sleep(self, value): self.waits.append(value); self.value += value


class Response:
    def __init__(self, url, data, *, status=200, mime='application/pdf', headers=None, clock=None, delay=0):
        self.url, self.body, self.status = url, io.BytesIO(data), status
        self.headers = {'Content-Type': mime, **(headers or {})}
        self.clock, self.delay, self.closed = clock, delay, False
    def geturl(self): return self.url
    def read1(self, count):
        if self.clock: self.clock.value += self.delay
        return self.body.read(count)
    def close(self): self.closed = True


class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.clock, self.calls = Clock(), []
        self.patches = [patch.object(module, 'REPO', self.root)]
        self.source = self.root/module.SOURCE_DIRECTORY
        self.source.mkdir(parents=True)
        caps, documents, receipts = [], [], []
        for original in module.CAPABILITIES:
            html = ('\n'*555+'<a href="'+original.url+'">Synthetic official-link fixture</a>\n').encode()
            cap = original._replace(htmlSha256=module.sha(html))
            caps.append(cap)
            (self.root/cap.htmlSnapshotPath).write_bytes(html)
            documents.append({'id': cap.id, 'url':cap.htmlUrl, 'snapshotSha256':cap.htmlSha256})
            receipts.append({'url':cap.htmlUrl,'status':200,'mime':'text/html','finalUrl':cap.htmlUrl,
                             'bodyBytes':len(html),'sha256':cap.htmlSha256,'snapshotPath':cap.id+'.html',
                             'requestedAt':'2026-11-10T18:00:00.000Z','finishedAt':'2026-11-10T18:00:00.001Z','error':None})
        self.report = {'schemaVersion':1,'state':'complete-quarantine','documents':documents,'requests':receipts}
        self.source_report_bytes = json.dumps(self.report).encode()
        (self.root/module.SOURCE_REPORT).write_bytes(self.source_report_bytes)
        self.patches += [patch.object(module,'CAPABILITIES',tuple(caps)),
                         patch.object(module,'SOURCE_REPORT_SHA256',module.sha(self.source_report_bytes))]
        for item in self.patches: item.start()
    def tearDown(self):
        for item in reversed(self.patches):item.stop()
        self.temp.cleanup()
    def transport(self, responses=None):
        responses = responses or [Response(module.ROBOTS,ROBOTS,mime='text/plain'),
                                  *(Response(cap.url,PDF) for cap in module.CAPABILITIES)]
        @contextlib.contextmanager
        def execute(url,timeout):
            self.calls.append((url,timeout,self.clock()))
            yield responses[len(self.calls)-1]
        return execute
    def capture(self,name='pdf-fixture',**kwargs):
        return module.capture_live(name,transport=kwargs.pop('transport',self.transport()),clock=self.clock,
                                   sleep=self.clock.sleep,now=lambda:'2026-11-10T19:00:00.000Z',**kwargs)

    def test_plan_no_artifact_io_or_network_and_cli_cannot_override_url_or_query(self):
        with patch.object(module,'source_preflight',side_effect=AssertionError('source IO')), \
             patch.object(module,'load_reviewed_helpers',side_effect=AssertionError('helper IO')), \
             patch.object(module,'capture_live',side_effect=AssertionError('live')):
            with contextlib.redirect_stdout(io.StringIO()) as output:self.assertEqual(module.main([]),0)
            plan=json.loads(output.getvalue())
            self.assertEqual(plan['action'],'plan')
            self.assertEqual([d['url'] for d in plan['documents']],[c.url for c in module.CAPABILITIES])
            with contextlib.redirect_stderr(io.StringIO()):
                for args in [['--url',module.CAPABILITIES[0].url],['--query','2026-06-26'],['--plan','--live'],['--out-name','x']]:
                    with self.assertRaises(SystemExit):module.main(args)
        self.assertEqual(self.calls,[])

    def test_request_capability_is_exact_and_preserves_opaque_query(self):
        for cap in module.CAPABILITIES:
            self.assertEqual(module.validate_request_url(cap.url),cap.url)
            variants=[cap.url.split('?')[0],cap.url+'0',cap.url+'&extra=1',cap.url+'#x',cap.url.replace('?','?date='),
                      cap.url.replace('https://','http://'),cap.url.replace('www.hcnl.gob.mx','hcnl.gob.mx'),
                      cap.url.replace('www.hcnl.gob.mx','user@www.hcnl.gob.mx'),cap.url.replace('%20',' '),
                      cap.url.replace('/pdf/','/pdf/../pdf/'),'https://127.0.0.1/a.pdf']
            for value in variants:
                with self.subTest(value=value),self.assertRaises(ValueError):module.validate_request_url(value)

    def test_html_and_source_report_pins_verified_before_output_or_network(self):
        path=self.root/module.CAPABILITIES[0].htmlSnapshotPath
        path.write_bytes(path.read_bytes()+b'changed')
        with self.assertRaisesRegex(ValueError,'HTML SHA'):self.capture()
        self.assertEqual(self.calls,[])
        self.assertFalse((self.root/'artifacts/public-corpus/pdf-fixture').exists())
        (self.root/module.SOURCE_REPORT).write_bytes(self.source_report_bytes+b' ')
        with self.assertRaisesRegex(ValueError,'report SHA'):self.capture('other')
        self.assertEqual(self.calls,[])

    def test_literal_anchor_line_is_unique_inert_and_query_never_stripped(self):
        original=module.CAPABILITIES[0]
        variants=[original.url.split('?')[0],original.url.replace('?','?date=')]
        for value in variants:
            html=('\n'*555+'<a href="'+value+'">x</a>').encode()
            cap=original._replace(htmlSha256=module.sha(html))
            with self.assertRaisesRegex(ValueError,'source href'):module.verify_source_binding(cap,html,self.report)
        for tag in ['<script><a href="'+original.url+'"></a></script>',
                    '<template><a href="'+original.url+'"></a></template>',
                    '<a href="'+original.url+'" href="'+original.url+'"></a>',
                    '<a href="'+original.url+'"></a><a href="'+original.url+'"></a>']:
            html=('\n'*555+tag).encode();cap=original._replace(htmlSha256=module.sha(html))
            with self.assertRaises(ValueError):module.verify_source_binding(cap,html,self.report)
        raw=(self.root/original.htmlSnapshotPath).read_bytes()
        with self.assertRaises(ValueError):module.verify_source_binding(original._replace(htmlLine=555),raw,self.report)

    def test_recomputed_report_hash_cannot_hide_source_receipt_metadata_drift(self):
        self.report['requests'][0]['finalUrl']='https://evil.invalid/source'
        data=json.dumps(self.report).encode();(self.root/module.SOURCE_REPORT).write_bytes(data)
        with patch.object(module,'SOURCE_REPORT_SHA256',module.sha(data)):
            with self.assertRaisesRegex(ValueError,'metadata mismatch'):self.capture()
        self.assertEqual(self.calls,[])

    def test_capture_keeps_exact_query_original_pdf_hash_provenance_and_quarantine(self):
        large=PDF+b'X'*(3*1024*1024)
        report=self.capture(transport=self.transport([Response(module.ROBOTS,ROBOTS,mime='text/plain'),
                            Response(module.CAPABILITIES[0].url,large),Response(module.CAPABILITIES[1].url,PDF)]))
        self.assertEqual(report['state'],'complete-quarantine')
        self.assertEqual([c[0] for c in self.calls],[module.ROBOTS,*(c.url for c in module.CAPABILITIES)])
        self.assertEqual(self.clock.waits,[2,2])
        directory=self.root/report['artifactDirectory']
        for receipt in report['requests']:
            raw=(directory/receipt['snapshotPath']).read_bytes()
            self.assertEqual(module.sha(raw),receipt['sha256'])
            self.assertEqual(len(raw),receipt['bodyBytes'])
            self.assertEqual(receipt['url'],receipt['finalUrl'])
            self.assertFalse((directory/receipt['snapshotPath']).stat().st_mode&0o222)
        for cap in module.CAPABILITIES:
            self.assertEqual(module.sha((directory/('source-'+cap.id+'.html')).read_bytes()),cap.htmlSha256)
        self.assertEqual((directory/'source-report.json').read_bytes(),self.source_report_bytes)
        self.assertEqual(json.loads((directory/'report.json').read_bytes()),report)
        self.assertEqual(report['notCaptured'],[])
        for doc in report['documents']:
            self.assertFalse(doc['approvedForAcquisition'] or doc['published'] or doc['indexed'] or doc['extracted'])
            self.assertIsNone(doc['effectiveAt'])
            self.assertEqual(doc['versionBindingReview'],'pending')
            self.assertEqual(doc['sourceBinding']['htmlLine'],556)

    def test_no_overwrite_or_output_escape_even_for_existing_empty_leaf(self):
        report=self.capture()
        directory=self.root/report['artifactDirectory']
        before={p.name:p.read_bytes() for p in directory.iterdir()};calls=len(self.calls)
        with self.assertRaises(FileExistsError):self.capture()
        self.assertEqual(len(self.calls),calls)
        self.assertEqual(before,{p.name:p.read_bytes() for p in directory.iterdir()})
        for name in ['../escape','/tmp/escape','a/b','x.pdf']:
            with self.assertRaises(ValueError):self.capture(name)
        (self.root/'artifacts/public-corpus/empty').mkdir()
        with self.assertRaises(FileExistsError):self.capture('empty')

    def test_source_symlink_rejected_before_any_request(self):
        source=self.root/module.CAPABILITIES[0].htmlSnapshotPath
        content=source.read_bytes();source.unlink()
        external=self.root/'external.html';external.write_bytes(content)
        source.symlink_to(external)
        with self.assertRaises(OSError):self.capture()
        self.assertEqual(self.calls,[])

    def test_redirect_403_406_stop_and_keep_two_document_denominator(self):
        for status in [301,302,307,308,403,406]:
            self.calls.clear()
            report=self.capture('status-'+str(status),transport=self.transport([Response(module.ROBOTS,ROBOTS,mime='text/plain'),
                Response(module.CAPABILITIES[0].url,b'',status=status,headers={'Location':module.CAPABILITIES[1].url})]))
            self.assertEqual(report['state'],'blocked')
            self.assertEqual(len(self.calls),2)
            self.assertEqual(report['requests'][1]['status'],status)
            self.assertEqual(len(report['notCaptured']),2)
            self.assertEqual(report['documents'],[])
            self.assertIsNone(report['requests'][1]['snapshotPath'])

    def test_request_and_body_budgets_stop_before_remaining_document(self):
        for i,limits in enumerate([{'maxRequests':2},{'maxPdfBytes':32},{'maxTotalBytes':len(ROBOTS)+32}]):
            self.calls.clear()
            report=self.capture('budget-'+str(i),bounds={**module.LIMITS,**limits})
            self.assertEqual(report['state'],'blocked')
            self.assertEqual(len(self.calls),2)
            self.assertTrue(any(d['id']=='nl-penal' for d in report['notCaptured']))
        self.calls.clear()
        report=self.capture('declared-size',transport=self.transport([Response(module.ROBOTS,ROBOTS,mime='text/plain'),
            Response(module.CAPABILITIES[0].url,PDF,headers={'Content-Length':str(module.LIMITS['maxPdfBytes']+1)})]))
        self.assertEqual(report['requests'][1]['bodyBytes'],0)
        self.assertEqual(report['state'],'blocked')

    def test_absolute_request_and_batch_deadlines(self):
        report=self.capture('timeout',transport=self.transport([Response(module.ROBOTS,ROBOTS,mime='text/plain',clock=self.clock,delay=16)]))
        self.assertIn('deadline',report['error']);self.assertEqual(len(self.calls),1)
        self.calls.clear();self.clock=Clock()
        report=self.capture('batch',bounds={**module.LIMITS,'batchSeconds':1})
        self.assertEqual(report['state'],'blocked');self.assertEqual(len(self.calls),1)
        self.assertEqual(self.clock.waits,[])

    def test_robots_disallow_percent_absolute_and_unreadable_fail_closed_before_pdfs(self):
        policies=[b'User-agent: *\nDisallow: /trabajo_legislativo/',
                  b'User-agent: *\nAllow: /\nDisallow: /trabajo%5flegislativo/',
                  b'User-agent: Other\nDisallow: https://www.hcnl.gob.mx/trabajo_legislativo/\nUser-agent: *\nAllow: /',
                  b'User-agent: *\nDisallow: /x?2026-06-26',b'<script>Allow: /</script>']
        for i,policy in enumerate(policies):
            self.calls.clear()
            report=self.capture('robots-'+str(i),transport=self.transport([Response(module.ROBOTS,policy,mime='text/plain')]))
            self.assertEqual(report['state'],'blocked');self.assertEqual(len(self.calls),1)
            self.assertEqual(len(report['notCaptured']),2)

    def test_larger_robots_delay_applies_and_unaffordable_delay_blocks(self):
        policy=b'User-agent: *\nAllow: /\nCrawl-delay: 3\n'
        report=self.capture(transport=self.transport([Response(module.ROBOTS,policy,mime='text/plain'),*(Response(c.url,PDF) for c in module.CAPABILITIES)]))
        self.assertEqual(report['state'],'complete-quarantine');self.assertEqual(self.clock.waits,[3,3])
        self.calls.clear();self.clock=Clock()
        report=self.capture('delay',transport=self.transport([Response(module.ROBOTS,b'User-agent: *\nCrawl-delay: 121',mime='text/plain')]))
        self.assertEqual(report['state'],'blocked');self.assertEqual(len(self.calls),1)

    def test_mime_magic_encoding_empty_and_truncation_never_create_pdf_snapshot(self):
        cases=[Response(module.CAPABILITIES[0].url,PDF,mime='text/html'),
               Response(module.CAPABILITIES[0].url,b'<html>not PDF</html>'),
               Response(module.CAPABILITIES[0].url,PDF,headers={'Content-Encoding':'gzip'}),
               Response(module.CAPABILITIES[0].url,b''),
               Response(module.CAPABILITIES[0].url,PDF,headers={'Content-Length':str(len(PDF)+1)})]
        for i,response in enumerate(cases):
            self.calls.clear()
            report=self.capture('invalid-'+str(i),transport=self.transport([Response(module.ROBOTS,ROBOTS,mime='text/plain'),response]))
            self.assertEqual(report['state'],'blocked');self.assertEqual(report['documents'],[])
            self.assertIsNone(report['requests'][1]['snapshotPath'])
            self.assertEqual(list((self.root/report['artifactDirectory']).glob('*.pdf')),[])

    def test_no_budget_or_execution_policy_expansion(self):
        for key,value in [('maxRequests',4),('maxPdfBytes',11*1024*1024),('maxTotalBytes',21*1024*1024),
                          ('gapSeconds',0),('retries',1),('redirects',1),('concurrency',2),('requestSeconds',16),
                          ('batchSeconds',121),('maxRequests',2.5)]:
            with self.assertRaises(ValueError):self.capture(bounds={**module.LIMITS,key:value})
        self.assertEqual(self.calls,[])

    def test_transport_keeps_query_and_has_no_auth_cookie_proxy_or_redirect_follow(self):
        cap=module.CAPABILITIES[0];response=Response(cap.url,PDF)
        class Opener:
            def open(self,request,timeout):
                self.request,self.timeout=request,timeout
                return response
        opener=Opener()
        with patch.object(module,'build_opener',return_value=opener) as build:
            with module.response_for(cap.url,15) as observed:self.assertIs(observed,response)
        self.assertTrue(response.closed)
        self.assertEqual(opener.request.full_url,cap.url)
        headers={k.lower():v for k,v in opener.request.header_items()}
        self.assertEqual(headers['accept'],'application/pdf')
        self.assertNotIn('authorization',headers);self.assertNotIn('cookie',headers)
        self.assertTrue(any(getattr(handler,'proxies',None)=={} for handler in build.call_args.args))
        self.assertTrue(any(handler.__class__.__name__=='NoRedirect' for handler in build.call_args.args))
        with patch.object(module,'build_opener',side_effect=AssertionError('must reject before opener')):
            with self.assertRaises(ValueError):
                with module.response_for(cap.url.split('?')[0],15):pass

    def test_reviewed_helper_hash_drift_blocks_before_io_or_network(self):
        with patch.object(module,'HELPER_SHA256','0'*64):
            with self.assertRaisesRegex(ValueError,'helper changed'):self.capture()
        self.assertFalse((self.root/'artifacts/public-corpus/pdf-fixture').exists())
        self.assertEqual(self.calls,[])


if __name__ == '__main__':
    unittest.main()
