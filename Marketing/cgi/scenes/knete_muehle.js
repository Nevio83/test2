// Maios CGI – Kaffee- und Gewürzmühle (Produkt 55), Knetanimation (Stop-Motion 12 fps, Miniatur-Look), Story 20,5 s.
// Neuer Stil: alles aus Knete (Fingerabdrücke, leicht unregelmässige Formen, "Boil" pro Bild), nur die Mühle ist echt (Edelstahl, Glasdeckel).
// Ablauf: Bohnenhaufen (Hook) -> Bohnen hüpfen in den Becher -> Deckel drauf, Knete-Hand drückt den Taster -> Draufsicht: Bohnen werden Pulver ->
//         grob vs. fein -> Pfefferkörner, Zimt, Nuss hüpfen rein -> Mühle mit Tasse, Preis-Schild -> Abbinder mit Link.
import * as THREE from 'three';
import { makeRenderer, makeEnv, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import { makePostPro } from '../lib/post_pro.js';
import { makeMuehle } from '../lib/muehle_models.js';
import { stripEnv } from '../lib/tiefe.js';

const style = document.createElement('style');
style.textContent = `
@font-face{font-family:'Manrope';src:url(fonts/manrope-latin.woff2) format('woff2');font-weight:200 800}
@font-face{font-family:'Manrope';src:url(fonts/manrope-latin-ext.woff2) format('woff2');font-weight:200 800;unicode-range:U+0100-02BA,U+20A0-20C0}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000}
#stage,#ov{position:absolute;inset:0} #stage canvas{display:block}
#ov{pointer-events:none;font-family:Manrope,sans-serif}
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(40,28,20,.55)}
.tword{position:absolute;top:208px;padding:7px 14px 6px;border-radius:12px;background:rgba(40,28,20,.55);font:700 32px Manrope;color:#fff}
.clay{position:absolute;left:0;width:1080px;text-align:center}
.clay span{display:inline-block;max-width:760px;font:800 66px/1.12 Manrope;color:#3b2417;background:#f6e3c6;padding:22px 34px 24px;border-radius:38px 30px 42px 34px;
  box-shadow:inset 0 -8px 0 rgba(120,70,40,.18),inset 0 6px 0 rgba(255,255,255,.55),0 10px 0 rgba(90,50,25,.35),0 18px 30px rgba(0,0,0,.25)}
.clay.b span{background:#bfe0c9;color:#1f3a2b}
.clay.c span{background:#f4c6b8;color:#4a1f15}
.price{position:absolute;left:0;width:1080px;text-align:center}
.price span{display:inline-block;font:800 150px/1 Manrope;color:#fff4e4;background:#c4572f;padding:26px 48px 30px;border-radius:60px 48px 64px 52px;letter-spacing:-.02em;
  box-shadow:inset 0 -14px 0 rgba(80,20,5,.3),inset 0 10px 0 rgba(255,255,255,.35),0 14px 0 rgba(90,30,10,.45),0 24px 40px rgba(0,0,0,.3)}
.cta{position:absolute;left:290px;width:500px;text-align:center;font:800 46px Manrope;color:#2b1a10;background:#fff8ee;border-radius:30px;padding:22px 0;box-shadow:0 8px 0 rgba(90,50,25,.35)}
`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 40px Manrope', 'ßüÜäÄöÖ€·?:');

const r = makeRenderer(); r.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9c9a6');
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.02, 80);
const ENV = makeEnv(r); scene.environment = ENV; scene.environmentIntensity = 0.35;
const P = makePostPro(r, scene, cam, { bloom: [0.12, 0.5, 0.95], aoRadius: 0.35, grade: { uWarm: 0.05, uVig: 0.38, uContrast: 0.1 } });
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };

// ---------- Knete: Fingerabdruck-Struktur + unregelmässige Formen ----------
const R = rng(5555);
const thumb = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 26; k++) { const cx = R() * w, cy = R() * h, n = 6 + Math.floor(R() * 8), rot = R() * 6;
    for (let i = 0; i < n; i++) { g.strokeStyle = `rgba(${R() < 0.5 ? '60,60,60' : '190,190,190'},.22)`; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, 8 + i * 5, 5 + i * 3.5, rot, 0.3, 2.6); g.stroke(); } }
  for (let i = 0; i < 4000; i++) { const v = 100 + Math.floor(R() * 60); g.fillStyle = `rgba(${v},${v},${v},.25)`; g.fillRect(R() * w, R() * h, 2, 2); }
}, false);
thumb.wrapS = thumb.wrapT = THREE.RepeatWrapping;
const clay = (color, rep = 1.5) => { const t = thumb.clone(); t.needsUpdate = true; t.repeat.set(rep, rep); return new THREE.MeshPhysicalMaterial({ color, roughness: 0.62, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5), bumpMap: t, bumpScale: 1.2, clearcoat: 0.08 }); };
function lumpy(geo, amt = 0.03, seed = 1) {
  const p = geo.attributes.position; const n = new THREE.Vector3();
  geo.computeVertexNormals(); const nn = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = Math.sin(x * 7.1 + seed) * Math.sin(y * 6.3 + seed * 1.7) * Math.sin(z * 5.9 + seed * 0.7) + 0.5 * Math.sin(x * 13 + y * 11 + seed);
    n.set(nn.getX(i), nn.getY(i), nn.getZ(i)); p.setXYZ(i, x + n.x * d * amt, y + n.y * d * amt, z + n.z * d * amt); }
  geo.computeVertexNormals(); return geo;
}
const M = { table: clay('#c98f5e', 2.5), wall: clay('#9cc3a8', 3), bean: clay('#5a3420', 0.6), beanD: clay('#3b2114', 0.6), cup: clay('#f3ece0', 1), coffee: clay('#3a2215', 0.8),
  hand: clay('#f0b48f', 1), pepper: clay('#2a2420', 0.4), cinn: clay('#a25a2c', 0.8), nut: clay('#c69a62', 0.6), bowl: clay('#e9d3b4', 1), bowl2: clay('#7fb3c9', 1), leaf: clay('#5e9b5a', 1), powder: clay('#6b4129', 2), sign: clay('#f6e3c6', 1) };

// Tisch + Rückwand
const table = new THREE.Mesh(lumpy(new THREE.BoxGeometry(14, 0.6, 9, 40, 2, 30), 0.02, 3), M.table); table.position.set(0, -0.3, -1); table.receiveShadow = true; scene.add(table);
const wall = new THREE.Mesh(lumpy(new THREE.PlaneGeometry(20, 14, 40, 30), 0.05, 5), M.wall); wall.position.set(0, 5, -5.2); wall.receiveShadow = true; scene.add(wall);
// Deko: Knete-Blätter in einem Topf, Knete-Wolke an der Wand (Fenster-Ersatz)
const pot = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 32, 6), 0.025, 7), clay('#e48a5a', 1)); pot.position.set(-3.2, 0.45, -3.2); pot.castShadow = true; scene.add(pot);
const leaves = [];
for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.4, 20, 14), 0.03, i), M.leaf); l.scale.set(0.35, 1.1, 0.14); const a = i / 7 * Math.PI * 2; l.position.set(-3.2 + Math.cos(a) * 0.2, 1.35, -3.2 + Math.sin(a) * 0.2); l.rotation.set(Math.sin(a) * 0.55, a, Math.cos(a) * 0.55); l.castShadow = true; scene.add(l); leaves.push(l); }
for (const [x, y, s] of [[2.6, 6.2, 1], [3.4, 6.5, 0.8], [1.9, 6.4, 0.7]]) { const c = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.6, 20, 14), 0.04, x), clay('#fbf4e8', 1)); c.scale.set(s * 1.3, s, 0.3); c.position.set(x, y, -5.05); scene.add(c); }

// Mühle (echt) in der Mitte
const STEELENV = stripEnv(r, { bg: '#45403a', strips: [{ w: 0.9, h: 9, pos: v3(-5.5, 0, 1.8), col: '#ffffff', I: 5 }, { w: 0.7, h: 9, pos: v3(5.5, 0, 0.8), col: '#fff4e6', I: 3.5 }, { w: 0.5, h: 9, pos: v3(3.5, 0, 4.5), col: '#ffffff', I: 3 }, { w: 3.0, h: 9, pos: v3(0, 0, -5.8), col: '#9cc3a8', I: 1.2 }, { w: 0.6, h: 9, pos: v3(-1.5, 0, 5.8), col: '#ffffff', I: 2.5 }, { w: 0.6, h: 9, pos: v3(1.8, 0, 5.8), col: '#ffffff', I: 1.6 }], top: { w: 5, h: 5, col: '#ffffff', I: 2.5 } });
const MU = makeMuehle(STEELENV); MU.group.position.set(0.9, 0, -0.6); MU.group.rotation.y = -0.35; scene.add(MU.group);
const MUTOP = () => MU.group.localToWorld(v3(0, MU.topY, 0));

