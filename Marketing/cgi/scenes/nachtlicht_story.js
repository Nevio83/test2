// Maios CGI – Nachtlichter mit Bewegungsmelder (Produkt 25) Story im @mehr.optic-Stil, 20,5 s, kein Loop: "Nachts leuchtet jeder mit dem Handy."
// Beats: Menge gleicher Figuren mit Handy-Taschenlampe vor der Nachtstadt -> eine Figur übersieht die Stufe (Ring, Kreuz) -> Blaupause "Eine Idee" ->
// Explosionsansicht (Bewegungsmelder, Klebestreifen) -> Treppe im Dunkeln: Figur geht los, Licht 1 geht an, Licht 2 geht an (Haken) ->
// Preis (Neon) vor der Wand mit zwei leuchtenden Nachtlichtern, "Flur oder Schlafzimmer?", Link im Profil.
// Neu gegenüber Flur (28.10.) und Mo-Story (4.11.): keine Kinderfigur, kein Flur/Lego, Treppe als Beweis, Blaupause + Explosionsansicht.
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makePost } from '../lib/post.js';
import { makeTiefe } from '../lib/tiefe.js';
import { makeKid } from '../lib/figur_pro.js';
import * as N from '../lib/nachtlicht_models.js';
import { STORY_CSS, makeKit } from '../lib/story_kit.js';

const style = document.createElement('style');
style.textContent = BR.CSS + STORY_CSS + `
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(0,0,0,.42)}
.tword{position:absolute;top:208px;padding:7px 14px 6px;border-radius:12px;background:rgba(0,0,0,.42);font:700 32px Manrope;color:#fff;letter-spacing:.01em;text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.7)}
.sub{left:105px!important;width:824px!important;font-size:66px!important}
.tcta{position:absolute;left:270px;width:400px;text-align:center;font:800 44px Manrope;color:#111;background:#fff;border-radius:18px;padding:20px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 italic 70px Manrope', 'ßüÜäÄöÖ€·?:✕✓');
await document.fonts.load('800 40px Manrope', 'ßüÜ€·?:');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.02, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;
const P = makePost(r, scene, cam, { strength: 0.16, radius: 0.6, threshold: 0.95 });
scene.fog = new THREE.FogExp2('#070b16', 0.02);

// ---------- Kulissen: Nachtstadt (blau-violett, spät), Blaupause, Treppenhaus, Preiswand ----------
const cityTex = canvasTex(1024, 1024, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#060a1f'); gr.addColorStop(0.55, '#141a45'); gr.addColorStop(1, '#2b2a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const Rc = rng(25);
  for (let i = 0; i < 110; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + Rc() * 0.6})`; g.fillRect(Rc() * w, Rc() * h * 0.5, 2, 2); }
  g.fillStyle = '#f4ecd2'; g.beginPath(); g.arc(w * 0.78, h * 0.16, 34, 0, Math.PI * 2); g.fill();
  for (let layer = 0; layer < 2; layer++) {
    let x = -20; const base = h * (0.62 + layer * 0.06);
    while (x < w) { const bw = 50 + Rc() * 80, bh = 120 + Rc() * (260 - layer * 90); g.fillStyle = layer ? '#070916' : '#0e1128'; g.fillRect(x, base - bh + layer * 40, bw, bh + 400);
      for (let wy = base - bh + 14 + layer * 40; wy < base + 20; wy += 22) for (let wx = x + 8; wx < x + bw - 10; wx += 16) if (Rc() < 0.12) { g.fillStyle = Rc() < 0.7 ? '#ffcf7a' : '#8fb6ff'; g.globalAlpha = 0.4 + Rc() * 0.5; g.fillRect(wx, wy, 7, 10); g.globalAlpha = 1; }
      x += bw + 4; }
  }
});
const city = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: cityTex, toneMapped: false })); city.position.set(0, 7.5, -9); scene.add(city);
const cityFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: '#12142a', roughness: 0.5, metalness: 0.2 })); cityFloor.rotation.x = -Math.PI / 2; cityFloor.position.z = -14; cityFloor.receiveShadow = true; scene.add(cityFloor);
// Stufe vor der Menge (die übersehene Kante)
const stepM = new THREE.MeshStandardMaterial({ color: '#6a7090', roughness: 0.7 });
const curb = new THREE.Mesh(new THREE.BoxGeometry(12, 0.28, 0.12), stepM); curb.position.set(0, -0.14, 0.94); curb.receiveShadow = true; scene.add(curb);
const curbTop = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), cityFloor.material); curbTop.rotation.x = -Math.PI / 2; curbTop.position.y = -0.28; curbTop.position.z = 16; scene.add(curbTop);

