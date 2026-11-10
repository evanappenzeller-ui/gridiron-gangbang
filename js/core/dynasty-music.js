import {rivalsUpdated} from './features.js';
// Rivals' owner-uploaded MP3s. One streaming media element, with Web Audio volume control
// (including on iOS), shared by the hub and battle views. Never touches game saves.
// Everything shuffles (Evan, Nov 6 2026: "Shuffle the music in rivals. The music should never follow the same play
// through twice"). The menus play the jukebox in a shuffled order; battles play the battle playlist from a random point
// each time a battle opens, its songs in a shuffled order; a song picked from the jukebox during a battle starts a new
// shuffle from that song for the rest of it. See playThrough() for the never-twice rule.
import * as data from './data.js';
import {profileKey} from './realm-active.js';

const KEY = () => `gg-rivals-music:${profileKey()}:v1`;
// Music sits under the effects (the owner, Nov 5 2026: "Reduce the volume of the background music. The sound effects
// should be more noticeable. Do not deafen the music when a sound effect is used"). Each track carries its measured
// loudness (integrated LUFS, ffmpeg ebur128) and plays at `level`, which brings it down to REFERENCE_LUFS, so a loud
// hip-hop master and a quieter track sound alike; MUSIC_LEVEL then lowers all music. The slider and its saved
// value are unchanged: the output is slider × MUSIC_LEVEL × the track's level. Effects never lower the music.
const REFERENCE_LUFS = -16, MUSIC_LEVEL = .7;
const SCENE_FADE_SECONDS = 2;
const levelFor = lufs => Math.min(1, 10 ** ((REFERENCE_LUFS - lufs) / 20));
// Album covers (Evan sent them Nov 9 2026, after the song list in docs/rivals/jukebox-songs.md): img/rivals/covers/<id>-v1.webp,
// 320 px square. A song without one keeps the jukebox's drawn Rivals cover.
const COVERS = new Set(['back-to-the-moon', 'ballin', 'banking-on-me', 'butterfly-effect', 'cities', 'dead-and-gone', 'dead-presidents-ii', 'ease-my-mind', 'fashion-killa', 'feel-so-good', 'forget-it', 'gorgeous', 'hate-it-or-love-it', 'hunger-on-hillside', 'jimmy-cooks', 'let-it-happen', 'lifestyle', 'lost', 'lpfj2', 'niagara-falls', 'no-option', 'overdue', 'overnight-celebrity', 'played-like-a-piano', 'praise-the-lord', 'railroad-shelter', 'rapp-snitch-knishes', 'save-your-tears', 'something-about-us', 'still-tippin', 'straighten-it-out', 'sundress', 'survival-of-the-fittest', 'talking-to-my-diary', 'the-basement', 'troy', 'voyager', 'wicked-game']);
const song = (id, title, artist, lufs) => Object.freeze({id, title, artist, level: levelFor(lufs),
  url: new URL(`../../audio/rivals/${id}-v1.mp3`, import.meta.url).href,
  cover: COVERS.has(id) ? new URL(`../../img/rivals/covers/${id}-v1.webp`, import.meta.url).href : ''});
