// Lab tab root (#/lab): a tester tab for puzzle ideas, meant to be thrown away. Now: "Name that play", a
// Madden-style play diagram (formation, routes, blocks) and four names to pick from; a streak counter. Owner: LAB.
import * as ui from '../core/ui.js';
import {youButtonHTML} from './you.js';

// ---------------------------------------------------------------------------------------------- Plays
// Field: x 0-100 across, y down the screen (line of scrimmage at y 62, downfield is up). A route is a list of
// points from the player's spot; kind: 'run' (yellow), 'block' (a short line with a bar), 'fake' (dashed), 'pass'
// (route, white/colored), 'motion'. Players: OL (5 squares), QB, RB, WRs/TE (circles).
const LOS = 62;
const OL = [40, 45, 50, 55, 60].map(x => ({x, y: LOS + 1, t: 'ol'}));
const P = (x, y, t = 'skill', lab = '') => ({x, y, t, lab});
const QB_UC = P(50, LOS + 5, 'qb', 'QB'), QB_SG = P(50, LOS + 8, 'qb', 'QB');
const blocks = (dx = 0, dy = -4) => OL.map(o => ({kind: 'block', pts: [[o.x, o.y], [o.x + dx, o.y + dy]]}));

const PLAYS = [
  {name: 'Four Verticals', players: [QB_SG, P(50, 77, 'skill', 'RB'), P(8, LOS), P(24, LOS + 2), P(76, LOS + 2), P(92, LOS)],
    routes: [{pts: [[8, LOS], [8, 8]]}, {pts: [[24, LOS + 2], [30, 8]]}, {pts: [[76, LOS + 2], [70, 8]]}, {pts: [[92, LOS], [92, 8]]}, {pts: [[50, 77], [62, 54]], c: 2}, ...blocks(0, -3)]},
  {name: 'Mesh', players: [QB_SG, P(50, 77, 'skill', 'RB'), P(8, LOS), P(26, LOS + 2), P(74, LOS + 2), P(92, LOS)],
    routes: [{pts: [[26, LOS + 2], [30, 53], [82, 53]], c: 1}, {pts: [[74, LOS + 2], [70, 55], [18, 55]], c: 1}, {pts: [[8, LOS], [8, 12]]}, {pts: [[92, LOS], [92, 30], [80, 18]]}, {pts: [[50, 77], [30, 70], [20, 64]], c: 2}, ...blocks()]},
  {name: 'Smash', players: [QB_SG, P(50, 77, 'skill', 'RB'), P(8, LOS), P(24, LOS + 2), P(76, LOS + 2), P(92, LOS)],
    routes: [{pts: [[8, LOS], [8, 52], [11, 54]]}, {pts: [[24, LOS + 2], [24, 40], [10, 26]], c: 1}, {pts: [[92, LOS], [92, 52], [89, 54]]}, {pts: [[76, LOS + 2], [76, 40], [90, 26]], c: 1}, ...blocks()]},
  {name: 'Slants', players: [QB_UC, P(50, 76, 'skill', 'RB'), P(8, LOS), P(24, LOS + 2), P(92, LOS), P(66, LOS + 1, 'skill', 'TE')],
    routes: [{pts: [[8, LOS], [8, 57], [24, 46]]}, {pts: [[24, LOS + 2], [24, 57], [38, 47]]}, {pts: [[92, LOS], [92, 57], [76, 46]]}, {pts: [[66, LOS + 1], [66, 58], [58, 50]], c: 1}, ...blocks()]},
  {name: 'Curl Flat', players: [QB_SG, P(50, 77, 'skill', 'RB'), P(8, LOS), P(24, LOS + 2), P(76, LOS + 2), P(92, LOS)],
    routes: [{pts: [[8, LOS], [8, 42], [11, 46]]}, {pts: [[24, LOS + 2], [24, 58], [4, 58]], c: 1}, {pts: [[92, LOS], [92, 42], [89, 46]]}, {pts: [[76, LOS + 2], [76, 58], [96, 58]], c: 1}, ...blocks()]},
  {name: 'Y-Cross', players: [QB_SG, P(50, 77, 'skill', 'RB'), P(8, LOS), P(92, LOS), P(80, LOS + 2), P(66, LOS + 1, 'skill', 'TE')],
    routes: [{pts: [[66, LOS + 1], [66, 46], [14, 30]], c: 1}, {pts: [[8, LOS], [8, 8]]}, {pts: [[92, LOS], [92, 30], [78, 14]]}, {pts: [[80, LOS + 2], [80, 56], [96, 56]], c: 2}, {pts: [[50, 77], [34, 66], [26, 60]], c: 2}, ...blocks()]},
  {name: 'Stick', players: [QB_SG, P(50, 77, 'skill', 'RB'), P(8, LOS), P(92, LOS), P(80, LOS + 2), P(66, LOS + 1, 'skill', 'TE')],
    routes: [{pts: [[66, LOS + 1], [66, 52], [64, 54]], c: 1}, {pts: [[80, LOS + 2], [80, 60], [96, 60]], c: 2}, {pts: [[92, LOS], [92, 10]]}, {pts: [[8, LOS], [8, 50], [20, 42]]}, ...blocks()]},
  {name: 'Flood', players: [QB_UC, P(50, 76, 'skill', 'RB'), P(8, LOS), P(76, LOS + 2), P(92, LOS), P(66, LOS + 1, 'skill', 'TE')],
    routes: [{pts: [[92, LOS], [92, 10]]}, {pts: [[76, LOS + 2], [76, 44], [94, 44]], c: 1}, {pts: [[66, LOS + 1], [66, 58], [92, 58]], c: 2}, {pts: [[8, LOS], [8, 44], [26, 34]]}, ...blocks()]},
  {name: 'Hail Mary', players: [QB_SG, P(8, LOS), P(24, LOS + 2), P(76, LOS + 2), P(92, LOS), P(50, 77, 'skill', 'RB')],
    routes: [{pts: [[8, LOS], [8, 30], [44, 6]]}, {pts: [[24, LOS + 2], [28, 30], [48, 8]]}, {pts: [[76, LOS + 2], [72, 30], [52, 8]]}, {pts: [[92, LOS], [92, 30], [56, 6]]}, ...blocks(0, 3)]},
  {name: 'HB Dive', players: [QB_UC, P(50, 77, 'skill', 'RB'), P(8, LOS), P(92, LOS), P(66, LOS + 1, 'skill', 'TE')],
    routes: [{kind: 'run', pts: [[50, 77], [48, 66], [47, 52]]}, {kind: 'fake', pts: [[50, LOS + 5], [50, 70]]}, ...blocks(0, -5), {kind: 'block', pts: [[66, LOS + 1], [67, LOS - 4]]}, {kind: 'block', pts: [[8, LOS], [10, LOS - 6]]}, {kind: 'block', pts: [[92, LOS], [90, LOS - 6]]}]},
  {name: 'Outside Zone', players: [QB_UC, P(50, 77, 'skill', 'RB'), P(8, LOS), P(92, LOS), P(66, LOS + 1, 'skill', 'TE')],
    routes: [{kind: 'run', pts: [[50, 77], [62, 73], [74, 66], [80, 52]]}, ...blocks(5, -4), {kind: 'block', pts: [[66, LOS + 1], [72, LOS - 3]]}, {kind: 'block', pts: [[92, LOS], [88, LOS - 6]]}, {kind: 'block', pts: [[8, LOS], [14, LOS - 6]]}]},
  {name: 'Power', players: [QB_UC, P(50, 77, 'skill', 'RB'), P(8, LOS), P(92, LOS), P(66, LOS + 1, 'skill', 'TE')],
    routes: [{kind: 'run', pts: [[50, 77], [56, 71], [61, 62], [62, 50]]}, {kind: 'block', pts: [[45, LOS + 1], [46, LOS + 5], [58, LOS + 5], [61, LOS - 3]]},
      ...OL.filter(o => o.x !== 45).map(o => ({kind: 'block', pts: [[o.x, o.y], [o.x - 4, o.y - 4]]})), {kind: 'block', pts: [[66, LOS + 1], [62, LOS - 3]]}, {kind: 'block', pts: [[92, LOS], [88, LOS - 6]]}]},
  {name: 'PA Boot', players: [QB_UC, P(50, 77, 'skill', 'RB'), P(8, LOS), P(92, LOS), P(66, LOS + 1, 'skill', 'TE')],
    routes: [{kind: 'fake', pts: [[50, 77], [40, 70], [34, 64]]}, {kind: 'qb', pts: [[50, LOS + 5], [46, 70], [60, 74], [78, 72]]}, {pts: [[66, LOS + 1], [66, 58], [90, 52]], c: 1},
      {pts: [[8, LOS], [8, 48], [70, 32]]}, {pts: [[92, LOS], [92, 18], [94, 28]]}, ...blocks(-4, -4)]},
  {name: 'HB Screen', players: [QB_SG, P(56, 74, 'skill', 'RB'), P(8, LOS), P(24, LOS + 2), P(92, LOS), P(76, LOS + 2)],
    routes: [{kind: 'run', pts: [[56, 74], [70, 72], [80, 68]]}, {pts: [[8, LOS], [8, 10]]}, {pts: [[24, LOS + 2], [28, 10]]}, {pts: [[92, LOS], [92, 30]]}, {pts: [[76, LOS + 2], [70, 40]]},
      ...[50, 55, 60].map(x => ({kind: 'block', pts: [[x, LOS + 1], [x + 10, LOS - 4]]})), ...[40, 45].map(x => ({kind: 'block', pts: [[x, LOS + 1], [x, LOS - 4]]}))]}
];