const blueTex = canvasTex(1024, 1024, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h * 0.5, w * 0.8); gr.addColorStop(0, '#0e3aa0'); gr.addColorStop(1, '#061a52'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(150,190,255,.16)'; g.lineWidth = 2; for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  g.strokeStyle = 'rgba(150,190,255,.07)'; g.lineWidth = 1; for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
});
const blue = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: blueTex, toneMapped: false })); blue.position.set(0, 1.6, -4.2); scene.add(blue);

// Treppenhaus: Stufen steigen nach rechts (+x), Wand dahinter bei z = WALLZ
const STAIR = new THREE.Group(); scene.add(STAIR);
const NST = 8, RUN = 0.62, RISE = 0.34, X0 = -2.6, WALLZ = -1.15;
const stepY = (x) => RISE * clamp(Math.floor((x - X0) / RUN) + 1, 0, NST);   // Trittfläche unter x
{
  const wallTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#c9c0b2'; g.fillRect(0, 0, w, h); const Rw = rng(4); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Rw() < 0.5 ? '255,255,255' : '80,70,60'},${Rw() * 0.05})`; g.fillRect(Rw() * w, Rw() * h, 3, 3); } });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(4, 2);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 })); wall.position.set(0, 3.2, WALLZ); wall.receiveShadow = true; STAIR.add(wall);
  const oak = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#8a6646'; g.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { g.fillStyle = i % 2 ? 'rgba(50,30,15,.14)' : 'rgba(255,225,180,.06)'; g.fillRect(0, i * 10, w, 9); } });
  const treadM = new THREE.MeshStandardMaterial({ map: oak, roughness: 0.5 }), riserM = new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.85 });
  for (let i = 0; i < NST; i++) {
    const x = X0 + i * RUN, y = (i + 1) * RISE;
    const blk = new THREE.Mesh(new THREE.BoxGeometry(RUN, y, 2.2), riserM); blk.position.set(x + RUN / 2, y / 2, WALLZ + 1.1); blk.receiveShadow = true; blk.castShadow = true; STAIR.add(blk);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(RUN + 0.06, 0.05, 2.25), treadM); tr.position.set(x + RUN / 2 - 0.03, y + 0.025, WALLZ + 1.12); tr.receiveShadow = true; STAIR.add(tr);
  }
  const lowFloor = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.6 })); lowFloor.rotation.x = -Math.PI / 2; lowFloor.position.set(0, 0, 3); lowFloor.receiveShadow = true; STAIR.add(lowFloor);
  const topFloor = new THREE.Mesh(new THREE.BoxGeometry(6, NST * RISE, 2.2), riserM); topFloor.position.set(X0 + NST * RUN + 3, NST * RISE / 2, WALLZ + 1.1); STAIR.add(topFloor);
  const topTread = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 2.25), treadM); topTread.position.set(X0 + NST * RUN + 3, NST * RISE + 0.025, WALLZ + 1.12); STAIR.add(topTread);
  // Handlauf an der Wand
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, Math.hypot(NST * RUN, NST * RISE) + 0.6, 16), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.4, metalness: 0.4 }));
  rail.rotation.z = -Math.PI / 2 + Math.atan2(RISE, RUN); rail.position.set(X0 + NST * RUN / 2, NST * RISE / 2 + 1.3, WALLZ + 0.1); STAIR.add(rail);
}
// zwei Nachtlichter an der Treppenwand (Massstab: Figur ~ 2 m)
const NLS = 1.7;
const mkWallNL = (x, y) => { const n = N.makeNachtlicht(); n.group.scale.setScalar(NLS); n.group.rotation.y = -Math.PI / 2; n.group.position.set(x, y, WALLZ + 0.002); scene.add(n.group); return n; };
const NL1 = mkWallNL(X0 + 5 * RUN, stepY(X0 + 5 * RUN) + 0.9), NL2 = mkWallNL(X0 + 1 * RUN, stepY(X0 + 1 * RUN) + 0.9);
function setNL(n, k, I = 1) {   // Leuchtteil + Raumlicht (Massstab der Szene)
  n.lightMat.emissiveIntensity = 2.6 * k; n.lightMat.color.set('#f3efe7').lerp(new THREE.Color('#fff4e2'), k);
  n.pl.intensity = 3.2 * k * I; n.pl.distance = 0; n.spot.intensity = 9 * k * I;
}
// Preiswand: zwei Nachtlichter nebeneinander, warm beleuchtet
const PW = new THREE.Group(); scene.add(PW);
const pwall = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ color: '#3a4258', roughness: 0.95 })); pwall.position.set(0, 0, 0); PW.add(pwall);
const PNL = [-0.3, 0.3].map((x) => { const n = N.makeNachtlicht(); n.group.scale.setScalar(2.6); n.group.rotation.y = -Math.PI / 2; n.group.position.set(x, 0, 0.003); PW.add(n.group); return n; });
PW.position.set(0, 1.0, -30);