export const TRACKS = Object.freeze([
  song('sundress', 'Sundress', 'A$AP Rocky', -8.4),
  song('praise-the-lord', 'Praise the Lord (Da Shine)', 'A$AP Rocky ft. Skepta', -8.7),
  song('fashion-killa', 'Fashion Killa', 'A$AP Rocky', -10.2),
  song('lost', 'Lost', 'Frank Ocean', -9.1),
  song('jimmy-cooks', 'Jimmy Cooks', 'Drake ft. 21 Savage', -8.5),
  song('overdue', 'Overdue', 'Metro Boomin & Travis Scott', -11.9),
  song('timeless', 'Timeless', 'The Weeknd & Playboi Carti', -8.4),
  song('niagara-falls', 'Niagara Falls (Foot or 2)', 'Metro Boomin, Travis Scott & 21 Savage', -8.3),
  song('something-about-us', 'Something About Us', 'Daft Punk', -14.5),
  song('voyager', 'Voyager', 'Daft Punk', -14.6),
  song('straighten-it-out', 'Straighten It Out', 'Pete Rock & C.L. Smooth', -15.1),
  song('troy', 'They Reminisce Over You (T.R.O.Y.)', 'Pete Rock & C.L. Smooth', -14.2),
  song('dead-and-gone', 'Dead and Gone', 'T.I. ft. Justin Timberlake', -8.6),
  song('lpfj2', 'Lord Pretty Flacko Jodye 2', 'A$AP Rocky', -9.2),
  song('let-it-happen', 'Let It Happen', 'Tame Impala', -8.6),
  song('still-tippin', 'Still Tippin’', 'Mike Jones ft. Slim Thug & Paul Wall', -12.3),
  song('rapp-snitch-knishes', 'Rapp Snitch Knishes', 'MF DOOM ft. Mr. Fantastik', -10.7),
  song('back-to-the-moon', 'back to the moon', 'Gunna', -9.0),
  song('hate-it-or-love-it', 'Hate It or Love It', 'The Game ft. 50 Cent', -8.4),
  song('butterfly-effect', 'Butterfly Effect', 'Travis Scott', -9.3),
  song('overnight-celebrity', 'Overnight Celebrity', 'Twista', -9.1),
  song('cities', 'Cities', 'Throttle', -8.2),
  song('save-your-tears', 'Save Your Tears', 'The Weeknd', -15.3),
  song('ease-my-mind', 'Ease My Mind', 'Chris Lake & Abel Balder', -9.2),
  song('wicked-game', 'Wicked Game', 'The Expendables', -9.7),
  song('railroad-shelter', 'Railroad Shelter', 'TJ O’Neill ft. Stick Figure', -10.4),
  song('played-like-a-piano', 'Played Like a Piano', 'King Tee ft. Ice Cube & Breeze', -17.3),
  song('talking-to-my-diary', 'Talking to My Diary (Instrumental)', 'Dr. Dre', -10.2),
  song('ballin', 'Ballin’', 'Mustard ft. Roddy Ricch', -10.3),
  song('feel-so-good', 'Feel So Good', 'Mase', -11.5),
  song('dead-presidents-ii', 'Dead Presidents II', 'JAY-Z', -12.8),
  // (Evan, Nov 9 2026: "insert songs into rivals", nine links; Ballin' was already in)
  song('hunger-on-hillside', 'h u n g e r . o n . h i l l s i d e', 'J. Cole ft. Bas', -9.8),
  song('lifestyle', 'Lifestyle', 'Dreamville, Bas ft. A$AP Ferg', -10.8),
  song('the-basement', 'The Basement', 'Pete Rock & C.L. Smooth', -14.2),
  song('forget-it', 'Forget It', 'Matroda', -8.3),
  song('gorgeous', 'Gorgeous', 'Kanye West', -7.8),
  song('banking-on-me', 'Banking On Me', 'Gunna', -11.2),
  song('survival-of-the-fittest', 'Survival of the Fittest', 'Mobb Deep', -10.4),
  song('no-option', 'No Option', 'Post Malone', -9.3),
]);
// Battle music (Evan, Nov 7 2026: "Use the attached for in game music when playing rivals", six YouTube links): the
// game and broadcast menu themes below replace the Cyber Funkwave mix in battles; the menus keep the jukebox. The looped
// uploads were cut to whole passes (Green Hill and Fortnite three 77 s loops, Black Ops two 109 s loops, CoD4 one 134 s
// pass); GTA V's 21-minute pause-menu suite is cut at its quietest moments and ESPN's video at its 16 tracks, so a
// phone only fetches (and the service worker only caches) the part that plays. Every file was loudness-normalised to
// REFERENCE_LUFS when encoded (ffmpeg loudnorm, 128 kbps; the originals sat between -13 and -33 LUFS), so each plays at
// level 1. Lengths in seconds. A song with parts plays one part a turn, another part the next time its turn comes.
const battleSong = (id, title, artist, lengths) => Object.freeze({id, title, artist, parts: Object.freeze(lengths.map((seconds, i) =>
  Object.freeze({seconds, url: new URL(`../../audio/rivals/${id}-v1${lengths.length > 1 ? '-' + String(i + 1).padStart(2, '0') : ''}.mp3`, import.meta.url).href})))});
