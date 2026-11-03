// Maios CGI – Elektrischer Wasserspender fuer Schreibtisch (Produkt 10) – 14 s, 120 BPM
import * as THREE from 'three';
import { makeRenderer, backdrop, contactShadow, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as WM from '../lib/ws_models.js';
import * as BR from '../lib/brand.js';

const style = document.createElement('style'); style.textContent = BR.CSS; document.head.appendChild(style);
for (const f of ['300 40px Manrope', '500 40px Manrope', '700 40px Manrope', '40px Marcellus']) await document.fonts.load(f);
await document.fonts.load('700 40px Manrope', 'ß€·');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(26, 1080 / 1920, 0.05, 90);

function stripEnv({ bg, strips, top }) {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: bg, side: THREE.BackSide })));
  const add = (w, h, pos, col, I) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), side: THREE.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); s.add(m); };
  for (const st of strips) add(st.w, st.h, st.pos, st.col, st.I);
  if (top) add(top.w, top.h, v3(0, 5.8, 0), top.col, top.I);
  const pm = new THREE.PMREMGenerator(r); const tex = pm.fromScene(s, 0.02).texture; pm.dispose(); return tex;
}
const ENV = {
  nacht: stripEnv({ bg: '#0a0806', strips: [
    { w: 1.1, h: 9, pos: v3(-5.5, 0, 1.6), col: '#fff0dc', I: 6 }, { w: 1.1, h: 9, pos: v3(5.5, 0, 0.6), col: '#fff3e2', I: 5 },
    { w: 3.0, h: 9, pos: v3(0, 0, -5.8), col: '#e8e2d8', I: 1.0 }, { w: 2.2, h: 9, pos: v3(-2, 0, 5.8), col: '#fff1d6', I: 1.2 }], top: { w: 4, h: 4, col: '#fff0d8', I: 2.5 } }),
  papier: stripEnv({ bg: '#d9cbb3', strips: [
    { w: 1.4, h: 9, pos: v3(-5.5, 0, 2.2), col: '#ffffff', I: 4.5 }, { w: 1.4, h: 9, pos: v3(5.5, 0, 1.0), col: '#fff8ee', I: 3.8 },
    { w: 4.0, h: 9, pos: v3(0, 0, 5.8), col: '#f6efe2', I: 1.6 }, { w: 3.0, h: 9, pos: v3(0, 0, -5.8), col: '#efe3cc', I: 1.2 }], top: { w: 5, h: 5, col: '#ffffff', I: 3 } }),
};
const halo = (cx, cy) => canvasTex(540, 960, (g, w, h) => { g.fillStyle = '#060504'; g.fillRect(0, 0, w, h); let gr = g.createRadialGradient(w * cx, h * cy, 5, w * cx, h * cy, h * 0.7); gr.addColorStop(0, '#2b2116'); gr.addColorStop(1, '#060504'); g.fillStyle = gr; g.fillRect(0, 0, w, h); gr = g.createRadialGradient(w * cx, h * cy, 2, w * cx, h * cy, w * 0.5); gr.addColorStop(0, 'rgba(255,246,228,0.95)'); gr.addColorStop(0.3, 'rgba(240,215,160,0.6)'); gr.addColorStop(1, 'rgba(216,181,108,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const BG = { halo: halo(0.64, 0.6), haloE: halo(0.5, 0.42), nacht: backdrop('#2b2116', '#060504', 0.5, 0.46), papier: backdrop('#f8f2e7', '#d8c6a8', 0.5, 0.42), lampe: backdrop('#3a2a18', '#080604', 0.62, 0.38) };
const key = new THREE.DirectionalLight('#fff3e0', 2.4); key.position.set(-3.5, 7, 5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -3, near: 0.5, far: 25 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const fill = new THREE.HemisphereLight('#fff8ee', '#a88f6c', 0.5); scene.add(fill);
const kick = new THREE.PointLight('#fff0dc', 0, 14, 2); kick.position.set(2.5, 3.5, -3); scene.add(kick);
const lamp = new THREE.PointLight('#ffb766', 0, 9, 1.6); scene.add(lamp);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.18 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
function mood(m, bg) {
  scene.background = BG[bg || m]; scene.environment = ENV[m === 'lampe' ? 'nacht' : m]; lamp.intensity = 0;
  if (m === 'nacht' || m === 'lampe') { scene.environmentIntensity = m === 'lampe' ? 0.7 : 1.0; key.intensity = m === 'lampe' ? 0.6 : 2.0; key.color.set(m === 'lampe' ? '#ffe2bd' : '#fff4e8'); fill.intensity = 0.14; kick.intensity = m === 'lampe' ? 0 : 40; floor.material.opacity = 0.6; }
  else { scene.environmentIntensity = 0.9; key.intensity = 2.5; key.color.set('#fffaf3'); fill.intensity = 0.55; kick.intensity = 0; floor.material.opacity = 0.17; }
  return m;
}

// ---------- Objekte ----------
const W = WM.makeDispenser('weiss'); scene.add(W.group);
const SW = WM.makeDispenser('schwarz'); scene.add(SW.group);
const csW = contactShadow(3.2, 0.5), csS = contactShadow(3.2, 0.5); scene.add(csW, csS);
const G = WM.makeGlass(); scene.add(G.group);
const G2 = WM.makeGlass(); scene.add(G2.group);
const J = WM.makeJug(); scene.add(J.group);
const stream = WM.makeStream(); scene.add(stream);
const R = rng(21);
const drops = []; for (let i = 0; i < 12; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.018 + R() * 0.02, 12, 8), WM.waterMat()); scene.add(d); drops.push({ m: d, a: R() * 6.28, v: 0.5 + R(), o: R() }); }
const bubbles = []; for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.012 + R() * 0.016, 10, 8), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 2 })); scene.add(b); bubbles.push({ m: b, x: (R() - 0.5) * 0.4, z: (R() - 0.5) * 0.4, v: 0.5 + R() * 0.7, o: R() }); }
// Flaschen-Chaos
const pets = []; const P0 = [[-1.6, 0.6], [-0.9, 1.1], [-0.2, 1.35], [0.6, 1.2], [1.4, 0.8], [-1.25, -0.1], [1.1, 0.05], [-0.4, 0.55], [0.35, 0.5], [1.7, -0.5], [-1.8, -0.6]];
P0.forEach(([x, z], i) => { const p = WM.makePet(i + 3); scene.add(p); pets.push({ m: p, x, z, ry: R() * 6, tip: R() < 0.3 ? (R() - 0.5) * 2.6 : 0, d: R() }); });
// Schlauch (vom Anschluss hinten zum Kanister)
let tube = null;
function tubeAt(dip) {
  if (tube) { scene.remove(tube.mesh); tube.mesh.geometry.dispose(); }
  const jx = 2.5, jz = -1.9;
  const pts = [v3(0, 0.16, -1.13), v3(0.05, 0.08, -1.45), v3(0.6, 0.04, -2.1), v3(1.6, 0.05, -2.45), v3(2.25, 0.9, -2.3), v3(2.45, 2.55, -2.0), v3(jx, 3.15 - dip * 0.1, jz), v3(jx, 3.0 - dip, jz)];
  tube = WM.makeTube(pts, 0.032); scene.add(tube.mesh); return tube;
}
// USB-Stecker
const plug = new THREE.Group(); scene.add(plug);
{ const pm = new THREE.MeshPhysicalMaterial({ color: '#f2f1ee', roughness: 0.4 }); const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.26), pm); head.position.z = -0.13; plug.add(head);
  const pin = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: '#cfcfcf', metalness: 1, roughness: 0.2 })); pin.position.z = 0.04; plug.add(pin);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v3(0, 0, -0.26), v3(0, -0.02, -0.7), v3(0.15, -0.12, -1.3), v3(0.6, -0.15, -2.4)]), 40, 0.025, 10), pm); plug.add(cable); }
