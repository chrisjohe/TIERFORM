import { move } from "./grade-actions.js";
import { documentState } from "../model/document.js";
import { commit } from "../model/history.js";
import { LIMITS } from "../model/settings.js";
import { clampText } from "../model/validation.js";
import { askText } from "../ui/ask-dialog.js";
import { syncGroupModal } from "../ui/group-dialog.js";

function moveGroup(id, dir){
  const idx = documentState.state.groups.findIndex(g => g.id === id);
  if(idx < 0) return false;
  const j = idx + dir;
  if(j < 0 || j >= documentState.state.groups.length) return false;
  const name = documentState.state.groups[idx].label || "group";
  commit("moved group " + name, ()=>{ move(documentState.state.groups, idx, dir); });
  return true;
}

async function renameGroup(id){
  const g = documentState.state.groups.find(x => x.id === id);
  if(!g) return false;
  const asked = await askText("Rename group",
    "Renaming changes the label everywhere it is shown; people keep pointing at the same group.",
    g.label, "Group name", "Rename");
  if(asked === null || asked === undefined) return false;
  const trimmed = clampText(asked, LIMITS.text).trim();
  if(!trimmed || trimmed === g.label) return false;
  const norm = trimmed.toLowerCase();
  const hit = documentState.state.groups.find(x => x.id !== id && typeof x.label === "string"
    && x.label.toLowerCase() === norm);
  if(hit){
    commit("merged group " + g.label + " into " + hit.label, ()=>{
      documentState.state.people.forEach(p => { if(p.groupId === id) p.groupId = hit.id; });
    });
  }else{
    commit("renamed group " + g.label + " to " + trimmed, ()=>{ g.label = trimmed; });
  }
  return true;
}

function reorderGroupRow(sourceId, targetId, after){
  const from = documentState.state.groups.findIndex(g => g.id === sourceId);
  if(from < 0 || sourceId === targetId) return false;
  const target = documentState.state.groups.findIndex(g => g.id === targetId);
  if(target < 0) return false;

  const without = documentState.state.groups.filter(g => g.id !== sourceId);
  const anchor = without.findIndex(g => g.id === targetId);
  const insertAt = anchor + (after ? 1 : 0);
  if(insertAt === from) return false;

  const name = documentState.state.groups[from].label || "group";
  commit("moved group " + name, ()=>{
    const moved = documentState.state.groups.splice(from, 1)[0];
    const liveAnchor = documentState.state.groups.findIndex(g => g.id === targetId);
    documentState.state.groups.splice(liveAnchor + (after ? 1 : 0), 0, moved);
  });
  syncGroupModal();
  return true;
}

export { moveGroup, renameGroup, reorderGroupRow };
