// Shared procedural gear for the pickup, the runner's back, and the 2D fallback.
export function makeJetpack(T) {
  const g = new T.Group(); g.name = 'jetpack';
  const shell = new T.MeshStandardMaterial({color: 0xF4BE36, metalness: .35, roughness: .35});
  const trim = new T.MeshStandardMaterial({color: 0x18324C, metalness: .25, roughness: .4});
  const light = new T.MeshBasicMaterial({color: 0x65EEFF, toneMapped: false});
  const hot = new T.MeshBasicMaterial({color: 0xFFF2AE, toneMapped: false});
  const box = (w, h, d, mat, x, y, z) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m;
  };
  box(.64, .52, .25, trim, 0, .05, 0);
  box(.22, .28, .04, light, 0, .06, .15);
  for (const x of [-.34, .34]) {
    const tank = new T.Mesh(new T.CapsuleGeometry(.2, .55, 4, 10), shell); tank.position.set(x, .05, 0); tank.castShadow = true; g.add(tank);
    box(.41, .12, .42, trim, x, -.17, 0);
    const nozzle = new T.Mesh(new T.CylinderGeometry(.15, .19, .18, 10), trim); nozzle.position.set(x, -.48, 0); g.add(nozzle);
    const flame = new T.Group(); flame.name = 'jet-flame'; flame.position.set(x, -.56, 0);
    for (const [r, h, mat] of [[.16, .85, light], [.09, .55, hot]]) {
      const m = new T.Mesh(new T.ConeGeometry(r, h, 9), mat); m.rotation.z = Math.PI; m.position.y = -h / 2; flame.add(m);
    }
    g.add(flame);
  }
  return g;
}
export function animateJetpack(g, t, power = 1) {
  g.children.forEach(o => { if (o.name === 'jet-flame') o.scale.y = power * (.88 + .12 * Math.sin(t * 28 + o.position.x * 5)); });
}
export function jetpackIcon(c, t = 0) {
  c.fillStyle = '#18324C'; c.fillRect(-.25, -.19, .5, .43);
  for (const x of [-.27, .27]) {
    c.fillStyle = '#F8C744'; c.beginPath(); c.roundRect(x - .13, -.36, .26, .65, .11); c.fill();
    c.fillStyle = '#18324C'; c.fillRect(x - .14, .13, .28, .11);
    c.fillStyle = '#58E9FF'; c.beginPath(); c.moveTo(x - .11, .29); c.lineTo(x, .64 + .04 * Math.sin(t * 28)); c.lineTo(x + .11, .29); c.fill();
    c.fillStyle = '#FFF4B5'; c.beginPath(); c.moveTo(x - .055, .29); c.lineTo(x, .49); c.lineTo(x + .055, .29); c.fill();
  }
  c.fillStyle = '#65EEFF'; c.fillRect(-.075, -.12, .15, .22);
}
