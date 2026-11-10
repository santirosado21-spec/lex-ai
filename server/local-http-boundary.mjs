// Loopback authority and browser boundary. This does not replace bearer auth.
const trustedOrigins = new Set([
 'tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost',
 'http://localhost:1420', 'http://127.0.0.1:1420',
]);
const singleHeaders = ['host', 'origin', 'authorization', 'content-type', 'sec-fetch-site', 'access-control-request-method', 'access-control-request-headers'];
export function localHttpBoundary(req, port) {
 const counts = new Map();
 for (let i=0; i<req.rawHeaders.length; i+=2) {
  const name=req.rawHeaders[i].toLowerCase(); counts.set(name,(counts.get(name)||0)+1);
 }
 if (singleHeaders.some(name=>(counts.get(name)||0)>1)) return {status:400};
 const host=req.headers.host;
 if (counts.get('host')!==1 || ![`127.0.0.1:${port}`,`localhost:${port}`].includes(host)) return {status:400};
 // Accept only HTTP origin-form, never absolute-form/proxy targets or //authority.
 if (typeof req.url!=='string' || !req.url.startsWith('/') || req.url.startsWith('//') || /[\\#\s]/.test(req.url)) return {status:400};
 const own=`http://${host}`;
 const origin=req.headers.origin;
 if (origin!==undefined && !trustedOrigins.has(origin) && origin!==`http://127.0.0.1:${port}` && origin!==`http://localhost:${port}`) return {status:403};
 const site=req.headers['sec-fetch-site'];
 if (site!==undefined && !['none','same-origin','same-site','cross-site'].includes(site)) return {status:403};
 // Native clients omit browser metadata. Browser requests without Origin must
 // establish same-origin (or a direct navigation), not merely same-site.
 if (origin===undefined && site!==undefined && !['none','same-origin'].includes(site)) return {status:403};
 const pathname=new URL(req.url,own).pathname;
 if (req.method==='OPTIONS') {
  if (origin===undefined || !['/api','/analyze'].includes(pathname) || req.headers['access-control-request-method']!=='POST') return {status:403};
  const headers=req.headers['access-control-request-headers'];
  if (typeof headers!=='string') return {status:403};
  const requested=headers.split(',').map(value=>value.trim().toLowerCase());
  if (!requested.length || requested.some(value=>!['authorization','content-type'].includes(value)) || new Set(requested).size!==requested.length || !requested.includes('authorization')) return {status:403};
 }
 return {origin,pathname};
}
