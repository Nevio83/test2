// Maios CGI – Wasserspender "Gruselig einfach" (Trend: Halloween-Reveal / Ramalama-Format ohne Song), Tiefe, 13 s
// Ablauf: kurz Glas voll (Hook) -> dunkle Bodenfahrt mit Nebel -> Reveal auf dem Trommelschlag -> Knopf mit Ripple ->
//         Strahl -> Tropfen in Zeitlupe -> Fan-Wipe von Weiss zu Schwarz -> Endkarte
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makeTiefe, TIEFE } from '../lib/tiefe.js';
import { makeWsSzene } from '../lib/ws_szene.js';

const style = document.createElement('style'); style.textContent = BR.CSS; document.head.appendChild(style);
for (const f of ['300 40px Manrope', '500 40px Manrope', '700 40px Manrope', '40px Marcellus']) await document.fonts.load(f);
await document.fonts.load('700 40px Manrope', 'ß€·');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(26, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
const S = makeWsSzene(scene, cam);
const { W, SW, csW, csS, G, G2, J } = S;
const rim2 = new THREE.PointLight('#cfeeff', 0, 14, 2); rim2.position.set(-3.2, 3.0, -2.6); scene.add(rim2);

// ---------- Bodennebel: weiche Schwaden (Sprites), langsam treibend ----------
const fogTex = canvasTex(256, 256, (g, w, h) => {
  const R = rng(4);
  for (let i = 0; i < 30; i++) { const x = w * (0.22 + R() * 0.56), y = h * (0.5 + R() * 0.28), rr = w * (0.08 + R() * 0.14);
    const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  // Raender weich auf 0 ziehen (waagrecht und senkrecht), sonst zeichnen Sprite-Kanten und die Schnittlinie mit dem Boden Streifen
  g.globalCompositeOperation = 'destination-in';
  const mx = g.createLinearGradient(0, 0, w, 0); mx.addColorStop(0, 'rgba(0,0,0,0)'); mx.addColorStop(0.25, 'rgba(0,0,0,1)'); mx.addColorStop(0.75, 'rgba(0,0,0,1)'); mx.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mx; g.fillRect(0, 0, w, h);
  const my = g.createLinearGradient(0, 0, 0, h); my.addColorStop(0, 'rgba(0,0,0,0)'); my.addColorStop(0.35, 'rgba(0,0,0,1)'); my.addColorStop(0.8, 'rgba(0,0,0,1)'); my.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = my; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
});
const FR = rng(17);
// Schwaden stehen mit der Unterkante auf dem Boden und nie im Spender (keine Schnittkanten)
const fog = []; while (fog.length < 18) {
  // Sprites stehen etwa quer zur Blickrichtung: nur hinter der Flasche oder vor dem Spender, nie auf ihrer Hoehe
  const x = (FR() - 0.5) * 7, z = FR() < 0.35 ? -3.2 + FR() * 0.45 : 0.7 + FR() * 1.9, size = 2.4 + FR() * 2.4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fogTex, color: new THREE.Color('#a9cdd6'), transparent: true, depthWrite: false, opacity: 0 }));
  s.renderOrder = 15; scene.add(s); fog.push({ s, x, z, y: size * 0.15 - 0.04, size, v: 0.05 + FR() * 0.1, ph: FR() * 6 });
}
function fogOn(I, t, col = '#4f7580') { fog.forEach((f) => { f.s.visible = I > 0.001; f.s.material.color.set(col); f.s.material.opacity = I * (0.55 + 0.45 * Math.sin(t * 0.7 + f.ph)); f.s.position.set(f.x + Math.sin(t * 0.3 + f.ph) * 0.4 + t * f.v, f.y, f.z); f.s.scale.set(f.size * 1.7, f.size * 0.3, 1); }); }

