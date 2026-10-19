// Your picture: choose a photo (the phone's photo picker, or its camera), move and scale it inside the circle, and it
// goes up in place of your initials (core/avatars.js keeps it and shares it). The crop is saved as a small square
// JPEG (OUT px), never more than PIC_MAX characters.
// Exports: choosePicture(), removePicture(). Owner: SHELL (the You sheet's).
import * as ui from '../core/ui.js';
import * as avatars from '../core/avatars.js';

const OUT = 192;            // the saved picture, px square (an avatar is 96 px at most, so sharp on a 2x screen)
const BIG = 1600;           // a photo is scaled down to this (longest side) before cropping
const ZOOM_MAX = 4;

/** Opens the phone's photo picker; a photo chosen goes on to the crop sheet. Call it from a tap (iOS insists). */
export function choosePicture() {
  document.querySelectorAll('input[data-pic-input]').forEach(x => x.remove()); // one left from a picker closed without a choice
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.setAttribute('data-pic-input', '');
  inp.setAttribute('aria-hidden', 'true');
  inp.tabIndex = -1;
  inp.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
  document.body.appendChild(inp);
  inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0];
    inp.remove();
    if (f) openCrop(f);
  });
  inp.addEventListener('cancel', () => inp.remove());
  inp.click();
}

/** Takes your picture away (back to your initials). */
export async function removePicture() {
  const r = await avatars.setMine('').catch(() => 'failed');
  ui.haptic('light');
  ui.toast(r === 'saved' || r === 'later' ? 'Picture removed.' : 'Removed on this phone. It updates everywhere next time it can.', {icon: 'check-circle'});
}

// A photo as a canvas, the right way up (the browser applies the camera's orientation) and at most BIG px.
async function loadPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    im.decoding = 'async';
    im.src = url;
    await (im.decode ? im.decode() : new Promise((ok, no) => { im.onload = ok; im.onerror = no; }));
    const w = im.naturalWidth, h = im.naturalHeight;
    if (!w || !h) throw new Error('empty');
    const k = Math.min(1, BIG / Math.max(w, h)), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    return cv;
  } finally { URL.revokeObjectURL(url); }
}

function cropHTML() {
  return `<div class="ph-wrap">
<div class="ph-stage" data-ph-stage tabindex="0" role="img" aria-label="Your picture, as it will show. Drag to move it, pinch or use the slider to zoom.">
<canvas class="ph-cv" data-ph-cv></canvas><span class="ph-ring" aria-hidden="true"></span><span class="spin ph-spin" aria-hidden="true"></span>
</div>
<label class="ph-zoom"><span class="ph-zi" aria-hidden="true">−</span><input type="range" min="1" max="${ZOOM_MAX}" step="0.01" value="1" data-ph-zoom aria-label="Zoom" disabled><span class="ph-zi" aria-hidden="true">+</span></label>
<p class="ph-hint">Drag to move it. Pinch or slide to zoom.</p>
<div class="ph-acts">${ui.button({label: 'Cancel', kind: 'secondary', attrs: 'data-sheet-close'})}${ui.button({label: 'Use picture', kind: 'primary', attrs: 'data-ph-use', disabled: true})}</div>
</div>`;
}

