// Maios CGI – Elektrischer Wasserspender fuer Schreibtisch (Produkt 10, Weiss) mit Figur "Mo": "Jeden Morgen dasselbe.", Loop-Clip 8 s (Render 8,4 s)
// Vorbild-Muster (Marketing/cgi/vorbilder.md): wiederkehrende eigene Figur, Mini-Geschichte "das Uebliche" (Gallone schleppen, Pfuetze) -> Produkt als Loesung.
// Ablauf: Mo schleppt die Gallone (Hook) -> kippt, Pfuetze -> Spender, Schlauch rein, Glas fuellt sich, Mo freut sich -> Preis + Link -> zurueck zu Mo mit Gallone (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makePost } from '../lib/post.js';
import { makeTiefe } from '../lib/tiefe.js';
import { makeWsSzene } from '../lib/ws_szene.js';
import * as WM from '../lib/ws_models.js';
import { makeKid } from '../lib/figur_pro.js';

const style = document.createElement('style');
style.textContent = BR.CSS + `
.tt{position:absolute;left:70px;width:800px;text-align:center;font:800 68px Manrope;line-height:1.16;color:#fff;letter-spacing:-.005em;
  text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.75),0 0 22px rgba(0,0,0,.45)}
.tt.big{font-size:150px;letter-spacing:-.02em}
.tt{text-transform:uppercase;font-size:62px;letter-spacing:.015em;line-height:1.12}
.tt .hl{color:#ffb23e}
.tt.big{text-transform:none}
.tt.k{font-size:52px;font-weight:700;opacity:.95}
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(0,0,0,.42)}
.tword{position:absolute;top:208px;padding:7px 14px 6px;border-radius:12px;background:rgba(0,0,0,.42);font:700 32px Manrope;color:#fff;letter-spacing:.01em;text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.7)}
.tcta{position:absolute;left:270px;width:400px;text-align:center;font:800 44px Manrope;color:#111;background:#fff;border-radius:18px;padding:20px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 40px Manrope', 'ßü€·?:\'');

const r = makeRenderer(); r.localClippingEnabled = true;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
const S = makeWsSzene(scene, cam);
const { W, csW, G, J } = S;
const R = rng(12);
for (const m of [W.body]) { m.envMapIntensity = 0.45; m.sheen = 0; }
// Auslauf-Ende vorne wie am echten Geraet in Gehaeusefarbe, nur die Duese bleibt roségold
W.group.traverse((o) => { if (o.isMesh && o.material === W.metal && o.geometry.parameters && o.geometry.parameters.radiusTop === 0.082) o.material = W.body; });

// ---------- Zimmer: helle Wand (Salbei), Sonne mit Fensterkreuz und Blattschatten ----------
const wallMat = new THREE.MeshStandardMaterial({ color: '#16232b', roughness: 0.93 });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), wallMat); wall.position.set(0, 5, -4.6); wall.receiveShadow = true; scene.add(wall);
const sunTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff'; const x0 = w * 0.14, x1 = w * 0.86, y0 = h * 0.1, y1 = h * 0.9, m = 14;
  g.fillRect(x0, y0, (x1 - x0) / 2 - m / 2, (y1 - y0) / 2 - m / 2); g.fillRect(w / 2 + m / 2, y0, (x1 - x0) / 2 - m / 2, (y1 - y0) / 2 - m / 2);
  g.fillRect(x0, h / 2 + m / 2, (x1 - x0) / 2 - m / 2, (y1 - y0) / 2 - m / 2); g.fillRect(w / 2 + m / 2, h / 2 + m / 2, (x1 - x0) / 2 - m / 2, (y1 - y0) / 2 - m / 2);
  g.fillStyle = '#000';                       // Blaetter vor dem Fenster
  for (let i = 0; i < 14; i++) { g.save(); g.translate(w * (0.62 + R() * 0.3), h * (0.08 + R() * 0.5)); g.rotate(R() * 6.28); g.beginPath(); g.ellipse(0, 0, 14 + R() * 10, 44 + R() * 20, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g2 = c2.getContext('2d'); g2.filter = 'blur(5px)'; g2.drawImage(g.canvas, 0, 0); g.drawImage(c2, 0, 0);
});
const sun = new THREE.SpotLight('#fff4e4', 0, 40, 0.34, 0.25, 1.0); sun.map = sunTex; sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
sun.position.set(-9, 8.5, 6.5); sun.target.position.set(0.8, 1.6, -3.8); scene.add(sun, sun.target);

// Becher mit Stiften und Notizblock als zusaetzliche Requisiten
const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.75, 32), new THREE.MeshStandardMaterial({ color: '#e9e4da', roughness: 0.6 })); cup.position.set(-1.45, 0.375, 0.7); cup.castShadow = true; scene.add(cup);
for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), new THREE.MeshStandardMaterial({ color: ['#2b2b2b', '#c94c3c', '#2f6fb0', '#e0b13a'][i], roughness: 0.5 })); p.position.set(-1.45 + (i - 1.5) * 0.08, 0.9, 0.7 + (i % 2 - 0.5) * 0.1); p.rotation.z = (i - 1.5) * 0.12; scene.add(p); }
const pad = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 1.5), new THREE.MeshStandardMaterial({ color: '#f4f0e6', roughness: 0.8 })); pad.position.set(-1.0, 0.02, 1.6); pad.rotation.y = -0.3; pad.receiveShadow = true; scene.add(pad);

// Schlauch: hinten aus dem Sockel, ueber den Tisch, hinter der Flasche hoch, ueber den Hals und innen bis zum Boden
// (undurchsichtig, damit er durch Flasche und Wasser zu sehen ist)
const TUBE = WM.makeTube([v3(0, 0.16, -1.13), v3(0.1, 0.05, -1.5), v3(0.8, 0.04, -2.45), v3(1.6, 0.05, -2.78), v3(1.92, 0.6, -2.7),
  v3(2.0, 1.9, -2.64), v3(2.04, 2.7, -2.25), v3(2.05, 3.1, -1.95), v3(2.05, 3.0, -1.76), v3(2.05, 2.5, -1.75), v3(2.05, 0.25, -1.75)], 0.034);
TUBE.mat.transparent = false; TUBE.mat.opacity = 1; TUBE.mat.color.set('#ecebe7'); scene.add(TUBE.mesh);


import { STORY_CSS, makeKit } from '../lib/story_kit.js';
const st2 = document.createElement('style'); st2.textContent = STORY_CSS; document.head.appendChild(st2);
await document.fonts.load('800 italic 70px Manrope', 'ßü€·?:✕✓');

// ---------- Allgemein ----------
const owned = new Set([S.caustics, S.stream, ...S.drops.map((d) => d.m), ...S.bubbles.map((b) => b.m)]);
const heroMeshes = scene.children.filter((c) => c.isMesh && !owned.has(c) && c !== TUBE.mesh);
const P = makePost(r, scene, cam, { strength: 0.16, radius: 0.6, threshold: 0.95 });
scene.fog = new THREE.FogExp2('#0b141a', 0.02);
const { SW, csS } = S;
for (const m of [SW.body]) { m.envMapIntensity = 0.45; m.sheen = 0; }

// ---------- Kulissen: Nachtstadt (Lila/Pink), Blaupause (Blau mit Raster) ----------
const cityTex = canvasTex(1024, 1024, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d0b3d'); gr.addColorStop(0.55, '#5a1a78'); gr.addColorStop(1, '#c2458f'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const Rc = rng(5);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + Rc() * 0.5})`; g.fillRect(Rc() * w, Rc() * h * 0.45, 2, 2); }
  for (let layer = 0; layer < 2; layer++) {
    let x = -20; const base = h * (0.62 + layer * 0.06); g.fillStyle = layer ? '#150a2a' : '#26103f';
    while (x < w) { const bw = 50 + Rc() * 80, bh = 120 + Rc() * (260 - layer * 90); g.fillStyle = layer ? '#150a2a' : '#26103f'; g.fillRect(x, base - bh + layer * 40, bw, bh + 400);
      for (let wy = base - bh + 14 + layer * 40; wy < base + 20; wy += 22) for (let wx = x + 8; wx < x + bw - 10; wx += 16) if (Rc() < 0.42) { g.fillStyle = ['#ffd27a', '#7ee8ff', '#ff7ad1'][Math.floor(Rc() * 3)]; g.globalAlpha = 0.5 + Rc() * 0.5; g.fillRect(wx, wy, 7, 10); g.globalAlpha = 1; }
      x += bw + 4; }
  }
});
const city = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: cityTex, toneMapped: false })); city.position.set(0, 7.5, -9); scene.add(city);
const cityFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: '#1b0f33', roughness: 0.55, metalness: 0.2 })); cityFloor.rotation.x = -Math.PI / 2; cityFloor.position.y = 0; cityFloor.receiveShadow = true; scene.add(cityFloor);
const blueTex = canvasTex(1024, 1024, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h * 0.5, w * 0.8); gr.addColorStop(0, '#0e3aa0'); gr.addColorStop(1, '#061a52'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(150,190,255,.16)'; g.lineWidth = 2; for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  g.strokeStyle = 'rgba(150,190,255,.07)'; g.lineWidth = 1; for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
});
const blue = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: blueTex, toneMapped: false })); blue.position.set(0, 2.2, -4.2); scene.add(blue);

