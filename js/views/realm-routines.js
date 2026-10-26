// Peaceful base routines. Routes are precomputed against the building grid;
// animation never drives position or changes the battle simulation.
export function routineRoute(paths, b, c, size, phase) {
  const home = paths.nearest(b.x + size / 2 + c.u, b.y + size / 2 + c.v);
  if (!home) return [];
  const angle = phase * Math.PI * 2;
  const end = paths.nearest(home.x + Math.cos(angle) * 4, home.y + Math.sin(angle) * 4);
  return paths.route(home, end).slice(0, 5);
}

export function homeRoutine(route, {role, building, phase = 0}, seconds, still = false) {
  const home = route[0];
  const work = role === 'build' ? 'work' : ({mine: 'work', hut: 'work_b', barracks: 'work_c'})[building];
  const idle = 8 + phase * 7, duty = work ? 4 + phase * 3 : 0, rest = 5 + phase * 6;
  const speed = .48 + phase * .14, travel = Math.max(0, route.length - 1) / speed;
  let t = still ? 0 : (seconds + phase * 97) % (idle + duty + travel * 2 + rest);
  let state = 'idle', distance = 0, returning = false;
  if (!still && t >= idle) {
    t -= idle;
    if (t < duty) state = work;
    else {
      t -= duty;
      if (t < travel) { state = 'walk'; distance = t * speed; }
      else if (t < travel + rest) distance = route.length - 1;
      else { state = 'walk'; returning = true; distance = Math.max(0, route.length - 1 - (t - travel - rest) * speed); }
    }
  }
  if (!home) return {state: 'idle', point: null, face: null};
  const index = Math.min(Math.floor(distance), Math.max(0, route.length - 2));
  const a = route[index], b = route[index + 1] || a, f = distance - index;
  return {state, point: {x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f},
    face: state === 'walk' ? Math.atan2((b.x - a.x) * (returning ? -1 : 1), (b.y - a.y) * (returning ? -1 : 1)) : null,
    rate: state === 'walk' ? speed / .55 : .85 + phase * .25};
}
