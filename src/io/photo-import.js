import { photoSizeProblem, sizeMatchesHeader } from "./photo-decode.js";
import { photoHeader } from "./photo-header.js";
import { LIMITS } from "../model/settings.js";
import { validatePhoto } from "../model/validation.js";

const PHOTO_SHORT = 400;

const PHOTO_LONG      = 1600;

const PHOTO_MAX_BYTES = 5.9e6;

const PHOTO_MAX_EDGE  = 30000;

function processImage(file){
  return new Promise((res,rej)=>{

    if(file.type !== "image/jpeg" && file.type !== "image/png"){
      rej(new Error("only JPEG and PNG photos are supported")); return;
    }
    if(file.size > PHOTO_MAX_BYTES){
      rej(new Error("that image file is larger than about 6 MB")); return;
    }
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("that file could not be read"));
    fr.onload = () => {
      const safe = validatePhoto(fr.result);
      const head = safe && photoHeader(safe);
      if(!head){ rej(new Error("that file's bytes are not a valid JPEG or PNG")); return; }
      const before = photoSizeProblem(head.w, head.h);
      if(before){ rej(new Error("that image " + before)); return; }
      const img = new Image();
      img.onerror = () => rej(new Error("that file is not an image this browser can read"));
      img.onload = () => {
        const iw = img.width, ih = img.height;
        if(!sizeMatchesHeader(iw, ih, head)){
          rej(new Error("that image's decoded size does not match its header")); return;
        }
        const short = Math.min(iw, ih);
        if(!short){ rej(new Error("that image has no pixels")); return; }
        if(iw > PHOTO_MAX_EDGE || ih > PHOTO_MAX_EDGE){
          rej(new Error("that image is " + iw + "x" + ih + " — larger than "
            + PHOTO_MAX_EDGE + "px on a side")); return;
        }

        if(iw * ih > LIMITS.photoArea){
          rej(new Error("that image is " + Math.round(iw*ih/1e6) + " megapixels — the limit is "
            + Math.round(LIMITS.photoArea/1e6))); return;
        }

        if(Math.max(iw, ih) / short > LIMITS.photoRatio){
          rej(new Error("that image is " + iw + "x" + ih
            + " — too long and thin to crop to a face")); return;
        }

        const k = Math.min(1, PHOTO_SHORT/short, PHOTO_LONG/Math.max(iw, ih));
        const w = Math.max(1, Math.round(iw*k));
        const h = Math.max(1, Math.round(ih*k));
        const c = document.createElement("canvas");
        c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        const data = c.toDataURL("image/jpeg",0.82);

        if(!validatePhoto(data)){ rej(new Error("that image could not be re-encoded")); return; }
        res({data:data, w:w, h:h});
      };
      img.src = safe;
    };
    fr.readAsDataURL(file);
  });
}

export { PHOTO_SHORT, PHOTO_LONG, PHOTO_MAX_BYTES, PHOTO_MAX_EDGE, processImage };
