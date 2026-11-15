// Maios CGI – Bluetooth Anti-Lost Finder (Produkt 17, Weiss) Story im @mehr.optic-Stil, 20,5 s, kein Loop: "Jeden Morgen dieselbe Suche."
// Beats: Menge gleicher Figuren (alle klopfen Taschen ab) vor Neon-Stadt -> eine Figur ohne Schluessel (Ring, Kreuz) -> Blaupause "Eine Idee" ->
// Explosionsansicht mit Callouts -> Wohnzimmer: Handy zeigt die Suche, Schluessel liegen unter dem Kissen -> Preis (Neon) mit allen sechs Farben.
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex, contactShadow } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makePost } from '../lib/post.js';
import { makeTiefe } from '../lib/tiefe.js';
import { makeKid } from '../lib/figur_pro.js';
import { makeFinder, makeKeys, FARBEN } from '../lib/finder_models.js';
import { STORY_CSS, makeKit } from '../lib/story_kit.js';

const style = document.createElement('style');
style.textContent = BR.CSS + STORY_CSS + `
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(0,0,0,.42)}
.tword{position:absolute;top:208px;padding:7px 14px 6px;border-radius:12px;background:rgba(0,0,0,.42);font:700 32px Manrope;color:#fff;letter-spacing:.01em;text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.7)}
.tcta{position:absolute;left:270px;width:400px;text-align:center;font:800 44px Manrope;color:#111;background:#fff;border-radius:18px;padding:20px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 italic 70px Manrope', 'ßüÜäÄöÖ€·?:✕✓');
await document.fonts.load('800 40px Manrope', 'ßüÜ€·?:');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;
const R = rng(1711);
const P = makePost(r, scene, cam, { strength: 0.16, radius: 0.6, threshold: 0.95 });
scene.fog = new THREE.FogExp2('#0b141a', 0.02);

// ---------- Kulissen: Nachtstadt, Blaupause, Wohnzimmer ----------
const cityTex = canvasTex(1024, 1024, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d0b3d'); gr.addColorStop(0.55, '#5a1a78'); gr.addColorStop(1, '#c2458f'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const Rc = rng(5);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + Rc() * 0.5})`; g.fillRect(Rc() * w, Rc() * h * 0.45, 2, 2); }
  for (let layer = 0; layer < 2; layer++) {
    let x = -20; const base = h * (0.62 + layer * 0.06);
    while (x < w) { const bw = 50 + Rc() * 80, bh = 120 + Rc() * (260 - layer * 90); g.fillStyle = layer ? '#150a2a' : '#26103f'; g.fillRect(x, base - bh + layer * 40, bw, bh + 400);
      for (let wy = base - bh + 14 + layer * 40; wy < base + 20; wy += 22) for (let wx = x + 8; wx < x + bw - 10; wx += 16) if (Rc() < 0.42) { g.fillStyle = ['#ffd27a', '#7ee8ff', '#ff7ad1'][Math.floor(Rc() * 3)]; g.globalAlpha = 0.5 + Rc() * 0.5; g.fillRect(wx, wy, 7, 10); g.globalAlpha = 1; }
      x += bw + 4; }
  }
});
const city = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: cityTex, toneMapped: false })); city.position.set(0, 7.5, -9); scene.add(city);
const cityFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: '#1b0f33', roughness: 0.55, metalness: 0.2 })); cityFloor.rotation.x = -Math.PI / 2; cityFloor.receiveShadow = true; scene.add(cityFloor);
const blueTex = canvasTex(1024, 1024, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h * 0.5, w * 0.8); gr.addColorStop(0, '#0e3aa0'); gr.addColorStop(1, '#061a52'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(150,190,255,.16)'; g.lineWidth = 2; for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  g.strokeStyle = 'rgba(150,190,255,.07)'; g.lineWidth = 1; for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
});
const blue = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: blueTex, toneMapped: false })); blue.position.set(0, 1.6, -4.2); scene.add(blue);
// Wohnzimmer
const ROOM = new THREE.Group(); scene.add(ROOM);
{
  const wallM = new THREE.MeshStandardMaterial({ color: '#8a7f73', roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), wallM); wall.position.set(0, 5, -2.5); wall.receiveShadow = true; ROOM.add(wall);
  const oak = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#9b7a56'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? 'rgba(60,35,15,.12)' : 'rgba(255,230,190,.07)'; g.fillRect(0, i * 25.6, w, 24); g.fillStyle = 'rgba(40,25,10,.25)'; g.fillRect(0, i * 25.6, w, 2); } });
  oak.wrapS = oak.wrapT = THREE.RepeatWrapping; oak.repeat.set(3, 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshStandardMaterial({ map: oak, roughness: 0.55 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 4); floor.receiveShadow = true; ROOM.add(floor);
  const sofaM = new THREE.MeshStandardMaterial({ color: '#2f4a52', roughness: 0.92 });
  const bx = (w, h, d, x, y, z, m = sofaM) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; ROOM.add(b); return b; };
  bx(3.3, 0.45, 1.3, -0.4, 0.225, -1.7); bx(3.3, 1.25, 0.35, -0.4, 0.95, -2.25); bx(0.4, 0.95, 1.3, -2.25, 0.475, -1.7); bx(0.4, 0.95, 1.3, 1.45, 0.475, -1.7);
  const cushM = new THREE.MeshStandardMaterial({ color: '#3b5963', roughness: 0.95 });
  bx(1.3, 0.22, 1.0, -1.0, 0.56, -1.6, cushM); bx(1.3, 0.22, 1.0, 0.3, 0.56, -1.6, cushM);
  // Deko-Kissen (liegt auf den Schluesseln)
  const pil = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.2, 0.7, 6, 2, 6), new THREE.MeshStandardMaterial({ color: '#d1a45a', roughness: 0.9 })); pil.castShadow = true; ROOM.add(pil); ROOM.userData.pil = pil;
  // Couchtisch + Teppich
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.4), new THREE.MeshStandardMaterial({ color: '#cfc6b6', roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.3, 0.004, 0.5); rug.receiveShadow = true; ROOM.add(rug);
  const wood = new THREE.MeshStandardMaterial({ color: '#5a4332', roughness: 0.55 });
  bx(2.0, 0.1, 1.0, 1.2, 0.5, 1.3, wood); for (const [x, z] of [[0.3, 0.9], [2.1, 0.9], [0.3, 1.7], [2.1, 1.7]]) bx(0.09, 0.5, 0.09, x, 0.25, z, wood);
}
// Schluesselbund (Weiss) unter dem Kissen
const KEYS = makeKeys('weiss'); KEYS.group.scale.setScalar(0.34); scene.add(KEYS.group);
// Handy auf dem Couchtisch, Bildschirm = Suche (Ringe + Punkt)
const scr = document.createElement('canvas'); scr.width = 320; scr.height = 640; const sg = scr.getContext('2d');
const scrTex = new THREE.CanvasTexture(scr); scrTex.colorSpace = THREE.SRGBColorSpace;
const phone = new THREE.Group(); scene.add(phone);
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.2, 0.06), new THREE.MeshPhysicalMaterial({ color: '#15171c', roughness: 0.3, clearcoat: 0.8 })); body.castShadow = true; phone.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.12), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })); face.position.z = 0.032; phone.add(face);
}
function drawScreen(t, locked) {
  sg.fillStyle = '#0a1422'; sg.fillRect(0, 0, 320, 640);
  const cx = 160, cy = 330;
  sg.strokeStyle = 'rgba(120,200,255,.35)'; sg.lineWidth = 3; for (const rr of [60, 110, 160]) { sg.beginPath(); sg.arc(cx, cy, rr, 0, Math.PI * 2); sg.stroke(); }
  for (let i = 0; i < 3; i++) { const k = ((t * 0.9 + i / 3) % 1); sg.strokeStyle = `rgba(90,220,170,${0.7 * (1 - k)})`; sg.lineWidth = 4; sg.beginPath(); sg.arc(cx, cy, 20 + k * 150, 0, Math.PI * 2); sg.stroke(); }
  sg.fillStyle = '#fff'; sg.beginPath(); sg.arc(cx, cy, 12, 0, Math.PI * 2); sg.fill();
  const bx2 = lerp(cx + 95, cx + 12, locked), by2 = lerp(cy - 80, cy - 10, locked);   // gesuchter Punkt wandert zur Mitte
  sg.fillStyle = '#3ee08f'; sg.shadowColor = '#3ee08f'; sg.shadowBlur = 24; sg.beginPath(); sg.arc(bx2, by2, 16 + 3 * Math.sin(t * 8), 0, Math.PI * 2); sg.fill(); sg.shadowBlur = 0;
  scrTex.needsUpdate = true;
}
const sigRings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.0, 64), new THREE.MeshBasicMaterial({ color: '#7dffc2', transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); scene.add(m); return m; });

