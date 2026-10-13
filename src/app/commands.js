import { fileStem, newDoc, openDoc, saveDoc } from "./document.js";
import { exportWrap } from "./exports.js";
import { computeLayout } from "./layout.js";
import { toCSV } from "../io/csv.js";
import { download } from "../io/download.js";
import { documentState, newGeneration } from "../model/document.js";
import { newTier } from "../model/entities.js";
import { commit, redo, undo } from "../model/history.js";
import { LIMITS } from "../model/settings.js";
import { clampText, validColour } from "../model/validation.js";
import { canvasBlob } from "../render/blob.js";
import { toCanvas } from "../render/canvas.js";
import { toPDF } from "../render/pdf.js";
import { toSVG } from "../render/svg.js";
import { openAddModal } from "../ui/add-dialog.js";
import { askConfirm, askFields } from "../ui/ask-dialog.js";
import { checkContrast, syncStyleSummaries } from "../ui/design.js";
import { $ } from "../ui/dom.js";
import { closeGradePanel } from "../ui/grade-popover.js";
import { openGroupModal } from "../ui/group-dialog.js";
import { openInfo } from "../ui/info-dialog.js";
import { closeMenu, openMenu } from "../ui/menus.js";
import { alertMsg, toast } from "../ui/notifications.js";
import { openPasteModal } from "../ui/paste-dialog.js";
import { closePersonMenu } from "../ui/person-menu.js";
import { toggleRoster } from "../ui/ribbon.js";
import { clearRosterSearch } from "../ui/roster.js";
import { startTour } from "../ui/tour.js";

const COMMANDS = {

  new:       ()=>newDoc(),
  open:      ()=>openDoc(),
  save:      ()=>saveDoc(false),
  saveAs:    ()=>saveDoc(true),

  undo:      ()=>undo(),
  redo:      ()=>redo(),

  copyPng:   ()=>exportWrap("copyPng", async ()=>{
    const c = await toCanvas(computeLayout(documentState.state), 150);
    const blob = await canvasBlob(c, "image/png");
    await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
    return "Copied as PNG, 150 dpi — paste into your slide";
  }),
  exportPng: ()=>exportWrap("exportPng", async ()=>{
    toast("Rendering at 300 dpi…");
    const c = await toCanvas(computeLayout(documentState.state), 300);
    download(await canvasBlob(c, "image/png"), fileStem()+".png");
    return "PNG downloaded";
  }),
  exportPdf: ()=>exportWrap("exportPdf", async ()=>{
    toast("Building the PDF…");
    const L = computeLayout(documentState.state);
    download(await toPDF(L), fileStem()+".pdf");
    return "PDF downloaded — " + L.page.label + ", 300 dpi";
  }),
  exportSvg: ()=>exportWrap("exportSvg", async ()=>{
    const L = computeLayout(documentState.state);
    download(new Blob([toSVG(L)],{type:"image/svg+xml;charset=utf-8"}), fileStem()+".svg");
    return "SVG downloaded — text stays editable, fonts resolve on the opening machine";
  }),
  exportCsv: ()=>exportWrap("exportCsv", async ()=>{
    download(new Blob(["﻿"+toCSV(documentState.state)], {type:"text/csv;charset=utf-8"}), fileStem()+".csv");
    const n = documentState.state.people.length;
    return "CSV downloaded — " + (n===1 ? "1 person" : n+" people");
  }),

  accentSwatch: (el)=>{
    const hex = validColour(el.dataset.accent, null);
    const ink = validColour(el.dataset.ink, null);
    if(!hex || !ink) return;
    commit("chose the " + (el.textContent.trim() || "chosen") + " accent", ()=>{
      documentState.state.accent      = hex;
      documentState.state.inkOnColour = ink;
    }, {render:"chart"});

    $("#accent").value      = hex;
    $("#accentHex").value   = hex;
    $("#inkOnColour").value = ink;
    syncStyleSummaries();
    checkContrast();
  },

  infoPrivacy: ()=>openInfo("privacy"),
  infoTips:    ()=>openInfo("tips"),
  infoBug:     ()=>openInfo("bug"),
  infoApps:    ()=>openInfo("apps"),
  infoAbout:   ()=>openInfo("about"),
  tour:        ()=>startTour(),

  addPeople:    ()=>openAddModal(),

  pasteList:    ()=>openPasteModal(),

  importCsv:    ()=>{ clearRosterSearch(); $("#csvPick").click(); },

  clearRoster: async ()=>{
    if(!documentState.state.people.length) return;
    const gen = documentState.docGen;
    const count = documentState.state.people.length;
    const yes = await askConfirm("Clear the roster?",
      ["This removes all " + count + (count===1 ? " person" : " people") + " from this document.",
       "The grades, the title, the style and the layout stay as they are. You can undo this change."],
      "Clear roster", "danger");
    if(!yes) return;
    if(gen !== documentState.docGen){
      alertMsg("The roster was not cleared — the document changed while the question was open");
      return;
    }
    if(!documentState.state.people.length) return;
    newGeneration();
    commit("cleared the roster", ()=>{ documentState.state.people = []; });
    toast("Roster cleared");
  },

  toggleRoster: ()=>toggleRoster(),

  clearGrades: async ()=>{
    if(documentState.state.people.length){
      alertMsg("Remove all people before clearing the complete grade structure");
      return;
    }
    if(!documentState.state.tiers.length) return;
    const gen = documentState.docGen;
    const count = documentState.state.tiers.length;
    const yes = await askConfirm("Clear grades?",
      ["This removes all " + count + (count===1 ? " grade" : " grades") + " from this document.",
       "The chart will stay empty until you add or restore a grade. You can undo this change."],
      "Clear grades", "danger");
    if(!yes) return;
    if(gen !== documentState.docGen){
      alertMsg("The grades were not cleared — the document changed while the question was open");
      return;
    }
    if(documentState.state.people.length){
      alertMsg("The grades were not cleared — remove all people first");
      return;
    }
    newGeneration();
    commit("cleared the grades", ()=>{ documentState.state.tiers = []; });
    toast("All grades cleared");
  },
  addGrade: async ()=>{
    if(documentState.state.tiers.length >= LIMITS.tiers){
      alertMsg("A roster can contain at most " + LIMITS.tiers + " grades");
      return;
    }

    const got = await askFields("Add grade",
      "The short code is what appears on the band. The name is what the roster "
      + "panel and the grade list call it.",
      [{key:"code",  label:"Short code", value:"NEW",       placeholder:"P, SM, JS…"},
       {key:"label", label:"Grade name", value:"New grade", placeholder:"Senior Manager"}],
      "Add grade");
    if(!got) return;

    const code  = clampText(got.code,  LIMITS.text).trim() || "NEW";
    const label = clampText(got.label, LIMITS.text).trim() || "New grade";
    commit("added " + label, ()=>{
      documentState.state.tiers.push(newTier(code, label));
    });
  },

  groups: ()=>openGroupModal()
};