PLAYS.forEach(p => { p.side = 'off'; });

// ---------------------------------------------------------------------------------------------- Defense
// Defensive play art the Madden way, against a 2x2 shotgun (drawn dim): defenders as X marks, each with its job:
// zone (an oval: deep blue, hook yellow, curl-flat purple, flat cyan; a thin line from the man to it), man (a dashed
// red line to his receiver), blitz (a red arrow into the backfield). The four down linemen rush unless told.
const WR = {x1: [8, LOS], s1: [24, LOS + 2], s2: [76, LOS + 2], x2: [92, LOS], rb: [50, 77]};
const ZC = {deep: '#3D8BFF', hook: '#FFE14D', curl: '#B57BFF', flat: '#4CC9FF'};
const Z = (cx, cy, rx, ry, c) => ({zone: [cx, cy, rx, ry], c});
const DL = (o = {}) => [{x: 37, y: 57, ...o.de1}, {x: 46, y: 57, ...o.dt1}, {x: 54, y: 57, ...o.dt2}, {x: 63, y: 57, ...o.de2}];
const D = (x, y, job) => Object.assign({x, y}, job);
const blitz = (...pts) => ({blitz: pts});
const DEFENSE = [
  {name: 'Cover 2', d: [...DL(), D(8, 52, Z(10, 47, 9, 5, 'flat')), D(92, 52, Z(90, 47, 9, 5, 'flat')), D(24, 50, Z(28, 43, 9, 5, 'hook')),
    D(42, 47, Z(43, 41, 8, 5, 'hook')), D(58, 47, Z(60, 41, 8, 5, 'hook')), D(32, 26, Z(24, 18, 20, 9, 'deep')), D(68, 26, Z(76, 18, 20, 9, 'deep'))]},
  {name: 'Cover 3', d: [...DL(), D(8, 52, Z(14, 18, 13, 10, 'deep')), D(92, 52, Z(86, 18, 13, 10, 'deep')), D(50, 26, Z(50, 14, 15, 9, 'deep')),
    D(24, 50, Z(16, 45, 10, 5, 'curl')), D(76, 48, Z(84, 45, 10, 5, 'curl')), D(42, 47, Z(41, 40, 8, 5, 'hook')), D(58, 47, Z(59, 40, 8, 5, 'hook'))]},
  {name: 'Cover 4', d: [...DL(), D(8, 52, Z(12, 20, 11, 10, 'deep')), D(92, 52, Z(88, 20, 11, 10, 'deep')), D(32, 30, Z(37, 18, 11, 10, 'deep')),
    D(68, 30, Z(63, 18, 11, 10, 'deep')), D(24, 50, Z(14, 47, 9, 5, 'flat')), D(42, 47, Z(42, 41, 8, 5, 'hook')), D(58, 47, Z(62, 41, 9, 5, 'hook'))]},
  {name: 'Cover 1', d: [...DL(), D(8, 52, {man: WR.x1}), D(92, 52, {man: WR.x2}), D(24, 50, {man: WR.s1}), D(76, 49, {man: WR.s2}),
    D(42, 47, {man: WR.rb}), D(58, 47, Z(52, 40, 8, 5, 'hook')), D(50, 24, Z(50, 15, 18, 9, 'deep'))]},
  {name: 'Cover 0', d: [...DL(), D(8, 52, {man: WR.x1}), D(92, 52, {man: WR.x2}), D(24, 50, {man: WR.s1}), D(76, 49, {man: WR.s2}),
    D(42, 47, {man: WR.rb}), D(58, 47, blitz([56, 66])), D(50, 40, blitz([50, 54], [49, 66]))]},
  {name: 'Tampa 2', d: [...DL(), D(8, 52, Z(10, 47, 9, 5, 'flat')), D(92, 52, Z(90, 47, 9, 5, 'flat')), D(30, 48, Z(30, 42, 9, 5, 'hook')),
    D(70, 48, Z(70, 42, 9, 5, 'hook')), D(50, 46, Z(50, 30, 9, 7, 'deep')), D(30, 24, Z(22, 16, 19, 8, 'deep')), D(70, 24, Z(78, 16, 19, 8, 'deep'))]},
  {name: 'Cover 2 Man', d: [...DL(), D(8, 52, {man: WR.x1}), D(92, 52, {man: WR.x2}), D(24, 50, {man: WR.s1}), D(76, 49, {man: WR.s2}),
    D(46, 47, {man: WR.rb}), D(32, 26, Z(24, 18, 20, 9, 'deep')), D(68, 26, Z(76, 18, 20, 9, 'deep'))]},
  {name: 'Fire Zone', d: [...DL({de2: Z(84, 49, 9, 5, 'flat')}), D(8, 52, Z(14, 18, 13, 10, 'deep')), D(92, 52, Z(86, 18, 13, 10, 'deep')),
    D(50, 26, Z(50, 14, 15, 9, 'deep')), D(24, 50, Z(16, 45, 10, 5, 'curl')), D(66, 46, Z(56, 40, 9, 5, 'hook')),
    D(42, 47, blitz([42, 56], [44, 66])), D(56, 47, blitz([57, 56], [55, 66]))]},
  {name: 'Corner Blitz', d: [...DL(), D(8, 52, blitz([20, 58], [40, 68])), D(92, 52, Z(86, 18, 13, 10, 'deep')), D(30, 30, {man: WR.x1}),
    D(60, 26, Z(48, 14, 18, 9, 'deep')), D(24, 50, {man: WR.s1}), D(76, 49, {man: WR.s2}), D(42, 47, {man: WR.rb}), D(58, 47, Z(54, 40, 8, 5, 'hook'))]},
  {name: 'Prevent', d: [DL()[0], DL()[1], DL()[3], D(8, 46, Z(10, 22, 9, 12, 'deep')), D(92, 46, Z(90, 22, 9, 12, 'deep')), D(30, 30, Z(30, 12, 10, 8, 'deep')),
    D(50, 28, Z(50, 10, 10, 8, 'deep')), D(70, 30, Z(70, 12, 10, 8, 'deep')), D(30, 46, Z(28, 40, 10, 5, 'hook')), D(50, 46, Z(50, 38, 9, 5, 'hook')), D(70, 46, Z(72, 40, 10, 5, 'hook'))]}
];
DEFENSE.forEach(p => { p.side = 'def'; });
const OFF_BACK = [P(8, LOS), P(24, LOS + 2), P(76, LOS + 2), P(92, LOS), P(50, 77, 'skill', 'RB'), QB_SG];

