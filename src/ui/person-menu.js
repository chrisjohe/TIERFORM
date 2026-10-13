import { documentState } from "../model/document.js";
import { $, clear, fill } from "./dom.js";
import { closeGradePanel } from "./grade-popover.js";
import { closeMenu } from "./menus.js";
import { personMenuBody } from "./person-row.js";
import { placePopover } from "./popover.js";

const personMenuState = {
  personOpen: null
};

function rowMenuFor(id){
  return $("#roster").querySelector('[data-act="menu"][data-id="' + id + '"]');
}

function openPersonMenu(id){
  const p = documentState.state.people.find(x => x.id === id);
  if(!p) return;
  closeMenu();
  closeGradePanel();
  if(personMenuState.personOpen && personMenuState.personOpen !== id) closePersonMenu();
  personMenuState.personOpen = id;
  $("#personMenu").hidden = false;
  syncPersonMenu();
  focusPersonMenuItem("edit", id);
}

function syncPersonMenu(){
  if(!personMenuState.personOpen) return;
  const p = documentState.state.people.find(x => x.id === personMenuState.personOpen);
  if(!p) return closePersonMenu();
  const caret = rowMenuFor(personMenuState.personOpen);
  if(!caret) return closePersonMenu();
  caret.setAttribute("aria-expanded", "true");
  fill($("#personMenu"), [personMenuBody(p)]);
  placePersonMenu();
}

function placePersonMenu(){
  if(!personMenuState.personOpen) return;
  const caret = rowMenuFor(personMenuState.personOpen);
  if(!caret) return closePersonMenu();
  placePopover($("#personMenu"), caret);
}

function closePersonMenu(refocus){
  const m = $("#personMenu");
  if(!m || m.hidden) return;
  const caret = personMenuState.personOpen && rowMenuFor(personMenuState.personOpen);
  m.hidden = true;

  clear(m);
  if(caret){
    caret.setAttribute("aria-expanded", "false");
    if(refocus) caret.focus();
  }
  personMenuState.personOpen = null;
}

function focusPersonMenuItem(verb, id){
  const m = $("#personMenu");
  if(!m || m.hidden) return;
  const want = m.querySelector('[data-act="' + verb + '"][data-id="' + id + '"]:not([disabled])')
            || m.querySelector("button:not([disabled])");
  if(want) want.focus();
}

export { personMenuState, rowMenuFor, openPersonMenu, syncPersonMenu, placePersonMenu, closePersonMenu, focusPersonMenuItem };
