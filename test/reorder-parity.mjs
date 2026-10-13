import assert from 'node:assert/strict';
import {planPersonOrder} from '../src/model/person-order.js';
import {originalPersonOrder} from './reference/person-order.mjs';

let checked = 0;
function compare(state, source, target, after){
  const old = structuredClone(state), next = structuredClone(state);
  const before = JSON.stringify(next), people = next.people.slice();
  const p = next.people[source], t = next.people[target];
  originalPersonOrder(old, p.id, t.id, after);
  const order = planPersonOrder(next.people, next.tiers, p, t, after);
  assert.equal(JSON.stringify(next), before, 'planning must not mutate people or their order');
  if(order){
    assert(order.every(person => people.includes(person)), 'retain object identities');
    next.people = order;
    p.tierId = t.tierId;
  }
  assert.deepEqual(next, old, `full document order: ${JSON.stringify(state)} / ${source},${target},${after}`);
  checked++;
}

function roster(assignment, grades){
  return {
    tiers:Array.from({length:grades}, (_,i)=>({id:'t'+i, label:'Grade '+i})),
    people:assignment.map((grade,i)=>({id:'p'+i, name:'Person '+i, tierId:'t'+grade, groupId:'g'+i%3}))
  };
}

// All grade assignments cover interleaving, empty intermediate grades, both
// directions and every destination slot without choosing a lucky roster order.
for(const [people, grades] of [[4,4], [5,3]]){
  for(let code=0; code<grades**people; code++){
    let digits=code;
    const assignment=Array.from({length:people}, ()=>{const grade=digits%grades;digits=Math.floor(digits/grades);return grade;});
    const state=roster(assignment, grades);
    for(let source=0;source<people;source++) for(let target=0;target<people;target++){
      if(source===target) continue;
      for(const after of [false,true]) compare(state,source,target,after);
    }
  }
}

let seed=20261013;
const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
for(let i=0;i<200;i++){
  const count=2+random(99), grades=1+random(60);
  const state=roster(Array.from({length:count},()=>random(grades)),grades);
  const source=random(count), target=(source+1+random(count-1))%count;
  compare(state,source,target,!!random(2));
}
for(const after of [false,true]){
  compare(roster(Array(2000).fill(0),1),0,1999,after);
  compare(roster(Array.from({length:2000},(_,i)=>i%60),60),0,1999,after);
}
const missing=roster([0,1],2);
missing.people[0].tierId='missing';
compare(missing,0,1,true);
console.log(`all ${checked} full-document reorder parity cases passed`);
