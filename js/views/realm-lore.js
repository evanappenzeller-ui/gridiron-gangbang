// Owner-only cinematic, mounted by realm.js after its profile/route checks.
// Rendering is pure: images are requested only when an eligible reader mounts it.
export const LORE_VERSION = '3';
export const SLIDES = [
  {title: 'One kingdom', text: 'Yharmin was once united under a single High King, ruling from one great keep.', image: '01-united', alt: 'The High King overlooks a united Yharmin from a towering golden-lit stronghold.'},
  {title: 'One night', text: 'In a single night, that keep was breached.', image: '02-breach', alt: 'Shadowy soldiers enter a shattered fortress gate amid smoke and embers.'},
  {title: 'The lost crown', text: 'The crown was lost. No king remained to hold Yharmin together.', image: '03-crown', alt: 'An abandoned gold crown lies on the cracked floor of an empty throne room.'},
  {title: 'A kingdom divided', text: 'Yharmin split into rival houses, each building its own stronghold.', image: '04-divided', alt: 'Rival house leaders stand apart around a broken, vacant throne.'},
  {title: 'The broken throne', text: 'The houses fought to claim the broken throne.', image: '05-houses', alt: 'A house leader raises a tattered banner before rival strongholds across a misty valley.'},
  {title: 'The Keepfall', text: 'That night is remembered as the Keepfall.', image: '06-keepfall', alt: 'A lone witness stands beneath the immense ruins of the fallen stronghold.'},
  {title: 'Your house. Your reign.', text: 'Now every house builds, raids, and wars for one goal: to rebuild what was lost and rule Yharmin.', image: '07-reign', alt: 'An armored leader faces a fortress being rebuilt beneath a golden dawn.'}
];
export function introHTML(helpHTML) {
  return '<div class="rl-intro" aria-roledescription="carousel" aria-label="Lore of Yharmin">'
    + '<header class="rl-intro-top"><button type="button" data-intro-skip>Skip <span aria-hidden="true">›</span></button></header>'
    + '<div class="rl-intro-story">'
    + '<div class="rl-intro-stage">' + SLIDES.map((s, i) =>
      '<article class="rl-intro-slide" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of 7: ' + s.title + '"' + (i ? ' hidden inert' : '') + '>'
      + '<img class="rl-intro-art" data-src="img/realm/lore-v2/' + s.image + '.webp" alt="' + s.alt + '" draggable="false" decoding="async">'
      + '<div class="rl-intro-caption"><p class="rl-intro-copy">' + s.text + '</p></div></article>').join('') + '</div>'
    + '<footer class="rl-intro-footer"><div class="rl-intro-progress" aria-label="Choose a lore slide">'
    + SLIDES.map((s, i) => '<button type="button" data-intro-slide="' + i + '" aria-label="Slide ' + (i + 1) + ': ' + s.title + '"' + (i ? '' : ' aria-current="step"') + '><span></span></button>').join('')
    + '</div><div class="rl-intro-nav"><button type="button" data-intro-prev disabled aria-label="Previous slide">‹ <span>Back</span></button>'
    + '<span class="rl-intro-count" aria-live="polite" aria-atomic="true">Slide 1 of 7</span>'
    + '<button type="button" data-intro-next>Next <span aria-hidden="true">›</span></button></div>'
    + '<div class="rl-intro-meta"><span>Swipe to explore</span><button type="button" data-intro-help>How to play</button></div></footer></div>'
    + '<section class="rl-intro-help" hidden inert aria-label="How to play"><button type="button" data-intro-resume>‹ Back to the story</button>'
    + '<h2>How to play</h2>' + helpHTML + '</section></div>';
}
export function mountIntro(sh, {first, signal, active, onClose}) {
  const root = sh.body.querySelector('.rl-intro'), story = root.querySelector('.rl-intro-story'),
    help = root.querySelector('.rl-intro-help'), slides = [...root.querySelectorAll('.rl-intro-slide')],
    dots = [...root.querySelectorAll('[data-intro-slide]')], prev = root.querySelector('[data-intro-prev]'),
    next = root.querySelector('[data-intro-next]'), count = root.querySelector('.rl-intro-count');
  let index = 0, helpOpen = false, start = null;
  const live = () => !signal.aborted && active();
  const requestArt = i => {
    const img = slides[i]?.querySelector('img');
    if (!img || img.hasAttribute('src') || !live()) return;
    img.addEventListener('error', () => { if (live()) img.hidden = true; }, {once: true, signal});
    img.src = img.dataset.src;
  };
  const show = value => {
    if (!live() || helpOpen) return;
    index = Math.max(0, Math.min(SLIDES.length - 1, value));
    slides.forEach((slide, i) => { slide.hidden = i !== index; slide.inert = i !== index; });
    dots.forEach((dot, i) => { if (i === index) dot.setAttribute('aria-current', 'step'); else dot.removeAttribute('aria-current'); });
    prev.disabled = index === 0;
    next.textContent = index === SLIDES.length - 1 ? (first ? 'Begin your reign' : 'Return to your realm') : 'Next ›';
    count.textContent = 'Slide ' + (index + 1) + ' of ' + SLIDES.length;
    requestArt(index); requestArt(index + 1);
  };
  const toggleHelp = open => {
    if (!live()) return;
    helpOpen = open; start = null;
    help.hidden = !open; help.inert = !open; story.hidden = open; story.inert = open;
    root.querySelector(open ? '[data-intro-resume]' : '[data-intro-help]').focus();
  };
  root.addEventListener('click', e => {
    if (!live()) return;
    const target = e.target.closest('button');
    if (!target) return;
    if (target.hasAttribute('data-intro-skip')) onClose();
    else if (target.hasAttribute('data-intro-next')) { if (index === SLIDES.length - 1) onClose(); else show(index + 1); }
    else if (target.hasAttribute('data-intro-prev')) show(index - 1);
    else if (target.hasAttribute('data-intro-slide')) show(Number(target.dataset.introSlide));
    else if (target.hasAttribute('data-intro-help')) toggleHelp(true);
    else if (target.hasAttribute('data-intro-resume')) toggleHelp(false);
  }, {signal});
  sh.el.addEventListener('keydown', e => {
    if (helpOpen || !live() || e.altKey || e.ctrlKey || e.metaKey) return;
    const step = {ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: SLIDES.length - 1}[e.key];
    if (step === undefined) return;
    e.preventDefault(); show(step);
  }, {signal});
  // The generic sheet supports drag-to-dismiss. A story swipe must never dismiss it.
  root.addEventListener('touchstart', e => e.stopPropagation(), {passive: true, signal});
  root.addEventListener('pointerdown', e => {
    if (!e.isPrimary) { start = null; return; }
    if (!live() || helpOpen || e.button !== 0 || e.target.closest('button')) return;
    start = {id: e.pointerId, x: e.clientX, y: e.clientY};
    root.setPointerCapture?.(e.pointerId);
  }, {signal});
  root.addEventListener('pointerup', e => {
    const from = start; start = null;
    if (!from || from.id !== e.pointerId || !live()) return;
    const dx = e.clientX - from.x, dy = e.clientY - from.y;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.25) show(index + (dx < 0 ? 1 : -1));
  }, {signal});
  root.addEventListener('pointercancel', () => { start = null; }, {signal});
  show(0);
}