export const BATTLE_SONGS = Object.freeze([
  battleSong('gta-menu', 'Pause Menu', 'Grand Theft Auto V', [352.75, 230, 348, 353.55]),
  battleSong('green-hill', 'Green Hill Zone', 'Sonic the Hedgehog', [234.7]),
  battleSong('black-ops-menu', 'Multiplayer Menu', 'Call of Duty: Black Ops', [221.6]),
  battleSong('cod4-menu', 'Main Menu Theme', 'Call of Duty 4: Modern Warfare', [132.1]),
  battleSong('fortnite-menu', 'OG Main Menu', 'Fortnite', [234.4]),
  battleSong('espn-primetime', 'NFL Primetime', 'ESPN', [160.6, 134.2, 220.9, 126.55, 88.75, 109.75, 85.25, 104.8, 130, 130.1,
    134.4, 182.6, 124, 223.9, 127.3, 76.9])
]);
export const BATTLE = Object.freeze({id: 'battle', title: 'Battle playlist', artist: 'Game menu themes', level: 1, songs: BATTLE_SONGS});
// Every part of every battle song in one list: 'battle:<index>' is what the media element holds.
const PIECES = BATTLE_SONGS.flatMap((s, song) => s.parts.map((p, n) => Object.freeze({...p, song, n})));
const pieceOf = (song, n) => PIECES.findIndex(p => p.song === song && p.n === n);
const partOf = key => key.startsWith('battle:') ? Number(key.slice(7)) : -1;
const indexOf = id => TRACKS.findIndex(t => t.id === id);
let excluded = new Set();
const songPool = () => TRACKS.flatMap((t, i) => excluded.has(t.id) ? [] : [i]);
const battlePool = () => BATTLE_SONGS.flatMap((t, i) => excluded.has(t.id) ? [] : [i]);
// A battle's start: a song, one of its parts, and a moment in it (not its last few seconds).
function randomSpot() {
  const pool = battlePool();
  if (!pool.length) return {part: 0, at: 0};
  const song = pool[Math.floor(Math.random() * pool.length)], list = BATTLE_SONGS[song].parts;
  const n = Math.floor(Math.random() * list.length);
  return {part: pieceOf(song, n), at: Math.random() * Math.max(0, list[n].seconds - 5)};
}
// What the battle playlist is playing, for the player, the Settings sheet and the system's media controls.
function battleNow() {
  const piece = PIECES[spot.part] || PIECES[0], s = BATTLE_SONGS[piece.song];
  return {id: BATTLE.id, title: s.title, artist: s.parts.length > 1 ? `${s.artist} · ${piece.n + 1} of ${s.parts.length}` : s.artist, song: s.id};
}

