import { documentState } from "../model/document.js";
import { commit } from "../model/history.js";
import { gradeName } from "../model/labels.js";
import { alertMsg, toast } from "../ui/notifications.js";
import { firstName } from "../ui/person-row.js";

function moveTarget(id, dir){
  const p = documentState.state.people.find(x => x.id === id);
  if(!p) return null;
  const mates = documentState.state.people.filter(x => x.tierId === p.tierId);
  const at = mates.indexOf(p);
  if(at < 0) return null;
  if(at + dir >= 0 && at + dir < mates.length) return {kind:"within"};
  const ti = documentState.state.tiers.findIndex(t => t.id === p.tierId);
  if(ti < 0) return null;
  const next = documentState.state.tiers[ti + dir];
  return next ? {kind:"grade", tier:next} : null;
}

function moveLabelTo(id, destTier){
  const p = documentState.state.people.find(x => x.id === id);
  const first = firstName(p, "the person");
  return p && destTier && destTier.id !== p.tierId
    ? "moved " + first + " to " + gradeName(destTier)
    : "moved " + first;
}

function moveLabel(id, dir){
  const want = moveTarget(id, dir);
  return moveLabelTo(id, want && want.kind === "grade" ? want.tier : null);
}

function movePerson(id, dir){
  const want = moveTarget(id, dir);
  if(!want) return;
  const p = documentState.state.people.find(x=>x.id===id);
  if(want.kind === "within"){
    const idxs = documentState.state.people.map((x,i)=>x.tierId===p.tierId?i:-1).filter(i=>i>=0);
    const at = idxs.indexOf(documentState.state.people.indexOf(p));
    const to = at+dir;
    if(to<0 || to>=idxs.length) return;
    const a = idxs[at], b = idxs[to];
    const tmp = documentState.state.people[a]; documentState.state.people[a]=documentState.state.people[b]; documentState.state.people[b]=tmp;
    return;
  }
  const dest = want.tier;
  const from = documentState.state.people.indexOf(p);

  const members = documentState.state.people.map((x,i)=>x.tierId===dest.id?i:-1).filter(i=>i>=0);
  p.tierId = dest.id;
  if(!members.length) return;
  const anchor = dir > 0 ? members[0] : members[members.length-1];
  documentState.state.people.splice(from, 1);
  const live = anchor - (from < anchor ? 1 : 0);
  documentState.state.people.splice(dir > 0 ? live : live + 1, 0, p);
}

function personSlot(p, t, after){
  const mates  = documentState.state.people.filter(x => x.tierId === t.tierId);
  const others = mates.filter(x => x !== p);
  return {mates, want: others.indexOf(t) + (after ? 1 : 0)};
}

function personDropIsNoop(p, t, after){
  if(p.tierId !== t.tierId) return false;
  const {mates, want} = personSlot(p, t, after);
  const now  = mates.map(x => x.id);
  const then = mates.filter(x => x !== p).map(x => x.id);
  then.splice(want, 0, p.id);
  return now.join("\u0000") === then.join("\u0000");
}

function reorderPerson(sourceId, targetId, after){
  const p = documentState.state.people.find(x => x.id === sourceId);
  const t = documentState.state.people.find(x => x.id === targetId);
  if(!p || !t || p === t) return false;
  const dest = documentState.state.tiers.find(x => x.id === t.tierId);
  if(!dest) return false;
  if(personDropIsNoop(p, t, after)) return false;

  const label = moveLabelTo(sourceId, dest);

  let fuel = documentState.state.people.length + documentState.state.tiers.length + 2;
  const restore = {order: documentState.state.people.slice(), tierId: p.tierId};
  let stalled = false;

  commit(label, ()=>{

    while(p.tierId !== dest.id){
      const from = documentState.state.tiers.findIndex(x => x.id === p.tierId);
      const to   = documentState.state.tiers.findIndex(x => x.id === dest.id);
      if(from < 0 || to < 0){ stalled = true; break; }
      if(!walkOnce(p, to > from ? 1 : -1) || --fuel < 0){ stalled = true; break; }
    }

    while(!stalled){
      const {mates, want} = personSlot(p, t, after);
      const at = mates.indexOf(p);
      if(at < 0 || at === want) break;
      if(!walkOnce(p, want > at ? 1 : -1) || --fuel < 0){ stalled = true; break; }
    }

    if(stalled){
      documentState.state.people = restore.order;
      p.tierId = restore.tierId;
    }
  });
  if(stalled) alertMsg("That move could not be completed — the roster is unchanged");
  return !stalled;
}

function walkOnce(p, dir){
  const wasAt = documentState.state.people.indexOf(p), wasIn = p.tierId;
  movePerson(p.id, dir);
  return documentState.state.people.indexOf(p) !== wasAt || p.tierId !== wasIn;
}

function removePerson(id){
  const p = documentState.state.people.find(x=>x.id===id);
  const first = firstName(p, null);
  commit("removed "+(first || "the person"),
    ()=>{ documentState.state.people = documentState.state.people.filter(x=>x.id!==id); });
  toast((first || "Person")+" removed");
}

export { moveTarget, moveLabelTo, moveLabel, movePerson, personSlot, personDropIsNoop, reorderPerson, walkOnce, removePerson };
