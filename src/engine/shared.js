import { G, SW } from "./constants.js";
import { frameRect } from "../model/framing.js";
import { labelIndex } from "../model/indexes.js";
import { initials, nameSegs, subline } from "../model/labels.js";
import { docFont } from "../model/settings.js";

function gridGroups(st){
  const groups = [], byTier = new Map();
  st.tiers.forEach((t, index) => {
    if(t.merge && groups.length){
      const group = groups[groups.length - 1];
      group.tiers.push(t);
      group.lastIndex = index;
    }else groups.push({t, tiers:[t], index, lastIndex:index, people:[]});
    if(!byTier.has(t.id)) byTier.set(t.id, new Set());
    byTier.get(t.id).add(groups[groups.length - 1]);
  });
  // Grid layouts preserve roster order across merged grades. Bands preserve
  // grade order instead; their grouping deliberately stays separate.
  for(const p of st.people){
    for(const group of byTier.get(p.tierId) || []) group.people.push(p);
  }
  return groups.some(g => g.people.length) ? groups.filter(g => g.people.length) : groups;
}

function pageFit(page, natW, natH){
  const availW = page.w - 2*G.margin, availH = page.h - 2*G.margin;
  const s = Math.min(availW/natW, availH/natH);
  return {tx:G.margin + (availW - natW*s)/2, ty:G.margin + (availH - natH*s)/2, s};
}

function rect(x, y, w, h){ return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]; }

function emitHeaderTexts(st, hL, hR){
  const texts = [{x:hL+30, y:G.bandH/2, anchor:"start", baseline:"middle",
    segs:[{t:st.title||"", w:600}], size:25, color:st.inkOnColour}];
  if(st.brand && st.brand.trim()){
    texts.push({x:hR-24, y:G.bandH/2, anchor:"end", baseline:"middle",
      segs:[{t:st.brand.trim(), w:700}], size:26, color:st.inkOnColour});
  }
  return texts;
}

function emitAvatar(p, cx, cy){
  return {cx, cy, r:G.avaR, src:p.photo || null, ini:initials(p.name),
    img:p.photo ? frameRect(cx, cy, G.avaR, p.pw, p.ph, p.frame) : null};
}

function createGridHelpers(meas, {personLabelWidth, headNeedWidth, fitName, ellipsize}){
  function laneGeometry(st){
    const F = docFont(st), lookup = labelIndex(st), lanes = gridGroups(st);
    const namesNext = st.nameLabelPosition === "next";
    const personNameOn = st.showPersonName !== false;
    const personSublineOn = st.showPersonGrade !== false || st.showPersonGroup !== false;
    const personTextOn = personNameOn || personSublineOn;
    let need = SW.laneMin;
    for(const lane of lanes){
      if(st.showGradeCode !== false){
        meas.font = "700 19px " + F;
        need = Math.max(need, meas.measureText(lane.tiers.map(t => t.code || "").join(" / ")).width + 2*SW.padX);
      }
      if(st.showGradeName === true){
        meas.font = "600 14px " + F;
        need = Math.max(need, meas.measureText(lane.tiers.map(t => t.label || "").join(" / ")).width + 2*SW.padX);
      }
      for(const p of lane.people){
        need = Math.max(need, personLabelWidth(st, p, lookup) + 2*SW.padX
          + (namesNext && personTextOn ? 2*G.avaR + G.gapAva : 0));
      }
    }
    const laneW = Math.max(SW.laneMin, Math.min(SW.laneMax, Math.ceil(need)));
    const belowTextDy = personNameOn && personSublineOn ? SW.subDy : (personTextOn ? SW.nameDy : 0);
    const cellH = namesNext ? 2*G.avaR : 2*G.avaR + belowTextDy;
    const headNeed = headNeedWidth(st);
    const gapBefore = lanes.map((lane, i) => i === 0 ? 0
      : (lane.t.attach && lane.index === lanes[i-1].lastIndex + 1 ? 0 : SW.laneGap));
    const gridW = lanes.length ? lanes.length*laneW + gapBefore.reduce((sum, gap) => sum + gap, 0) : headNeed;
    const laneTop = G.bandH + SW.headGap, rowTop = laneTop + SW.headH + SW.headGap;
    return {F, lookup, lanes, namesNext, personNameOn, personTextOn, laneW, cellH, headNeed, gapBefore, gridW, laneTop, rowTop};
  }

  function emitGridLabels(st, p, F, x, nameY, subY, anchor, textW, ink, mute, sub){
    const texts = [];
    if(st.showPersonName !== false){
      texts.push({x, y:nameY, anchor, baseline:"alphabetic",
        segs:fitName(nameSegs(st, p.name), textW, F), size:15, color:ink});
    }
    if(sub){
      texts.push({x, y:subY, anchor, baseline:"alphabetic",
        segs:[{t:ellipsize(sub, textW, "400 11px " + F), w:400}],
        size:11, color:mute, tracking:.2});
    }
    return texts;
  }

  function emitLanePerson(st, ctx, p, x0, top, ink, mute, avatars, texts){
    const {F, lookup, laneW, namesNext, personNameOn, personTextOn} = ctx;
    const cx = x0 + laneW/2, acy = top + G.avaR;
    const acx = namesNext && personTextOn ? x0 + SW.padX + G.avaR : cx;
    avatars.push(emitAvatar(p, acx, acy));
    const sub = subline(st, p, lookup);
    const x = namesNext ? acx + G.avaR + G.gapAva : cx;
    texts.push(...emitGridLabels(st, p, F, x,
      namesNext ? (sub ? acy-3 : acy+5) : top + 2*G.avaR + SW.nameDy,
      namesNext ? (personNameOn ? acy+14 : acy+4) : top + 2*G.avaR + (personNameOn ? SW.subDy : SW.nameDy),
      namesNext ? "start" : "middle",
      namesNext ? Math.max(0, x0 + laneW - SW.padX - x) : laneW - 2*SW.padX,
      ink, mute, sub));
  }
  return {laneGeometry, emitGridLabels, emitLanePerson};
}

export { gridGroups, pageFit, rect, emitHeaderTexts, emitAvatar, createGridHelpers };
