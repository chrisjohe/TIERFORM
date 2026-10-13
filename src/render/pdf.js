import { canvasBlob } from "./blob.js";
import { toCanvas } from "./canvas.js";

async function toPDF(L){
  const c   = await toCanvas(L, 300);

  const blob = await canvasBlob(c, "image/jpeg", 0.94);
  const img  = new Uint8Array(await blob.arrayBuffer());

  const W = L.page.w.toFixed(2), H = L.page.h.toFixed(2);
  const enc = new TextEncoder();
  const parts = []; let len = 0; const offs = [];
  const put  = d => { const u = (typeof d === "string") ? enc.encode(d) : d; parts.push(u); len += u.length; };
  const obj  = str => { offs.push(len); put(str); };

  put("%PDF-1.4\n");
  obj("1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n");
  obj("2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n");
  obj("3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 "+W+" "+H+"]"
      +"/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>\nendobj\n");
  obj("4 0 obj\n<</Type/XObject/Subtype/Image/Width "+c.width+"/Height "+c.height
      +"/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length "+img.length+">>\nstream\n");
  put(img);
  put("\nendstream\nendobj\n");
  const content = "q "+W+" 0 0 "+H+" 0 0 cm /Im0 Do Q\n";
  obj("5 0 obj\n<</Length "+content.length+">>\nstream\n"+content+"endstream\nendobj\n");

  const startxref = len;
  let x = "xref\n0 6\n0000000000 65535 f \n";
  offs.forEach(o => { x += String(o).padStart(10,"0") + " 00000 n \n"; });
  put(x);
  put("trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n"+startxref+"\n%%EOF\n");

  const out = new Uint8Array(len); let at = 0;
  for(const u of parts){ out.set(u, at); at += u.length; }
  return new Blob([out], {type:"application/pdf"});
}

export { toPDF };
