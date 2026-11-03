// Maios CGI – 350ml Mixer Entsafter (Produkt 11) – 14 s, 120 BPM (Schnitte auf 0,5-s-Raster)
import * as THREE from 'three';
import { makeRenderer, backdrop, contactShadow, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as M from '../lib/mixer_models.js';
import * as BR from '../lib/brand.js';
// Hook-Fassung ueber window.HOOK: Standard = "Mixer und Becher in einem." (23.10.), 'a' = Nachricht "Ich hab dich mixen sehen. –A" (Trend "Text von A", 26.10.)
const HOOK = (window.HOOK || '');

const style = document.createElement('style'); style.textContent = BR.CSS; document.head.appendChild(style);
for (const f of ['300 40px Manrope', '500 40px Manrope', '700 40px Manrope', '40px Marcellus']) await document.fonts.load(f);
await document.fonts.load('700 40px Manrope', 'ß€·');

// ---------- Renderer, Licht, Umgebung ----------
const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(26, 1080 / 1920, 0.05, 80);

function stripEnv({ bg, strips, top }) {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  const room = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: bg, side: THREE.BackSide })); s.add(room);
  const add = (w, h, pos, look, col, I) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), side: THREE.DoubleSide }));
    m.position.copy(pos); m.lookAt(look); s.add(m);
  };
  for (const st of strips) add(st.w, st.h, st.pos, v3(0, 0, 0), st.col, st.I);
  if (top) add(top.w, top.h, v3(0, 5.8, 0), v3(0, 0, 0), top.col, top.I);
  const pm = new THREE.PMREMGenerator(r); const tex = pm.fromScene(s, 0.02).texture; pm.dispose(); return tex;
}
const ENV = {
  nacht: stripEnv({ bg: '#0a0806', strips: [
    { w: 1.1, h: 9, pos: v3(-5.5, 0, 1.6), col: '#fff0dc', I: 6 },
    { w: 1.1, h: 9, pos: v3(5.5, 0, 0.6), col: '#fff3e2', I: 5 },
    { w: 3.0, h: 9, pos: v3(0, 0, -5.8), col: '#e8e2d8', I: 1.0 },
    { w: 2.2, h: 9, pos: v3(-2, 0, 5.8), col: '#fff1d6', I: 1.2 },
  ], top: { w: 4, h: 4, col: '#fff0d8', I: 2.5 } }),
  papier: stripEnv({ bg: '#d9cbb3', strips: [
    { w: 1.4, h: 9, pos: v3(-5.5, 0, 2.2), col: '#ffffff', I: 4.5 },
    { w: 1.4, h: 9, pos: v3(5.5, 0, 1.0), col: '#fff8ee', I: 3.8 },
    { w: 4.0, h: 9, pos: v3(0, 0, 5.8), col: '#f6efe2', I: 1.6 },
    { w: 3.0, h: 9, pos: v3(0, 0, -5.8), col: '#efe3cc', I: 1.2 },
  ], top: { w: 5, h: 5, col: '#ffffff', I: 3 } }),
};
const halo = (cx, cy, rr = 0.5) => canvasTex(540, 960, (g, w, h) => { g.fillStyle = '#060504'; g.fillRect(0, 0, w, h); let gr = g.createRadialGradient(w * cx, h * cy, 5, w * cx, h * cy, h * 0.7); gr.addColorStop(0, '#2b2116'); gr.addColorStop(1, '#060504'); g.fillStyle = gr; g.fillRect(0, 0, w, h); gr = g.createRadialGradient(w * cx, h * cy, 2, w * cx, h * cy, w * rr); gr.addColorStop(0, 'rgba(255,226,170,0.85)'); gr.addColorStop(0.35, 'rgba(216,181,108,0.45)'); gr.addColorStop(1, 'rgba(216,181,108,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const BG = { nacht: backdrop('#2b2116', '#060504', 0.5, 0.46), papier: backdrop('#f8f2e7', '#d8c6a8', 0.5, 0.42), halo: halo(0.6, 0.6, 0.55), haloE: halo(0.5, 0.42, 0.5) };

const key = new THREE.DirectionalLight('#fff3e0', 2.4); key.position.set(-3.5, 7, 5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -4, right: 4, top: 6, bottom: -3, near: 0.5, far: 25 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const fill = new THREE.HemisphereLight('#fff8ee', '#a88f6c', 0.5); scene.add(fill);
const kick = new THREE.PointLight('#fff0dc', 0, 14, 2); kick.position.set(2.5, 3.5, -3); scene.add(kick);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.18 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

function mood(m, bg) {
  scene.background = BG[bg || m]; scene.environment = ENV[m];
  if (m === 'nacht') { scene.environmentIntensity = 1.0; key.intensity = 2.0; key.color.set('#fff1de'); fill.intensity = 0.16; kick.intensity = 40; floor.material.opacity = 0.6; }
  else { scene.environmentIntensity = 0.9; key.intensity = 2.5; key.color.set('#fffaf3'); fill.intensity = 0.55; kick.intensity = 0; floor.material.opacity = 0.17; }
  return m;
}

// ---------- Objekte ----------
const mats = M.makeMaterials();
function makeSet(farbe, liquidOpts) {
  const B = M.makeBottle(farbe, mats), S = M.makeBase(farbe, mats);
  const rig = new THREE.Group(); rig.add(B.group); scene.add(rig);
  B.group.add(S.group);
  const lm = M.makeLiquidMaterial(liquidOpts); const liq = new THREE.Mesh(new THREE.BufferGeometry(), lm); B.group.add(liq);
  const cs = contactShadow(1.9, 0.5); scene.add(cs);
  return { B, S, rig, liq, lm, cs, farbe };
}
const A = makeSet('rosa');                                                     // Hauptflasche
const VW = makeSet('weiss', { smoothie: '#f4a63f', light: '#fbd593', deep: '#e1801b' }); // Mango
const VB = makeSet('blau', { smoothie: '#efdba0', light: '#f8edcc', deep: '#d8b45a' });  // Banane
for (const s of [VW, VB]) { s.lm.userData.u.uMix.value = 1; s.liq.geometry = M.liquidGeometry(1.02, 2.36, 'oben'); s.lm.userData.u.uTop.value = 2.36; s.lm.userData.u.uBottom.value = 1.02; }

// Obst
const kit = M.makeFruitKit();
const R = rng(42);
const pieces = [];
for (let i = 0; i < 7; i++) pieces.push({ m: kit.erdbeere(), r: 0.17, typ: 'e' });
for (let i = 0; i < 5; i++) pieces.push({ m: kit.banane(), r: 0.19, typ: 'b' });
M.pack(pieces, 1.06, 2.78, 7, +1, 'kopf');                                       // kopfueber: Erdbeeren tief im Hals
M.pack([...pieces.filter((p) => p.typ === 'b'), ...pieces.filter((p) => p.typ === 'e')], 1.06, 2.32, 9, -1, 'auf'); // aufrecht
pieces.forEach((p, i) => {
  A.B.group.add(p.m); p.m.traverse((o) => { o.castShadow = false; });
  p.q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6));
  p.q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6));
  p.q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6));
  p.start = new THREE.Vector3(p.kopf.x * 0.35 + (R() - 0.5) * 0.2, -2.3 - R() * 0.8, p.kopf.z * 0.35 + (R() - 0.5) * 0.2);
  p.spin = (R() - 0.5) * 2; p.ph = R() * 6.28; p.rad = Math.hypot(p.auf.x, p.auf.z); p.ang = Math.atan2(p.auf.z, p.auf.x);
});
// Abwurfzeiten: Erdbeeren in S2, Bananen in S3 (Zeitlupe)
let ie = 0, ib = 0;
pieces.forEach((p) => { if (p.typ === 'e') { p.td = 1.52 + ie * 0.085; p.fall = 0.32; ie++; } else { p.td = 2.5 + ib * 0.14; p.fall = 0.62; ib++; } });

