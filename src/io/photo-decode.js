import { DECODE_TIMEOUT, photoHeader } from "./photo-header.js";
import { LIMITS } from "../model/settings.js";
import { validatePhoto } from "../model/validation.js";

const DECODE_CANCELLED = {cancelled:true};

async function decodeImage(src, cancelled){
  const stop = cancelled || (() => false);
  if(stop()) return DECODE_CANCELLED;

  if(!validatePhoto(src)) return null;

  const head = photoHeader(src);
  if(!head) return null;
  const oversize = photoSizeProblem(head.w, head.h);
  if(oversize) return {problem: oversize};
  if(stop()) return DECODE_CANCELLED;

  const real = await new Promise(res => {
    let settled = false, timer = null;
    const done = v => {
      if(settled) return;
      settled = true;
      clearTimeout(timer);
      res(v);
    };
    const img = new Image();
    img.onload  = () => {
      const w = img.naturalWidth  || img.width  || 0;
      const h = img.naturalHeight || img.height || 0;
      done(w > 0 && h > 0 ? {w:w, h:h} : null);
    };
    img.onerror = () => done(null);
    timer = setTimeout(() => done(null), DECODE_TIMEOUT);
    img.src = src;
  });

  if(stop()) return DECODE_CANCELLED;
  if(!real) return null;

  if(!sizeMatchesHeader(real.w, real.h, head)) return null;

  const after = photoSizeProblem(real.w, real.h);
  if(after) return {problem: after};
  return {w: real.w, h: real.h};
}

function sizeMatchesHeader(w, h, head){
  const same    = w === head.w && h === head.h;
  const rotated = w === head.h && h === head.w;
  return same || rotated;
}

function photoSizeProblem(w, h){
  if(w > LIMITS.photoDim || h > LIMITS.photoDim)
    return "is " + w + "×" + h + " pixels, over the " + LIMITS.photoDim + " px limit";
  if(w * h > LIMITS.photoArea)
    return "is " + Math.round(w*h/1e6) + " megapixels, over the "
         + Math.round(LIMITS.photoArea/1e6) + " megapixel limit";
  if(Math.max(w, h) / Math.min(w, h) > LIMITS.photoRatio)
    return "is " + w + "×" + h + " pixels, too long and thin to be a photo";
  return null;
}

export { DECODE_CANCELLED, decodeImage, sizeMatchesHeader, photoSizeProblem };