// The crop: the photo covers the circle's square at zoom 1; (ox, oy) is how far its middle sits from the square's
// middle (css px), held so the photo always covers the square.
function openCrop(file) {
  const sh = ui.openSheet({title: 'Your picture', body: cropHTML(), cls: 'sh-photo', detents: ['fit']});
  const stage = sh.body.querySelector('[data-ph-stage]'), cv = sh.body.querySelector('[data-ph-cv]');
  const zoomEl = sh.body.querySelector('[data-ph-zoom]'), use = sh.body.querySelector('[data-ph-use]');
  const st = {img: null, S: 0, zoom: 1, ox: 0, oy: 0, dpr: Math.min(3, devicePixelRatio || 1), pts: new Map(), pinch: null};
  const base = () => st.S / Math.min(st.img.width, st.img.height);
  const clampPan = () => {
    const sc = base() * st.zoom, mx = Math.max(0, (st.img.width * sc - st.S) / 2), my = Math.max(0, (st.img.height * sc - st.S) / 2);
    st.ox = Math.max(-mx, Math.min(mx, st.ox)); st.oy = Math.max(-my, Math.min(my, st.oy));
  };
  const paint = (c, size) => {
    const k = size / st.S, sc = base() * st.zoom * k;
    c.fillStyle = '#1B1F2A'; c.fillRect(0, 0, size, size);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(st.img, size / 2 + st.ox * k - st.img.width * sc / 2, size / 2 + st.oy * k - st.img.height * sc / 2, st.img.width * sc, st.img.height * sc);
  };
  const draw = () => {
    if (!st.img) return;
    const c = cv.getContext('2d');
    c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    paint(c, st.S);
  };
  const size = () => {
    st.S = Math.round(stage.getBoundingClientRect().width) || 280;
    cv.width = Math.round(st.S * st.dpr); cv.height = Math.round(st.S * st.dpr);
    cv.style.width = cv.style.height = st.S + 'px';
  };
  const setZoom = (z, cx = 0, cy = 0) => {
    const nz = Math.max(1, Math.min(ZOOM_MAX, z)), f = nz / st.zoom;
    // zoom about (cx, cy) (from the square's middle): that point of the photo stays put
    st.ox = cx + (st.ox - cx) * f; st.oy = cy + (st.oy - cy) * f;
    st.zoom = nz;
    clampPan();
    zoomEl.value = String(st.zoom);
    draw();
  };

  loadPhoto(file).then(img => {
    if (!sh.el.isConnected) return;
    st.img = img;
    size();
    clampPan();
    draw();
    stage.classList.add('is-ready');
    zoomEl.disabled = false;
    use.disabled = false;
  }, () => {
    sh.close();
    ui.toast('That picture couldn’t be opened. Try a JPEG or PNG.');
  });

  // Moving and zooming: one finger (or the mouse) moves it; two pinch; the wheel and the slider zoom. The sheet
  // doesn't take these drags.
  const local = e => { const r = stage.getBoundingClientRect(); return {x: e.clientX - r.left - st.S / 2, y: e.clientY - r.top - st.S / 2}; };
  stage.addEventListener('touchstart', e => e.stopPropagation(), {passive: true});
  stage.addEventListener('pointerdown', e => {
    if (!st.img) return;
    e.stopPropagation();
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    st.pts.set(e.pointerId, local(e));
    if (st.pts.size === 2) {
      const [a, b] = [...st.pts.values()];
      st.pinch = {d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: st.zoom, m: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}};
    }
  });
  stage.addEventListener('pointermove', e => {
    if (!st.pts.has(e.pointerId)) return;
    const prev = st.pts.get(e.pointerId), now = local(e);
    st.pts.set(e.pointerId, now);
    if (st.pts.size >= 2 && st.pinch) {
      const [a, b] = [...st.pts.values()], m = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
      st.ox += m.x - st.pinch.m.x; st.oy += m.y - st.pinch.m.y; st.pinch.m = m;
      setZoom(st.pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / st.pinch.d, m.x, m.y);
      return;
    }
    st.ox += now.x - prev.x; st.oy += now.y - prev.y;
    clampPan();
    draw();
  });
  const up = e => {
    st.pts.delete(e.pointerId);
    if (st.pts.size < 2) st.pinch = null;
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => {
    if (!st.img) return;
    e.preventDefault();
    const p = local(e);
    setZoom(st.zoom * Math.exp(-e.deltaY / 400), p.x, p.y);
  }, {passive: false});
  stage.addEventListener('keydown', e => {
    if (!st.img) return;
    const step = e.shiftKey ? 32 : 8, mv = {ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step]}[e.key];
    if (mv) { e.preventDefault(); st.ox += mv[0]; st.oy += mv[1]; clampPan(); draw(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(st.zoom * 1.15); }
    else if (e.key === '-') { e.preventDefault(); setZoom(st.zoom / 1.15); }
  });
  zoomEl.addEventListener('input', () => setZoom(Number(zoomEl.value)));

  use.addEventListener('click', async () => {
    if (!st.img || use.disabled) return;
    use.disabled = true;
    ui.setLoading(use, true);
    const out = document.createElement('canvas');
    out.width = out.height = OUT;
    paint(out.getContext('2d'), OUT);
    let url = '';
    for (const q of [.86, .78, .68, .55]) { url = out.toDataURL('image/jpeg', q); if (url.length <= avatars.PIC_MAX * .6) break; }
    let r;
    try { r = await avatars.setMine(url); } catch (e) { r = 'failed'; }
    ui.setLoading(use, false);
    sh.close();
    ui.haptic('success');
    ui.toast(r === 'saved' ? 'Picture saved.' : r === 'later' ? 'Picture saved. It goes up once your phone is online.'
      : 'Saved on this phone. It goes up next time it can.', {icon: 'check-circle'});
  });
}
