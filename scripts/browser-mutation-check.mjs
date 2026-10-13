import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'tierform-browser-mutations-'));
const original=await fs.readFile(path.join(root,'tierform_app.html'),'utf8');
let html=original;
const server=http.createServer((_,response)=>response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const hostedURL=`http://127.0.0.1:${server.address().port}/TIERFORM/`;
const mutations=[
['["Name", "Grade", "Group", "Role"]','["Grade", "Name", "Group", "Role"]','exports and clipboard','offline','CSV column values'],
['if (!historyState.session || historyState.session.key !== key) {','if (true) {','typing keep','offline','coalesced typing'],
['Copied as PNG, 150 dpi — paste into your slide','MUTATED clipboard confirmation','exports and clipboard','hosted','clipboard completion'],
['if (e.key === "ArrowRight") to = (at + 1)','if (e.key === "ArrowRight") to = (at + 2)','keyboard, modal','offline','ribbon keyboard selection'],
['modalOpen("#addModal", $("#addName"));','modalOpen("#addModal", $("#addGroup"));','keyboard, modal','offline','initial modal focus'],
['if ("inert" in shell) shell.inert = true;','if ("inert" in shell) shell.inert = false;','keyboard, modal','offline','modal background inertness'],
['        first.focus();\n      }\n    });\n  }','        last.focus();\n      }\n    });\n  }','keyboard, modal','offline','forward Tab wrapping'],
['        last.focus();\n      } else if','        first.focus();\n      } else if','keyboard, modal','offline','reverse Tab wrapping'],
['if (e.key === "Escape" && !$("#addModal").hidden) {\n        closeAddModal();','if (e.key === "Escape" && !$("#addModal").hidden) {\n        void 0;','keyboard, modal','offline','Escape closes modal'],
['modalState.modalReturn.focus();','void 0;','keyboard, modal','offline','return focus after closing'],
['document.body.classList.toggle("roster-hidden");','void 0;','narrow roster','offline','responsive roster visibility'],
['function toggleRoster() {','function toggleRoster() { commit("mutated toggle",()=>{documentState.state.title="Changed";});','narrow roster','offline','roster toggle does not edit'],
['showing ? "Hide the roster panel" : "Show the roster panel"','showing ? "Show the roster panel" : "Hide the roster panel"','narrow roster','offline','roster tooltip state'],
['documentState.state = documentState.tourSaved.state;','void 0;','tour cancellation','offline','tour restores roster'],
['restoreHistory(documentState.tourSaved);','void 0;','tour cancellation','offline','tour restores undo history'],
['documentState.dirtyDoc = documentState.tourSaved.dirtyDoc;','documentState.dirtyDoc = false;','tour cancellation','offline','tour restores dirty status'],
['documentState.docName = stem;\n    documentState.dirtyDoc = false;','documentState.docName = stem;\n    documentState.dirtyDoc = true;','exports and clipboard','offline','save shows saved icon'],
['.rb-doc.dirty #docIconSaved{display:none}','.rb-doc.dirty #docIconSaved{display:block}','typing keep','offline','dirty status hides saved icon']
];
try{
  for(const [from,to,name,distribution,label] of mutations){
    html=original.replace(from,to);if(html===original)throw new Error('Mutation did not apply: '+label);
    await fs.writeFile(path.join(scratch,'mutant.html'),html);
    const config=`const {defineConfig}=require(${JSON.stringify(require.resolve('@playwright/test'))});module.exports=defineConfig({testDir:${JSON.stringify(path.join(root,'test/browser'))},outputDir:${JSON.stringify(path.join(scratch,'results'))},timeout:20000,expect:{timeout:1500},workers:1,reporter:'line',projects:[{name:'mutation',use:{browserName:'chromium',viewport:{width:1440,height:1000}},metadata:{distribution:${JSON.stringify(distribution)}}}]});`;
    const configPath=path.join(scratch,'playwright.config.cjs');await fs.writeFile(configPath,config);
    const result=await new Promise(resolve=>{
      const child=spawn(process.execPath,[path.join(root,'node_modules/@playwright/test/cli.js'),'test','--config',configPath,'--grep',name],{cwd:root,env:{...process.env,TIERFORM_APP:path.join(scratch,'mutant.html'),TIERFORM_HOSTED_URL:hostedURL}});
      let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);child.on('close',status=>resolve({status,output}));
    });
    if(result.status===0||!result.output.includes('1 failed')||!result.output.includes('expect(')||!result.output.includes('Expected')||/TypeError|ReferenceError|SyntaxError|no console, CSP or page errors/.test(result.output)){
      process.stdout.write(result.output);throw new Error('Browser mutation did not fail a value assertion: '+name);
    }
    console.log('RED: '+label+' — browser value assertion failed');
  }
  console.log(mutations.length+'/'+mutations.length+' browser wiring mutations caught; repository and hosted build untouched');
}finally{await new Promise(resolve=>server.close(resolve));await fs.rm(scratch,{recursive:true,force:true});}
