import { $ } from "../../ui/dom.js";
import { groupDragSurface } from "../../ui/drag-bindings.js";
import { closeGroupModal, restoreGroupFocus, syncGroupModal } from "../../ui/group-dialog.js";
import { moveGroup, renameGroup } from "../group-actions.js";

function bindGroupsEvents(){
$("#groupList").addEventListener("click", async e=>{
  if(groupDragSurface.clickSuppressed()) return;
  const btn = e.target.closest("[data-act]");
  if(!btn) return;
  const act = btn.dataset.act, id = btn.dataset.id;
  if(act === "up") moveGroup(id, -1);
  else if(act === "down") moveGroup(id, 1);
  else if(act === "rename") await renameGroup(id);
  else return;
  syncGroupModal();
  restoreGroupFocus(act, id);
});

$("#groupDoneBtn").addEventListener("click", ()=>closeGroupModal());


}

export { bindGroupsEvents };
