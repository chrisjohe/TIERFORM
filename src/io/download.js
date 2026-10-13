

function download(blob, filename){
  const u=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=u; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
}

export { download };
