

function angleIndex(v){
  if(typeof v === "number") return Math.max(0, Math.min(4, Math.round(v)));
  return 2;
}

function codeParts(code){
  return String(code||"").split("/").map(x=>x.trim()).filter(Boolean);
}

export { angleIndex, codeParts };
