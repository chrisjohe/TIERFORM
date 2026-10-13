import { DENSITY, G, HV, PAGES } from "./constants.js";
import { frameRect } from "../model/framing.js";
import { initials, nameSegs, subline } from "../model/labels.js";
import { docFont } from "../model/settings.js";
import { withAlpha } from "../render/colour.js";

function createHiveLayout(meas, {personLabelWidth, headNeedWidth, gradeHeadingTexts, fitName, ellipsize}){
function computeHiveLayout(st){
  const F = docFont(st);
  const page = PAGES[st.page] || PAGES["landscape"];
  const dens = DENSITY[st.density] || DENSITY.balanced;

  const grouped = [];
  st.tiers.forEach((t, index) => {
    if(t.merge && grouped.length){
      const group = grouped[grouped.length - 1];
      group.tiers.push(t);
      group.lastIndex = index;
    }else{
      grouped.push({t, tiers:[t], index, lastIndex:index, people:[]});
    }
  });
  grouped.forEach(group => {
    const ids = new Set(group.tiers.map(t => t.id));
    group.people = st.people.filter(p => ids.has(p.tierId));
  });
  const anyone = grouped.some(g => g.people.length);
  const groups = anyone ? grouped.filter(g => g.people.length) : grouped;
  const N = groups.length;

  const namesNext       = st.nameLabelPosition === "next";
  const personNameOn    = st.showPersonName !== false;
  const personSublineOn = st.showPersonGrade !== false || st.showPersonGroup !== false;
  const personTextOn    = personNameOn || personSublineOn;
  const codeOn = st.showGradeCode !== false;
  const nameOn = st.showGradeName === true;

  let labelW = 0;
  if(personTextOn){
    for(const group of groups){
      for(const p of group.people){
        labelW = Math.max(labelW, personLabelWidth(st, p));
      }
    }
    labelW = Math.min(labelW, HV.labelMax);
  }
  const belowTextDy = personNameOn && personSublineOn ? HV.subDy
    : (personTextOn ? HV.nameDy : 0);
  let cellW, cellH;
  if(!personTextOn){
    cellW = 2*G.avaR; cellH = 2*G.avaR;
  }else if(namesNext){
    cellW = 2*G.avaR + G.gapAva + labelW; cellH = 2*G.avaR;
  }else{
    cellW = Math.max(2*G.avaR, labelW); cellH = 2*G.avaR + belowTextDy;
  }
  const cellGapX = HV.cellGapX * dens, cellGapY = HV.cellGapY * dens;

  const cols = N ? Math.ceil(Math.sqrt(N)) : 0;
  const rows = N ? Math.ceil(N/cols) : 0;

  function block(n){
    if(!n) return {cols:0, rows:0, w:0, h:0};
    const bc = Math.ceil(Math.sqrt(n));
    const br = Math.ceil(n/bc);
    return {cols:bc, rows:br,
            w: bc*cellW + (bc - 1)*cellGapX,
            h: br*cellH + (br - 1)*cellGapY};
  }

  function headingNeed(tiers){
    if(!codeOn && !nameOn) return {w:0, h:0};
    const code = tiers.map(t => t.code || "").join(" / ");
    const name = tiers.map(t => t.label || "").join(" / ");
    let w = 0, h;
    if(codeOn && nameOn){
      meas.font = "700 18px " + F; w = Math.max(w, meas.measureText(code).width);
      meas.font = "600 12px " + F; w = Math.max(w, meas.measureText(name).width);
      h = HV.headBoth;
    }else if(codeOn){
      meas.font = "700 19px " + F; w = meas.measureText(code).width;
      h = HV.headOne;
    }else{
      meas.font = "600 14px " + F; w = meas.measureText(name).width;
      h = HV.headOne;
    }
    return {w: w + 2*HV.padX, h};
  }
  groups.forEach(g => {
    g.block = block(g.people.length);
    g.head  = headingNeed(g.tiers);

    const cappedHeadW = Math.min(g.head.w, HV.headMin);
    g.stackW = Math.max(g.block.w, cappedHeadW);
    g.stackGap = g.head.h > 0 ? HV.headGap : 0;
    g.stackH = g.head.h + g.stackGap + g.block.h;
  });

  const needed = groups.reduce((m, g) =>
    Math.max(m, g.stackH/2 + g.stackW/(2*Math.sqrt(3))), 0);
  const R = Math.max(needed + HV.pad, HV.headMin/Math.sqrt(3));
  const hexW = Math.sqrt(3)*R, hexH = 2*R;

  const gap = HV.gap * dens;
  const D   = hexW + gap;
  const dy  = D*Math.sqrt(3)/2;

  const headNeed = headNeedWidth(st);
  const laneTop  = G.bandH + HV.headGap;

  const relX = [], relY = [];
  groups.forEach((g, i) => {
    const row = Math.floor(i/cols), col = i % cols;
    const rowStartX = (row % 2 === 1) ? D/2 : 0;
    let cx;
    if(col === 0){
      cx = rowStartX;
    }else{
      const attachHere = g.t.attach && g.index === groups[i-1].lastIndex + 1;
      cx = relX[i-1] + (attachHere ? hexW : D);
    }
    relX.push(cx);
    relY.push(laneTop + R + row*dy);
  });
  const relMin = groups.length ? Math.min(...relX) - hexW/2 : 0;
  const relMax = groups.length ? Math.max(...relX) + hexW/2 : 0;
  const gridWidth = groups.length ? relMax - relMin : 0;
  const natW = Math.max(headNeed, groups.length ? gridWidth : headNeed);
  const shift = (natW - gridWidth)/2 - relMin;

  const natH = laneTop + (rows > 0 ? (rows - 1)*dy + 2*R : 0);

  const availW = page.w - 2*G.margin, availH = page.h - 2*G.margin;
  const s  = Math.min(availW/natW, availH/natH);
  const tx = G.margin + (availW - natW*s)/2;
  const ty = G.margin + (availH - natH*s)/2;

  const rect = (x, y, w, h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const hexPts = (cx, cy) => {
    const pts = [];
    for(let i = 0; i < 6; i++){
      const a = (-90 + i*60) * Math.PI/180;
      pts.push([cx + R*Math.cos(a), cy + R*Math.sin(a)]);
    }
    return pts;
  };
  const bands = [], avatars = [], texts = [];

  bands.push({pts:rect(0, 0, natW, G.bandH), fill:"green"});
  texts.push({x:30, y:G.bandH/2, anchor:"start", baseline:"middle",
              segs:[{t:st.title || "", w:600}], size:25, color:st.inkOnColour});
  if(st.brand && st.brand.trim()){
    texts.push({x:natW - 24, y:G.bandH/2, anchor:"end", baseline:"middle",
                segs:[{t:st.brand.trim(), w:700}], size:26, color:st.inkOnColour});
  }

  groups.forEach((g, i) => {
    const hcx = relX[i] + shift, hcy = relY[i];
    const white = g.t.fill === "white";

    const ink   = white ? st.inkOnWhite : st.inkOnColour;
    const pMute = withAlpha(ink, 0.62);

    bands.push({pts:hexPts(hcx, hcy), fill:g.t.fill});

    const stackTop = hcy - g.stackH/2;
    if(g.head.h > 0){
      texts.push(...gradeHeadingTexts(st, g.tiers, hcx, stackTop + g.head.h/2,
        g.stackW - 2*HV.padX, ink, 19));
    }
    const blockTop = stackTop + g.head.h + g.stackGap;

    const br = g.block.rows;
    const base = br ? Math.floor(g.people.length/br) : 0;
    const extra = br ? g.people.length % br : 0;
    let idx = 0;
    for(let r = 0; r < br; r++){
      const rowCount = base + (r < extra ? 1 : 0);
      const rowW = rowCount*cellW + (rowCount - 1)*cellGapX;
      const rowLeft = hcx - rowW/2;
      const ccy = blockTop + r*(cellH + cellGapY) + cellH/2;
      for(let c = 0; c < rowCount; c++){
        const p = g.people[idx++];
        const ccx = rowLeft + c*(cellW + cellGapX) + cellW/2;

        if(namesNext){
          const acx = ccx - cellW/2 + G.avaR, acy = ccy;
          avatars.push({cx:acx, cy:acy, r:G.avaR, src:p.photo || null, ini:initials(p.name),
                        img: p.photo ? frameRect(acx, acy, G.avaR, p.pw, p.ph, p.frame) : null});
          const tx2 = acx + G.avaR + G.gapAva;
          const textW = labelW;
          const sub = subline(st, p), subOn = !!sub;
          if(personNameOn){
            texts.push({x:tx2, y:subOn ? acy-3 : acy+5, anchor:"start", baseline:"alphabetic",
                        segs:fitName(nameSegs(st, p.name), textW, F), size:15, color:ink});
          }
          if(subOn){
            texts.push({x:tx2, y:personNameOn ? acy+14 : acy+4, anchor:"start", baseline:"alphabetic",
                        segs:[{t:ellipsize(sub, textW, "400 11px " + F), w:400}],
                        size:11, color:pMute, tracking:.2});
          }
        }else{
          const acx = ccx, acy = ccy - cellH/2 + G.avaR;
          avatars.push({cx:acx, cy:acy, r:G.avaR, src:p.photo || null, ini:initials(p.name),
                        img: p.photo ? frameRect(acx, acy, G.avaR, p.pw, p.ph, p.frame) : null});
          const avaBottom = acy + G.avaR;
          const textW = cellW;
          const sub = subline(st, p), subOn = !!sub;
          if(personNameOn){
            texts.push({x:ccx, y:avaBottom + HV.nameDy, anchor:"middle", baseline:"alphabetic",
                        segs:fitName(nameSegs(st, p.name), textW, F), size:15, color:ink});
          }
          if(subOn){
            texts.push({x:ccx, y:avaBottom + (personNameOn ? HV.subDy : HV.nameDy),
                        anchor:"middle", baseline:"alphabetic",
                        segs:[{t:ellipsize(sub, textW, "400 11px " + F), w:400}],
                        size:11, color:pMute, tracking:.2});
          }
        }
      }
    }
  });

  return {page, fit:{tx,ty,s}, bands, texts, avatars,
          accent:st.accent, ring:st.ring, bg:st.bg, font:F, empty:!groups.length,
          natW:natW, natH:natH, angle:0};
}
return {computeHiveLayout};
}

export { createHiveLayout };
