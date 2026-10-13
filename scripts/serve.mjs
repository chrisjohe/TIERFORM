import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('_site');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith('/TIERFORM/')){res.writeHead(404).end();return;}
    const filename=path.resolve(root,decodeURIComponent(url.pathname.slice('/TIERFORM/'.length))||'index.html');
    if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    const bytes=await fs.readFile(filename);res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end();}
}).listen(4173,'127.0.0.1',()=>console.log('TIERFORM at http://127.0.0.1:4173/TIERFORM/'));
