import { documentState } from "../model/document.js";
import { $, el, fill, icon } from "./dom.js";
import { focusables, modalClose, modalOpen } from "./modal.js";

function groupRow(g, i, total){
  const label = g.label || "";
  const n = documentState.state.people.filter(p => p.groupId === g.id).length;
  const first = i === 0, last = i === total - 1;
  return el("div", {cls:"grp-row", did:g.id}, [
    el("span", {cls:"grp-name", did:g.id, draggable:true, text:label}),
    el("span", {cls:"grp-count", text:String(n)}),
    el("button", {act:"up", did:g.id, disabled:first,
                  label:"Move " + label + " up"}, [icon("#i-up")]),
    el("button", {act:"down", did:g.id, disabled:last,
                  label:"Move " + label + " down"}, [icon("#i-down")]),

    el("button", {act:"rename", did:g.id, title:"Rename",
                  label:"Rename " + label}, [icon("#i-edit")])
  ]);
}

function syncGroupModal(){
  if(!Array.isArray(documentState.state.groups)) return;
  const groups = documentState.state.groups;
  $("#groupsLabel").value = documentState.state.groupsLabel || "";
  $("#groupEmpty").hidden = groups.length > 0;
  fill($("#groupList"), groups.map((g,i)=>groupRow(g, i, groups.length)));
}

function openGroupModal(){
  syncGroupModal();
  modalOpen("#groupModal", $("#groupDoneBtn"));
}

function closeGroupModal(){ modalClose("#groupModal"); }

function restoreGroupFocus(act, id){
  const found = document.querySelector('[data-act="' + act + '"][data-id="' + id + '"]');
  if(found){ found.focus(); return; }
  const first = focusables($("#groupList"))[0];
  (first || $("#groupDoneBtn")).focus();
}

export { groupRow, syncGroupModal, openGroupModal, closeGroupModal, restoreGroupFocus };
