import { ANGLES, DENSITY, G, PAGES } from "./constants.js";
import { emitHeaderTexts, pageFit, rect } from "./shared.js";
import { labelIndex, peopleBy } from "../model/indexes.js";
import { angleIndex } from "./helpers.js";
import { frameRect } from "../model/framing.js";
import { initials, nameSegs, subline } from "../model/labels.js";
import { docFont } from "../model/settings.js";
import { withAlpha } from "../render/colour.js";

function createBandLayouts(meas, {personLabelWidth, headNeedWidth, gradeHeadingTexts, fitName, ellipsize}){
function buildBandGroups(st){
  const tiers = st.tiers;
  const lookup = labelIndex(st), byTier = peopleBy(st.people, "tierId");

  const groups = [];
  tiers.forEach(t=>{
    const ppl = (byTier.get(t.id) || []);
    if(t.merge && groups.length){
      const g = groups[groups.length-1];
      g.tiers.push(t);
      g.people = g.people.concat(ppl);
    }else{
      groups.push({t, tiers:[t], people:ppl});
    }
  });
  const personNameOn = st.showPersonName !== false;
  const personSublineOn = st.showPersonGrade !== false || st.showPersonGroup !== false;
  const personTextOn = personNameOn || personSublineOn;

  const below = personTextOn && st.nameLabelPosition === "below";

  let need = (personTextOn && !below) ? 232 : 2*G.avaR + 20;
  for(const g of groups) for(const p of g.people){
    const labelNeed = personLabelWidth(st, p, lookup);

    need = Math.max(need, below
      ? Math.max(2*G.avaR, labelNeed) + G.belowPadX
      : 2*G.avaR + (labelNeed ? G.gapAva + labelNeed : 0) + 20);
  }
  const personW = (personTextOn && !below)
    ? Math.max(232, Math.min(330, Math.ceil(need)))
    : Math.ceil(Math.min(below ? 330 : Infinity, need));

  const headNeed = headNeedWidth(st);

  let labelW = 0;
  if(st.showGradeCode !== false || st.showGradeName === true){
    labelW = G.labelW;
    if(st.showGradeName === true){
      const F = docFont(st);
      meas.font = "600 14px " + F;
      for(const g of groups){
        const name = g.tiers.map(t => t.label || "").join(" / ");
        labelW = Math.max(labelW, Math.min(190, Math.ceil(meas.measureText(name).width + 18)));
      }
    }
  }

  const leftInset = labelW || G.padRight;

  const contentW = groups.map(g => leftInset + g.people.length*personW + G.padRight);

  return {groups, lookup, below, personNameOn, personSublineOn, personTextOn,
          personW, headNeed, labelW, leftInset, contentW};
}

function buildBandStack(st, ctx){
  const {groups, below, personNameOn, personSublineOn} = ctx;

  const baseGap = G.bandH * (DENSITY[st.density] || DENSITY.balanced);

  const labelDrop = below
    ? (G.avaR - G.bandH/2)
      + (personNameOn ? G.belowName : 0)
      + (personSublineOn ? (personNameOn ? G.belowSub : G.belowName) : 0)
      + G.belowTail
    : 0;

  const gap = below ? Math.max(baseGap, labelDrop + G.belowBreathe) : baseGap;

  const ys = [];
  let y = G.bandH + gap;
  groups.forEach((g,i)=>{
    if(i>0) y += (g.t.attach ? 0 : gap);
    ys.push(y);
    y += G.bandH;
  });

  const natH = y + labelDrop;
  return {ys, natH, gap, labelDrop};
}

function emitBandPeople(st, ctx, i, y0, L0, R0, prevGroupX0){
  const {groups, lookup, labelW, leftInset, personW, below, personNameOn, personSublineOn, personTextOn} = ctx;
  const g = groups[i];
  const cy = y0 + G.bandH/2;
  const white = g.t.fill === "white";
  const ink   = white ? st.inkOnWhite : st.inkOnColour;
  const mute  = withAlpha(ink, white ? 0.62 : 0.85);

  let labelInk = ink, labelMute = mute;
  if(below){
    const under = groups[i+1];
    const onWhite = (under && under.t.attach) ? under.t.fill === "white" : true;
    labelInk  = onWhite ? st.inkOnWhite : st.inkOnColour;
    labelMute = withAlpha(labelInk, onWhite ? 0.62 : 0.85);
  }

  const texts = [];

  texts.push(...gradeHeadingTexts(st, g.tiers, L0 + labelW/2, cy,
    Math.max(0, labelW - 12), ink, 24));

  const peopleL = L0 + leftInset;
  const avail = (R0 - G.padRight) - peopleL;
  const slack = Math.max(0, avail - g.people.length*personW);
  const off   = g.t.align==="left" ? 0 : (g.t.align==="right" ? slack : slack/2);
  const x0    = peopleL + off;

  let x0Final = x0;
  if(i>0 && g.t.attach && g.t.align==="center" && g.people.length && groups[i-1].people.length){
    const n   = g.people.length;
    const phi = (((x0 - prevGroupX0) % personW) + personW) % personW;
    const dmin = Math.min(phi, personW - phi);
    const CLEAR = below
      ? Math.min(personW/2, Math.ceil(
          groups[i-1].people.reduce((m,p)=>Math.max(m, personLabelWidth(st,p,lookup)), 0)/2
          + G.avaR))
      : Math.ceil(Math.sqrt((2*G.avaR)**2 - G.bandH**2));
    if(dmin < CLEAR){
      const lo = peopleL - x0;
      const hi = (R0 - G.padRight - n*personW) - x0;
      const clamp = s => Math.max(lo, Math.min(hi, s));
      const c0 = x0 + clamp(personW/2 - phi);
      const c1 = x0 + clamp(personW/2 - phi - personW);
      const distAt = px => {
        const q = (((px - prevGroupX0) % personW) + personW) % personW;
        return Math.min(q, personW - q);
      };
      const d0 = distAt(c0), d1 = distAt(c1);
      x0Final = (d1 > d0) ? c1 : (d0 > d1) ? c0 : Math.max(c0, c1);
    }
  }

  const avatars = [];
  g.people.forEach((p,j)=>{
    const acx = x0Final + j*personW + ((personTextOn && !below) ? G.avaR + 4 : personW/2);
    avatars.push({cx:acx, cy, r:G.avaR, src:p.photo||null, ini:initials(p.name),
                  img: p.photo ? frameRect(acx, cy, G.avaR, p.pw, p.ph, p.frame) : null});
    const sub = subline(st, p, lookup), subOn = !!sub;

    const tx2 = below ? acx : acx + G.avaR + G.gapAva;
    const anchor = below ? "middle" : "start";
    const nameY = below ? cy + G.avaR + G.belowName : (subOn ? cy-3 : cy+5);
    const subY  = below
      ? cy + G.avaR + (personNameOn ? G.belowName + G.belowSub : G.belowName)
      : (personNameOn ? cy+14 : cy+4);
    if(personNameOn){
      texts.push({x:tx2, y:nameY, anchor:anchor, baseline:"alphabetic",
                  segs:nameSegs(st, p.name),
                  size:15, color:labelInk});
    }
    if(subOn){
      texts.push({x:tx2, y:subY, anchor:anchor, baseline:"alphabetic",
                  segs:[{t:sub, w:400}], size:11,
                  color: labelMute, tracking:.2});
    }
  });

  return {texts, avatars, x0Final};
}

function computeTriangleLayout(st, dir){
  const F = docFont(st);
  const page  = PAGES[st.page] || PAGES["landscape"];
  const ctx = buildBandGroups(st);
  const {groups, contentW} = ctx;
  const k = ANGLES[angleIndex(st.angle)];

  const {ys, natH} = buildBandStack(st, ctx);

  let aHalf = ctx.headNeed/2;
  ys.forEach((y0,i)=>{
    const yNarrow = dir > 0 ? y0 : y0 + G.bandH;
    aHalf = Math.max(aHalf, contentW[i]/2 - dir*k*yNarrow);
  });

  const b = {ys, natH, a:aHalf, natW: 2*(aHalf + Math.max(0, dir*k*natH))};

  const fit = pageFit(page, b.natW, b.natH);

  const cx    = b.natW/2;
  const halfW = y => b.a + dir*k*y;
  const slice = (y0,h) => {
    const y1 = y0+h, w0 = halfW(y0), w1 = halfW(y1);
    return [[cx-w0,y0],[cx+w0,y0],[cx+w1,y1],[cx-w1,y1]];
  };

  const bands=[], avatars=[], texts=[];

  bands.push({pts:slice(0,G.bandH), fill:"green"});
  const hL = cx-halfW(0), hR = cx+halfW(0);
  texts.push(...emitHeaderTexts(st, hL, hR));

  let prevGroupX0 = null;
  groups.forEach((g,i)=>{
    const y0 = b.ys[i];
    bands.push({pts:slice(y0,G.bandH), fill:g.t.fill});

    const yNarrow = dir > 0 ? y0 : y0 + G.bandH;
    const L0 = cx - halfW(yNarrow), R0 = cx + halfW(yNarrow);

    const res = emitBandPeople(st, ctx, i, y0, L0, R0, prevGroupX0);
    texts.push(...res.texts);
    avatars.push(...res.avatars);
    prevGroupX0 = res.x0Final;
  });

  return {page, fit, bands, texts, avatars,
          accent:st.accent, ring:st.ring, bg:st.bg, font:F, empty:!groups.length, natW:b.natW, natH:b.natH, angle:k};
}

function computePyramidLayout(st){ return computeTriangleLayout(st, 1); }

function computeTornadoLayout(st){ return computeTriangleLayout(st, -1); }

function computeHistogramLayout(st){
  const F = docFont(st);
  const page = PAGES[st.page] || PAGES["landscape"];
  const ctx = buildBandGroups(st);
  const {groups, contentW} = ctx;

  const {ys, natH} = buildBandStack(st, ctx);

  const natW = Math.max(ctx.headNeed, ...contentW);

  const fit = pageFit(page, natW, natH);


  const bands=[], avatars=[], texts=[];

  bands.push({pts:rect(0,0,natW,G.bandH), fill:"green"});
  texts.push(...emitHeaderTexts(st, 0, natW));

  let prevGroupX0 = null;
  groups.forEach((g,i)=>{
    const y0 = ys[i], w = contentW[i];

    const x0 = g.t.align==="left" ? 0 : (g.t.align==="right" ? natW - w : (natW - w)/2);
    bands.push({pts:rect(x0,y0,w,G.bandH), fill:g.t.fill});

    const res = emitBandPeople(st, ctx, i, y0, x0, x0 + w, prevGroupX0);
    texts.push(...res.texts);
    avatars.push(...res.avatars);
    prevGroupX0 = res.x0Final;
  });

  return {page, fit, bands, texts, avatars,
          accent:st.accent, ring:st.ring, bg:st.bg, font:F, empty:!groups.length,
          natW, natH, angle:0};
}
return {buildBandGroups, buildBandStack, emitHeaderTexts, emitBandPeople, computeTriangleLayout, computePyramidLayout, computeTornadoLayout, computeHistogramLayout};
}

export { createBandLayouts };
