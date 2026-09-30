// Hall: now three segments of the League tab (Trophies · Records · Shame, next to Standings). The container moved to
// league.js; this module re-exports it, so a registry entry or an import under the old id gets the League root.
// The segments stay in hall-trophies.js, hall-records.js and hall-shame.js. Owner: LEAGUE.
export {default, segPath} from './league.js';
