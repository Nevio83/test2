// Maios CGI – Story-Baukasten im Stil von @mehr.optic (Analyse: Marketing/cgi/vorbilder.md, Skill maios-story-stil).
// DOM-Bausteine ueber dem WebGL-Bild: Untertitel (Karaoke, fette Kursiv-Grossbuchstaben), Tag-Pille, Callouts mit Fuehrungslinie,
// Neon-Zahl, Haken/Kreuz-Marken. Alles zustandslos: pro Bild werden nur Sichtbarkeit und Position gesetzt.
import { clamp, lerp, seg, ease } from './core.js';

export const STORY_CSS = `
.sub{position:absolute;left:40px;width:1000px;text-align:center;font:800 italic 74px Manrope;line-height:1.06;letter-spacing:-.005em;text-transform:uppercase;
  color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 28px rgba(0,0,0,.55)}
.sub .dim{color:rgba(255,255,255,.42)}
.tag{position:absolute;left:0;width:1080px;text-align:center}
.tag span{display:inline-block;font:800 30px Manrope;letter-spacing:.06em;text-transform:uppercase;color:#10131c;background:#fff;border-radius:999px;padding:10px 26px 9px;
  box-shadow:0 0 0 3px rgba(0,0,0,.35),0 8px 22px rgba(0,0,0,.35)}
.tag span.gold{background:#ffcf5c}
.co{position:absolute;font:800 28px Manrope;letter-spacing:.07em;text-transform:uppercase;color:#fff;background:rgba(8,16,40,.72);border:2px solid rgba(255,255,255,.85);
  border-radius:999px;padding:9px 22px 8px;white-space:nowrap}
.neon{position:absolute;left:0;width:1080px;text-align:center;font:800 italic 190px Manrope;color:#ffe9fb;letter-spacing:-.02em;
  text-shadow:0 0 12px #ff5ac8,0 0 34px #ff2fb4,0 0 80px #c21cff}
.mark{position:absolute;width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:800 54px Manrope;color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.45)}
.mark.no{background:#e23d4d}.mark.ok{background:#27b36a}
svg.leader{position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none;overflow:visible}
`;

export function makeKit(ov) {
  const add = (el) => { ov.appendChild(el); return el; };
  const div = (cls, html = '', top = null) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; return add(d); };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'leader'); ov.appendChild(svg);
  const sub = div('sub', '', 1350);
  const tag = div('tag', '<span></span>', 300);
  const neon = div('neon', '', 360);
  const cos = []; const marks = [];
  // Untertitel: words = [..], n = Zahl der weissen Woerter (Rest gedimmt), tl = Zeit seit Einblendung
  function subtitle(words, n, tl, out = 0) {
    if (tl < 0) { sub.style.opacity = 0; return; }
    sub.innerHTML = words.map((w, i) => `<span class="${i < n ? '' : 'dim'}">${w}</span>`).join(' ');
    sub.style.opacity = clamp(tl / 0.1) * (1 - out); sub.style.transform = `translateY(${lerp(16, 0, ease.out(seg(tl, 0, 0.25)))}px)`;
  }
  function tagPill(text, tl, gold = false, out = 0, top = 300) {
    if (tl < 0 || !text) { tag.style.opacity = 0; return; }
    const s = tag.firstChild; s.textContent = text; s.className = gold ? 'gold' : ''; tag.style.top = top + 'px';
    tag.style.opacity = clamp(tl / 0.1) * (1 - out); tag.style.transform = `scale(${lerp(0.9, 1, ease.out(seg(tl, 0, 0.25)))})`;
  }
  function callout(i, text, tl, from, to, out = 0) {   // from: Ankerpunkt (Pixel), to: Position der Pille (Pixel)
    if (!cos[i]) { const el = div('co', text); const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.setAttribute('stroke', 'rgba(255,255,255,.85)'); ln.setAttribute('stroke-width', '3'); ln.setAttribute('stroke-dasharray', '2 9'); ln.setAttribute('stroke-linecap', 'round'); svg.appendChild(ln); const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '7'); dot.setAttribute('fill', '#fff'); svg.appendChild(dot); cos[i] = { el, ln, dot }; }
    const c = cos[i]; const o = tl < 0 ? 0 : clamp(tl / 0.15) * (1 - out);
    c.el.innerHTML = text; c.el.style.opacity = o; c.ln.style.opacity = o; c.dot.style.opacity = o;
    const k = ease.out(seg(tl, 0, 0.4));
    c.el.style.left = (to[0] - c.el.offsetWidth / 2) + 'px'; c.el.style.top = (to[1] - 24) + 'px';
    c.ln.setAttribute('x1', to[0]); c.ln.setAttribute('y1', to[1]); c.ln.setAttribute('x2', lerp(to[0], from[0], k)); c.ln.setAttribute('y2', lerp(to[1], from[1], k));
    c.dot.setAttribute('cx', lerp(to[0], from[0], k)); c.dot.setAttribute('cy', lerp(to[1], from[1], k));
  }
  function mark(i, kind, tl, x, y, out = 0) {
    if (!marks[i]) marks[i] = div('mark ' + kind, kind === 'no' ? '✕' : '✓');
    const m = marks[i]; if (tl < 0) { m.style.opacity = 0; return; }
    m.style.opacity = clamp(tl / 0.08) * (1 - out); m.style.left = (x - 42) + 'px'; m.style.top = (y - 42) + 'px';
    m.style.transform = `scale(${lerp(0.4, 1, ease.outBack(seg(tl, 0, 0.3)))})`;
  }
  function neonNum(text, tl, out = 0, top = 360) {
    if (tl < 0) { neon.style.opacity = 0; return; }
    neon.innerHTML = text; neon.style.top = top + 'px'; neon.style.opacity = clamp(tl / 0.1) * (1 - out) * (0.92 + 0.08 * Math.sin(tl * 40));
    neon.style.transform = `scale(${lerp(0.92, 1, ease.out(seg(tl, 0, 0.3)))})`;
  }
  function hideAll() { for (const el of ov.querySelectorAll('.sub,.tag,.neon,.co,.mark')) el.style.opacity = 0; for (const c of cos) if (c) { c.ln.style.opacity = 0; c.dot.style.opacity = 0; } }
  return { subtitle, tagPill, callout, mark, neonNum, hideAll };
}
