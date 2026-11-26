import http from 'node:http';
let requests=0,bytes=0,wireBytes=0;
const server=http.createServer((req,res)=>{requests++;req.on('data',b=>bytes+=b.length);req.on('end',()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({requests,bytes}));});});
server.on('connection',socket=>socket.on('data',b=>wireBytes+=b.length));
server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
process.on('message',m=>{if(m==='counts')process.send({requests,bytes,wireBytes});if(m==='stop'){server.close(()=>process.exit(0));server.closeAllConnections();}});
process.on('disconnect',()=>server.close(()=>process.exit(0)));
setTimeout(()=>process.exit(2),20000).unref();
