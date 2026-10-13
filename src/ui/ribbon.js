import { drawChart } from "./chart.js";
import { $ } from "./dom.js";
import { closeGradePanel, placeGradePanel } from "./grade-popover.js";
import { closeMenu } from "./menus.js";
import { placePersonMenu } from "./person-menu.js";

function toggleRoster(){
  document.body.classList.toggle("roster-hidden");
  syncRosterToggle();

  if(document.body.classList.contains("roster-hidden") && rosterToggleMQ.matches){
    drawChart();
  }

  closeMenu(); placeGradePanel(); placePersonMenu();
}

function syncRosterToggle(){
  const showing = !document.body.classList.contains("roster-hidden");
  const verb = showing ? "Hide the roster panel" : "Show the roster panel";
  for(const b of document.querySelectorAll('[data-cmd="toggleRoster"]')){

    if(b.hasAttribute("aria-pressed")) b.setAttribute("aria-pressed", String(showing));

    b.dataset.enabledTitle = verb;
    if(!b.disabled) b.title = verb;
  }
}

const rosterToggleMQ = matchMedia("(max-width:900px)");

function syncRibbonOverflow(){
  const body = $(".rb-body");
  let overflow = false;
  for(const pane of document.querySelectorAll(".rb-pane")){
    const measuring = !pane.classList.contains("on");
    if(measuring) pane.classList.add("rb-measure");
    if(pane.scrollWidth > pane.clientWidth + 1) overflow = true;
    if(measuring) pane.classList.remove("rb-measure");
  }
  body.classList.toggle("has-scroll", overflow);
}

function selectTab(name, focusTab){
  document.querySelectorAll(".rb-tab").forEach(t=>{
    const on = t.dataset.tab === name;
    t.classList.toggle("on", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
    t.tabIndex = on ? 0 : -1;
    if(on && focusTab) t.focus();
  });
  document.querySelectorAll(".rb-pane").forEach(p=>p.classList.toggle("on", p.dataset.pane===name));
  syncRibbonOverflow();
  closeMenu();
  closeGradePanel();
}

export { toggleRoster, syncRosterToggle, rosterToggleMQ, syncRibbonOverflow, selectTab };
