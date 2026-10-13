

const PAGES = {
  "landscape": {w:1190.55, h:841.89, label:"Landscape"},
  "portrait":  {w:841.89,  h:1190.55, label:"Portrait"},
  "square":       {w:841.89,  h:841.89, label:"Square"}
};

const ANGLES = [0.12, 0.20, 0.28, 0.36, 0.44];

const DENSITY = {tight:0.85, balanced:1.30, airy:1.90};

const G = {
  margin:34,
  bandH:58,
  avaR:34,
  labelW:110,
  gapAva:16,
  padRight:26,

  belowName:16,
  belowSub:14,
  belowTail:5,
  belowBreathe:26,
  belowPadX:22
};

const SW = {
  laneMin: 172,
  laneMax: 300,
  laneGap: 16,
  headH:   G.bandH,
  headGap: 20,
  padX:    14,
  rowBase: 26,
  nameDy:  20,
  subDy:   35
};

const HV = {
  headGap:  20,
  headBoth: 40,
  headOne:  24,
  headMin:  172,
  padX:     14,
  pad:      10,
  gap:      14,
  cellGapX: 12,
  cellGapY: 12,
  labelMax: 170,
  nameDy:   20,
  subDy:    35
};

const MX = {
  gutterMax: 170,
  gutterPad: 14,
  rowGap:    44
};

export { PAGES, ANGLES, DENSITY, G, SW, HV, MX };
