import { photosState } from "./photos.js";
import { removePerson } from "../person-actions.js";
import { documentState } from "../../model/document.js";
import { resolveGroupId } from "../../model/entities.js";
import { commit, edit } from "../../model/history.js";
import { LIMITS } from "../../model/settings.js";
import { clampText } from "../../model/validation.js";
import { $ } from "../../ui/dom.js";
import { closeEditModal, editDialogState, editPerson } from "../../ui/edit-dialog.js";
import { firstName, syncRowIdentity } from "../../ui/person-row.js";

function bindEditEvents(){
$("#editName").addEventListener("input", e=>{
  const p = editPerson(); if(!p) return;
  edit("name:"+p.id, "renamed "+(p.name||"a person"),
    ()=>{ p.name = clampText(e.target.value, LIMITS.text); });

  syncRowIdentity(p);
});

$("#editGroup").addEventListener("input", e=>{
  const p = editPerson(); if(!p) return;
  edit("group:"+p.id, "changed "+firstName(p,"a person")+"'s group",
    ()=>{ p.groupId = resolveGroupId(documentState.state, e.target.value); });
});

$("#editRole").addEventListener("input", e=>{
  const p = editPerson(); if(!p) return;
  edit("role:"+p.id, "changed "+firstName(p,"a person")+"'s role",
    ()=>{ p.role = clampText(e.target.value, LIMITS.text); });
});

$("#editTier").addEventListener("change", e=>{
  const p = editPerson(); if(!p) return;
  commit("moved "+firstName(p,"a person")+" to another grade", ()=>{ p.tierId = e.target.value; });
});

$("#editDoneBtn").addEventListener("click", ()=>closeEditModal());

$("#editRemoveBtn").addEventListener("click", ()=>{
  const id = editDialogState.editId;
  if(!id) return;
  closeEditModal();
  removePerson(id);
});

$("#editModal").addEventListener("click", e=>{
  const el=e.target.closest("[data-act]"); if(!el) return;
  if(el.dataset.act==="photo"){ photosState.swapId=el.dataset.id; $("#fileSwap").click(); }
});
}

export { bindEditEvents };