// Shuffle. A play-through is one pass over every song (or every battle song) in a random order. A new pass never
// opens with what just played and is never an order this profile has heard before: the recent orders are remembered in
// HEARD_KEY (separate from the music settings and from game saves). songs/parts: the current pass and where it is
// (parts: the battle playlist's songs). cursor: the part each battle song plays next.
const HEARD_KEY = () => `gg-rivals-shuffle:${profileKey()}:v1`, HEARD = 64;
let heard = {songs: [], parts: []}, songs = {order: [], at: 0}, parts = {order: [], at: 0}, cursor = BATTLE_SONGS.map(() => 0);
function readHeard() {
  const list = v => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(-HEARD) : [];
  try { const saved = JSON.parse(localStorage.getItem(HEARD_KEY())); heard = {songs: list(saved?.songs), parts: list(saved?.parts)}; }
  catch (_) { heard = {songs: [], parts: []}; }
}
// A shuffled pass through the enabled indexes. `first` leads when given; otherwise it avoids `last`.
// Avoid recent orders while alternatives exist. With a stubbed Math.random, rotate the order to find a fresh pass.
function playThrough(list, pool, first = -1, last = -1) {
  const n = pool.length;
  if (!n) return [];
  if (!pool.includes(first)) first = -1;
  const seen = new Set(heard[list]);
  const leads = order => first >= 0 || n < 2 || order[0] !== last;
  const fits = order => !seen.has(order.join('.')) && leads(order);
  const lead = first >= 0 ? [first] : [];
  let order = null;
  for (let tries = 0; tries < 32 && !order; tries++) {
    const rest = pool.filter(i => i !== first);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    if (fits([...lead, ...rest])) order = [...lead, ...rest];
  }
  if (!order) {
    const rest = pool.filter(i => i !== first);
    for (let turn = 1; turn <= rest.length && !order; turn++) {
      const next = [...lead, ...rest.slice(turn), ...rest.slice(0, turn)];
      if (fits(next)) order = next;
    }
    // Small playlists eventually exhaust their possible orders. Still avoid an immediate repeat.
    order ||= [...lead, ...rest];
    if (!leads(order)) [order[0], order[1]] = [order[1], order[0]];
  }
  heard[list] = [...heard[list], order.join('.')].slice(-HEARD);
  if (rivalsUpdated()) { try { localStorage.setItem(HEARD_KEY(), JSON.stringify(heard)); } catch (_) {} }
  return order;
}
// A new pass through the jukebox, from `first` or else not from the song that just played.
function shuffleSongs(first = -1) {
  songs = {order: playThrough('songs', songPool(), first, indexOf(selected)), at: 0};
  if (songs.order.length) selected = TRACKS[songs.order[0]].id;
}
function nextSong() {
  if (++songs.at >= songs.order.length) shuffleSongs(); else selected = TRACKS[songs.order[songs.at]].id;
}
// A new battle: a pass through the battle songs from the one it starts in; every other song's first part is random.
function shuffleParts(start) {
  const {song, n} = PIECES[start];
  cursor = BATTLE_SONGS.map(s => Math.floor(Math.random() * s.parts.length));
  cursor[song] = (n + 1) % BATTLE_SONGS[song].parts.length;
  parts = {order: playThrough('parts', battlePool(), song), at: 0};
}
// The next battle song in the shuffle, at its next part.
function nextPart() {
  if (++parts.at >= parts.order.length) parts = {order: playThrough('parts', battlePool(), -1, parts.order[parts.order.length - 1]), at: 0};
  if (!parts.order.length) return spot.part;
  const song = parts.order[parts.at], n = cursor[song];
  cursor[song] = (n + 1) % BATTLE_SONGS[song].parts.length;
  return pieceOf(song, n);
}
// What plays after the current song and the current battle song, in this pass (for the checks).
export const upNext = () => ({songs: songs.order.slice(songs.at + 1).map(i => TRACKS[i].id), parts: parts.order.slice(parts.at + 1)});

let selected = TRACKS[0].id;
const track = () => TRACKS.find(t => t.id === selected) || TRACKS[0];
const clients = new Set(), listeners = new Set();
export const DEFAULT_MUSIC_VOLUME = 8;
let enabled = true, volume = DEFAULT_MUSIC_VOLUME, started = false, away = false, failure = '';
let audio = null, master = null, media = null, pending = 0, revision = 0, offProfile = null;
let sceneGain = null, fadePending = false;
let systemOwned = false, previousType = null;
// shown: the visible scene ('hub', 'battle' or null). lastBattle: the battle view the battle playlist last started for, so a new
// battle rolls a new start while returning to the same one carries on. ownSong: a jukebox song replaces the battle playlist in this
// battle. loaded: what the media element holds (a track id or 'battle:<part>'). spot: the battle part and where in it.
// resume: each song's place when the battle playlist took over from it. seekTo: a position to apply once the new source's
// metadata loads.
let shown = null, lastBattle = null, ownSong = false, loaded = '', spot = {part: 0, at: 0}, resume = {}, seekTo = null;
const systemActions = ['play', 'pause', 'stop', 'seekto', 'seekbackward', 'seekforward'];

