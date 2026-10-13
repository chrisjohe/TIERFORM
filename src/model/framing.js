

const ZOOM_MAX = 2;

function frameRect(cx, cy, r, pw, ph, frame){
  const W = pw>0 ? pw : 1, H = ph>0 ? ph : 1;
  const f = frame || {};
  const zoom = Math.max(1, Math.min(ZOOM_MAX, +f.zoom || 1));
  const k  = (2*r / Math.min(W,H)) * zoom;
  const dw = W*k, dh = H*k;
  const mx = Math.max(0, dw/2 - r), my = Math.max(0, dh/2 - r);
  const dx = Math.max(-mx, Math.min(mx, (+f.ox || 0) * r));
  const dy = Math.max(-my, Math.min(my, (+f.oy || 0) * r));
  return {x: cx - dw/2 + dx, y: cy - dh/2 + dy, w: dw, h: dh};
}

function frameLimit(pw, ph, zoom){
  const W = pw>0 ? pw : 1, H = ph>0 ? ph : 1;
  const z = Math.max(1, Math.min(ZOOM_MAX, +zoom || 1));
  return {ox: Math.max(0, W*z/Math.min(W,H) - 1), oy: Math.max(0, H*z/Math.min(W,H) - 1)};
}

function clampFrame(p){
  if(!p.frame) return;
  p.frame.zoom = Math.max(1, Math.min(ZOOM_MAX, +p.frame.zoom || 1));
  const lim = frameLimit(p.pw, p.ph, p.frame.zoom);
  p.frame.ox = Math.max(-lim.ox, Math.min(lim.ox, +p.frame.ox || 0));
  p.frame.oy = Math.max(-lim.oy, Math.min(lim.oy, +p.frame.oy || 0));
}

export { ZOOM_MAX, frameRect, frameLimit, clampFrame };
