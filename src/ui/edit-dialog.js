import { documentState } from "../model/document.js";
import { groupLabel } from "../model/entities.js";
import { endEdit } from "../model/history.js";
import { initials, tierRole } from "../model/labels.js";
import { $, clear, el, fill, icon } from "./dom.js";
import { framePanel, syncFramePreview } from "./framing.js";
import { modalClose, modalOpen } from "./modal.js";
import { fillGroupOptions, fillTierOptions } from "./options.js";
import { rowMenuFor } from "./person-menu.js";
import { personLabel } from "./person-row.js";

const editDialogState = {
  editId: null
};

function editPerson(){ return editDialogState.editId ? documentState.state.people.find(x=>x.id===editDialogState.editId) : null; }

function openEditModal(id){
  const p = documentState.state.people.find(x=>x.id===id);
  if(!p) return;
  endEdit();
  editDialogState.editId = id;
  $("#editModal").hidden = false;
  fillGroupOptions();
  syncEditModal();
  modalOpen("#editModal", $("#editName"));
}

function closeEditModal(){
  if(!editDialogState.editId) return;
  const id = editDialogState.editId;
  editDialogState.editId = null;
  endEdit();
  clear($("#editPhoto"));
  modalClose("#editModal");

  const caret = rowMenuFor(id);
  if(caret) caret.focus();
}

function syncEditModal(){
  if(!editDialogState.editId) return;
  const p = editPerson();
  if(!p) return closeEditModal();
  const put = (sel, v) => { const n = $(sel); if(n && n.value !== v) n.value = v; };
  put("#editName",   p.name || "");
  put("#editGroup", groupLabel(documentState.state, p));
  put("#editRole",   p.role || "");

  const t = documentState.state.tiers.find(x => x.id === p.tierId);
  $("#editRole").placeholder = t ? tierRole(t) : "";
  fillTierOptions($("#editTier"), p.tierId);
  syncEditPhoto(p);
}

function editPhotoBody(p){
  const who = personLabel(p);
  if(p.photo) return framePanel({key:p.id, src:p.photo, pw:p.pw, ph:p.ph, frame:p.frame, who:who});

  return el("div", {cls:"no-photo"}, [
    el("button", {type:"button", cls:"np-circle", act:"photo", did:p.id,
                  label:"Add a photo for " + who, text:initials(p.name)}),
    el("button", {act:"photo", did:p.id,
                  label:"Add a photo for " + who},
                  [icon("#i-add-photo"), "Add photo"])
  ]);
}

function syncEditPhoto(p){
  fill($("#editPhoto"), [editPhotoBody(p)]);

  if(p.photo) syncFramePreview(p);
}

export { editDialogState, editPerson, openEditModal, closeEditModal, syncEditModal, editPhotoBody, syncEditPhoto };