function bindCommands(){
document.addEventListener("click", e=>{

  if(!e.target.closest("#gradePanel") && !e.target.closest(".g-chip")) closeGradePanel();

  if(!e.target.closest("#personMenu") && !e.target.closest('[data-act="menu"]')) closePersonMenu();

  const styleChoice = e.target.closest("[data-style-select][data-value]");
  if(styleChoice){
    const control = $("#" + styleChoice.dataset.styleSelect);
    control.value = styleChoice.dataset.value;
    control.dispatchEvent(new Event("change", {bubbles:true}));
    syncStyleSummaries();
    closeMenu(true);
    return;
  }

  const styleToggle = e.target.closest("button.style-command[aria-controls]");
  if(styleToggle){
    const id = "#" + styleToggle.getAttribute("aria-controls");
    if($(id) && $(id).hidden) openMenu(id); else closeMenu(true);
    return;
  }

  const templatesToggle = e.target.closest("#templatesBtn");
  if(templatesToggle){
    const id = "#" + templatesToggle.getAttribute("aria-controls");
    if($(id) && $(id).hidden) openMenu(id); else closeMenu(true);
    return;
  }

  const toggle = e.target.closest(".split-toggle");
  if(toggle){
    const id = "#" + toggle.getAttribute("aria-controls");
    if($(id) && $(id).hidden) openMenu(id); else closeMenu(true);
    return;
  }
  const el = e.target.closest("[data-cmd]");
  if(!el || el.disabled){
    if(!e.target.closest(".menu")) closeMenu();
    return;
  }
  closeMenu();
  const fn = COMMANDS[el.dataset.cmd];
  if(fn) fn(el);
});
}

export { COMMANDS, bindCommands };
