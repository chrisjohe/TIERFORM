import { ZOOM_MAX, clampFrame, frameRect } from "../model/framing.js";
import { validatePhoto } from "../model/validation.js";
import { ADD_FRAME_KEY, addDialogState } from "./add-dialog.js";
import { $, el, icon } from "./dom.js";
import { firstName } from "./person-row.js";

const PREVIEW_R = 80;

function bindFramePan(root, {subject, change, sync, end}){
  let pan = null;
  root.addEventListener("pointerdown", e=>{
    const el = e.target.closest('[data-fact="pan"]');
    const p = el && subject(el.dataset.id);
    if(!p) return;
    if(!p.frame) p.frame = {zoom:1, ox:0, oy:0};
    e.preventDefault();
    pan = {id:el.dataset.id, x:e.clientX, y:e.clientY, ox:+p.frame.ox||0, oy:+p.frame.oy||0, el};
    el.classList.add("drag");
    if(el.setPointerCapture) el.setPointerCapture(e.pointerId);
  });
  root.addEventListener("pointermove", e=>{
    const p = pan && subject(pan.id);
    if(!p || !p.frame) return;
    change(p, ()=>{
      p.frame.ox = pan.ox + (e.clientX-pan.x)/PREVIEW_R;
      p.frame.oy = pan.oy + (e.clientY-pan.y)/PREVIEW_R;
      clampFrame(p);
    });
    sync(p);
  });
  for(const event of ["pointerup", "pointercancel"]) root.addEventListener(event, ()=>{
    if(!pan) return;
    pan.el.classList.remove("drag");
    pan = null;
    if(end) end();
  });
}

function framePanel(subj){
  const f = subj.frame || {zoom:1, ox:0, oy:0};
  const zoom = +f.zoom || 1;

  const img = el("img", {cls:"fp-img", attrs:{alt:"", draggable:"false"}});

  const src = validatePhoto(subj.src);
  if(src) img.src = src;

  const zoomLabel = el("b", {text:zoom.toFixed(1) + "×"});
  zoomLabel.dataset.fz = subj.key;

  const who = subj.who;

  const circle = el("button", {type:"button", cls:"fp-circle", fact:"pan", did:subj.key,
    title:"Drag to move the picture, or use the arrow keys",
    label:"Position " + who + "'s photo — drag, or use the arrow keys to nudge it"},
    [img]);

  return el("div", {cls:"frame-ed"}, [
    el("div", {cls:"fp-anchor"}, [
      circle,
      el("div", {cls:"fp-ctl"}, [
        el("span", {cls:"fp-zoom-cap"}, ["Zoom"]),
        el("span", {cls:"fp-zoom-vert"}, [
          el("input", {type:"range", fact:"zoom", did:subj.key, value:String(zoom),
                       label:"Zoom on " + who + "'s photo",
                       attrs:{min:"1", max:String(ZOOM_MAX), step:"0.01"}})
        ]),
        zoomLabel
      ])
    ]),
    el("div", {cls:"btnrow"}, [
      el("button", {fact:"reset",   did:subj.key,
                    label:"Reset the framing of " + who + "'s photo"},
                    [icon("#i-reset-image"), "Reset photo"]),
      el("button", {fact:"replace", did:subj.key,
                    label:"Replace " + who + "'s photo"},
                    [icon("#i-replace-image"), "Replace photo"]),

      el("button", {cls:"danger", fact:"remove", did:subj.key,
                    label:"Remove " + who + "'s photo, leaving " + who + "'s initials"},
                    [icon("#i-delete"), "Remove photo"])
    ])
  ]);
}

function placeFramePreview(img, r){
  img.style.left   = r.x.toFixed(2)+"px";
  img.style.top    = r.y.toFixed(2)+"px";
  img.style.width  = r.w.toFixed(2)+"px";
  img.style.height = r.h.toFixed(2)+"px";
}

function syncFramePreview(p){
  const wrap = $('.fp-circle[data-id="'+p.id+'"]');
  if(!wrap) return;
  const img = wrap.querySelector(".fp-img");
  const r = frameRect(PREVIEW_R, PREVIEW_R, PREVIEW_R, p.pw, p.ph, p.frame);
  placeFramePreview(img, r);
  const lab = $('b[data-fz="'+p.id+'"]');
  if(lab) lab.textContent = (+(p.frame||{}).zoom||1).toFixed(1)+"×";
}

function syncAddFramePreview(){
  if(!addDialogState.addPending) return;
  const root = $("#addModal");
  const wrap = root && root.querySelector
             && root.querySelector('.fp-circle[data-id="'+ADD_FRAME_KEY+'"]');
  if(!wrap) return;
  const img = wrap.querySelector(".fp-img");
  const r = frameRect(PREVIEW_R, PREVIEW_R, PREVIEW_R,
                      addDialogState.addPending.result.w, addDialogState.addPending.result.h, addDialogState.addPending.frame);
  placeFramePreview(img, r);
  const lab = root.querySelector('b[data-fz="'+ADD_FRAME_KEY+'"]');
  if(lab) lab.textContent = (+(addDialogState.addPending.frame||{}).zoom||1).toFixed(1)+"×";
}

function addFrameShim(){
  return {pw: addDialogState.addPending.result.w, ph: addDialogState.addPending.result.h, frame: addDialogState.addPending.frame};
}

function framingLabel(p){
  return "reframed "+firstName(p,"a")+(p.name?"'s":"")+" photo";
}

const PAN_STEP = 0.05;

export { PREVIEW_R, bindFramePan, framePanel, placeFramePreview, syncFramePreview, syncAddFramePreview, addFrameShim, framingLabel, PAN_STEP };
