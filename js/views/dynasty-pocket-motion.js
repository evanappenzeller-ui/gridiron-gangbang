// Table motion for resolved, public v7 events (Nov 7 2026, Evan: "There needs to be more animations to immerse the
// player into the game"). The table is always rendered from the saved match; masks only hold the previous public
// values (HP, Energy pips, points, deck count, drawn cards, new athletes, the turn marker and the Energy Zone) until
// the matching step plays. Presentation never resolves a move, rerolls a coin or reveals a hidden card identity.
import {esc} from '../core/data.js';

const COLOR = {Grass:'#398452',Fire:'#c65035',Water:'#3477ac',Lightning:'#a57916',Psychic:'#995c9c',Fighting:'#a1663c',Darkness:'#3e536e',Metal:'#69797a',Dragon:'#7c6c35',Colorless:'#77776d'};
const CANCELLED = Symbol('cancelled');
const BACK = '<span class="rp-card-back"><img src="img/rivals/card-back-v1.webp" alt="" decoding="async" draggable="false"></span>';
const fresh = () => ({hp:{}, en:{}, hidden:new Set(), offset:{}, pts:{}, deck:{}, hand:0, turn:undefined, zone:new Set()});
const slotsOf = model => new Map(model.sides.flatMap((s, side) => s.slots.map(x => [x.u, {...x, side}])));
const pct = v => Math.max(0, Math.min(100, v));

