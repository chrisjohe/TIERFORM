

function photoFields(r){
  return r ? {photo:r.data, pw:r.w, ph:r.h, frame:{zoom:1, ox:0, oy:0}}
           : {photo:null,   pw:0,   ph:0,   frame:null};
}

function applyPhoto(p, r){ Object.assign(p, photoFields(r)); }

export { photoFields, applyPhoto };