// ---------- Figuren (erwachsen, matt) ----------
const trM = new THREE.MeshStandardMaterial({ color: '#2b3541', roughness: 0.9 }), shoeM = new THREE.MeshStandardMaterial({ color: '#0f1115', roughness: 0.5 });
const LEG = 0.85 * 0.6;
const PUL = ['#51697c', '#c99a3a', '#b8503f', '#3f8a6a', '#4a5fa8', '#8a5aa0', '#607d8b'];
function mkFigure(col) {
  const K = makeKid(); scene.add(K.group); K.group.scale.setScalar(0.6); K.torso.material.color.set(col);
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.24 * s, 0.35, 0); K.group.add(p);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.62, 6, 12), trM); l.position.y = -0.5; l.castShadow = true; p.add(l);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), shoeM); f.scale.set(1, 0.6, 1.6); f.position.set(0, -1.07, 0.1); f.castShadow = true; p.add(f); return p; });
  return { K, legs };
}
const SPOT = [[-1.7, 0], [0, 0], [1.7, 0], [-2.6, -1.9], [-0.9, -1.9], [0.9, -1.9], [2.6, -1.9]];
const crowd = SPOT.map((p, i) => ({ ...mkFigure(PUL[i]), x: p[0], z: p[1], ph: i * 0.37 }));
const hero = crowd[1];
function walkFig(f, u, amp = 0.33) { const w = Math.sin((u + f.ph) * 2 * Math.PI / 0.6); f.legs[0].rotation.x = w * amp; f.legs[1].rotation.x = -w * amp; f.K.body.position.y = Math.abs(Math.cos((u + f.ph) * 2 * Math.PI / 0.6)) * 0.05; }
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 12, 64), new THREE.MeshBasicMaterial({ color: '#ffd45c', toneMapped: false })); scene.add(ring);
const mo = mkFigure('#51697c'); mo.K.group.scale.setScalar(0.62);   // Mo im Wohnzimmer

