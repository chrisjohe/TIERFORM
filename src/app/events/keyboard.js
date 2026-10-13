import { documentState } from "../../model/document.js";
import { endEdit, redo, undo } from "../../model/history.js";
import { closeAddModal } from "../../ui/add-dialog.js";
import { askClose } from "../../ui/ask-dialog.js";
import { $ } from "../../ui/dom.js";
import { closeEditModal } from "../../ui/edit-dialog.js";
import { closeGradePanel } from "../../ui/grade-popover.js";
import { closeGroupModal } from "../../ui/group-dialog.js";
import { importClose } from "../../ui/import-dialog.js";
import { closeInfoModal } from "../../ui/info-dialog.js";
import { closeMenu, menuOpen } from "../../ui/menus.js";
import { closePasteModal } from "../../ui/paste-dialog.js";
import { closePersonMenu } from "../../ui/person-menu.js";
import { endTour } from "../../ui/tour.js";

function bindKeyboardEvents(){
window.addEventListener("beforeunload", e=>{

  if(!(documentState.tourSaved ? documentState.tourSaved.dirtyDoc : documentState.dirtyDoc)) return;
  e.preventDefault();
  e.returnValue = "";
});

document.addEventListener("focusout", e=>{
  const t = e.target;
  if(t && (t.tagName==="INPUT" || t.tagName==="TEXTAREA" || t.tagName==="SELECT")) endEdit();
});

document.addEventListener("keydown", e=>{

  if(documentState.tourSaved){
    if(e.key === "Escape"){ endTour(); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase() === "z"){ e.preventDefault(); return; }
  }

  if((e.key==="Enter" || e.key==="Escape") && document.activeElement
     && document.activeElement.tagName==="INPUT") endEdit();
  if(e.key==="Escape" && menuOpen()){ closeMenu(true); return; }

  if(e.key==="Escape" && !$("#askModal").hidden){ askClose(null); return; }
  if(e.key==="Escape" && !$("#gradePanel").hidden){ closeGradePanel(true); return; }
  if(e.key==="Escape" && !$("#personMenu").hidden){ closePersonMenu(true); return; }

  if(e.key==="Escape" && !$("#importModal").hidden){ importClose(null); return; }
  if(e.key==="Escape" && !$("#addModal").hidden){ closeAddModal(); return; }
  if(e.key==="Escape" && !$("#editModal").hidden){ closeEditModal(); return; }
  if(e.key==="Escape" && !$("#pasteModal").hidden){ closePasteModal(); return; }
  if(e.key==="Escape" && !$("#infoModal").hidden){ closeInfoModal(); return; }
  if(e.key==="Escape" && !$("#groupModal").hidden){ closeGroupModal(); return; }
  if(!(e.ctrlKey||e.metaKey) || e.key.toLowerCase()!=="z") return;
  const tag = document.activeElement && document.activeElement.tagName;
  if(tag==="INPUT" || tag==="TEXTAREA") return;
  e.preventDefault();
  if(e.shiftKey) redo(); else undo();
});
}

export { bindKeyboardEvents };
