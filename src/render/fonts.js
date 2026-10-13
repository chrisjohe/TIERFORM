

const fontsReady = (document.fonts && document.fonts.ready)
  ? document.fonts.ready.catch(()=>{})
  : Promise.resolve();

export { fontsReady };
