import {NUMBER_QUESTIONS, numberPoints, dialHTML, guessAt} from './number-trivia.js';
import * as daily from '../core/daily.js';
import * as data from '../core/data.js';
import * as ui from '../core/ui.js';
import {profileKey} from '../core/realm-active.js';
const esc = data.esc;
export const TYPES = [['stats','Higher or Lower','Compare two historic NFL seasons.'],['connections','Team Connections','Find two groups of three players.'],['numbers','Number Trivia','Dial in your answer. Closer earns more points.']];
// Fixed historical seasons and completed team tenures; never presented as current stats.
export const SETS = [
 {stats:['Passing touchdowns, 2013', 'Peyton Manning',55,'Drew Brees',39], groups:[['Drafted by the Steelers',['Ben Roethlisberger','Troy Polamalu','T.J. Watt']],['Drafted by the Ravens',['Ray Lewis','Ed Reed','Lamar Jackson']]]},
 {stats:['Rushing yards, 2012','Adrian Peterson',2097,'Marshawn Lynch',1590], groups:[['Drafted by the Packers',['Aaron Rodgers','Jordy Nelson','Davante Adams']],['Drafted by the Lions',['Matthew Stafford','Calvin Johnson','Barry Sanders']]]},
 {stats:['Receiving yards, 2021','Cooper Kupp',1947,'Justin Jefferson',1616], groups:[['Drafted by the Cowboys',['Troy Aikman','Emmitt Smith','Michael Irvin']],['Drafted by the Chiefs',['Patrick Mahomes','Travis Kelce','Tony Gonzalez']]]},
 {stats:['Passing yards, 2011','Drew Brees',5476,'Tom Brady',5235], groups:[['Drafted by the Colts',['Peyton Manning','Reggie Wayne','Andrew Luck']],['Drafted by the Falcons',['Matt Ryan','Julio Jones','Michael Vick']]]}
];
const day = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const number = d => Math.floor(Date.parse(d+'T12:00:00Z')/86400000);
const key = d => `gg-daily-challenges-v1:${profileKey()}:${d}`;
function read(d) { if(daily.TEST)return daily.DS; try {const x=JSON.parse(localStorage.getItem(key(d))||'{}'); return x && typeof x==='object' && !Array.isArray(x)?x:{};} catch {return {};}}
export function challengesHTML() {
 if(!data.isOwner()||(!daily.TEST&&daily.dayVersion()===5))return '';
 const saved=read(day());
 return `<section class="dc-hub" aria-label="Daily challenges"><div class="dc-heading"><span>TRY SOMETHING NEW</span><h2>${daily.TEST?'New game samples':'Your daily challenges'}</h2><p>${daily.TEST?'Test play: explore all three new modes. Replay or load another sample inside each game.':'Three quick football puzzles. Progress saved on this device; separate from the league score.'}</p></div>${TYPES.map(([id,name,desc],i)=>`<button type="button" class="dc-entry" data-challenge="${id}"><span class="dc-number">0${i+1}</span><span><b>${name}</b><small>${desc}</small></span><span class="dc-state">${daily.TEST?'Play sample →':saved[id]?.done?'✓ Done':'Play →'}</span></button>`).join('')}</section>`;
}
export function openChallenge(id, after=()=>{}, inline=null) {
 const live=!!inline&&!daily.TEST&&daily.dayVersion()===5&&daily.hasStep(id);
 if((!live&&!data.isOwner())||!TYPES.some(t=>t[0]===id))return;
 const testing=daily.TEST, run=daily.TEST_RUN;
 const date=day(), profile=profileKey(), title=TYPES.find(t=>t[0]===id)[1];
 let n=(testing||live)?daily.DAY.challengeSeed:number(date), set=SETS[((n%SETS.length)+SETS.length)%SETS.length];
 let all=live?daily.DS:read(date), state=((!testing||inline)&&all[id])||{picks:[],found:[],attempts:0}, selected=[], stop=()=>{};
 // Stable shuffled positions, identical for the day and after reload.
 const order=[3,0,4,1,5,2];
 const valid=()=>(live?daily.dayVersion()===5&&daily.hasStep(id):data.isOwner())&&profileKey()===profile&&day()===date&&daily.TEST===testing&&daily.TEST_RUN===run;
 const sh=inline?{body:inline,close:()=>stop()}:ui.openSheet({title,body:'',detents:['large'],onClose:()=>stop()});
 sh.body.classList.add('dc-game');
 const stopProfile=data.subscribe(type=>{if(type==='me')sh.close();});
 const stopDaily=daily.subscribe(()=>{if(!valid())sh.close();});
 stop=()=>{stopProfile();stopDaily();};
 function save(next){if(!valid()){sh.close();return false;} const current=read(date); try{if(testing||live){if(!daily.saveChallengeState(id,next))return false;}else localStorage.setItem(key(date),JSON.stringify({...current,[id]:next}));state=next;after();return true;}catch{ui.toast('Progress could not be saved. Please try again.');return false;}}
 function draw(message='') {
  if(!valid()){sh.close();return;}
  const focused=document.activeElement, focusKey=focused&&sh.body.contains(focused)?['data-number-dial','data-answer','data-stop','data-player','data-check','data-undo'].find(k=>focused.hasAttribute(k)):null, focusValue=focusKey?focused.getAttribute(focusKey):'';
  let html='';
  if(id==='numbers'){
   const q=NUMBER_QUESTIONS[n%NUMBER_QUESTIONS.length],guess=state.guess??Math.round((q.min+q.max)/2);
   html=`<p class="dc-eyebrow">NUMBER TRIVIA · UP TO 200 POINTS</p><h2>${esc(q.question)}</h2><p>Tap or drag around the dial. The closer you get, the more points you earn.</p>${dialHTML(q,guess,!!state.done)}${state.done?`<div class="dc-feedback" role="status"><b>${state.points} / 200 points</b><p>Your guess: ${guess.toLocaleString()} · Answer: ${q.answer.toLocaleString()} ${q.unit}</p><p>${Math.abs(guess-q.answer).toLocaleString()} away${guess===q.answer?' — exact answer!':'.'}</p></div>`:'<button class="dc-check" data-number-submit>Lock in guess</button>'}`;
  }else if(id==='stats'){
   const q=set.stats, reverse=n%2===0, left=reverse?[q[3],q[4]]:[q[1],q[2]], right=reverse?[q[1],q[2]]:[q[3],q[4]];
   html=`<p class="dc-eyebrow">${esc(q[0])}</p><h2>Did ${esc(right[0])} finish higher or lower?</h2><div class="dc-stat"><span>${esc(left[0])}</span><strong>${left[1].toLocaleString()}</strong></div><p>Compare ${esc(right[0])}’s total with the number above.</p>${state.done?`<div class="dc-feedback">${state.correct?'Correct!':'Good try.'} ${esc(right[0])}: <b>${right[1].toLocaleString()}</b>. ${esc(left[0])}: ${left[1].toLocaleString()}.</div>`:'<div class="dc-options"><button data-answer="higher">Higher ↑</button><button data-answer="lower">Lower ↓</button></div>'}`;
  }else{
   const players=set.groups.flatMap(g=>g[1]), found=state.found||[];
   html=`<p class="dc-eyebrow">${found.length} OF 2 GROUPS FOUND</p><h2>Which players share a draft team?</h2><p>Find three players drafted by the same franchise. Select three, then check your group. Four tries.</p>${found.map(g=>`<div class="dc-feedback"><b>${esc(set.groups[g][0])}</b><p>${set.groups[g][1].map(esc).join(' · ')}</p></div>`).join('')}<div class="dc-options">${order.filter(i=>!found.includes(Math.floor(i/3))).map(i=>`<button data-player="${i}" aria-pressed="${selected.includes(i)}" ${state.done?'disabled':''}>${esc(players[i])}</button>`).join('')}</div>${state.done?`<div class="dc-feedback">${found.length===2?'Both connections found!':set.groups.filter((g,i)=>!found.includes(i)).map(g=>`${esc(g[0])}: ${g[1].map(esc).join(', ')}`).join('<br>')}</div>`:`<button class="dc-check" data-check ${selected.length!==3?'disabled':''}>Check group · ${4-(state.attempts||0)} tries left</button>`}`;
  }
  sh.body.innerHTML=html+`<p role="status" aria-live="polite">${esc(message)}</p>${testing&&!inline?'<button class="dc-secondary" data-sample-replay>Replay sample</button><button class="dc-secondary" data-sample-next>Next sample</button>':''}${inline?'':'<button class="dc-secondary" data-close>Back to daily puzzles</button>'}`;
  if(focusKey){const target=[...sh.body.querySelectorAll('button,[data-number-dial]')].find(b=>b.getAttribute(focusKey)===focusValue&&!b.disabled)||sh.body.querySelector('[data-close]');target?.focus({preventScroll:true});}
 }
 let drag=null;
 function choose(value){if(state.done||!valid())return;const q=NUMBER_QUESTIONS[n%NUMBER_QUESTIONS.length];if(save({...state,guess:Math.max(q.min,Math.min(q.max,Math.round(value)))}))draw();}
 function pointer(e){const q=NUMBER_QUESTIONS[n%NUMBER_QUESTIONS.length];choose(guessAt(q,e.clientX-drag.x,e.clientY-drag.y));}
 sh.body.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-number-dial]')||state.done||!valid())return;e.preventDefault();const r=e.target.closest('[data-number-dial]').getBoundingClientRect();drag={id:e.pointerId,x:r.left+r.width/2,y:r.top+r.height/2};sh.body.setPointerCapture(e.pointerId);pointer(e);});
 sh.body.addEventListener('pointermove',e=>{if(drag&&drag.id===e.pointerId)pointer(e);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])sh.body.addEventListener(name,()=>{drag=null;});
 sh.body.addEventListener('keydown',e=>{if(!e.target.closest('[data-number-dial]')||state.done)return;const q=NUMBER_QUESTIONS[n%NUMBER_QUESTIONS.length],v=state.guess??Math.round((q.min+q.max)/2),big=Math.max(1,Math.round((q.max-q.min)/20));const values={ArrowRight:v+1,ArrowUp:v+1,ArrowLeft:v-1,ArrowDown:v-1,PageUp:v+big,PageDown:v-big,Home:q.min,End:q.max};if(e.key in values){e.preventDefault();choose(values[e.key]);}});
 sh.body.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-close')){sh.close();return;}if(!valid()){sh.close();return;}if(testing&&(b.hasAttribute('data-sample-replay')||b.hasAttribute('data-sample-next'))){if(b.hasAttribute('data-sample-next')){n++;set=SETS[n%SETS.length];}selected=[];save({picks:[],found:[],attempts:0});draw();return;}if(state.done||b.disabled)return;
  if(b.hasAttribute('data-number-submit')){const q=NUMBER_QUESTIONS[n%NUMBER_QUESTIONS.length],guess=state.guess??Math.round((q.min+q.max)/2);save({...state,guess,done:true,points:numberPoints(q,guess),correct:guess===q.answer});}
  if(b.dataset.answer){const q=set.stats, higher=n%2===0?q[2]>q[4]:q[4]>q[2];save({...state,done:true,correct:(b.dataset.answer==='higher')===higher});}
  if(b.dataset.player!==undefined){const i=Number(b.dataset.player);selected=selected.includes(i)?selected.filter(x=>x!==i):selected.length<3?[...selected,i]:selected;}
  if(b.hasAttribute('data-check')){const g=Math.floor(selected[0]/3), correct=selected.length===3&&selected.every(i=>Math.floor(i/3)===g), found=correct?[...(state.found||[]),g]:state.found||[],attempts=(state.attempts||0)+1;if(save({...state,found,attempts,done:found.length===2||attempts>=4})){selected=[];draw(correct?'Connection found!':'Those players do not share a draft franchise. Try again.');return;}}
  draw();
 });draw();
 return {unmount:()=>stop()};
}

// Reuse the same puzzle UI inside the complete test-day run.
export const challengeModule = id => ({
  render: () => '<div class="dc-game"></div>',
  mount: (el, ctx, api) => {
    const inst = openChallenge(id, () => api.refreshChrome(), el.querySelector('.dc-game'));
    const off = daily.subscribe(() => { if ((!daily.TEST && daily.dayVersion()!==5) || (daily.TEST && !data.isOwner())) ctx.nav('/puzzles/daily'); });
    return {unmount: () => { off(); inst?.unmount(); }};
  }
});
