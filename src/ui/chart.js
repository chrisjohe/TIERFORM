import { computeLayout } from "../app/layout.js";
import { PAGES } from "../engine/constants.js";
import { documentState } from "../model/document.js";
import { groupLabel } from "../model/entities.js";
import { LAYOUTS } from "../model/settings.js";
import { toSVG } from "../render/svg.js";
import { $, el, fill } from "./dom.js";
import { checkLegibility } from "./legibility.js";
import { startView } from "./start.js";

function drawChart(){
  const L = computeLayout(documentState.state);
  if(L.empty){

    $("#sheet").classList.remove("clear");

    $("#sheet").classList.add("start");

    $("#sheet").style.setProperty("--page-ar",
      (PAGES["landscape"].w / PAGES["landscape"].h).toFixed(6));
    fill($("#sheet"), [startView()]);
    $("#hint").textContent = "";
    $("#hintRight").textContent = "";
    $("#previewNote").hidden = true;
    describeChart();
    return;
  }
  $("#sheet").classList.toggle("clear", L.bg === "transparent");
  $("#sheet").classList.remove("start");

  $("#sheet").style.setProperty("--page-ar", (L.page.w / L.page.h).toFixed(6));

  $("#sheet").innerHTML = toSVG(L);

  describeChart();
  const n = documentState.state.people.length;
  $("#hint").textContent = n + (n===1 ? " person" : " people");
  $("#previewNote").hidden = false;
  $("#hintRight").textContent = "· " + L.page.label
    + " · fitted at " + Math.round(L.fit.s*100) + "%";
  checkLegibility(L);
}

function describeChart(){
  const svg = $("#sheet").querySelector("svg");
  const total = documentState.state.people.length;
  const cap = LAYOUTS[documentState.state.layout] || LAYOUTS.pyramid;
  const swim = cap.counts === "lanes";

  const groupCounted = cap.counts !== "grades";
  let drawn = documentState.state.tiers.length;
  if(groupCounted){
    const laneIds = [];
    for(const t of documentState.state.tiers){
      if(t.merge && laneIds.length) laneIds[laneIds.length - 1].push(t.id);
      else laneIds.push([t.id]);
    }
    drawn = total
      ? laneIds.filter(ids => documentState.state.people.some(p => ids.indexOf(p.tierId) >= 0)).length
      : laneIds.length;
  }

  const unit = cap.counts.endsWith("s") && drawn === 1 ? cap.counts.slice(0, -1) : cap.counts;
  const summary = (documentState.state.title || "Team chart") + " — "
    + (swim ? "swimlanes: " + drawn + (drawn === 1 ? " lane" : " lanes")
            : "a " + cap.label.toLowerCase() + " of " + drawn + " " + unit)
    + " and " + total + (total === 1 ? " person" : " people");

  if(svg){
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", summary);
  }

  const host = $("#chartText");
  if(!host) return;
  const list = el("dl");
  for(const t of documentState.state.tiers){
    const people = documentState.state.people.filter(p => p.tierId === t.id);
    list.appendChild(el("dt", {text: t.label + " (" + t.code + ") — "
      + people.length + (people.length === 1 ? " person" : " people")}));
    list.appendChild(el("dd", {text: people.length
      ? people.map(p => { const g = groupLabel(documentState.state, p);
          return (p.name || "unnamed") + (g ? ", " + g : ""); }).join("; ")
      : "nobody"}));
  }
  fill(host, [el("h2", {text: summary}), list]);
}

export { drawChart, describeChart };
