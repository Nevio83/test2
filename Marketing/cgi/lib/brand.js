// Maios Motion – Markenbausteine fuer Videos (DOM-Ebene ueber dem 3D-Bild)
// Farben + Schriften aus dem Shop (index.html "Editorial Dark"): Marcellus + Manrope, Gold #D8B56C
import { clamp, ease, seg, lerp, rng } from './core.js';

export const C = {
  nacht: '#0B0A09', nacht2: '#13100B', papier: '#F0E7D4', tinte: '#13100B', creme: '#F5F0E6',
  gold: '#D8B56C', goldHell: '#E9CD8C', goldPreis: '#E4C077', terrakotta: '#C97A5A', grau: '#A79E8B',
};

export const CSS = `
@font-face{font-family:'Manrope';src:url(fonts/manrope-latin.woff2) format('woff2');font-weight:200 800;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Manrope';src:url(fonts/manrope-latin-ext.woff2) format('woff2');font-weight:200 800;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Marcellus';src:url(fonts/marcellus-latin.woff2) format('woff2')}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#0B0A09}
#stage,#ov{position:absolute;inset:0}
#stage canvas{display:block}
#ov{pointer-events:none;font-family:Manrope,sans-serif;-webkit-font-smoothing:antialiased}
.abs{position:absolute}
.gold{background:linear-gradient(105deg,#8f6b2e 0%,#c9a258 22%,#e9cd8c 40%,#fff4d4 50%,#e9cd8c 60%,#c9a258 78%,#8f6b2e 100%);background-size:260% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}
.goldd{background:linear-gradient(105deg,#5a4015 0%,#7a5a22 25%,#8a6626 42%,#ad8749 50%,#8a6626 58%,#7a5a22 75%,#5a4015 100%);background-size:260% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}
.goldfl{background:linear-gradient(105deg,#8f6b2e 0%,#c9a258 22%,#e9cd8c 40%,#fff4d4 50%,#e9cd8c 60%,#c9a258 78%,#8f6b2e 100%);background-size:260% 100%}
.pill{font:600 30px Manrope;letter-spacing:.2em;text-transform:uppercase;padding:10px 22px 9px;border-radius:40px;border:2px solid #D8B56C}
.hl{font-family:Marcellus,serif;font-weight:400;line-height:1.04;letter-spacing:-.005em}
.hl .ln{display:block;overflow:hidden;padding-bottom:.08em}
.hl .w{display:inline-block;will-change:transform}
.step .num{font-family:Marcellus,serif;font-size:150px;line-height:1;display:inline-block}
.step .lbl{font:700 50px Manrope;letter-spacing:.16em;text-transform:uppercase;display:inline-block;margin-left:26px;vertical-align:42px}
.step .clip{overflow:hidden;display:inline-block}
.vlabel{font:700 34px Manrope;letter-spacing:.2em;text-transform:uppercase;text-align:center;width:300px;margin-left:-150px}
.vlabel i{display:block;margin:14px auto 0;width:44px;height:3px;border-radius:2px}
.endname{font-family:Marcellus,serif;font-size:66px;text-align:center;line-height:1.1}.endname b{font:600 50px Manrope;letter-spacing:.04em;vertical-align:4px;color:#E9CD8C}
.endprice{font-family:Marcellus,serif;font-size:122px;text-align:center;line-height:1}
.endsub{font:600 32px Manrope;letter-spacing:.24em;text-transform:uppercase;text-align:center}
.cta{font:700 36px Manrope;letter-spacing:.06em;padding:20px 46px;border-radius:60px;color:#13100B}
`;

// ---------- Bausteine ----------
const root = () => document.getElementById('ov');
function el(html, style = {}) {
  const d = document.createElement('div'); d.innerHTML = html.trim();
  const e = d.firstChild; Object.assign(e.style, style); root().appendChild(e); return e;
}
const show = (e, op) => { e.style.opacity = op; e.style.visibility = op <= 0.001 ? 'hidden' : 'visible'; };

// Werbung-Kennzeichnung
export function pill(text = 'Werbung', { x = 84, y = 208, dark = true, center = false } = {}) {
  const e = el(`<div class="abs pill">${text}</div>`, { left: center ? '540px' : x + 'px', top: y + 'px', color: dark ? C.creme : C.tinte, background: dark ? 'rgba(11,10,9,.35)' : 'rgba(240,231,212,.55)', transform: center ? 'translateX(-50%)' : '' });
  return (op) => show(e, op);
}