// Requisiten: Schreibtisch (Laptop, Pflanze) und Nachttisch (Lampe)
const props = new THREE.Group(); scene.add(props);
const wood = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#b98b5e'; g.fillRect(0, 0, w, h); const Rr = rng(5); for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(${90 + Rr() * 40},${55 + Rr() * 25},${30},${0.12 + Rr() * 0.18})`; g.lineWidth = 1 + Rr() * 4; g.beginPath(); const y = Rr() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 8 + (Rr() - 0.5) * 6); g.stroke(); } });
wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 2);
const desk = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 8), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.55, clearcoat: 0.2 })); desk.position.y = -0.15; desk.receiveShadow = true; props.add(desk);
const lap = new THREE.Group(); props.add(lap);
{ const al = new THREE.MeshStandardMaterial({ color: '#c9c9cb', metalness: 0.8, roughness: 0.35 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.8), al); b.position.y = 0.04; b.castShadow = true; lap.add(b);
  const scrG = new THREE.Group(); scrG.position.set(0, 0.08, -0.9); scrG.rotation.x = -0.32; lap.add(scrG);
  const s = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.75, 0.05), al); s.position.y = 0.875; s.castShadow = true; scrG.add(s);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(2.42, 1.58), new THREE.MeshBasicMaterial({ map: canvasTex(512, 340, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f3e9d8'); gr.addColorStop(1, '#d9c3a0'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(19,16,11,.75)'; g.fillRect(40, 40, 200, 18); g.fillStyle = 'rgba(19,16,11,.25)'; for (let i = 0; i < 6; i++) g.fillRect(40, 90 + i * 30, 300 - i * 25, 10); g.fillStyle = 'rgba(201,122,90,.6)'; g.fillRect(380, 90, 90, 170); }) }));
  disp.position.set(0, 0.875, 0.027); scrG.add(disp);
  lap.position.set(-2.0, 0, -1.2); lap.rotation.y = 0.55; }
const plant = new THREE.Group(); props.add(plant);
{ const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.5, 0.75], [0.54, 0.8], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)), 48), new THREE.MeshPhysicalMaterial({ color: '#c97a5a', roughness: 0.7 })); pot.castShadow = true; plant.add(pot);
  const leaf = new THREE.MeshPhysicalMaterial({ color: '#5f7d4a', roughness: 0.45, sheen: 0.3, side: THREE.DoubleSide }); const Rp = rng(8);
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), leaf); l.scale.set(0.35, 1, 0.08); const a = i / 9 * Math.PI * 2; l.position.set(Math.cos(a) * 0.28, 1.35 + Rp() * 0.5, Math.sin(a) * 0.28); l.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5); l.castShadow = true; plant.add(l); }
  plant.position.set(1.75, 0, -1.5); }