// ---------- Overlay ----------
const CR = BR.C.creme;
const O = {
  pillA: BR.pill('Werbung', { x: 84, y: 208, dark: true }),
  head1: BR.headline([[{ t: 'Wasser' }, { t: 'auf' }], [{ t: 'Knopfdruck.', gold: true }]], { y: 262, size: 112, color: CR }),
  head2: BR.headline([[{ t: 'Gruselig' }], [{ t: 'einfach.', gold: true }]], { y: 250, size: 120, color: CR }),
  hW: BR.headline([[{ t: 'In' }, { t: 'Weiß.', gold: true }]], { y: 250, size: 116, color: CR }),
  hS: BR.headline([[{ t: 'In' }, { t: 'Schwarz.', gold: true }]], { y: 250, size: 116, color: BR.C.tinte, goldClass: 'goldd' }),
  seal: BR.seal({ x: 690, y: 214, size: 226 }),
  ripple: BR.ripple(),
  end: BR.endcard({ name: 'Wasserspender <b>Schreibtisch</b>', price: '38,99&nbsp;€', colors: 'Weiß · Schwarz' }),
  pillE: BR.pill('Werbung', { y: 172, dark: true, center: true }),
  streak: BR.streak(), flash: BR.flash(), grain: BR.grain({ amount: 0.06, vig: 'rgba(0,12,16,.42)' }),
};
// Ventilatorfluegel (Fan-Wipe): dunkles, unscharfes Blatt, das um einen Punkt unten links durchs Bild dreht
const PIV = [-200, 2400];
const bladeDeg = (p) => lerp(-35, 85, p);
// Maske fuer das alte Bild: der Halbkreis vor dem Fluegel (im Uhrzeigersinn)
const sector = (deg) => { const pts = [PIV]; for (let k = 0; k <= 6; k++) { const a = (deg + k * 30) * Math.PI / 180; pts.push([PIV[0] + 7000 * Math.sin(a), PIV[1] - 7000 * Math.cos(a)]); }
  return `polygon(${pts.map((q) => `${q[0].toFixed(1)}px ${q[1].toFixed(1)}px`).join(',')})`; };
const oldCv = document.createElement('canvas'); oldCv.width = 1080; oldCv.height = 1920; oldCv.className = 'abs';
Object.assign(oldCv.style, { left: '0', top: '0', visibility: 'hidden' });
document.getElementById('stage').appendChild(oldCv); const oldCtx = oldCv.getContext('2d');
const blade = (() => {
  const d = document.createElement('div'); d.className = 'abs';
  Object.assign(d.style, { left: `${PIV[0]}px`, top: `${PIV[1]}px`, width: '0', height: '0' });
  d.innerHTML = `<svg width="760" height="2900" viewBox="0 0 760 2700" preserveAspectRatio="none" style="position:absolute;left:-380px;top:-2900px;filter:blur(14px)">
    <defs><linearGradient id="bl" x1="0" x2="1"><stop offset="0" stop-color="#071216"/><stop offset=".5" stop-color="#10242b"/><stop offset="1" stop-color="#05090b"/></linearGradient></defs>
    <path d="M300 2700 C 120 2000, 40 900, 200 260 C 300 0, 520 0, 600 300 C 720 900, 640 2000, 460 2700 Z" fill="url(#bl)"/></svg>`;
  document.getElementById('ov').appendChild(d);
  return (p) => { d.style.visibility = p > 0 && p < 1 ? 'visible' : 'hidden'; d.style.transform = `rotate(${bladeDeg(p)}deg)`; };
})();
const stageCanvas = r.domElement;

const SHOTS = [
  [0, 0.75, 'teaser'], [0.75, 2.75, 'anlauf'], [2.75, 3.25, 'reveal'], [3.25, 5.0, 'knopf'], [5.0, 7.0, 'strahl'],
  [7.0, 9.0, 'tropfen'], [9.0, 11.0, 'fan'], [11.0, 13.0, 'ende'],
];
export const DAUER = 13.0;
const HIT = 2.75, PRESS = 3.5, WATER0 = 3.72, WATER1 = 8.8, SWAP = 9.95, WIPE0 = 9.78, WIPE1 = 10.12;

function nacht(t, I = 1) {
  T.mood(0); T.U.uC0.value.set('#08242c'); T.U.uC1.value.set('#010608');
  T.fill.intensity = 0.04; scene.environmentIntensity = 0.18; T.key.intensity = 0.0;
  T.rim.position.set(3.0, 2.6, -3.2); T.rim.intensity = 18 * I; rim2.intensity = 9 * I;
}

