

const VERSION = "2026.10b";

const FONT = "'Open Sans','Segoe UI',system-ui,Roboto,Helvetica,Arial,sans-serif";

const FONTS = {
  "open-sans": FONT,
  "segoe-ui": "'Segoe UI',system-ui,Roboto,Helvetica,Arial,sans-serif",
  "roboto":   "Roboto,'Segoe UI',system-ui,Helvetica,Arial,sans-serif",
  "helvetica":"Helvetica,'Helvetica Neue',Arial,system-ui,sans-serif",
  "arial":    "Arial,Helvetica,system-ui,sans-serif"
};

function docFont(st){ return FONTS[st.font] || FONT; }

const FILE_FORMAT = 1;

const LIMITS = {
  tiers:      60,
  people:    2000,
  text:       200,
  title:      200,
  pasteChars: 1500000,
  rosterBytes: 64 * 1024 * 1024,
  totalPhotoBytes: 48 * 1024 * 1024,
  photoBytes: 8e6,

  photoDim:   8000,
  photoArea:  40e6,
  photoRatio: 10
};

const ENUMS = {
  fill:  ["green","white"],
  align: ["left","center","right"],
  bg:    ["white","transparent"],
  ring:  ["none","accent","white"],

  layout: ["pyramid","tornado","histogram","swimlanes","hive","matrix"],
  nameLabelPosition: ["below","next"],
  nameBold: ["given","family","all","none"],

  font: ["open-sans","segoe-ui","roboto","helvetica","arial"]
};

const LAYOUTS = {
  pyramid: {
    label:   "Pyramid",
    angle:   true,
    align:   true,
    surface: "band",
    counts:  "grades",
    grows:   "down"
  },
  tornado: {
    label:   "Tornado",
    angle:   true,
    align:   true,
    surface: "band",
    counts:  "grades",
    grows:   "down"
  },
  histogram: {
    label:   "Histogram",
    angle:   false,
    align:   true,
    surface: "band",
    counts:  "grades",
    grows:   "down"
  },
  swimlanes: {
    label:   "Swimlanes",
    angle:   false,
    align:   false,
    surface: "lane",
    counts:  "lanes",
    grows:   "across"
  },
  hive: {
    label:   "Hive",
    angle:   false,
    align:   false,
    surface: "cell",
    counts:  "cells",
    grows:   "across"
  },
  matrix: {
    label:   "Matrix",
    angle:   false,
    align:   false,
    surface: "column",
    counts:  "columns",
    grows:   "across"
  }
};

function notAvailableIn(cap){ return "Not available in " + cap.label; }

export { VERSION, FONT, FONTS, docFont, FILE_FORMAT, LIMITS, ENUMS, LAYOUTS, notAvailableIn };