// ---------- Figuren (erwachsen, matt) ----------
const trM = new THREE.MeshStandardMaterial({ color: '#2b3541', roughness: 0.9 }), shoeM = new THREE.MeshStandardMaterial({ color: '#0f1115', roughness: 0.5 });
const LEG = 0.85 * 0.6;
const PUL = ['#51697c', '#c99a3a', '#b8503f', '#3f8a6a', '#4a5fa8', '#8a5aa0', '#607d8b'];
function mkFigure(col) {
  const K = makeKid(); scene.add(K.group); K.group.scale.setScalar(0.6); K.torso.material.color.set(col);
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.24 * s, 0.35, 0); K.group.add(p);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.62, 6, 12), trM); l.position.y = -0.5; l.castShadow = true; p.add(l);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), shoeM); f.scale.set(1, 0.6, 1.6); f.position.set(0, -1.07, 0.1); f.castShadow = true; p.add(f); return p; });
  const jug = WM.makeJug(); jug.cap.visible = true; K.group.add(jug.group); jug.group.position.set(0, 0, 1.3); jug.group.scale.setScalar(0.7);
  return { K, legs, jug };
}
const SPOT = [[-1.7, 0], [0, 0], [1.7, 0], [-2.6, -1.9], [-0.9, -1.9], [0.9, -1.9], [2.6, -1.9]];
const crowd = SPOT.map((p, i) => ({ ...mkFigure(PUL[i]), x: p[0], z: p[1], ph: i * 0.37 }));
const hero = crowd[1];
function walkFig(f, u, amp = 0.33) { const w = Math.sin((u + f.ph) * 2 * Math.PI / 0.6); f.legs[0].rotation.x = w * amp; f.legs[1].rotation.x = -w * amp; f.K.body.position.y = Math.abs(Math.cos((u + f.ph) * 2 * Math.PI / 0.6)) * 0.05; }
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 12, 64), new THREE.MeshBasicMaterial({ color: '#ffd45c', toneMapped: false })); scene.add(ring);
const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshPhysicalMaterial({ color: '#cfeefa', roughness: 0.03, transparent: true, opacity: 0.78, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false }));
puddle.rotation.x = -Math.PI / 2; puddle.position.y = 0.012; puddle.renderOrder = 5; scene.add(puddle);