export function createStage(root, {host, sound, origin}) {
  const layer = document.createElement('div');
  layer.className = 'rp-fx'; layer.setAttribute('aria-hidden', 'true');
  root.append(layer);
  let shown = fresh(), gen = 0, model = null, you = 0, rate = 1;
  const ghosts = new Map(), running = new Set();

  // ---- masks: final values live in the markup's data attributes; masks override them until revealed
  function apply() {
    const h = host(); if (!h) return;
    h.querySelectorAll('[data-rp-slot]').forEach(el => {
      const u = el.dataset.rpSlot, max = Number(el.dataset.rpMax) || 1, hp = shown.hp[u] ?? Number(el.dataset.rpHp);
      const text = el.querySelector('.rp-live-hp'), bar = el.querySelector('.rp-hp i');
      if (text && Number.isFinite(hp)) text.textContent = hp;
      if (bar && Number.isFinite(hp)) bar.style.width = pct(hp / max * 100) + '%';
      const n = shown.en[u];
      el.querySelectorAll('.rp-card-energy .rp-energy').forEach((pip, i) => pip.classList.toggle('is-pending', n != null && i >= n));
      el.classList.toggle('is-pending', shown.hidden.has(u));
      const o = shown.offset[u]; el.style.translate = o ? `${o.x}px ${o.y}px` : '';
    });
    h.querySelectorAll('[data-rp-points]').forEach(plate => {
      const n = shown.pts[plate.dataset.rpPoints];
      plate.querySelectorAll('.rp-points i').forEach((m, i) => m.classList.toggle('is-masked', n != null && i >= n));
    });
    h.querySelectorAll('[data-rp-deck]').forEach(d => {
      const b = d.querySelector('[data-count]'); if (!b) return;
      const n = shown.deck[d.dataset.rpDeck] ?? Number(b.dataset.count);
      b.firstChild.nodeValue = String(n); d.classList.toggle('is-empty', n === 0);
    });
    const cards = [...h.querySelectorAll('.rp-hand > [data-rp-hand]')];
    cards.forEach((c, i) => c.classList.toggle('is-pending', i >= cards.length - shown.hand));
    h.querySelectorAll('[data-rp-zone]').forEach(z => z.classList.toggle('is-pending', shown.zone.has(Number(z.dataset.rpZone))));
    const arena = h.querySelector('.rp-arena');
    if (arena) arena.dataset.turn = shown.turn === undefined ? arena.dataset.turnFinal : shown.turn == null ? 'none' : shown.turn === you ? 'mine' : 'theirs';
  }

  // ---- helpers
  const live = g => { if (g !== gen) throw CANCELLED; };
  const wait = (ms, g) => new Promise(r => setTimeout(r, ms / rate)).then(() => live(g));
  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect(), L = layer.getBoundingClientRect();
    return r.width || r.height ? {x: r.left - L.left, y: r.top - L.top, w: r.width, h: r.height} : null;
  }
  function spawn(cls, html, b) {
    const el = document.createElement('div');
    el.className = cls; el.innerHTML = html;
    if (b) Object.assign(el.style, {left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px'});
    layer.append(el); return el;
  }
  function anim(el, frames, opts) {
    if (!el?.animate) return Promise.resolve();
    const a = el.animate(frames, {fill: 'none', ...opts}); a.playbackRate = rate; running.add(a);
    const done = () => running.delete(a);
    return Promise.race([a.finished.then(done, done), new Promise(r => setTimeout(r, ((opts.duration || 0) + (opts.delay || 0)) / rate + 250))]);
  }
  function fly(el, from, to, {duration = 480, arc = -46, rotate = 0, easing = 'cubic-bezier(.35,.75,.3,1)'} = {}) {
    const dx = to.x + to.w / 2 - (from.x + from.w / 2), dy = to.y + to.h / 2 - (from.y + from.h / 2), s = to.w / from.w || 1;
    return anim(el, [
      {transform: 'translate(0,0) scale(1) rotate(0deg)'},
      {transform: `translate(${dx / 2}px,${dy / 2 + arc}px) scale(${(1 + s) / 2 * 1.08}) rotate(${rotate / 2}deg)`, offset: .5},
      {transform: `translate(${dx}px,${dy}px) scale(${s}) rotate(${rotate}deg)`}], {duration, easing, fill: 'forwards'});
  }
  function burst(b, color = '#fff3b0', size = 1) {
    if (!b) return;
    const d = Math.max(b.w, b.h) * size, ring = spawn('rp-fx-burst', '', {x: b.x + b.w / 2 - d / 2, y: b.y + b.h / 2 - d / 2, w: d, h: d});
    ring.style.setProperty('--fx', color);
    anim(ring, [{transform: 'scale(.2)', opacity: 1}, {transform: 'scale(1.35)', opacity: 0}], {duration: 520, easing: 'ease-out'}).then(() => ring.remove());
  }
  function float(b, text, cls = '') {
    if (!b) return;
    const L = layer.getBoundingClientRect(), x = Math.max(6, Math.min(L.width - 146, b.x + b.w / 2 - 70));
    const el = spawn('rp-fx-float ' + cls, esc(text), {x, y: b.y + b.h * .3, w: 140, h: 30});
    anim(el, [{transform: 'translateY(8px) scale(.6)', opacity: 0}, {transform: 'translateY(-14px) scale(1.15)', opacity: 1, offset: .25},
      {transform: 'translateY(-34px) scale(1)', opacity: 1, offset: .75}, {transform: 'translateY(-46px) scale(.95)', opacity: 0}],
    {duration: 1000, easing: 'ease-out'}).then(() => el.remove());
  }
  const slotEl = u => host()?.querySelector(`[data-rp-slot="${u}"]`) || ghosts.get(u) || null;
  const finalSlots = () => model ? slotsOf(model) : new Map();
  const sideName = side => side === you ? 'YOUR TURN' : 'OPPONENT’S TURN';

  // ---- steps (each returns a promise; a cleared stage rejects with CANCELLED at the next await)
  async function turnBanner(ev, opponent, g) {
    const h = host(), arena = box(h?.querySelector('.rp-arena'));
    const before = shown.turn === undefined ? null : shown.turn;
    const front = before == null ? 'KICKOFF' : sideName(before);
    const width = Math.min(300, (arena?.w || 320) * .78), height = 74;
    const el = spawn(`rp-fx-turn ${ev.who === you ? 'is-mine' : 'is-theirs'}`,
      `<div class="rp-fx-turn-card"><span class="is-front ${before === you ? 'is-mine' : before == null ? '' : 'is-theirs'}">${esc(front)}</span><span class="is-back"><small>TURN ${Number(ev.turn) || ''} · ${esc(ev.who === you ? 'You' : opponent)}</small>${esc(sideName(ev.who))}</span></div>`,
      arena ? {x: arena.x + arena.w / 2 - width / 2, y: arena.y + arena.h * .47 - height / 2, w: width, h: height} : null);
    const card = el.firstChild;
    sound('whoosh');
    anim(el, [{opacity: 0, transform: 'scale(.6)'}, {opacity: 1, transform: 'scale(1)', offset: .14}, {opacity: 1, transform: 'scale(1)', offset: .84}, {opacity: 0, transform: 'scale(1.08)'}], {duration: 1250, easing: 'ease-out'});
    anim(card, [{transform: 'rotateY(0deg)'}, {transform: 'rotateY(0deg)', offset: .2}, {transform: 'rotateY(180deg)', offset: .52}, {transform: 'rotateY(180deg)'}], {duration: 1250, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards'});
    await wait(560, g);
    // The turn ball crosses the field to the manager whose turn begins.
    shown.turn = ev.who; apply(); sound('turn');
    await wait(690, g); el.remove();
  }
  async function zone(ev, g) {
    const h = host(), side = ev.who;
    if (ev.empty) {
      const deck = h?.querySelector(`[data-rp-deck="${side}"]`);
      sound('empty'); float(box(deck), 'Deck empty', 'is-muted');
      await anim(deck, [{transform: 'translateX(0)'}, {transform: 'translateX(-5px) rotate(-3deg)'}, {transform: 'translateX(5px) rotate(3deg)'}, {transform: 'translateX(0)'}], {duration: 360, composite: 'add'});
      live(g);
    }
    shown.zone.delete(side); apply();
    const z = h?.querySelector(`[data-rp-zone="${side}"]`), orb = z?.querySelector('.rp-energy-orb');
    if (!ev.energy) { float(box(orb), 'No opening Energy', 'is-muted'); await wait(520, g); return; }
    sound('energy'); burst(box(orb), COLOR[ev.energy], 1.9);
    await anim(orb?.querySelector('.rp-energy'), [{transform: 'scale(.1) rotate(-200deg)', opacity: 0}, {transform: 'scale(1.45) rotate(20deg)', opacity: 1, offset: .62}, {transform: 'scale(1) rotate(0deg)', opacity: 1}], {duration: 560, easing: 'cubic-bezier(.3,1.4,.5,1)'});
    live(g);
  }
  async function deal(ev, g, quick) {
    const h = host(), side = ev.who, last = model?.sides[side];
    if (shown.deck[side] != null) { shown.deck[side]--; if (!last || shown.deck[side] <= last.deck) delete shown.deck[side]; apply(); }
    const deck = box(h?.querySelector(`[data-rp-deck="${side}"] .rp-card-back`));
    const cards = side === you ? [...(h?.querySelectorAll('.rp-hand > [data-rp-hand]') || [])] : [];
    const target = side === you ? cards[cards.length - shown.hand] : h?.querySelector('.rp-opponent-hand');
    let to = box(target);
    if (to && side !== you) to = {x: to.x + to.w / 2 - to.h * .35, y: to.y, w: to.h * .7, h: to.h};
    sound('deal');
    if (deck && to) {
      const back = spawn('rp-fx-card', BACK, deck);
      await fly(back, deck, to, {duration: quick ? 360 : 460, arc: side === you ? -60 : 30, rotate: side === you ? -10 : 8});
      back.remove(); live(g);
    }
    if (side === you) {
      shown.hand = Math.max(0, shown.hand - 1); apply(); sound('flip');
      await anim(target, [{rotate: 'y 90deg', scale: '1.15'}, {rotate: 'y 0deg', scale: '1'}], {duration: 240, easing: 'ease-out'});
    } else await anim(target, [{scale: '1.1'}, {scale: '1'}], {duration: 220});
    live(g);
  }
  async function attach(ev, g) {
    const h = host(), side = ev.who, slots = [...finalSlots().values()].filter(s => s.side === side && shown.en[s.u] != null && shown.en[s.u] < s.en);
    const s = slots.find(x => x.id === ev.id) || slots[0];
    if (!s) return;
    const el = slotEl(s.u), color = COLOR[ev.energy] || COLOR.Colorless;
    const drop = side === you ? origin?.() : null;
    let from = box(h?.querySelector(`[data-rp-zone="${side}"] .rp-energy-orb`));
    if (drop && performance.now() - drop.at < 2500) {
      const L = layer.getBoundingClientRect(); from = {x: drop.x - L.left - 15, y: drop.y - L.top - 15, w: 30, h: 30};
    } else if (from) from = {x: from.x + from.w / 2 - 15, y: from.y + from.h / 2 - 15, w: 30, h: 30};
    const pips = el?.querySelectorAll('.rp-card-energy .rp-energy') || [], pip = pips[shown.en[s.u]];
    const to = box(pip) || box(el);
    if (from && to) {
      const orb = spawn('rp-fx-energy', `<span class="rp-energy" style="--energy:${color}">${esc(String(ev.energy || 'C').slice(0, 1))}</span>`, from);
      await fly(orb, from, {x: to.x + to.w / 2 - 15, y: to.y + to.h / 2 - 15, w: 30, h: 30}, {duration: drop ? 300 : 520, arc: drop ? -10 : -70, rotate: 360});
      orb.remove(); live(g);
    }
    shown.en[s.u]++; if (shown.en[s.u] >= s.en) delete shown.en[s.u]; apply();
    sound('attach'); burst(to, color, 2.2);
    anim(pip, [{transform: 'scale(.2)'}, {transform: 'scale(1.7)', offset: .5}, {transform: 'scale(1)'}], {duration: 380, easing: 'ease-out'});
    await anim(el, [{filter: 'brightness(1)'}, {filter: `brightness(1.35) drop-shadow(0 0 10px ${color})`, offset: .35}, {filter: 'brightness(1)'}], {duration: 520});
    live(g);
  }
  async function place(ev, g) {
    const h = host(), side = ev.who;
    const s = [...finalSlots().values()].find(x => x.side === side && shown.hidden.has(x.u) && x.id === ev.id) || [...finalSlots().values()].find(x => x.side === side && shown.hidden.has(x.u));
    if (!s) return;
    shown.hidden.delete(s.u); apply();
    const el = slotEl(s.u), to = box(el), from = box(side === you ? h?.querySelector('.rp-hand') : h?.querySelector('.rp-opponent-hand'));
    const dx = from && to ? from.x + from.w / 2 - (to.x + to.w / 2) : 0, dy = from && to ? from.y + from.h / 2 - (to.y + to.h / 2) : -40;
    anim(el, [{transform: `translate(${dx}px,${dy}px) scale(1.35) rotate(${side === you ? -10 : 10}deg)`, opacity: .2},
      {transform: 'translate(0,-10px) scale(1.12) rotate(-2deg)', opacity: 1, offset: .7}, {transform: 'translate(0,0) scale(1) rotate(0)'}], {duration: 480, easing: 'cubic-bezier(.3,.8,.4,1)'});
    await wait(330, g);
    sound('place'); burst(to && {x: to.x, y: to.y + to.h * .6, w: to.w, h: to.h * .5}, '#ffffff', 1.5);
    await wait(170, g);
  }
  async function reveal(g) {
    const hidden = [...finalSlots().values()].filter(s => s.side !== you && shown.hidden.has(s.u));
    for (const s of hidden) {
      shown.hidden.delete(s.u); apply();
      sound('flip');
      anim(slotEl(s.u), [{transform: 'perspective(500px) rotateY(90deg) scale(1.1)'}, {transform: 'perspective(500px) rotateY(0) scale(1)'}], {duration: 320, easing: 'ease-out'});
      await wait(140, g);
    }
    if (hidden.length) { await wait(200, g); sound('place'); }
  }
  async function hit(ev, g, prevSlots) {
    const defSide = ev.k === 'attack' ? 1 - ev.who : ev.who;
    const pick = list => list.filter(s => s.side === defSide && s.id === (ev.k === 'attack' ? ev.target : ev.id)).sort((a, b) => b.active - a.active)[0];
    const s = pick([...prevSlots.values()]) || pick([...finalSlots().values()]);
    if (!s) return;
    const el = slotEl(s.u), b = box(el), amount = Number(ev.k === 'attack' ? ev.damage : ev.amount) || 0;
    if (ev.k === 'attack') {
      const attacker = [...finalSlots().values()].find(x => x.side === ev.who && x.active), a = slotEl(attacker?.u), ab = box(a);
      if (a && ab && b) {
        const dx = (b.x - ab.x) * .32, dy = (b.y - ab.y) * .32;
        anim(a, [{transform: 'translate(0,0) scale(1)'}, {transform: `translate(${dx}px,${dy}px) scale(1.1)`, offset: .45}, {transform: 'translate(0,0) scale(1)'}], {duration: 420, easing: 'ease-in-out'});
        await wait(190, g);
      }
    }
    sound(!amount ? 'miss' : ev.k === 'attack' ? amount >= 70 ? 'heavy' : 'impact' : 'impact');
    float(b, amount ? `-${amount}${ev.condition ? ' ' + ev.condition : ''}` : 'No damage', amount ? 'is-damage' : 'is-muted');
    if (amount) burst(b, '#ff8a6b', 1.2);
    anim(el, [{transform: 'translateX(0)', filter: 'none'}, {transform: 'translateX(-7px) rotate(-2deg)', filter: 'brightness(1.6) sepia(1) hue-rotate(-40deg) saturate(4)', offset: .2},
      {transform: 'translateX(6px) rotate(2deg)', offset: .45}, {transform: 'translateX(-3px)', offset: .7}, {transform: 'translateX(0)', filter: 'none'}], {duration: 460, easing: 'ease-out'});
    // HP counts down to the resolved value.
    const text = el?.querySelector('.rp-live-hp'), bar = el?.querySelector('.rp-hp i'), max = Number((el?.matches('[data-rp-max]') ? el : el?.querySelector('[data-rp-max]'))?.dataset.rpMax) || 1;
    const from = shown.hp[s.u] ?? Number(text?.textContent), finalHp = finalSlots().get(s.u)?.hp ?? 0;
    const target = Math.max(finalHp, Math.max(0, from - amount));
    if (Number.isFinite(from) && text) {
      for (let i = 1; i <= 8; i++) {
        await wait(45, g);
        const v = Math.round(from + (target - from) * i / 8); text.textContent = v; if (bar) bar.style.width = pct(v / max * 100) + '%';
      }
    }
    if (finalSlots().has(s.u)) { if (target === finalHp) delete shown.hp[s.u]; else shown.hp[s.u] = target; apply(); }
    await wait(120, g);
  }
  async function knockout(ev, g, prevSlots) {
    const s = [...prevSlots.values()].find(x => x.side === ev.who && x.id === ev.id && !finalSlots().has(x.u));
    const el = s ? ghosts.get(s.u) : null, b = box(el);
    sound('knockout');
    if (!el) { await wait(400, g); return; }
    const stamp = spawn('rp-fx-stamp', 'KNOCKED<br>OUT', b && {x: b.x - 20, y: b.y + b.h * .3, w: b.w + 40, h: b.h * .4});
    anim(stamp, [{transform: 'scale(2.4) rotate(-14deg)', opacity: 0}, {transform: 'scale(.95) rotate(-8deg)', opacity: 1, offset: .25}, {transform: 'scale(1) rotate(-8deg)', opacity: 1, offset: .8}, {opacity: 0}], {duration: 1150, easing: 'ease-out'});
    burst(b, '#ff6b5c', 1.6);
    await anim(el, [{transform: 'none', filter: 'none', opacity: 1}, {transform: 'translateX(-6px) rotate(-3deg)', filter: 'brightness(2.2) grayscale(.4)', offset: .12},
      {transform: 'translateX(6px) rotate(3deg)', filter: 'brightness(1.4) grayscale(.8)', offset: .26}, {transform: 'translateY(0) rotate(0)', filter: 'grayscale(1)', opacity: 1, offset: .55},
      {transform: `translateY(${ev.who === you ? 46 : -46}px) rotate(${ev.who === you ? 14 : -14}deg) scale(.7)`, filter: 'grayscale(1)', opacity: 0}], {duration: 1150, easing: 'ease-in', fill: 'forwards'});
    el.remove(); ghosts.delete(s.u); stamp.remove(); live(g);
  }
  async function point(scorer, g) {
    const plate = host()?.querySelector(`[data-rp-points="${scorer}"]`), finalPts = model?.sides[scorer]?.points ?? 0;
    const at = shown.pts[scorer] ?? finalPts - 1;
    shown.pts[scorer] = at + 1; if (shown.pts[scorer] >= finalPts) delete shown.pts[scorer]; apply();
    const marker = plate?.querySelectorAll('.rp-points i')[at], b = box(marker);
    sound(scorer === you ? 'point' : 'point-lose');
    burst(b, scorer === you ? '#ffe28a' : '#ff9b8a', 3);
    float(b && {x: b.x - 10, y: b.y - 6, w: b.w + 20, h: b.h}, '+1', scorer === you ? 'is-point' : 'is-loss');
    await anim(marker, [{transform: 'scale(.2)'}, {transform: 'scale(1.9)', offset: .45}, {transform: 'scale(1)'}], {duration: 520, easing: 'cubic-bezier(.3,1.5,.5,1)'});
    live(g);
  }
  async function slide(side, g) {
    const moved = Object.keys(shown.offset).filter(u => side == null || finalSlots().get(u)?.side === side);
    if (!moved.length) return;
    const from = moved.map(u => [u, shown.offset[u]]);
    moved.forEach(u => delete shown.offset[u]); apply();
    sound('flip');
    await Promise.all(from.map(([u, o]) => anim(slotEl(u), [{translate: `${o.x}px ${o.y}px`}, {translate: '0px 0px'}], {duration: 420, easing: 'cubic-bezier(.3,.8,.3,1)'})));
    live(g);
  }
  async function glow(u, g, cue = 'power') {
    const el = slotEl(u);
    if (!el) return;
    sound(cue); burst(box(el), '#bfefff', 1.4);
    await anim(el, [{transform: 'scale(1)', filter: 'none'}, {transform: 'scale(1.09)', filter: 'brightness(1.5) drop-shadow(0 0 12px #c7f2ff)', offset: .4}, {transform: 'scale(1)', filter: 'none'}], {duration: 520, easing: 'ease-out'});
    live(g);
  }
  async function condition(ev, g) {
    const s = [...finalSlots().values()].find(x => x.side === ev.who && x.active);
    const badge = slotEl(s?.u)?.querySelector('.rp-condition');
    sound('select');
    await anim(badge, [{transform: 'scale(.3)', opacity: 0}, {transform: 'scale(1.4)', opacity: 1, offset: .6}, {transform: 'scale(1)'}], {duration: 360, easing: 'ease-out'});
    live(g);
  }
  async function finale(ev, g) {
    const arena = box(host()?.querySelector('.rp-arena')), result = ev.who === 'draw' ? 'draw' : ev.who === you ? 'win' : 'loss';
    const w = Math.min(330, arena?.w || 320), hgt = 120;
    const el = spawn(`rp-fx-final is-${result}`, `<b>${result === 'win' ? 'VICTORY' : result === 'loss' ? 'DEFEAT' : 'DRAW'}</b><small>${esc(ev.reason || '')}</small>`,
      arena && {x: arena.x + arena.w / 2 - w / 2, y: arena.y + arena.h * .45 - hgt / 2, w, h: hgt});
    sound(result === 'win' ? 'victory' : result === 'loss' ? 'defeat' : 'draw');
    if (result === 'win' && arena) for (let i = 0; i < 18; i++) {
      const spark = spawn('rp-fx-spark', '', {x: arena.x + arena.w / 2 - 4, y: arena.y + arena.h * .45 - 4, w: 8, h: 8});
      const a = i / 18 * Math.PI * 2, r = 90 + (i % 4) * 30;
      spark.style.setProperty('--fx', ['#ffe28a', '#8ee8ff', '#ffffff', '#ff9fd0'][i % 4]);
      anim(spark, [{transform: 'translate(0,0) scale(1)', opacity: 1}, {transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) scale(.4)`, opacity: 0}], {duration: 1100, easing: 'cubic-bezier(.2,.8,.3,1)'}).then(() => spark.remove());
    }
    await anim(el, [{transform: 'scale(.4) rotate(-6deg)', opacity: 0}, {transform: 'scale(1.12) rotate(2deg)', opacity: 1, offset: .2}, {transform: 'scale(1)', opacity: 1, offset: .3}, {transform: 'scale(1)', opacity: 1, offset: .85}, {transform: 'scale(1.05)', opacity: 0}], {duration: 1800, easing: 'ease-out'});
    el.remove(); live(g);
  }

  /** Plan the steps for one batch of new events. Call right after the table renders the new state. */
  function plan(events, {x, prev, next, captured, scene}) {
    you = x.you;
    const opponent = x.opp?.name || 'Opponent', items = [];
    const prevSlots = slotsOf(prev), nextSlots = slotsOf(next), h = host();
    const setupDone = prev.phase === 'setup' && next.phase !== 'setup';
    model = next;
    for (const [u, n] of nextSlots) {
      const p = prevSlots.get(u);
      if (!p || (setupDone && n.side !== you)) { if (!(setupDone && n.side === you)) shown.hidden.add(u); continue; }
      if (shown.hp[u] == null && p.hp !== n.hp) shown.hp[u] = p.hp;
      if (shown.en[u] == null && n.en > p.en) shown.en[u] = p.en;
    }
    next.sides.forEach((s, side) => {
      const p = prev.sides[side];
      if (shown.pts[side] == null && s.points > p.points) shown.pts[side] = p.points;
      if (shown.deck[side] == null && s.deck < p.deck) shown.deck[side] = p.deck;
    });
    for (const ev of events) if (ev.k === 'turn') { if (shown.turn === undefined) shown.turn = prev.turnSide; if (ev.energy) shown.zone.add(ev.who); }
    // Hold the old values before anything measures layout, so nothing transitions from the new state.
    apply();
    for (const [u] of nextSlots) {
      const old = prevSlots.has(u) && captured.slots[u]?.rect, now = !shown.offset[u] && box(h?.querySelector(`[data-rp-slot="${u}"]`));
      if (old && now && Math.abs(old.x - now.x) + Math.abs(old.y - now.y) > 6) shown.offset[u] = {x: old.x - now.x, y: old.y - now.y};
    }
    for (const [u, p] of prevSlots) {
      const c = captured.slots[u];
      if (nextSlots.has(u) || ghosts.has(u) || !c?.rect) continue;
      const ghost = spawn('rp-fx-ghost' + (c.bench ? ' is-bench' : ''), `<div class="rp-field">${c.html}</div>`, c.rect);
      ghost.dataset.rpGhost = u; ghosts.set(u, ghost);
    }
    // Draws at the start of a turn read after the turn flips; the Energy Zone refills after the draw.
    const list = [];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i], nx = events[i + 1];
      if (ev.k === 'draw' && nx?.k === 'turn' && nx.who === ev.who) { list.push(nx, ev, {k: 'zone', who: nx.who, energy: nx.energy}); i++; continue; }
      list.push(ev);
      if (ev.k === 'turn') list.push({k: 'zone', who: ev.who, energy: ev.energy, empty: true});
    }
    let revealed = false, draws = 0;
    for (const ev of list) {
      if (scene(ev)) items.push({scene: ev});
      const step = (name, fn) => items.push({name, run: g => fn(g)});
      switch (ev.k) {
        case 'turn': step('turn', g => turnBanner(ev, opponent, g)); break;
        case 'zone': step('zone', g => zone(ev, g)); break;
        case 'draw': case 'search': if (ev.who === you) shown.hand++; { const quick = draws++ > 0; step('deal', g => deal(ev, g, quick)); } break;
        case 'energy': step('energy', g => attach(ev, g)); break;
        case 'bench': step('place', g => place(ev, g)); break;
        case 'setup': if (setupDone && !revealed) { revealed = true; step('reveal', reveal); } break;
        case 'evolve': step('develop', g => glow(String(ev.on), g)); break;
        case 'ability': { const s = [...nextSlots.values()].find(z => z.side === ev.who && z.id === ev.id); if (s) step('ability', g => glow(s.u, g)); break; }
        case 'attack': step('hit', g => hit(ev, g, prevSlots)); break;
        case 'condition-damage': step('hit', g => hit(ev, g, prevSlots)); break;
        case 'condition': step('condition', g => condition(ev, g)); break;
        case 'ko': step('knockout', g => knockout(ev, g, prevSlots)); for (let i = 0; i < (Number(ev.points) || 1); i++) step('point', g => point(ev.scorer, g)); break;
        case 'promote': case 'switch': step('slide', g => slide(ev.who, g)); break;
        case 'over': step('final', g => finale(ev, g)); break;
        default: break;
      }
    }
    if (setupDone && !revealed) items.push({name: 'reveal', run: reveal});
    items.push({name: 'settle', run: g => slide(null, g)});
    apply();
    return items;
  }
  return {
    layer, apply, plan,
    capture() {
      const h = host(), slots = {};
      // Ghosts keep the card's face and HP but never its table identity or drop target.
      h?.querySelectorAll('[data-rp-slot]').forEach(el => { slots[el.dataset.rpSlot] = {rect: box(el), html: el.outerHTML.replace(/ (data-rp-(?:slot|side|drop)|aria-label)="[^"]*"/g, '').replace('<button', '<div').replace(/<\/button>$/, '</div>'), bench: !!el.closest('.rp-bench')}; });
      return {slots};
    },
    async run(item) { const g = gen; try { await item.run(g); } catch (e) { if (e !== CANCELLED) console.error(e); } },
    /** The manager made a play: finish what is still showing quickly. */
    hurry() { rate = 3.5; running.forEach(a => { a.playbackRate = rate; }); },
    /** Everything has played: show the saved table exactly. */
    settle() { rate = 1; shown = fresh(); ghosts.forEach(el => el.remove()); ghosts.clear(); apply(); },
    clear() { gen++; rate = 1; running.forEach(a => { try { a.cancel(); } catch (_) {} }); running.clear(); layer.replaceChildren(); ghosts.clear(); shown = fresh(); apply(); },
    stop() { this.clear(); layer.remove(); }
  };
}
export const energyColor = type => COLOR[type] || COLOR.Colorless;
