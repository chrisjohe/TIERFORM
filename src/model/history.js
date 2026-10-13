import { documentState, markDirty } from "./document.js";
import { pruneGroups } from "./entities.js";

const historyEvents = {changed(){}, render(){}, message(){}};
function connectHistory(events){ Object.assign(historyEvents, events); }

const historyState = {
  history: [],
  hIndex: -1,
  historyPending: false,
  photoSeq: 0,
  session: null
};

const HISTORY_MAX = 15;

const photoStore = new Map();

const photoIds   = new Map();

function photoPut(src){
  if(!src) return null;
  let id = photoIds.get(src);
  if(!id){
    id = "ph" + (++historyState.photoSeq);
    photoIds.set(src, id);
    photoStore.set(id, src);
  }
  return id;
}

function photoGet(id){ return (id && photoStore.get(id)) || null; }

function photoSweep(){
  const live = new Set();
  const reachable = documentState.tourSaved ? historyState.history.concat(documentState.tourSaved.history) : historyState.history;
  for(const h of reachable){
    for(const p of h.state.people) if(p.photoId) live.add(p.photoId);
  }
  for(const [id, src] of photoStore){
    if(!live.has(id)){ photoStore.delete(id); photoIds.delete(src); }
  }
}

function packState(s){
  const copy = JSON.parse(JSON.stringify(Object.assign({}, s, {
    people: s.people.map(p => Object.assign({}, p, {photo: null}))
  })));
  copy.people.forEach((p, i) => { p.photoId = photoPut(s.people[i].photo); });
  return copy;
}

function unpackState(h){
  const copy = JSON.parse(JSON.stringify(h));
  copy.people.forEach(p => {
    p.photo = photoGet(p.photoId);
    delete p.photoId;
  });
  return copy;
}

function snapshot(label){
  historyState.history = historyState.history.slice(0, historyState.hIndex+1);
  if(historyState.hIndex < 0 || historyState.historyPending){

    historyState.history.push({state:packState(documentState.state), label:null});
    historyState.hIndex = historyState.history.length-1;
    if(historyState.history.length > HISTORY_MAX){ historyState.history.shift(); historyState.hIndex--; }
  }
  historyState.history[historyState.hIndex].label = label;
  historyState.historyPending = true;
  photoSweep();
  historyEvents.changed();
}

function historyCheckpoint(){
  return {history: historyState.history, hIndex: historyState.hIndex, historyPending: historyState.historyPending};
}

function restoreHistory(checkpoint){
  historyState.history = checkpoint.history;
  historyState.hIndex = checkpoint.hIndex;
  historyState.historyPending = checkpoint.historyPending;
}

function clearHistory(){ restoreHistory({history: [], hIndex: -1, historyPending: false}); }

function canUndo(){ return historyState.historyPending ? historyState.hIndex>=0 : historyState.hIndex>0; }

function canRedo(){ return !historyState.historyPending && historyState.hIndex+1 < historyState.history.length; }

function undo(){
  endEdit();
  if(!canUndo()) return;
  if(historyState.historyPending){

    historyState.history.push({state:packState(documentState.state), label:historyState.history[historyState.hIndex].label});
    historyState.historyPending = false;
  }else{
    historyState.hIndex--;
  }
  const entry = historyState.history[historyState.hIndex];
  documentState.state = unpackState(entry.state);
  historyEvents.render("all"); markDirty();
  historyEvents.message("Undid: "+entry.label);
}

function redo(){
  endEdit();
  if(!canRedo()) return;
  const label = historyState.history[historyState.hIndex].label;
  historyState.hIndex++;
  documentState.state = unpackState(historyState.history[historyState.hIndex].state);
  historyEvents.render("all"); markDirty();
  historyEvents.message("Redid: "+label);
}

function commit(label, mutate, opts){
  endEdit();
  snapshot(label);
  mutate();
  pruneGroups(documentState.state);
  markDirty();
  historyEvents.render((opts && opts.render) || "roster");
  historyEvents.changed();
}

const SESSION_IDLE = 900;

function endEdit(){
  if(!historyState.session) return;
  clearTimeout(historyState.session.timer);
  const after = historyState.session.onEnd;
  historyState.session = null;
  if(after) after();
}

function edit(key, label, mutate, opts){
  if(!historyState.session || historyState.session.key !== key){
    endEdit();
    snapshot(label);

    historyState.session = {key: key, timer: null, onEnd: opts && opts.onEnd};
  }
  clearTimeout(historyState.session.timer);
  historyState.session.timer = setTimeout(endEdit, SESSION_IDLE);
  mutate();
  pruneGroups(documentState.state);
  markDirty();
  historyEvents.render((opts && opts.render) || "chart");
  historyEvents.changed();
}

export { historyCheckpoint, restoreHistory, clearHistory, connectHistory, HISTORY_MAX, photoStore, photoIds, photoPut, photoGet, photoSweep, packState, unpackState, snapshot, canUndo, canRedo, undo, redo, commit, SESSION_IDLE, endEdit, edit };