// ---------- Spender: Umriss und Explosionsansicht ----------
const outlines = [];
W.group.traverse((m) => { if (m.isMesh && m.geometry && m.geometry.type !== 'CircleGeometry' && m.geometry.type !== 'RingGeometry') { const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), new THREE.LineBasicMaterial({ color: '#ffe08a', toneMapped: false })); m.add(l); outlines.push(l); } });
const kids = W.group.children; const orig = kids.map((c) => c.position.clone());
function explode(e) {
  kids.forEach((c, i) => c.position.copy(orig[i]));
  for (const i of [5, 6, 7, 8, 9, 10, 11]) kids[i].position.y += 0.9 * e;
  for (const i of [9, 10, 11]) { kids[i].position.z += 0.75 * e; kids[i].position.y += 0.25 * e; }
  kids[0].position.y -= 0.15 * e; kids[1].position.y -= 0.15 * e; kids[2].position.y -= 0.15 * e;
}
const glowOn = (on) => { W.body.emissive = new THREE.Color(on ? '#4f7dff' : '#000000'); W.body.emissiveIntensity = on ? 0.22 : 0; outlines.forEach((l) => (l.visible = on)); };

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = { pill: mk('tpill', 'Werbung', 208), word: mk('tword', 'Wasserspender'), cta: mk('tcta', 'Link im Profil', 640) };
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
const KIT = makeKit(ov);
const O = { grain: BR.grain({ amount: 0.07, vig: 'rgba(2,4,8,.6)' }) };

