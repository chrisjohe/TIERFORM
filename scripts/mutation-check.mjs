import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const cases=[
['src/model/settings.js','"2026.10b"','"BROKEN"','release identity'],
['src/engine/index.js','const text = createTextMetrics(meas);','meas = {font:"",measureText(){return {width:1};}};\nconst text = createTextMetrics(meas);','measurement belongs to each engine instance'],
['src/model/labels.js','const t = (lookup ? lookup.tiers.get(p.tierId) : st.tiers.find(t => t.id === p.tierId)) || st.tiers[0];','const t = {label:"WRONG DOCUMENT"};','engine uses its argument rather than the editor document'],
['src/model/history.js','  mutate();\n  pruneGroups(documentState.state);\n  markDirty();','  mutate();\n  pruneGroups(documentState.state);','model mutations notify and undo without DOM dependencies'],
['src/model/history.js','if(!historyState.session || historyState.session.key !== key){','if(true){','a continuous edit remains one undo step and ends once'],
['src/model/history.js','  pruneGroups(documentState.state);','  void 0;','empty groups are pruned before notifications'],
['src/model/history.js','const reachable = documentState.tourSaved ? historyState.history.concat(documentState.tourSaved.history) : historyState.history;','const reachable = historyState.history;','suspended history retains photos and restores its checkpoint'],
['src/model/document.js','if(want && want.person && documentState.state.people.indexOf(want.person) === -1)','if(false && want && want.person && documentState.state.people.indexOf(want.person) === -1)','new generation and undo reject stale asynchronous writes'],
['src/model/history.js','const HISTORY_MAX = 15;','const HISTORY_MAX = 16;','bounded history sweeps unreachable photos'],
['src/io/csv.js','["Name","Grade","Group","Role"]','["Grade","Name","Group","Role"]','actual CSV module preserves quoting and column order'],
['src/render/xml.js','.replace(/</g, "&lt;")','.replace(/</g, "<")','actual parser and renderer reject markup injection'],
['src/app/events/photos.js','import { $ } from "../../ui/dom.js";\n','','every application reference is imported or a standard browser global'],
['src/model/defaults.js','function defaults(){','typeof document;\nfunction defaults(){','domain and engine boundaries remain independent of UI and IO'],
['_site/assets/app.js',null,null,'offline script and styling match the hosted build','artifacts'],
['_site/index.html','./assets/app.js','../assets/app.js','hosted resources resolve under a GitHub project path','artifacts'],
['_site/index.html',"connect-src 'none'","connect-src 'self'",'hosted CSP permits initial same-origin assets and blocks data connections','artifacts'],
['tierform_app.html','<meta charset="utf-8">','<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src *">','portable output has no external assets or hosted policy','artifacts'],
['_site/index.html','<title>TIERFORM</title>','<title>BROKEN</title>','hosted and portable markup share one source','artifacts'],
['test/html.cjs',"else if(token.type==='text'&&text!==null)text+=token.text;","else if(token.type==='text'&&text!==null)text+='BROKEN';",'HTML inspection respects comments, quoted attributes and raw-text boundaries','artifacts'],
['test/html.cjs',"token.type==='endTag'&&token.tagName===resource","false",'markup comparison retains content exposed by unusual resource closing tags','artifacts'],
['test/html.cjs',"if(text.trim())markup.push({type:'text',text});","if(text.trim()&&text!=='changed')markup.push({type:'text',text});",'markup comparison retains content exposed by unusual resource closing tags','artifacts'],
['_site/assets/OpenSans.woff2',null,null,'the bundled font is the licensed source asset','artifacts'],
['_site/tierform_app.html','<title>TIERFORM</title>','<title>BROKEN</title>','Pages distributes the same portable download','artifacts'],
['scripts/build.mjs','const js=result.outputFiles[0].text;','const js=result.outputFiles[0].text + "\\nvoid " + Math.random() + ";";','building twice produces identical files','artifacts']
];
const integrity=(file,from,to,name)=>cases.push([file,from,to,name,'dom']);
integrity('src/markup/workspace.html','id="roster"','id="sheet"','markup IDs and ARIA references resolve');
integrity('src/markup/workspace.html','id="sheet"','id="missingSheet"','markup IDs and ARIA references resolve');
integrity('src/markup/dialogs.html','aria-labelledby="addTitle"','aria-labelledby="absent"','markup IDs and ARIA references resolve');
integrity('src/markup/index.html','</html>','<b></html>','static markup is balanced and interactive controls are not nested');
integrity('src/markup/dialogs.html','<button id="addDoneBtn">Close</button>','<button id="addDoneBtn"><button>Close</button></button>','static markup is balanced and interactive controls are not nested');
integrity('src/app/commands.js','saveAs:','saveOther:','command names match their static control references');
for(const [from,to] of [['id="i-save"','id="i-missing"'],['<path d="','<path d="M1 1 '],['<symbol ','<symbol fill="red" '],['<path ','<path fill="red" '],['viewBox="0 -960 960 960"','viewBox="0 -960 961 960"']])integrity('src/markup/sprite.html',from,to,'icons resolve to licensed source artwork and inherit colour');
integrity('src/ui/framing.js','icon("#i-delete")','icon("#i-" + "delete")','icons resolve to licensed source artwork and inherit colour');
integrity('NOTICE','75 of the 77 icons','74 of the 77 icons','artwork attribution and trademarks travel with the app');
integrity('NOTICE','DRIFTFORM and the DRIFTFORM logo are likewise trademarks','DRIFTFORM and the DRIFTFORM logo are not trademarks','artwork attribution and trademarks travel with the app');
for(const text of ['No trademark licence is granted','the font may not be sold','may not be shipped under the name','Google’s name and trademarks','GitHub and the Invertocat are trademarks','no affiliation or endorsement is implied'])integrity('src/markup/info.html',text,'MUTATED NOTICE','artwork attribution and trademarks travel with the app');
for(const file of ['LICENSE','licenses/OpenSans-OFL-1.1.txt'])integrity(file,null,null,'source licenses and in-app notices remain intact');
integrity('src/markup/index.html','Licensed under the Apache License','MUTATED LICENSE','source licenses and in-app notices remain intact');
integrity('src/styles/base.css',"--font: 'Open Sans'","--font: 'Other'",'font choices and CSS use the renderer font stack');
integrity('src/styles/fonts.css',"font-family:'Open Sans'","font-family:'Other'",'font choices and CSS use the renderer font stack');
integrity('src/markup/ribbon.html','value="arial"','value="other"','font choices and CSS use the renderer font stack');
for(const expression of ['fetch','window["localStorage"]','window.storage','navigator["sendBeacon"]','document.cookie','import("./unknown.js")'])integrity('src/ui/chart.js','function drawChart(){','function drawChart(){ void '+expression+';','application code has no network or persistent storage capabilities');
integrity('src/markup/index.html','<body>','<body><form></form>','application code has no network or persistent storage capabilities');
integrity('src/ui/chart.js','.innerHTML = toSVG(L);','["innerHTML"] = "unsafe";','HTML insertion accepts only the shared SVG renderer');
integrity('src/ui/chart.js','function drawChart(){','function drawChart(){ document.write("unsafe");','HTML insertion accepts only the shared SVG renderer');
integrity('src/markup/info.html','rel="noopener noreferrer"','rel="opener"','external links open with isolation and explicit destinations');
const geometry=(from,to,assertion)=>cases.push(['src/model/framing.js',from,to,assertion,'harness']);
geometry('dh = H*k;','dh = H*k*1.1;','aspect preserved');
geometry('Math.max(-mx, Math.min(mx,','Math.max(-mx, Math.min(mx*2,','covers left');
geometry('Math.max(-mx, Math.min(mx,','Math.max(-mx*2, Math.min(mx,','covers right');
geometry('Math.max(-my, Math.min(my,','Math.max(-my, Math.min(my*2,','covers top');
geometry('Math.max(-my, Math.min(my,','Math.max(-my*2, Math.min(my,','covers bottom');
geometry('(+f.ox || 0) * r','-(+f.ox || 0) * r','pan direction x');
geometry('(+f.oy || 0) * r','-(+f.oy || 0) * r','pan direction y');
geometry('Math.max(1, Math.min(ZOOM_MAX, +f.zoom || 1))','Math.max(1, +f.zoom || 1)','zoom above ZOOM_MAX is clamped');
geometry('pw>0 ? pw : 1','pw>0 ? pw : NaN','malformed photo dimensions stay finite');
geometry('const f = frame || {};','const f = frame || {}; if(!frame) return {x:0,y:0,w:1,h:1};','garbage frame centres x');

