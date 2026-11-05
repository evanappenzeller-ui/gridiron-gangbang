// Small, readable airborne silhouettes. Only the owner pilot requests these objects.
export function makeHazard(T, kind) {
  const g = new T.Group(); g.name = 'sky-' + kind; g.userData.airKind = kind;
  const mat = color => new T.MeshStandardMaterial({color, roughness: .8, flatShading: true});
  const dark = mat(0x26384B), cream = mat(0xFFF1CC), red = mat(0xF16D43), gold = mat(0xF1BD43);
  const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  if (kind === 'birds') {
    const body = new T.InstancedMesh(new T.SphereGeometry(1, 6, 4), cream, 5); body.name = 'bird-bodies';
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute([0, 0, -.16, .72, 0, .2, .14, 0, .28], 3)); geo.computeVertexNormals();
    const wingMat = dark.clone(); wingMat.side = T.DoubleSide;
    const wings = new T.InstancedMesh(geo, wingMat, 10); wings.name = 'bird-wings';
    body.frustumCulled = wings.frustumCulled = false; g.add(body, wings);
    const o = new T.Object3D();
    for (let i = 0; i < 5; i++) {
      const x = (i % 3 - 1) * .62, z = Math.floor(i / 3) * .8 + Math.abs(x) * .4;
      o.position.set(x, (i % 2) * .18, z); o.scale.set(.17, .18, .37); o.updateMatrix(); body.setMatrixAt(i, o.matrix);
    }
  } else if (kind === 'drone') {
    mesh(new T.BoxGeometry(.72, .38, .72), red);
    for (const x of [-.7, .7]) for (const z of [-.55, .55]) {
      const arm = mesh(new T.BoxGeometry(.9, .1, .12), dark, x / 2, 0, z / 2); arm.rotation.y = x * z > 0 ? -.66 : .66;
      const rotor = mesh(new T.BoxGeometry(.8, .045, .1), dark, x, .16, z); rotor.name = 'rotor';
      mesh(new T.TorusGeometry(.39, .028, 4, 12).rotateX(Math.PI / 2), cream, x, .1, z);
    }
    mesh(new T.SphereGeometry(.12, 8, 5), gold, 0, -.2, -.37);
  } else if (kind === 'balloon') {
    mesh(new T.SphereGeometry(1, 10, 7), red, 0, .35).scale.set(.86, 1.15, .86);
    mesh(new T.SphereGeometry(1, 10, 7), gold, 0, .36).scale.set(.3, 1.16, .87);
    mesh(new T.BoxGeometry(.6, .4, .55), gold, 0, -1.15);
    for (const x of [-.22, .22]) mesh(new T.CylinderGeometry(.018, .018, .6, 4), cream, x, -.83);
  } else {
    for (let i = 0; i < 3; i++) {
      const rock = mesh(new T.IcosahedronGeometry(.55, 0), i % 2 ? gold : dark, (i - 1) * .65, (i % 2) * .2, Math.abs(i - 1) * .5);
      rock.name = 'debris'; rock.scale.set(1, .8, 1.2);
    }
  }
  const ring = new T.Mesh(new T.TorusGeometry(1.22, .035, 4, 28), new T.MeshBasicMaterial({color: 0xFFB545, transparent: true, opacity: .65, toneMapped: false}));
  ring.name = 'warning-ring'; ring.position.z = 1.1; g.add(ring);
  return g;
}
let transform;
export function animateHazard(T, g, time, reduced = false) {
  const t = reduced ? 0 : time, kind = g.userData.airKind;
  if (kind === 'birds') {
    const wings = g.getObjectByName('bird-wings'), o = transform || (transform = new T.Object3D());
    for (let i = 0; i < 5; i++) for (let side = 0; side < 2; side++) {
      const sign = side ? 1 : -1, x = (i % 3 - 1) * .62;
      o.position.set(x, (i % 2) * .18, Math.floor(i / 3) * .8 + Math.abs(x) * .4);
      o.rotation.set(0, side ? 0 : Math.PI, sign * Math.sin(t * 9 + i * .8) * .65); o.scale.set(1, 1, 1); o.updateMatrix();
      wings.setMatrixAt(i * 2 + side, o.matrix);
    }
    wings.instanceMatrix.needsUpdate = true;
  }
  g.children.forEach(o => {
    if (o.name === 'rotor') o.rotation.y = t * 24;
    if (o.name === 'debris') { o.rotation.x = t * .3; o.rotation.z = t * .22; }
  });
}
export function drawHazard(st, c, h, project, t) {
  const p = project(st, (h.lane - 1) * 3.083, h.y, h.z);
  if (h.z <= st.camZ + 1 || p.s < 1) return;
  c.save(); c.translate(p.x, p.y); c.scale(p.s, p.s);
  c.strokeStyle = '#FFB545'; c.lineWidth = .035; c.beginPath(); c.arc(0, 0, 1.2, 0, Math.PI * 2); c.stroke();
  if (h.kind === 'birds') {
    for (let i = 0; i < 5; i++) {
      const x = (i % 3 - 1) * .65, y = Math.floor(i / 3) * .4, flap = Math.sin(t * 9 + i) * .28;
      c.strokeStyle = '#23374B'; c.lineWidth = .12; c.beginPath(); c.moveTo(x - .5, y - flap); c.lineTo(x, y); c.lineTo(x + .5, y - flap); c.stroke();
      c.fillStyle = '#FFF1CC'; c.beginPath(); c.ellipse(x, y, .12, .22, 0, 0, Math.PI * 2); c.fill();
    }
  } else if (h.kind === 'balloon') {
    c.fillStyle = '#EE6943'; c.beginPath(); c.ellipse(0, -.2, .75, .95, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#F4C24C'; c.fillRect(-.2, -.9, .4, 1.4); c.fillRect(-.3, .95, .6, .35);
    c.strokeStyle = '#FFF1CC'; c.lineWidth = .03; [-.2, .2].forEach(x => { c.beginPath(); c.moveTo(x, .6); c.lineTo(x, 1); c.stroke(); });
  } else if (h.kind === 'drone') {
    c.fillStyle = '#ED6842'; c.fillRect(-.4, -.2, .8, .4); c.strokeStyle = '#23374B'; c.lineWidth = .12;
    c.beginPath(); c.moveTo(-.9, 0); c.lineTo(.9, 0); c.stroke();
    for (const x of [-.8, .8]) { c.fillStyle = '#FFEDCC'; c.beginPath(); c.ellipse(x, -.1, .4, .12, 0, 0, Math.PI * 2); c.fill(); }
  } else {
    for (let i = 0; i < 3; i++) { c.fillStyle = i % 2 ? '#DCAA53' : '#526577'; c.beginPath(); c.arc((i - 1) * .6, (i % 2) * .25, .45, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}
/** Foreshortened back view for devices without WebGL: head ahead, boots trailing, pack facing the camera. */
export function drawFlightRunner(st, c, x, y, z, spec, project, pack) {
  const p = project(st, x, y + .85, z);
  c.save(); c.translate(p.x, p.y); c.scale(p.s, p.s); c.rotate(-spec.roll);
  c.fillStyle = '#152D54'; c.strokeStyle = '#E8B68B'; c.lineWidth = .18; c.lineCap = 'round';
  for (const side of [-1, 1]) {
    c.beginPath(); c.moveTo(side * .28, -.12); c.lineTo(side * .42, -.63); c.stroke();
    c.fillRect(side * .19 - .09, .18, .18, .58); c.fillStyle = '#F3EAD4'; c.fillRect(side * .19 - .11, .65, .22, .2); c.fillStyle = '#152D54';
  }
  c.beginPath(); c.ellipse(0, -.03, .33, .43, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#E8B68B'; c.beginPath(); c.ellipse(0, -.52, .2, .18, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#202A37'; c.beginPath(); c.ellipse(0, -.58, .2, .13, 0, Math.PI, Math.PI * 2); c.fill();
  c.save(); c.translate(0, .03); c.scale(.8, .8); pack(c, spec.t); c.restore(); c.restore();
}
