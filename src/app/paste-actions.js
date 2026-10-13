import { PASTE_NEW, PASTE_NEW_CODE, PASTE_NEW_LABEL, pasteGradePlan, pasteNewTier } from "./paste-plan.js";
import { documentState } from "../model/document.js";
import { newTier, resolveGroupId, uid } from "../model/entities.js";
import { commit } from "../model/history.js";
import { LIMITS } from "../model/settings.js";
import { alertMsg, toast } from "../ui/notifications.js";
import { closePasteModal, pasteDialogState } from "../ui/paste-dialog.js";

function confirmPaste(replace){
  if(!pasteDialogState.pasteRows.length) return;
  if(!replace && documentState.state.people.length + pasteDialogState.pasteRows.length > LIMITS.people){
    alertMsg("Those people were not added — a roster can contain at most " + LIMITS.people + " people");
    return;
  }
  const gradeLimitMsg = "A roster can contain at most " + LIMITS.tiers + " grades";

  const zeroGradeMode = documentState.state.tiers.length === 0;
  let mutate;
  if(zeroGradeMode){
    const plan = pasteGradePlan(pasteDialogState.pasteRows);

    if(plan.needed > LIMITS.tiers){
      alertMsg(gradeLimitMsg);
      return;
    }
    mutate = () => {
      if(replace) documentState.state.people = [];

      const byNorm = new Map();
      plan.distinct.forEach(v=>{
        const t = newTier(v, v);
        documentState.state.tiers.push(t);
        byNorm.set(v.trim().toLowerCase(), t);
      });

      let newTarget = null;
      if(plan.anyEmpty){
        newTarget = pasteNewTier();
        if(!newTarget){
          newTarget = newTier(PASTE_NEW_CODE, PASTE_NEW_LABEL);
          documentState.state.tiers.push(newTarget);
        }
      }
      pasteDialogState.pasteRows.forEach(r=>{

        const dest = r.gradeRaw ? byNorm.get(r.gradeRaw.trim().toLowerCase()) : newTarget;
        documentState.state.people.push({id:uid(), name:r.name,
                           tierId: dest ? dest.id : undefined,
                           groupId: resolveGroupId(documentState.state, r.group),
                           role:r.role, photo:null, pw:0, ph:0, frame:null});
      });
    };
  } else {

    const needsNew = pasteDialogState.pasteRows.some(r=>r.tierId === PASTE_NEW);
    if(needsNew && !pasteNewTier() && documentState.state.tiers.length >= LIMITS.tiers){
      alertMsg(gradeLimitMsg);
      return;
    }
    mutate = () => {
      if(replace) documentState.state.people = [];

      let target = needsNew ? pasteNewTier() : null;
      if(needsNew && !target){
        target = newTier(PASTE_NEW_CODE, PASTE_NEW_LABEL);
        documentState.state.tiers.push(target);
      }
      pasteDialogState.pasteRows.forEach(r=>{
        documentState.state.people.push({id:uid(), name:r.name,
                           tierId:(r.tierId === PASTE_NEW ? target.id : r.tierId),
                           groupId: resolveGroupId(documentState.state, r.group),
                           role:r.role, photo:null, pw:0, ph:0, frame:null});
      });
    };
  }
  const n = pasteDialogState.pasteRows.length;
  commit((replace?"replaced roster with ":"added ")+n+(n===1?" pasted person":" pasted people"), mutate);

  pasteDialogState.pasteRows = [];
  closePasteModal();
  toast(n+(n===1?" person":" people")+(replace?" replacing the roster":" added"));
}

export { confirmPaste };
