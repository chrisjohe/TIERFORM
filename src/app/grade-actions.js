import { documentState } from "../model/document.js";
import { normalizeGradeLinks } from "../model/entities.js";
import { commit } from "../model/history.js";

function move(arr, idx, dir){
  const j = idx+dir;
  if(j<0 || j>=arr.length) return;
  const [it] = arr.splice(idx,1);
  arr.splice(j,0,it);
}

function reorderGrade(sourceId, targetId, after){
  const from = documentState.state.tiers.findIndex(t => t.id === sourceId);
  if(from < 0 || sourceId === targetId) return false;
  const target = documentState.state.tiers.findIndex(t => t.id === targetId);
  if(target < 0) return false;

  const without = documentState.state.tiers.filter(t => t.id !== sourceId);
  const anchor = without.findIndex(t => t.id === targetId);
  const insertAt = anchor + (after ? 1 : 0);
  if(insertAt === from) return false;

  const name = documentState.state.tiers[from].label || documentState.state.tiers[from].code || "grade";
  commit("moved grade " + name, ()=>{
    const moved = documentState.state.tiers.splice(from, 1)[0];
    const liveAnchor = documentState.state.tiers.findIndex(t => t.id === targetId);
    documentState.state.tiers.splice(liveAnchor + (after ? 1 : 0), 0, moved);
    normalizeGradeLinks(documentState.state.tiers);
  });
  return true;
}

export { move, reorderGrade };
