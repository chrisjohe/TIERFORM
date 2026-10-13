import { documentState } from "../model/document.js";
import { endEdit } from "../model/history.js";
import { $, clear, fill } from "./dom.js";
import { gradePanelBody } from "./grade-editor.js";
import { closeMenu } from "./menus.js";
import { closePersonMenu } from "./person-menu.js";
import { placePopover } from "./popover.js";

const gradePopoverState = {
  gradeOpen: null
};

function gradeChipFor(id){
  return $("#tiers").querySelector('.g-chip[data-id="' + id + '"]');
}

function gradeToggleFor(chip){
  return chip && chip.querySelector(".g-chip-toggle");
}

function openGradePanel(id){
  const i = documentState.state.tiers.findIndex(t => t.id === id);
  if(i < 0) return;
  closeMenu();
  closePersonMenu();

  if(gradePopoverState.gradeOpen && gradePopoverState.gradeOpen !== id) closeGradePanel();
  gradePopoverState.gradeOpen = id;
  $("#gradePanel").hidden = false;
  syncGradePanel();
  const first = $("#gradePanelBody").querySelector("input,select,button:not([disabled])");
  if(first) first.focus();
}

function syncGradePanel(){
  if(!gradePopoverState.gradeOpen) return;
  const i = documentState.state.tiers.findIndex(t => t.id === gradePopoverState.gradeOpen);
  if(i < 0) return closeGradePanel();
  const t = documentState.state.tiers[i];
  const chip = gradeChipFor(gradePopoverState.gradeOpen);
  if(!chip) return closeGradePanel();

  chip.classList.add("open");
  const toggle = gradeToggleFor(chip);
  if(toggle) toggle.setAttribute("aria-expanded", "true");
  $("#gradePanelTitle").textContent = t.label || t.code || "Grade";
  fill($("#gradePanelBody"), [gradePanelBody(t, i)]);
  placeGradePanel();
}

function placeGradePanel(){
  if(!gradePopoverState.gradeOpen) return;
  const chip = gradeChipFor(gradePopoverState.gradeOpen);
  if(!chip) return closeGradePanel();
  placePopover($("#gradePanel"), chip);
}

function closeGradePanel(refocus){
  const p = $("#gradePanel");
  if(!p || p.hidden) return;
  const chip = gradePopoverState.gradeOpen && gradeChipFor(gradePopoverState.gradeOpen);
  p.hidden = true;
  clear($("#gradePanelBody"));
  if(chip){
    chip.classList.remove("open");
    const toggle = gradeToggleFor(chip);
    if(toggle){
      toggle.setAttribute("aria-expanded", "false");
      if(refocus) toggle.focus();
    }
  }
  gradePopoverState.gradeOpen = null;
  endEdit();
}

export { gradePopoverState, gradeChipFor, gradeToggleFor, openGradePanel, syncGradePanel, placeGradePanel, closeGradePanel };
