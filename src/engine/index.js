import { createBandLayouts } from "./bands.js";
import { createHiveLayout } from "./hive.js";
import { createMatrixLayout } from "./matrix.js";
import { createSwimlaneLayout } from "./swimlanes.js";
import { createTextMetrics } from "./text.js";

function createLayoutEngine(meas){
if(!meas || typeof meas.measureText !== "function") throw new TypeError("A text measurement context is required");
const text = createTextMetrics(meas);
const bands = createBandLayouts(meas, text);
const {computePyramidLayout, computeTornadoLayout, computeHistogramLayout} = bands;
const {computeSwimlaneLayout} = createSwimlaneLayout(meas, text);
const {computeHiveLayout} = createHiveLayout(meas, text);
const {computeMatrixLayout} = createMatrixLayout(meas, text);
function computeLayout(st){
  const engines = {pyramid: computePyramidLayout, tornado: computeTornadoLayout, histogram: computeHistogramLayout, swimlanes: computeSwimlaneLayout, hive: computeHiveLayout, matrix: computeMatrixLayout};
  return (engines[st && st.layout] || computePyramidLayout)(st);
}
return {computeLayout, ...text, ...bands, computeSwimlaneLayout, computeHiveLayout, computeMatrixLayout};
}

export { createLayoutEngine };
