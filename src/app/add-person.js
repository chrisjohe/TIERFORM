import { photoActionsState } from "./photo-actions.js";
import { nameFromFile } from "../io/filenames.js";
import { processImage } from "../io/photo-import.js";
import { documentState, staleWrite } from "../model/document.js";
import { newTier, resolveGroupId, uid } from "../model/entities.js";
import { clampFrame } from "../model/framing.js";
import { commit } from "../model/history.js";
import { photoFields } from "../model/photos.js";
import { LIMITS } from "../model/settings.js";
import { clampText, photoBudgetExceeded } from "../model/validation.js";
import { addDialogState, setAddPhoto, syncAddPhotoInitials, syncAddRolePlaceholder } from "../ui/add-dialog.js";
import { $ } from "../ui/dom.js";
import { alertMsg, toast } from "../ui/notifications.js";
import { fillGroupOptions, fillTierOptions, firstTierId } from "../ui/options.js";

async function addOnePerson(){

  const zeroGrades = !documentState.state.tiers.length;
  const firstGrade = zeroGrades
    ? clampText($("#addFirstGrade").value.trim(), LIMITS.text) : "";
  if(zeroGrades && !firstGrade){
    alertMsg("Nobody was added — name the first grade, or apply a template under Structure");
    return false;
  }
  if(documentState.state.people.length >= LIMITS.people){
    alertMsg("Nobody was added — a roster can contain at most " + LIMITS.people + " people");
    return false;
  }

  if(photoActionsState.importBusy){ toast("Still importing the last batch — try again in a moment"); return false; }

  const tierId = zeroGrades ? null : ($("#addTier").value || firstTierId());
  const groupText = clampText($("#addGroup").value.trim(), LIMITS.text);
  const name   = clampText($("#addName").value.trim(), LIMITS.text);
  const role   = clampText($("#addRole").value.trim(), LIMITS.text);

  if(addDialogState.addPending){

    const blocked = staleWrite(addDialogState.addPending.gen, zeroGrades ? null : {tierId: tierId});
    if(blocked){ alertMsg("Nobody was added — " + blocked); return false; }

    if(photoBudgetExceeded(documentState.state, addDialogState.addPending.result.data.length, 0)){
      alertMsg("Nobody was added — the roster's photos would exceed the "
        + Math.round(LIMITS.totalPhotoBytes/1024/1024) + " MB limit");
      return false;
    }
  }

  commit(zeroGrades ? "1 grade and 1 person added" : "1 person added", ()=>{

    let destTierId = tierId;
    if(zeroGrades){
      const t = newTier(firstGrade.charAt(0).toUpperCase(), firstGrade);
      documentState.state.tiers.push(t);
      destTierId = t.id;
    }
    const person = Object.assign(
      {id:uid(), name:name, tierId:destTierId, groupId:null, role:role},
      photoFields(addDialogState.addPending && addDialogState.addPending.result));

    person.groupId = resolveGroupId(documentState.state, groupText);

    if(addDialogState.addPending && addDialogState.addPending.frame) person.frame = Object.assign({}, addDialogState.addPending.frame);
    clampFrame(person);
    documentState.state.people.push(person);
  });
  toast(zeroGrades ? "1 grade and 1 person added" : "1 person added");

  const keep = $("#addTier").value;
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
  $("#addName").focus();

  return true;
}

async function addPhotoIntoDialog(file){
  let pending = null;
  if(file && photoActionsState.importBusy){

    toast("Still importing the last batch — try again in a moment");
  }else if(file){

    const gen = documentState.docGen;
    photoActionsState.importBusy = true;

    try{
      pending = {result: await processImage(file), gen: gen, frame:{zoom:1, ox:0, oy:0}};

      if(!$("#addName").value.trim()){
        $("#addName").value = clampText(nameFromFile(file.name), LIMITS.text);
        syncAddPhotoInitials();
      }
    }
    catch(err){

      alertMsg("That photo was not used — "
        + (err && err.message ? err.message : "that file could not be read"));
    }
    finally{ photoActionsState.importBusy = false; }
  }
  setAddPhoto(pending);
}

export { addOnePerson, addPhotoIntoDialog };