// ---------- Zeitplan ----------
export const DAUER = 20.5;
const BEATS = [[0, 2.6, 'crowd'], [2.6, 5.0, 'kipp'], [5.0, 7.6, 'idee'], [7.6, 11.0, 'teile'], [11.0, 13.8, 'hero1'], [13.8, 16.2, 'hero2'], [16.2, 20.5, 'preis']];
const ON0 = 11.3, ON1 = 16.0;
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.022 * a);
function shoot(t, pos, tgt, a = 1, fov = 32) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
function light(kind) {
  T.mood(1); T.U.uHaloI.value = 0; T.floor.visible = false;
  if (kind === 'city') { T.key.color.set('#ffc6ee'); T.key.intensity = 1.3; T.key.position.set(-3, 6, 7); T.fill.intensity = 0.5; T.fill.color.set('#9a7ad8'); T.fill.groundColor.set('#1a0e30'); T.rim.color.set('#8fd6ff'); T.rim.intensity = 30; T.rim.position.set(3, 3.5, -3); scene.environmentIntensity = 0.3; scene.fog.density = 0.012; }
  else if (kind === 'blue') { T.key.color.set('#cfe0ff'); T.key.intensity = 1.5; T.key.position.set(-3, 6, 7); T.fill.intensity = 0.55; T.fill.color.set('#7da2ff'); T.fill.groundColor.set('#0a1a4a'); T.rim.color.set('#ffe9a8'); T.rim.intensity = 36; T.rim.position.set(3, 3.5, -2.5); scene.environmentIntensity = 0.45; scene.fog.density = 0; }
  else { T.key.color.set('#ffe6c8'); T.key.intensity = 0.8; T.key.position.set(-4, 6, 6); T.fill.intensity = 0.4; T.fill.color.set('#7fa4bc'); T.fill.groundColor.set('#0a0d10'); T.rim.color.set('#8fd6ff'); T.rim.intensity = 40; T.rim.position.set(3.4, 3.6, -2.6); scene.environmentIntensity = 0.28; sun.color.set('#ffd9a8'); sun.intensity = 70; scene.fog.density = 0.02; }
  r.toneMappingExposure = 0.8;
}

