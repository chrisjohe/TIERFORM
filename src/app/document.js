import { renderAll } from "./render.js";
import { download } from "../io/download.js";
import { defaults } from "../model/defaults.js";
import { documentState, newGeneration } from "../model/document.js";
import { clearHistory, endEdit, photoSweep } from "../model/history.js";
import { FILE_FORMAT, LIMITS } from "../model/settings.js";
import { stateLimitProblem } from "../model/validation.js";
import { askConfirm, askText } from "../ui/ask-dialog.js";
import { updateDocLabel } from "../ui/document-status.js";
import { $ } from "../ui/dom.js";
import { closeEditModal } from "../ui/edit-dialog.js";
import { alertMsg, toast } from "../ui/notifications.js";
import { closePersonMenu } from "../ui/person-menu.js";

const openState = {
  openSeq: 0
};

function resetPerRoster(){
  clearHistory();
  endEdit();
  photoSweep();
  closePersonMenu();
  closeEditModal();
  newGeneration();
}

function confirmDiscard(what, confirmLabel){
  if(!documentState.dirtyDoc) return Promise.resolve(true);
  return askConfirm(
    "Unsaved changes",
    ["There are unsaved changes in \u201C" + (documentState.docName || "Untitled roster") + "\u201D.",
     "They will be lost if you " + what + "."],

    confirmLabel || "Discard changes", "danger");
}

async function newDoc(){
  if(!await confirmDiscard("start a new roster", "Discard and start new")) return;
  documentState.state = defaults();
  documentState.docName = ""; documentState.dirtyDoc = false;
  resetPerRoster();
  renderAll();
  toast("New roster");
}

async function saveDoc(as){
  const limitProblem = stateLimitProblem(documentState.state);
  if(limitProblem){
    alertMsg("That roster cannot be saved — " + limitProblem);
    return false;
  }
  let stem = documentState.docName || fileStem();
  if(as || !documentState.docName){
    const asked = await askText("Save a copy", "The roster is written to your downloads folder.",
                                stem, "File name", "Save copy");
    if(asked === null || asked === undefined) return false;
    stem = String(asked).trim().replace(/\.json$/i, "") || stem;
  }

  const fileBody = Object.assign({app:"tierform", format:FILE_FORMAT}, documentState.state);
  const blob = new Blob([JSON.stringify(fileBody,null,2)],{type:"application/json"});
  if(blob.size > LIMITS.rosterBytes){
    alertMsg("That roster is too large to save — remove some photos and try again");
    return false;
  }
  download(blob, stem + ".json");
  documentState.docName  = stem;
  documentState.dirtyDoc = false;
  updateDocLabel();
  toast("Saved as " + stem + ".json");
  return true;
}

function openingStatus(msg){
  const el = $("#opening");
  if(!el) return;
  el.textContent = msg || "";
  el.hidden = !msg;
}

async function openDoc(){
  if(!await confirmDiscard("open another roster", "Discard and open")) return;
  $("#jsonPick").click();
}

function fileStem(){
  return (documentState.state.title||"team-chart").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,"").toLowerCase() || "team-chart";
}

export { openState, resetPerRoster, confirmDiscard, newDoc, saveDoc, openingStatus, openDoc, fileStem };
