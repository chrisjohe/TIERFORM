import { photosState } from "./photos.js";
import { documentState } from "../../model/document.js";
import { clampFrame } from "../../model/framing.js";
import { commit, edit, endEdit } from "../../model/history.js";
import { applyPhoto } from "../../model/photos.js";
import { $ } from "../../ui/dom.js";
import { PAN_STEP, PREVIEW_R, framingLabel, syncFramePreview } from "../../ui/framing.js";
import { firstName } from "../../ui/person-row.js";

const framingState = {
  panS: null
};

function bindFramingEvents(){
$("#editModal").addEventListener("click", e=>{
  const el=e.target.closest("[data-fact]"); if(!el) return;
  const act=el.dataset.fact;
  const p=documentState.state.people.find(x=>x.id===el.dataset.id); if(!p) return;
  if(act==="replace"){ photosState.swapId=p.id; $("#fileSwap").click(); }

  if(act==="remove"){
    commit("removed "+firstName(p,"the")+(p.name?"'s":"")+" photo",
      ()=>applyPhoto(p, null));

    const first = $("#editPhoto").querySelector("button:not([disabled])");
    if(first) first.focus();
  }
  if(act==="reset"){
    commit("reset "+firstName(p,"the")+(p.name?"'s":"")+" framing", ()=>{
      p.frame = {zoom:1, ox:0, oy:0};
    }, {render:"chart"});
    const sl=$('input[data-fact="zoom"][data-id="'+p.id+'"]'); if(sl) sl.value = 1;
    syncFramePreview(p);
  }
});

$("#editModal").addEventListener("input", e=>{
  const el=e.target;
  if(el.dataset.fact!=="zoom") return;
  const p=documentState.state.people.find(x=>x.id===el.dataset.id); if(!p||!p.frame) return;
  edit("frame:"+p.id, framingLabel(p), ()=>{
    p.frame.zoom = +el.value;
    clampFrame(p);
  });
  syncFramePreview(p);
});

$("#editModal").addEventListener("keydown", e=>{
  const el = e.target.closest && e.target.closest('[data-fact="pan"]');
  if(!el) return;
  const dir = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]}[e.key];
  if(!dir) return;
  const p = documentState.state.people.find(x=>x.id===el.dataset.id);
  if(!p || !p.photo) return;
  e.preventDefault();
  if(!p.frame) p.frame = {zoom:1, ox:0, oy:0};
  const step = PAN_STEP * (e.shiftKey ? 4 : 1);
  edit("frame:"+p.id, framingLabel(p), ()=>{
    p.frame.ox = (+p.frame.ox || 0) + dir[0]*step;
    p.frame.oy = (+p.frame.oy || 0) + dir[1]*step;
    clampFrame(p);
  });
  syncFramePreview(p);
});

$("#editModal").addEventListener("pointerdown", e=>{
  const el=e.target.closest('[data-fact="pan"]'); if(!el) return;
  const p=documentState.state.people.find(x=>x.id===el.dataset.id); if(!p||!p.photo) return;
  if(!p.frame) p.frame={zoom:1, ox:0, oy:0};
  e.preventDefault();
  framingState.panS={id:p.id, x:e.clientX, y:e.clientY, ox:+p.frame.ox||0, oy:+p.frame.oy||0, el};
  el.classList.add("drag");
  if(el.setPointerCapture) el.setPointerCapture(e.pointerId);
});

$("#editModal").addEventListener("pointermove", e=>{
  if(!framingState.panS) return;
  const p=documentState.state.people.find(x=>x.id===framingState.panS.id); if(!p||!p.frame) return;
  edit("frame:"+p.id, framingLabel(p), ()=>{

    p.frame.ox = framingState.panS.ox + (e.clientX-framingState.panS.x)/PREVIEW_R;
    p.frame.oy = framingState.panS.oy + (e.clientY-framingState.panS.y)/PREVIEW_R;
    clampFrame(p);
  });
  syncFramePreview(p);
});

["pointerup","pointercancel"].forEach(ev=>$("#editModal").addEventListener(ev, ()=>{
  if(!framingState.panS) return;
  framingState.panS.el.classList.remove("drag");
  framingState.panS=null;
  endEdit();
}));
}

export { framingState, bindFramingEvents };