// Bohnen (Knete): Haufen links vorn
const beanGeo = (() => { const g = new THREE.SphereGeometry(0.1, 18, 12); g.scale(1, 0.72, 1.32); return lumpy(g, 0.008, 2); })();
const creaseGeo = new THREE.CapsuleGeometry(0.006, 0.11, 4, 8); creaseGeo.rotateX(Math.PI / 2);
function mkBean(i) { const b = new THREE.Group(); const m = new THREE.Mesh(beanGeo, i % 3 ? M.bean : M.beanD); m.castShadow = true; b.add(m);
  const c = new THREE.Mesh(creaseGeo, M.beanD); c.rotation.set(0, 0, 0); c.position.y = 0.066; c.scale.set(1, 0.5, 1); b.add(c); b.scale.setScalar(0.62); scene.add(b); return b; }
const PILE = v3(-0.55, 0, 1.15);
const NB = 44; const beans = [];
for (let i = 0; i < NB; i++) { const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.42; const h = (1 - rr / 0.42) * 0.2 + R() * 0.03;
  beans.push({ g: mkBean(i), home: PILE.clone().add(v3(Math.cos(a) * rr, 0.045 + h, Math.sin(a) * rr)), rot: v3(R() * 6, R() * 6, R() * 6), hop: 3.05 + i * 0.058, inR: R() * 0.45, inA: R() * 6.28, inY: R() * 0.25 }); }
// Gewürze für den Gewürz-Teil
const spices = [];
for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.06, 12, 8), 0.006, i), M.pepper); m.castShadow = true; scene.add(m); spices.push({ m, home: v3(-1.4 + (i % 5) * 0.14, 0.06, 0.6 + Math.floor(i / 5) * 0.16), hop: 13.9 + i * 0.09 }); }
const cinn = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 16, 4), 0.01, 9), M.cinn); cinn.rotation.z = Math.PI / 2; cinn.castShadow = true; scene.add(cinn);
const nuts = [0, 1, 2].map((i) => { const m = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.12, 16, 12), 0.02, 20 + i), M.nut); m.scale.set(1.25, 0.95, 0.95); m.castShadow = true; scene.add(m); return m; });
// Pulver im Becher (steigt beim Mahlen)
const powder = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(0.66, 0.6, 1, 48, 3), 0.01, 4), clay('#6b4129', 6)); powder.material.bumpScale = 3; powder.material.roughness = 0.95; MU.group.add(powder);
const CRN = 260; const crumbs = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.03, 0), clay('#4a2a18', 1), CRN); MU.group.add(crumbs); const CR = []; for (let i = 0; i < CRN; i++) CR.push([R() * 6.28, Math.sqrt(R()) * 0.6, R(), R() * 6, 0.6 + R() * 1.4]);
const dummy = new THREE.Object3D();
// Grob/Fein-Schälchen
const BW = new THREE.Group(); scene.add(BW);
const mkBowl = (x, m, coarse) => { const b = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(0.55, 0.36, 0.32, 40, 4, true), 0.02, x * 9), m); b.material.side = THREE.DoubleSide; b.position.set(x, 0.16, 0); b.castShadow = true; BW.add(b);
  if (!coarse) { const fm = clay('#7a4a2e', 10); fm.bumpScale = 1.6; fm.roughness = 1; fm.sheen = 0; fm.clearcoat = 0; const pile = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.46, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), 0.004, x * 5), fm); pile.scale.set(1, 0.42, 1); pile.position.set(x, 0.22, 0); BW.add(pile); }
  else { const base = new THREE.Mesh(new THREE.CircleGeometry(0.44, 32), M.beanD); base.rotation.x = -Math.PI / 2; base.position.set(x, 0.2, 0); BW.add(base); for (let i = 0; i < 150; i++) { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035 + R() * 0.035, 0), i % 3 ? M.bean : M.beanD); const a = R() * 6.28, rr = Math.sqrt(R()) * 0.42; c.position.set(x + Math.cos(a) * rr, 0.22 + (1 - rr / 0.44) * 0.2 + R() * 0.03, Math.sin(a) * rr); c.rotation.set(R() * 3, R() * 3, R() * 3); BW.add(c); } } };
