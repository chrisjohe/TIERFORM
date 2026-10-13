import { uid } from "../model/entities.js";
import { ANCHORS, oneOf, validatePhoto } from "../model/validation.js";
import { paint } from "./colour.js";
import { xmlAttr, xmlText } from "./xml.js";

function toSVG(L){
  const accent  = paint(L.accent, "#003153");
  const ringCol = L.ring==="accent" ? accent : (L.ring==="white" ? "#ffffff" : null);
  const PW = L.page.w.toFixed(2), PH = L.page.h.toFixed(2);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        + 'viewBox="0 0 '+PW+' '+PH+'" width="'+PW+'pt" height="'+PH+'pt">'

        + (L.bg === "transparent" ? '' : '<rect width="'+PW+'" height="'+PH+'" fill="#ffffff"/>')
        + '<g transform="translate('+L.fit.tx.toFixed(2)+','+L.fit.ty.toFixed(2)+') scale('+L.fit.s.toFixed(4)+')">';

  for(const b of L.bands){
    const pts = b.pts.map(q=>q[0].toFixed(1)+","+q[1].toFixed(1)).join(" ");
    s += b.fill==="white"
      ? '<polygon points="'+pts+'" fill="#ffffff" stroke="'+accent+'" stroke-width="2.5"/>'
      : '<polygon points="'+pts+'" fill="'+accent+'"/>';
  }

  for(const a of L.avatars){
    const id = "c"+uid();

    const src = validatePhoto(a.src);
    s += '<clipPath id="'+id+'"><circle cx="'+a.cx.toFixed(1)+'" cy="'+a.cy.toFixed(1)+'" r="'+a.r+'"/></clipPath>';
    if(src && a.img){

      s += '<circle cx="'+a.cx.toFixed(1)+'" cy="'+a.cy.toFixed(1)+'" r="'+a.r+'" fill="#ffffff"/>'
         + '<image clip-path="url(#'+id+')" x="'+a.img.x.toFixed(2)+'" y="'+a.img.y.toFixed(2)+'" '
         + 'width="'+a.img.w.toFixed(2)+'" height="'+a.img.h.toFixed(2)+'" preserveAspectRatio="none" '
         + 'href="'+xmlAttr(src)+'" xlink:href="'+xmlAttr(src)+'"/>';
    }else{
      s += '<circle cx="'+a.cx.toFixed(1)+'" cy="'+a.cy.toFixed(1)+'" r="'+a.r+'" fill="#c8ced5"/>'
         + '<text x="'+a.cx.toFixed(1)+'" y="'+(a.cy+7).toFixed(1)+'" text-anchor="middle" '
         + 'font-family="'+xmlAttr(L.font)+'" font-size="19" font-weight="650" fill="#ffffff">'+xmlText(a.ini)+'</text>';
    }
    if(ringCol){
      s += '<circle cx="'+a.cx.toFixed(1)+'" cy="'+a.cy.toFixed(1)+'" r="'+(a.r-1)+'" fill="none" stroke="'+ringCol+'" stroke-width="2.5"/>';
    }
  }

  for(const t of L.texts){
    let inner = "";
    for(const g of t.segs){ if(g.t) inner += '<tspan font-weight="'+(+g.w||400)+'">'+xmlText(g.t)+'</tspan>'; }
    if(!inner) continue;
    s += '<text x="'+t.x.toFixed(1)+'" y="'+t.y.toFixed(1)+'" text-anchor="'+oneOf(t.anchor, ANCHORS, "start")+'" '
       + (t.baseline==="middle" ? 'dominant-baseline="central" ' : '')
       + 'font-family="'+xmlAttr(L.font)+'" font-size="'+(+t.size||12)+'" fill="'+paint(t.color, "#1A2129")+'"'
       + (t.tracking ? ' letter-spacing="'+(+t.tracking||0)+'"' : '') + '>' + inner + '</text>';
  }
  return s + '</g></svg>';
}

export { toSVG };
