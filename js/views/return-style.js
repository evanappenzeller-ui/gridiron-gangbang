// Evan's Return Man art direction: clean, colorful, low-poly runner environments.
// These are procedural surfaces, not downloaded pictures. Never change legacy palettes in place.
import * as data from '../core/data.js';
import * as R from '../core/return.js';

export const enabled = () => data.isOwner();
export const key = () => enabled() ? 'arcade:' : '';
const LANES = [-R.LANE, 0, R.LANE];
const THEMES = {
  stadium: {base: '#329A55', road: '#42BC65', alt: '#39AE5B', edge: '#FFF4D8', sky: '#75CEEA', haze: '#BCE9E4', accent: '#FFCB39', far: '#459B9D'},
  tailgate: {base: '#798F9C', road: '#607C8D', alt: '#6F8997', edge: '#FFD151', sky: '#FFBC80', haze: '#FFE3B1', accent: '#EF6445', far: '#B48288'},
  city: {base: '#E7C39C', road: '#6C8C99', alt: '#7696A2', edge: '#FFF0CE', sky: '#80D1E8', haze: '#C4ECE6', accent: '#EE683C', far: '#70B4BD'},
  tundra: {base: '#EBF6F4', road: '#A9DAE7', alt: '#BFE8EE', edge: '#F9FFFF', sky: '#75BDDF', haze: '#D1EFF2', accent: '#FF9247', far: '#94C9DD'},
  desert: {base: '#F1C276', road: '#DEAA63', alt: '#E7B76D', edge: '#F9DF9E', sky: '#83CCE1', haze: '#F1DDB0', accent: '#DD5B36', far: '#D49460'},
  market: {base: '#EACD99', road: '#DDB578', alt: '#E9C58F', edge: '#FFF1C7', sky: '#81D2E4', haze: '#D5E9CE', accent: '#E96744', far: '#9DBDB1'},
  beach: {base: '#FFE1A0', road: '#DBAA6B', alt: '#E6B87B', edge: '#FFF1C7', sky: '#63D2EA', haze: '#C1EFE9', accent: '#F66F9B', far: '#41B9C6'},
  space: {base: '#8B6EB1', road: '#514D7B', alt: '#615B8E', edge: '#73F3EA', sky: '#30265F', haze: '#A384C9', accent: '#F39ED4', far: '#655099'},
  farm: {base: '#84C84D', road: '#DAB075', alt: '#E6C18D', edge: '#B7DE6C', sky: '#88D6E5', haze: '#D9EDBB', accent: '#ED6C43', far: '#6EAA67'}
};

// Hand-selected replacements keep dark windows, warm wood and hazard stripes recognizable.
const PAINT = {
  '#C8102E': '#F15D48', '#1D3F8F': '#368CCA', '#1E6FD9': '#309EC4', '#1E4FB8': '#369AC1',
  '#2E6B4F': '#45A568', '#5E2A84': '#916AC4', '#B98A2F': '#E9B83F', '#7B8794': '#91ACB6',
  '#2A2D33': '#344F59', '#1C2530': '#285460', '#16213A': '#285560', '#283448': '#285560',
  '#2E8B44': '#369B40', '#3FA455': '#65B947', '#2E5A45': '#33886D', '#3E8E4A': '#57A94F',
  '#3E8E3A': '#61B846', '#4FA34A': '#8ACC52', '#B2362A': '#E76342', '#5A3B2E': '#8C5742',
  '#C4573A': '#F0754D', '#B54A33': '#DA5D3F', '#3F7A4A': '#369B80', '#2F5E8E': '#3D91B1',
  '#F2C230': '#FFD14B', '#F2C94C': '#FFDA5D', '#F27BA8': '#F788B3', '#B78CFF': '#BE91DF',
  '#0E1B45': '#235675', '#1B2440': '#377593', '#2A3550': '#4692AD', '#3A4256': '#578594',
  '#F26C26': '#FF984F', '#B9784A': '#D5834E', '#6B4A33': '#976546', '#7A3E26': '#B96F43',
  '#2E9E4F': '#4BB57C', '#D8392B': '#F16D4B', '#2C6FD1': '#4AA5CF', '#F2A81D': '#FFC455'
};
export function paint(hex) { return PAINT[hex.toUpperCase()] || hex; }