// ---------- Finder fuer Blaupause und Preis ----------
const FD = makeFinder('weiss'); scene.add(FD.group);
const outlines = [];
FD.group.traverse((m) => { if (m.isMesh && m.geometry && !['CylinderGeometry', 'CircleGeometry', 'RingGeometry', 'TorusGeometry'].includes(m.geometry.type)) { const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), new THREE.LineBasicMaterial({ color: '#ffe08a', toneMapped: false })); m.add(l); outlines.push(l); } });
const glowOn = (on) => { FD.body.emissive = new THREE.Color(on ? '#4f7dff' : '#000000'); FD.body.emissiveIntensity = on ? 0.22 : 0; outlines.forEach((l) => (l.visible = on)); };
const SIX = ['schwarz', 'weiss', 'gruen', 'pink', 'gold', 'silber'].map((k) => { const f = makeFinder(k); scene.add(f.group); return f; });
const csFD = contactShadow(1.6, 0.6); scene.add(csFD);

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = { pill: mk('tpill', 'Werbung', 208), word: mk('tword', 'Finder'), cta: mk('tcta', 'Link im Profil', 640) };
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
const KIT = makeKit(ov);
const O = { grain: BR.grain({ amount: 0.07, vig: 'rgba(2,4,8,.6)' }) };

