import http from 'node:http';
const server=http.createServer((req,res)=>{
 if(req.url==='/bodyless-complete'||req.url==='/bodyless-large'){const body=req.url==='/bodyless-large'?'x'.repeat(262145):'extra';req.socket.end('HTTP/1.1 205 Reset Content\r\nContent-Length: '+body.length+'\r\nConnection: close\r\n\r\n'+body);return;}
 if(req.url==='/bodyless-open'){
  req.socket.write('HTTP/1.1 205 Reset Content\r\nContent-Length: 5\r\nConnection: keep-alive\r\n\r\n');return;
 }
 if(req.url==='/unfinished'){
  res.writeHead(200,{'Content-Type':'text/plain','Content-Length':'20'});res.write('synthetic');return;
 }
 if(req.url.startsWith('/bytes/')){res.end('x'.repeat(Number(req.url.slice(7))));return;}
 res.statusCode=Number(req.url.slice(1));res.setHeader('Content-Type','text/plain');
 res.end(res.statusCode===200?'synthetic':'');
});
server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
process.on('disconnect',()=>{server.closeAllConnections();server.close(()=>process.exit(0));});
setTimeout(()=>process.exit(2),45000).unref();