// Milchstrahl
const milkMat = new THREE.MeshPhysicalMaterial({ color: '#f7f2e9', roughness: 0.22, sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), clearcoat: 0.3 });
const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.062, 1, 24, 8, true), milkMat); A.B.group.add(stream);
const drops = []; for (let i = 0; i < 10; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.018 + R() * 0.018, 12, 8), milkMat); A.B.group.add(d); drops.push({ m: d, a: R() * 6.28, v: 0.6 + R() * 0.8, t0: R() }); }
// Goldfaden (Tragen an der Schlaufe)
const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 12), new THREE.MeshStandardMaterial({ color: '#d8b56c', metalness: 1, roughness: 0.25 })); scene.add(thread);

// ---------- Overlay ----------
const O = {
  pillA: BR.pill('Werbung', { x: 84, y: 208, dark: true }),
  head1: BR.headline([[{ t: 'Mixer' }, { t: 'und' }, { t: 'Becher' }], [{ t: 'in', gold: true }, { t: 'einem.', gold: true }]], { y: 262, size: 104, width: 860 }),
  corners: BR.corners({ x0: 64, y0: 200, x1: 912, y1: 1490 }),
  step: BR.step({ y: 228 }),
  head2: BR.headline([[{ t: 'Fertig' }, { t: 'gemixt.', gold: true }]], { y: 250, size: 122, color: BR.C.tinte, goldClass: 'goldd' }),
  head3: BR.headline([[{ t: 'Für' }], [{ t: 'unterwegs.', gold: true }]], { x: 79, y: 250, size: 116, color: BR.C.tinte, goldClass: 'goldd', width: 850, align: 'right' }),
  head4: BR.headline([[{ t: 'In' }, { t: 'drei' }], [{ t: 'Farben.', gold: true }]], { y: 236, size: 112, color: BR.C.tinte, goldClass: 'goldd' }),
  seal: BR.seal({ x: 676, y: 214, size: 240 }),
  vl: BR.vlabels(['Weiß', 'Rosa', 'Blau'], ['#e9e5de', '#F1A3B3', '#8CC8E6']),
  ripple: BR.ripple(),
  end: BR.endcard({ name: 'Mixer Entsafter <b>350 ml</b>', price: '40,99&nbsp;€', colors: 'Weiß · Rosa · Blau' }),
  pillE: BR.pill('Werbung', { y: 172, dark: true, center: true }),
  streak: BR.streak(),
  flash: BR.flash(),
  grain: BR.grain({ amount: 0.07 }),
};
// Nachrichtenblase im Stil "Text von A"
const bubble = (() => {
  const d = document.createElement('div'); d.className = 'abs';
  Object.assign(d.style, { left: '84px', top: '216px', width: '700px' });
  d.innerHTML = `<div style="font:700 28px/52px Manrope;letter-spacing:.26em;text-transform:uppercase;color:#E9CD8C;margin:0 0 26px 278px;height:52px">1 neue Nachricht</div>
    <div style="background:rgba(245,240,230,.94);color:#13100B;border-radius:40px 40px 40px 10px;padding:26px 40px 24px;box-shadow:0 18px 50px rgba(0,0,0,.45)">
      <div style="font:600 60px/1.12 Manrope;letter-spacing:-.01em">Ich hab dich mixen<br>sehen. <span style="font:62px Marcellus,serif;color:#8a6626;margin-left:10px">–A</span></div></div>`;
  document.getElementById('ov').appendChild(d);
  const kick = d.firstElementChild, b = d.lastElementChild, sig = b.querySelector('span');
  return (tl, out = 0) => {
    d.style.visibility = tl < 0 ? 'hidden' : 'visible'; if (tl < 0) return;
    const pk = ease.outQuint(seg(tl, 0, 0.3)), pb = ease.outBack(seg(tl, 0.08, 0.42)), ps = ease.outQuint(seg(tl, 0.55, 0.8));
    kick.style.opacity = pk; b.style.opacity = clamp(pb * 1.4); b.style.transform = `scale(${0.6 + 0.4 * pb})`; b.style.transformOrigin = '0% 100%';
    sig.style.opacity = ps; sig.style.display = 'inline-block'; sig.style.transform = `translateX(${(1 - ps) * 30}px)`;
    d.style.opacity = 1 - out; d.style.transform = `translateY(${-out * 40}px)`;
  };
})();
const stageCanvas = r.domElement;