// ---------------------------------------------------------------------------------------------- Drawing
const SX = 3.6, SY = 3.2; // viewBox 360 x 256 (x 0-100 -> 0-360, y 0-80 -> 0-256)
const pt = ([x, y]) => `${(x * SX).toFixed(1)},${(y * SY).toFixed(1)}`;
const ROUTE_C = ['#FFE14D', '#FF5A4A', '#4CC9FF'];
function routeSVG(r, i) {
  const d = 'M' + r.pts.map(pt).join(' L');
  if (r.kind === 'block') {
    const [a, b] = r.pts.slice(-2), ang = Math.atan2((b[1] - a[1]) * SY, (b[0] - a[0]) * SX) + Math.PI / 2;
    const bx = b[0] * SX, by = b[1] * SY, dx = Math.cos(ang) * 7, dy = Math.sin(ang) * 7;
    return `<path d="${d}" class="lb-blk"/><path d="M${(bx - dx).toFixed(1)},${(by - dy).toFixed(1)} L${(bx + dx).toFixed(1)},${(by + dy).toFixed(1)}" class="lb-blk"/>`;
  }
  const color = r.kind === 'blitz' ? '#FF3B30' : r.kind === 'run' ? '#FFC531' : r.kind === 'fake' ? '#B9C1DC' : r.kind === 'qb' ? '#7CF058' : ROUTE_C[r.c || 0];
  return `<path d="${d}" class="lb-rt${r.kind === 'fake' ? ' is-fake' : ''}" stroke="${color}" marker-end="url(#lb-arrow-${i})"/>`
    + `<marker id="lb-arrow-${i}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;
}
function defenseSVG(play) {
  let zones = '', jobs = '', men = '';
  play.d.forEach((m, i) => {
    const x = m.x * SX, y = m.y * SY;
    if (m.zone) {
      const [cx, cy, rx, ry] = m.zone, col = ZC[m.c] || ZC.hook;
      zones += `<ellipse cx="${cx * SX}" cy="${cy * SY}" rx="${rx * SX}" ry="${ry * SY}" fill="${col}" fill-opacity=".38" stroke="${col}" stroke-width="2"/>`;
      jobs += `<line x1="${x}" y1="${y}" x2="${cx * SX}" y2="${cy * SY}" stroke="${col}" stroke-width="2" opacity=".9"/>`;
    } else if (m.man) jobs += `<line x1="${x}" y1="${y}" x2="${m.man[0] * SX}" y2="${m.man[1] * SY}" class="lb-man-ln"/>`;
    else if (m.blitz) jobs += routeSVG({kind: 'blitz', pts: [[m.x, m.y], ...m.blitz]}, 'b' + i);
    else jobs += routeSVG({kind: 'blitz', pts: [[m.x, m.y], [m.x, m.y + 4.5]]}, 'r' + i); // a down lineman's rush
    men += `<g class="lb-x" transform="translate(${x},${y})"><path d="M-6,-6 L6,6 M6,-6 L-6,6"/></g>`;
  });
  const off = OL.map(o => `<rect x="${o.x * SX - 7}" y="${o.y * SY - 7}" width="14" height="14" class="lb-ol is-dim"/>`).join('')
    + OFF_BACK.map(p => `<circle cx="${p.x * SX}" cy="${p.y * SY}" r="7.5" class="lb-man is-dim${p.t === 'qb' ? ' is-qb' : ''}"/>`).join('');
  return zones + jobs + off + men;
}
function playSVG(play) {
  const yards = [10, 22, 34, 46].map(y => `<line x1="0" x2="360" y1="${y * SY}" y2="${y * SY}" class="lb-yd"/>`).join('');
  const los = `<line x1="0" x2="360" y1="${LOS * SY - 6}" y2="${LOS * SY - 6}" class="lb-los"/>`;
  if (play.side === 'def') return `<svg class="lb-field" viewBox="0 0 360 256" role="img" aria-label="A defensive play diagram">${yards}${los}${defenseSVG(play)}</svg>`;
  const routes = play.routes.map((r, i) => routeSVG(r, i)).join('');
  const men = OL.map(o => `<rect x="${o.x * SX - 7}" y="${o.y * SY - 7}" width="14" height="14" class="lb-ol"/>`).join('')
    + play.players.map(p => `<circle cx="${p.x * SX}" cy="${p.y * SY}" r="7.5" class="lb-man${p.t === 'qb' ? ' is-qb' : ''}"/>`).join('');
  return `<svg class="lb-field" viewBox="0 0 360 256" role="img" aria-label="A play diagram">${yards}${los}${routes}${men}</svg>`;
}

// ---------------------------------------------------------------------------------------------- Game
const ST = new WeakMap();
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// Mode: 'all' | 'off' | 'def' (kept on this phone). Wrong answers come from the same side of the ball.
const MODES = [{id: 'all', label: 'Both'}, {id: 'off', label: 'Offense'}, {id: 'def', label: 'Defense'}];
const poolOf = mode => mode === 'off' ? PLAYS : mode === 'def' ? DEFENSE : PLAYS.concat(DEFENSE);
function newRound(st) {
  const pool = poolOf(st.mode);
  let play;
  do { play = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && play.name === st.last);
  st.last = play.name;
  const right = play.name, side = play.side === 'def' ? DEFENSE : PLAYS;
  st.round = {play, right, choices: shuffle([right, ...shuffle(side.filter(p => p.name !== right).map(p => p.name)).slice(0, 3)]), picked: null};
}
function roundHTML(st) {
  const r = st.round;
  const btns = r.choices.map(c => {
    const cls = !r.picked ? '' : c === r.right ? ' is-right' : c === r.picked ? ' is-wrong' : ' is-dim';
    return `<button type="button" class="lb-ch${cls}" data-lb-pick="${c}"${r.picked ? ' aria-disabled="true"' : ''}>${c}</button>`;
  }).join('');
  const res = !r.picked ? '' : r.picked === r.right ? `<p class="lb-res is-right">${ui.icon('check-circle')} Nailed it. Streak ${st.streak}.</p>` : `<p class="lb-res is-wrong">${ui.icon('x-circle')} It's ${r.right}. Streak over.</p>`;
  return `<p class="lb-side">${r.play.side === 'def' ? 'Defense: name the coverage' : 'Offense: name the play'}</p><div class="card lb-card">${playSVG(r.play)}</div>`
    + `<div class="lb-chs">${btns}</div>${res}`
    + (r.picked ? ui.button({label: 'Next play', kind: 'primary', attrs: {'data-lb-next': ''}, cls: 'lb-next'}) : '')
    + `<p class="lb-meta">Streak ${st.streak} · Best ${st.best} · ${poolOf(st.mode).length} plays in the book</p>`;
}