const nstand = new THREE.Group(); props.add(nstand);
{ const lampG = new THREE.Group(); nstand.add(lampG); lampG.position.set(2.1, 0, -1.0);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.12, 32), new THREE.MeshStandardMaterial({ color: '#2a241c', metalness: 0.6, roughness: 0.3 })); foot.position.y = 0.06; lampG.add(foot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 12), foot.material); stem.position.y = 1.2; lampG.add(stem);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 0.9, 48, 1, true), new THREE.MeshStandardMaterial({ color: '#f3dcb3', emissive: new THREE.Color('#ffb766'), emissiveIntensity: 1.6, side: THREE.DoubleSide, roughness: 0.9 }));
  shade.position.y = 2.45; lampG.add(shade); nstand.userData.lampPos = v3(2.1, 2.3, -1.0); }

// ---------- Overlay ----------
const O = {
  pillA: BR.pill('Werbung', { x: 84, y: 208, dark: true }),
  head1: BR.headline([[{ t: 'Wasser' }, { t: 'auf' }], [{ t: 'Knopfdruck.', gold: true }]], { y: 262, size: 112 }),
  corners: BR.corners({ x0: 64, y0: 200, x1: 912, y1: 1490 }),
  head2: BR.headline([[{ t: 'Schluss' }, { t: 'mit' }], [{ t: 'Flaschenchaos.', gold: true }]], { y: 250, size: 104, color: BR.C.tinte, goldClass: 'goldd', width: 900 }),
  step: BR.step({ y: 228 }),
  head3: BR.headline([[{ t: 'Glas' }, { t: 'voll.', gold: true }]], { y: 250, size: 122, color: BR.C.tinte, goldClass: 'goldd' }),
  head4: BR.headline([[{ t: 'Wieder' }], [{ t: 'aufladbar.', gold: true }]], { y: 250, size: 112, color: BR.C.tinte, goldClass: 'goldd' }),
  head5: BR.headline([[{ t: 'Fürs' }, { t: 'Büro.', gold: true }]], { y: 250, size: 116, color: BR.C.tinte, goldClass: 'goldd' }),
  head6: BR.headline([[{ t: 'Und' }, { t: 'zuhause.', gold: true }]], { y: 250, size: 116, color: BR.C.creme }),
  head7: BR.headline([[{ t: 'In' }, { t: 'zwei' }], [{ t: 'Farben.', gold: true }]], { y: 236, size: 112, color: BR.C.tinte, goldClass: 'goldd' }),
  seal: BR.seal({ x: 676, y: 214, size: 240 }),
  vl: BR.vlabels(['Weiß', 'Schwarz'], ['#e9e5de', '#1d2431']),
  ripple: BR.ripple(),
  end: BR.endcard({ name: 'Wasserspender <b>Schreibtisch</b>', price: '38,99&nbsp;€', colors: 'Weiß · Schwarz' }),
  pillE: BR.pill('Werbung', { y: 172, dark: true, center: true }),
  streak: BR.streak(), flash: BR.flash(), grain: BR.grain({ amount: 0.07 }),
};
// Akku-Symbol (Gold)
const batt = (() => { const d = document.createElement('div'); d.className = 'abs'; d.style.left = '84px'; d.style.top = '560px';
  d.innerHTML = `<svg width="300" height="140" viewBox="0 0 300 140"><rect x="6" y="20" width="250" height="100" rx="22" fill="none" stroke="#9a7432" stroke-width="8"/><rect x="262" y="50" width="22" height="40" rx="8" fill="#9a7432"/><rect class="f" x="22" y="36" width="0" height="68" rx="12" fill="#c9a258"/><path class="z" d="M150 30 L118 76 H146 L134 112 L176 60 H148 Z" fill="#13100B"/></svg>`;
  document.getElementById('ov').appendChild(d); const f = d.querySelector('.f');
  return (tl) => { d.style.opacity = tl < 0 ? 0 : ease.out(seg(tl, 0, 0.25)); d.style.visibility = tl < 0 ? 'hidden' : 'visible'; if (tl >= 0) f.setAttribute('width', 218 * ease.inOut(seg(tl, 0.2, 0.9))); }; })();
