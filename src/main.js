import './style.css';
import '@fontsource-variable/inter-tight';
import Lenis from 'lenis';
import photos from './photos.js';
import allPhotos from './photos.json';

const t0 = performance.now();
const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- intro: a 3D "A" plays while the scene loads, then the site opens by itself ----
let scene = null, entered = false, lenis = null, fpNow = 0, lastIdx = -1;
const MIN_SHOW = 1400; let tShow = t0; // ms the intro plays on a first visit

async function load() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await Promise.race([document.fonts.ready, wait(1500)]);
  try { await Promise.race([document.fonts.load('900 100px "Inter Tight Variable"'), wait(1200)]); } catch {}
  try {
    if (reduce) throw new Error('reduced motion');
    const mod = await import('./scene.js');
    scene = mod.createScene($('#gl')); document.body.classList.add('gl-on'); tShow = performance.now();
  } catch (e) { document.body.classList.add('nogl'); buildFallback(); }
  console.info(`[boot] ready in ${Math.round(performance.now() - t0)} ms`);
  setTimeout(enter, scene ? Math.max(0, MIN_SHOW - (performance.now() - tShow)) : 0);   // always show the intro, even when loading is instant
}

function enter() {
  if (entered) return; entered = true;
  scene?.reveal(false);
  document.body.classList.remove('ld');
  const boot = $('#boot'); boot.classList.add('out'); setTimeout(() => boot.remove(), 900);
  startScroll();
}

// ---- night -> dawn color arc, driven by scroll ----
const STOPS = [[0, [2, 4, 4]], [0.3, [14, 43, 43]], [0.6, [85, 75, 115]], [0.85, [90, 131, 145]], [1, [124, 178, 197]]];
function mix(p) {
  for (let i = 1; i < STOPS.length; i++) {
    if (p <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], t = (p - a) / (b - a);
      return ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
    }
  }
  return STOPS[STOPS.length - 1][1];
}
const SECS = ['top', 'flight', 'statement', 'about', 'services', 'story', 'work', 'recognition', 'contact'].map((id) => [id, document.getElementById(id)]);
function paint() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max > 0 ? Math.min(Math.max(scrollY / max, 0), 1) : 0;
  const bg = mix(p);
  $('#prog').style.transform = `scaleX(${p})`;
  const lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
  const fg = lum > 0.42 ? [2, 4, 4] : [253, 254, 254];
  const root = document.documentElement.style;
  root.setProperty('--bg', `rgb(${bg})`);
  root.setProperty('--fg', `rgb(${fg})`);
  scene?.setProgress(p, fg);
  if (scene) {
    let k = 'top';
    for (const [id, el] of SECS) {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5) { k = id; break; }
    }
    scene.setFloat(k);
  }
  const st = $('#statement').getBoundingClientRect();
  const sp = Math.min(Math.max(-st.top / (st.height - innerHeight), 0), 1);
  scene?.setSp(sp);
  const ec = 1 - Math.pow(1 - Math.min(sp / 0.7, 1), 3);                       // numbers count up over the first 70% of this screen
  nums.forEach((b) => { const v = Math.round(+b.dataset.n * ec); if (b._v !== v) { b._v = v; b.textContent = String(v).padStart(2, '0'); } });
  const fl = $('#flight');
  if (fl && scene) { const r = fl.getBoundingClientRect(); fpNow = Math.min(Math.max(-r.top / (r.height - innerHeight), 0), 1); scene.setFlight(fpNow); hud(); }
}

let pq = false;
const schedule = () => { if (!pq) { pq = true; requestAnimationFrame(() => { pq = false; paint(); }); } };   // at most one paint per frame
function startScroll() {
  if (!reduce) {
    lenis = new Lenis();
    lenis.on('scroll', schedule);
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  addEventListener('scroll', schedule, { passive: true });
  paint();
}

// ---- render mode switch ----
document.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', () => {
  scene?.setMode(b.dataset.m);
  document.querySelectorAll('.modes button').forEach((x) => x.classList.toggle('on', x === b));
}));

// ---- dialogs: case files + contact ----
const lock = (on) => lenis && (on ? lenis.stop() : lenis.start());
const openDlg = (d) => { document.body.classList.add('no-rt'); d.showModal(); lock(true); };
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('close', () => { lock(false); document.body.classList.remove('no-rt'); });
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
});
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openDlg($('#' + b.dataset.open))));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

