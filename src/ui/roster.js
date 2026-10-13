import { labelIndex, peopleBy } from "../model/indexes.js";
import { codeParts } from "../engine/helpers.js";
import { documentState } from "../model/document.js";
import { groupLabel } from "../model/entities.js";
import { tierRole } from "../model/labels.js";
import { syncStructureAvailability } from "./availability.js";
import { $, el, fill, icon } from "./dom.js";
import { syncEditModal } from "./edit-dialog.js";
import { gradeChip } from "./grade-editor.js";
import { syncGradePanel } from "./grade-popover.js";
import { syncPersonMenu } from "./person-menu.js";
import { personRow } from "./person-row.js";
import { syncRibbonOverflow } from "./ribbon.js";

const rosterState = {
  rosterQuery: ""
};

function focusedField(){
  const a = document.activeElement;
  if(!a || !a.dataset || !a.dataset.id) return null;
  const verb = a.dataset.act || a.dataset.tact || a.dataset.fact;
  if(!verb) return null;
  const attr = a.dataset.act ? "act" : (a.dataset.tact ? "tact" : "fact");
  const canSelect = a.selectionStart !== undefined && a.selectionStart !== null;

  return {attr: attr, verb: verb, id: a.dataset.id,
          value: a.dataset.value === undefined ? null : a.dataset.value,
          start: canSelect ? a.selectionStart : null,
          end:   canSelect ? a.selectionEnd   : null};
}

function restoreField(f){
  if(!f) return;
  const el = document.querySelector(
    '[data-' + f.attr + '="' + f.verb + '"][data-id="' + f.id + '"]'
    + (f.value === null || f.value === undefined
        ? "" : '[data-value="' + f.value + '"]'));
  if(!el) return;
  el.focus();
  if(f.start !== null && el.setSelectionRange){
    try{ el.setSelectionRange(f.start, f.end); }catch(e){}
  }
}

function rosterFiltered(){ return rosterState.rosterQuery.trim().length > 0; }

function personMatches(st, p, q, lookup){
  const t = lookup ? lookup.tiers.get(p.tierId) : (st.tiers || []).find(x => x.id === p.tierId);
  const hay = [p.name || "", p.role || tierRole(t), t ? t.code : "", t ? t.label : "",
               groupLabel(st, p, lookup)].join("\n").toLowerCase();
  return hay.indexOf(q.toLowerCase()) >= 0;
}

function clearRosterSearch(){
  if(rosterState.rosterQuery === "") return;
  rosterState.rosterQuery = "";
  $("#rosterSearch").value = "";
  $("#rosterSearchClear").hidden = true;
  renderRoster();
}

function renderRoster(){
  const keepFocus = focusedField();
  const host = $("#roster");

  const searchRow = $("#rosterSearchRow");
  searchRow.hidden = !documentState.state.people.length;
  if(searchRow.hidden && rosterState.rosterQuery !== ""){
    rosterState.rosterQuery = "";
    $("#rosterSearch").value = "";
    $("#rosterSearchClear").hidden = true;
  }
  const q = rosterState.rosterQuery.trim();
  const countEl = $("#rosterCount");
  if(!documentState.state.people.length){
    fill(host, [el("p", {cls:"empty",
      text:"Nobody yet. Add someone with the button below, or drop photos on it."})]);
    countEl.hidden = true;
  }else{
    const groups = [];
    const byTier = peopleBy(documentState.state.people, "tierId"), lookup = labelIndex(documentState.state);
    let shown = 0;
    for(const t of documentState.state.tiers){
      const members = byTier.get(t.id) || [];
      const list = q ? members.filter(p => personMatches(documentState.state, p, q, lookup)) : members;
      if(!list.length) continue;
      shown += list.length;
      const head = el("div", {cls:"th"});
      for(const c of codeParts(t.code)) head.appendChild(el("span", {cls:"code", text:c}));
      head.appendChild(el("span", {cls:"nm", text:t.label}));
      head.appendChild(el("span", {cls:"ct", text:String(list.length)}));

      head.appendChild(el("button", {cls:"ghost th-add", act:"addTo", did:t.id,
                                     title:"Add someone to " + t.label,
                                     label:"Add someone to " + t.label},
                          [icon("#i-add")]));

      const group = el("div", {cls:"tier-group"}, [head]);
      list.forEach(p => group.appendChild(personRow(p)));
      groups.push(group);
    }
    if(q && !shown){
      fill(host, [el("p", {cls:"empty", text:'Nobody matches "' + rosterState.rosterQuery + '"'})]);
    }else{
      fill(host, groups);
    }
    if(q){
      countEl.hidden = false;
      countEl.textContent = shown + " of " + documentState.state.people.length + " shown";
    }else{
      countEl.hidden = true;
      countEl.textContent = "";
    }
  }

  fill($("#tiers"), documentState.state.tiers.length
    ? documentState.state.tiers.map(gradeChip)
    : [el("p", {cls:"tiers-empty", text:"No grades yet. Add one, or apply a template."})]);

  syncGradePanel();

  syncStructureAvailability();

  syncPersonMenu();
  syncEditModal();

  restoreField(keepFocus);
  syncRibbonOverflow();
}

export { rosterState, focusedField, restoreField, rosterFiltered, personMatches, clearRosterSearch, renderRoster };
