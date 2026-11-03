// Maios CGI – Aroma Öl Diffusor (Produkt 42, Weiß), "Mein Kaminfeuer ist kaputt.", Loop-Clip 8 s (Render 8,4 s), Handy-Look
// Wohnzimmer zur blauen Stunde: helles Eichen-Sideboard, Fenster mit Stadtlichtern als unscharfe Punkte, Buecher.
// Der Diffusor laeuft ab Bild 0; die Flamme (Nebel + LED) wechselt die Farbe (RGB-Flamme laut products.json).
// Ablauf: Frontal, Flamme orange -> lila (Hook) -> Flamme nah, blau -> Aufsicht in die Oeffnung, gruen ("Nicht kaputt.
//         Kann Farben.") -> halbtotale mit Preis + Link, rot -> zurueck zur ersten Einstellung, orange (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex, contactShadow } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makeTiefe, stripEnv } from '../lib/tiefe.js';
import * as DM from '../lib/diffusor_models.js';

const style = document.createElement('style');
style.textContent = BR.CSS + `
.tt{position:absolute;left:70px;width:800px;text-align:center;font:800 68px Manrope;line-height:1.16;color:#fff;letter-spacing:-.005em;
  text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.75),0 0 22px rgba(0,0,0,.45)}
.tt.big{font-size:150px;letter-spacing:-.02em}
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(0,0,0,.42)}
.tword{position:absolute;top:208px;padding:7px 14px 6px;border-radius:12px;background:rgba(0,0,0,.42);font:700 32px Manrope;color:#fff;letter-spacing:.01em;text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.7)}
.tcta{position:absolute;left:270px;width:400px;text-align:center;font:800 44px Manrope;color:#111;background:#fff;border-radius:18px;padding:20px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 40px Manrope', 'ßüÖö€·?:');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;
const R = rng(77);

// ---------- Sideboard (helle Eiche) ----------
const wood = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#c9a77f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y = R() * h, a = 0.03 + R() * 0.07, lw = 1 + R() * 3;
    g.strokeStyle = R() > 0.5 ? `rgba(90,60,30,${a})` : `rgba(240,215,180,${a})`; g.lineWidth = lw;
    g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.004 + i) * 6 + (R() - 0.5) * 2); g.stroke();
  }
});
wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 1);
const topM = new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5, color: '#bfa58a' });
const top = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 5), topM); top.position.set(0, -0.15, -0.8); top.receiveShadow = true; scene.add(top);
const front = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 0.1), new THREE.MeshStandardMaterial({ color: '#8f7860', roughness: 0.7 })); front.position.set(0, -1.8, 1.65); scene.add(front);

// Buecher links hinten (gestapelt), kleine Schale rechts
const bookCols = ['#2f3e4e', '#a35b3b', '#d8cfbd'];
for (let k = 0; k < 3; k++) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.7 - k * 0.12, 0.2, 1.15 - k * 0.05), new THREE.MeshStandardMaterial({ color: bookCols[k], roughness: 0.8 }));
  b.position.set(-2.3, 0.1 + k * 0.2, -1.2); b.rotation.y = 0.25 + k * 0.12; b.castShadow = true; b.receiveShadow = true; scene.add(b);
}
const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.3, 0.02], [0.5, 0.18], [0.55, 0.3], [0.52, 0.31], [0.47, 0.2], [0.28, 0.06], [0, 0.05]].map(([x, y]) => new THREE.Vector2(x, y)), 48),
  new THREE.MeshPhysicalMaterial({ color: '#3b4a45', roughness: 0.35, clearcoat: 0.6 }));
bowl.position.set(2.2, 0, -0.9); bowl.castShadow = true; scene.add(bowl);

// Stadtlichter im Fenster (unscharf, kuehl/warm gemischt)
const dotTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const dots = [];
for (let i = 0; i < 22; i++) {
  const warm = R() > 0.45;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(warm ? '#ffcf8f' : '#9fc4ff') }));
  s.position.set(-5 + R() * 10, 1.2 + R() * 4.2, -8 - R() * 2); s.scale.setScalar(0.3 + R() * 0.35); s.userData.ph = R() * 6; scene.add(s); dots.push(s);
}

// ---------- Diffusor (Weiss) ----------
const D = DM.makeDiffusor('weiss', 'shop'); scene.add(D.group); D.group.rotation.y = -0.4;
const cs = contactShadow(2.8, 0.55); cs.position.y = 0.003; scene.add(cs);
const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color('#ff9a4a'), opacity: 0.2 }));
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.006; scene.add(pool);

// ---------- Flammenfarben (RGB-Flamme) ----------
// je Farbe: [aussen/oben, Kern]
const COL = {
  orange: ['#ff4a0c', '#ffc66a'], lila: ['#8a2cff', '#e7b8ff'], blau: ['#1f5bff', '#9fe3ff'], gruen: ['#10c25a', '#c8ffb0'], rot: ['#ff1838', '#ffb0a0'],
};
// Zeit tl (Render, Schluss als t-8): orange bis 0,7 -> lila; Schnitt 2,6 blau; 4,2 gruen; 5,6 rot; Schluss orange
const KEYS = [[-9, 'orange'], [0.7, 'lila'], [2.6, 'blau'], [4.2, 'gruen'], [5.6, 'rot']];
const cA = new THREE.Color(), cB = new THREE.Color(), tmp = new THREE.Color();
function flameColor(tl) {
  let k = 0; for (let i = 0; i < KEYS.length; i++) if (tl >= KEYS[i][0]) k = i;
  const cur = COL[KEYS[k][1]], prev = COL[KEYS[Math.max(0, k - 1)][1]];
  const m = k === 0 ? 1 : ease.inOut(seg(tl, KEYS[k][0], KEYS[k][0] + 0.3));   // 0,3 s Uebergang
  cA.set(prev[0]).lerp(tmp.set(cur[0]), m); cB.set(prev[1]).lerp(tmp.set(cur[1]), m);
  D.flameU.uC0.value.copy(cA); D.flameU.uC1.value.copy(cB);
  D.glowU.uCol.value.copy(cB).lerp(cA, 0.4);
  D.ringMat.emissive.copy(cA); D.light.color.copy(cA).lerp(cB, 0.3);
  pool.material.color.copy(cA);
}

// ---------- Licht: blaue Stunde ----------
const ENVD = stripEnv(r, { bg: '#0b0f18', strips: [
  { w: 1.4, h: 9, pos: v3(-5.5, 0, 1.8), col: '#ffffff', I: 2.2 }, { w: 1.2, h: 9, pos: v3(5.5, 0, 0.8), col: '#dfe8ff', I: 1.4 }], top: { w: 4, h: 4, col: '#ffffff', I: 1.2 } });
function blau(t) {
  T.mood(0); T.U.uHaloI.value = 0;
  T.U.uC0.value.set('#24324f'); T.U.uC1.value.set('#070a12'); T.U.uCenter.value.set(0.5, 0.66);
  scene.environment = ENVD; scene.environmentIntensity = 0.6;
  T.key.color.set('#fff3e4'); T.key.intensity = 1.7; T.key.position.set(-3.5, 6.5, 5.5);
  T.fill.intensity = 0.22; T.fill.color.set('#c9d6ff'); T.fill.groundColor.set('#0a0c12');
  T.rim.color.set('#a9c4ff'); T.rim.intensity = 18; T.rim.position.set(2.6, 3.2, -2.6);
  dots.forEach((d) => (d.material.opacity = 0.7 + 0.3 * Math.sin(t * 1.1 + d.userData.ph)));
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Diffusor'),
  a: mk('tt', 'Mein Kaminfeuer<br>ist kaputt.', 320),
  c: mk('tt', 'Nicht kaputt.<br>Kann Farben.', 320),
  p: mk('tt big', '26,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.06, vig: 'rgba(4,6,14,.55)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 2.6, 'front'], [2.6, 4.2, 'nah'], [4.2, 5.6, 'oben'], [5.6, 7.0, 'preis'], [7.0, 8.4, 'front2']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.02 * a);
function shoot(t, pos, tgt, a = 1, fov = 32) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
// Erste Einstellung: seitlicher Schwenk von rechts nach links, leicht tief; u = t bzw. t - 8 -> nahtlos
const frontCam = (u) => { const a = 0.32 - 0.1 * u, R0 = 9.6 - 0.25 * u; return [v3(Math.sin(a) * R0, 1.5, Math.cos(a) * R0), v3(0, 1.55, 0)]; };

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  const tl = name === 'front2' ? t - 8 : t;
  T.U.uTime.value = tl; blau(tl);
  D.set(1, tl); flameColor(tl); D.glowU.uI.value *= 0.35;
  pool.material.opacity = 0.2 * (0.9 + 0.1 * Math.sin(tl * 11.3));

  if (name === 'front' || name === 'front2') { const [p, q] = frontCam(tl); shoot(t, p, q, 0.8, 32); }
  else if (name === 'nah') {
    const a = lerp(-0.9, -0.62, ease.inOut(sp));
    shoot(t, v3(Math.sin(a) * 3.6, 1.75 + 0.1 * sp, Math.cos(a) * 3.6), v3(0, 1.85, 0), 0.35, 36);
  } else if (name === 'oben') {
    // Aufsicht: von schraeg oben in die Oeffnung, Kamera dreht langsam
    const a = lerp(0.2, 0.55, ease.inOut(sp));
    shoot(t, v3(Math.sin(a) * 3.3, 4.3 - 0.25 * sp, Math.cos(a) * 3.3), v3(0, 1.35, 0), 0.3, 36);
  } else if (name === 'preis') {
    const a = lerp(-0.55, -0.42, ease.out(sp));
    shoot(t, v3(Math.sin(a) * 10.5, 4.2, Math.cos(a) * 10.5), v3(0, 2.6, 0), 0.4, 32);
  }
  D.flame.rotation.y = Math.atan2(cam.position.x, cam.position.z) - D.group.rotation.y;
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1; tx.word.style.opacity = 1;
  tx.a.style.transform = 'none';
  tx.a.style.opacity = t < 2.6 ? 1 - seg(t, 2.5, 2.6) : (t >= 7.0 ? 1 : 0);   // steht ab Render 0 (Loop)
  pop(tx.c, t >= 4.3 && t < 5.6 ? t - 4.3 : -1, seg(t, 5.5, 5.6));
  pop(tx.p, t >= 5.7 && t < 7.0 ? t - 5.7 : -1, seg(t, 6.9, 7.0));
  pop(tx.cta, t >= 6.1 && t < 7.0 ? t - 6.1 : -1, seg(t, 6.9, 7.0));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