// ---------- Zustaende ----------
const GOLD_TOP = M.GLAS_TOP - 0.02 + 0.262;   // Unterkante Deckel bei Kopfstand
const FLIP0 = 5.78, FLIP1 = 6.2, FLIPMID = (FLIP0 + FLIP1) / 2;
const MILK0 = 3.62, MILK1 = 4.6, BLEND0 = 7.28, BLEND1 = 9.0;

function contents(t, set = A) {
  const u = set.lm.userData.u; u.uTime.value = t;
  const upright = t >= FLIPMID;
  stream.visible = false; drops.forEach((d) => (d.m.visible = false));
  if (!upright) {
    // kopfueber
    pieces.forEach((p) => {
      const lt = t - p.td;
      if (lt < 0) { p.m.visible = false; return; }
      p.m.visible = true;
      const f = clamp(lt / p.fall), g = f * f;
      const pos = vlerp(p.start, p.kopf, g);
      const b = lt > p.fall ? Math.exp(-(lt - p.fall) * 9) * Math.sin((lt - p.fall) * 34) * 0.06 : 0;
      pos.y -= b;
      p.m.position.copy(pos);
      p.m.quaternion.slerpQuaternions(p.q0, p.q1, ease.out(clamp(lt / (p.fall + 0.25))));
      p.m.scale.setScalar(1);
    });
    const lvl = lerp(2.84, 1.24, ease.inOut(seg(t, MILK0, MILK1)));
    if (t > MILK0) {
      set.liq.visible = true; u.uMix.value = 0; u.uSwirl.value = 0; u.uTop.value = 2.84; u.uBottom.value = lvl;
      set.liq.geometry.dispose(); set.liq.geometry = M.liquidGeometry(lvl, 2.84, 'unten', 0, t < MILK1 + 0.3 ? 1 : 0, t);
    } else set.liq.visible = false;
    // Strahl
    const s0 = MILK0 - 0.1, s1 = MILK1 + 0.05;
    if (t > s0 && t < s1 + 0.25) {
      const top = -4.5 + Math.max(0, (t - s1)) * 22;          // Strahl reisst oben ab
      const bot = Math.min(lvl, -4.5 + (t - s0) * 26);         // Strahl faellt
      if (bot > top) {
        stream.visible = true; stream.position.set(0.06, (top + bot) / 2, 0.02); stream.scale.set(1 + 0.08 * Math.sin(t * 40), bot - top, 1);
      }
      if (t > MILK0 + 0.05 && t < s1 + 0.15) drops.forEach((d, i) => {
        const lt = ((t * 1.7 + d.t0) % 0.45) / 0.45; d.m.visible = true;
        const rr = 0.05 + lt * 0.22 * d.v;
        d.m.position.set(0.06 + Math.cos(d.a) * rr, lvl - Math.sin(lt * Math.PI) * 0.22 * d.v, Math.sin(d.a) * rr);
      });
    }
  } else {
    // aufrecht
    const bp = seg(t, BLEND0, BLEND1); const bl = ease.inOut(bp);
    const spin = bp > 0 && bp < 1.1 ? 1 : 0;
    pieces.forEach((p, i) => {
      p.m.visible = true;
      if (bp <= 0) { p.m.position.copy(p.auf); p.m.quaternion.copy(p.q1); p.m.scale.setScalar(1); return; }
      const w = 2 + 16 * ease.in(seg(t, BLEND0, BLEND0 + 0.5));
      const a = p.ang + (t - BLEND0) * w * (0.9 + 0.2 * Math.sin(p.ph));
      const rw = Math.max(0.05, M.rInner(p.m.position.y || 1.5) - p.r * 0.62); const rr = lerp(p.rad, rw, ease.out(seg(bp, 0, 0.25))) + 0.02 * Math.sin(t * 7 + p.ph);
      const y = lerp(p.auf.y, 1.25 + 0.9 * ((i * 0.37) % 1), ease.out(seg(bp, 0, 0.3))) + 0.12 * Math.sin(t * 9 + p.ph);
      p.m.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
      p.m.quaternion.slerpQuaternions(p.q1, p.q2, (t * 3 + p.ph) % 1);
      p.m.rotateY((t - BLEND0) * 14);
      const sc = 1 - ease.inOut(seg(bp, 0.08 + (i % 5) * 0.06, 0.62 + (i % 4) * 0.05));
      p.m.scale.setScalar(sc); if (sc <= 0.01) p.m.visible = false;
    });
    const vort = 0.32 * Math.sin(Math.PI * clamp(seg(t, BLEND0, BLEND1 + 0.25))) * spin;
    const top = lerp(2.34, 2.4, bl);
    set.liq.visible = true; u.uMix.value = bl; u.uSwirl.value = bp > 0 && bp < 1 ? 1 : 0.0; u.uTop.value = top; u.uBottom.value = 1.02;
    set.liq.geometry.dispose(); set.liq.geometry = M.liquidGeometry(1.02, top, 'oben', vort, bp > 0 && bp < 1 ? 1 : 0, t);
  }
}
function finished(set) { // fertiger Smoothie, kein Obst
  const u = set.lm.userData.u; u.uMix.value = 1; u.uSwirl.value = 0; u.uTop.value = 2.4; u.uBottom.value = 1.02;
  set.liq.visible = true; set.liq.geometry.dispose(); set.liq.geometry = M.liquidGeometry(1.02, 2.4, 'oben');
  if (set === A) { pieces.forEach((p) => (p.m.visible = false)); stream.visible = false; drops.forEach((d) => (d.m.visible = false)); }
}
function rigUpright(set, x = 0, z = 0, ry = 0) {
  set.rig.position.set(x, 0.075, z); set.rig.rotation.set(0, ry, 0); set.rig.visible = true;
  set.S.group.position.set(0, 0, 0); set.S.group.rotation.set(0, 0, 0);
  set.cs.position.set(x, 0.003, z); set.cs.visible = true; set.cs.scale.setScalar(1);
}
function baseIn(t) { // Sockel schraubt sich ein (kopfueber, lokale Koordinaten)
  const d = ease.out(seg(t, 4.8, 5.28));
  const tw = ease.inOut(seg(t, 4.86, 5.52));
  const click = t > 5.52 ? Math.exp(-(t - 5.52) * 20) * Math.sin((t - 5.52) * 60) * 0.012 : 0;
  A.S.group.position.set(0, lerp(-1.9, 0, d) - click, 0);
  A.S.group.rotation.set(0, -Math.PI * 2.5 * (1 - tw), 0);
  A.S.group.visible = t > 4.76;
}
function rigFlip(t) {
  const p = ease.inOutQuint(seg(t, FLIP0, FLIP1));
  const th = Math.PI * (1 + p);                                 // pi -> 2pi
  const c0 = v3(0, GOLD_TOP - 1.55, 0), c1 = v3(0, 0.075 + 1.55, 0);
  const cw = vlerp(c0, c1, p); cw.y += Math.sin(Math.PI * p) * 0.9; cw.x += Math.sin(Math.PI * p) * 0.15;
  A.rig.rotation.set(0, 0, th);
  const off = v3(0, 1.55, 0).applyEuler(new THREE.Euler(0, 0, th));
  A.rig.position.copy(cw.sub(off));
}