let preferenceKey;
// The saved on/off and level. The saved track is the song last played, which a new shuffle never opens with.
function read() {
  preferenceKey = KEY();
  enabled = true; volume = DEFAULT_MUSIC_VOLUME; excluded = new Set();
  let last = '';
  try {
    const saved = JSON.parse(localStorage.getItem(KEY()));
    if (typeof saved?.enabled === 'boolean') enabled = saved.enabled;
    if (typeof saved?.volume === 'number' && Number.isFinite(saved.volume)) volume = Math.max(0, Math.min(100, Math.round(saved.volume)));
    if (TRACKS.some(t => t.id === saved?.track)) last = saved.track;
    if (Array.isArray(saved?.excluded)) excluded = new Set(saved.excluded.filter(id => [...TRACKS, ...BATTLE_SONGS].some(t => t.id === id)));
  } catch (_) {}
  return last;
}
// Entering Rivals (or another profile): the settings, and a new shuffled play-through of the jukebox.
function begin() {
  const last = read();
  if (last) selected = last;
  readHeard(); shuffleSongs();
}
begin();
const visible = () => [...clients].some(c => c.visible);
const wanted = () => rivalsUpdated() && visible() && !document.hidden && !away && started && enabled && volume > 0 && !empty();
const notify = () => { updateSystem(); listeners.forEach(fn => fn()); };
const playingMix = () => shown === 'battle' && !ownSong;
const empty = () => !(playingMix() ? battlePool() : songPool()).length;
// The music's gain for the loaded source: slider × MUSIC_LEVEL × the track's loudness level.
const outputLevel = () => volume / 100 * MUSIC_LEVEL * (partOf(loaded) >= 0 ? BATTLE.level : (TRACKS.find(t => t.id === loaded) || track()).level);
export function state() {
  if (preferenceKey !== KEY()) begin();
  const here = Number.isFinite(media?.currentTime) ? media.currentTime : 0;
  const length = Number.isFinite(media?.duration) ? media.duration : 0;
  return {enabled, volume, excluded: [...excluded], empty: empty(), track: playingMix() ? battleNow() : track(), battle: shown === 'battle', position: here, duration: length,
    playing: !!media && !media.paused && media.readyState >= 3 && audio?.state === 'running',
    loading: !!pending, supported: !!(globalThis.AudioContext || globalThis.webkitAudioContext), failure};
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Phone buttons remain OS media volume. This gain is only the game's relative music level.
// Optional APIs identify Rivals as playback and expose the song to native media controls.
function ownSystem() {
  if (systemOwned) return;
  systemOwned = true;
  try { if (navigator.audioSession) { previousType = navigator.audioSession.type; navigator.audioSession.type = 'playback'; } } catch (_) {}
  const actions = {play: () => setEnabled(true), pause: () => setEnabled(false), stop: () => { setEnabled(false); seek(0); },
    seekto: e => seek(e.seekTime), seekbackward: e => seek(state().position - (e.seekOffset || 10)), seekforward: e => seek(state().position + (e.seekOffset || 10))};
  for (const name of systemActions) {
    try { navigator.mediaSession?.setActionHandler(name, e => { if (rivalsUpdated() && visible() && !document.hidden && !away) actions[name](e || {}); }); } catch (_) {}
  }
  updateMetadata();
}
function updateMetadata() {
  if (!systemOwned) return;
  const now = playingMix() ? battleNow() : track();
  try { if (navigator.mediaSession && globalThis.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({title: now.title, artist: now.artist, album: 'Gridiron Rivals',
    ...(now.cover ? {artwork: [{src: now.cover, sizes: '320x320', type: 'image/webp'}]} : {})}); } catch (_) {}
}
function releaseSystem() {
  if (!systemOwned) return;
  systemOwned = false;
  for (const name of systemActions) { try { navigator.mediaSession?.setActionHandler(name, null); } catch (_) {} }
  try { if (navigator.mediaSession) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.setPositionState?.(); } } catch (_) {}
  try { if (navigator.audioSession?.type === 'playback' && previousType != null) navigator.audioSession.type = previousType; } catch (_) {}
  previousType = null;
}
function updateSystem() {
  if (!rivalsUpdated() || !visible() || document.hidden || away) { releaseSystem(); return; }
  if (!systemOwned) return;
  const s = state();
  try { if (navigator.mediaSession) navigator.mediaSession.playbackState = s.playing ? 'playing' : 'paused'; } catch (_) {}
  try { if (s.duration > 0) navigator.mediaSession?.setPositionState?.({duration: s.duration, position: Math.min(s.position, s.duration), playbackRate: 1}); } catch (_) {}
}

// What the visible scene plays: a part of a battle song, or a looping jukebox song (back where it was, after a battle).
function desired() {
  if (playingMix()) return {key: 'battle:' + spot.part, url: PIECES[spot.part].url, loop: false, at: spot.at};
  const t = track();
  return {key: t.id, url: t.url, loop: songPool().length === 1, at: resume[t.id] || 0};
}
// Point the media element at it. A new source cancels any pending play without suspending the context, so the next
// battle part can follow the last one without a fresh tap; sync() then plays it if music is wanted.
function load(force = false) {
  if (!media || empty()) return;
  const next = desired();
  if (next.key === loaded) {
    media.loop = next.loop;
    if (force) { if (media.error) media.load(); jump(next.at); }
    updateMetadata(); return;
  }
  const was = partOf(loaded), here = Number.isFinite(media.currentTime) ? media.currentTime : 0;
  if (loaded && was < 0 && partOf(next.key) >= 0) resume[loaded] = here;
  if (was >= 0 && !playingMix()) spot = {part: was, at: here};
  if (partOf(next.key) < 0) delete resume[next.key];
  revision++; pending = 0;
  loaded = next.key; media.loop = next.loop; media.src = next.url;
  jump(next.at);
  updateMetadata();
}
// Before a new source's metadata loads, setting currentTime sets where it starts (its default playback start position),
// so it never plays from 0 first. Browsers without that get the seek once the metadata arrives.
function jump(at) {
  seekTo = media.readyState < 1 && at > 0 ? at : null;
  try { media.currentTime = at; } catch (_) {}
}
// Hold the incoming scene silent through buffering. The separate gain lets the volume slider
// and each track's loudness adjustment keep working throughout the fade.
function armSceneFade() {
  fadePending = true;
  if (!sceneGain) return;
  const now = audio.currentTime;
  sceneGain.gain.cancelScheduledValues(now);
  sceneGain.gain.setValueAtTime(0, now);
}
function fadeWhenPlaying() {
  if (!fadePending || audio.state !== 'running' || media.paused || media.readyState < 3) return;
  fadePending = false;
  const now = audio.currentTime;
  sceneGain.gain.setValueAtTime(0, now);
  sceneGain.gain.linearRampToValueAtTime(1, now + SCENE_FADE_SECONDS);
}
// A battle view that becomes visible for the first time rolls a new start in the battle playlist.
function checkScene() {
  const battle = [...clients].find(c => c.visible && c.battle), now = battle ? 'battle' : visible() ? 'hub' : null;
  const newBattle = battle && battle !== lastBattle;
  if (now === shown && !newBattle) return;
  shown = now;
  if (!now) return;
  armSceneFade();
  if (newBattle) { lastBattle = battle; ownSong = false; spot = randomSpot(); shuffleParts(spot.part); }
  load(!!newBattle);
}

function halt(reset = false) {
  revision++; pending = 0;
  if (media) { media.pause(); if (reset) { try { media.currentTime = 0; } catch (_) {} } }
  if (audio) {
    master.gain.cancelScheduledValues(audio.currentTime); master.gain.setValueAtTime(0, audio.currentTime);
    if (audio.state === 'running') audio.suspend().catch(() => {});
  }
  notify();
}
function sync() {
  checkScene();
  if (!wanted()) { halt(); return; }
  if (!audio) { notify(); return; }
  ownSystem();
  master.gain.setTargetAtTime(outputLevel(), audio.currentTime, .04);
  if (pending || (audio.state === 'running' && !media.paused)) {
    if (!pending) fadeWhenPlaying();
    notify(); return;
  }
  const request = ++revision; pending = request; failure = '';
  // Invoke both in the original gesture; waiting for resume first loses iOS's play permission.
  Promise.all([audio.resume(), media.play()]).then(() => {
    if (request !== revision) return;
    pending = 0;
    if (!wanted()) halt(); else { fadeWhenPlaying(); notify(); }
  }, () => {
    if (request !== revision) return; // a mute, hide, profile change or new source canceled that play
    failure = media.error ? 'The track couldn’t load. Pause, then play to retry.' : 'Playback was blocked. Pause, then play to retry.';
    halt();
  });
  notify();
}
// Called synchronously from a tap or keypress. No media element or MP3 request before it.
export function start() {
  if (!rivalsUpdated() || !visible()) return;
  started = true;
  if (!enabled || !volume || empty()) { sync(); return; }
  if (!audio) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) { notify(); return; }
    try {
      ownSystem();
      audio = new AC(); master = audio.createGain(); master.gain.value = 0;
      master.connect(audio.destination);
      sceneGain = audio.createGain(); sceneGain.gain.value = fadePending ? 0 : 1;
      sceneGain.connect(master);
      media = new Audio(); media.preload = 'none'; loaded = '';
      checkScene(); load();
      audio.createMediaElementSource(media).connect(sceneGain);
      media.addEventListener('loadedmetadata', () => {
        if (seekTo == null) return;
        const at = seekTo; seekTo = null;
        if (Math.abs(media.currentTime - at) > .5) { try { media.currentTime = Math.min(at, Math.max(0, (media.duration || at) - 1)); } catch (_) {} }
      });
      // A song's end plays the next one in the shuffle; a battle part's end, the next battle song in its shuffle.
      const finish = () => {
        if (!wanted()) return;
        if (partOf(loaded) >= 0) spot = {part: nextPart(), at: 0};
        else { nextSong(); save(); }
        load(true); sync();
      };
      media.addEventListener('ended', finish);
      media.addEventListener('playing', () => { if (!wanted()) halt(); else { fadeWhenPlaying(); notify(); } });
      media.addEventListener('pause', notify); media.addEventListener('waiting', notify);
      for (const name of ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked']) media.addEventListener(name, notify);
      media.addEventListener('error', () => {
        // A damaged last frame (Sundress's, under Chromium's newer MP3 decoder) fails a moment before the end: that
        // counts as the end, so the shuffle carries on.
        const left = media.duration - media.currentTime;
        if (loaded && Number.isFinite(left) && left >= 0 && left < 2) { finish(); return; }
        failure = 'The track couldn’t load. Pause, then play to retry.'; halt();
      });
      audio.onstatechange = () => {
        if (audio.state === 'interrupted' || !wanted()) halt();
        else if (audio.state === 'suspended' && !pending && !failure) sync();
        else notify();
      };
    } catch (_) {
      media?.pause(); audio?.close().catch(() => {}); audio = null; sceneGain = null; media = null; loaded = '';
      releaseSystem();
      failure = 'Music is unavailable in this browser.'; notify(); return;
    }
  }
  if (media.error) media.load();
  sync();
}
export function setEnabled(value) {
  if (!rivalsUpdated()) return;
  enabled = !!value; save(); start();
}
export function setVolume(value) {
  if (!rivalsUpdated() || !Number.isFinite(Number(value))) return;
  volume = Math.max(0, Math.min(100, Math.round(Number(value)))); save(); start();
}
// The battle playlist can be picked only in a battle, to go back to it after choosing a song there.
export function selectTrack(id) {
  if (!rivalsUpdated() || !visible()) return;
  if (id === BATTLE.id) {
    if (shown !== 'battle') return;
    if (ownSong) { halt(); ownSong = false; load(); }
  } else {
    if (!TRACKS.some(t => t.id === id)) return;
    const wasExcluded = excluded.delete(id);
    const before = media ? loaded : '';
    if (id !== selected || wasExcluded) shuffleSongs(indexOf(id));
    if (shown === 'battle') ownSong = true;
    if (media && desired().key !== before) { halt(); load(); }
    updateMetadata();
  }
  enabled = true; save(); start();
}
// Tapping a disabled song includes it again and plays it immediately. Checkboxes only edit the rotation.
export function selectBattleTrack(id) {
  if (!rivalsUpdated() || !visible() || shown !== 'battle') return;
  const index = BATTLE_SONGS.findIndex(t => t.id === id);
  if (index < 0) return;
  excluded.delete(id); halt(); ownSong = false;
  spot = {part: pieceOf(index, 0), at: 0}; shuffleParts(spot.part); load(true);
  enabled = true; save(); start();
}
function reconcilePlaylist() {
  shuffleSongs(excluded.has(selected) ? -1 : indexOf(selected));
  const current = PIECES[spot.part].song;
  if (excluded.has(BATTLE_SONGS[current].id)) spot = randomSpot();
  shuffleParts(spot.part);
  // An empty playlist stays quiet; disabling the current song advances immediately.
  if (empty() || (media && desired().key !== loaded)) halt();
  load(); sync();
}
export function setTrackEnabled(id, value) {
  if (!rivalsUpdated() || ![...TRACKS, ...BATTLE_SONGS].some(t => t.id === id)) return;
  if (value) excluded.delete(id); else excluded.add(id);
  reconcilePlaylist(); save();
}
export function setPlaylistEnabled(list, value) {
  if (!rivalsUpdated() || !['songs', 'battle'].includes(list)) return;
  for (const t of list === 'battle' ? BATTLE_SONGS : TRACKS) {
    if (value) excluded.delete(t.id); else excluded.add(t.id);
  }
  reconcilePlaylist(); save();
}
export function seek(seconds) {
  const duration = state().duration;
  if (!rivalsUpdated() || !visible() || !media || !duration || !Number.isFinite(Number(seconds))) return;
  try { media.currentTime = Math.max(0, Math.min(duration, Number(seconds))); } catch (_) {}
  notify();
}
// Skip: the next song in the shuffle, or while the battle playlist plays, the next battle song in its shuffle.
export function skipTrack() {
  if (!rivalsUpdated() || !visible() || empty()) return;
  if (playingMix()) {
    halt(true);
    spot = {part: nextPart(), at: 0}; load(true);
  } else {
    halt(true);
    nextSong(); load(); updateMetadata();
  }
  save(); start();
}
function save() { try { localStorage.setItem(KEY(), JSON.stringify({enabled, volume, track: selected, ...(excluded.size ? {excluded: [...excluded]} : {})})); } catch (_) {} }
const visibility = () => sync();
const pageHide = () => { away = true; halt(); };
const pageShow = () => { away = false; sync(); };
// Another tab's settings change follows here; each tab keeps its own shuffle.
const storage = e => {
  if (e.key !== KEY() && e.key !== null) return;
  const before = [...excluded].sort().join('|');
  read();
  if (before !== [...excluded].sort().join('|')) reconcilePlaylist(); else sync();
};