const modeNow = () => { const m = ui.lsGet('gg-lab-mode'); return m === 'off' || m === 'def' ? m : 'all'; };
export default {
  id: 'lab',
  title: 'Lab',
  render() {
    return ui.largeTitle({eyebrow: 'Tester · Not final', title: 'Lab', subtitle: 'Name that play: read the diagram, pick the play.', trailing: youButtonHTML()})
      + `<div class="lb-mode">${ui.seg({name: 'lb-mode', items: MODES, value: modeNow(), label: 'Which plays'})}</div><div class="lb-body"></div>`;
  },
  mount(el, ctx) {
    const st = {el, body: el.querySelector('.lb-body'), streak: 0, best: Number(ui.lsGet('gg-lab-best')) || 0, last: '', round: null, mode: modeNow()};
    el.addEventListener('ui:change', e => {
      if (!e.detail || e.detail.name !== 'lb-mode') return;
      st.mode = e.detail.value; ui.lsSet('gg-lab-mode', st.mode);
      newRound(st); ui.crossfade(st.body, () => { st.body.innerHTML = roundHTML(st); });
    });
    ST.set(ctx, st);
    newRound(st);
    st.body.innerHTML = roundHTML(st);
    el.addEventListener('click', e => {
      const pick = e.target.closest('[data-lb-pick]');
      if (pick && !st.round.picked) {
        st.round.picked = pick.dataset.lbPick;
        const ok = st.round.picked === st.round.right;
        st.streak = ok ? st.streak + 1 : 0;
        if (st.streak > st.best) { st.best = st.streak; ui.lsSet('gg-lab-best', st.best); }
        ui.haptic(ok ? 'success' : 'error');
        st.body.innerHTML = roundHTML(st);
        return;
      }
      if (e.target.closest('[data-lb-next]')) { newRound(st); ui.crossfade(st.body, () => { st.body.innerHTML = roundHTML(st); }); }
    });
  },
  unmount(el, ctx) { ST.delete(ctx); }
};