// Ueberschrift: Zeilen aus Woertern, Woerter steigen aus einer Maskenlinie
export function headline(lines, { x = 84, y = 250, size = 116, color = C.creme, align = 'left', width = 850, goldClass = 'gold' } = {}) {
  const html = lines.map((ln) => `<span class="ln">${ln.map((w) => `<span class="w ${w.gold ? goldClass : ''}" style="${w.gold ? '' : `color:${w.color || color}`}">${w.t}</span>`).join(' ')}</span>`).join('');
  const e = el(`<div class="abs hl">${html}</div>`, { left: x + 'px', top: y + 'px', fontSize: size + 'px', width: width + 'px', textAlign: align });
  const ws = [...e.querySelectorAll('.w')];
  return (tl, out = 0) => { // tl: Sekunden seit Einblendung, out: 0..1 Ausblenden
    show(e, tl < 0 ? 0 : 1 - out);
    ws.forEach((w, i) => {
      const p = ease.outQuint(seg(tl, i * 0.07, i * 0.07 + 0.55));
      w.style.transform = `translateY(${(1 - p) * 110}%)`;
      if (w.classList.contains('gold') || w.classList.contains('goldd')) w.style.backgroundPosition = `${lerp(100, 0, seg(tl, 0.25, 1.4))}% 0`;
    });
    e.style.transform = `translateY(${-out * 40}px)`;
  };
}

// Schritt-Nummer mit Goldfaden
export function step({ x = 84, y = 236, dark = false } = {}) {
  const e = el(`<div class="abs step"><span class="clip"><span class="num ${dark ? 'gold' : 'goldd'}">01</span></span><span class="clip"><span class="lbl">Obst rein</span></span>
    <svg width="700" height="12" style="display:block;margin-top:8px"><line x1="4" y1="6" x2="696" y2="6" stroke="url(#gf)" stroke-width="4" stroke-linecap="round"/>
    <defs><linearGradient id="gf"><stop offset="0" stop-color="${dark ? '#c9a258' : '#7a5a22'}"/><stop offset=".6" stop-color="${dark ? '#f3dfa6' : '#a98245'}"/><stop offset="1" stop-color="#c9a258" stop-opacity="0"/></linearGradient></defs></svg></div>`, { left: x + 'px', top: y + 'px' });
  const num = e.querySelector('.num'), lbl = e.querySelector('.lbl'), line = e.querySelector('line');
  lbl.style.color = dark ? C.creme : C.tinte;
  return (tl, n, text, out = 0) => {
    show(e, tl < 0 ? 0 : 1 - out);
    if (tl < 0) return;
    num.textContent = n; lbl.textContent = text;
    const a = ease.outQuint(seg(tl, 0, 0.45)), b = ease.outQuint(seg(tl, 0.08, 0.55));
    num.style.transform = `translateY(${(1 - a) * 105}%)`; lbl.style.transform = `translateY(${(1 - b) * 120}%)`;
    num.style.backgroundPosition = `${lerp(100, 0, seg(tl, 0.1, 1.0))}% 0`;
    const L = 692 * ease.outExpo(seg(tl, 0.12, 0.9));
    line.setAttribute('x2', 4 + L);
  };
}

// Kurator-Siegel (rotierender Kreistext mit M)
export function seal({ x = 120, y = 300, size = 250, dark = false } = {}) {
  const txt = 'KURATIERT VON MAIOS · KURATIERT VON MAIOS · ';
  const e = el(`<div class="abs" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 200 200" width="${size}" height="${size}" style="position:absolute;inset:0">
      <defs><path id="sc" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"/>
      <linearGradient id="sg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${dark ? '#b8914a' : '#7a5a22'}"/><stop offset=".5" stop-color="${dark ? '#f1dca0' : '#a98245'}"/><stop offset="1" stop-color="${dark ? '#b8914a' : '#7a5a22'}"/></linearGradient></defs>
      <circle cx="100" cy="100" r="97" fill="${dark ? 'rgba(11,10,9,.55)' : 'rgba(245,240,230,.75)'}" stroke="url(#sg)" stroke-width="2"/>
      <circle cx="100" cy="100" r="60" fill="none" stroke="url(#sg)" stroke-width="1.2"/>
      <g class="rot"><text font-family="Manrope" font-weight="700" font-size="15.5" letter-spacing="3.1" fill="url(#sg)"><textPath href="#sc">${txt}</textPath></text></g>
    </svg>
    <div class="goldfl" style="position:absolute;left:50%;top:50%;width:${size * 0.36}px;height:${size * 0.36}px;transform:translate(-50%,-50%);-webkit-mask:url(assets/logo_m.png) center/contain no-repeat;mask:url(assets/logo_m.png) center/contain no-repeat"></div></div>`,
  { left: x + 'px', top: y + 'px' });
  const g = e.querySelector('.rot'), m = e.querySelector('.goldfl');
  return (tl, out = 0) => {
    show(e, tl < 0 ? 0 : (1 - out));
    if (tl < 0) return;
    const p = ease.outBack(seg(tl, 0, 0.5));
    e.style.transform = `scale(${0.4 + 0.6 * p}) rotate(${(1 - p) * -40}deg)`;
    g.setAttribute('transform', `rotate(${tl * 40} 100 100)`);
    m.style.backgroundPosition = `${lerp(100, 0, seg(tl, 0.2, 1.2))}% 0`;
  };
}

