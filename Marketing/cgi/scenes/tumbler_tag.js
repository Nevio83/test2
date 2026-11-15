// Maios CGI – Tumbler Becher (Produkt 47, Storm Sea), "Heute Morgen um 7 eingefüllt.", Loop-Clip 8 s (Render 8,4 s), Handy-Look
// Zeitraffer eines ganzen Tages am Schreibtisch: Sonne wandert durchs Fenster, Schatten ziehen über den Tisch, Wanduhr rast,
// Abend, Nacht, wieder Morgen (periodisch in 8 s = 24 h). Effekte nur am Raum (Licht, Uhr), der Becher steht einfach da.
// Ablauf: Totale mit Fenster + Uhr (Hook) -> Deckel/Strohhalm nah (Isoliert, bis zu 12 Stunden) -> flach am Griff ->
//         Halbtotale mit Preis + Link -> zurück zur ersten Einstellung (Loop).
import * as THREE from 'three';
import { makeEnv, makeRenderer, aim, v3, clamp, lerp, seg, ease, rng, canvasTex, contactShadow } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makeTumbler } from '../lib/tumbler_models.js';

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
await document.fonts.load('800 40px Manrope', 'ßüÜ€·?:');

const r = makeRenderer(); r.toneMappingExposure = 0.95;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 120);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const R = rng(4747);