// ---------- Figuren (erwachsen, matt) mit Handy-Taschenlampe ----------
const trM = new THREE.MeshStandardMaterial({ color: '#2b3541', roughness: 0.9 }), shoeM = new THREE.MeshStandardMaterial({ color: '#0f1115', roughness: 0.5 });
const LEG = 0.85 * 0.6;
const PUL = ['#51697c', '#c99a3a', '#b8503f', '#3f8a6a', '#4a5fa8', '#8a5aa0', '#607d8b'];
const coneGeo = new THREE.ConeGeometry(0.55, 3.2, 40, 1, true); coneGeo.translate(0, -1.6, 0);
const poolMat = new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const coneMat = new THREE.MeshBasicMaterial({ color: '#dfe9ff', transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
function mkFigure(col, torch = true) {
  const K = makeKid(); scene.add(K.group); K.group.scale.setScalar(0.6); K.torso.material.color.set(col);
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.24 * s, 0.35, 0); K.group.add(p);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.62, 6, 12), trM); l.position.y = -0.5; l.castShadow = true; p.add(l);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), shoeM); f.scale.set(1, 0.6, 1.6); f.position.set(0, -1.07, 0.1); f.castShadow = true; p.add(f); return p; });
  let cone = null, flash = null;
  if (torch) {   // Handy in der rechten Hand, Lichtkegel entlang des Arms
    const ph = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.04), new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.3 })); ph.position.set(0, -1.08, 0.12); ph.rotation.x = 0.2; K.arms[1].add(ph);
    flash = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })); flash.position.set(0, -1.2, 0.1); flash.rotation.x = Math.PI / 2; K.arms[1].add(flash);
    cone = new THREE.Mesh(coneGeo, coneMat); K.group.add(cone);
    const apex = v3(0.56, 1.2, 0.9), pool = v3(0.35, -0.84, 2.6), d = pool.clone().sub(apex);
    cone.position.copy(apex); cone.quaternion.setFromUnitVectors(v3(0, -1, 0), d.clone().normalize()); cone.scale.set(1, d.length() / 3.2, 1);
    const pl = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), poolMat); pl.rotation.x = -Math.PI / 2; pl.scale.set(1, 1.5, 1); pl.position.copy(pool).add(v3(0, 0.01, 0)); K.group.add(pl);
  }
  return { K, legs, cone };
}
const SPOT = [[-1.7, 0], [0, 0], [1.7, 0], [-2.6, -1.9], [-0.9, -1.9], [0.9, -1.9], [2.6, -1.9]];
const crowd = SPOT.map((p, i) => ({ ...mkFigure(PUL[i]), x: p[0], z: p[1], ph: i * 0.37 }));
const hero = crowd[1];
function walkFig(f, u, amp = 0.33) { const w = Math.sin((u + f.ph) * 2 * Math.PI / 0.6); f.legs[0].rotation.x = w * amp; f.legs[1].rotation.x = -w * amp; f.K.body.position.y = Math.abs(Math.cos((u + f.ph) * 2 * Math.PI / 0.6)) * 0.05; }
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 12, 64), new THREE.MeshBasicMaterial({ color: '#ffd45c', toneMapped: false })); scene.add(ring);
const mo = mkFigure('#51697c', false); mo.ph = 0;

