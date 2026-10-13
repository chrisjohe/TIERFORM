import { HEX6 } from "../model/validation.js";

function withAlpha(hex, a){
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex||"").trim());
  if(!m) return hex;
  const v = parseInt(m[1],16);
  return "rgba("+((v>>16)&255)+","+((v>>8)&255)+","+(v&255)+","+a+")";
}

function luminance(hex){
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex||"").trim());
  if(!m) return null;
  const lin = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  return 0.2126*lin(parseInt(m[1],16)) + 0.7152*lin(parseInt(m[2],16)) + 0.0722*lin(parseInt(m[3],16));
}

function contrastRatio(a, b){
  const la = luminance(a), lb = luminance(b);
  if(la === null || lb === null) return null;
  return (Math.max(la,lb) + 0.05) / (Math.min(la,lb) + 0.05);
}

const CONTRAST_MIN = 4.5;

function paint(v, fallback){
  const s = String(v == null ? "" : v).trim();
  if(HEX6.test(s)) return s;
  if(/^rgba\(\d{1,3},\d{1,3},\d{1,3},(?:0|1|0?\.\d+)\)$/.test(s)) return s;
  return fallback;
}

export { withAlpha, luminance, contrastRatio, CONTRAST_MIN, paint };
