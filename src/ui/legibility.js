import { G } from "../engine/constants.js";
import { documentState } from "../model/document.js";
import { LAYOUTS } from "../model/settings.js";
import { $ } from "./dom.js";

const NAME_PT = 15;

const MIN_NAME_PT = 6;

const MIN_FACE_PT = 9;

function checkLegibility(L){
  const bar = $("#legibility");
  if(!bar) return;
  const namePt = NAME_PT * L.fit.s;
  const facePt = 2 * G.avaR * L.fit.s;
  const personTextOn = documentState.state.showPersonName !== false
    || documentState.state.showPersonGrade !== false || documentState.state.showPersonGroup !== false;
  const textBad = personTextOn && namePt < MIN_NAME_PT;
  const faceBad = facePt < MIN_FACE_PT;
  if(!documentState.state.people.length || (!textBad && !faceBad)){
    bar.hidden = true; bar.textContent = "";
    return;
  }

  const cap = LAYOUTS[documentState.state.layout] || LAYOUTS.pyramid;
  const swim = cap.grows === "across";
  const deepest = Math.max(0, ...documentState.state.tiers.map(t =>
    documentState.state.people.filter(p => p.tierId === t.id).length));
  const laneCount = documentState.state.tiers.filter(t => documentState.state.people.some(p => p.tierId === t.id)).length;
  const fixes = [];

  const portrait  = L.page.h > L.page.w;
  const landscape = L.page.w > L.page.h;
  if(swim){

    if(portrait && laneCount > 4) fixes.push("turn the page to landscape");
    else if(landscape && deepest > 6) fixes.push("turn the page to portrait");
    if(documentState.state.density !== "tight") fixes.push("set spacing to tight");
    if(deepest > 8) fixes.push("move people out of the " + deepest + "-person " + cap.surface);
    if(laneCount > 8) fixes.push("empty a " + cap.surface + " — " + laneCount + " of them are drawn");
    if(!fixes.length) fixes.push("remove a " + cap.surface + " or move people between " + cap.surface + "s");
  }else{
    if(landscape && deepest > 6) fixes.push("turn the page to portrait");
    else if(portrait) fixes.push("turn the page to landscape");
    if(documentState.state.density !== "tight") fixes.push("set spacing to tight");
    if(deepest > 8) fixes.push("split the " + deepest + "-person grade across two");
    if(!fixes.length) fixes.push("remove a grade or move people between grades");
  }

  bar.hidden = false;
  const problem = textBad
    ? "Text is about " + namePt.toFixed(1) + "pt on the printed page — too small to read"
    : "Photos are about " + facePt.toFixed(1) + "pt on the printed page — too small to recognise";
  bar.textContent = problem + ". Try: " + fixes.join(", ") + ".";
}

export { NAME_PT, MIN_NAME_PT, MIN_FACE_PT, checkLegibility };