export function ground(id, original) {
  if (!enabled()) return original;
  const p = THEMES[id];
  return {...original, w: id === 'stadium' ? 2048 : 1024, base: p.base,
    draw(g, w, h) {
      const px = w / (original.half * 2), pz = h / original.per;
      const rect = (color, x, z, width, length) => { g.fillStyle = color; g.fillRect((x + original.half) * px, z * pz, width * px, length * pz); };
      rect(p.base, -original.half, 0, original.half * 2, original.per);
      const half = id === 'stadium' ? 26.67 : id === 'city' ? 5.6 : 5.4;
      rect(p.road, -half, 0, half * 2, original.per);
      if (id === 'stadium') {
        rect(p.alt, -half, 5, half * 2, 5);
        [-half, half - .18].forEach(x => rect(p.edge, x, 0, .18, 10));
        [0, 5].forEach(z => rect(p.edge, -half, z, half * 2, .12));
        for (let z = 0; z < 10; z++) [-26.47, 25.87, -3.4, 2.8].forEach(x => rect(p.edge, x, z, .6, .1));
      } else if (id === 'desert') {
        LANES.forEach(x => {
          rect(p.alt, x - 1.43, 0, 2.86, original.per);
          for (let z = 0; z < original.per; z += 1.1) rect('#AF7B49', x - 1.25, z, 2.5, .32);
        });
      } else if (id === 'beach') {
        rect(p.alt, -half, 0, half * 2, original.per / 2);
        [0, .55].forEach(z => rect('#B98654', -half, z, half * 2, .045));
        [-R.LANE / 2, R.LANE / 2].forEach(x => rect('#F2CF93', x - .045, 0, .09, original.per));
      } else if (id === 'market') {
        for (let row = 0; row < 2; row++) for (let x = -half; x < half + (row ? .9 : 0); x += 1.8) {
          const left = Math.max(-half, x + (row ? -.9 : 0)), right = Math.min(half, x + 1.8 + (row ? -.9 : 0));
          if (right - left > .07) rect(p.alt, left + .035, row * .9 + .025, right - left - .07, .85);
        }
        [-R.LANE / 2, R.LANE / 2].forEach(x => rect(p.edge, x - .07, 0, .14, original.per));
      } else if (id === 'tundra' || id === 'farm') {
        LANES.forEach(x => {
          rect(p.alt, x - 1.12, 0, 2.24, original.per);
          [-.8, .8].forEach(dx => rect(id === 'farm' ? '#CAA06C' : '#98CADB', x + dx - .06, 0, .12, original.per));
        });
      } else {
        [-R.LANE / 2, R.LANE / 2].forEach(x => {
          for (let z = 0; z < original.per; z += 4) rect(id === 'space' ? '#BFEBEB' : '#FFF6DC', x - .085, z, .17, 2);
        });
        if (id === 'tailgate') for (let z = 0; z < original.per; z += 3.2) {
          rect('#C8DBD5', -11.8, z, 6, .1); rect('#C8DBD5', 5.8, z, 6, .1);
        }
        if (id === 'city') for (let z = 0; z < original.per; z += 2) {
          rect('#D9B28B', -10, z, 4.1, .04); rect('#D9B28B', 5.9, z, 4.1, .04);
        }
      }
      if (id !== 'stadium') [-half - .22, half].forEach(x => rect(p.edge, x, 0, .22, original.per));
    }};
}

export function light(id, original) {
  if (!enabled()) return original;
  return {...original, sky: id === 'space' ? '#D3C0FF' : '#E2F9FF', ground: THEMES[id].base,
    hemi: 1.6, sun: id === 'space' ? '#CEEFFF' : '#FFF1D8', sunI: 1.8};
}
export const haze = id => THEMES[id].haze;
export function gate(id, original) {
  return enabled() ? ['#F9E8C5', THEMES[id].accent, '#FFE3A1', '#FFFFFF'] : original;
}