mkBowl(-0.75, M.bowl, true); mkBowl(0.75, M.bowl2, false);
// Tasse Kaffee (Knete) mit Dampf-Kringeln
const CUP = new THREE.Group(); scene.add(CUP);
{ const c = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(0.42, 0.34, 0.62, 40, 4, true), 0.015, 8), M.cup); c.material.side = THREE.DoubleSide; c.position.y = 0.31; c.castShadow = true; CUP.add(c);
  const bot = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), M.cup); bot.rotation.x = -Math.PI / 2; bot.position.y = 0.01; CUP.add(bot);
  const cof = new THREE.Mesh(new THREE.CircleGeometry(0.39, 32), M.coffee); cof.rotation.x = -Math.PI / 2; cof.position.y = 0.52; CUP.add(cof);
  const hdl = new THREE.Mesh(lumpy(new THREE.TorusGeometry(0.17, 0.05, 12, 24, Math.PI * 1.3), 0.01, 3), M.cup); hdl.position.set(0.44, 0.32, 0); hdl.rotation.z = -Math.PI * 0.65; CUP.add(hdl);
  const sau = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(0.65, 0.6, 0.06, 40, 1), 0.01, 2), M.cup); sau.position.y = 0.0; sau.castShadow = true; CUP.add(sau); }
const steam = [0, 1, 2].map((i) => { const s = new THREE.Mesh(lumpy(new THREE.TorusGeometry(0.1 + i * 0.02, 0.035, 10, 24), 0.008, i), clay('#ffffff', 0.5)); s.material.transparent = true; scene.add(s); return s; });
CUP.position.set(-1.0, 0, 0.5);
// Knete-Hand (drückt den Taster)
const HAND = new THREE.Group(); scene.add(HAND);
{ const palm = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.3, 24, 16), 0.02, 4), M.hand); palm.scale.set(1, 0.6, 1.3); HAND.add(palm);
  const fing = new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(0.07, 0.42, 6, 14), 0.008, 6), M.hand); fing.rotation.x = Math.PI / 2; fing.position.set(0, 0.03, -0.45); HAND.add(fing);
  for (const s of [-1, 1, 2]) { const f = new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(0.075, 0.22, 6, 12), 0.008, s), M.hand); f.rotation.set(Math.PI / 2 + 0.9, 0, 0); f.position.set(s * 0.11, -0.08, -0.32); HAND.add(f); }
  const arm = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(0.2, 0.24, 2.5, 20, 4), 0.02, 3), M.hand); arm.rotation.x = Math.PI / 2; arm.position.set(0, 0, 1.4); HAND.add(arm);
  HAND.traverse((m) => { if (m.isMesh) m.castShadow = true; }); }