// Add data-img="/projects/x.webp" data-live="https://..." data-code="https://..." to a project link in index.html and it shows up here.
document.querySelectorAll('.cases a').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const name = a.querySelector('b').textContent;
  $('#c-idx').textContent = a.querySelector('span').textContent;
  $('#c-name').textContent = name;
  $('#c-desc').textContent = a.querySelector('i').textContent;
  $('#c-tags').textContent = a.querySelector('em').textContent;
  $('#c-meta').textContent = [a.dataset.role, a.dataset.year].filter(Boolean).join('  /  ');
  const shot = $('#c-shot'); shot.replaceChildren();
  if (a.dataset.img) { const im = new Image(); im.src = a.dataset.img; im.alt = name + ' screenshot'; shot.append(im); } else { const n = document.createElement('b'); n.textContent = a.querySelector('span').textContent; shot.append(n); }
  const links = $('#c-links'); links.replaceChildren();
  [['live', 'Live ↗'], ['code', 'Code ↗']].forEach(([k, label]) => {
    if (!a.dataset[k]) return;
    const x = document.createElement('a'); x.href = a.dataset[k]; x.textContent = label; x.target = '_blank'; x.rel = 'noopener'; links.append(x);
  });
  if (!links.children.length) { const x = document.createElement('a'); x.href = 'https://github.com/NEXUS-70'; x.textContent = 'More on GitHub ↗'; x.target = '_blank'; x.rel = 'noopener'; links.append(x); }
  openDlg($('#case'));
}));

const form = $('#form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = form.querySelector('[type=submit]'), msg = $('#form-msg'), fd = Object.fromEntries(new FormData(form));
  if (fd._gotcha) return;
  btn.disabled = true; btn.textContent = 'Sending…'; msg.textContent = '';
  try {
    const r = await fetch('https://formspree.io/f/mbggjrba', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...fd, _subject: 'Portfolio: ' + fd.need }) });
    if (!r.ok) throw 0;
    form.reset(); msg.textContent = 'Sent. I’ll reply soon.'; btn.textContent = 'Sent';
  } catch { msg.textContent = 'Could not send. Please email zykelith@proton.me.'; btn.textContent = 'Send'; }
  btn.disabled = false; setTimeout(() => { btn.textContent = 'Send'; }, 4000);
});

// ---- HUD: photo counter + timeline ----
$('#hcount').textContent = `[ 00 / ${photos.length} ]`;
$('#ix-h').textContent = `${photos.length} photographs`;
$('#flight').style.height = `${Math.round(photos.length * 15.5)}svh`;
const tk = $('#ticks');
const ticks = photos.map((_, k) => { const t = document.createElement('i'); t.dataset.k = k; tk.append(t); return t; });
function hud() {
  const on = fpNow > 0.005 && fpNow < 0.995;
  document.body.classList.toggle('in-flight', on);
  if (!on) return;
  radar();
  const i = Math.round(fpNow * (photos.length - 1));
  if (i === lastIdx) return;
  lastIdx = i;
  $('#hcount').textContent = `[ ${String(i + 1).padStart(2, '0')} / ${photos.length} ]`;
  ticks.forEach((t, k) => t.classList.toggle('on', k === i));
}
function goPhoto(k) {
  const fl = $('#flight'), y = fl.getBoundingClientRect().top + scrollY + (k / (photos.length - 1)) * (fl.offsetHeight - innerHeight);
  lenis ? lenis.scrollTo(y, { duration: 1.4, force: true }) : scrollTo({ top: y, behavior: 'smooth' });
}
tk.addEventListener('click', (e) => { const k = e.target.dataset?.k; if (k != null) goPhoto(+k); });

// ---- bracket links: text scramble on hover ----
const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>';
function scramble(el) {
  const t = el.dataset.t || (el.dataset.t = el.textContent); let n = 0;
  clearInterval(el._s);
  el._s = setInterval(() => {
    n++;
    el.textContent = [...t].map((c, i) => (c === ' ' || i < n ? c : GL[(Math.random() * GL.length) | 0])).join('');
    if (n > t.length) { clearInterval(el._s); el.textContent = t; }
  }, 22);
}
if (!reduce) document.querySelectorAll('.bar nav a, .nav-btn').forEach((el) => el.addEventListener('mouseenter', () => scramble(el)));

// ---- film grain (tiny generated noise tile, CSS-animated) ----
{
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  $('#grain').style.backgroundImage = `url(${c.toDataURL()})`;
}

