// Compact code-built rides share the runner's lighting and curved world. No runtime asset downloads.
export function makeRide(T, kind) {
  const root = new T.Group(); root.name = `return-ride-${kind}`;
  const mat = (color, other = {}) => new T.MeshStandardMaterial({color, roughness: .5, metalness: .12, flatShading: true, ...other});
  const ink = mat(0x17293B), chrome = mat(0xD2E8E8, {metalness: .65, roughness: .3});
  const paint = mat(kind === 'scooter' ? 0xFFB536 : 0x7462F1);
  const glow = mat(0x68F5E6, {emissive: 0x28C9BC, emissiveIntensity: .65});
  const add = (geo, material, x = 0, y = 0, z = 0, parent = root) => {
    const m = new T.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  };
  if (kind === 'scooter') {
    add(new T.BoxGeometry(.72, .15, 1.6), paint, 0, .27);
    add(new T.BoxGeometry(.52, .025, 1.1), ink, 0, .36, .08);
    for (const z of [-.68, .68]) {
      const wheel = add(new T.CylinderGeometry(.23, .23, .16, 10), ink, 0, .23, z);
      wheel.rotation.z = Math.PI / 2; wheel.name = 'ride-wheel';
      for (const x of [-.085, .085]) {
        const hub = add(new T.CylinderGeometry(.105, .105, .025, 8), chrome, x, .23, z);
        hub.rotation.z = Math.PI / 2;
      }
    }
    const stem = new T.Group(); stem.name = 'ride-stem'; stem.position.set(0, .36, -.64); root.add(stem);
    add(new T.CylinderGeometry(.055, .07, 1.05, 8), chrome, 0, .52, -.05, stem);
    add(new T.BoxGeometry(1.18, .085, .1), ink, 0, 1.08, -.1, stem);
    for (const x of [-.53, .53]) add(new T.BoxGeometry(.24, .12, .16), paint, x, 1.08, -.1, stem);
    add(new T.BoxGeometry(.22, .18, .1), glow, 0, .85, -.12, stem);
    add(new T.BoxGeometry(.42, .08, .07), chrome, 0, .32, .82);
  } else {
    add(new T.BoxGeometry(1.08, .18, 1.6), paint, 0, .28);
    for (const z of [-.8, .8]) {
      const tip = add(new T.CylinderGeometry(.54, .54, .18, 8), paint, 0, .28, z);
      tip.scale.z = .36;
    }
    add(new T.BoxGeometry(.78, .03, 1.26), ink, 0, .39);
    for (const x of [-.53, .53]) add(new T.BoxGeometry(.045, .07, 1.55), glow, x, .31);
    for (const z of [-.56, .56]) {
      add(new T.CylinderGeometry(.24, .2, .1, 8), chrome, 0, .14, z);
      const jet = add(new T.ConeGeometry(.2, .25, 8), glow, 0, .025, z);
      jet.rotation.x = Math.PI; jet.name = 'ride-thruster';
    }
    add(new T.BoxGeometry(.16, .035, 1.55), glow, 0, .41);
  }
  root.userData.kind = kind;
  return root;
}

export function animateRide(root, ride, slide = false, reduced = false) {
  const t = reduced ? 0 : ride.age;
  root.scale.setScalar(reduced ? 1 : Math.min(1, .25 + ride.age * 5));
  const stem = root.getObjectByName('ride-stem');
  if (stem) stem.rotation.x = slide ? -1.25 : 0;
  root.traverse(o => {
    if (o.name === 'ride-wheel') o.rotation.x = t * 18;
    if (o.name === 'ride-thruster') o.scale.y = 1 + Math.sin(t * 18) * .15;
  });
}

/** Canvas fallback. Call before the runner, at his ground feet; lift his sprite .35 yards. */
export function drawRide(st, c, x, y, z, ride, project) {
  if (!ride || !(ride.left > 0)) return;
  const p = project(st, x, y, z);
  c.save(); c.translate(p.x, p.y); c.scale(p.s, p.s);
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (ride.kind === 'scooter') {
    c.fillStyle = '#17293B';
    for (const x of [-.31, .31]) { c.beginPath(); c.ellipse(x, -.1, .12, .2, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#FFB536'; c.beginPath(); c.moveTo(-.48, -.24); c.lineTo(-.27, -.56); c.lineTo(.27, -.56); c.lineTo(.48, -.24); c.closePath(); c.fill();
    c.strokeStyle = '#D2E8E8'; c.lineWidth = .055; c.beginPath(); c.moveTo(0, -.5); c.lineTo(0, -1.38); c.stroke();
    c.strokeStyle = '#FFB536'; c.lineWidth = .12; c.beginPath(); c.moveTo(-.43, -1.38); c.lineTo(.43, -1.38); c.stroke();
  } else {
    c.fillStyle = '#68F5E6'; c.globalAlpha = .35; c.beginPath(); c.ellipse(0, -.08, .65, .16, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    c.fillStyle = '#7462F1'; c.strokeStyle = '#68F5E6'; c.lineWidth = .055;
    c.beginPath(); c.moveTo(-.63, -.27); c.lineTo(-.42, -.58); c.lineTo(.42, -.58); c.lineTo(.63, -.27); c.quadraticCurveTo(0, -.1, -.63, -.27); c.fill(); c.stroke();
    c.fillStyle = '#17293B'; c.fillRect(-.3, -.43, .6, .13);
  }
  c.restore();
}
