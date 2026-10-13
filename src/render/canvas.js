import { validatePhoto } from "../model/validation.js";
import { paint } from "./colour.js";
import { fontsReady } from "./fonts.js";

function loadImg(src){
  return new Promise(res=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src; });
}

async function toCanvas(L, dpi){
  await fontsReady;
  const S = dpi/72;
  const c = document.createElement("canvas");
  c.width  = Math.round(L.page.w*S);
  c.height = Math.round(L.page.h*S);
  const x = c.getContext("2d");

  const accent = paint(L.accent, "#003153");
  if(L.bg !== "transparent"){ x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); }
  x.scale(S,S);
  x.translate(L.fit.tx, L.fit.ty);
  x.scale(L.fit.s, L.fit.s);
  x.textBaseline="alphabetic";

  for(const b of L.bands){
    x.beginPath();
    b.pts.forEach((q,i)=> i? x.lineTo(q[0],q[1]) : x.moveTo(q[0],q[1]));
    x.closePath();
    if(b.fill==="white"){ x.fillStyle="#fff"; x.fill(); x.strokeStyle=accent; x.lineWidth=2.5; x.stroke(); }
    else { x.fillStyle=accent; x.fill(); }
  }

  const ringCol = L.ring==="accent" ? accent : (L.ring==="white" ? "#ffffff" : null);

  const imgs = await Promise.all(L.avatars.map(a => {
    const src = validatePhoto(a.src);
    return src ? loadImg(src) : Promise.resolve(null);
  }));

  L.avatars.forEach((a,i)=>{
    if(imgs[i]){ x.beginPath(); x.arc(a.cx,a.cy,a.r,0,Math.PI*2); x.fillStyle="#fff"; x.fill(); }
    x.save();
    x.beginPath(); x.arc(a.cx,a.cy,a.r,0,Math.PI*2); x.clip();
    if(imgs[i] && a.img) x.drawImage(imgs[i], a.img.x, a.img.y, a.img.w, a.img.h);
    else{
      x.fillStyle="#c8ced5"; x.fillRect(a.cx-a.r,a.cy-a.r,a.r*2,a.r*2);
      x.fillStyle="#fff"; x.font="650 19px "+L.font; x.textAlign="center";
      x.fillText(a.ini, a.cx, a.cy+7); x.textAlign="left";
    }
    x.restore();
    if(ringCol){
      x.beginPath(); x.arc(a.cx,a.cy,a.r-1,0,Math.PI*2);
      x.strokeStyle=ringCol; x.lineWidth=2.5; x.stroke();
    }
  });

  for(const t of L.texts){
    const segs = t.segs.filter(g=>g.t);
    if(!segs.length) continue;
    x.fillStyle=paint(t.color, "#1A2129");
    let total=0;
    for(const g of segs){ x.font=g.w+" "+t.size+"px "+L.font; total += x.measureText(g.t).width; }
    let cx = t.anchor==="end" ? t.x-total : (t.anchor==="middle" ? t.x-total/2 : t.x);
    const cy = t.baseline==="middle" ? t.y + t.size*0.35 : t.y;
    for(const g of segs){
      x.font=g.w+" "+t.size+"px "+L.font;
      x.fillText(g.t, cx, cy);
      cx += x.measureText(g.t).width;
    }
  }
  return c;
}

export { loadImg, toCanvas };
