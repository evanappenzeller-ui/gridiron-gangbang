import * as data from '../core/data.js';
import * as ui from '../core/ui.js';
import {profileKey} from '../core/realm-active.js';
const esc = data.esc;
export const TYPES = [['stats','Higher or Lower','Compare two historic NFL seasons.'],['timeline','Career Timeline','Put four career stops in order.'],['connections','Team Connections','Find two groups of three players.']];
// Fixed historical seasons and completed team tenures; never presented as current stats.
export const SETS = [
 {stats:['Passing touchdowns, 2013', 'Peyton Manning',55,'Drew Brees',39], timeline:['Peyton Manning',['Tennessee Volunteers','Indianapolis Colts','Denver Broncos','Retired (2016)']], groups:[['Drafted by the Steelers',['Ben Roethlisberger','Troy Polamalu','T.J. Watt']],['Drafted by the Ravens',['Ray Lewis','Ed Reed','Lamar Jackson']]]},
 {stats:['Rushing yards, 2012','Adrian Peterson',2097,'Marshawn Lynch',1590], timeline:['Brett Favre',['Atlanta Falcons','Green Bay Packers','New York Jets','Minnesota Vikings']], groups:[['Drafted by the Packers',['Aaron Rodgers','Jordy Nelson','Davante Adams']],['Drafted by the Lions',['Matthew Stafford','Calvin Johnson','Barry Sanders']]]},
 {stats:['Receiving yards, 2021','Cooper Kupp',1947,'Justin Jefferson',1616], timeline:['Randy Moss',['Minnesota Vikings (1998–2004)','Oakland Raiders','New England Patriots','Minnesota Vikings (2010)']], groups:[['Drafted by the Cowboys',['Troy Aikman','Emmitt Smith','Michael Irvin']],['Drafted by the Chiefs',['Patrick Mahomes','Travis Kelce','Tony Gonzalez']]]},
 {stats:['Passing yards, 2011','Drew Brees',5476,'Tom Brady',5235], timeline:['Drew Brees',['Purdue Boilermakers','San Diego Chargers','New Orleans Saints','Retired (2021)']], groups:[['Drafted by the Colts',['Peyton Manning','Reggie Wayne','Andrew Luck']],['Drafted by the Falcons',['Matt Ryan','Julio Jones','Michael Vick']]]}
];
const day = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const number = d => Math.floor(Date.parse(d+'T12:00:00Z')/86400000);
const key = d => `gg-daily-challenges-v1:${profileKey()}:${d}`;
function read(d) { try {const x=JSON.parse(localStorage.getItem(key(d))||'{}'); return x && typeof x==='object' && !Array.isArray(x)?x:{};} catch {return {};}}
export function challengesHTML() {
 if(!data.isOwner())return '';
 const saved=read(day());
 return `<section class="dc-hub" aria-label="Daily challenges"><div class="dc-heading"><span>TRY SOMETHING NEW</span><h2>Your daily challenges</h2><p>Three quick football puzzles. Progress saved on this device; separate from the league score.</p></div>${TYPES.map(([id,name,desc],i)=>`<button type="button" class="dc-entry" data-challenge="${id}"><span class="dc-number">0${i+1}</span><span><b>${name}</b><small>${desc}</small></span><span class="dc-state">${saved[id]?.done?'✓ Done':'Play →'}</span></button>`).join('')}</section>`;
}
export function openChallenge(id, after=()=>{}) {
 if(!data.isOwner()||!TYPES.some(t=>t[0]===id))return;
 const date=day(), profile=profileKey(), n=number(date), set=SETS[((n%SETS.length)+SETS.length)%SETS.length], title=TYPES.find(t=>t[0]===id)[1];
 let all=read(date), state=all[id]||{picks:[],found:[],attempts:0}, selected=[], stop=()=>{};
 // Stable shuffled positions, identical for the day and after reload.
 const order=id==='timeline'?[2,0,3,1]:[3,0,4,1,5,2];
 const valid=()=>data.isOwner()&&profileKey()===profile&&day()===date;
 const sh=ui.openSheet({title,body:'',detents:['large'],onClose:()=>stop()});
 sh.body.classList.add('dc-game');
 stop=data.subscribe(type=>{if(type==='me')sh.close();});
 function save(next){if(!valid()){sh.close();return false;} const current=read(date); try{localStorage.setItem(key(date),JSON.stringify({...current,[id]:next}));state=next;after();return true;}catch{ui.toast('Progress could not be saved. Please try again.');return false;}}
 function draw(message='') {
  if(!valid()){sh.close();return;}
  const focused=document.activeElement, focusKey=focused&&sh.body.contains(focused)?['data-answer','data-stop','data-player','data-check','data-undo'].find(k=>focused.hasAttribute(k)):null, focusValue=focusKey?focused.getAttribute(focusKey):'';
  let html='';
  if(id==='stats'){
   const q=set.stats, reverse=n%2===0, left=reverse?[q[3],q[4]]:[q[1],q[2]], right=reverse?[q[1],q[2]]:[q[3],q[4]];
   html=`<p class="dc-eyebrow">${esc(q[0])}</p><h2>Did ${esc(right[0])} finish higher or lower?</h2><div class="dc-stat"><span>${esc(left[0])}</span><strong>${left[1].toLocaleString()}</strong></div><p>Compare ${esc(right[0])}’s total with the number above.</p>${state.done?`<div class="dc-feedback">${state.correct?'Correct!':'Good try.'} ${esc(right[0])}: <b>${right[1].toLocaleString()}</b>. ${esc(left[0])}: ${left[1].toLocaleString()}.</div>`:'<div class="dc-options"><button data-answer="higher">Higher ↑</button><button data-answer="lower">Lower ↓</button></div>'}`;
  }else if(id==='timeline'){
   html=`<p class="dc-eyebrow">${esc(set.timeline[0])}</p><h2>Build his career in order.</h2><p>Tap the earliest stop first, then work forward. Tap Undo to change your last pick.</p><ol class="dc-order">${(state.picks||[]).map(i=>`<li>${esc(set.timeline[1][i])}</li>`).join('')}</ol><div class="dc-options">${order.map(i=>`<button data-stop="${i}" ${state.done||state.picks?.includes(i)?'disabled':''}>${esc(set.timeline[1][i])}</button>`).join('')}</div>${state.done?`<div class="dc-feedback">${state.correct?'Perfect order!':'Here’s the career order:'}<p>${set.timeline[1].map(esc).join(' → ')}</p></div>`:'<button class="dc-secondary" data-undo>Undo last pick</button>'}`;
  }else{
   const players=set.groups.flatMap(g=>g[1]), found=state.found||[];
   html=`<p class="dc-eyebrow">${found.length} OF 2 GROUPS FOUND</p><h2>Which players share a draft team?</h2><p>Find three players drafted by the same franchise. Select three, then check your group. Four tries.</p>${found.map(g=>`<div class="dc-feedback"><b>${esc(set.groups[g][0])}</b><p>${set.groups[g][1].map(esc).join(' · ')}</p></div>`).join('')}<div class="dc-options">${order.filter(i=>!found.includes(Math.floor(i/3))).map(i=>`<button data-player="${i}" aria-pressed="${selected.includes(i)}" ${state.done?'disabled':''}>${esc(players[i])}</button>`).join('')}</div>${state.done?`<div class="dc-feedback">${found.length===2?'Both connections found!':set.groups.filter((g,i)=>!found.includes(i)).map(g=>`${esc(g[0])}: ${g[1].map(esc).join(', ')}`).join('<br>')}</div>`:`<button class="dc-check" data-check ${selected.length!==3?'disabled':''}>Check group · ${4-(state.attempts||0)} tries left</button>`}`;
  }
  sh.body.innerHTML=html+`<p role="status" aria-live="polite">${esc(message)}</p><button class="dc-secondary" data-close>Back to daily puzzles</button>`;
  if(focusKey){const target=[...sh.body.querySelectorAll('button')].find(b=>b.getAttribute(focusKey)===focusValue&&!b.disabled)||sh.body.querySelector('[data-close]');target?.focus({preventScroll:true});}
 }
 sh.body.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-close')){sh.close();return;}if(!valid()){sh.close();return;}if(state.done||b.disabled)return;
  if(b.dataset.answer){const q=set.stats, higher=n%2===0?q[2]>q[4]:q[4]>q[2];save({...state,done:true,correct:(b.dataset.answer==='higher')===higher});}
  if(b.dataset.stop!==undefined){const picks=[...(state.picks||[]),Number(b.dataset.stop)];save({...state,picks,done:picks.length===4,correct:picks.every((v,i)=>v===i)});}
  if(b.hasAttribute('data-undo'))save({...state,picks:(state.picks||[]).slice(0,-1)});
  if(b.dataset.player!==undefined){const i=Number(b.dataset.player);selected=selected.includes(i)?selected.filter(x=>x!==i):selected.length<3?[...selected,i]:selected;}
  if(b.hasAttribute('data-check')){const g=Math.floor(selected[0]/3), correct=selected.length===3&&selected.every(i=>Math.floor(i/3)===g), found=correct?[...(state.found||[]),g]:state.found||[],attempts=(state.attempts||0)+1;if(save({...state,found,attempts,done:found.length===2||attempts>=4})){selected=[];draw(correct?'Connection found!':'Those players do not share a draft franchise. Try again.');return;}}
  draw();
 });draw();
}
