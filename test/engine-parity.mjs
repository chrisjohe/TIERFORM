import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createLayoutEngine} from '../src/engine/index.js';
import {toSVG} from '../src/render/svg.js';
import {cases,measurement,normalizedSvg,textModels,finiteGeometry} from './reference/engine-parity-cases.mjs';

const expected=JSON.parse(fs.readFileSync(new URL('./reference/engine-parity.json',import.meta.url),'utf8'));
const fixtureBytes=fs.readFileSync(new URL('./fixtures/current.json',import.meta.url)),fixture=JSON.parse(fixtureBytes);
assert.equal(createHash('sha256').update(fixtureBytes).digest('hex'),expected.baseline.fixtureSha256,'parity fixture differs from the frozen original');
const actual={};
for(const model of textModels){
  const engine=createLayoutEngine(measurement(model)),hashes=new Map();
  for(const input of cases(fixture)){
    const st=structuredClone(input),before=JSON.stringify(st),key=model+':'+st.layout;
    if(!hashes.has(key))hashes.set(key,{cases:0,input:createHash('sha256'),geometry:createHash('sha256'),svg:createHash('sha256')});
    const group=hashes.get(key),layout=engine.computeLayout(st),svg=normalizedSvg(toSVG(layout));
    assert(finiteGeometry(layout),key+' must have finite geometry');assert.equal(JSON.stringify(st),before,key+' must preserve input');group.cases++;
    group.input.update(before+'\n');group.geometry.update(JSON.stringify(layout)+'\n');group.svg.update(svg+'\n');
  }
  for(const [key,group]of hashes)actual[key]={cases:group.cases,input:group.input.digest('hex'),geometry:group.geometry.digest('hex'),svg:group.svg.digest('hex')};
}
assert.deepEqual(actual,expected.groups,'geometry or SVG changed from frozen TIERFORM 2026.8b');
console.log('all '+Object.values(actual).reduce((n,g)=>n+g.cases,0)+' frozen-baseline geometry/SVG/input parity cases passed');