// ---------- Zeitplan ----------
export const DAUER = 20.5;
const BEATS = [[0, 2.6, 'crowd'], [2.6, 5.0, 'kipp'], [5.0, 7.6, 'idee'], [7.6, 11.0, 'teile'], [11.0, 13.8, 'hero1'], [13.8, 16.2, 'hero2'], [16.2, 20.5, 'preis']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.022 * a);
function shoot(t, pos, tgt, a = 1, fov = 32) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
function light(kind) {
  T.mood(1); T.U.uHaloI.value = 0; T.floor.visible = false;
  if (kind === 'city') { T.key.color.set('#ffc6ee'); T.key.intensity = 1.3; T.key.position.set(-3, 6, 7); T.fill.intensity = 0.5; T.fill.color.set('#9a7ad8'); T.fill.groundColor.set('#1a0e30'); T.rim.color.set('#8fd6ff'); T.rim.intensity = 30; T.rim.position.set(3, 3.5, -3); scene.environmentIntensity = 0.3; scene.fog.density = 0.012; }
  else if (kind === 'blue') { T.key.color.set('#cfe0ff'); T.key.intensity = 1.5; T.key.position.set(-3, 6, 7); T.fill.intensity = 0.55; T.fill.color.set('#7da2ff'); T.fill.groundColor.set('#0a1a4a'); T.rim.color.set('#ffe9a8'); T.rim.intensity = 36; T.rim.position.set(3, 3.5, -2.5); scene.environmentIntensity = 0.45; scene.fog.density = 0; }
  else { T.key.color.set('#ffe6c8'); T.key.intensity = 1.5; T.key.position.set(-4, 7, 6); T.fill.intensity = 0.55; T.fill.color.set('#b9c7d4'); T.fill.groundColor.set('#2a2018'); T.rim.color.set('#ffd9a8'); T.rim.intensity = 30; T.rim.position.set(3.4, 3.6, -1.6); scene.environmentIntensity = 0.45; scene.fog.density = 0.006; }
  r.toneMappingExposure = 0.85;
}
const KPOS = v3(-0.55, 0.69, -1.5);   // Schluessel unter dem Kissen (Welt)
function placeKeys(lift) {   // lift 0 = liegt, 1 = in Mos Hand (hoch)
  const g = KEYS.group; g.position.copy(KPOS).add(v3(0, 0.55 * lift, 0.9 * lift)); g.rotation.set(-Math.PI / 2 + lift * 1.0, 0, 0.5 - lift * 0.5);
}

