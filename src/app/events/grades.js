import { move, reorderGrade } from "../grade-actions.js";
import { documentState } from "../../model/document.js";
import { normalizeGradeLinks } from "../../model/entities.js";
import { commit, edit } from "../../model/history.js";
import { LIMITS } from "../../model/settings.js";
import { clampText } from "../../model/validation.js";
import { $ } from "../../ui/dom.js";
import { makeDragSurface } from "../../ui/drag-surface.js";
import { closeGradePanel, gradePopoverState, openGradePanel } from "../../ui/grade-popover.js";
import { toast } from "../../ui/notifications.js";
import { renderRoster } from "../../ui/roster.js";

const gradeDragSurface = makeDragSurface({
  root: "#tiers",
  itemSelector: ".g-chip",
  slotClass: "g-drop-slot",
  axis: "x",
  excludePress: ".g-chip-toggle",
  resolveAim(node){
    const chip = node && node.closest && node.closest(".g-chip");
    return chip ? {item:chip, after:null} : null;
  },
  onBegin: closeGradePanel,
  onDrop: reorderGrade
});

function bindGradesEvents(){
$("#tiers").addEventListener("click", e=>{
  if(gradeDragSurface.clickSuppressed()) return;
  const chip = e.target.closest("button[data-tact]"); if(!chip) return;
  const act = chip.dataset.tact;
  if(act==="open"){
    if(gradePopoverState.gradeOpen === chip.dataset.id) closeGradePanel(true);
    else openGradePanel(chip.dataset.id);
  }
});

$("#gradePanel").addEventListener("input", e=>{
  const el=e.target, act=el.dataset.tact, id=el.dataset.id;
  if(!act||!id) return;
  const t=documentState.state.tiers.find(x=>x.id===id); if(!t) return;
  if(act==="code"||act==="label"){

    edit(act+":"+id, "renamed grade "+t.label, ()=>{ t[act]=clampText(el.value,LIMITS.text); },
         {onEnd: renderRoster});
  }

});

$("#gradePanel").addEventListener("click", e=>{
  const el=e.target.closest("button[data-tact]"); if(!el) return;
  const act=el.dataset.tact, i=documentState.state.tiers.findIndex(x=>x.id===el.dataset.id);
  if(i<0) return;

  if(act==="fill"||act==="align"){
    const t=documentState.state.tiers[i], want=el.dataset.value;
    if(t[act]===want) return;
    commit("restyled grade "+t.label, ()=>{ t[act]=want; }, {render:"chart"});

    const group = el.closest(".gopts");
    if(group) for(const b of group.querySelectorAll(".gopt"))
      b.setAttribute("aria-checked", String(b.dataset.value === want));
    return;
  }

  if(act==="attach"||act==="merge"){
    const t=documentState.state.tiers[i], on=!t[act];
    if(act==="attach") commit((on?"attached ":"detached ")+t.label, ()=>{
      t.attach = on;
      if(!on) t.merge = false;
      normalizeGradeLinks(documentState.state.tiers);
    }, {render:"chart"});
    else commit((on?"shared a band with ":"unshared ")+t.label, ()=>{
      t.merge = on;
      normalizeGradeLinks(documentState.state.tiers);
    }, {render:"chart"});

    const row = el.closest(".gopts");
    if(row) for(const b of row.querySelectorAll("button[data-tact]"))
      b.setAttribute("aria-pressed", String(!!t[b.dataset.tact]));
    return;
  }

  if(act==="up"||act==="down"){
    commit("moved grade "+documentState.state.tiers[i].label, ()=>{
      move(documentState.state.tiers,i,act==="up"?-1:1);
      normalizeGradeLinks(documentState.state.tiers);
    });
  }
  if(act==="del"){
    if(documentState.state.tiers.length<2) return toast("Keep at least one grade");
    const count = documentState.state.people.filter(p=>p.tierId===documentState.state.tiers[i].id).length;
    if(count) return toast("Move those "+count+" people to another grade first");

    commit("removed grade "+documentState.state.tiers[i].label, ()=>{
      documentState.state.tiers.splice(i,1);
      normalizeGradeLinks(documentState.state.tiers);
    });
  }
});

$("#gradePanelClose").addEventListener("click", ()=>closeGradePanel(true));
}

export { gradeDragSurface, bindGradesEvents };
