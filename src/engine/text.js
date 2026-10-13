import { nameSegs, subline } from "../model/labels.js";
import { docFont } from "../model/settings.js";

function createTextMetrics(meas){
function personLabelWidth(st, p, lookup){
  const F = docFont(st);
  let w = 0;
  if(st.showPersonName !== false){
    for(const seg of nameSegs(st, p.name)){
      meas.font = seg.w + " 15px " + F;
      w += meas.measureText(seg.t).width;
    }
  }
  meas.font = "400 11px " + F;
  const sub = subline(st, p, lookup);
  return Math.max(w, sub ? meas.measureText(sub).width : 0);
}

function headNeedWidth(st){
  const F = docFont(st);
  meas.font = "700 25px " + F;
  return meas.measureText(st.title || "").width
       + (st.brand && st.brand.trim() ? meas.measureText(st.brand.trim()).width + 60 : 0) + 70;
}

function gradeHeadingTexts(st, tiers, x, cy, maxW, ink, soloCodeSize){
  const F = docFont(st);
  const codeOn = st.showGradeCode !== false;
  const nameOn = st.showGradeName === true;
  if(!codeOn && !nameOn) return [];
  const code = tiers.map(t => t.code || "").join(" / ");
  const name = tiers.map(t => t.label || "").join(" / ");
  if(codeOn && nameOn) return [
    {x, y:cy-10, anchor:"middle", baseline:"middle",
     segs:[{t:ellipsize(code, maxW, "700 18px " + F), w:700}], size:18, color:ink},
    {x, y:cy+10, anchor:"middle", baseline:"middle",
     segs:[{t:ellipsize(name, maxW, "600 12px " + F), w:600}], size:12, color:ink}
  ];
  if(codeOn) return [{x, y:cy, anchor:"middle", baseline:"middle",
    segs:[{t:ellipsize(code, maxW, "700 " + soloCodeSize + "px " + F), w:700}],
    size:soloCodeSize, color:ink}];
  return [{x, y:cy, anchor:"middle", baseline:"middle",
    segs:[{t:ellipsize(name, maxW, "600 14px " + F), w:600}], size:14, color:ink}];
}

function fitName(segs, maxW, font){
  if(segs.length < 2){
    const only = segs[0] || {t:"", w:400};
    const fnt = only.w + " 15px " + font;
    meas.font = fnt;
    if(meas.measureText(only.t).width <= maxW) return [{t:only.t, w:only.w}];
    return [{t:ellipsize(only.t, maxW, fnt), w:only.w}];
  }
  const first = segs[0], last = segs[1];
  const firstFont = first.w + " 15px " + font, lastFont = last.w + " 15px " + font;
  meas.font = firstFont;
  const firstW = meas.measureText(first.t).width;
  meas.font = lastFont;
  if(firstW + meas.measureText(last.t).width <= maxW)
    return [{t:first.t, w:first.w}, {t:last.t, w:last.w}];
  if(firstW <= maxW)
    return [{t:first.t, w:first.w}, {t:ellipsize(last.t, maxW - firstW, lastFont), w:last.w}];
  return [{t:ellipsize(first.t, maxW, firstFont), w:first.w}, {t:"", w:last.w}];
}

function ellipsize(text, maxW, font){
  const s = String(text == null ? "" : text);
  meas.font = font;
  if(!s || meas.measureText(s).width <= maxW) return s;
  let lo = 0, hi = s.length;
  while(lo < hi){
    const mid = Math.ceil((lo + hi)/2);
    if(meas.measureText(s.slice(0, mid) + "…").width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? s.slice(0, lo) + "…" : "…";
}
return {personLabelWidth, headNeedWidth, gradeHeadingTexts, fitName, ellipsize};
}

export { createTextMetrics };