function frame(t) {
  const sh = BEATS.find((s) => t >= s[0] && t < s[1]) || BEATS[BEATS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1); const tl = t - t0;
  S.hideAll(); KIT.hideAll(); T.U.uTime.value = t;
  const isCity = name === 'crowd' || name === 'kipp' || name === 'preis';
  const isBlue = name === 'idee' || name === 'teile';
  const isHero = name === 'hero1' || name === 'hero2';
  light(isCity ? 'city' : isBlue ? 'blue' : 'hero');
  city.visible = cityFloor.visible = isCity; blue.visible = isBlue;
  heroMeshes.forEach((m) => (m.visible = isHero)); S.props.visible = S.desk.visible = isHero; S.plant.visible = isHero; S.lap.visible = false; S.plant.position.set(-2.6, 0, -2.6);
  TUBE.mesh.visible = isHero; puddle.visible = false; ring.visible = false; glowOn(false);
  crowd.forEach((f) => (f.K.group.visible = false));
  csW.visible = false; csS.visible = false;
  let subs = null, tagT = null, gold = true;

  if (name === 'crowd') {
    crowd.forEach((f) => { f.K.group.visible = true; f.K.group.position.set(f.x, LEG, f.z); f.K.group.rotation.set(0, 0, Math.sin((t + f.ph) * 2 * Math.PI / 1.2) * 0.06);
      walkFig(f, t); f.jug.group.rotation.set(0, 0, 0); f.jug.group.position.set(0, 0, 1.3);
      f.K.set({ look: [0, -0.5], blink: 0.38, eye: 1.0, mouth: 'frown', brow: -0.35, fwd: 1.35, armL: 0, armR: 0 }); });
    shoot(t, vlerp(v3(0, 1.3, 10.6), v3(0, 1.3, 9.6), sp), v3(0, 1.25, -0.3), 0.5, 40);
    subs = [['Jeden', 'Morgen', 'dieselbe', 'Gallone.'], t < 1.2 ? 2 : 4, t - 0.2];
  } else if (name === 'kipp') {
    crowd.forEach((f) => { f.K.group.visible = true; f.K.group.position.set(f.x, LEG, f.z); f.K.group.rotation.set(0, 0, Math.sin((t + f.ph) * 2 * Math.PI / 1.2) * 0.06); walkFig(f, t);
      f.K.set({ look: [0, -0.5], blink: 0.38, eye: 1.0, mouth: 'frown', brow: -0.35, fwd: 1.35, armL: 0, armR: 0 }); });
    const k = ease.inOut(seg(t, 3.1, 4.0)); const f = hero;
    f.K.group.rotation.set(0, 0.1 + k * 0.1, 0.07 + k * 0.28); walkFig(f, t, 0.33 * (1 - k * 0.8));
    f.jug.group.rotation.set(0, 0, -k * 0.7); f.jug.group.position.set(k * 0.35, -k * 0.15, 1.3 + k * 0.3);
    f.K.set({ look: [0.3, -0.6], blink: 0, eye: 1.12, mouth: 'o', open: 0.3 + k * 0.4, brow: -0.5 - k * 0.5, fwd: 1.35 - k * 0.5, armL: k * 0.5, armR: k * 0.5, headTilt: k * 0.12 });
    puddle.visible = true; const pu = ease.out(seg(t, 3.5, 4.5)); puddle.scale.setScalar(0.001 + 0.7 * pu); puddle.position.set(0.5, 0.012, 0.9);
    ring.visible = true; ring.position.set(0.05 + k * 0.12, LEG + 2.38 * 0.6, 0.2); ring.lookAt(cam.position); ring.scale.setScalar(0.85 * (1 + 0.05 * Math.sin(t * 9)));
    shoot(t, vlerp(v3(0.3, 1.4, 8.4), v3(0.4, 1.35, 7.2), ease.out(sp)), v3(0.1, 0.95, 0.2), 0.7, 32);
    subs = [['Und', 'irgendwann', 'kippt', 'sie.'], tl < 1.2 ? 2 : 4, tl - 0.15];
    KIT.mark(0, 'no', t - 3.9, 760, 1000);
  } else if (name === 'idee') {
    S.placeDisp(W, csW, 0, 0, -0.5); csW.visible = false; glowOn(true); explode(0);
    W.group.rotation.y = -0.5 + tl * 0.25; W.group.updateMatrixWorld(true);
    shoot(t, v3(2.2, 3.0, 11.8), v3(0, 0.9, -0.4), 0.3, 32);
    tagT = ['Eine Idee', tl - 0.1];
    subs = [['Die', 'Flasche', 'bleibt', 'stehen.'], tl < 1.1 ? 2 : 4, tl - 0.3];
  } else if (name === 'teile') {
    const e = ease.inOut(seg(t, 7.8, 8.8)); S.placeDisp(W, csW, 0, 0, -0.5); csW.visible = false; glowOn(true); explode(e);
    W.group.rotation.y = -0.65 + tl * 0.12; W.group.updateMatrixWorld(true);
    shoot(t, v3(2.6, 3.2, 12.4), v3(0, 1.15, -0.2), 0.3, 32);
    const noz = S.screen(W.group, WM.NOZZLE.clone().add(v3(0, e * 1.15, e * 0.75))); const bas = S.screen(W.group, v3(0.6, 0.2 - 0.15 * e, 0.9));
    KIT.callout(0, 'Auslauf', t - 8.9, noz, [Math.min(900, noz[0] + 190), noz[1] - 120]);
    KIT.callout(1, 'Akku', t - 9.5, bas, [Math.max(170, bas[0] - 280), bas[1] - 150]);
    tagT = ['Wiederaufladbar', tl - 0.1];
    subs = [['Für', 'Büro', 'und', 'Zuhause.'], tl < 1.6 ? 2 : 4, tl - 0.5];
  } else if (name === 'hero1' || name === 'hero2') {
    S.placeDisp(W, csW, 0, 0, -0.42); csW.material.opacity = 0.65;
    S.J.group.visible = true; S.J.group.position.set(2.05, 0, -1.75); S.J.group.scale.setScalar(1); S.J.group.rotation.set(0, 0, 0); S.J.cap.visible = false;
    S.glassOn(W, S.G); S.G.group.position.z += 0.08;
    S.water(t, ON0, ON1, S.G, W, 1.02); S.stream.material.emissiveIntensity = 0.3; S.ledOn(W, t > 11.2 && t < 16.1 ? 3.0 : 0, false, t);
    W.group.updateMatrixWorld(true); const gp = S.G.group.position.clone();
    if (name === 'hero1') { shoot(t, vlerp(v3(-2.2, 3.2, 11.6), v3(-1.7, 3.1, 10.6), ease.out(sp)), v3(0.4, 1.15, -0.2), 0.5, 32); subs = [['Schlauch', 'rein.', 'Läuft.'], tl < 1.0 ? 2 : 3, tl - 0.1]; }
    else { const a = lerp(-0.45, -0.1, ease.inOut(sp)); shoot(t, v3(gp.x + Math.sin(a) * 7.2, gp.y + 1.4, gp.z + Math.cos(a) * 7.2), gp.clone().add(v3(-0.45, 0.75, 0)), 0.35, 32); subs = [['Das', 'Glas', 'füllt', 'sich', 'selbst.'], tl < 0.9 ? 2 : 5, tl - 0.1]; }
  } else {   // preis: beide Farben vor der Nachtstadt, Neon-Preis
    S.placeDisp(W, csW, -1.25, 0.2, -0.3); csW.visible = false; S.placeDisp(SW, csS, 1.25, 0.2, 0.3); csS.visible = false; W.group.updateMatrixWorld(true); SW.group.updateMatrixWorld(true);
    S.J.group.visible = false;
    const a = lerp(0.18, -0.1, sp); shoot(t, v3(Math.sin(a) * 12.2, 2.8, Math.cos(a) * 12.2), v3(0, 1.0, 0), 0.4, 32);
    KIT.neonNum('35,99&nbsp;€', tl - 0.1, 0, 330);
    tagT = ['Weiß oder Schwarz', tl - 0.5];
  }
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  tx.word.style.opacity = t < 3.3 ? 1 - seg(t, 3.1, 3.3) : t >= 16.4 ? seg(t, 16.4, 16.6) : 0;
  if (subs) KIT.subtitle(subs[0], subs[1], subs[2], seg(t, t1 - 0.12, t1));
  if (tagT) KIT.tagPill(tagT[0], tagT[1], gold, seg(t, t1 - 0.12, t1), name === 'preis' ? 300 : 300);
  const cta = t >= 17.4 ? t - 17.4 : -1;
  tx.cta.style.opacity = cta < 0 ? 0 : clamp(cta / 0.15); tx.cta.style.transform = `scale(${lerp(0.9, 1, ease.out(seg(cta, 0, 0.3)))})`;
  O.grain(Math.round(t * 30), 1);
  P.render();
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
