import { addOnePerson, addPhotoIntoDialog } from "../add-person.js";
import { clampFrame } from "../../model/framing.js";
import { ADD_FRAME_KEY, addDialogState, closeAddModal, setAddPhoto, syncAddPhotoInitials, syncAddRolePlaceholder } from "../../ui/add-dialog.js";
import { $ } from "../../ui/dom.js";
import { PAN_STEP, bindFramePan, addFrameShim, syncAddFramePreview } from "../../ui/framing.js";
import { selectTab } from "../../ui/ribbon.js";

function bindAddEvents(){
$("#addPhoto").addEventListener("change", async e=>{
  const file = ((e.target && e.target.files) || [])[0] || null;
  await addPhotoIntoDialog(file);
});

$("#addPhotoPick").addEventListener("click", ()=>{ $("#addPhoto").click(); });

$("#addPhotoBtn").addEventListener("click", ()=>{ $("#addPhoto").click(); });

$("#addName").addEventListener("input", syncAddPhotoInitials);

$("#addTier").addEventListener("change", syncAddRolePlaceholder);

$("#addFirstGrade").addEventListener("input", syncAddRolePlaceholder);

$("#addAddBtn").addEventListener("click", addOnePerson);

$("#addAddCloseBtn").addEventListener("click", async ()=>{
  if(await addOnePerson()) closeAddModal();
});

$("#addDoneBtn").addEventListener("click", closeAddModal);

$("#addGoTemplates").addEventListener("click", ()=>{
  closeAddModal();
  selectTab("grades");
  $("#templatesBtn").focus();
});

$("#addModal").addEventListener("keydown", e=>{
  if(e.key !== "Enter") return;
  const t = e.target;
  if(!t || t === $("#addPhoto")) return;
  if(t.tagName !== "INPUT" && t.tagName !== "SELECT") return;
  if($("#addAddBtn").disabled) return;
  e.preventDefault();
  addOnePerson();
});

$("#addModal").addEventListener("click", e=>{
  const el=e.target.closest("[data-fact]"); if(!el || !addDialogState.addPending) return;
  const act=el.dataset.fact;
  if(act==="replace"){ $("#addPhoto").click(); }
  if(act==="remove"){
    setAddPhoto(null);

    const first = $("#addPhotoEmpty").querySelector("button:not([disabled])");
    if(first) first.focus();
  }
  if(act==="reset"){
    addDialogState.addPending.frame = {zoom:1, ox:0, oy:0};
    const sl = $('#addModal input[data-fact="zoom"][data-id="'+ADD_FRAME_KEY+'"]');
    if(sl) sl.value = 1;
    syncAddFramePreview();
  }
});

$("#addModal").addEventListener("input", e=>{
  const el=e.target;
  if(el.dataset.fact!=="zoom" || !addDialogState.addPending) return;
  addDialogState.addPending.frame.zoom = +el.value;
  clampFrame(addFrameShim());
  syncAddFramePreview();
});

$("#addModal").addEventListener("keydown", e=>{
  const el = e.target.closest && e.target.closest('[data-fact="pan"]');
  if(!el || !addDialogState.addPending) return;
  const dir = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[e.key];
  if(!dir) return;
  e.preventDefault();
  const step = PAN_STEP * (e.shiftKey ? 4 : 1);
  addDialogState.addPending.frame.ox = (+addDialogState.addPending.frame.ox || 0) + dir[0]*step;
  addDialogState.addPending.frame.oy = (+addDialogState.addPending.frame.oy || 0) + dir[1]*step;
  clampFrame(addFrameShim());
  syncAddFramePreview();
});

bindFramePan($("#addModal"), {
  subject(){ return addDialogState.addPending ? addFrameShim() : null; },
  change(p, mutate){ mutate(); },
  sync: syncAddFramePreview
});
}

export { bindAddEvents };
