import { nameFromFile } from "../io/filenames.js";
import { processImage } from "../io/photo-import.js";
import { documentState, staleWrite } from "../model/document.js";
import { resolveGroupId, uid } from "../model/entities.js";
import { commit } from "../model/history.js";
import { applyPhoto, photoFields } from "../model/photos.js";
import { LIMITS } from "../model/settings.js";
import { clampText, photoBudgetExceeded } from "../model/validation.js";
import { askImport } from "../ui/import-dialog.js";
import { alertMsg, toast } from "../ui/notifications.js";
import { clearRosterSearch } from "../ui/roster.js";

const photoActionsState = {
  importBusy: false
};

function photolessMatch(name, claimed){
  const key = name.trim().toLowerCase();
  return documentState.state.people.find(p=>!p.photo && !(claimed && claimed.has(p.id))
    && p.name && p.name.trim().toLowerCase()===key) || null;
}

async function addFiles(files){
  clearRosterSearch();

  if(photoActionsState.importBusy){ toast("Still importing the last batch — try again in a moment"); return; }

  const imgs = files.filter(f=>f.type === "image/jpeg" || f.type === "image/png");
  const skipped = files.length - imgs.length;
  if(!imgs.length){
    toast(skipped ? "Nothing imported — " + skipped + (skipped===1?" file is":" files are")
                    + " not JPEG or PNG" : "Nothing to import");
    return;
  }

  const claimed = new Set();
  const plan = imgs.map(f=>{
    const name = clampText(nameFromFile(f.name), LIMITS.text);
    const match = photolessMatch(name, claimed);
    if(match) claimed.add(match.id);

    return {file:f, name, person: match};
  });
  const additions = plan.filter(item => !item.person).length;

  let tierId, groupText;
  if(additions){
    const answer = await askImport(imgs.length);
    if(!answer) return;
    tierId = answer.tierId;
    groupText = answer.groupText;
    if(!documentState.state.tiers.length){
      alertMsg("Those photos were not imported — add or restore a grade under Structure first");
      return;
    }
  }

  const gen = documentState.docGen;

  if(documentState.state.people.length + additions > LIMITS.people){
    alertMsg("Those photos were not imported — a roster can contain at most "
      + LIMITS.people + " people");
    return;
  }

  photoActionsState.importBusy = true;
  const done = [], failed = [];
  try{
    for(const item of plan){
      try{ done.push({item:item, result: await processImage(item.file)}); }
      catch(e){ failed.push({name:item.file.name, why: e && e.message ? e.message : "could not be read"}); }
    }
  }finally{ photoActionsState.importBusy = false; }

  const needsGrade = done.some(d => !d.item.person);
  const blocked = staleWrite(gen, needsGrade ? {tierId: tierId} : null);
  if(blocked){
    alertMsg("Those photos were not imported — " + blocked);
    return;
  }

  const usable  = done.filter(d => !d.item.person || documentState.state.people.indexOf(d.item.person) !== -1);
  const dropped = done.length - usable.length;

  let addedBytes = 0, removedBytes = 0;
  for(const d of usable){
    if(d.item.person && d.item.person.photo) removedBytes += d.item.person.photo.length;
    addedBytes += d.result.data.length;
  }
  if(photoBudgetExceeded(documentState.state, addedBytes, removedBytes)){
    alertMsg("Those photos were not imported — the roster's photos would exceed the "
      + Math.round(LIMITS.totalPhotoBytes/1024/1024) + " MB limit");
    return;
  }

  const added    = usable.filter(d => !d.item.person).length;
  const attached = usable.filter(d =>  d.item.person).length;
  const label = [
    added    ? added+(added===1?" person":" people")+" added" : "",
    attached ? attached+" photo"+(attached===1?"":"s")+" attached" : ""
  ].filter(Boolean).join(", ") || "no photos imported";

  if(usable.length){
    commit(label, ()=>{
      for(const d of usable){
        if(d.item.person) applyPhoto(d.item.person, d.result);

        else documentState.state.people.push(Object.assign(
          {id:uid(), name:d.item.name, tierId, groupId: resolveGroupId(documentState.state, groupText), role:""},
          photoFields(d.result)));
      }
    });
  }

  const parts = [];
  if(usable.length) parts.push(label);
  if(dropped) parts.push(dropped + (dropped===1?" photo was":" photos were")
    + " discarded — the person left the roster while it was loading");
  if(failed.length) parts.push(failed.length + (failed.length===1?" image":" images")
    + " skipped — " + failed[0].name + ": " + failed[0].why);
  if(skipped) parts.push(skipped + (skipped===1?" file was":" files were") + " not JPEG or PNG");

  (failed.length || skipped || dropped ? alertMsg : toast)(parts.join(" · "));
}

export { photoActionsState, photolessMatch, addFiles };
