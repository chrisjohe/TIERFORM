import { confirmPaste } from "../paste-actions.js";
import { documentState } from "../../model/document.js";
import { askConfirm } from "../../ui/ask-dialog.js";
import { $ } from "../../ui/dom.js";
import { modalOpen } from "../../ui/modal.js";
import { closePasteModal, showPastePreview } from "../../ui/paste-dialog.js";

function bindPasteEvents(){
$("#pasteCancelBtn").addEventListener("click", closePasteModal);

$("#pastePreviewBtn").addEventListener("click", showPastePreview);

$("#pasteBackBtn").addEventListener("click", ()=>{
  $("#pastePreview").hidden = true;
  $("#pasteEntry").hidden = false;
});

$("#pasteAddBtn").addEventListener("click", ()=>confirmPaste(false));

$("#pasteReplaceBtn").addEventListener("click", async ()=>{
  if(documentState.state.people.length){

    const n = documentState.state.people.length;
    closePasteModal();
    const yes = await askConfirm("Replace the roster?",
      ["This removes the " + n + (n===1 ? " person" : " people") + " currently in the roster "
       + "and puts the pasted list in their place."],
      "Replace them", "danger");
    if(!yes){ modalOpen("#pasteModal", $("#pasteBackBtn")); return; }
  }
  confirmPaste(true);
});

$("#pasteModal").addEventListener("click", e=>{ if(e.target.id==="pasteModal") closePasteModal(); });
}

export { bindPasteEvents };
