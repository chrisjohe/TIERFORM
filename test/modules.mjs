import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse} from 'acorn';
import {analyze} from 'eslint-scope';
import {createLayoutEngine} from '../src/engine/index.js';
import {defaults} from '../src/model/defaults.js';
import {documentState, connectDocument, newGeneration, staleWrite} from '../src/model/document.js';
import {clearHistory, commit, edit, endEdit, undo, redo, canUndo, canRedo, connectHistory, historyCheckpoint, restoreHistory, photoStore, photoSweep} from '../src/model/history.js';
import {VERSION} from '../src/model/settings.js';
import {parseAndValidateRoster} from '../src/io/roster.js';
import {toCSV} from '../src/io/csv.js';
import {toSVG} from '../src/render/svg.js';

let passed=0;
const test=(name,run)=>{if(process.env.TIERFORM_TEST_FILTER&&name!==process.env.TIERFORM_TEST_FILTER)return;try{run();passed++;}catch(error){throw new Error(name+': '+error.message,{cause:error});}};
const measure=factor=>({font:'',measureText(text){return {width:String(text).length*factor};}});
const roster=()=>({...defaults(),title:'A long title for measurement',tiers:[{id:'t',code:'A',label:'Lead',fill:'green',align:'center',merge:false,attach:false}],people:[{id:'p',name:'Jane Example',tierId:'t',groupId:null,role:'',photo:null,pw:0,ph:0,frame:null}]});
const engine=createLayoutEngine(measure(5));
test('release identity',()=>assert.equal(VERSION,'2026.10a'));
test('measurement belongs to each engine instance',()=>{
  const narrow=createLayoutEngine(measure(2));const wide=createLayoutEngine(measure(20));const st=roster();
  const before=narrow.computeLayout(st);const other=wide.computeLayout(st);const after=narrow.computeLayout(st);
  assert.deepEqual([after,other.natW>before.natW],[before,true]);
});
test('engine uses its argument rather than the editor document',()=>{
  documentState.state={...defaults(),tiers:[{id:'t',label:'WRONG DOCUMENT'}]};
  const st=roster(),before=structuredClone(st),L=engine.computeLayout(st);
  assert.deepEqual([st,L.avatars[0].r,L.texts.some(t=>t.segs.some(s=>s.t==='Lead')),L.texts.some(t=>t.segs.some(s=>String(s.t).includes('WRONG DOCUMENT')))],[before,34,true,false]);
});
const events=[];
connectDocument(()=>events.push('dirty'));
connectHistory({changed:()=>events.push('history'),render:scope=>events.push(scope),message:message=>events.push(message)});
function reset(){endEdit();clearHistory();documentState.state=roster();documentState.docName='';documentState.dirtyDoc=false;documentState.tourSaved=null;events.length=0;photoSweep();}
test('model mutations notify and undo without DOM dependencies',()=>{
  reset();commit('title',()=>{documentState.state.title='Changed';},{render:'chart'});
  const changed=[documentState.state.title,documentState.dirtyDoc,canUndo(),canRedo(),events.slice()];undo();const reverted=documentState.state.title;redo();
  assert.deepEqual([changed,reverted,documentState.state.title],[['Changed',true,true,false,['history','dirty','chart','history']],'A long title for measurement','Changed']);
});
test('a continuous edit remains one undo step and ends once',()=>{
  reset();let ended=0;const opts={onEnd:()=>ended++};
  edit('title','typing',()=>{documentState.state.title='J';},opts);edit('title','typing',()=>{documentState.state.title='Jane';},opts);endEdit();endEdit();undo();
  assert.deepEqual([documentState.state.title,ended,canUndo(),canRedo()],['A long title for measurement',1,false,true]);
});
test('empty groups are pruned before notifications',()=>{
  reset();documentState.state.groups=[{id:'unused',label:'Unused'}];commit('prune',()=>{});
  assert.deepEqual(documentState.state.groups,[]);
});
test('suspended history retains photos and restores its checkpoint',()=>{
  reset();const photo='data:image/png;base64,AAAA';documentState.state.people[0].photo=photo;
  commit('title',()=>{documentState.state.title='Saved live';});
  const saved={state:documentState.state,...historyCheckpoint()};documentState.tourSaved=saved;
  documentState.state=roster();clearHistory();commit('demo',()=>{documentState.state.title='Demo';});
  const retained=[...photoStore.values()].includes(photo);documentState.state=saved.state;restoreHistory(saved);documentState.tourSaved=null;undo();
  assert.deepEqual([retained,documentState.state.people[0].photo,documentState.state.title],[true,photo,'A long title for measurement']);
});
test('new generation and undo reject stale asynchronous writes',()=>{
  reset();const gen=documentState.docGen,p=documentState.state.people[0];commit('edit',()=>{p.name='Edited';});undo();const orphan=staleWrite(gen,{person:p});newGeneration();
  assert.deepEqual([orphan,staleWrite(gen)],['that person is no longer in the roster','the document changed while it was loading']);
});
test('bounded history sweeps unreachable photos',()=>{
  reset();documentState.state.people[0].photo='data:image/png;base64,AAAA';commit('remove photo',()=>{documentState.state.people[0].photo=null;});
  for(let i=0;i<20;i++)commit('title',()=>{documentState.state.title=String(i);});
  assert.deepEqual([historyCheckpoint().history.length,photoStore.size],[15,0]);
});
test('actual CSV module preserves quoting and column order',()=>{
  const st=roster();st.people[0].name='Jane; "J"';
  assert.equal(toCSV(st),'Name;Grade;Group;Role\r\n"Jane; ""J""";A;;');
});
test('actual parser and renderer reject markup injection',()=>{
  const verdict=parseAndValidateRoster(JSON.stringify(roster()));const st=verdict.state;st.people[0].name='<script>alert(1)</script>';
  const svg=toSVG(engine.computeLayout(st));
  assert.deepEqual([verdict.ok,svg.includes('<script>'),svg.includes('&lt;script&gt;')],[true,false,true]);
});
const modules=(await fs.readdir('src',{recursive:true})).filter(f=>f.endsWith('.js'));
const violations=[];
const browserGlobals=new Set('Array Blob Boolean ClipboardItem Error Event FileReader Image Infinity Int8Array JSON Map Math Number Object Promise Set String TextEncoder TypeError URL Uint8Array addEventListener clearTimeout document innerHeight innerWidth matchMedia navigator parseInt setTimeout undefined window'.split(' '));
const unresolved=[];
for(const file of modules){
  const source=await fs.readFile(path.join('src',file),'utf8');const ast=parse(source,{ecmaVersion:2024,sourceType:'module',ranges:true});
  const free=analyze(ast,{ecmaVersion:2024,sourceType:'module'}).globalScope.through.map(r=>r.identifier.name);
  for(const name of new Set(free))if(!browserGlobals.has(name))unresolved.push(file+': '+name);
  if(/^(engine|model)\//.test(file)){
    if(free.some(name=>['document','window','localStorage','sessionStorage','navigator'].includes(name)))violations.push(file+': browser dependency');
    for(const n of ast.body.filter(n=>n.type==='ImportDeclaration')){
      const destination=path.posix.normalize(path.posix.join(path.posix.dirname(file),n.source.value));
      if(/^(app|ui|io)\//.test(destination))violations.push(file+' -> '+destination);
    }
  }
  if(source.split('\n').length>600)violations.push(file+': oversized module');
}
test('every application reference is imported or a standard browser global',()=>assert.deepEqual(unresolved,[]));
test('domain and engine boundaries remain independent of UI and IO',()=>assert.deepEqual(violations,[]));
endEdit();
console.log(`all ${passed} direct module contract tests passed`);
