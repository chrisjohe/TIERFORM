import { DENSITY, G, MX, PAGES, SW } from "./constants.js";
import { frameRect } from "../model/framing.js";
import { initials, nameSegs, subline } from "../model/labels.js";
import { docFont } from "../model/settings.js";
import { withAlpha } from "../render/colour.js";

function createMatrixLayout(meas, {personLabelWidth, headNeedWidth, gradeHeadingTexts, fitName, ellipsize}){
function computeMatrixLayout(st){
  const F = docFont(st);
  const page = PAGES[st.page] || PAGES["landscape"];
  const dens = DENSITY[st.density] || DENSITY.balanced;

  const grouped = [];
  st.tiers.forEach((t, index) => {
    if(t.merge && grouped.length){
      const lane = grouped[grouped.length - 1];
      lane.tiers.push(t);
      lane.lastIndex = index;
    }else{
      grouped.push({t, tiers:[t], index, lastIndex:index, people:[]});
    }
  });
  grouped.forEach(lane => {
    const ids = new Set(lane.tiers.map(t => t.id));
    lane.people = st.people.filter(p => ids.has(p.tierId));
  });
  const anyone = grouped.some(l => l.people.length);
  const lanes  = anyone ? grouped.filter(l => l.people.length) : grouped;
  const namesNext = st.nameLabelPosition === "next";
  const personNameOn = st.showPersonName !== false;
  const personSublineOn = st.showPersonGrade !== false || st.showPersonGroup !== false;
  const personTextOn = personNameOn || personSublineOn;

  let need = SW.laneMin;
  for(const lane of lanes){
    if(st.showGradeCode !== false){
      meas.font = "700 19px " + F;
      const code = lane.tiers.map(t => t.code || "").join(" / ");
      need = Math.max(need, meas.measureText(code).width + 2*SW.padX);
    }
    if(st.showGradeName === true){
      meas.font = "600 14px " + F;
      const name = lane.tiers.map(t => t.label || "").join(" / ");
      need = Math.max(need, meas.measureText(name).width + 2*SW.padX);
    }
    for(const p of lane.people){
      const labelNeed = personLabelWidth(st, p);
      need = Math.max(need, labelNeed + 2*SW.padX
        + (namesNext && personTextOn ? 2*G.avaR + G.gapAva : 0));
    }
  }
  const laneW = Math.max(SW.laneMin, Math.min(SW.laneMax, Math.ceil(need)));

  const rowGapPerson = SW.rowBase * dens;
  const belowTextDy = personNameOn && personSublineOn ? SW.subDy
    : (personTextOn ? SW.nameDy : 0);
  const cellH = namesNext ? 2*G.avaR : 2*G.avaR + belowTextDy;

  const headNeed = headNeedWidth(st);

  const gapBefore = lanes.map((lane, i) => i === 0 ? 0
    : (lane.t.attach && lane.index === lanes[i-1].lastIndex + 1 ? 0 : SW.laneGap));
  const gridW = lanes.length
    ? lanes.length*laneW + gapBefore.reduce((sum, gap) => sum + gap, 0)
    : headNeed;
  const laneTop = G.bandH + SW.headGap;
  const rowTop  = laneTop + SW.headH + SW.headGap;

  const namedRowIds = new Set((st.groups || []).map(g => g && g.id).filter(Boolean));
  const rowOf = p => (p && p.groupId && namedRowIds.has(p.groupId)) ? p.groupId : null;
  const rows = (st.groups || []).map(g => ({id: g.id, label: g.label || ""}))
    .concat([{id: null, label: ""}]);

  rows.forEach(row => {
    row.cells = lanes.map(lane => lane.people.filter(p => rowOf(p) === row.id));
  });
  let drawnRows = rows.filter(row => row.cells.some(cell => cell.length));

  if(!drawnRows.length) drawnRows = [rows[rows.length - 1]];

  const rowGapBetween = MX.rowGap * dens;
  const rowYs = [], rowHs = [];
  let y = rowTop;
  drawnRows.forEach((row, ri) => {
    const deepest = row.cells.reduce((m, cell) => Math.max(m, cell.length), 0);
    const h = deepest ? deepest*cellH + (deepest - 1)*rowGapPerson : 0;
    rowYs.push(y); rowHs.push(h);
    y += h + (ri < drawnRows.length - 1 ? rowGapBetween : 0);
  });
  const natH = y;

  const axisLabel = typeof st.groupsLabel === "string" ? st.groupsLabel.trim() : "";

  let gutterTotal = 0;
  const labelledRows = drawnRows.filter(row => row.label);
  if(labelledRows.length){
    meas.font = "600 14px " + F;
    let widest = 0;
    labelledRows.forEach(row => { widest = Math.max(widest, meas.measureText(row.label).width); });

    if(axisLabel){
      meas.font = "700 14px " + F;
      widest = Math.max(widest, meas.measureText(axisLabel).width);
    }
    gutterTotal = Math.min(MX.gutterMax, Math.ceil(widest)) + MX.gutterPad;
  }

  const contentW = gutterTotal + gridW;
  const natW = Math.max(headNeed, contentW);
  const contentX = (natW - contentW)/2;
  const laneGridStart = contentX + gutterTotal;

  const availW = page.w - 2*G.margin, availH = page.h - 2*G.margin;
  const s  = Math.min(availW/natW, availH/natH);
  const tx = G.margin + (availW - natW*s)/2;
  const ty = G.margin + (availH - natH*s)/2;

  const rect = (x, y, w, h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const bands = [], avatars = [], texts = [];

  bands.push({pts:rect(0, 0, natW, G.bandH), fill:"green"});
  texts.push({x:30, y:G.bandH/2, anchor:"start", baseline:"middle",
              segs:[{t:st.title || "", w:600}], size:25, color:st.inkOnColour});
  if(st.brand && st.brand.trim()){
    texts.push({x:natW - 24, y:G.bandH/2, anchor:"end", baseline:"middle",
                segs:[{t:st.brand.trim(), w:700}], size:26, color:st.inkOnColour});
  }

  drawnRows.forEach((row, ri) => {
    if(!row.label) return;
    texts.push({x: laneGridStart - MX.gutterPad, y: rowYs[ri] + rowHs[ri]/2,
                anchor:"end", baseline:"middle",
                segs:[{t: ellipsize(row.label, gutterTotal - MX.gutterPad, "600 14px " + F), w:600}],
                size:14, color: st.inkOnWhite});
  });

  if(gutterTotal && axisLabel){
    texts.push({x: laneGridStart - MX.gutterPad, y: laneTop + SW.headH/2,
                anchor:"end", baseline:"middle",
                segs:[{t: ellipsize(axisLabel, gutterTotal - MX.gutterPad, "700 14px " + F), w:700}],
                size:14, color: st.inkOnWhite});
  }

  let laneX = laneGridStart;
  lanes.forEach((lane, i) => {
    laneX += gapBefore[i];
    const x0 = laneX;
    const cx = x0 + laneW/2;
    const white = lane.t.fill === "white";
    const ink   = white ? st.inkOnWhite : st.inkOnColour;

    bands.push({pts:rect(x0, laneTop, laneW, SW.headH), fill:lane.t.fill});
    texts.push(...gradeHeadingTexts(st, lane.tiers, cx, laneTop + SW.headH/2,
      laneW - 2*SW.padX, ink, 19));

    const pInk  = st.inkOnWhite;
    const pMute = withAlpha(pInk, 0.62);

    drawnRows.forEach((row, ri) => {
      const cell = row.cells[i];
      cell.forEach((p, j) => {
        const top = rowYs[ri] + j*(cellH + rowGapPerson);
        const acy = top + G.avaR;
        const acx = namesNext && personTextOn ? x0 + SW.padX + G.avaR : cx;
        avatars.push({cx:acx, cy:acy, r:G.avaR, src:p.photo || null, ini:initials(p.name),
                      img: p.photo ? frameRect(acx, acy, G.avaR, p.pw, p.ph, p.frame) : null});
        if(namesNext){
          const tx2 = acx + G.avaR + G.gapAva;
          const textW = Math.max(0, x0 + laneW - SW.padX - tx2);
          const sub = subline(st, p), subOn = !!sub;
          if(personNameOn){
            texts.push({x:tx2, y:subOn ? acy-3 : acy+5, anchor:"start", baseline:"alphabetic",
                        segs:fitName(nameSegs(st, p.name), textW, F), size:15, color:pInk});
          }
          if(subOn){
            texts.push({x:tx2, y:personNameOn ? acy+14 : acy+4, anchor:"start", baseline:"alphabetic",
                        segs:[{t:ellipsize(sub, textW, "400 11px " + F), w:400}],
                        size:11, color:pMute, tracking:.2});
          }
        }else{
          const textW = laneW - 2*SW.padX;
          const sub = subline(st, p), subOn = !!sub;
          if(personNameOn){
            texts.push({x:cx, y:top + 2*G.avaR + SW.nameDy, anchor:"middle", baseline:"alphabetic",
                        segs:fitName(nameSegs(st, p.name), textW, F), size:15, color:pInk});
          }
          if(subOn){
            texts.push({x:cx, y:top + 2*G.avaR
                          + (personNameOn ? SW.subDy : SW.nameDy),
                        anchor:"middle", baseline:"alphabetic",
                        segs:[{t:ellipsize(sub, textW, "400 11px " + F), w:400}],
                        size:11, color:pMute, tracking:.2});
          }
        }
      });
    });
    laneX += laneW;
  });

  return {page, fit:{tx,ty,s}, bands, texts, avatars,
          accent:st.accent, ring:st.ring, bg:st.bg, font:F, empty:!lanes.length,
          natW:natW, natH:natH, angle:0};
}
return {computeMatrixLayout};
}

export { createMatrixLayout };