// Editorial-Eckmarken
export function corners({ x0 = 60, y0 = 196, x1 = 916, y1 = 1500, len = 70, color = C.gold } = {}) {
  const e = el(`<svg class="abs" width="1080" height="1920" style="left:0;top:0"><g stroke="${color}" stroke-width="3" fill="none" stroke-linecap="square">
    <path class="c" d="M${x0},${y0 + len} V${y0} H${x0 + len}"/><path class="c" d="M${x1 - len},${y0} H${x1} V${y0 + len}"/>
    <path class="c" d="M${x0},${y1 - len} V${y1} H${x0 + len}"/><path class="c" d="M${x1 - len},${y1} H${x1} V${y1 - len}"/></g></svg>`);
  const cs = [...e.querySelectorAll('.c')];
  return (tl, out = 0) => {
    show(e, tl < 0 ? 0 : 1 - out);
    const p = ease.outExpo(seg(tl, 0, 0.6));
    const ins = (1 - p) * 40;
    cs.forEach((c, i) => { const sx = i % 2 ? -1 : 1, sy = i < 2 ? 1 : -1; c.setAttribute('transform', `translate(${sx * ins},${sy * ins})`); });
  };
}

// Goldener Lichtstreif (Uebergang): p 0..1 laeuft quer durchs Bild
export function streak() {
  const e = el(`<div class="abs" style="left:-600px;top:-400px;width:2280px;height:2720px;transform-origin:center"><div style="position:absolute;left:0;top:0;bottom:0;width:520px;
    background:linear-gradient(90deg,rgba(216,181,108,0) 0%,rgba(216,181,108,.35) 30%,rgba(255,240,205,.95) 50%,rgba(216,181,108,.35) 70%,rgba(216,181,108,0) 100%);filter:blur(6px)"></div></div>`);
  const band = e.firstChild;
  return (p) => {
    show(e, p > 0 && p < 1 ? 1 : 0);
    e.style.transform = 'rotate(-18deg)';
    band.style.transform = `translateX(${lerp(-600, 2400, ease.inOut(p))}px)`;
  };
}

// Weissblitz
export function flash() {
  const e = el(`<div class="abs" style="inset:0;background:#fff8ec"></div>`);
  return (op) => show(e, op);
}

// Ripple-Ringe (z. B. Knopfdruck)
export function ripple() {
  const e = el(`<svg class="abs" width="1080" height="1920" style="left:0;top:0"><defs><radialGradient id="rg"><stop offset="0" stop-color="#fff4d4" stop-opacity=".9"/><stop offset="1" stop-color="#fff4d4" stop-opacity="0"/></radialGradient></defs>
    <circle class="g" r="80" fill="url(#rg)"/><circle class="a" r="10" fill="none" stroke="#E9CD8C" stroke-width="5"/><circle class="b" r="10" fill="none" stroke="#E9CD8C" stroke-width="3"/></svg>`);
  const a = e.querySelector('.a'), b = e.querySelector('.b'), g = e.querySelector('.g');
  return (x, y, tl) => {
    show(e, tl < 0 || tl > 1.2 ? 0 : 1);
    if (tl < 0) return;
    for (const [c, d, R] of [[a, 0, 260], [b, 0.16, 360]]) {
      const p = seg(tl, d, d + 0.75);
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 20 + R * ease.outQuint(p)); c.setAttribute('opacity', (1 - p) * (p > 0 ? 1 : 0));
    }
    g.setAttribute('cx', x); g.setAttribute('cy', y); g.setAttribute('r', 150); g.setAttribute('opacity', Math.max(0, 1 - seg(tl, 0.05, 0.6)) * (tl > 0 ? 0.8 : 0));
  };
}

