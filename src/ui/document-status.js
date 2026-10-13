import { documentState } from "../model/document.js";
import { canRedo, canUndo } from "../model/history.js";
import { $ } from "./dom.js";

function updateDocLabel(){
  const el = $("#docName");
  if(!el) return;
  const fresh  = !documentState.docName;
  const dirty  = !fresh && documentState.dirtyDoc;
  const status = fresh ? "Not saved yet" : (dirty ? "Unsaved changes" : "Saved");
  const txt = $("#docText");
  if(txt) txt.textContent = documentState.docName || "Untitled roster";
  const st = $("#docStatus");
  if(st) st.textContent = status;

  el.classList.toggle("fresh", fresh);
  el.classList.toggle("dirty", dirty);
  syncNeverSavedBar();
}

function syncNeverSavedBar(){
  const bar = $("#neverSaved");
  if(!bar) return;

  const show = !documentState.docName && documentState.dirtyDoc && !documentState.tourSaved;
  bar.hidden = !show;
  if(show)
    bar.textContent = 'This roster has never been saved — use "Save copy" to download it.';
}

function updateHistoryButtons(){
  $("#undoBtn").disabled = !canUndo();
  $("#redoBtn").disabled = !canRedo();
}

export { updateDocLabel, syncNeverSavedBar, updateHistoryButtons };
