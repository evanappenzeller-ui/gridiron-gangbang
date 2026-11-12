// Return Man's cosmetic wallet. It belongs to the selected local profile and this device;
// it never spends Keepfall Gold or changes the daily score/attempt records.
import {profileKey as selectedProfileKey} from './realm-active.js';
import {TEAM_KITS} from './return-team-kits.js';

const HOME = {jersey: 0x173B6C, pads: 0x1D4782, belt: 0xDCE2DC, pants: 0xDCE2DC, socks: 0x173B6C, cleats: 0x102744,
  gloves: 0xF0F2E8, bands: 0xF0F2E8, helmet: 0x173B6C, stripe: 0xF0F2E8, edge: 0xE89C43, mask: 0xC4D1D8,
  numFill: 0xF0F2E8, numEdge: 0x102744, num: 22, head: 'HeadReturner', ball: true, size: 1};
const makeSkin = (id, name, price, tagline, colors, team = '') => Object.freeze({id, name, price, tagline,
  category: team ? 'team' : 'skin', team,
  kit: Object.freeze({...HOME, pattern: id, wordmark: name.toUpperCase(), team, ...colors})});
export const SKINS = Object.freeze([
  makeSkin('home', 'Home Team', 0, 'Your original home uniform', {}),
  makeSkin('outlaw', 'Desert Outlaw', 60, 'Wanted in every end zone', {jersey: 0xAD432C, pads: 0xD35A36, helmet: 0x5C342B, stripe: 0xF8BF62, edge: 0xE9A242, pants: 0xD6AB6E, belt: 0xD6AB6E, socks: 0x763725, cleats: 0x482E28, bands: 0xF8BF62, numFill: 0xFFE8B2}),
  makeSkin('neon', 'Neon Rush', 100, 'Light up the night shift', {jersey: 0x2E245A, pads: 0x663ABA, helmet: 0x2E245A, stripe: 0x5DFFBF, edge: 0xF56DBE, pants: 0x42336D, belt: 0x42336D, socks: 0x5DFFBF, cleats: 0xF56DBE, gloves: 0x5DFFBF, bands: 0xF56DBE, numFill: 0x5DFFBF}),
  makeSkin('arctic', 'Arctic Blitz', 140, 'Ice cold. Quick feet.', {jersey: 0xD7F3F4, pads: 0x8CD9E7, helmet: 0xEDF9F5, stripe: 0x338CAC, edge: 0x75D2DE, pants: 0x226281, belt: 0x226281, socks: 0xD7F3F4, cleats: 0x338CAC, gloves: 0xE3FFFF, bands: 0x338CAC, numFill: 0x18516D, numEdge: 0xE3FFFF}),
  makeSkin('beach', 'Beach Break', 180, 'A little sunshine. All speed.', {jersey: 0xF39865, pads: 0xFFC170, helmet: 0x39BCA8, stripe: 0xFFF1BC, edge: 0xF4B45C, pants: 0x258E92, belt: 0x258E92, socks: 0xFFF1BC, cleats: 0xE86562, gloves: 0xFFF1BC, bands: 0x39BCA8, numFill: 0xFFF1BC, numEdge: 0x9E4E43}),
  makeSkin('cosmic', 'Cosmic Comet', 240, 'Out of this league', {jersey: 0x6643B4, pads: 0xA174D8, helmet: 0xAB8DE3, stripe: 0x8FFFF0, edge: 0xF8C967, pants: 0x302A61, belt: 0x302A61, socks: 0xA174D8, cleats: 0x8FFFF0, gloves: 0xDFCCFF, bands: 0x8FFFF0, mask: 0x8FFFF0, numFill: 0xF8C967}),
  makeSkin('ember', 'End Zone Ember', 320, 'Bring the heat', {jersey: 0x242F3E, pads: 0x444756, helmet: 0xF57338, stripe: 0xFFE18C, edge: 0xFFCF5F, pants: 0x343A48, belt: 0x343A48, socks: 0xF57338, cleats: 0xFFCF5F, gloves: 0xF57338, bands: 0xFFCF5F, numFill: 0xFFCF5F}),
  ...TEAM_KITS.map(t => makeSkin(t.id, t.name, 200, 'Team colors. Your number.', t.colors, t.team))
]);
export const RIDES = Object.freeze([
  Object.freeze({id: 'scooter', name: 'Street Scooter', tagline: 'Two wheels. One clean getaway.'}),
  Object.freeze({id: 'hoverboard', name: 'Flux Hoverboard', tagline: 'Float past the ordinary.'})
]);
export const skinOf = id => SKINS.find(skin => skin.id === id) || SKINS[0];
export const rideOf = id => RIDES.find(ride => ride.id === id) || RIDES[0];
// The empty profile has its own device-local slot, never a named guest's slot.
export const profileKey = () => selectedProfileKey() || 'visitor';
export const storageKey = (profile = profileKey()) => `gg-return-customize:${profile}:v1`;
const MAX_COINS = 10000000, MAX_RUN_COINS = 1000;
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : 0;
// Keep 00 distinct from 0, while normalizing other leading zeroes to the jersey number.
const jerseyNumber = value => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  return /^\d{1,2}$/.test(text) ? text === '00' ? '00' : String(Number(text)) : null;
};
const fresh = () => ({v: 1, coins: 0, owned: ['home'], skin: 'home', ride: 'scooter', number: '22', receipts: {}});
function clean(value) {
  if (!value || value.v !== 1 || typeof value !== 'object') return fresh();
  const state = fresh();
  state.coins = integer(value.coins, MAX_COINS);
  state.owned = ['home', ...SKINS.filter(s => s.id !== 'home' && Array.isArray(value.owned) && value.owned.includes(s.id)).map(s => s.id)];
  state.skin = state.owned.includes(value.skin) ? value.skin : 'home';
  state.ride = rideOf(value.ride).id;
  state.number = jerseyNumber(value.number) ?? '22';
  if (value.receipts && typeof value.receipts === 'object' && !Array.isArray(value.receipts)) {
    for (const [id, total] of Object.entries(value.receipts)) if (/^[1-9]\d{0,5}:0$/.test(id)) state.receipts[id] = integer(total, MAX_RUN_COINS);
  }
  return state;
}
function read(profile) {
  try { return {state: clean(JSON.parse(localStorage.getItem(storageKey(profile)) || 'null')), readable: true}; }
  catch (_) { return {state: fresh(), readable: false}; }
}
function save(profile, state) {
  try { localStorage.setItem(storageKey(profile), JSON.stringify(state)); return true; }
  catch (_) { return false; }
}
const publicState = (state, profile, readable = true) => ({profile, coins: state.coins, owned: [...state.owned], skin: state.skin, ride: state.ride, number: state.number, readable});
export function snapshot() {
  const profile = profileKey(), result = read(profile);
  return publicState(result.state, profile, result.readable);
}
/** The equipped outfit and chosen number; reading it never writes or migrates the save. */
export const kitFor = (state = snapshot()) => ({...skinOf(state.skin).kit, num: jerseyNumber(state.number) ?? '22'});
function change(action) {
  const profile = profileKey(), {state, readable} = read(profile);
  if (!readable) return {ok: false, reason: 'storage', state: publicState(state, profile, false)};
  const reason = action(state);
  if (reason) return {ok: false, reason, state: publicState(state, profile)};
  if (!save(profile, state)) return {ok: false, reason: 'storage', state: snapshot()};
  return {ok: true, state: publicState(state, profile)};
}
/** Purchasing equips the new skin. Owning it already never spends coins again. */
export function buySkin(id) {
  return change(state => {
    const skin = SKINS.find(s => s.id === id);
    if (!skin) return 'unknown';
    if (!state.owned.includes(id)) {
      if (state.coins < skin.price) return 'coins';
      state.coins -= skin.price;
      state.owned.push(id);
    }
    state.skin = id;
  });
}
export function equipSkin(id) {
  return change(state => {
    if (!SKINS.some(s => s.id === id)) return 'unknown';
    if (!state.owned.includes(id)) return 'locked';
    state.skin = id;
  });
}
export function equipRide(id) {
  return change(state => {
    if (!RIDES.some(ride => ride.id === id)) return 'unknown';
    state.ride = id;
  });
}
/** Number changes are free, profile-local and committed before callers update the runner. */
export function setNumber(value) {
  const number = jerseyNumber(value);
  return change(state => {
    if (number === null) return 'number';
    state.number = number;
  });
}
const sessions = new WeakMap();
/** Called once at kickoff, with the actual practice flag. No old device-wide scores are imported:
 *  those results cannot safely be attributed to an individual local profile. */
