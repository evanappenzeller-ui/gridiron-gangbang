// Small, reusable jersey decals. No network assets and no texture per chosen number.
const hex = c => '#' + Number(c).toString(16).padStart(6, '0');
const label = k => k.wordmark || ({home: 'RETURN MAN', outlaw: 'OUTLAW', neon: 'NEON RUSH', arctic: 'ARCTIC', beach: 'BEACH BREAK', cosmic: 'COSMIC', ember: 'END ZONE'}[k.pattern] || 'RETURN MAN');

function motif(g, k, x, y, size) {
  g.save(); g.translate(x, y); g.scale(size, size);
  g.fillStyle = hex(k.edge); g.strokeStyle = hex(k.stripe); g.lineWidth = .055; g.lineJoin = 'round';
  const poly = points => { g.beginPath(); points.forEach(([a,b],i) => i ? g.lineTo(a,b) : g.moveTo(a,b)); g.closePath(); g.fill(); };
  if (k.pattern === 'arctic') {
    for (let i=0;i<3;i++) {g.rotate(Math.PI/3);g.beginPath();g.moveTo(-.44,0);g.lineTo(.44,0);g.moveTo(.2,-.15);g.lineTo(.32,0);g.lineTo(.2,.15);g.moveTo(-.2,-.15);g.lineTo(-.32,0);g.lineTo(-.2,.15);g.stroke();}
  } else if (k.pattern === 'beach') {
    for (const yy of [-.12,.12]) {g.beginPath();g.moveTo(-.45,yy);g.bezierCurveTo(-.16,yy-.38,.12,yy+.38,.45,yy);g.stroke();}
  } else if (k.pattern === 'outlaw') {
    poly([[0,-.5],[.35,0],[0,.5],[-.35,0]]);
    g.beginPath();g.moveTo(-.48,0);g.lineTo(.48,0);g.stroke();
  } else if (k.pattern === 'ember') {
    poly([[0,-.5],[.12,-.12],[.3,-.3],[.38,.15],[.2,.45],[-.2,.45],[-.4,.1],[-.15,-.25],[-.12,.12]]);
  } else if (k.pattern === 'neon') {
    poly([[.1,-.5],[-.34,.08],[-.03,.08],[-.18,.5],[.38,-.12],[.03,-.12]]);
  } else {
    const points = Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,r=i%2?.21:.48;return [Math.cos(a)*r,Math.sin(a)*r];});
    poly(points);
    if(k.pattern==='cosmic'){g.beginPath();g.ellipse(0,0,.61,.22,-.5,0,Math.PI*2);g.stroke();}
  }
  g.restore();
}

/** Paint into an existing canvas so changing a jersey number only uploads its pixels. */
export function paintJersey(canvas, k, side = 'front') {
  const g=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
  g.clearRect(0,0,w,h);
  g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
  // The thin stitch lines and shoulder badge give each palette a visible uniform design.
  g.strokeStyle=hex(k.stripe);g.lineWidth=Math.max(1,w*.006);g.globalAlpha=.8;
  g.setLineDash([w*.016,w*.016]);
  for(const x of [w*.045,w*.955]){g.beginPath();g.moveTo(x,h*.2);g.lineTo(x,h*.92);g.stroke();}
  g.setLineDash([]);g.globalAlpha=1;
  motif(g,k,w*.1,h*.2,w*.12);
  motif(g,k,w*.9,h*.2,w*.12);
  g.font=`800 ${Math.round(h*.11)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  g.lineWidth=Math.max(1,h*.012);g.strokeStyle=hex(k.numEdge);g.fillStyle=hex(k.numFill);
  const text=label(k).toUpperCase(), max=w*.8;
  g.strokeText(text,w/2,h*.14,max);g.fillText(text,w/2,h*.14,max);
  const s=String(k.num), font=Math.round(h*.77);
  g.font=`800 ${font}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const y=h*.61;
  g.lineWidth=h*.062;g.strokeText(s,w/2,y,w*.75);g.fillText(s,w/2,y,w*.75);
  // A fine inner thread is visible in the large preview without muddying the running number.
  g.strokeStyle=hex(k.jersey);g.globalAlpha=.32;g.lineWidth=Math.max(1,h*.005);g.strokeText(s,w/2,y,w*.75);g.globalAlpha=1;
  g.fillStyle=hex(k.edge);g.fillRect(w*.28,h*.94,w*.44,h*.016);
  if(side==='back'){g.fillStyle=hex(k.stripe);g.fillRect(w*.36,h*.975,w*.28,h*.009);}
}

export function paintHelmetBadge(canvas, k) {
  const g=canvas.getContext('2d'), w=canvas.width,h=canvas.height;
  g.clearRect(0,0,w,h);g.fillStyle=hex(k.stripe);g.beginPath();g.ellipse(w/2,h/2,w*.46,h*.43,0,0,Math.PI*2);g.fill();
  g.strokeStyle=hex(k.edge);g.lineWidth=w*.055;g.stroke();
  if(k.team){g.fillStyle=hex(k.helmet);g.font=`900 ${h*.43}px "Barlow Condensed",sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(k.team,w/2,h*.52,w*.75);}
  else motif(g,{...k,stripe:k.helmet,edge:k.helmet},w/2,h/2,w*.63);
}