const root=path.resolve(import.meta.dirname,'..');
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'tierform-contract-mutations-'));
for(const name of ['src','scripts','test','fonts','sprites','licenses','LICENSE','NOTICE','package.json','tierform_app.html','_site'])await fs.cp(path.join(root,name),path.join(scratch,name),{recursive:true});
await fs.symlink(path.join(root,'node_modules'),path.join(scratch,'node_modules'),'dir');
let killed=0;
try{
  for(const [file,from,to,name,suite='modules'] of cases){
    const filename=path.join(scratch,file);
    const original=await fs.readFile(filename);
    const modified=from===null?Buffer.concat([original,Buffer.from([0])]):Buffer.from(original.toString().replace(from,to));
    if(Buffer.compare(original,modified)===0)throw new Error('Mutation did not apply: '+name);
    try{
      await fs.writeFile(filename,modified);
      const result=spawnSync(process.execPath,['test/'+suite+(['dom','harness'].includes(suite)?'.js':'.mjs')],{cwd:scratch,encoding:'utf8',env:{...process.env,TIERFORM_TEST_FILTER:name}});
      const output=result.stdout+result.stderr;
      const assertionFailed=suite==='harness' ? /FAILURES/.test(output)&&output.includes(name)&&!/harness error/.test(output) : output.includes('Error: '+name+':')&&output.includes('AssertionError');
      if(result.status===0||!assertionFailed){
        process.stdout.write(output);throw new Error('Mutation did not produce its named assertion failure: '+name);
      }
      console.log('RED: '+name+' ['+file+']');killed++;
    }finally{await fs.writeFile(filename,original);}
  }
}finally{await fs.rm(scratch,{recursive:true,force:true});}
console.log(`${killed}/${cases.length} targeted contract mutations caught by assertion failures; repository untouched`);