// ---------- Nachtlicht für Blaupause (mit Klebestreifen für die Explosionsansicht) ----------
const BP = N.makeNachtlicht(); scene.add(BP.group);
const tape = new THREE.Mesh(new THREE.CylinderGeometry(N.DISC_R * 0.82, N.DISC_R * 0.82, 0.0016, 64), new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.9 }));
tape.rotation.z = Math.PI / 2; BP.group.add(tape);
const outlines = [];
BP.group.traverse((m) => { if (m.isMesh && m.geometry && ['LatheGeometry', 'CylinderGeometry'].includes(m.geometry.type)) { const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), new THREE.LineBasicMaterial({ color: '#ffe08a', toneMapped: false })); m.add(l); outlines.push(l); } });
const base = new Map(); BP.group.children.forEach((c) => base.set(c, c.position.clone()));
function explode(e) {   // Scheibe + Klebestreifen nach hinten, Leuchtteil nach unten
  for (const [c, p] of base) c.position.copy(p);
  BP.disc.position.x -= 0.05 * e; tape.position.set(-0.002 - 0.1 * e, 0, 0);
  BP.glow.position.y -= 0.05 * e;
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = { pill: mk('tpill', 'Werbung', 208), word: mk('tword', 'Nachtlicht'), cta: mk('tcta', 'Link im Profil', 700) };
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
const KIT = makeKit(ov);
const O = { grain: BR.grain({ amount: 0.07, vig: 'rgba(2,4,8,.6)' }) };

// ---------- Zeitplan ----------
export const DAUER = 20.5;
const BEATS = [[0, 2.6, 'crowd'], [2.6, 5.0, 'kipp'], [5.0, 7.6, 'idee'], [7.6, 9.3, 'teile'], [9.3, 11.0, 'teile2'], [11.0, 13.8, 'hero1'], [13.8, 16.2, 'hero2'], [16.2, 20.5, 'preis']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.022 * a);
function shoot(t, pos, tgt, a = 1, fov = 32) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
function light(kind) {
  T.mood(1); T.U.uHaloI.value = 0; T.floor.visible = false;
  if (kind === 'city') { T.key.color.set('#9fb4ff'); T.key.intensity = 0.7; T.key.position.set(-3, 6, 7); T.fill.intensity = 0.45; T.fill.color.set('#6f7ad8'); T.fill.groundColor.set('#0a0c22'); T.rim.color.set('#8fd6ff'); T.rim.intensity = 34; T.rim.position.set(3, 3.5, -3); scene.environmentIntensity = 0.25; scene.fog.density = 0.012; r.toneMappingExposure = 0.85; }
  else if (kind === 'blue') { T.key.color.set('#fff4e6'); T.key.intensity = 2.4; T.key.position.set(2, 5, 10); T.fill.intensity = 0.55; T.fill.color.set('#7da2ff'); T.fill.groundColor.set('#0a1a4a'); T.rim.color.set('#ffe9a8'); T.rim.intensity = 36; T.rim.position.set(3, 3.5, -2.5); scene.environmentIntensity = 0.45; scene.fog.density = 0; r.toneMappingExposure = 0.85; }
  else if (kind === 'stair') { T.key.color.set('#7f95c8'); T.key.intensity = 0.32; T.key.position.set(-4, 7, 6); T.fill.intensity = 0.16; T.fill.color.set('#6c7fb0'); T.fill.groundColor.set('#120e0a'); T.rim.color.set('#9fb8ff'); T.rim.intensity = 6; T.rim.position.set(3.4, 4.6, 2.6); scene.environmentIntensity = 0.12; scene.fog.density = 0.0; r.toneMappingExposure = 0.9; }
  else { T.key.color.set('#ffd9b0'); T.key.intensity = 0.35; T.key.position.set(-2, 4, 6); T.fill.intensity = 0.18; T.fill.color.set('#8a7a66'); T.fill.groundColor.set('#1a120c'); T.rim.intensity = 0; scene.environmentIntensity = 0.15; scene.fog.density = 0; r.toneMappingExposure = 0.85; }
}
// Figur auf der Treppe: läuft von oben rechts nach unten links
function moOnStairs(x, t, moving) {
  const g = mo.K.group; const yStep = stepY(x + 0.05);
  g.position.set(x, LEG + yStep, WALLZ + 1.0); g.rotation.set(0, -Math.PI / 2 + 0.35, 0);
  walkFig(mo, moving ? t * 0.8 : 0, moving ? 0.38 : 0);
}

function frame(t) {
  const sh = BEATS.find((s) => t >= s[0] && t < s[1]) || BEATS[BEATS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1); const tl = t - t0;
  KIT.hideAll(); T.U.uTime.value = t;
  const isCity = name === 'crowd' || name === 'kipp';
  const isBlue = name === 'idee' || name === 'teile' || name === 'teile2';
  const isHero = name === 'hero1' || name === 'hero2';
  light(isCity ? 'city' : isBlue ? 'blue' : isHero ? 'stair' : 'preis');
  city.visible = cityFloor.visible = curb.visible = curbTop.visible = isCity; blue.visible = isBlue; STAIR.visible = isHero;
  NL1.group.visible = NL2.group.visible = isHero; setNL(NL1, 0); setNL(NL2, 0);
  PW.visible = name === 'preis'; PNL.forEach((n) => setNL(n, 0));
  mo.K.group.visible = isHero;
  ring.visible = false; BP.group.visible = false; outlines.forEach((l) => (l.visible = false));
  crowd.forEach((f) => (f.K.group.visible = false));
  let subs = null, tagT = null, gold = true, tagTop = 300;

  if (isCity) {
    const k = name === 'kipp' ? ease.inOut(seg(t, 3.0, 3.7)) : 0;
    const drift = t * 0.16;
    crowd.forEach((f) => {
      const isH = name === 'kipp' && f === hero;
      f.K.group.visible = true; f.K.group.position.set(f.x, LEG, f.z + drift + (f === hero ? 0.3 + 0.2 * k : 0));
      f.K.group.rotation.set(isH ? 0.55 * k : 0, Math.sin(t * 0.9 + f.ph * 3) * 0.25, Math.sin((t + f.ph) * 2 * Math.PI / 1.2) * 0.05);
      walkFig(f, t, isH ? 0.33 * (1 - k) : 0.33);
      const sweep = Math.sin(t * 1.6 + f.ph * 4) * 0.35;    // Lampe schwenkt
      if (isH) f.K.set({ look: [0, -0.6 + k * 0.2], blink: 0, eye: 1.1, mouth: 'o', open: 0.2 + k * 0.5, brow: -0.4 - k * 0.6, fwd: lerp(1.2, 2.4, k), armL: lerp(0.4, 1.2, k), armR: lerp(0.15, 0.9, k), headTilt: k * 0.1 });
      else f.K.set({ look: [sweep, -0.5], blink: 0.3, eye: 1.0, mouth: 'flat', brow: -0.2, fwd: 1.2 + 0.06 * Math.sin(t * 2 + f.ph), armL: 0.35, armR: 0.15 });
    });
    if (name === 'crowd') { shoot(t, vlerp(v3(0, 1.5, 11.0), v3(0, 1.4, 9.8), sp), v3(0, 1.1, 0.2), 0.5, 40); subs = [['Nachts', 'leuchtet', 'jeder', 'mit', 'dem', 'Handy.'], t < 0.9 ? 2 : t < 1.6 ? 4 : 6, t - 0.15]; }
    else {
      ring.visible = true; ring.position.set(0.0, LEG + 2.1 * 0.6 - 0.25 * k, 0.5 + t * 0.16 + 0.35 * k); ring.lookAt(cam.position); ring.scale.setScalar(0.85 * (1 + 0.05 * Math.sin(t * 9)));
      shoot(t, vlerp(v3(1.2, 1.5, 7.6), v3(1.2, 1.4, 6.9), ease.out(sp)), v3(0.1, 0.8, 1.0), 0.8, 34);
      subs = [['Die', 'Stufe', 'sieht', 'keiner.'], tl < 0.9 ? 2 : 4, tl - 0.15];
      KIT.mark(0, 'no', t - 3.75, 780, 960);
    }
  } else if (isBlue) {
    BP.group.visible = true; outlines.forEach((l) => (l.visible = true));
    BP.lightMat.emissive.set('#ffd7a0');
    if (name === 'idee') {
      explode(0); BP.lightMat.emissiveIntensity = 1.4 * ease.out(seg(t, 5.6, 6.2)); BP.lightMat.color.set('#ffffff');
      BP.group.position.set(0, 2.35, 0); BP.group.scale.setScalar(10); BP.group.rotation.set(0, -1.15 + tl * 0.22, 0.0);
      shoot(t, v3(0.0, 1.9, 11.2), v3(0, 1.35, 0), 0.3, 32);
      tagT = ['Eine Idee', tl - 0.1];
      subs = [['Ein', 'Licht,', 'das', 'dich', 'sieht.'], tl < 0.8 ? 2 : tl < 1.4 ? 4 : 5, tl - 0.3];
    } else {
      const e = ease.inOut(seg(t, 7.8, 8.8)); explode(e); BP.lightMat.emissiveIntensity = 1.0; BP.lightMat.color.set('#ffffff');
      const two = name === 'teile2'; const tt2 = t - 7.6;
      BP.group.position.set(-0.45, 2.5, 0); BP.group.scale.setScalar(10); BP.group.rotation.set(0, (two ? -1.35 : -1.05) + tt2 * 0.09, 0); BP.group.updateMatrixWorld(true);
      if (two) shoot(t, v3(-1.2, 2.6, 10.2), v3(-0.3, 1.5, 0), 0.3, 32); else shoot(t, v3(0.6, 1.9, 11.2), v3(0, 1.3, 0), 0.3, 32);
      const sens = scr(BP.dome, v3(0, 0, 0)); const tp = scr(tape, v3(0, 0, 0));
      KIT.callout(0, 'Bewegungsmelder', t - 8.9, sens, [Math.min(690, sens[0] + 260), sens[1] + 200]);
      KIT.callout(1, 'Klebestreifen', t - 9.5, tp, [250, tp[1] + 120]);
      tagT = ['Batterie: bis zu 12 Monate', tt2 - 0.1];
      subs = [['Einfach', 'an', 'die', 'Wand', 'kleben.'], tt2 < 1.3 ? 1 : tt2 < 1.8 ? 3 : 5, tt2 - 0.5];
    }
  } else if (isHero) {
    mo.K.group.visible = true;
    if (name === 'hero1') {
      const x = lerp(X0 + 7.0 * RUN, X0 + 5.8 * RUN, ease.inOut(seg(t, 11.0, 13.8)));
      moOnStairs(x, t, true);
      const on1 = ease.out(seg(t, 11.7, 12.0)); setNL(NL1, on1);
      mo.K.set({ look: [0.5, -0.5], blink: 0, eye: 1.05, mouth: on1 > 0.5 ? 'smile' : 'flat', brow: lerp(-0.2, 0.4, on1), fwd: 0.2, armL: 0.35, armR: 0.35, headTurn: -0.25 });
      shoot(t, vlerp(v3(-0.2, 3.4, 7.6), v3(0.2, 3.3, 7.0), ease.out(sp)), v3(1.0, 2.9, WALLZ + 0.6), 0.5, 34);
      subs = [['Du', 'gehst', 'los.'], tl < 0.4 ? 1 : 3, tl - 0.05];
      if (tl > 1.2) subs = [['Es', 'geht', 'an.'], tl < 1.5 ? 1 : 3, tl - 1.2];
    } else {
      const x = lerp(X0 + 5.2 * RUN, X0 + 2.3 * RUN, ease.inOut(seg(t, 13.8, 16.2)));
      moOnStairs(x, t, true);
      setNL(NL1, 1); const on2 = ease.out(seg(t, 14.4, 14.7)); setNL(NL2, on2);
      mo.K.set({ look: [0.4, -0.6], blink: 0, eye: 1.05, mouth: 'smile', open: 0.15, brow: 0.6, fwd: 0.2, armL: 0.3, armR: 0.3, headTurn: -0.15 });
      const a = lerp(0.5, 0.15, ease.inOut(sp));
      shoot(t, v3(Math.sin(a) * 8.2 - 0.6, 3.0, Math.cos(a) * 8.2 - 0.2), v3(lerp(-0.2, -0.9, ease.inOut(sp)), lerp(2.0, 1.3, ease.inOut(sp)), WALLZ + 0.6), 0.4, 34);
      subs = [['Warmes', 'Licht.', 'Kein', 'Handy.'], tl < 0.9 ? 2 : 4, tl - 0.1];
      KIT.mark(1, 'ok', t - 15.0, 820, 1020);
    }
  } else {   // preis: zwei leuchtende Nachtlichter an der Wand, Neon-Preis
    PNL.forEach((n) => { setNL(n, 1, 0.22); n.pl.intensity = 0.4; }); T.key.color.set('#ffffff'); T.key.intensity = 1.3; T.key.position.set(1, 3, 8);
    if (t < 18.3) { const k = seg(t, 16.2, 18.3); const z = lerp(3.4, 3.15, ease.out(k));
      shoot(t, v3(lerp(0.2, 0.0, k), 1.1, PW.position.z + z), v3(0, 1.08, PW.position.z), 0.25, 32); }
    else { const k = seg(t, 18.3, 20.5); shoot(t, v3(lerp(1.5, 1.3, ease.out(k)), 1.25, PW.position.z + lerp(2.7, 2.5, k)), v3(0.05, 1.02, PW.position.z), 0.25, 32); }
    KIT.neonNum('23,99&nbsp;€', tl - 0.1, 0, 330);
    tagT = ['Flur oder Schlafzimmer?', tl - 0.5]; tagTop = 590;
  }
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  tx.word.style.opacity = t < 3.3 ? 1 - seg(t, 3.1, 3.3) : t >= 16.4 ? seg(t, 16.4, 16.6) : 0;
  const outE = (name === 'teile' || name === 'preis') ? 0 : seg(t, t1 - 0.12, t1);
  if (subs) KIT.subtitle(subs[0], subs[1], subs[2], outE);
  if (tagT) KIT.tagPill(tagT[0], tagT[1], gold, outE, tagTop);
  const cta = t >= 19.5 ? t - 19.5 : -1;
  tx.cta.style.opacity = cta < 0 ? 0 : clamp(cta / 0.15); tx.cta.style.transform = `scale(${lerp(0.9, 1, ease.out(seg(cta, 0, 0.3)))})`;
  O.grain(Math.round(t * 30), 1);
  P.render();
}
function scr(obj, local) { cam.updateMatrixWorld(); obj.updateWorldMatrix(true, false); const v = obj.localToWorld(local.clone()); v.project(cam); return [(v.x + 1) / 2 * 1080, (1 - v.y) / 2 * 1920]; }
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