// ---- magnetic reticle cursor + X/Y/Z telemetry (mouse devices only) ----
if (matchMedia('(pointer: fine)').matches && !reduce) {
  document.body.classList.add('rt');
  const dot = $('#ret .dot'), ring = $('#ret .ring'), hx = $('#hx'), hy = $('#hy'), hz = $('#hz');
  let mx = -100, my = -100, rx = -100, ry = -100, rw = 36, rh = 36, hov = null;
  const f = (v) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(1).padStart(5, '0');
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; hov = e.target.closest?.('a,button,input,select,textarea,[data-open]') || null; }, { passive: true });
  const loop = () => {
    let tx = mx, ty = my, tw = 36, th = 36;
    if (hov && hov.isConnected) {
      const r = hov.getBoundingClientRect();
      if (r.width < 420 && r.height < 200) { tx = r.left + r.width / 2 + (mx - r.left - r.width / 2) * .25; ty = r.top + r.height / 2 + (my - r.top - r.height / 2) * .25; tw = r.width + 14; th = r.height + 10; }
      else { tw = th = 64; }
    }
    rx += (tx - rx) * .18; ry += (ty - ry) * .18; rw += (tw - rw) * .18; rh += (th - rh) * .18;
    dot.style.transform = `translate(${mx}px,${my}px)`;
    ring.style.width = rw + 'px'; ring.style.height = rh + 'px';
    ring.style.transform = `translate(${rx - rw / 2}px,${ry - rh / 2}px)`;
    ring.style.borderRadius = hov && tw !== 64 ? '6px' : '50%';
    hx.textContent = f((mx / innerWidth - .5) * 200); hy.textContent = f((.5 - my / innerHeight) * 200); hz.textContent = (fpNow * 100).toFixed(1).padStart(5, '0');
    requestAnimationFrame(loop);
  };
  loop();
}

// ---- radar: top-down map of the 49 photos + camera cone ----
const rc = $('#radar'), rx = rc.getContext('2d');
const RP = photos.map((_, i) => { const a = i * 2.39996, r = 3.6 + 1.1 * ((i * 7) % 5) / 4; return [Math.cos(a) * r, -i * 7]; });
function radar() {
  const camZ = 30 + (-(photos.length - 1) * 7 + 3 - 30) * fpNow, cy = 110, SX = 9, SZ = 3.2;
  rx.clearRect(0, 0, 128, 128);
  rx.fillStyle = rx.strokeStyle = document.documentElement.style.getPropertyValue('--fg') || '#fff';
  const half = Math.atan(Math.tan(.48) * innerWidth / innerHeight), sl = Math.tan(half) * SX / SZ;
  rx.globalAlpha = .35; rx.beginPath(); rx.moveTo(64, cy); rx.lineTo(64 - sl * cy, 0); rx.moveTo(64, cy); rx.lineTo(64 + sl * cy, 0); rx.stroke();
  RP.forEach(([x, z], i) => { const y = cy - (camZ - z) * SZ; if (y < 0 || y > 128) return; rx.globalAlpha = i === lastIdx ? 1 : .55; rx.fillRect(64 + x * SX - 2, y - 2, i === lastIdx ? 5 : 3, i === lastIdx ? 5 : 3); });
  rx.globalAlpha = 1; rx.fillRect(62, cy - 2, 5, 5);
}

// ---- index overlay: hover a row to preview, click to fly to that photo ----
const ix = $('#ix'), prev = $('#ix-prev');
photos.forEach((p, k) => { const li = document.createElement('li'); li.innerHTML = `<button data-k="${k}"><span>${String(k + 1).padStart(2, '0')}</span><span>${p.c}</span><span>${p.y}</span></button>`; ix.append(li); });
ix.addEventListener('mouseover', (e) => { const b = e.target.closest('button'); if (!b) return; prev.src = '/photos/' + photos[b.dataset.k].f; prev.style.display = 'block'; });
ix.addEventListener('mouseleave', () => { prev.style.display = 'none'; });
$('#index-dlg').addEventListener('mousemove', (e) => { prev.style.left = Math.min(e.clientX + 28, innerWidth - 240) + 'px'; prev.style.top = Math.max(16, Math.min(e.clientY - 120, innerHeight - 320)) + 'px'; });
$('#index-dlg').addEventListener('close', () => { prev.style.display = 'none'; });
ix.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $('#index-dlg').close(); lenis?.start(); setTimeout(() => goPhoto(+b.dataset.k), 80); });

// ---- keyboard: I index, M render mode, arrows step through photos ----
addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.metaKey || e.ctrlKey || !entered || document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase(), flash = (id) => { const el = document.getElementById(id); el.classList.add('lit'); setTimeout(() => el.classList.remove('lit'), 220); };
  if (k === 'i') { flash('k-i'); openDlg($('#index-dlg')); }
  else if (k === 'm') { flash('k-m'); const b = [...document.querySelectorAll('.modes button')], n = b.findIndex((x) => x.classList.contains('on')); b[(n + 1) % b.length].click(); }
  else if ((k === 'arrowright' || k === 'arrowleft') && fpNow > 0 && fpNow < 1) {
    e.preventDefault(); flash('k-a');
    goPhoto(Math.max(0, Math.min(photos.length - 1, Math.max(lastIdx, 0) + (k === 'arrowright' ? 1 : -1))));
  }
});

