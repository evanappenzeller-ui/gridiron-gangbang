import * as features from '../core/features.js';
// Shared punt opening. Presentation only: the simulation stays at zero until it finishes.
export const DURATION = 2600;
const clamp = v => Math.max(0, Math.min(1, v));
export const ease = v => { const p = clamp(v); return p * p * (3 - 2 * p); };
export const enabled = st => !!st.intro && features.returnManUpdated();
export const duration = st => enabled(st) ? (st.introReduced ? 1100 : DURATION) : 750;
export function shot(st, now) {
  if (!enabled(st) || (st.mode !== 'catch' && !(st.mode === 'paused' && st.pausedMode === 'catch'))) return null;
  const clock = st.mode === 'paused' ? st.pausedAt : now;
  const p = clamp((clock - st.catchAt) / duration(st));
  return {p, flight: clamp(p / .42), hands: ease(p / .22) * (1 - ease((p - .49) / .25)),
    orbit: st.introReduced ? 1 : ease((p - .54) / .46), ball: 1 - ease((p - .72) / .13),
    label: p < .42 ? 'EYES ON THE BALL' : p < .66 ? 'GOT IT!' : 'TAKE IT TO THE HOUSE'};
}
