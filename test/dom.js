const fs = require('node:fs');
const path = require('node:path');
const nodeAssert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {parse} = require('acorn');
const {htmlTokens} = require('./html.cjs');
const {FONT,FONTS} = require('../src/model/settings.js');
const root = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const files = fs.readdirSync(path.join(root,'src'),{recursive:true}).filter(file=>file.endsWith('.js'));
const sources = files.map(file=>({file,source:read('src/'+file)}));
const script = sources.map(row=>row.source).join('\n');
const fragments = ['sprite','ribbon','menus','workspace','dialogs','info','tour'].map(name=>read('src/markup/'+name+'.html')).join('\n');
const markup = read('src/markup/index.html').replace('{{BODY}}',fragments).replace('{{STYLES}}','').replace('{{SCRIPT}}','');
const matches = (regex,text) => [...text.matchAll(regex)].map(match=>match[1]);
const unique = values => [...new Set(values)].sort();
const flat = text => htmlTokens(text).filter(token=>token.type==='text').map(token=>token.text).join(' ').replace(/\s+/g,' ').trim();
const paths = text => matches(/\bd="([^"]+)"/g,text);
const member = node => node.computed ? node.property?.value : node.property?.name;
let checks=0,contracts=0;
const assert = new Proxy(nodeAssert,{get(target,key){const fn=target[key];return typeof fn==='function'?(...args)=>{checks++;return fn(...args);}:fn;}});
function test(name,run){
  if(process.env.TIERFORM_TEST_FILTER && process.env.TIERFORM_TEST_FILTER!==name)return;
  try{run();contracts++;}catch(error){throw new Error(name+': '+error.message,{cause:error});}
}
function walk(node,visit){
  if(!node||typeof node!=='object')return;
  if(node.type)visit(node);
  for(const value of Object.values(node)){
    if(Array.isArray(value))value.forEach(child=>walk(child,visit));
    else if(value&&typeof value==='object')walk(value,visit);
  }
}
const trees=sources.map(row=>({...row,ast:parse(row.source,{ecmaVersion:2024,sourceType:'module'})}));
const ids=matches(/\bid="([^"]+)"/g,markup);
const dynamicIds=matches(/attrs:\{[^}]*\bid:"([^"]+)"/g,script);
const referenced=unique(matches(/\$\("#([\w-]+)"\)/g,script));
test('markup IDs and ARIA references resolve',()=>{
  assert.equal(ids.length,new Set(ids).size,'markup IDs must be unique');
  assert.deepEqual(referenced.filter(id=>!ids.includes(id)&&!dynamicIds.includes(id)),[],'literal DOM selectors must resolve');
  const targets=matches(/\b(?:aria-controls|aria-labelledby|aria-describedby|for|list)="([^"]+)"/g,markup).flatMap(value=>value.split(/\s+/));
  assert.deepEqual(unique(targets.filter(id=>!ids.includes(id))),[],'accessible names and controls must resolve');
});
test('static markup is balanced and interactive controls are not nested',()=>{
  const stack=[],errors=[];
  const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for(const token of htmlTokens(markup)){
    const tag=token.tagName;
    if(token.type==='endTag'){const open=stack.pop();if(open!==tag)errors.push('closing '+tag+' after '+open);}
    else if(token.type==='startTag'&&!voids.has(tag)&&!token.selfClosing){
      if(['button','a'].includes(tag)&&stack.includes(tag))errors.push('nested '+tag);
      stack.push(tag);
    }
  }
  assert.deepEqual(errors.concat(stack.map(tag=>'unclosed '+tag)),[]);
});
test('command names match their static control references',()=>{
  let keys=[];
  for(const {ast} of trees)walk(ast,node=>{if(node.type==='VariableDeclarator'&&node.id.name==='COMMANDS')keys=node.init.properties.map(p=>p.key.name||p.key.value);});
  const emitted=unique(matches(/data-cmd="([A-Za-z]+)"/g,markup+'\n'+script));
  assert.ok(keys.length>0,'the command table must exist');
  assert.deepEqual(unique(keys),emitted);
});
const symbols=[...markup.matchAll(/<symbol\b([^>]*)\bid="(i-[\w-]+)"([^>]*)>([\s\S]*?)<\/symbol>/g)].map(m=>({id:m[2],attrs:m[1]+m[3],body:m[4]}));
const iconUses=unique(matches(/<use\s+href="#(i-[\w-]+)"/g,markup).concat(matches(/\bicon\("#(i-[\w-]+)"\)/g,script)));
const spriteFiles=fs.readdirSync(path.join(root,'sprites')).filter(file=>file.endsWith('.svg'));
const spriteSources=spriteFiles.map(file=>({file,paths:paths(read('sprites/'+file))}));
const provenance=symbols.map(symbol=>({...symbol,sources:spriteSources.filter(source=>JSON.stringify(source.paths)===JSON.stringify(paths(symbol.body))).map(source=>source.file)}));
test('icons resolve to licensed source artwork and inherit colour',()=>{
  assert.ok(symbols.length>0,'the sprite must contain icons');
  assert.deepEqual(unique(symbols.map(symbol=>symbol.id)),iconUses,'no missing or unused sprite symbols');
  const dynamic=[];
  for(const {file,ast} of trees)walk(ast,node=>{if(node.type==='CallExpression'&&node.callee.name==='icon'&&!(node.arguments[0]?.type==='Literal'&&/^#i-[\w-]+$/.test(node.arguments[0].value)))dynamic.push(file);});
  assert.deepEqual(dynamic,[],'icon references must be statically resolvable');
  assert.deepEqual(provenance.filter(symbol=>!symbol.sources.length).map(symbol=>symbol.id),[],'every path matches source artwork');
  assert.deepEqual(symbols.filter(symbol=>/\bfill=/.test(symbol.attrs+symbol.body)).map(symbol=>symbol.id),[],'sprite paths inherit currentColor');
  assert.deepEqual(provenance.filter(symbol=>!new RegExp(symbol.sources.some(file=>/_40dp_/.test(file))?'viewBox="0 -960 960 960"':'viewBox="0 0 \\d+ \\d+"').test(symbol.attrs)).map(symbol=>symbol.id),[],'source coordinate systems are retained');
});
const notice=read('NOTICE'),about=flat(read('src/markup/info.html'));
test('artwork attribution and trademarks travel with the app',()=>{
  const counts=/(\d+) of the (\d+) icons in the inline sprite are Material Symbols/.exec(notice);
  assert.deepEqual(counts&&counts.slice(1).map(Number),[provenance.filter(symbol=>symbol.sources.some(file=>/_40dp_/.test(file))).length,symbols.length]);
  const trademark='TIERFORM and the TIERFORM logo are trademarks of Christian J. Heinze. No trademark licence is granted under the Apache License; see Section 6.';
  assert.ok(about.includes(trademark)&&flat(notice).includes(trademark),'the explicit TIERFORM trademark notice remains');
  for(const text of ['the font may not be sold on its own','may not be shipped under the name “Open Sans”.','Google’s name and trademarks are not used to imply any affiliation with or endorsement of TIERFORM.','GitHub and the Invertocat are trademarks of GitHub, Inc.','no affiliation or endorsement is implied.'])assert.ok(about.includes(text),text);
  assert.ok(flat(notice).includes('DRIFTFORM and the DRIFTFORM logo are likewise trademarks of Christian J. Heinze;'));
  assert.ok(notice.includes('github-logo-policy')&&notice.includes('licenses/OpenSans-OFL-1.1.txt'));
  const github=/<svg class="about-github-icon"[\s\S]*?<\/svg>/.exec(markup)?.[0]||/<a class="about-github"[\s\S]*?<\/a>/.exec(markup)?.[0]||'';
  assert.deepEqual(paths(github),paths(read('sprites/github-logo.svg')),'the GitHub mark retains its full path');
  for(const flag of markup.matchAll(/<svg class="about-flag"[\s\S]*?<\/svg>/g))assert.deepEqual(paths(flag[0]),paths(read('sprites/eu-flag.svg')),'the EU flag retains its full path');
});
test('source licenses and in-app notices remain intact',()=>{
  for(const [file,hash] of [['LICENSE','cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'],['licenses/OpenSans-OFL-1.1.txt','6c632858146b13645c7730e2b98881f00f4e545949d2c0368a65b071ed8301da']])assert.equal(createHash('sha256').update(read(file)).digest('hex'),hash,file+' full license text');
  const header=read('src/markup/index.html');
  assert.ok(header.includes('Licensed under the Apache License, Version 2.0')&&header.includes('Open Sans — © 2020 The Open Sans Project Authors — SIL OFL 1.1'));
});
test('font choices and CSS use the renderer font stack',()=>{
  const cssFont=/--font:\s*([^;]+);/.exec(read('src/styles/base.css'))?.[1];
  assert.equal(cssFont?.replace(/\s*,\s*/g,','),FONT);
  const select=/<select[^>]*id="font"[\s\S]*?<\/select>/.exec(markup)?.[0]||'';
  assert.deepEqual(unique(matches(/value="([^"]+)"/g,select)),Object.keys(FONTS).sort());
  const face=/font-family:'([^']+)'/.exec(read('src/styles/fonts.css'))?.[1];
  assert.equal(face,FONT.split(',')[0].replace(/^'|'$/g,''),'the embedded face matches the primary renderer font');
});
test('application code has no network or persistent storage capabilities',()=>{
  const banned=new Set('fetch XMLHttpRequest WebSocket EventSource sendBeacon importScripts geolocation RTCPeerConnection localStorage sessionStorage indexedDB'.split(' '));
  const violations=[];
  for(const {file,ast} of trees)walk(ast,node=>{
    if(node.type==='ImportExpression')violations.push(file+': dynamic import');
    if(node.type==='Identifier'&&banned.has(node.name))violations.push(file+': '+node.name);
    if(node.type==='MemberExpression'&&(banned.has(member(node))||(node.object.name==='window'&&member(node)==='storage')||(node.object.name==='document'&&member(node)==='cookie')))violations.push(file+': '+member(node));
  });
  assert.deepEqual(violations,[]);
  assert.doesNotMatch(markup,/<(?:form|iframe|object|embed)\b|\b(?:src|action)="https?:/i);
});
test('HTML insertion accepts only the shared SVG renderer',()=>{
  const violations=[];
  for(const {file,ast} of trees)walk(ast,node=>{
    if(node.type==='MemberExpression'&&(['innerHTML','outerHTML','insertAdjacentHTML'].includes(member(node))||(node.object.name==='document'&&member(node)==='write'))){
      const allowed=file==='ui/chart.js'&&member(node)==='innerHTML';
      if(!allowed)violations.push(file+': '+member(node));
    }
    if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&member(node.left)==='innerHTML'&&!(node.right.type==='CallExpression'&&node.right.callee.name==='toSVG'))violations.push(file+': untrusted HTML');
  });
  assert.deepEqual(violations,[]);
});
test('external links open with isolation and explicit destinations',()=>{
  const links=[...markup.matchAll(/<a\b[^>]*href="https?:[^>]+>/g)].map(m=>m[0]);
  assert.ok(links.length>0);
  assert.deepEqual(links.filter(tag=>!tag.includes('target="_blank"')||!tag.includes('rel="noopener noreferrer"')),[]);
});
console.log(`all ${checks} markup/source integrity assertions passed (${contracts} contracts)`);
