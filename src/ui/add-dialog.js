import { documentState } from "../model/document.js";
import { initials, tierRole } from "../model/labels.js";
import { LIMITS } from "../model/settings.js";
import { clampText } from "../model/validation.js";
import { $, clear, fill } from "./dom.js";
import { framePanel, syncAddFramePreview } from "./framing.js";
import { modalClose, modalOpen } from "./modal.js";
import { fillGroupOptions, fillTierOptions, firstTierId } from "./options.js";
import { clearRosterSearch } from "./roster.js";

const addDialogState = {
  addPending: null
};

const ADD_FRAME_KEY = "add";

function setAddPhoto(pending){
  addDialogState.addPending = pending || null;
  const well = $("#addPhotoWell");
  const empty = $("#addPhotoEmpty");
  if(!addDialogState.addPending){

    $("#addPhoto").value = "";
    clear(well);
    well.hidden = true;
    empty.hidden = false;
    return;
  }

  const who = ($("#addName").value || "").trim() || "the new person";
  fill(well, [framePanel({key:ADD_FRAME_KEY, src:addDialogState.addPending.result.data,
    pw:addDialogState.addPending.result.w, ph:addDialogState.addPending.result.h, frame:addDialogState.addPending.frame, who:who})]);
  syncAddFramePreview();
  well.hidden = false;
  empty.hidden = true;
}

function syncAddPhotoInitials(){
  $("#addPhotoPick").textContent = initials($("#addName").value);
}

function syncAddRolePlaceholder(){
  if(!documentState.state.tiers.length){
    $("#addRole").placeholder = clampText(($("#addFirstGrade").value || "").trim(), LIMITS.text);
    return;
  }
  const t = documentState.state.tiers.find(x => x.id === $("#addTier").value);
  $("#addRole").placeholder = t ? tierRole(t) : "";
}

function syncAddAvailability(){
  const noGrades = !documentState.state.tiers.length;
  $("#addTierField").hidden = noGrades;
  $("#addFirstGradeField").hidden = !noGrades;
  $("#addTemplateHint").hidden = !noGrades;
}

function openAddModal(wantTier){

  clearRosterSearch();

  const asked = wantTier && documentState.state.tiers.some(t => t.id === wantTier) ? wantTier : null;
  const keep = asked || $("#addTier").value;
  fillTierOptions($("#addTier"), keep && documentState.state.tiers.some(t => t.id === keep)
    ? keep : firstTierId());
  fillGroupOptions();

  $("#addFirstGrade").value = "";
  syncAddRolePlaceholder();
  setAddPhoto(null);
  $("#addName").value = "";
  $("#addRole").value = "";

  $("#addGroup").value = "";
  syncAddPhotoInitials();
  syncAddAvailability();

  modalOpen("#addModal", $("#addName"));
}

function closeAddModal(){ setAddPhoto(null); modalClose("#addModal"); }

export { addDialogState, ADD_FRAME_KEY, setAddPhoto, syncAddPhotoInitials, syncAddRolePlaceholder, syncAddAvailability, openAddModal, closeAddModal };
