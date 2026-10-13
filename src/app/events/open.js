import { openState, openingStatus, resetPerRoster } from "../document.js";
import { renderAll } from "../render.js";
import { openRoster } from "../../io/roster.js";
import { documentState } from "../../model/document.js";
import { LIMITS } from "../../model/settings.js";
import { $ } from "../../ui/dom.js";
import { alertMsg, toast } from "../../ui/notifications.js";

function bindOpenEvents(){
$("#jsonPick").addEventListener("change", e=>{
  const f=e.target.files[0]; e.target.value=""; if(!f) return;

  if(f.size > LIMITS.rosterBytes){
    alertMsg("That roster could not be opened — the file is larger than the "
      + Math.round(LIMITS.rosterBytes/1024/1024) + " MB limit");
    return;
  }

  const mine = ++openState.openSeq;
  openingStatus("Opening " + f.name + " …");
  const fr=new FileReader();

  fr.onerror=()=>{
    if(mine !== openState.openSeq) return;
    openingStatus("");
    alertMsg("That file could not be read from disk");
  };
  fr.onload=async ()=>{

    let r;

    try{ r = await openRoster(fr.result, {cancelled: () => mine !== openState.openSeq}); }
    catch(err){ r = {ok:false, reason:"its photos could not be checked"}; }

    if(r.cancelled) return;
    if(mine !== openState.openSeq) return;
    openingStatus("");
    if(!r.ok){ alertMsg("That roster could not be opened — " + r.reason); return; }

    documentState.state = r.state;
    documentState.docName = f.name.replace(/\.json$/i, "");
    documentState.dirtyDoc = false;
    resetPerRoster();
    renderAll();

    if(r.repaired.length){
      const n = r.repaired.length;
      toast("Opened " + f.name + " — " + n + (n===1 ? " value was" : " values were")
        + " out of range and reset: " + r.repaired.slice(0,3).join(", ")
        + (n > 3 ? ", …" : ""));
    }else{
      toast("Opened " + f.name);
    }
  };
  fr.readAsText(f);
});
}

export { bindOpenEvents };