// Sky paintings have their own bounded cache, never reused by the original renderer.
const SKIES = new Map();
export function clear() { SKIES.clear(); }
function skyImage(id, width, height) {
  const k = id + ':' + width + ':' + height;
  if (SKIES.has(k)) return SKIES.get(k);
  const cv = document.createElement('canvas'); cv.width = width; cv.height = height;
  const c = cv.getContext('2d'), p = THEMES[id], w = width, h = height;
  const gradient = c.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, p.sky); gradient.addColorStop(1, p.haze); c.fillStyle = gradient; c.fillRect(0, 0, w, h);
  const poly = (color, points) => { c.fillStyle = color; c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x*w,y*h) : c.moveTo(x*w,y*h)); c.closePath(); c.fill(); };
  const disk = (color, x, y, r) => { c.fillStyle = color; c.beginPath(); c.arc(x*w, y*h, r*h, 0, Math.PI*2); c.fill(); };
  if (id === 'space') {
    for (let i = 0; i < 56; i++) { const x = ((i * 137.51) % 997) / 997, y = ((i * 83.3) % 701) / 1000; disk(i % 3 ? '#F4D8F5' : '#88EBF3', x, y, i % 7 ? .002 : .004); }
    disk('#E5B3D1', .76, .29, .17); disk('#CF95C4', .79, .3, .13);
    c.strokeStyle = '#EFCD9D'; c.lineWidth = h * .017; c.beginPath(); c.ellipse(w*.76, h*.29, h*.29, h*.045, -.3, 0, Math.PI*2); c.stroke();
  } else {
    disk('#FFF1BF', .78, .23, .075);
    // Broad cloud clusters, readable shapes rather than noisy cloud photographs.
    [[.13,.3,.8],[.56,.19,.6],[.89,.44,.55]].forEach(([x,y,s]) => {
      c.fillStyle = '#E8FAF2'; c.beginPath(); c.ellipse(w*x,h*y,h*.19*s,h*.045*s,0,0,Math.PI*2); c.fill();
      disk('#E8FAF2',x-.025,y-.02,.063*s); disk('#E8FAF2',x+.02,y-.035,.079*s);
    });
  }
  if (id === 'desert') {
    poly('#DFA976', [[0,1],[0,.67],[.08,.67],[.12,.43],[.22,.43],[.27,.76],[.41,.76],[.44,1]]);
    poly('#D09360', [[.6,1],[.65,.75],[.73,.75],[.77,.5],[.88,.5],[.91,.71],[1,.71],[1,1]]);
    poly('#F2C68D', [[.12,.43],[.22,.43],[.24,.55],[.1,.55]]);
  } else if (id === 'tundra') {
    poly('#8FC2D7', [[0,1],[0,.72],[.13,.29],[.27,.7],[.39,.43],[.53,.85],[.71,.37],[.85,.67],[.94,.4],[1,.63],[1,1]]);
    poly('#F4FFFF', [[.067,.5],[.13,.29],[.2,.52],[.15,.47],[.12,.51],[.095,.47]]);
    poly('#E7F9F8', [[.65,.55],[.71,.37],[.78,.55],[.72,.49],[.69,.54]]);
  } else {
    poly(p.far, [[0,1],[0,.72],[.08,.66],[.16,.79],[.28,.63],[.39,.8],[.49,.77],[.6,.89],[.72,.65],[.84,.71],[.94,.6],[1,.76],[1,1]]);
  }
  if (id === 'city' || id === 'market' || id === 'tailgate' || id === 'stadium') {
    const colors = id === 'city' ? ['#8AC0BF','#9CCDC2','#79B5B5'] : ['#A4C8B6','#B6D5BF','#92BBAE'];
    for (let i = 0; i < 14; i++) {
      const x = i / 14, top = .74 + ((i*7)%5)*.028;
      poly(colors[i%3], [[x,1],[x,top],[x+.064,top],[x+.064,1]]);
      if (id === 'market') poly('#CD9B7F', [[x-.008,top],[x+.032,top-.08],[x+.074,top]]);
    }
  }
  if (id === 'beach') { c.fillStyle = '#71CED6'; c.fillRect(0,h*.91,w,h*.09); }
  // The lower edge exactly matches world fog, including when the curved road exposes it.
  const mist = c.createLinearGradient(0,h*.83,0,h); mist.addColorStop(0,p.haze+'00'); mist.addColorStop(1,p.haze);
  c.fillStyle=mist; c.fillRect(0,h*.83,w,h*.17);
  if (SKIES.size >= 12) SKIES.clear(); SKIES.set(k,cv); return cv;
}
export function sky(st, c, t, z) {
  if (!enabled()) return false;
  const zone = R.zoneAt(st.co,z), next = R.zoneAt(st.co,zone.z0+R.ZONE), k = Math.max(0,Math.min(1,(z-zone.z0-R.ZONE+28)/28));
  const w = Math.min(1536,Math.ceil(st.W)), h = Math.max(1,Math.ceil(st.y0+2));
  const draw = (id,alpha) => {
    const cv = skyImage(id,w,h); c.globalAlpha=alpha; c.drawImage(cv,0,0,st.W,st.y0+2);
    if (st.bend) c.drawImage(cv,0,h-1,w,1,0,st.y0+1,st.W,Math.max(0,st.H-st.y0-1));
  };
  c.save(); draw(zone.theme.id,1); if (k>0) draw(next.theme.id,k); c.restore();
  return true;
}