export function beginRun(run, {practice = true} = {}) {
  const token = Object.freeze({});
  const eligible = practice === false && run && Number.isInteger(run.n) && run.n > 0 && run.n < 1000000 && run.k === 0 && !run.elsewhere;
  sessions.set(token, {profile: profileKey(), id: eligible ? `${run.n}:0` : '', eligible: !!eligible, run});
  return token;
}
/** Credit the cumulative count, not a delta: repeating a frame, ending, reloading or leaving
 *  cannot pay a run twice. Saved at each pickup, even if the player exits before the tackle. */
export function credit(token, cumulativeCoins) {
  const session = token && sessions.get(token);
  if (!session?.eligible || session.run.elsewhere || session.profile !== profileKey() || !Number.isSafeInteger(cumulativeCoins) || cumulativeCoins < 0) return {ok: false, reason: 'ineligible', added: 0};
  const {state, readable} = read(session.profile);
  if (!readable) return {ok: false, reason: 'storage', added: 0};
  const total = Math.min(cumulativeCoins, MAX_RUN_COINS), previous = state.receipts[session.id] || 0;
  const added = Math.max(0, total - previous);
  if (!added) return {ok: true, added: 0, state: publicState(state, session.profile)};
  state.coins = Math.min(MAX_COINS, state.coins + added);
  state.receipts[session.id] = total;
  if (!save(session.profile, state)) return {ok: false, reason: 'storage', added: 0};
  return {ok: true, added, state: publicState(state, session.profile)};
}
