

function nameFromFile(fn){

  let s = fn.normalize("NFC").replace(/\.[^.]+$/,"").replace(/[_\-.]+/g," ").replace(/\s+/g," ").trim();
  if(s.includes(",")){ const [a,b]=s.split(",",2); s = (b+" "+a).trim(); }
  return s.replace(/(^|[^\p{L}\p{M}])(\p{L})/gu, (m,pre,c)=>{ const u=c.toUpperCase(); return pre+(u.length===1?u:c); });
}

export { nameFromFile };