// ---------- Raum: Rückwand mit Fenster (links) und Wanduhr (rechts), Schreibtisch ----------
const WALLZ = -4.2;
const wallM = new THREE.MeshStandardMaterial({ color: '#d8d0c4', roughness: 0.95 });
const wallTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#d8d0c4'; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '90,80,70'},${R() * 0.05})`; g.fillRect(R() * w, R() * h, 3, 3); } });
wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(3, 3); wallM.map = wallTex; wallM.color.set('#ffffff');
// Wand mit Fensterloch: vier Teile um das Fenster (x -5.6..-1.2, y 2.2..8.2)
const WX0 = -4.9, WX1 = -1.1, WY0 = 2.4, WY1 = 8.4;
const wp = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallM); m.position.set(x, y, WALLZ); m.receiveShadow = true; scene.add(m); return m; };
wp(30, 20, (WX1 + 15) , 6); wp(30, 20, WX0 - 15, 6); wp(WX1 - WX0, 20, (WX0 + WX1) / 2, WY1 + 10); wp(WX1 - WX0, WY0 + 10, (WX0 + WX1) / 2, WY0 - (WY0 + 10) / 2);
// Himmel hinter dem Fenster (Farbe je Tageszeit)
const skyC = document.createElement('canvas'); skyC.width = 64; skyC.height = 256; const skyG = skyC.getContext('2d');
const skyTex = new THREE.CanvasTexture(skyC); skyTex.colorSpace = THREE.SRGBColorSpace;
const sky = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false })); sky.position.set(-3.4, 5.4, WALLZ - 3); scene.add(sky);
const skyStops = [[0, '#0b1230', '#1a2550'], [5, '#141c44', '#2a2f5e'], [6.5, '#f0a46a', '#7aa0d6'], [9, '#8fc3f0', '#cfe6fb'], [16, '#8fc3f0', '#d8eefc'], [18.5, '#f08a4a', '#ffcf8a'], [20, '#2a2c6a', '#d9786a'], [21.5, '#0b1230', '#1d2756'], [24, '#0b1230', '#1a2550']];
function drawSky(h) {
  let i = 0; while (i < skyStops.length - 2 && h >= skyStops[i + 1][0]) i++;
  const [h0, a0, b0] = skyStops[i], [h1, a1, b1] = skyStops[i + 1]; const k = clamp((h - h0) / (h1 - h0));
  const ca = new THREE.Color(a0).lerp(new THREE.Color(a1), k), cb = new THREE.Color(b0).lerp(new THREE.Color(b1), k);
  const gr = skyG.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#' + ca.getHexString()); gr.addColorStop(1, '#' + cb.getHexString());
  skyG.fillStyle = gr; skyG.fillRect(0, 0, 64, 256);
  const night = 1 - clamp(Math.min((h - 5.5) / 1.2, (20.8 - h) / 1.2) + 1 - 1);
  if (h < 5.8 || h > 20.6) { const Rs = rng(9); skyG.fillStyle = 'rgba(255,255,255,.8)'; for (let s = 0; s < 22; s++) skyG.fillRect(Rs() * 64, Rs() * 160, 1, 1); }
  void night; skyTex.needsUpdate = true;
}
// Fensterrahmen + Sprossen (werfen die Schatten auf den Tisch)
const frameM = new THREE.MeshStandardMaterial({ color: '#f2efe9', roughness: 0.6 });
const fb = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameM); b.position.set(x, y, z); b.castShadow = true; scene.add(b); return b; };
const FW = 0.16, FZ = WALLZ - 0.05;
fb(WX1 - WX0 + FW, FW, 0.3, (WX0 + WX1) / 2, WY0, FZ); fb(WX1 - WX0 + FW, FW, 0.3, (WX0 + WX1) / 2, WY1, FZ);
fb(FW, WY1 - WY0, 0.3, WX0, (WY0 + WY1) / 2, FZ); fb(FW, WY1 - WY0, 0.3, WX1, (WY0 + WY1) / 2, FZ);
fb(0.09, WY1 - WY0, 0.12, (WX0 + WX1) / 2, (WY0 + WY1) / 2, FZ); fb(WX1 - WX0, 0.09, 0.12, (WX0 + WX1) / 2, (WY0 + WY1) / 2 + 0.6, FZ);
const sillB = fb(WX1 - WX0 + 0.6, 0.12, 0.6, (WX0 + WX1) / 2, WY0 - 0.06, WALLZ + 0.25); sillB.material = new THREE.MeshStandardMaterial({ color: '#efebe4', roughness: 0.5 });
// Wanduhr (rechts oben)
const CLK = new THREE.Group(); CLK.position.set(1.7, 5.3, WALLZ + 0.06); scene.add(CLK);
{
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.95, 64), new THREE.MeshStandardMaterial({ map: canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#222';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.save(); g.translate(256, 256); g.rotate(a); g.fillRect(-5, -230, 10, i % 3 ? 26 : 44); g.restore(); }
  }), roughness: 0.6 })); CLK.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.07, 16, 64), new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.4, metalness: 0.3 })); CLK.add(rim);
  const handM = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.5 });
  const hh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.02), handM); hh.geometry.translate(0, 0.22, 0); hh.position.z = 0.02; CLK.add(hh);
  const mh = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.78, 0.02), handM); mh.geometry.translate(0, 0.35, 0); mh.position.z = 0.035; CLK.add(mh);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), handM); pin.rotation.x = Math.PI / 2; pin.position.z = 0.05; CLK.add(pin);
  CLK.userData = { hh, mh };
}
// Schreibtisch (Eiche) + Deko: Notizbuch, Stift, Pflanze
const oak = canvasTex(1024, 512, (g, w, h) => { g.fillStyle = '#b48a5e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${R() < 0.5 ? '90,55,25' : '255,225,180'},${0.05 + R() * 0.08})`; g.lineWidth = 1 + R() * 3; g.beginPath(); const y = R() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6); g.stroke(); } });
const desk = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 6), new THREE.MeshStandardMaterial({ map: oak, roughness: 0.45 })); desk.position.set(-1, -0.15, -1.2); desk.receiveShadow = true; scene.add(desk);
const book = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 2.7), new THREE.MeshStandardMaterial({ color: '#2f3b45', roughness: 0.8 })); book.position.set(2.4, 0.09, -0.6); book.rotation.y = -0.25; book.castShadow = true; book.receiveShadow = true; scene.add(book);
const pages = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.12, 2.62), new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.9 })); pages.position.set(2.4, 0.11, -0.6); pages.rotation.y = -0.25; scene.add(pages);
const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 12), new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.3, metalness: 0.6 })); pen.rotation.set(0, 0.5, Math.PI / 2); pen.position.set(2.5, 0.25, 0.2); scene.add(pen);
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.8, 32), new THREE.MeshStandardMaterial({ color: '#e8e2d8', roughness: 0.7 })); pot.position.set(-3.6, 0.4, -2.4); pot.castShadow = true; scene.add(pot);
const leafM = new THREE.MeshStandardMaterial({ color: '#3f6b45', roughness: 0.7, side: THREE.DoubleSide });
for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), leafM); l.scale.set(0.35, 1.0, 0.12); const a = i / 9 * Math.PI * 2; l.position.set(-3.6 + Math.cos(a) * 0.25, 1.25 + R() * 0.3, -2.4 + Math.sin(a) * 0.25); l.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5); l.castShadow = true; scene.add(l); }

// ---------- Tumbler (Storm Sea) ----------
const TB = makeTumbler('storm sea'); TB.group.rotation.y = -0.55; scene.add(TB.group);
TB.steel.envMap = makeEnv(r); TB.steel.envMapIntensity = 0.9;
const cs = contactShadow(2.6, 0.5); cs.position.set(0, 0.005, 0); scene.add(cs);

