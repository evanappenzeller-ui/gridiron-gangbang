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
  const color = r.kind === 'run' ? '#FFC531' : r.kind === 'fake' ? '#B9C1DC' : r.kind === 'qb' ? '#7CF058' : ROUTE_C[r.c || 0];
  return `<path d="${d}" class="lb-rt${r.kind === 'fake' ? ' is-fake' : ''}" stroke="${color}" marker-end="url(#lb-arrow-${i})"/>`
    + `<marker id="lb-arrow-${i}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;
}
function playSVG(play) {
  const yards = [10, 22, 34, 46].map(y => `<line x1="0" x2="360" y1="${y * SY}" y2="${y * SY}" class="lb-yd"/>`).join('');
  const los = `<line x1="0" x2="360" y1="${LOS * SY - 6}" y2="${LOS * SY - 6}" class="lb-los"/>`;
  const routes = play.routes.map((r, i) => routeSVG(r, i)).join('');
  const men = OL.map(o => `<rect x="${o.x * SX - 7}" y="${o.y * SY - 7}" width="14" height="14" class="lb-ol"/>`).join('')
    + play.players.map(p => `<circle cx="${p.x * SX}" cy="${p.y * SY}" r="7.5" class="lb-man${p.t === 'qb' ? ' is-qb' : ''}"/>`).join('');
  return `<svg class="lb-field" viewBox="0 0 360 256" role="img" aria-label="A play diagram">${yards}${los}${routes}${men}</svg>`;
}

// ---------------------------------------------------------------------------------------------- Game
const ST = new WeakMap();
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function newRound(st) {
  let i;
  do { i = Math.floor(Math.random() * PLAYS.length); } while (PLAYS.length > 1 && i === st.last);
  st.last = i;
  const right = PLAYS[i].name;
  st.round = {play: PLAYS[i], right, choices: shuffle([right, ...shuffle(PLAYS.filter(p => p.name !== right).map(p => p.name)).slice(0, 3)]), picked: null};
}
function roundHTML(st) {
  const r = st.round;
  const btns = r.choices.map(c => {
    const cls = !r.picked ? '' : c === r.right ? ' is-right' : c === r.picked ? ' is-wrong' : ' is-dim';
    return `<button type="button" class="lb-ch${cls}" data-lb-pick="${c}"${r.picked ? ' aria-disabled="true"' : ''}>${c}</button>`;
  }).join('');
  const res = !r.picked ? '' : r.picked === r.right ? `<p class="lb-res is-right">${ui.icon('check-circle')} Nailed it. Streak ${st.streak}.</p>` : `<p class="lb-res is-wrong">${ui.icon('x-circle')} It's ${r.right}. Streak over.</p>`;
  return `<div class="card lb-card">${playSVG(r.play)}</div>`
    + `<div class="lb-chs">${btns}</div>${res}`
    + (r.picked ? ui.button({label: 'Next play', kind: 'primary', attrs: {'data-lb-next': ''}, cls: 'lb-next'}) : '')
    + `<p class="lb-meta">Streak ${st.streak} · Best ${st.best} · ${PLAYS.length} plays in the book</p>`;
}

export default {
  id: 'lab',
  title: 'Lab',
  render() {
    return ui.largeTitle({eyebrow: 'Tester · Not final', title: 'Lab', subtitle: 'Name that play: read the diagram, pick the play.', trailing: youButtonHTML()})
      + `<div class="lb-body"></div>`;
  },
  mount(el, ctx) {
    const st = {el, body: el.querySelector('.lb-body'), streak: 0, best: Number(ui.lsGet('gg-lab-best')) || 0, last: -1, round: null};
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
