import { DENSITY, G, PAGES, SW } from "./constants.js";
import { createGridHelpers, emitHeaderTexts, pageFit, rect } from "./shared.js";
import { withAlpha } from "../render/colour.js";

function createSwimlaneLayout(meas, text){
const {gradeHeadingTexts} = text;
const {laneGeometry, emitLanePerson} = createGridHelpers(meas, text);
function computeSwimlaneLayout(st){
  const page = PAGES[st.page] || PAGES.landscape;
  const dens = DENSITY[st.density] || DENSITY.balanced;
  const ctx = laneGeometry(st);
  const {F, lanes, laneW, cellH, headNeed, gapBefore, gridW, laneTop, rowTop} = ctx;
  const rowGap = SW.rowBase * dens;
  const deepest = lanes.reduce((m, l) => Math.max(m, l.people.length), 0);
  const natW  = Math.max(headNeed, gridW);
  const natH  = rowTop + (deepest ? deepest*cellH + (deepest - 1)*rowGap : 0);

  const fit = pageFit(page, natW, natH);
  const bands = [], avatars = [], texts = [];

  bands.push({pts:rect(0, 0, natW, G.bandH), fill:"green"});
  texts.push(...emitHeaderTexts(st, 0, natW));

  const gridX = (natW - gridW)/2;

  let laneX = gridX;
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
    lane.people.forEach((p, j) => {
      const top = rowTop + j*(cellH + rowGap);
      emitLanePerson(st, ctx, p, x0, top, pInk, pMute, avatars, texts);
    });
    laneX += laneW;
  });

  return {page, fit, bands, texts, avatars,
          accent:st.accent, ring:st.ring, bg:st.bg, font:F, empty:!lanes.length,
          natW:natW, natH:natH, angle:0};
}
return {computeSwimlaneLayout};
}

export { createSwimlaneLayout };