function fanSetup(black, sp) {
  const D = black ? SW : W, cs = black ? csS : csW, gl = black ? G2 : G;
  S.placeDisp(D, cs, 0, 0, lerp(-1.2, 0.9, sp)); S.glassOn(D, gl); S.setWater(gl, 1.0);
  lens(26); aim(cam, vlerp(v3(0, 1.6, 13.6), v3(0, 1.5, 12.8), ease.out(sp)), v3(0, 1.22, -0.4));
  if (black) { T.U.uSplit.value = 0.0001; T.U.uS0.value.set(TIEFE.hell); T.U.uS1.value.set(TIEFE.hell); T.floor.material.opacity = 0.3; }
  else { T.U.uS0.value.set('#0d3a46'); T.U.uS1.value.set(TIEFE.hell); T.haloAt(S.glassMid(gl, 0.6), 0.2, 0.85); }
}

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  S.hideAll(); fogOn(0, t); rim2.intensity = 0; stageCanvas.style.filter = ''; T.floor.visible = true; oldCv.style.visibility = 'hidden';
  T.U.uTime.value = t; S.cauU.uTime.value = t; T.mood(1); T.rim.position.set(2.8, 3.6, -3.2);

  if (name === 'teaser') {
    S.placeDisp(W, csW, 0, 0, -0.35); S.glassOn(W, G); S.water(t, -1.6, 0.72, G, W, 1.02); S.ledOn(W, 3.5);
    lens(26); aim(cam, vlerp(v3(-1.3, 1.95, 12.6), v3(-1.2, 1.88, 11.9), ease.out(sp)), v3(0, 1.42, -0.45));
    T.haloAt(S.glassMid(G, 0.6), 0.24, 1.0); T.U.uCaust.value = 0.12; S.causticsAt(0, -0.4, 0.55);
  } else if (name === 'anlauf') {
    nacht(t);
    S.placeDisp(W, csW, 0, 0, -0.35); S.glassOn(W, G); S.setWater(G, 0.0);
    J.group.visible = true; J.group.position.set(2.5, 0, -1.9); J.cap.visible = false; S.tubeAt(1.3).mesh.visible = true;
    const p = ease.inOut(sp);
    lens(26); aim(cam, vlerp(v3(0.9, 0.32, 10.5), v3(0.55, 0.36, 6.3), p), vlerp(v3(0.3, 0.55, 0), v3(0.25, 0.75, -0.3), p));
    fogOn(0.42, t, '#5f8a95'); T.haloAt(v3(0.2, 0.75, -1.0), 0.3, 0.24);
  } else if (name === 'reveal') {
    const on = ease.out(seg(t, HIT, HIT + 0.08));
    T.mood(on);
    S.placeDisp(W, csW, 0, 0, -0.35); S.glassOn(W, G); S.setWater(G, 0.0);
    J.group.visible = true; J.group.position.set(2.5, 0, -1.9); J.cap.visible = false; S.tubeAt(1.3).mesh.visible = true;
    lens(26); aim(cam, vlerp(v3(1.4, 1.7, 15.6), v3(1.35, 1.72, 15.0), ease.out(sp)), v3(1.05, 1.35, -0.9));
    fogOn(lerp(0.3, 0.05, seg(t, HIT, HIT + 0.45)), t, on > 0.5 ? '#9fc4cc' : '#5f8a95'); T.haloAt(v3(1.0, 1.3, -0.9), 0.3, 0.75 * on);
  } else if (name === 'knopf') {
    S.placeDisp(W, csW, 0, 0, -0.6); S.glassOn(W, G); S.water(t, WATER0, WATER1);
    const press = seg(t, PRESS - 0.04, PRESS) * (1 - seg(t, PRESS + 0.14, PRESS + 0.24));
    W.buttons[0].position.y = 0.4 - 0.012 * press;
    if (t > PRESS) S.ledOn(W, 3.2, true, t);
    lens(26); aim(cam, vlerp(v3(-1.45, 2.05, 3.45), v3(-1.3, 1.9, 3.15), ease.out(sp)), v3(-0.6, 0.62, 0.57));
    T.haloAt(W.group.localToWorld(v3(-0.25, 0.42, 0.87)), 0.12, t > PRESS ? 0.5 : 0.0);
  } else if (name === 'strahl') {
    S.placeDisp(W, csW, 0, 0, -0.35); S.glassOn(W, G); S.water(t, WATER0, WATER1); S.ledOn(W, 3.5);
    lens(26); aim(cam, vlerp(v3(1.5, 2.6, 3.4), v3(1.3, 2.45, 3.0), ease.out(sp)), v3(0, 1.95, -0.45));
    T.haloAt(v3(G.group.position.x, 1.6, G.group.position.z), 0.2, 0.9); T.U.uCaust.value = 0.1;
  } else if (name === 'tropfen') {
    // Zeitlupe: Strahl und Tropfen laufen mit einem Viertel der Geschwindigkeit
    const ts = 7.0 + (t - 7.0) * 0.25;
    S.placeDisp(W, csW, 0, 0, -0.35); S.glassOn(W, G); S.water(ts, WATER0, WATER1, G, W, 1.02, 0.25); S.ledOn(W, 3.5);
    lens(26); aim(cam, vlerp(v3(-1.05, 1.62, 3.3), v3(-0.95, 1.55, 2.9), ease.out(sp)), v3(0, 1.08, -0.45));
    T.haloAt(S.glassMid(G, 0.55), 0.22, 1.0); T.U.uCaust.value = 0.12;
  } else if (name === 'fan') {
    const wp = seg(t, WIPE0, WIPE1);
    if (wp > 0 && wp < 1) {
      // Fan-Wipe: erst das alte Bild (Weiss auf Tiefe) rendern und merken, dann das neue; das alte bleibt nur dort stehen,
      // wo der Fluegel noch nicht vorbei ist
      fanSetup(false, sp); scene.updateMatrixWorld(true); r.render(scene, cam);
      oldCtx.clearRect(0, 0, 1080, 1920); oldCtx.drawImage(r.domElement, 0, 0);
      S.hideAll(); T.mood(1); T.U.uTime.value = t; S.cauU.uTime.value = t; T.rim.position.set(2.8, 3.6, -3.2);
      fanSetup(true, sp);
      oldCv.style.visibility = 'visible'; oldCv.style.clipPath = sector(bladeDeg(wp));
    } else fanSetup(wp >= 1, sp);
  } else if (name === 'ende') {
    T.U.uS0.value.set('#0d3a46');
    S.placeDisp(W, csW, 0, 0, lerp(-0.9, 0.3, sp)); S.glassOn(W, G); S.setWater(G, 1.02);
    lens(26); aim(cam, vlerp(v3(0, 1.4, 22.5), v3(0, 1.3, 21.4), ease.out(sp)), v3(0, 0.5, -0.4));
    T.haloAt(v3(0, 1.0, -0.5), 0.2, 0.8); T.U.uCaust.value = 0.05; S.causticsAt(0, -0.3, 0.4);
    T.rim.position.set(2.6, 3.4, -2.8);
  }
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  O.pillA(t < HIT ? 1 - seg(t, HIT - 0.12, HIT) : 0);
  O.head1(t < 0.75 ? t - 0.02 : -1, seg(t, 0.64, 0.75));
  O.head2(t >= 3.55 && t < 5.0 ? t - 3.55 : -1, seg(t, 4.86, 5.0));
  O.hW(t >= 9.03 && t < SWAP ? t - 9.03 : -1, seg(t, 9.86, SWAP));
  O.hS(t >= SWAP + 0.05 && t < 11.0 ? t - SWAP - 0.05 : -1, seg(t, 10.88, 11.0));
  O.seal(t >= 10.1 && t < 11 ? t - 10.1 : -1, seg(t, 10.88, 11.0));
  if (name === 'knopf') { const p = S.screen(W.buttons[0], v3(0, 0.02, 0)); O.ripple(p[0], p[1], t - PRESS); } else O.ripple(0, 0, -1);
  blade(seg(t, WIPE0, WIPE1));
  O.end(t >= 11 ? t - 11 : -1, 0);
  O.pillE(t >= 11 ? ease.out(seg(t, 11.05, 11.35)) : 0);
  O.streak(t > 10.8 && t < 11.2 ? seg(t, 10.84, 11.16) : 0);
  O.flash(t >= HIT && t < HIT + 0.22 ? 0.75 * (1 - seg(t, HIT, HIT + 0.22)) : 0);
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