// Mounted routes can coexist in the navigation stack; only visible Rivals views own playback.
// kind 'battle' marks the battle view, which plays the battle playlist.
export function attach(el, isVisible = true, kind = 'hub') {
  const client = {visible: isVisible, battle: kind === 'battle'}; clients.add(client);
  if (clients.size === 1) {
    begin(); load();
    away = false;
    offProfile = data.subscribe(type => { if (type === 'me') { started = false; halt(true); releaseSystem(); begin(); failure = ''; resume = {}; load(); notify(); } });
    document.addEventListener('visibilitychange', visibility);
    addEventListener('pagehide', pageHide); addEventListener('pageshow', pageShow); addEventListener('storage', storage);
  }
  const gesture = e => {
    if (!client.visible || !e.isTrusted || (e.type === 'keydown' && !['Enter', ' '].includes(e.key))) return;
    if (e.target.closest('[data-dy-exit], [data-back], [data-dy-sound], [data-dy-music-menu], [data-dy-music-skip]')) return;
    start();
  };
  el.addEventListener('click', gesture, true); el.addEventListener('keydown', gesture, true);
  sync();
  return {
    visible(value) { client.visible = !!value; sync(); },
    stop() {
      clients.delete(client); el.removeEventListener('click', gesture, true); el.removeEventListener('keydown', gesture, true);
      if (client === lastBattle) lastBattle = null;
      if (!clients.size) {
        offProfile?.(); offProfile = null;
        document.removeEventListener('visibilitychange', visibility);
        removeEventListener('pagehide', pageHide); removeEventListener('pageshow', pageShow); removeEventListener('storage', storage);
        started = false; shown = null; ownSong = false; halt(true);
      } else sync();
    }
  };
}