const screen = (obj, local) => { const v = obj.localToWorld(local.clone()); v.project(cam); return [(v.x + 1) / 2 * 1080, (1 - v.y) / 2 * 1920]; };

// ---------- Shots ----------
const SHOTS = [
  [0.0, 1.5, 'held'], [1.5, 2.5, 'erdbeeren'], [2.5, 3.5, 'bananen'], [3.5, 4.75, 'milch'], [4.75, 5.75, 'sockel'],
  [5.75, 6.25, 'drehen'], [6.25, 7.25, 'knopf'], [7.25, 8.25, 'mixen1'], [8.25, 9.25, 'mixen2'], [9.25, 10.25, 'tragen'],
  [10.25, 12.0, 'farben'], [12.0, 14.0, 'ende'],
];
export const DAUER = 14.0;

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const lt = t - t0, sp = seg(t, t0, t1);
  // Grundzustand
  for (const s of [A, VW, VB]) { s.rig.visible = false; s.cs.visible = false; }
  thread.visible = false; A.S.group.visible = true; A.B.loopG.rotation.set(0, 0, 0);
  stageCanvas.style.filter = ''; cam.fov = 26;
  let md = 'papier';

  if (name === 'held' || name === 'ende') {
    md = mood('nacht', name === 'held' ? 'halo' : 'haloE'); rigUpright(A, 0, 0, name === 'held' ? lerp(-0.55, -0.25, sp) : lerp(-0.9, 0.5, sp)); finished(A);
    A.cs.material.opacity = 1;
    if (name === 'held') { cam.fov = 26; aim(cam, vlerp(v3(0.7, 0.9, 13.4), v3(0.55, 1.05, 11.9), ease.out(sp)), vlerp(v3(-0.36, 2.0, 0), v3(-0.33, 2.02, 0), sp)); kick.position.set(lerp(3, -3, sp), 3.6, -2.6); }
    else { cam.fov = 26; aim(cam, vlerp(v3(0, 1.2, 24.5), v3(0, 1.1, 23.2), ease.out(sp)), v3(0, 0.62, 0)); kick.position.set(2.6, 3.4, -2.8); }
  } else if (['erdbeeren', 'bananen', 'milch', 'sockel'].includes(name)) {
    md = mood('papier');
    A.rig.visible = true; A.rig.rotation.set(0, 1.5, Math.PI); A.rig.position.set(0, GOLD_TOP, 0);
    A.cs.visible = true; A.cs.position.set(0, 0.003, 0); A.cs.scale.setScalar(0.75);
    contents(t); baseIn(t);
    if (name === 'erdbeeren') { cam.fov = 34; aim(cam, vlerp(v3(0.9, 8.6, 5.2), v3(0.7, 8.2, 4.5), ease.out(sp)), v3(0, 2.55, 0)); }
    if (name === 'bananen') { cam.fov = 30; aim(cam, vlerp(v3(-2.4, 4.9, 8.0), v3(-2.2, 4.7, 7.3), sp), v3(0, 2.25, 0)); }
    if (name === 'milch') { cam.fov = 27; aim(cam, vlerp(v3(2.1, 3.4, 9.8), v3(1.8, 3.2, 8.9), ease.out(sp)), v3(0, 2.45, 0)); }
    if (name === 'sockel') { cam.fov = 30; aim(cam, vlerp(v3(-1.9, 5.4, 9.8), v3(-1.7, 5.2, 9.0), ease.out(sp)), v3(0, 3.0, 0)); }
  } else if (name === 'drehen') {
    md = mood('papier'); A.rig.visible = true; contents(t); A.S.group.position.set(0, 0, 0); A.S.group.rotation.set(0, 0, 0);
    rigFlip(t); A.rig.rotation.y = 1.5 * (1 - ease.inOut(seg(t, FLIP0, FLIP1)));
    A.cs.visible = true; A.cs.position.set(0, 0.003, 0); A.cs.scale.setScalar(lerp(0.75, 1, seg(t, FLIP0, FLIP1)));
    const roll = Math.sin(Math.PI * seg(t, 5.75, 6.25)) * 0.12;
    cam.fov = 30; aim(cam, v3(0.3, 2.6, 12.4), v3(0, 2.35, 0), roll);
    const bl = Math.sin(Math.PI * seg(t, FLIP0, FLIP1)); stageCanvas.style.filter = `blur(${(bl * 9).toFixed(1)}px)`;
  } else if (name === 'knopf') {
    md = mood('papier'); contents(t);
    A.rig.visible = true; A.rig.rotation.set(-1.12, 0.25, 0); A.rig.position.set(0, 1.95 + 0.05 * Math.sin(lt * 2), 0);
    A.cs.visible = true; A.cs.position.set(0, 0.003, -0.6); A.cs.scale.setScalar(1.2);
    const press = seg(t, 6.58, 6.64) * (1 - seg(t, 6.78, 6.9));
    A.S.btnG.position.y = -0.076 + 0.014 * press;
    A.S.ledMat.emissiveIntensity = t > 6.62 ? 2.5 + 1.5 * Math.sin((t - 6.62) * 18) * Math.exp(-(t - 6.62) * 3) : 0;
    cam.fov = 30; aim(cam, vlerp(v3(0.3, 0.75, 5.0), v3(0.2, 0.9, 4.4), ease.out(sp)), v3(-0.05, 1.85, 0.15));
  } else if (name === 'mixen1' || name === 'mixen2') {
    md = mood('papier'); rigUpright(A, 0, 0, 0.2); contents(t);
    const vib = seg(t, BLEND0, BLEND0 + 0.15) * (1 - seg(t, BLEND1, BLEND1 + 0.2));
    A.rig.position.x += (Math.sin(t * 91) + Math.sin(t * 57)) * 0.004 * vib; A.rig.rotation.z = Math.sin(t * 73) * 0.004 * vib;
    A.S.ledMat.emissiveIntensity = 0;
    if (name === 'mixen1') { cam.fov = 30; aim(cam, vlerp(v3(1.5, 2.7, 7.6), v3(1.2, 2.55, 6.7), sp), v3(0, 2.0, 0), Math.sin(t * 50) * 0.002 * vib); }
    else { const a = lerp(0.35, 1.25, ease.inOut(sp)); cam.fov = 26; aim(cam, v3(Math.sin(a) * 12.2, 2.4, Math.cos(a) * 12.2), v3(0, 2.02, 0)); }
  } else if (name === 'tragen') {
    md = mood('papier'); rigUpright(A, 0, 0, 0.15); finished(A);
    const lift = ease.inOut(seg(t, 9.3, 9.95)) * 0.85;
    const hang = -0.5 * ease.inOut(seg(t, 9.3, 9.9));
    const swing = 0.16 * Math.sin((t - 9.75) * 6.5) * Math.exp(-Math.max(0, t - 9.75) * 1.8) * seg(t, 9.6, 9.8);
    const th = hang + swing;
    const pivL = v3(-0.63, 2.515, 0).applyEuler(new THREE.Euler(0, 0.15, 0));
    const pivW = v3(pivL.x, 0.075 + 2.515 + lift, pivL.z);
    A.rig.rotation.set(0, 0, 0); A.B.group.rotation.set(0, 0.15, 0);
    A.rig.position.set(0, 0, 0);
    // Drehung um den Schlaufenpunkt (Achse z)
    const q = new THREE.Quaternion().setFromAxisAngle(v3(0, 0, 1), th);
    A.rig.quaternion.copy(q);
    const off = v3(pivL.x, 2.515, pivL.z).applyQuaternion(q);
    A.rig.position.copy(pivW.clone().sub(off));
    A.cs.scale.setScalar(1 - lift * 0.5); A.cs.material.opacity = 1 - lift * 0.6;
    thread.visible = lift > 0.01; thread.position.set(pivW.x - 0.27 * 0, pivW.y + 4.5, pivW.z); thread.scale.set(1, 9, 1);
    cam.fov = 28; aim(cam, vlerp(v3(-2.1, 3.3, 11.4), v3(-1.8, 3.5, 10.6), ease.out(sp)), v3(0.25, 2.95, 0));
  } else if (name === 'farben') {
    md = mood('papier');
    const sets = [VW, A, VB], xs = [-1.32, 0, 1.32];
    sets.forEach((s, i) => {
      const p = ease.outBack(seg(t, t0 + 0.05 + i * 0.09, t0 + 0.6 + i * 0.09));
      rigUpright(s, xs[i], 0, -0.62 + 0.1 * Math.sin(lt * 1.5 + i)); finished(s);
      s.rig.position.y = 0.075 + (1 - p) * -3.5; s.cs.material.opacity = p; s.cs.scale.setScalar(0.95);
    });
    cam.fov = 22; aim(cam, vlerp(v3(0, 2.3, 20.5), v3(0, 2.2, 19.6), ease.out(sp)), v3(0, 1.62, 0));
  }
  if (name !== 'knopf') { A.S.btnG.position.y = -0.076; if (name !== 'mixen1' && name !== 'mixen2') A.S.ledMat.emissiveIntensity = 0; }
  if (name !== 'tragen') { A.B.group.rotation.set(0, 0, 0); A.rig.quaternion.setFromEuler(A.rig.rotation); A.cs.material.opacity = name === 'farben' ? A.cs.material.opacity : (md === 'nacht' ? 0.95 : 0.5); }
  cam.updateProjectionMatrix(); scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  O.pillA(t < 1.5 ? 1 - seg(t, 1.38, 1.5) : 0);
  if (HOOK === 'a') { O.head1(-1); bubble(t < 1.5 ? t - 0.02 : -1, seg(t, 1.38, 1.5)); }
  else { O.head1(t < 1.5 ? t - 0.04 : -1, seg(t, 1.36, 1.5)); bubble(-1); }
  O.corners(t < 1.5 ? t : -1, seg(t, 1.36, 1.5));
  const steps = [[1.5, '01', 'Obst rein'], [3.5, '02', 'Milch dazu'], [4.75, '03', 'Zuschrauben'], [5.75, '03', 'Umdrehen'], [6.25, '04', 'Knopf drücken']];
  const st = [...steps].reverse().find((s) => t >= s[0]);
  O.step(st && t < 7.25 ? t - st[0] : -1, st ? st[1] : '', st ? st[2] : '', seg(t, 7.1, 7.25));
  O.head2(t >= 8.3 && t < 9.25 ? t - 8.3 : -1, seg(t, 9.12, 9.25));
  O.head3(t >= 9.3 && t < 10.25 ? t - 9.3 : -1, seg(t, 10.12, 10.25));
  O.head4(t >= 10.3 && t < 12 ? t - 10.3 : -1, seg(t, 11.86, 12.0));
  O.seal(t >= 10.45 && t < 12 ? t - 10.45 : -1, seg(t, 11.86, 12.0));
  if (name === 'farben') O.vl([VW, A, VB].map((s) => { const p = screen(s.rig, v3(0, -0.08, 0.5)); return [p[0], p[1] + 26]; }), t - 10.25); else O.vl([], -1);
  if (name === 'knopf') { const p = screen(A.S.btnG, v3(0, 0, 0)); O.ripple(p[0], p[1], t - 6.62); } else O.ripple(0, 0, -1);
  O.end(t >= 12 ? t - 12 : -1, 0);
  O.pillE(t >= 12 ? ease.out(seg(t, 12.05, 12.35)) : 0);
  O.streak(t > 1.3 && t < 1.7 ? seg(t, 1.34, 1.66) : t > 11.8 && t < 12.2 ? seg(t, 11.84, 12.16) : 0);
  O.flash(name === 'knopf' ? 1 - seg(t, 6.25, 6.36) : 0);
  O.grain(Math.round(t * 30), md === 'nacht' ? 1 : 0.55);
  r.render(scene, cam);
}

window.__frame = frame;
window.__dauer = DAUER;
window.__ready = true;