// Variantennamen unter den Flaschen
export function vlabels(names, colors, textColors = null) {
  const es = names.map((n, i) => el(`<div class="abs vlabel">${n}<i style="background:${colors[i]}"></i></div>`, { color: textColors ? textColors[i] : C.tinte }));
  return (pos, tl) => es.forEach((e, i) => {
    const p = ease.outQuint(seg(tl, 0.25 + i * 0.09, 0.85 + i * 0.09));
    show(e, tl < 0 ? 0 : p);
    if (pos[i]) { e.style.left = pos[i][0] + 'px'; e.style.top = (pos[i][1] + (1 - p) * 30) + 'px'; }
  });
}

// Filmkorn + Vignette
export function grain({ amount = 0.065, vig = 'rgba(20,12,4,.32)' } = {}) {
  const c = document.createElement('canvas'); c.width = 540; c.height = 960;
  Object.assign(c.style, { position: 'absolute', inset: '0', width: '1080px', height: '1920px', mixBlendMode: 'overlay', opacity: amount });
  root().appendChild(c);
  const v = el(`<div class="abs" style="inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,${vig} 100%)"></div>`);
  const g = c.getContext('2d'); const img = g.createImageData(540, 960);
  return (frame, vig = 1) => {
    const R = rng(frame * 7919 + 13);
    for (let i = 0; i < img.data.length; i += 4) { const n = R() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = n; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    v.style.opacity = vig;
  };
}

// Endkarte: Gold-Monogramm, Name, Preis, Farben, CTA, Werbung
export function endcard({ name, price, colors, dark = true }) {
  const e = el(`<div class="abs" style="inset:0">
    <div class="abs bg" style="inset:0;background:radial-gradient(ellipse at 50% 42%,#231b12 0%,#0B0A09 70%)"></div>
    <div class="abs goldfl m" style="left:540px;top:236px;width:250px;height:180px;transform:translateX(-50%);-webkit-mask:url(assets/logo_m.png) center/contain no-repeat;mask:url(assets/logo_m.png) center/contain no-repeat"></div>
    <div class="abs goldfl wort" style="left:540px;top:424px;width:230px;height:66px;transform:translateX(-50%);-webkit-mask:url(assets/logo_wort.png) center/contain no-repeat;mask:url(assets/logo_wort.png) center/contain no-repeat"></div>
    <div class="abs endname" style="left:90px;width:900px;top:1112px;color:${C.creme}">${name}</div>
    <div class="abs endprice gold" style="left:90px;width:900px;top:1196px">${price}</div>
    <div class="abs endsub" style="left:90px;width:900px;top:1336px;color:${C.grau}">${colors}</div>
    <div class="abs cta goldfl" style="left:540px;top:1398px;transform:translateX(-50%)">Link im Profil</div>
  </div>`);
  const bg = e.querySelector('.bg'), m = e.querySelector('.m'), w = e.querySelector('.wort');
  const parts = [...e.querySelectorAll('.endname,.endprice,.endsub,.cta')];
  return (tl, bgOp = 0) => {
    show(e, tl < 0 ? 0 : 1);
    if (tl < 0) return;
    bg.style.opacity = bgOp;
    const pm = ease.outQuint(seg(tl, 0.0, 0.5));
    m.style.opacity = pm; m.style.transform = `translateX(-50%) scale(${0.85 + 0.15 * pm})`;
    m.style.backgroundPosition = `${lerp(110, -10, seg(tl, 0.15, 1.1))}% 0`;
    const pw = ease.outQuint(seg(tl, 0.18, 0.6));
    w.style.opacity = pw; w.style.transform = `translateX(-50%) translateY(${(1 - pw) * 20}px)`;
    w.style.backgroundPosition = `${lerp(110, -10, seg(tl, 0.3, 1.2))}% 0`;
    parts.forEach((p, i) => {
      const q = ease.outQuint(seg(tl, 0.3 + i * 0.08, 0.8 + i * 0.08));
      p.style.opacity = q; const base = p.classList.contains('cta') ? 'translateX(-50%) ' : '';
      p.style.transform = base + `translateY(${(1 - q) * 36}px)`;
      if (p.classList.contains('gold') || p.classList.contains('goldfl')) p.style.backgroundPosition = `${lerp(100, 0, seg(tl, 0.5 + i * 0.1, 1.6))}% 0`;
    });
  };
}
