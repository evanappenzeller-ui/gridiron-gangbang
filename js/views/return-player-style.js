// Evan's reviewed navy 22 kit. The caller owns the profile gate and lifetime.
// Call immediately after dress(), while the skeleton is still in its bind pose.
// U is three.js BufferGeometryUtils, loaded alongside this owner-only module.
import {bulkUp} from './return-player-bulk.js';
export function restyleFootball(P, T, U) {
  if (typeof U?.mergeGeometries !== 'function') throw new Error('Player style needs BufferGeometryUtils');
  const C = {navy: 0x173b6c, deep: 0x102744, cream: 0xf0f2e8, pants: 0xdce2dc,
    orange: 0xe89c43, metal: 0xc4d1d8, leather: 0x884520};
  const materials = new Set(), geometries = new Set(), textures = new Set(), meshes = new Set(), added = [], restore = [];
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (let i=restore.length-1;i>=0;i--) restore[i]();
    added.forEach(o=>o.removeFromParent());
    geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); textures.forEach(t=>t.dispose());
    restore.length=0; added.length=0;
    geometries.clear(); materials.clear(); textures.clear(); meshes.clear();
  }
  const material = (color, extra = {}) => {
    const m = new T.MeshStandardMaterial({color, roughness: .72, metalness: 0, ...extra});
    materials.add(m); return m;
  };
  try {
  const navy = material(C.navy), cream = material(C.cream), orange = material(C.orange);
  const shellMat = material(C.navy, {roughness: .28, metalness: .12});
  const trimMat = material(C.deep, {roughness: .55});
  const cageMat = material(C.metal, {roughness: .32, metalness: .45});
  const mesh = (g, m, name = '') => {
    geometries.add(g); const o = new T.Mesh(g, m); o.name = name; meshes.add(o);
    o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; return o;
  };
  const v = (x,y,z) => new T.Vector3(x,y,z);
  // His fuller, defined build (Evan, Oct 21 2026): sculpted in the bind pose, before anything is hung on him.
  restore.push(bulkUp(P, T));
  P.model.updateWorldMatrix(true, true);
  const modelInverse = P.model.matrixWorld.clone().invert();
  const at = name => P.B[name].getWorldPosition(new T.Vector3()).applyMatrix4(modelInverse);
  function hang(bone, object, position, rotation = new T.Quaternion()) {
    bone.updateWorldMatrix(true, false);
    const desired = new T.Matrix4().compose(position, rotation, object.scale);
    desired.premultiply(P.model.matrixWorld).premultiply(bone.matrixWorld.clone().invert());
    desired.decompose(object.position, object.quaternion, object.scale);
    bone.add(object); added.push(object); return object;
  }
  function tube(points, radius, mat, closed = false) {
    const curve = new T.CatmullRomCurve3(points.map(p => Array.isArray(p) ? v(...p) : p), closed, 'centripetal');
    return mesh(new T.TubeGeometry(curve, Math.max(16, points.length * 5), radius, 6, closed), mat);
  }
  function ellipsoid(parent, position, scale, mat, name) {
    const o = mesh(new T.SphereGeometry(1, 24, 16), mat, name);
    o.position.copy(position); o.scale.copy(scale); parent.add(o); return o;
  }
  // Bake only static pieces within one attachment. The group still follows its bone,
  // and the ball keeps its own visibility/attachment. Untextured pieces need only
  // position/normal attributes; retaining their transformed normals preserves shading.
  function batchAttachment(root) {
    if (!root || root.isMesh) return;
    const groups = new Map();
    root.updateMatrixWorld(true);
    root.traverse(o=>{
      if (!meshes.has(o) || o.material.transparent) return;
      const key=o.material.uuid+'|'+o.castShadow+'|'+o.receiveShadow+'|'+o.renderOrder;
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(o);
    });
    for (const pieces of groups.values()) {
      if (pieces.length<2) continue;
      const copies=[];
      let merged=null;
      try {
        for (const piece of pieces) {
          piece.updateMatrix();
          const matrix=piece.matrix.clone();
          for(let parent=piece.parent;parent && parent!==root;parent=parent.parent) {
            parent.updateMatrix(); matrix.premultiply(parent.matrix);
          }
          const geometry=piece.geometry.clone(); copies.push(geometry);
          for (const attribute of Object.keys(geometry.attributes)) {
            if (attribute!=='position' && attribute!=='normal') geometry.deleteAttribute(attribute);
          }
          if (!geometry.index) geometry.setIndex(Array.from({length:geometry.getAttribute('position').count},(_,i)=>i));
          geometry.applyMatrix4(matrix);
          copies[copies.length-1]=geometry;
        }
        merged=U.mergeGeometries(copies,false);
      } finally {
        copies.forEach(g=>g.dispose());
      }
      if (!merged) throw new Error('Could not batch player kit geometry');
      const first=pieces[0],combined=mesh(merged,first.material,(root.name||'football')+'-batch');
      combined.castShadow=first.castShadow; combined.receiveShadow=first.receiveShadow;
      combined.renderOrder=first.renderOrder;
      root.add(combined);
      for (const piece of pieces) {
        piece.removeFromParent(); meshes.delete(piece);
        piece.geometry.dispose(); geometries.delete(piece.geometry);
      }
    }
  }
  function flatJersey(old) {
    const canvas = document.createElement('canvas');
    canvas.width = old.map?.image?.width || 1024; canvas.height = old.map?.image?.height || 1024;
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#173b6c'; ctx.fillRect(0, 0, W, H);
    // The two UV islands used by the existing skinned jersey, without old names or logos.
    for (const n of [{x:.5786,y:.4697,h:.213},{x:.856,y:.49,h:.244}]) {
      const height = n.h * H;
      ctx.save(); ctx.translate(n.x * W, n.y * H); ctx.scale(1,-1);
      ctx.font = `800 ${Math.round(height/.7)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      const measure = ctx.measureText('22'), y = (measure.actualBoundingBoxAscent-measure.actualBoundingBoxDescent)/2;
      ctx.lineWidth = height * .08; ctx.strokeStyle = '#102744'; ctx.strokeText('22',0,y);
      ctx.fillStyle = '#f0f2e8'; ctx.fillText('22',0,y); ctx.restore();
    }
    const texture = new T.CanvasTexture(canvas);
    texture.flipY = old.map?.flipY ?? false; texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4; texture.channel = old.map?.channel || 0;
    textures.add(texture);
    return material(0xffffff, {map:texture, roughness:.88});
  }
  const jerseys = new Map(), clones = new Map();
  // Simplify surface noise while retaining the athlete's original deformation and anatomy.
  P.model.traverse(o => {
    if (!o.isMesh) return;
    const old = o.material;
    if (!old || Array.isArray(old)) return;
    let next;
    if (old.name === 'shirt_0') {
      if (!jerseys.has(old)) jerseys.set(old,flatJersey(old));
      next = jerseys.get(old);
    } else if (old.name === 'pants') next = material(C.pants,{roughness:.93});
    else if (old.name === 'sepatu_key.obj') next = material(C.deep,{roughness:.58});
    else if (['Fabric-Linen','Fabric-Silk','Default'].includes(old.name)) next = material(C.cream,{roughness:.9});
    else if (old.name === 'Bodymat') {
      if (!clones.has(old)) {
        const m = old.clone(); m.normalMap = null; m.roughnessMap = null; m.metalnessMap = null;
        m.roughness = .92; m.metalness = 0; materials.add(m); clones.set(old,m);
      }
      next = clones.get(old);
    }
    if (next) {restore.push(()=>{o.material=old;});o.material=next;}
  });
  const oldHelmet = P.model.getObjectByName('helmet');
  if (oldHelmet) {const visible=oldHelmet.visible;oldHelmet.visible=false;restore.push(()=>{oldHelmet.visible=visible;});}

  // A shaped helmet shell with a true face opening, deeper side coverage and a rear rim.
  const helmet = new T.Group(); helmet.name = 'arcade-helmet';
  const rx=.137, ry=.143, rz=.157, rows=20, columns=48;
  const vertices=[], uv=[], indices=[];
  const edge = phi => 2.35 - .9 * Math.pow(Math.max(0,Math.cos(phi)),4);
  for(let row=0;row<=rows;row++) for(let col=0;col<=columns;col++) {
    const phi=col/columns*Math.PI*2,theta=row/rows*edge(phi);
    vertices.push(rx*Math.sin(theta)*Math.sin(phi),ry*Math.cos(theta),rz*Math.sin(theta)*Math.cos(phi));
    uv.push(col/columns,row/rows);
    if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
  const shell = new T.BufferGeometry();
  shell.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  shell.setAttribute('uv',new T.Float32BufferAttribute(uv,2));shell.setIndex(indices);shell.computeVertexNormals();
  helmet.add(mesh(shell,shellMat,'clean-helmet-shell'));
  const rim=[];
  for(let i=0;i<48;i++){const phi=i/48*Math.PI*2,theta=edge(phi);rim.push(v(rx*Math.sin(theta)*Math.sin(phi),ry*Math.cos(theta),rz*Math.sin(theta)*Math.cos(phi)));}
  helmet.add(tube(rim,.0055,trimMat,true));
  // A restrained ivory center stripe and fine amber border follow the dome.
  function stripe(x0,x1,mat) {
    const positions=[],ix=[];
    for(let i=0;i<=40;i++)for(const x of [x0,x1]){
      const theta=-1.90+i/40*3.34,ring=Math.sqrt(1-x*x/(rx*rx));
      positions.push(x,(ry+.0015)*Math.cos(theta)*ring,(rz+.0015)*Math.sin(theta)*ring);
      if(i<40&&x===x0){const k=i*2;ix.push(k,k+2,k+1,k+1,k+2,k+3);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(ix);g.computeVertexNormals();
    helmet.add(mesh(g,mat));
  }
  stripe(-.012,.012,cream);stripe(.016,.020,orange);stripe(-.020,-.016,orange);
  // A shallow smoked eye shield sits behind the cage, leaving the lower face open.
  const visorVertices=[],visorIndices=[];
  for(let row=0;row<=1;row++)for(let col=0;col<=24;col++) {
    const x=-.106+col/24*.212,edgeLift=Math.pow(x/.106,2)*.006;
    visorVertices.push(x,(row ? -.068 : -.015)+edgeLift,.166*Math.sqrt(1-x*x/(.138*.138)));
    if(row===0&&col<24){const a=col,b=a+25;visorIndices.push(a,b,a+1,b,b+1,a+1);}
  }
  const visorGeometry=new T.BufferGeometry();
  visorGeometry.setAttribute('position',new T.Float32BufferAttribute(visorVertices,3));
  visorGeometry.setIndex(visorIndices);visorGeometry.computeVertexNormals();
  helmet.add(mesh(visorGeometry,material(0x0b2130,{roughness:.17,metalness:.32,
    transparent:true,opacity:.94,depthWrite:false,side:T.DoubleSide}),'smoked-eye-shield'));
  // Open cage: thin bars remain readable without turning the face into a solid block.
  for(const [y,z] of [[-.025,.177],[-.080,.186],[-.119,.153]]) {
    helmet.add(tube([[-.119,y+.008,.080],[-.105,y,.145],[0,y,z],[.105,y,.145],[.119,y+.008,.080]],.0055,cageMat));
  }
  for(const side of [-1,1]) {
    helmet.add(tube([[side*.11,-.008,.10],[side*.115,-.043,.15],[side*.09,-.105,.168],[side*.07,-.126,.14]],.005,cageMat));
    helmet.add(tube([[side*.118,-.067,.03],[side*.10,-.12,.10],[side*.025,-.143,.124]],.007,cream));
    ellipsoid(helmet,v(side*.127,-.015,.014),v(.011,.019,.025),cream,'helmet-ear-fastener');
    ellipsoid(helmet,v(side*.133,-.015,.014),v(.003,.008,.010),trimMat);
  }
  ellipsoid(helmet,v(0,-.142,.125),v(.032,.017,.023),cream,'chin-cup');
  hang(P.B.Head,helmet,at('Head').add(v(0,.126,.047)));

  // Rounded shoulder pads strengthen the football silhouette without robot-like joints.
  for(const [side,name] of [[1,'Left'],[-1,'Right']]) {
    const pad = new T.Group(); pad.name = 'arcade-shoulder-'+name;
    ellipsoid(pad,v(0,0,0),v(.095,.055,.105),navy,'rounded-jersey-shoulder');
    // Two slim stripes curve over each pad rather than floating as flat labels.
    for(const [z,color,width] of [[.035,cream,.007],[.051,orange,.0035]]) {
      const points=[];
      for(let i=0;i<=12;i++) {const a=-1.1+i/12*2.2;points.push(v(Math.sin(a)*.096,Math.cos(a)*.057,z));}
      pad.add(tube(points,width,color));
    }
    // Pads sit on the shoulder girdle; a pumping upper arm must not rotate them.
    hang(P.B[name+'Shoulder'],pad,at(name+'Arm').add(v(side*.008,.003,.003)));
    // The muted pants keep the original sculpted knees; a navy outer seam adds kit identity.
    const line=mesh(new T.CylinderGeometry(.010,.010,.26,8),navy,'pants-stripe-'+name);
    hang(P.B[name+'UpLeg'],line,at(name+'UpLeg').add(v(side*.062,-.13,.010)));
    const boot = new T.Group();boot.name='cleat-details-'+name;
    for(const z of [.045,.062,.079]) {
      const lace=mesh(new T.BoxGeometry(.048,.005,.006),cream);lace.position.set(0,-.048,z);boot.add(lace);
    }
    hang(P.B[name+'Foot'],boot,at(name+'Foot'));
  }

  // Keep the exact existing ball attachment/pose, replacing only its visible pieces.
  if(P.ball) {
    const original=[...P.ball.children];original.forEach(o=>P.ball.remove(o));
    restore.push(()=>{for(const o of [...P.ball.children])P.ball.remove(o);original.forEach(o=>P.ball.add(o));});
    ellipsoid(P.ball,v(0,0,0),v(.145,.084,.085),material(C.leather,{roughness:.82}),'arcade-football');
    const stitch=material(C.cream,{roughness:.9});
    const seam=mesh(new T.BoxGeometry(.112,.005,.005),stitch);seam.position.z=.085;P.ball.add(seam);
    for(let i=-3;i<=3;i++){
      const lace=mesh(new T.BoxGeometry(.006,.026,.006),stitch);lace.position.set(i*.014,0,.087);P.ball.add(lace);
    }
    for(const side of [-1,1]){
      const ring=mesh(new T.TorusGeometry(.069,.0055,6,24),stitch);ring.rotation.y=Math.PI/2;ring.position.x=side*.088;P.ball.add(ring);
    }
  }
  const unbatchedMeshCount=meshes.size;
  added.forEach(batchAttachment); batchAttachment(P.ball);
  P.model.updateWorldMatrix(true,true);
  return {name:'Navy 22 — arcade athlete',materials:materials.size,addedObjects:added.length,
    unbatchedMeshCount,addedMeshCount:meshes.size,dispose};
  } catch (error) {
    dispose();
    throw error;
  }
}
