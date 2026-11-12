// Completed seasons and career totals; each question supplies its own numeric scale.
export const NUMBER_QUESTIONS = [
  {question:'How many passing yards did Tom Brady throw for in the 2020 regular season?', unit:'yards', min:0, max:5000, answer:4633},
  {question:'How many Super Bowls had the Pittsburgh Steelers won through the 2024 season?', unit:'titles', min:0, max:10, answer:6},
  {question:'How many rushing yards did Eric Dickerson have in the 1984 regular season?', unit:'yards', min:0, max:2500, answer:2105},
  {question:'How many Super Bowl championships did Tom Brady win as a player?', unit:'titles', min:0, max:10, answer:7}
];
export const numberPoints = (q, guess) => Math.max(0, Math.round(200 * (1 - Math.abs(guess-q.answer)/(q.max-q.min))));
const point = (fraction, radius=112) => {const a=(135+270*fraction)*Math.PI/180;return [140+radius*Math.cos(a),140+radius*Math.sin(a)];};
const sector = fraction => {const a=point(0),b=point(fraction);return `M140 140 L${a} A112 112 0 ${fraction>2/3?1:0} 1 ${b} Z`;};
export function dialHTML(q, guess, done) {
 const f=(guess-q.min)/(q.max-q.min),p=point(f),ticks=Array.from({length:11},(_,i)=>{const a=point(i/10,101),b=point(i/10,112);return `<path d="M${a} L${b}" class="nt-tick"/>`;}).join('');
 return `<svg class="nt-dial" data-number-dial viewBox="0 0 280 280" role="slider" tabindex="${done?-1:0}" aria-label="Your guess in ${q.unit}" aria-valuemin="${q.min}" aria-valuemax="${q.max}" aria-valuenow="${guess}" aria-valuetext="${guess.toLocaleString()} ${q.unit}" aria-disabled="${done}"><path d="${sector(1)}" class="nt-track"/><path d="${sector(f)}" class="nt-fill"/>${ticks}<circle cx="140" cy="140" r="75" class="nt-center"/><path d="M${point(f,78)} L${p}" class="nt-needle"/><circle cx="${p[0]}" cy="${p[1]}" r="9" class="nt-thumb"/><text x="140" y="138" class="nt-value">${guess.toLocaleString()}</text><text x="140" y="162" class="nt-unit">${q.unit}</text><text x="43" y="250" class="nt-limit">${q.min.toLocaleString()}</text><text x="237" y="250" class="nt-limit">${q.max.toLocaleString()}</text></svg>`;
}
export function guessAt(q, x, y) {
 const angle=(Math.atan2(y,x)*180/Math.PI-135+360)%360;
 const fraction=angle<=270?angle/270:angle<315?1:0;
 return Math.round(q.min+fraction*(q.max-q.min));
}
