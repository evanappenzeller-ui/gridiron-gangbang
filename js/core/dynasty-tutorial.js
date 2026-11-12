// A disposable practice duel using the real v7 engine. No collection, Solo record,
// currency, rewards or live opponent is read or written by this session.
import * as B from './dynasty-pocket.js';
import * as C from './dynasty-pocket-cards.js';

export const LESSONS = [
  ['Welcome to the field', 'Learn by playing a short guided battle with loaner cards. Win a real match by earning 3 knockout points, or by leaving your opponent with no athlete in play. Your collection and real matches stay safe.'],
  ['Set your lineup', 'Tap Patrick Mahomes in your hand and choose Active. Put CeeDee Lamb on the Bench, then Confirm lineup. Only your Active attacks; up to 3 Base Players can wait on your Bench. You can also hold and drag cards into place.'],
  ['Power your Active', 'Drag the Fire Energy orb onto Mahomes. You get one attachment each turn, to your Active or Bench. The manager going first gets no normal Energy on the opening turn. You are going second.'],
  ['Play a Supporter', 'Tap Film Study in your hand and play it to draw 2 cards. You can play only one Supporter per turn. Items can be used more than once; each athlete can hold one Tool, and one shared Stadium can be played per turn.'],
  ['Make your first attack', 'Tap your Active Mahomes, then Pocket Escape. Its one Colorless symbol accepts any Energy type. Attacks end your turn, but keep attached Energy unless the card says otherwise. The coach will play next.'],
  ['Develop your player', 'Your next turn draws a card automatically. Play Mahomes – Breakout onto your Active Mahomes. Development needs the exact matching player and keeps damage and Energy. You cannot develop on your first turn, the turn a player enters, or twice in one turn.'],
  ['Build toward a bigger play', 'Drag this turn’s Fire Energy onto Mahomes again. Breakout Play needs one Fire plus one Energy of any type. Read the printed costs and effects; rarity and NFL rating do not add battle bonuses.'],
  ['Earn a knockout point', 'Tap Mahomes and use Breakout Play. Damage reduces HP; reaching zero knocks a player out. A regular player is worth 1 point, ex 2, and Mega ex 3. Your opponent promotes a Benched replacement for free.'],
  ['Prepare your next attacker', 'You earned your first point! Drag this turn’s Energy onto your Benched CeeDee Lamb. Powering the Bench prepares a replacement before your Active gets knocked out.'],
  ['Retreat to your Bench', 'Tap your Active Mahomes and choose Retreat. Pay his printed cost by discarding 1 attached Energy, then Lamb takes over. You may retreat once per turn and still attack afterward.'],
  ['Attack with your replacement', 'Tap your Active Lamb and use Quick Separation. He can attack because you powered him on the Bench. Keep preparing players, managing Energy and choosing attacks until you reach 3 knockout points.'],
  ['You’re ready to play', 'You set a lineup, attached Energy, played support, attacked, developed a player, scored a knockout and retreated. In a real match, keep going until you earn 3 points or knock out the opponent’s last athlete in play.']
];

export function createTutorial() {
  // Fix only the practice deal, preserving all twenty cards and their printed rules.
  const deck = C.rentalDeck().ids.map(id => id === 'R7-jefferson' ? 'R7-lamb' : id);
  const G = B.newGame('rivals-tutorial-v1', [deck, deck], {first: 1, energy: [['Fire'], ['Fire']]});
  const hand = ['R7-mahomes', 'R7-lamb', 'P7-film', 'R7-mahomes~breakout', 'P7-recovery'];
  for (const p of G.p) {
    const rest = deck.slice();
    hand.forEach(id => rest.splice(rest.indexOf(id), 1));
    p.hand = hand.slice(); p.deck = rest;
  }
  B.apply(G, 1, {a: 'setup', act: 'R7-mahomes', bench: ['R7-lamb']});
  let step = 0;
  const subs = new Set();
  const emit = () => subs.forEach(fn => fn());
  const session = {
    get step() { return step; },
    get() { return {G, you: 0, mid: 'tutorial', opp: {name: 'Practice coach'}, state: G.phase === 'setup' ? 'setup' : G.who === 0 ? 'yours' : 'theirs'}; },
    begin() { if (step === 0) { step = 1; emit(); } },
    allowed(m) {
      const p = G.p[0];
      if (step === 1) return m.a === 'setup' && m.act === 'R7-mahomes' && m.bench.length === 1 && m.bench[0] === 'R7-lamb';
      if ([2, 6, 8].includes(step)) return m.a === 'energy' && m.on === (step === 8 ? p.bench[0]?.u : p.active?.u);
      if (step === 3) return m.a === 'support' && m.id === 'P7-film';
      if ([4, 7, 10].includes(step)) return m.a === 'attack' && m.n === 0;
      if (step === 5) return m.a === 'evolve' && m.id === 'R7-mahomes~breakout' && m.on === p.active?.u;
      if (step === 9) return m.a === 'retreat' && m.to === p.bench[0]?.u;
      return false;
    },
    move(mid, m) {
      if (!session.allowed(m)) return {ok: false, why: `For this lesson: ${LESSONS[step][0].toLowerCase()}. Follow the coach’s instruction above the table.`};
      const r = B.apply(G, 0, m);
      if (r.ok) step++;
      return r;
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    // Playback has the same visibility, profile and animation boundary as real Solo.
    watchPlayback(mid, ready) {
      const timer = setInterval(() => {
        if (step === 0 || step === 11 || G.phase !== 'play' || G.who !== 1 || !ready()) return;
        const actions = B.legalActions(G, 1), p = G.p[1];
        const m = actions.find(m => m.a === 'promote')
          || actions.find(m => m.a === 'energy' && m.on === p.active?.u)
          || actions.find(m => m.a === 'attack' && m.n === 0)
          || actions.find(m => m.a === 'end');
        if (m && B.apply(G, 1, m).ok) emit();
      }, 650);
      return () => clearInterval(timer);
    }
  };
  return session;
}
