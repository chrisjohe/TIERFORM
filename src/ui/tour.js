import { photoActionsState } from "../app/photo-actions.js";
import { renderAll } from "../app/render.js";
import { demoDoc } from "../model/demo.js";
import { documentState, newGeneration } from "../model/document.js";
import { clearHistory, commit, endEdit, historyCheckpoint, restoreHistory } from "../model/history.js";
import { $ } from "./dom.js";
import { closeGradePanel } from "./grade-popover.js";
import { closeMenu } from "./menus.js";
import { closePersonMenu } from "./person-menu.js";
import { selectTab } from "./ribbon.js";

const tourState = {
  tourStep: 0,
  tourCount: 0,
  tourCurrent: null
};

const TOUR = [
  {tab:"file", anchor:'[data-cmd="addPeople"]', title:"Add your team",
   body:"One person at a time, a pasted list, or a batch of photos dropped straight onto the canvas. The caret holds the list and CSV routes."},
  {tab:"file", anchor:"#exportMenuBtn", title:"Take it with you",
   body:"PNG, PDF and SVG are drawn from the exact layout you see here; CSV exports the roster as a list."},
  {tab:"file", anchor:"#saveSplit", title:"Your chart is a file",
   body:"A roster is one file on your device. Save copy downloads it; Open brings it back. Nothing is stored anywhere else."},
  {tab:"file", anchor:"#qat", title:"Always at hand",
   body:"Save, undo and redo sit above the tabs, so they never move while you work."},
  {tab:"grades", anchor:"#tiers", title:"The grade ladder",
   body:"Each chip is a band on the chart. Drag to reorder; the caret opens fill, alignment, attach and share."},
  {tab:"grades", anchor:'[data-cmd="groups"]', title:"The second dimension",
   body:"Groups cut across grades in each person's subline. Everywhere they matter wears the 2D badge, and the Matrix layout turns them into rows."},
  {tab:"grades", anchor:"#roster", title:"The roster",
   body:"Everyone on the chart, in drawing order. Edit details, photos and order here, or search to find someone fast."},
  {tab:"design", anchor:"#sheet", title:"A print preview",
   body:"The canvas shows the finished page, fitted to your window. It is a preview, not a form: nothing on it can be clicked or dragged. All editing happens in the roster and the ribbon."},
  {tab:"design", anchor:"#layoutBtn", title:"One roster, six layouts",
   body:"We just switched the sample to Swimlanes: same people, same order, reflowed. Switching back loses nothing.",
   run:()=>{ commit("switched the sample to Swimlanes", ()=>{ documentState.state.layout = "swimlanes"; }, {render:"all"}); }},
  {tab:"design", anchor:"#pageBtn", title:"Pick the paper",
   body:"We just turned the page to portrait: the chart refits itself to whatever paper you pick, and exports print at full quality.",
   run:()=>{ commit("turned the sample to portrait", ()=>{ documentState.state.page = "portrait"; }, {render:"all"}); }},
  {tab:"design", anchor:"#nameLabelsBtn", title:"Name labels",
   body:"The sample's names just moved below the photos. On a crowded chart, changing the position is an easy way to make room.",
   run:()=>{ commit("moved the sample's name labels below the photos", ()=>{ documentState.state.nameLabelPosition = "below"; }, {render:"all"}); }},
  {tab:"design", anchor:"#accentBtn", title:"Your colours",
   body:"The accent fills the bands. Any colour is allowed; if text gets hard to read, the app warns you but never refuses."},
  {tab:"file", anchor:'[data-cmd="tour"]', title:"That's the tour",
   body:"Your own roster is back the moment this card closes. Take the tour again from here any time."}
];

function tourLiveSteps(){
  return TOUR.filter(row => {
    selectTab(row.tab, false);
    const el = document.querySelector(row.anchor);
    if(!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  });
}

function tourGoto(i){
  documentState.state = demoDoc();
  clearHistory();
  documentState.docName = "";
  documentState.dirtyDoc = false;
  const steps = tourLiveSteps();
  if(!steps.length){ endTour(); return; }
  i = Math.max(0, Math.min(i, steps.length - 1));
  for(let k = 0; k <= i; k++) if(steps[k].run) steps[k].run();
  tourState.tourStep = i;
  tourState.tourCount = steps.length;
  renderAll();
  showTourStep(steps[i], i, steps.length);
}

function startTour(){
  if(document.querySelector(".modal-backdrop:not([hidden])")) return false;
  if(photoActionsState.importBusy) return false;
  if(documentState.tourSaved !== null) return false;

  closeMenu(false);
  closeGradePanel(false);
  closePersonMenu(false);
  endEdit();
  newGeneration();

  documentState.tourSaved = {state: documentState.state, ...historyCheckpoint(), docName: documentState.docName, dirtyDoc: documentState.dirtyDoc};
  document.body.classList.add("tour-on");
  tourGoto(0);
  return true;
}

function endTour(){
  if(documentState.tourSaved === null) return;
  endEdit();
  newGeneration();
  documentState.state          = documentState.tourSaved.state;
  restoreHistory(documentState.tourSaved);
  documentState.docName        = documentState.tourSaved.docName;
  documentState.dirtyDoc       = documentState.tourSaved.dirtyDoc;
  documentState.tourSaved = null;
  tourState.tourCurrent = null;
  document.body.classList.remove("tour-on");
  renderAll();
}

function showTourStep(step, pos, count){
  selectTab(step.tab, false);
  tourState.tourCurrent = step;

  $("#tourTitle").textContent = step.title;
  $("#tourBody").textContent  = step.body;
  $("#tourCount").textContent = "Step " + (pos + 1) + " of " + count;
  $("#tourBack").disabled = pos === 0;
  $("#tourNext").textContent = pos + 1 < count ? "Next" : "Done";

  placeTour();
  $("#tourNext").focus({preventScroll:true});
}

function placeTour(){
  if(!documentState.tourSaved || !tourState.tourCurrent) return;
  const step = tourState.tourCurrent;

  const anchor = document.querySelector(step.anchor);
  const r = anchor.getBoundingClientRect();
  const pad = 4;
  const ring = $("#tourRing");
  ring.style.left   = (r.left - pad) + "px";
  ring.style.top    = (r.top - pad) + "px";
  ring.style.width  = (r.width + pad * 2) + "px";
  ring.style.height = (r.height + pad * 2) + "px";

  const margin = 8;
  const card = $("#tourCard");
  const cr = card.getBoundingClientRect();
  const below = r.bottom + 12;
  let top = below + cr.height <= window.innerHeight - margin
    ? below
    : r.top - cr.height - 12;
  top = Math.min(Math.max(top, margin), window.innerHeight - cr.height - margin);
  const left = Math.min(Math.max(r.left, margin), window.innerWidth - cr.width - margin);
  card.style.top  = top + "px";
  card.style.left = left + "px";
}

export { tourState, TOUR, tourLiveSteps, tourGoto, startTour, endTour, showTourStep, placeTour };
