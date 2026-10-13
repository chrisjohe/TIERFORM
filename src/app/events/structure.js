import { applyTemplate } from "../templates.js";
import { $ } from "../../ui/dom.js";
import { closeMenu } from "../../ui/menus.js";
import { clearRosterSearch, renderRoster, rosterState } from "../../ui/roster.js";
import { fillTemplatesMenu } from "../../ui/start.js";

function bindStructureEvents(){
fillTemplatesMenu();

$("#templatesMenu").addEventListener("click", e=>{
  const el = e.target.closest("[data-tpl]");
  if(!el) return;
  closeMenu(true);
  applyTemplate(el.dataset.tpl);
});

$("#rosterSearch").addEventListener("input", e=>{
  rosterState.rosterQuery = e.target.value;
  $("#rosterSearchClear").hidden = !rosterState.rosterQuery;
  renderRoster();
});

$("#rosterSearch").addEventListener("keydown", e=>{
  if(e.key !== "Escape") return;

  if(!e.target.value) return;

  e.stopPropagation();
  clearRosterSearch();
  $("#rosterSearch").focus();
});

$("#rosterSearchClear").addEventListener("click", ()=>{
  clearRosterSearch();
  $("#rosterSearch").focus();
});
}

export { bindStructureEvents };