// ---- FX lab ----
$('#lab-t').addEventListener('click', () => { const p = $('#lab-p'); p.hidden = !p.hidden; });
const fx = () => scene?.setFx({ bend: +$('#fx-bend').value, split: +$('#fx-split').value });
['fx-bend', 'fx-split'].forEach((id) => document.getElementById(id).addEventListener('input', fx));
$('#fx-grain').addEventListener('input', (e) => { $('#grain').style.opacity = e.target.value; });

// ---- kinetic type: headlines skew with scroll speed ----
if (!reduce) {
  const kin = [...document.querySelectorAll('h1,.big,.finale,.mail')];
  let ly = scrollY, kv = 0, last = 0;
  const kloop = () => {
    kv += ((scrollY - ly) - kv) * .12; ly = scrollY;
    const sk = Math.round(Math.max(-8, Math.min(8, kv * -.35)) * 100) / 100;
    if (sk !== last) { last = sk; kin.forEach((el) => { el.style.transform = sk ? `skewX(${sk}deg) scaleY(${1 + Math.min(Math.abs(kv) * .003, .08)})` : ''; }); }
    requestAnimationFrame(kloop);
  };
  kloop();
}

// ---- by the numbers: real counts from the page ----
const nums = [...document.querySelectorAll('.nums b')];
nums[0].dataset.n = allPhotos.length;
nums[1].dataset.n = document.querySelectorAll('.cases li').length;
nums[2].dataset.n = document.querySelectorAll('.rec li').length;

// ---- smooth in-page links + tab title ----
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href'), t = id.length > 1 && document.querySelector(id);
  if (!t) return;
  e.preventDefault();
  lenis ? lenis.scrollTo(t, { duration: 1.4 }) : t.scrollIntoView({ behavior: 'smooth' });
}));
const baseTitle = document.title;
document.addEventListener('visibilitychange', () => { document.title = document.hidden ? 'Come back, it’s almost dawn' : baseTitle; });

// ---- back to top ----
document.querySelectorAll('[data-top]').forEach((b) => b.addEventListener('click', () => (lenis ? lenis.scrollTo(0, { duration: 1.6 }) : scrollTo({ top: 0, behavior: 'smooth' }))));

// ---- no-3D fallback: plain photo grid so nobody misses the photography ----
function buildFallback() {
  const sec = document.createElement('section'); sec.className = 'fb'; sec.setAttribute('aria-label', 'Photographs');
  photos.filter((_, i) => i % 3 === 0).forEach((p, i) => {
    const im = new Image(); im.src = '/photos/' + p.f; im.loading = 'lazy'; im.alt = `Photograph ${i + 1}, ${p.c.toLowerCase()} tones`; sec.append(im);
  });
  $('#about').before(sec);
}

// ---- reveal sections as they scroll into view ----
if (!reduce) {
  const rv = [...document.querySelectorAll('.cases li,.rec li,.tl li,.svc li,.now li,.stack>div,main section>.mono:first-child,.beyond,.cta')];
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.15 });
  rv.forEach((e, i) => { e.classList.add('rv'); e.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(e); });
}

// ---- copy email ----
$('#copy').addEventListener('click', async () => {
  const note = $('#copied');
  try { await navigator.clipboard.writeText('zykelith@proton.me'); note.textContent = 'Copied'; } catch { note.textContent = 'Press Ctrl+C on the address above'; }
  setTimeout(() => { note.textContent = ''; }, 1800);
});

// ---- time overlap: your time vs Dhaka ----
const hhmm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
function overlap() {
  const now = new Date(), diff = (360 + now.getTimezoneOffset()) / 60;   // Dhaka is UTC+6
  const d = Math.abs(diff), txt = diff === 0 ? 'Dhaka shares your time zone' : `Dhaka is ${d % 1 ? d.toFixed(1) : d}h ${diff > 0 ? 'ahead of' : 'behind'} you`;
  $('#overlap').textContent = `Your time ${hhmm.format(now)} · ${txt}`;
}
overlap(); setInterval(overlap, 30000);

// ---- live GitHub line (after the intro, so it never competes with loading) ----
setTimeout(() => fetch('https://api.github.com/users/NEXUS-70/repos?sort=pushed&per_page=100')
  .then((r) => (r.ok ? r.json() : Promise.reject()))
  .then((repos) => {
    if (!Array.isArray(repos) || !repos.length) return;
    const days = Math.max(0, Math.round((Date.now() - new Date(repos[0].pushed_at)) / 864e5));
    const el = $('#gh'); el.hidden = false; el.textContent = '';
    const a = document.createElement('a'); a.href = 'https://github.com/NEXUS-70'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'GitHub';
    el.append(a, ` · ${repos.length} public repos · last push ${days === 0 ? 'today' : days + ' day' + (days > 1 ? 's' : '') + ' ago'}`);
  }).catch(() => {}), 3000);

// ---- Dhaka clock ----
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const clock = () => { $('#clock').textContent = fmt.format(new Date()); };
clock(); setInterval(clock, 1000);

load();
