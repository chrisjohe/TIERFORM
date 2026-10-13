import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn, execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'tierform-browser-mutations-'));
// Mutate editable sources and run the real build, including minification.
// Generated variable names and whitespace are not behavioral contracts.
const mutations=[
['src/io/csv.js','["Name","Grade","Group","Role"]','["Grade","Name","Group","Role"]','exports and clipboard','offline','CSV column values'],
['src/model/history.js','if(!historyState.session || historyState.session.key !== key){','if(true){','typing keep','offline','coalesced typing'],
['src/app/commands.js','Copied as PNG, 150 dpi — paste into your slide','MUTATED clipboard confirmation','exports and clipboard','hosted','clipboard completion'],
['src/app/events/navigation.js','if(e.key === "ArrowRight") to = (at + 1)','if(e.key === "ArrowRight") to = (at + 2)','keyboard, modal','offline','ribbon keyboard selection'],
['src/ui/add-dialog.js','modalOpen("#addModal", $("#addName"));','modalOpen("#addModal", $("#addGroup"));','keyboard, modal','offline','initial modal focus'],
['src/ui/modal.js','if("inert" in shell) shell.inert = true;','if("inert" in shell) shell.inert = false;','keyboard, modal','offline','modal background inertness'],
['src/ui/modal.js','e.preventDefault(); first.focus();','e.preventDefault(); last.focus();','keyboard, modal','offline','forward Tab wrapping'],
['src/ui/modal.js','e.preventDefault(); last.focus();','e.preventDefault(); first.focus();','keyboard, modal','offline','reverse Tab wrapping'],
['src/app/events/keyboard.js','if(e.key==="Escape" && !$("#addModal").hidden){ closeAddModal();','if(e.key==="Escape" && !$("#addModal").hidden){ void 0;','keyboard, modal','offline','Escape closes modal'],
['src/ui/modal.js','modalState.modalReturn.focus();','void 0;','keyboard, modal','offline','return focus after closing'],
['src/ui/ribbon.js','document.body.classList.toggle("roster-hidden");','void 0;','narrow roster','offline','responsive roster visibility'],
['src/ui/ribbon.js','function toggleRoster(){','function toggleRoster(){ document.querySelector("#title").value="Changed"; document.querySelector("#title").dispatchEvent(new Event("input"));','narrow roster','offline','roster toggle does not edit'],
['src/ui/ribbon.js','showing ? "Hide the roster panel" : "Show the roster panel"','showing ? "Show the roster panel" : "Hide the roster panel"','narrow roster','offline','roster tooltip state'],
['src/ui/tour.js','documentState.state          = documentState.tourSaved.state;','void 0;','tour cancellation','offline','tour restores roster'],
['src/ui/tour.js','restoreHistory(documentState.tourSaved);','void 0;','tour cancellation','offline','tour restores undo history'],
['src/ui/tour.js','documentState.dirtyDoc       = documentState.tourSaved.dirtyDoc;','documentState.dirtyDoc = false;','tour cancellation','offline','tour restores dirty status'],
['src/app/document.js','documentState.dirtyDoc = false;\n  updateDocLabel();','documentState.dirtyDoc = true;\n  updateDocLabel();','exports and clipboard','offline','save shows saved icon'],
['src/styles/ribbon.css','.rb-doc.dirty #docIconSaved{display:none}','.rb-doc.dirty #docIconSaved{display:block}','typing keep','offline','dirty status hides saved icon']
];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2'};
const server=http.createServer(async(request,response)=>{
  try{
    const url=new URL(request.url,'http://localhost');
    const site=path.join(scratch,'_site');
    const filename=path.resolve(site,decodeURIComponent(url.pathname.replace(/^\/TIERFORM\//,''))||'index.html');
    if(!filename.startsWith(site+path.sep)){response.writeHead(403).end();return;}
    const bytes=await fs.readFile(filename);
    response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'}).end(bytes);
  }catch{response.writeHead(404).end();}
});
try{
  for(const name of ['src','scripts','fonts'])await fs.cp(path.join(root,name),path.join(scratch,name),{recursive:true});
  await fs.symlink(path.join(root,'node_modules'),path.join(scratch,'node_modules'),'dir');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const hostedURL=`http://127.0.0.1:${server.address().port}/TIERFORM/`;
  for(const [file,from,to,name,distribution,label] of mutations){
    const filename=path.join(scratch,file),original=await fs.readFile(filename,'utf8');
    const modified=original.replace(from,to);if(modified===original)throw new Error('Mutation did not apply: '+label);
    try{
      await fs.writeFile(filename,modified);
      execFileSync(process.execPath,['scripts/build.mjs'],{cwd:scratch,stdio:'pipe'});
      const config=`const {defineConfig}=require(${JSON.stringify(require.resolve('@playwright/test'))});module.exports=defineConfig({testDir:${JSON.stringify(path.join(root,'test/browser'))},outputDir:${JSON.stringify(path.join(scratch,'results'))},timeout:20000,expect:{timeout:1500},workers:1,reporter:'line',projects:[{name:'mutation',use:{browserName:'chromium',viewport:{width:1440,height:1000}},metadata:{distribution:${JSON.stringify(distribution)}}}]});`;
      const configPath=path.join(scratch,'playwright.config.cjs');await fs.writeFile(configPath,config);
      const result=await new Promise(resolve=>{
        const child=spawn(process.execPath,[path.join(root,'node_modules/@playwright/test/cli.js'),'test','--config',configPath,'--grep',name],{cwd:root,env:{...process.env,TIERFORM_APP:path.join(scratch,'tierform_app.html'),TIERFORM_HOSTED_URL:hostedURL}});
        let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);child.on('close',status=>resolve({status,output}));
      });
      if(result.status===0||!result.output.includes('1 failed')||!result.output.includes('expect(')||!result.output.includes('Expected')||/TypeError|ReferenceError|SyntaxError|no console, CSP or page errors/.test(result.output)){
        process.stdout.write(result.output);throw new Error('Browser mutation did not fail a value assertion: '+name);
      }
      console.log('RED: '+label+' — browser value assertion failed');
    }finally{await fs.writeFile(filename,original);}
  }
  console.log(mutations.length+'/'+mutations.length+' browser wiring mutations caught; repository and hosted build untouched');
}finally{
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  await fs.rm(scratch,{recursive:true,force:true});
}
