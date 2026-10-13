import { PASTE_NEW, PASTE_NEW_CODE, parsePasteText, pasteGradePlan, pasteNewTier } from "../app/paste-plan.js";
import { documentState } from "../model/document.js";
import { LIMITS } from "../model/settings.js";
import { $, el, fill } from "./dom.js";
import { modalClose, modalOpen } from "./modal.js";
import { alertMsg, toast } from "./notifications.js";
import { clearRosterSearch } from "./roster.js";

const pasteDialogState = {
  pasteRows: []
};

function openPasteModal(){
  clearRosterSearch();
  $("#pasteArea").value = "";

  $("#pasteEntry").hidden = false;
  $("#pastePreview").hidden = true;
  modalOpen("#pasteModal", $("#pasteArea"));
}

function closePasteModal(){ modalClose("#pasteModal"); }

function showPastePreview(){
  if($("#pasteArea").value.length > LIMITS.pasteChars){
    alertMsg("That list is too large to preview");
    return;
  }

  pasteDialogState.pasteRows = parsePasteText($("#pasteArea").value, PASTE_NEW);
  if(pasteDialogState.pasteRows.length > LIMITS.people){
    pasteDialogState.pasteRows = [];
    alertMsg("That list has more than " + LIMITS.people + " people");
    return;
  }
  if(!pasteDialogState.pasteRows.length){ toast("Nothing to preview — paste some rows first"); return; }
  const gradeLimitMsg = "A roster can contain at most " + LIMITS.tiers + " grades";

  const zeroGradeMode = documentState.state.tiers.length === 0;
  const plan = zeroGradeMode ? pasteGradePlan(pasteDialogState.pasteRows) : null;

  const newRows = zeroGradeMode ? null : pasteDialogState.pasteRows.filter(r=>r.tierId === PASTE_NEW).length;
  const newTier = zeroGradeMode ? null : pasteNewTier();

  const newName = zeroGradeMode ? null : (newTier ? (newTier.code || newTier.label) : PASTE_NEW_CODE);
  if(zeroGradeMode){
    const grades = plan.distinct.length;
    let summary = pasteDialogState.pasteRows.length+(pasteDialogState.pasteRows.length===1?" person":" people")
      + " — creates "+grades+(grades===1?" grade":" grades")+" from the list's Grade column";
    if(plan.anyEmpty){

      const emptyRows = pasteDialogState.pasteRows.filter(r=>!r.gradeRaw).length;
      summary += "; "+emptyRows+(emptyRows===1?" row names":" rows name")
        +" no grade, and "+(emptyRows===1?"goes":"go")+" to a new grade called NEW";
    }
    $("#pastePreviewSummary").textContent = summary;
  } else {
    $("#pastePreviewSummary").textContent = pasteDialogState.pasteRows.length+(pasteDialogState.pasteRows.length===1?" person":" people")
      + (newRows ? " — "+newRows+(newRows===1?" row names":" rows name")
          +" no grade this document has, and "+(newRows===1?"goes":"go")+" to "
          +(newTier ? "the existing "+newName+" grade" : "a new grade called "+newName) : "");
  }

  fill($("#pasteTableBody"), pasteDialogState.pasteRows.map(r=>{
    if(zeroGradeMode){

      let displayValue;
      if(r.gradeRaw){
        const norm = r.gradeRaw.trim().toLowerCase();
        displayValue = plan.distinct.find(v=>v.trim().toLowerCase()===norm) || r.gradeRaw;
      } else {
        const newGroup = plan.distinct.find(v=>v.trim().toLowerCase()==="new");
        displayValue = newGroup || PASTE_NEW_CODE;
      }
      return el("tr", {}, [
        el("td", {text:r.name   || "—"}),
        el("td", {text:displayValue}),
        el("td", {text:r.group || "—"}),
        el("td", {text:r.role   || "—"})
      ]);
    }

    const tier = documentState.state.tiers.find(t=>t.id===r.tierId)
              || (r.tierId === PASTE_NEW ? newTier : null);
    const gradeCell = el("td");
    if(r.unmatched){
      gradeCell.appendChild(el("span", {cls:"warn", text:"⚠",
        title:'"'+r.gradeRaw+'" matched no grade'}));
    }
    gradeCell.appendChild(document.createTextNode(
      tier ? tier.label : (r.tierId === PASTE_NEW ? PASTE_NEW_CODE : "")));
    return el("tr", {cls:r.unmatched ? "nomatch" : ""}, [
      el("td", {text:r.name   || "—"}),
      gradeCell,
      el("td", {text:r.group || "—"}),
      el("td", {text:r.role   || "—"})
    ]);
  }));
  $("#pasteEntry").hidden = true;
  $("#pastePreview").hidden = false;
  const addTooMany = documentState.state.people.length + pasteDialogState.pasteRows.length > LIMITS.people;

  const noGradeRoom = zeroGradeMode
    ? plan.needed > LIMITS.tiers
    : (newRows > 0 && !newTier && documentState.state.tiers.length >= LIMITS.tiers);
  $("#pasteAddBtn").disabled = addTooMany || noGradeRoom;
  $("#pasteAddBtn").title = noGradeRoom ? gradeLimitMsg
    : addTooMany
      ? "Adding these would exceed the " + LIMITS.people + "-person limit — replace instead"
      : "";
  $("#pasteReplaceBtn").disabled = noGradeRoom;
  $("#pasteReplaceBtn").title = noGradeRoom ? gradeLimitMsg : "";
}

export { pasteDialogState, openPasteModal, closePasteModal, showPastePreview };
