import { LIMITS } from "../../model/settings.js";
import { $ } from "../../ui/dom.js";
import { alertMsg } from "../../ui/notifications.js";
import { openPasteModal, showPastePreview } from "../../ui/paste-dialog.js";

function bindCsvEvents(){
$("#csvPick").addEventListener("change", e=>{
  const f=e.target.files[0]; e.target.value=""; if(!f) return;
  const fr=new FileReader();
  fr.onerror=()=>{ alertMsg("That file could not be read from disk"); };
  fr.onload=()=>{
    const text = String(fr.result);
    if(text.length > LIMITS.pasteChars){
      alertMsg("That file is too large to import");
      return;
    }

    openPasteModal();
    $("#pasteArea").value = text;
    showPastePreview();
  };
  fr.readAsText(f);
});
}

export { bindCsvEvents };