const stageCanvas = r.domElement;

// ---------- Zustaende ----------
const WATER0 = 6.35, WATER1 = 8.4;           // Strahl laeuft
function water(t, on0 = WATER0, on1 = WATER1, glass = G, disp = W, maxH = 1.02) {
  stream.material.emissiveIntensity = scene.background === BG.papier ? 0.0 : 0.35; stream.material.envMapIntensity = scene.background === BG.papier ? 1.6 : 2.2;
  const h = maxH * ease.inOut(seg(t, on0 + 0.15, on1));
  const nz = disp.group.localToWorld(WM.NOZZLE.clone());
  const gw = glass.group.position;
  const surf = gw.y + 0.06 + h;
  glass.water.visible = h > 0.004;
  if (glass.water.visible) { glass.water.geometry.dispose(); glass.water.geometry = WM.waterGeometry(h, t, t > on0 && t < on1 + 0.2 ? 1 : 0); }
  stream.visible = false; drops.forEach((d) => (d.m.visible = false)); bubbles.forEach((b) => (b.m.visible = false));
  if (t > on0 && t < on1 + 0.2) {
    const bot = Math.max(surf, nz.y - (t - on0) * 9);
    const top = t > on1 ? nz.y - (t - on1) * 9 : nz.y;
    if (top > bot) { stream.visible = true; stream.position.set(nz.x, (top + bot) / 2, nz.z); stream.scale.set(1 + 0.06 * Math.sin(t * 50), top - bot, 1 + 0.06 * Math.cos(t * 43)); }
    if (bot <= surf + 0.01) drops.forEach((d) => { const lt = ((t * 2.2 + d.o) % 0.4) / 0.4; d.m.visible = true; const rr = 0.04 + lt * 0.16 * d.v; d.m.position.set(nz.x + Math.cos(d.a) * rr, surf + Math.sin(lt * Math.PI) * 0.16 * d.v, nz.z + Math.sin(d.a) * rr); });
    bubbles.forEach((b) => { const lt = ((t * b.v * 0.9 + b.o) % 1); const y = gw.y + 0.1 + lt * Math.max(0.05, h - 0.05); if (h > 0.1) { b.m.visible = true; b.m.position.set(gw.x + b.x * 0.6, y, gw.z + b.z * 0.6); } });
  }
  return h;
}
function placeDisp(D, cs, x = 0, z = 0, ry = 0, y = 0) { D.group.visible = true; D.group.position.set(x, y, z); D.group.rotation.set(0, ry, 0); D.group.updateMatrixWorld(true); cs.visible = true; cs.position.set(x, 0.003, z - 0.3); cs.scale.setScalar(1); cs.material.opacity = 1; }
function glassOn(D, glass, drop = 0, show = true) { D.group.updateMatrixWorld(true); glass.group.visible = show; const p = D.group.localToWorld(WM.GLAS_POS.clone()); glass.group.position.set(p.x, p.y + drop, p.z); glass.group.rotation.set(0, 0, 0); }
const screen = (obj, local) => { const v = obj.localToWorld(local.clone()); v.project(cam); return [(v.x + 1) / 2 * 1080, (1 - v.y) / 2 * 1920]; };

