// The stadium at the far end of the field, for the games drawn in 3D (Kick It, Return Man): the night sky and its
// stars, the bowl of stands (its rim curving up toward us at the sides) with the upper deck, the suites, a ribbon board
// with the game's words going round, the lower deck and the wall at field level, the fans in rows, and four banks of
// lights on the rim. backdrop() draws it once into a canvas of its own (copied in each frame); bowl() is its shape
// (each line across it, the lights), for what's drawn over it. st: {W (px), y0 (the horizon, px), dpr}.
// Exports: backdrop(st, words), bowl(st), fan(c, x, y, sz, rnd), seeded(s), sparkle(c, x, y, s, a), CROWD, SKIN.
// Owner: KICK.
export const CROWD = ['#1B2A5C', '#1F2C5A', '#2A3A6E', '#34467E', '#C3CAD9', '#9AA3B8', '#8E1C1C', '#24262E', '#C9A640', '#5D6A92', '#1B2A5C', '#C3CAD9'];
export const SKIN = ['#8A5A36', '#C68C5E', '#5E3B22', '#E2B48A', '#A46B40', '#7A4A2B'];
/** A fan in the stands at (x, y), sz px: shoulders in a shirt, a head (or a cap), now and then both arms up. */
export function fan(c, x, y, sz, rnd) {
  c.fillStyle = CROWD[Math.floor(rnd() * CROWD.length)];
  c.fillRect(x - sz * .37, y - sz * .14, sz * .74, sz * .48);
  if (rnd() < .05) { c.fillRect(x - sz * .4, y - sz * .8, sz * .13, sz * .62); c.fillRect(x + sz * .27, y - sz * .8, sz * .13, sz * .62); }
  c.fillStyle = rnd() < .18 ? CROWD[Math.floor(rnd() * 4)] : SKIN[Math.floor(rnd() * SKIN.length)];
  c.beginPath(); c.arc(x, y - sz * .32, sz * .2, 0, Math.PI * 2); c.fill();
}
export function seeded(s) {
  s = Math.abs(Math.round(s * 2654435761) % 2147483647) || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
/** The stands' shape on this stage: each line across them (y at screen x) and where the lights stand. */
export function bowl(st) {
  const {W, y0} = st, Sh = Math.max(46, Math.min(150, (y0 - 80) * .62));
  const line = (at, bow) => x => { const u = (x - W / 2) / (W / 2); return y0 - Sh * at - Sh * bow * u * u; };
  const rim = line(1, .34);
  const lights = [-.8, -.36, .36, .8].map(u => {
    const x = W / 2 + u * W / 2, big = Math.abs(u) > .5;
    return {x, y: rim(x) - Sh * (big ? .3 : .18), r: big ? 1 : .7};
  });
  return {Sh, rim, fascia: line(.93, .31), suites: line(.52, .17), suitesEnd: line(.45, .15), ribbonEnd: line(.4, .13),
    wall: () => y0, lights};
}
export function backdrop(st, words = ['KICK IT', '★', 'GRIDIRON', '★', 'FIELD GOAL', '★']) {
  const {W, y0, dpr} = st, B = bowl(st), r = seeded(7);
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * dpr); cv.height = Math.round((y0 + 2) * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const xs = [];
  for (let x = 0; x < W; x += 6) xs.push(x);
  xs.push(W);
  const trace = (yAt, back) => (back ? xs.slice().reverse() : xs).forEach((x, i) => (i || back ? c.lineTo(x, yAt(x)) : c.moveTo(x, yAt(x))));
  const band = (top, bot, fill) => { c.fillStyle = fill; c.beginPath(); trace(top); trace(bot, true); c.closePath(); c.fill(); };
  const along = (top, bot, u) => x => top(x) + (bot(x) - top(x)) * u;
  // the sky: deep navy, lighter down toward the rim where the lights glow; stars
  const sky = c.createLinearGradient(0, 0, 0, y0);
  sky.addColorStop(0, '#02040C'); sky.addColorStop(.45, '#06102C'); sky.addColorStop(1, '#162A63');
  c.fillStyle = sky; c.fillRect(0, 0, W, y0 + 2);
  const glow = c.createRadialGradient(W / 2, B.rim(W / 2), 10, W / 2, B.rim(W / 2), W * .95);
  glow.addColorStop(0, 'rgba(110,150,255,.24)'); glow.addColorStop(1, 'rgba(110,150,255,0)');
  c.fillStyle = glow; c.fillRect(0, 0, W, y0);
  for (let i = 0, n = Math.round(W * .3); i < n; i++) {
    const x = r() * W, y = r() * (B.rim(x) - 6), big = r() < .12;
    c.fillStyle = `rgba(235,240,255,${(.2 + r() * .6).toFixed(2)})`; c.fillRect(x, y, big ? 1.6 : 1, big ? 1.6 : 1);
  }
  // a deck of fans, row on row, back to front; aisles of steps every so often
  const deck = (top, bot, pitch, aisles) => {
    band(top, bot, '#0A1129');
    const rows = Math.max(2, Math.round((bot(W / 2) - top(W / 2)) / pitch)), steps = Array.from({length: aisles}, (_, j) => W * (j + 1) / (aisles + 1));
    for (let j = 0; j < rows; j++) {
      const yAt = along(top, bot, (j + .7) / rows), p = (bot(W / 2) - top(W / 2)) / rows;
      c.strokeStyle = 'rgba(120,150,230,.12)'; c.lineWidth = 1; c.beginPath(); trace(x => yAt(x) + p * .3); c.stroke();
      for (let x = r() * p; x < W; x += p * (.9 + r() * .45)) {
        if (steps.some(a => Math.abs(x - a) < p * .8) || r() < .07) continue;
        fan(c, x, yAt(x), p * (1 + .3 * Math.abs((x - W / 2) / (W / 2))), r);
      }
    }
    steps.forEach(a => { c.fillStyle = 'rgba(160,180,230,.10)'; c.beginPath(); c.moveTo(a - pitch * .5, top(a)); c.lineTo(a + pitch * .5, top(a)); c.lineTo(a + pitch * .6, bot(a)); c.lineTo(a - pitch * .6, bot(a)); c.fill(); });
  };
  const pu = Math.max(2.2, B.Sh * .027), pl = Math.max(2.6, B.Sh * .033);
  deck(B.fascia, B.suites, pu, 6);
  deck(B.ribbonEnd, B.wall, pl, 5);
  // the light falls on the lower deck; the top of the upper deck is in the dark
  const dim = c.createLinearGradient(0, B.rim(W / 2), 0, B.suites(W / 2));
  dim.addColorStop(0, 'rgba(2,4,14,.5)'); dim.addColorStop(1, 'rgba(2,4,14,0)');
  band(B.fascia, B.suites, dim);
  band(B.ribbonEnd, B.wall, 'rgba(255,240,215,.04)');
  // and the crowd stays back, so the posts stand out against it
  band(B.fascia, B.suites, 'rgba(3,6,18,.3)'); band(B.ribbonEnd, B.wall, 'rgba(3,6,18,.24)');
  // the rim: a pale band with lights along it
  const fa = c.createLinearGradient(0, B.rim(W / 2) - B.Sh * .34, 0, B.fascia(W / 2));
  fa.addColorStop(0, '#46558A'); fa.addColorStop(1, '#232D55');
  band(B.rim, B.fascia, fa);
  c.strokeStyle = 'rgba(200,215,255,.6)'; c.lineWidth = 1.2; c.beginPath(); trace(B.rim); c.stroke();
  for (let x = 7; x < W; x += 13) { c.fillStyle = 'rgba(255,248,225,.75)'; c.fillRect(x, along(B.rim, B.fascia, .5)(x) - .6, 1.4, 1.2); }
  // the suites: a row of lit windows
  band(B.suites, B.suitesEnd, '#0D152E');
  for (let x = 2; x < W - 4; x += 9) {
    const t = B.suites(x + 3.5), h = B.suitesEnd(x + 3.5) - t;
    c.fillStyle = r() < .2 ? 'rgba(40,52,90,.8)' : `rgba(255,${200 + Math.floor(r() * 30)},140,${(.35 + r() * .45).toFixed(2)})`;
    c.fillRect(x, t + h * .2, 7, h * .6);
  }
  // the ribbon board: lit letters going round
  band(B.suitesEnd, B.ribbonEnd, '#061024');
  const rh = B.ribbonEnd(W / 2) - B.suitesEnd(W / 2);
  if (rh >= 3.5) {
    c.font = `800 ${(rh * .82).toFixed(1)}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textBaseline = 'middle'; c.textAlign = 'left';
    for (let x = 4, i = 0; x < W; i++) {
      const w = words[i % words.length], ww = c.measureText(w).width, mid = along(B.suitesEnd, B.ribbonEnd, .55)(x + ww / 2);
      c.fillStyle = w === '★' ? '#F2C94C' : i % 4 === 0 ? '#3EF08F' : '#EAF1FF';
      c.fillText(w, x, mid);
      x += ww + rh * .9;
    }
  }
  c.strokeStyle = 'rgba(62,240,143,.35)'; c.lineWidth = 1; c.beginPath(); trace(B.ribbonEnd); c.stroke();
  // (the wall round the field and the stands' first rows are the field's: paintField, behind the end zone)
  // the lights: banks of lamps on masts over the rim, each with its glow
  const k = Math.max(.75, Math.min(1.35, W / 390));
  B.lights.forEach(L => {
    const bw = 40 * k * L.r, bh = 17 * k * L.r;
    c.fillStyle = 'rgba(16,22,44,.95)'; c.fillRect(L.x - 1.5, L.y, 3, B.rim(L.x) - L.y + 2);
    const halo = c.createRadialGradient(L.x, L.y, 2, L.x, L.y, W * .42 * L.r);
    halo.addColorStop(0, 'rgba(225,235,255,.6)'); halo.addColorStop(.08, 'rgba(170,195,255,.28)'); halo.addColorStop(1, 'rgba(120,150,255,0)');
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = halo; c.fillRect(0, 0, W, y0); c.restore();
    c.fillStyle = '#1A2340'; c.fillRect(L.x - bw / 2, L.y - bh / 2, bw, bh);
    c.strokeStyle = 'rgba(170,190,240,.45)'; c.lineWidth = 1; c.strokeRect(L.x - bw / 2 + .5, L.y - bh / 2 + .5, bw - 1, bh - 1);
    const cols = 5, rws = 2, gx = bw / cols, gy = bh / rws;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rws; j++) {
      const x = L.x - bw / 2 + gx * (i + .5), y = L.y - bh / 2 + gy * (j + .5), rr = Math.min(gx, gy) * .36;
      c.fillStyle = 'rgba(200,220,255,.35)'; c.beginPath(); c.arc(x, y, rr * 1.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#FBFDFF'; c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.fill();
    }
    // a flare across it
    const fl = c.createLinearGradient(L.x - W * .16, 0, L.x + W * .16, 0);
    fl.addColorStop(0, 'rgba(200,220,255,0)'); fl.addColorStop(.5, 'rgba(225,235,255,.45)'); fl.addColorStop(1, 'rgba(200,220,255,0)');
    c.fillStyle = fl; c.fillRect(L.x - W * .16, L.y - .6, W * .32, 1.2);
  });
  return cv;
}
/** A four-pointed twinkle. */
export function sparkle(c, x, y, s, a) {
  c.fillStyle = `rgba(255,252,235,${a.toFixed(2)})`;
  c.beginPath(); c.moveTo(x, y - s);
  c.quadraticCurveTo(x + s * .12, y - s * .12, x + s, y); c.quadraticCurveTo(x + s * .12, y + s * .12, x, y + s);
  c.quadraticCurveTo(x - s * .12, y + s * .12, x - s, y); c.quadraticCurveTo(x - s * .12, y - s * .12, x, y - s);
  c.fill();
}