// ---------- Licht: weiches Studiolicht (Miniatur) ----------
const key = new THREE.DirectionalLight('#fff1dd', 2.6); key.position.set(-5, 8, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6;
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -4, near: 1, far: 30 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; scene.add(key);
const fill = new THREE.HemisphereLight('#fff6ea', '#b07a55', 0.9); scene.add(fill);
const rim = new THREE.DirectionalLight('#ffd7b0', 1.2); rim.position.set(5, 4, -6); scene.add(rim);

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = { pill: mk('tpill', 'Werbung', 208), word: mk('tword', 'Kaffeemühle'),
  t1: mk('clay', '<span>Mein Kaffee fängt<br>hier an.</span>', 300), t2: mk('clay b', '<span>Ganze Bohnen rein.</span>', 300), t3: mk('clay', '<span>Deckel drauf,<br>Knopf drücken.</span>', 300),
  t4: mk('clay c', '<span>200 Watt, Messer<br>aus Edelstahl.</span>', 300), t5: mk('clay b', '<span>Kurz: grob.<br>Länger: fein.</span>', 300), t6: mk('clay', '<span>Auch Gewürze<br>und Nüsse.</span>', 300),
  p: mk('price', '<span>18,99&nbsp;€</span>', 300), t7: mk('clay b', '<span>Kaffee oder Gewürze?</span>', 540), cta: mk('cta', 'Link im Profil', 560) };
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
const FPS = 12;
function jit(d, frameN, base = 0) { const a = Math.sin(frameN * 12.9898 + base) * 43758.5453; const j = (a - Math.floor(a)) - 0.5; d.style.transform = `translate(${j * 4}px, ${j * 3}px) rotate(${base * 0.3 + j * 0.8}deg)`; }
function show(d, tl, out, frameN, rot = 0) { if (tl < 0) { d.style.opacity = 0; return; } d.style.opacity = (1 - out); const s = tl < 1 / FPS ? 0.85 : tl < 2 / FPS ? 1.06 : 1; jit(d, frameN, rot); d.style.transform += ` scale(${s})`; }

// ---------- Zeitplan ----------
export const DAUER = 20.5;
const SH = [[0, 3.0, 'pile'], [3.0, 6.0, 'hop'], [6.0, 8.4, 'press'], [8.4, 11.0, 'grind'], [11.0, 13.6, 'bowls'], [13.6, 16.2, 'spice'], [16.2, 18.0, 'hero'], [18.0, 19.5, 'hero2'], [19.5, 20.5, 'end']];
function shoot(pos, tgt, fov = 30) { lens(fov); aim(cam, pos, tgt); }
const parab = (a, b, k, h) => vlerp(a, b, k).add(v3(0, Math.sin(Math.PI * k) * h, 0));

function frame(tRaw) {
  const fN = Math.floor(tRaw * FPS + 1e-6); const t = fN / FPS;          // Stop-Motion: 12 Bilder pro Sekunde
  const sh = SH.find((s) => t >= s[0] && t < s[1]) || SH[SH.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1); const tl = t - t0;
  const boil = (o, a = 0.004) => { const k = Math.sin(fN * 91.7 + o) * 0.5; return k * a; };
  // Standard-Zustand
  MU.lid.position.set(0, MU.topY, 0); MU.lid.rotation.set(0, 0, 0); MU.lid.visible = true; MU.blades.rotation.y = 0;
  MU.group.position.set(0.9, 0, -0.6); MU.group.rotation.set(0, -0.35, 0); MU.btn.position.z = 0.66;
  powder.visible = false; crumbs.visible = false; BW.visible = false; CUP.visible = true; steam.forEach((s) => (s.visible = false)); HAND.visible = false; cinn.visible = false; nuts.forEach((n) => (n.visible = false)); spices.forEach((s) => (s.m.visible = false));
  MU.group.visible = true; crumbs.visible = false;
  CUP.position.set(-2.4, 0, -1.6);
  // Bohnen
  const top = MUTOP(); MU.group.updateMatrixWorld(true);
  const lidOff = t < 6.25;
  beans.forEach((b, i) => {
    b.g.visible = true;
    const k = seg(t, b.hop, b.hop + 0.42);
    if (t < 8.4) {
      if (k <= 0) { b.g.position.copy(b.home); b.g.scale.setScalar(0.62); b.g.position.y += boil(i, 0.006);
        if (t < 3.0 && i % 5 === 0) { const ph = ((t * 1.4 + i * 0.13) % 1); const hop = Math.sin(Math.PI * Math.min(1, ph * 2.2)) * (ph < 0.45 ? 1 : 0); b.g.position.y += hop * 0.32; b.g.position.x += Math.sin(i) * 0.12 * hop; b.g.rotation.z += hop * 2.5; } b.g.rotation.set(b.rot.x, b.rot.y, b.rot.z); }
      else { const inside = MU.group.localToWorld(v3(Math.cos(b.inA) * b.inR, MU.bowlY + 0.25 + b.inY, Math.sin(b.inA) * b.inR));
        b.g.position.copy(parab(b.home, inside, ease.inOut(k), 1.0 + (i % 3) * 0.2)); b.g.rotation.set(b.rot.x + k * 6, b.rot.y + k * 3, b.rot.z);
        const q = 0.62; if (k < 0.12) b.g.scale.set(1.15 * q, 0.8 * q, 1.15 * q); else if (k > 0.9) b.g.scale.set(1.1 * q, 0.85 * q, 1.1 * q); else b.g.scale.set(0.92 * q, 1.12 * q, 0.92 * q); }
    } else b.g.visible = false;
  });
  // Deckel + Hand
  if (t >= 6.0 && t < 8.4) { const k = ease.in(seg(t, 6.0, 6.35)); MU.lid.position.y = MU.topY + (1 - k) * 1.6; const sq = t > 6.35 && t < 6.5 ? 0.94 : 1; MU.lid.scale.set(1 / sq, sq, 1 / sq); }
  else MU.lid.scale.set(1, 1, 1);
  if (lidOff && t >= 3.0) MU.lid.visible = false;
  if (t < 3.0) MU.lid.visible = true;
  const pressK = seg(t, 7.0, 7.4) - seg(t, 7.9, 8.2);
  if (t >= 6.5 && t < 8.4) { HAND.visible = true; const bp = MU.group.localToWorld(v3(0, 0.57, 0.66)); const inK = ease.out(seg(t, 6.5, 7.0)) - ease.in(seg(t, 8.1, 8.4));
    HAND.position.copy(bp).add(v3(-0.2 * Math.sin(0.35), -0.03, 0.56 + (1 - inK) * 2.4 - pressK * 0.08)); HAND.rotation.set(0, -0.35, 0); MU.btn.position.z = 0.66 - pressK * 0.03; }
  // Mahlen
  if (name === 'grind') {
    const g = seg(t, 8.5, 10.7); MU.blades.rotation.y = fN * 1.3;
    MU.group.position.x = 0.9 + Math.sin(fN * 2.1) * 0.006; MU.group.position.z = -0.6 + Math.cos(fN * 1.7) * 0.006;
    beans.forEach((b, i) => { b.g.visible = g < 0.85; const a = b.inA + fN * 0.9 + i; const rr = b.inR * (1 - g * 0.5) + 0.1; const p = MU.group.localToWorld(v3(Math.cos(a) * rr, MU.bowlY + 0.2 + b.inY * (1 - g) + 0.1 * Math.sin(fN + i), Math.sin(a) * rr));
      b.g.position.copy(p); b.g.scale.setScalar(0.62 * Math.max(0.15, 1 - g * 1.1)); b.g.rotation.set(fN * 0.7 + i, fN * 0.5, 0); });
    powder.visible = true; const ph = 0.05 + g * 0.42; powder.scale.set(1, ph, 1); powder.position.y = MU.bowlY + 0.12 + ph / 2; powder.rotation.y = fN * 0.4;
    crumbs.visible = true; CR.forEach((c, i) => { const a = c[0] + fN * 0.8 * (1 - c[1]); dummy.position.set(Math.cos(a) * c[1], MU.bowlY + 0.14 + ph + c[2] * 0.12 * (1 - g) + 0.03 * Math.sin(fN + i), Math.sin(a) * c[1]); dummy.rotation.set(c[3] + fN, c[3], 0); dummy.scale.setScalar(c[4] * (1.3 - g * 0.8)); dummy.updateMatrix(); crumbs.setMatrixAt(i, dummy.matrix); }); crumbs.instanceMatrix.needsUpdate = true;
  }
  // Szenen
  let FP = MUTOP(), AP = 0.0018;
  if (name === 'pile') {
    const k = Math.floor(t * 4) / 4 / 3;   // Kamera ruckt in kleinen Stop-Motion-Schritten
    shoot(v3(lerp(-1.3, -0.9, k), lerp(0.7, 0.62, k), lerp(3.9, 3.6, k)), v3(-0.35, 0.3, 0.85), 34); FP = PILE.clone(); AP = 0.003;
  } else if (name === 'hop') {
    shoot(v3(lerp(-0.9, -0.6, sp), 2.7, 8.4), v3(0.05, 1.25, 0.2), 34); FP = v3(0, 0.8, 0); AP = 0.0016;
  } else if (name === 'press') {
    shoot(v3(2.9, 1.7, 5.6), v3(0.75, 1.85, -0.3), 32); FP = MU.group.localToWorld(v3(0, 0.8, 0.6)); AP = 0.0022;
  } else if (name === 'grind') {
    const p = MUTOP(); shoot(v3(p.x + 0.4, p.y + 3.2, p.z + 1.9), v3(p.x, p.y + 0.1, p.z - 0.75), 34); FP = v3(p.x, p.y - 0.4, p.z); AP = 0.0025;
  } else if (name === 'bowls') {
    BW.visible = true; BW.position.set(0.4, 0, 1.4); BW.scale.setScalar(0.8); beans.forEach((b) => (b.g.visible = false)); CUP.visible = false; MU.group.visible = false;
    shoot(v3(0.4, 3.6, 5.2), v3(0.4, 0.15, 1.4), 40); FP = v3(0.4, 0.25, 1.4); AP = 0.0018;
  } else if (name === 'spice') {
    beans.forEach((b) => (b.g.visible = false)); MU.lid.visible = false;
    const inside = (a, rr, y) => MU.group.localToWorld(v3(Math.cos(a) * rr, MU.bowlY + 0.25 + y, Math.sin(a) * rr));
    spices.forEach((s, i) => { s.m.visible = true; const k = seg(t, s.hop, s.hop + 0.4); s.m.position.copy(k <= 0 ? s.home : parab(s.home, inside(i, 0.3, 0.05), ease.inOut(k), 0.9)); });
    cinn.visible = true; { const k = seg(t, 14.9, 15.4); const a = v3(-1.0, 0.07, 1.2); cinn.position.copy(k <= 0 ? a : parab(a, inside(1, 0.1, 0.25), ease.inOut(k), 1.1)); cinn.rotation.set(0, k * 2, Math.PI / 2 - k * 1.2); }
    nuts.forEach((n, i) => { n.visible = true; const a = v3(-0.55 + i * 0.28, 0.1, 1.5); const k = seg(t, 15.4 + i * 0.12, 15.8 + i * 0.12); n.position.copy(k <= 0 ? a : parab(a, inside(2 + i, 0.25, 0.1), ease.inOut(k), 1.0)); n.rotation.y = k * 4; });
    shoot(v3(lerp(-1.3, -1.0, sp), 3.0, 8.0), v3(-0.1, 1.45, 0.3), 32); FP = v3(-0.3, 0.6, 0.6); AP = 0.0016;
  } else {
    beans.forEach((b, i) => { b.g.visible = i < 12; b.g.position.copy(PILE).add(v3(0.4 + (i % 4) * 0.22, 0.07, -0.2 + Math.floor(i / 4) * 0.22)); });
    CUP.position.set(-0.5, 0, 0.4);
    steam.forEach((s, i) => { s.visible = true; const ph = ((fN / FPS) * 0.5 + i / 3) % 1; s.position.set(-0.5 + Math.sin(ph * 6 + i) * 0.06, 0.8 + ph * 1.0, 0.4); s.rotation.set(Math.PI / 2 - 0.3, 0, ph * 2); s.scale.setScalar(1 - ph * 0.4); s.material.opacity = 1 - ph; });
    if (name === 'hero') { shoot(v3(lerp(-0.2, 0.0, sp), 2.4, 8.6), v3(0.2, 1.8, -0.2), 30); FP = MUTOP().add(v3(0, -0.6, 0)); AP = 0.0014; }
    else if (name === 'hero2') { shoot(v3(lerp(-2.4, -2.2, sp), 1.9, 7.8), v3(0.1, 2.25, -0.1), 30); FP = MUTOP().add(v3(0, -0.7, 0)); AP = 0.0016; }
    else { shoot(v3(2.4, 1.6, 6.8), v3(0.55, 1.95, -0.4), 28); FP = MUTOP().add(v3(0, -0.7, 0)); AP = 0.0018; }
  }
  // Boil: Kamera ruckelt minimal wie auf einem echten Stop-Motion-Set
  cam.position.x += boil(1, 0.004); cam.position.y += boil(2, 0.003); cam.updateMatrixWorld();
  leaves.forEach((l, i) => (l.rotation.z += boil(i + 7, 0.01)));

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1; tx.word.style.opacity = t < 3.2 || t >= 16.2 ? 1 : 0;
  show(tx.t1, t >= 0.15 && t < 3.0 ? t - 0.15 : -1, 0, fN, -1.5);
  show(tx.t2, t >= 3.25 && t < 6.0 ? t - 3.25 : -1, 0, fN, 1.2);
  show(tx.t3, t >= 6.25 && t < 8.4 ? t - 6.25 : -1, 0, fN, -1);
  show(tx.t4, t >= 8.7 && t < 11.0 ? t - 8.7 : -1, 0, fN, 1.5);
  show(tx.t5, t >= 11.2 && t < 13.6 ? t - 11.2 : -1, 0, fN, -1.2);
  show(tx.t6, t >= 13.8 && t < 16.2 ? t - 13.8 : -1, 0, fN, 1);
  show(tx.p, t >= 16.4 ? t - 16.4 : -1, 0, fN, -2);
  show(tx.t7, t >= 17.0 && t < 19.5 ? t - 17.0 : -1, 0, fN, 1.5);
  show(tx.cta, t >= 19.5 ? t - 19.5 : -1, 0, fN, -1);
  P.focus(cam.position.distanceTo(FP), AP, 0.012);
  P.render();
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