const SHOTS = [
  [0, 1.5, 'held'], [1.5, 2.75, 'chaos'], [2.75, 4.0, 'schlauch'], [4.0, 5.0, 'glas'], [5.0, 6.0, 'tippen'], [6.0, 7.25, 'strahl'],
  [7.25, 8.5, 'voll'], [8.5, 9.5, 'akku'], [9.5, 10.25, 'buero'], [10.25, 11.0, 'zuhause'], [11.0, 12.0, 'farben'], [12.0, 14.0, 'ende'],
];
export const DAUER = 14.0;

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const lt = t - t0, sp = seg(t, t0, t1);
  for (const o of [W.group, SW.group, csW, csS, G.group, G2.group, J.group, stream, plug, props, lap, plant, nstand, desk]) o.visible = false;
  if (tube) tube.mesh.visible = false;
  pets.forEach((p) => (p.m.visible = false)); drops.forEach((d) => (d.m.visible = false)); bubbles.forEach((b) => (b.m.visible = false));
  W.ledMat.emissiveIntensity = 0; W.buttons.forEach((b) => (b.position.y = 0.4)); G2.water.visible = false;
  stageCanvas.style.filter = ''; floor.visible = true;
  let md = 'papier';

  if (name === 'held') {
    md = mood('nacht', 'halo'); placeDisp(W, csW, 0, 0, -0.5); glassOn(W, G);
    water(t, -0.6, 1.7, G, W, 1.0); // Hero: Glas fuellt sich bereits
    cam.fov = 26; aim(cam, vlerp(v3(1.6, 1.1, 12.6), v3(1.3, 1.25, 11.2), ease.out(sp)), vlerp(v3(-0.25, 1.6, -0.3), v3(-0.25, 1.62, -0.3), sp));
    kick.position.set(lerp(3, -3, sp), 3.6, -3.2);
  } else if (name === 'chaos') {
    md = mood('papier');
    const sweep = seg(t, 1.95, 2.45);
    const reveal = ease.outBack(seg(t, 2.25, 2.7));
    pets.forEach((p, i) => {
      p.m.visible = true;
      const k = clamp((sweep * 4.2) - (p.x + 2) / 4 * 3.2);   // Streif laeuft von links nach rechts
      const fly = ease.in(k);
      p.m.position.set(p.x + fly * 7, fly * 2.5 + Math.sin(fly * Math.PI) * 1.2, p.z - fly * 1.5);
      p.m.rotation.set(p.tip * (1 - fly) + fly * 4 * (p.d - 0.5), p.ry + fly * 6, (p.tip ? Math.sign(p.tip) * 1.45 : 0) * (1 - fly) - fly * 3);
      if (p.tip) { p.m.position.y += 0.24 * (1 - fly); }
    });
    if (reveal > 0) { placeDisp(W, csW, 0, -0.4, -0.5); W.group.scale.setScalar(Math.max(0.001, reveal)); csW.material.opacity = clamp(reveal); } else W.group.scale.setScalar(1);
    cam.fov = 30; aim(cam, vlerp(v3(0.6, 4.4, 10.8), v3(0.5, 4.1, 9.9), ease.out(sp)), v3(0, 1.0, 0.2));
  } else if (name === 'schlauch') {
    md = mood('papier'); placeDisp(W, csW, 0, 0, 0); J.group.visible = true; J.group.position.set(2.5, 0, -1.9); J.cap.visible = false;
    const dip = 1.5 * ease.inOut(seg(t, 2.9, 3.75));
    tubeAt(dip - 0.2).mesh.visible = true;
    cam.fov = 30; aim(cam, vlerp(v3(5.4, 4.6, 3.6), v3(5.0, 4.3, 3.1), ease.out(sp)), v3(2.3, 2.45, -1.9));
  } else if (name === 'glas') {
    md = mood('papier'); placeDisp(W, csW, 0, 0, -0.35); W.group.scale.setScalar(1);
    const p = ease.outQuint(seg(t, 4.05, 4.55)); const bounce = t > 4.55 ? Math.exp(-(t - 4.55) * 14) * Math.sin((t - 4.55) * 40) * 0.025 : 0;
    glassOn(W, G, (1 - p) * 2.2 + Math.abs(bounce)); G.water.visible = false;
    cam.fov = 28; aim(cam, vlerp(v3(2.1, 2.6, 9.0), v3(1.8, 2.45, 8.2), ease.out(sp)), v3(0, 1.4, -0.4));
  } else if (name === 'tippen') {
    md = mood('papier'); placeDisp(W, csW, 0, 0, 0.25); glassOn(W, G); G.water.visible = false;
    const press = seg(t, 5.46, 5.5) * (1 - seg(t, 5.64, 5.74));
    W.buttons[0].position.y = 0.4 - 0.012 * press;
    W.ledMat.emissiveIntensity = t > 5.5 ? 2.2 : 0;
    cam.fov = 30; aim(cam, vlerp(v3(-0.7, 2.3, 4.3), v3(-0.6, 2.1, 3.85), ease.out(sp)), v3(-0.05, 0.6, 0.55));
  } else if (name === 'strahl') {
    md = mood('papier'); placeDisp(W, csW, 0, 0, -0.35); glassOn(W, G); water(t); W.ledMat.emissiveIntensity = 2.2;
    cam.fov = 30; aim(cam, vlerp(v3(1.5, 2.6, 3.4), v3(1.3, 2.45, 3.0), ease.out(sp)), v3(0, 1.95, -0.45));
  } else if (name === 'voll') {
    md = mood('papier'); placeDisp(W, csW, 0, 0, -0.35); glassOn(W, G); water(t); W.ledMat.emissiveIntensity = t < 8.4 ? 2.2 : 0;
    cam.fov = 28; aim(cam, vlerp(v3(-1.8, 1.4, 6.6), v3(-1.6, 1.3, 5.8), ease.out(sp)), v3(0, 1.05, -0.45));
  } else if (name === 'akku') {
    md = mood('papier'); placeDisp(W, csW, 0, 0, Math.PI + 0.55); G.group.visible = false;
    plug.visible = true; const port = W.group.localToWorld(v3(0, 0.16, -1.121));
    const pin = ease.outQuint(seg(t, 8.6, 9.0));
    const dir = v3(0, 0, -1).applyEuler(W.group.rotation);
    plug.position.copy(port.clone().add(dir.clone().multiplyScalar(lerp(0.9, 0.03, pin))));
    plug.rotation.set(0, W.group.rotation.y, 0);
    cam.fov = 30; aim(cam, vlerp(v3(2.4, 1.3, 4.1), v3(2.15, 1.15, 3.6), ease.out(sp)), v3(0.5, 0.35, 0.9));
  } else if (name === 'buero') {
    md = mood('papier'); props.visible = desk.visible = lap.visible = plant.visible = true; floor.visible = false;
    placeDisp(W, csW, 0.2, 0, -0.3); glassOn(W, G); G.water.visible = true; G.water.geometry.dispose(); G.water.geometry = WM.waterGeometry(1.02);
    cam.fov = 30; aim(cam, vlerp(v3(0.9, 3.6, 12.6), v3(0.4, 3.5, 11.8), sp), v3(-0.3, 1.25, -0.7));
  } else if (name === 'zuhause') {
    md = mood('lampe'); props.visible = desk.visible = nstand.visible = true; floor.visible = false;
    lamp.intensity = 14; lamp.position.copy(nstand.userData.lampPos);
    placeDisp(W, csW, -0.3, 0, -0.2); glassOn(W, G); G.water.visible = true; G.water.geometry.dispose(); G.water.geometry = WM.waterGeometry(0.7);
    cam.fov = 28; aim(cam, vlerp(v3(-1.6, 2.6, 9.6), v3(-1.1, 2.55, 8.9), sp), v3(0.3, 1.45, -0.6));
  } else if (name === 'farben') {
    md = mood('papier');
    [[W, csW, G, -1.12], [SW, csS, G2, 1.12]].forEach(([D, cs, gl, x], i) => {
      const p = ease.outBack(seg(t, t0 + 0.05 + i * 0.1, t0 + 0.6 + i * 0.1));
      placeDisp(D, cs, x, 0, -0.45); D.group.position.y = (1 - p) * -3.8; D.group.updateMatrixWorld(true); cs.material.opacity = p; glassOn(D, gl); gl.water.visible = true; gl.water.geometry.dispose(); gl.water.geometry = WM.waterGeometry(0.95);
    });
    cam.fov = 24; aim(cam, vlerp(v3(0, 2.8, 19.5), v3(0, 2.7, 18.6), ease.out(sp)), v3(0, 1.45, -0.4));
  } else if (name === 'ende') {
    md = mood('nacht', 'haloE'); placeDisp(W, csW, 0, 0, lerp(-0.9, 0.3, sp)); glassOn(W, G); G.water.visible = true; G.water.geometry.dispose(); G.water.geometry = WM.waterGeometry(1.02);
    cam.fov = 26; aim(cam, vlerp(v3(0, 1.4, 22.5), v3(0, 1.3, 21.4), ease.out(sp)), v3(0, 0.5, -0.4));
    kick.position.set(2.6, 3.4, -2.8);
  }
  if (name !== 'chaos') W.group.scale.setScalar(1);
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  O.pillA(t < 1.5 ? 1 - seg(t, 1.38, 1.5) : 0);
  O.head1(t < 1.5 ? t - 0.04 : -1, seg(t, 1.36, 1.5));
  O.corners(t < 1.5 ? t : -1, seg(t, 1.36, 1.5));
  O.head2(t >= 1.55 && t < 2.75 ? t - 1.55 : -1, seg(t, 2.6, 2.75));
  const steps = [[2.75, '01', 'Schlauch rein'], [4.0, '02', 'Glas drauf'], [5.0, '03', 'Antippen']];
  const st = [...steps].reverse().find((s) => t >= s[0]);
  O.step(st && t < 7.25 ? t - st[0] : -1, st ? st[1] : '', st ? st[2] : '', seg(t, 7.1, 7.25));
  O.head3(t >= 7.4 && t < 8.5 ? t - 7.4 : -1, seg(t, 8.36, 8.5));
  O.head4(t >= 8.55 && t < 9.5 ? t - 8.55 : -1, seg(t, 9.38, 9.5));
  batt(t >= 8.6 && t < 9.5 ? t - 8.6 : -1);
  O.head5(t >= 9.52 && t < 10.25 ? t - 9.52 : -1, seg(t, 10.15, 10.25));
  O.head6(t >= 10.27 && t < 11.0 ? t - 10.27 : -1, seg(t, 10.9, 11.0));
  O.head7(t >= 11.03 && t < 12 ? t - 11.03 : -1, seg(t, 11.88, 12.0));
  O.seal(t >= 11.15 && t < 12 ? t - 11.15 : -1, seg(t, 11.88, 12.0));
  if (name === 'farben') O.vl([W, SW].map((D) => { const p = screen(D.group, v3(0, 0, 1.05)); return [p[0], p[1] + 30]; }), t - 11.0); else O.vl([], -1);
  if (name === 'tippen') { const p = screen(W.buttons[0], v3(0, 0.02, 0)); O.ripple(p[0], p[1], t - 5.5); } else O.ripple(0, 0, -1);
  O.end(t >= 12 ? t - 12 : -1, 0);
  O.pillE(t >= 12 ? ease.out(seg(t, 12.05, 12.35)) : 0);
  O.streak(t > 1.3 && t < 1.7 ? seg(t, 1.34, 1.66) : t > 1.9 && t < 2.5 ? seg(t, 1.95, 2.45) : t > 11.8 && t < 12.2 ? seg(t, 11.84, 12.16) : 0);
  O.flash(0);
  O.grain(Math.round(t * 30), md === 'papier' ? 0.55 : 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