function frame(t) {
  const sh = BEATS.find((s) => t >= s[0] && t < s[1]) || BEATS[BEATS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1); const tl = t - t0;
  KIT.hideAll(); T.U.uTime.value = t;
  const isCity = name === 'crowd' || name === 'kipp' || name === 'preis';
  const isBlue = name === 'idee' || name === 'teile';
  const isHero = name === 'hero1' || name === 'hero2';
  light(isCity ? 'city' : isBlue ? 'blue' : 'hero');
  city.visible = cityFloor.visible = isCity; blue.visible = isBlue; ROOM.visible = isHero;
  phone.visible = KEYS.group.visible = isHero; mo.K.group.visible = isHero; sigRings.forEach((m) => (m.visible = false));
  ring.visible = false; FD.group.visible = false; glowOn(false); csFD.visible = false; SIX.forEach((f) => (f.group.visible = false));
  crowd.forEach((f) => (f.K.group.visible = false));
  let subs = null, tagT = null, gold = true;

  if (name === 'crowd' || name === 'kipp') {
    const k = name === 'kipp' ? ease.inOut(seg(t, 3.1, 4.0)) : 0;
    crowd.forEach((f) => {
      const isH = name === 'kipp' && f === hero;
      f.K.group.visible = true; f.K.group.position.set(f.x, LEG, f.z); f.K.group.rotation.set(0, isH ? 0.1 + k * 0.1 : 0, Math.sin((t + f.ph) * 2 * Math.PI / 1.2) * 0.06);
      walkFig(f, t, isH ? 0.33 * (1 - k * 0.8) : 0.33);
      const pat = 0.55 + 0.35 * Math.sin(t * 9 + f.ph * 7);            // Taschen abklopfen
      const lk = Math.sin(t * 3 + f.ph * 5);
      if (isH) f.K.set({ look: [0.8 * Math.sin(t * 4), -0.2], blink: 0, eye: 1.12, mouth: 'o', open: 0.2 + k * 0.4, brow: -0.5 - k * 0.5, fwd: lerp(pat, 0.2, k), armL: lerp(0.5, 1.1, k), armR: lerp(0.5, 1.1, k), headTilt: k * 0.12 });
      else f.K.set({ look: [lk, -0.3], blink: 0.38, eye: 1.0, mouth: 'frown', brow: -0.35, fwd: pat, armL: 0.5, armR: 0.5 });
    });
    if (name === 'crowd') { shoot(t, vlerp(v3(0, 1.3, 10.6), v3(0, 1.3, 9.6), sp), v3(0, 1.25, -0.3), 0.5, 40); subs = [['Jeden', 'Morgen', 'dieselbe', 'Suche.'], t < 1.2 ? 2 : 4, t - 0.2]; }
    else {
      ring.visible = true; ring.position.set(0.05 + k * 0.12, LEG + 2.38 * 0.6, 0.2); ring.lookAt(cam.position); ring.scale.setScalar(0.85 * (1 + 0.05 * Math.sin(t * 9)));
      shoot(t, vlerp(v3(0.3, 1.4, 8.4), v3(0.4, 1.35, 7.2), ease.out(sp)), v3(0.1, 0.95, 0.2), 0.7, 32);
      subs = [['Und', 'der', 'Schlüssel?', 'Weg.'], tl < 1.2 ? 2 : 4, tl - 0.15];
      KIT.mark(0, 'no', t - 3.9, 760, 1000);
    }
  } else if (name === 'idee') {
    FD.group.visible = true; glowOn(true); FD.explode(0); FD.group.position.set(0, 1.1, 0); FD.group.scale.setScalar(1.85);
    FD.group.rotation.set(-0.08, -0.5 + tl * 0.5, 0.0); FD.group.updateMatrixWorld(true);
    shoot(t, v3(2.0, 2.6, 11.4), v3(0, 1.45, -0.4), 0.3, 32);
    tagT = ['Eine Idee', tl - 0.1];
    subs = [['Ein', 'kleiner', 'Anhänger.'], tl < 1.0 ? 1 : 3, tl - 0.3];
  } else if (name === 'teile') {
    const e = ease.inOut(seg(t, 7.8, 8.8)); FD.group.visible = true; glowOn(true); FD.explode(e);
    FD.group.position.set(0, 1.15, 0); FD.group.scale.setScalar(1.7); FD.group.rotation.set(-0.12, -0.75 + tl * 0.18, 0); FD.group.updateMatrixWorld(true);
    shoot(t, v3(3.0, 3.0, 14.5), v3(0, 1.4, -0.2), 0.3, 32);
    const chip = KIT_screen(FD.board, v3(0.08, 0.38, 0.06)); const body = KIT_screen(FD.group, v3(0.4, -0.35, 0.1));
    KIT.callout(0, 'Bluetooth', t - 8.9, chip, [Math.min(880, chip[0] + 300), chip[1] - 210]);
    KIT.callout(1, 'Tropfenform', t - 9.5, body, [200, 470]);
    tagT = ['Bluetooth-Tracker', tl - 0.1];
    subs = [['Per', 'Handy', 'finden.'], tl < 1.6 ? 1 : 3, tl - 0.5];
  } else if (isHero) {
    const lift = name === 'hero2' ? ease.inOut(seg(t, 14.4, 15.4)) : 0;
    placeKeys(lift); KEYS.group.updateMatrixWorld(true);
    ROOM.userData.pil.position.set(-0.4 + lift * 0.9, 0.72 + lift * 0.45, -1.4 + lift * 0.3); ROOM.userData.pil.rotation.set(0, 0.3, lift * 0.9);
    phone.position.set(0.3, 1.72, 3.4); phone.rotation.set(-0.15, 0.1, 0); phone.scale.setScalar(0.42);
    drawScreen(t, ease.inOut(seg(t, 11.2, 13.4)));
    mo.K.group.visible = true; mo.K.group.position.set(-2.55, LEG * 1.03, 0.1); mo.K.group.rotation.set(0, 0.95, 0.03); walkFig({ legs: mo.legs, K: mo.K, ph: 0 }, 0, 0);
    if (name === 'hero1') {
      mo.K.set({ look: [0.8, -0.5], blink: 0, eye: 1.05, mouth: 'flat', brow: 0.1, fwd: 0.4, armL: 0.5, armR: 0.5, headTurn: 0.35 });
      sigRings.forEach((m, i) => { m.visible = true; const k = ((t * 0.8 + i / 3) % 1); m.position.copy(KPOS).add(v3(0, 0.75, 0.2)); m.lookAt(cam.position); m.scale.setScalar(0.15 + k * 0.9); m.material.opacity = 0.9 * (1 - k); });
      shoot(t, vlerp(v3(-0.5, 2.4, 6.6), v3(0.2, 2.1, 6.0), ease.out(sp)), v3(0.1, 1.2, 0.0), 0.5, 32);
      subs = [['Einfach', 'per', 'Handy', 'suchen.'], tl < 1.0 ? 2 : 4, tl - 0.1];
    } else {
      mo.K.set({ look: [0.6, -0.3], blink: 0, eye: 1.05, mouth: 'smile', open: 0.3, brow: 0.8, fwd: 0.9 * lift + 0.4, armL: 0.5, armR: 0.5 + lift * 0.6, headTurn: 0.35 });
      const a = lerp(0.35, 0.0, ease.inOut(sp));
      shoot(t, v3(Math.sin(a) * 6.4 - 1.0, 2.6, Math.cos(a) * 6.4), v3(-1.0, 1.35, -0.8), 0.4, 32);
      subs = [['Schlüssel', 'gefunden.'], tl < 0.8 ? 1 : 2, tl - 0.1];
      KIT.mark(1, 'ok', t - 15.2, 870, 1020);
    }
  } else {   // preis: alle sechs Farben vor der Nachtstadt, Neon-Preis
    const cols = [[-1.25, 1.2], [0, 1.2], [1.25, 1.2], [-1.25, -0.6], [0, -0.6], [1.25, -0.6]];
    SIX.forEach((f, i) => { f.group.visible = true; f.group.scale.setScalar(0.95); f.group.position.set(cols[i][0], 0.05 + 0.5 * 0.95, cols[i][1] * 0.35); f.group.rotation.set(0, (i % 3 - 1) * -0.35 + Math.sin(t * 1.2 + i) * 0.06, 0); f.explode(0); });
    const a = lerp(0.12, -0.1, sp); shoot(t, v3(Math.sin(a) * 11.6, 2.4, Math.cos(a) * 11.6), v3(0, 1.5, 0), 0.4, 32);
    KIT.neonNum('8,99&nbsp;€', tl - 0.1, 0, 330);
    tagT = ['Sechs Farben', tl - 0.5];
  }
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  tx.word.style.opacity = t < 3.3 ? 1 - seg(t, 3.1, 3.3) : t >= 16.4 ? seg(t, 16.4, 16.6) : 0;
  if (subs) KIT.subtitle(subs[0], subs[1], subs[2], seg(t, t1 - 0.12, t1));
  if (tagT) KIT.tagPill(tagT[0], tagT[1], gold, seg(t, t1 - 0.12, t1), 300);
  const cta = t >= 17.4 ? t - 17.4 : -1;
  tx.cta.style.opacity = cta < 0 ? 0 : clamp(cta / 0.15); tx.cta.style.transform = `scale(${lerp(0.9, 1, ease.out(seg(cta, 0, 0.3)))})`;
  O.grain(Math.round(t * 30), 1);
  P.render();
}
function KIT_screen(obj, local) { obj.updateWorldMatrix(true, false); const v = obj.localToWorld(local.clone()); v.project(cam); return [(v.x + 1) / 2 * 1080, (1 - v.y) / 2 * 1920]; }
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