// ---------- Licht: Sonne durchs Fenster, Himmel, Mond ----------
const sun = new THREE.DirectionalLight('#fff1dc', 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -4, near: 1, far: 40 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe0ff', '#3a2a1c', 0.5); scene.add(hemi);
const moon = new THREE.DirectionalLight('#7f98d8', 0.5); moon.position.set(-3.4, 7, -8); scene.add(moon);
const front = new THREE.DirectionalLight('#f4f1ec', 1.0); front.position.set(4, 6, 12); scene.add(front);
const lampL = new THREE.PointLight('#ffc98a', 0, 12, 1.6); lampL.position.set(3.2, 3.2, 1.6); scene.add(lampL);   // Raumlicht abends
const tod = (t) => { const u = (((t - 0.4) % 8) + 8) % 8; return u < 6.6 ? 7 + u * 12 / 6.6 : (19 + (u - 6.6) * 12 / 1.4) % 24; };   // 7-19 Uhr in 6,6 s, Nacht im Schnelldurchlauf   // 8 s = 24 h, t = 0 -> 7 Uhr
function setDay(t) {
  const h = tod(t);
  const day = clamp(Math.sin(Math.PI * (h - 6) / 14));                 // 6..20 Uhr
  const low = 1 - clamp(Math.sin(Math.PI * (h - 6) / 14) * 2.2);       // tiefe Sonne = warm
  const az = lerp(-0.9, 0.9, clamp((h - 6) / 14));                     // wandert von links nach rechts
  sun.position.set(-3.4 + Math.sin(az) * 6, 2.0 + 6 * day, WALLZ - 9 + Math.cos(az) * 1.5);
  sun.color.set('#fff1dc').lerp(new THREE.Color('#ff9a52'), low * 0.85);
  sun.intensity = 3.4 * clamp(day * 1.6);
  hemi.intensity = 0.12 + 0.5 * day; hemi.color.set('#cfe0ff').lerp(new THREE.Color('#5d6fa8'), 1 - day);
  const night = 1 - clamp(day * 3);
  moon.intensity = 0.9 * night;
  const eve = clamp((h - 19.2) / 0.8) * clamp((23.5 - h) / 0.8) + clamp((6.6 - h) / 0.6) * clamp((h - 5.2) / 0.6);   // Raumlicht abends + früh
  lampL.intensity = 14 * eve + 6 * night; front.intensity = 0.9 + 0.6 * day + 0.5 * night;
  drawSky(h);
  const ang = (h / 12) * Math.PI * 2; CLK.userData.hh.rotation.z = -ang; CLK.userData.mh.rotation.z = -h * Math.PI * 2;
  scene.background = new THREE.Color('#0a0c14');
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Tumbler'),
  hook: mk('tt', 'Heute Morgen<br>um 7 eingefüllt.', 300),
  b: mk('tt', 'Isoliert.<br>Bis zu 12 Stunden.', 300),
  c: mk('tt', 'Mit Griff<br>und Strohhalm.', 300),
  p: mk('tt big', '24,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.06, vig: 'rgba(4,8,14,.45)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 3.0, 'weit'], [3.0, 4.7, 'nah'], [4.7, 6.1, 'griff'], [6.1, 7.6, 'preis'], [7.6, 8.4, 'weit2']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.02 * a);
function shoot(t, pos, tgt, a = 1, fov = 30) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
const weitCam = (u) => { const a = 0.22 - 0.03 * u, Rr = 20.5 - 0.4 * u; return [v3(Math.sin(a) * Rr - 0.6, 4.0, Math.cos(a) * Rr), v3(-0.6, 2.9, -1.5)]; };

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  const tl = name === 'weit2' ? t - 8 : t;
  setDay(tl);
  if (name === 'weit' || name === 'weit2') { const [p, q] = weitCam(tl); shoot(t, p, q, 0.6, 30); }
  else if (name === 'nah') { const a = lerp(0.9, 1.15, ease.inOut(sp)); shoot(t, v3(Math.sin(a) * 4.2, 5.4 - 0.2 * sp, Math.cos(a) * 4.2), v3(0, 3.15, 0), 0.3, 32); }
  else if (name === 'griff') { const a = lerp(-0.25, -0.45, ease.inOut(sp)); shoot(t, v3(Math.sin(a) * 7.6, 0.8, Math.cos(a) * 7.6), v3(-0.3, 2.65, 0), 0.4, 32); }
  else { const a = lerp(-0.8, -0.9, ease.out(sp)); shoot(t, v3(Math.sin(a) * 9.6, 4.6, Math.cos(a) * 9.6), v3(-0.4, 2.6, -0.4), 0.4, 32); }
  scene.updateMatrixWorld(true);
  // ---------- Overlay ----------
  tx.pill.style.opacity = 1; tx.word.style.opacity = 1;
  tx.hook.style.transform = 'none';
  tx.hook.style.opacity = t < 3.0 ? 1 : (t >= 7.6 ? 1 : 0);
  pop(tx.b, t >= 3.45 && t < 4.7 ? t - 3.45 : -1, seg(t, 4.62, 4.7));
  pop(tx.c, t >= 4.8 && t < 6.1 ? t - 4.8 : -1, seg(t, 6.02, 6.1));
  pop(tx.p, t >= 6.15 && t < 7.6 ? t - 6.15 : -1, seg(t, 7.52, 7.6));
  pop(tx.cta, t >= 6.5 && t < 7.6 ? t - 6.5 : -1, seg(t, 7.52, 7.6));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
