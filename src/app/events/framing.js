import { photosState } from "./photos.js";
import { documentState } from "../../model/document.js";
import { clampFrame } from "../../model/framing.js";
import { commit, edit, endEdit } from "../../model/history.js";
import { applyPhoto } from "../../model/photos.js";
import { $ } from "../../ui/dom.js";
import { PAN_STEP, bindFramePan, framingLabel, syncFramePreview } from "../../ui/framing.js";
import { firstName } from "../../ui/person-row.js";

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

bindFramePan($("#editModal"), {
  subject(id){
    const p = documentState.state.people.find(x => x.id === id);
    return p && p.photo ? p : null;
  },
  change(p, mutate){ edit("frame:"+p.id, framingLabel(p), mutate); },
  sync: syncFramePreview,
  end: endEdit
});
}

export { bindFramingEvents };
