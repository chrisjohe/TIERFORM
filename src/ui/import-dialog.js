import { documentState } from "../model/document.js";
import { $ } from "./dom.js";
import { modalClose, modalOpen } from "./modal.js";
import { fillGroupOptions, fillTierOptions, firstTierId } from "./options.js";

const importDialogState = {
  importResolve: null
};

function importClose(value){
  const done = importDialogState.importResolve;
  importDialogState.importResolve = null;
  modalClose("#importModal");
  if(done) done(value);
}

function askImport(count){

  if(importDialogState.importResolve) return Promise.resolve(null);

  $("#importCount").textContent = count === 1
    ? "1 photo to import. It will be added to:"
    : count + " photos to import. They will all be added to:";

  fillTierOptions($("#importTier"), firstTierId());
  fillGroupOptions();
  $("#importGroup").value = "";

  const noGrades = !documentState.state.tiers.length;
  $("#importConfirmBtn").disabled = noGrades;
  $("#importNoGrades").hidden = !noGrades;
  $("#importCount").hidden = noGrades;

  modalOpen("#importModal", noGrades ? $("#importCancelBtn") : $("#importTier"));
  return new Promise(res => { importDialogState.importResolve = res; });
}

export { importDialogState, importClose, askImport };
