

function canvasBlob(c, type, quality){
  return new Promise((res, rej)=>{
    try{
      c.toBlob(b => b ? res(b) : rej(new Error("the image could not be encoded — the page may be too large")),
               type, quality);
    }catch(e){ rej(e); }
  });
}

export { canvasBlob };
