import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {htmlTokens,inlineContents,comparableMarkup} from './html.cjs';

const read=name=>fs.readFile(name,'utf8');
const offline=await read('tierform_app.html');
const hosted=await read('_site/index.html');
const js=await read('_site/assets/app.js');
const css=await read('_site/assets/app.css');
const fontCSS=await read('_site/assets/fonts.css');
const font=await fs.readFile('_site/assets/OpenSans.woff2');
const offlineTokens=htmlTokens(offline);
const hostedTokens=htmlTokens(hosted);
let passed=0;
function test(name,run){if(process.env.TIERFORM_TEST_FILTER&&name!==process.env.TIERFORM_TEST_FILTER)return;try{run();passed++;}catch(error){throw new Error(name+': '+error.message,{cause:error});}}

test('offline script and styling match the hosted build',()=>{
  const scripts=inlineContents(offlineTokens,'script');
  const styles=inlineContents(offlineTokens,'style');
  assert.deepEqual([scripts,styles],[ [js.trim()], [css.trim(),fontCSS.replace('./OpenSans.woff2','data:font/woff2;base64,'+font.toString('base64')).trim()] ]);
});
test('hosted resources resolve under a GitHub project path',()=>{
  const assets=[...hosted.matchAll(/(?:src|href)="(\.\/assets\/[^"#]+)"/g)].map(m=>new URL(m[1],'https://example.github.io/TIERFORM/').pathname);
  assert.deepEqual(assets,['/TIERFORM/assets/app.css','/TIERFORM/assets/fonts.css','/TIERFORM/assets/app.js']);
});
test('hosted CSP permits initial same-origin assets and blocks data connections',()=>{
  const policy=hosted.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.equal(policy,"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data:; font-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'");
});
test('portable output has no external assets or hosted policy',()=>{
  const references=[...offline.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^\"]+)"/g)].map(m=>m[1]);
  assert.deepEqual([references.filter(v=>!v.startsWith('data:')),offline.includes('Content-Security-Policy')],[[],false]);
});
test('hosted and portable markup share one source',()=>{
  assert.deepEqual(comparableMarkup(hostedTokens),comparableMarkup(offlineTokens));
});
test('HTML inspection respects comments, quoted attributes and raw-text boundaries',()=>{
  const tokens=htmlTokens('<!-- <script>comment</script> --><SCRIPT data-note=">">const x="<b>";</SCRIPT >'
    +'<style data-note=">">b::before{content:"<script>"}</style\n><p title=">">A &amp; B</p>');
  assert.deepEqual(inlineContents(tokens,'script'),['const x="<b>";']);
  assert.deepEqual(inlineContents(tokens,'style'),['b::before{content:"<script>"}']);
  assert.deepEqual(tokens.filter(token=>token.type==='startTag').map(token=>token.tagName),['script','style','p']);
  assert.equal(tokens.find(token=>token.type==='text'&&token.text.includes('A')).text,'A & B');
});
test('markup comparison retains content exposed by unusual resource closing tags',()=>{
  const expected=comparableMarkup(htmlTokens('<p>same</p>'));
  for(const tag of ['script','style']){
    assert.deepEqual(comparableMarkup(htmlTokens('<'+tag+'>ignored</'+tag+' ><p>same</p>')),expected);
    const exposed=comparableMarkup(htmlTokens('<'+tag+'>ignored</'+tag+' ><p>changed</p></'+tag+'><p>same</p>'));
    assert.deepEqual(exposed.filter(token=>token.type==='text').map(token=>token.text),['changed','same']);
  }
});
const trackedFont=await fs.readFile('fonts/OpenSans-VariableFont_wdth,wght.woff2');
test('the bundled font is the licensed source asset',()=>assert.equal(Buffer.compare(font,trackedFont),0));
const download=await read('_site/tierform_app.html');
test('Pages distributes the same portable download',()=>assert.equal(download,offline));
const files=['tierform_app.html','_site/index.html','_site/assets/app.js','_site/assets/app.css','_site/assets/fonts.css','_site/assets/OpenSans.woff2'];
const hashes=async()=>Promise.all(files.map(async f=>createHash('sha256').update(await fs.readFile(f)).digest('hex')));
const before=await hashes();execFileSync(process.execPath,['scripts/build.mjs']);const after=await hashes();
test('building twice produces identical files',()=>assert.deepEqual(after,before));
console.log(`all ${passed} build artifact tests passed`);
