import { documentState } from "../model/document.js";
import { $, clear, el } from "./dom.js";

function fillTierOptions(select, sel){
  clear(select);
  for(const t of documentState.state.tiers){
    const o = el("option", {value:t.id, text:t.label});
    if(t.id === sel) o.selected = true;
    select.appendChild(o);
  }
  return select;
}

function fillGroupOptions(){
  const dl = $("#groupOptions");
  if(!dl) return;
  clear(dl);
  for(const g of documentState.state.groups){
    dl.appendChild(el("option", {value:g.label}));
  }
}

function firstTierId(){ return (documentState.state.tiers[0] || {}).id; }

export { fillTierOptions, fillGroupOptions, firstTierId };
