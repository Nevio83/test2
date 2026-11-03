// Maios CGI – Led crystal lampe (Produkt 21, Krone), "17 Uhr. Draußen schon dunkel.", Loop-Clip 8 s (Render 8,4 s)
// Handy-Look, November-Abend im Wohnzimmer: Fenster mit Stadt, gruen-tuerkise Wellen (Projektion) ziehen ueber Wand und Decke.
// Ablauf: Fenster + Sofa mit gruenen Wellen (Hook) -> vom Sofa zur Decke, "Drinnen: Polarlicht." -> Lampe flach von der Seite,
//         Fenster unscharf dahinter: "Nur meine Lampe. 16 Farben." -> Wohnzimmer halbtotal, Preis + Link -> zurueck zum Fenster (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { stripEnv } from '../lib/tiefe.js';
import * as C from '../lib/crystal_models.js';

const style = document.createElement('style');
style.textContent = BR.CSS + `
.tt{position:absolute;left:70px;width:800px;text-align:center;font:800 68px Manrope;line-height:1.16;color:#fff;letter-spacing:-.005em;
  text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.75),0 0 22px rgba(0,0,0,.45)}
.tt.big{font-size:150px;letter-spacing:-.02em}
.tt.k{font-size:52px;font-weight:700;opacity:.95}
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(0,0,0,.42)}
.tword{position:absolute;top:208px;padding:7px 14px 6px;border-radius:12px;background:rgba(0,0,0,.42);font:700 32px Manrope;color:#fff;letter-spacing:.01em;text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.7)}
.tcta{position:absolute;left:270px;width:400px;text-align:center;font:800 44px Manrope;color:#111;background:#fff;border-radius:18px;padding:20px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 40px Manrope', 'ßüä€·?:');

const r = makeRenderer(); r.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#020205');
const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.01, 60);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
scene.environment = stripEnv(r, { bg: '#05060a', strips: [
  { w: 1.0, h: 9, pos: v3(-5.5, 0, 1.8), col: '#cfdcff', I: 1.2 }, { w: 1.0, h: 9, pos: v3(5.5, 0, 0.8), col: '#e8e0ff', I: 0.9 }], top: { w: 4, h: 4, col: '#c8d0ea', I: 0.6 } });
scene.environmentIntensity = 0.35;
const R = rng(47);

// ---------- Wohnzimmer (Meter): Rueckwand z = -1 mit Fenster, Decke 2,5 ----------
const X0 = -1.6, X1 = 1.6, Z0 = -1.0, Z1 = 3.4, HH = 2.5;
const mats = [];
const PM = (o) => { const m = C.projMaterial(o); mats.push(m); return m; };
const plane = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), mat);
const back = plane(X1 - X0, HH, PM({ albedo: '#cfd2cf' })); back.position.set(0, HH / 2, Z0); scene.add(back);
const left = plane(Z1 - Z0, HH, PM({ albedo: '#c9ccc9' })); left.rotation.y = Math.PI / 2; left.position.set(X0, HH / 2, (Z0 + Z1) / 2); scene.add(left);
const right = plane(Z1 - Z0, HH, PM({ albedo: '#c9ccc9' })); right.rotation.y = -Math.PI / 2; right.position.set(X1, HH / 2, (Z0 + Z1) / 2); scene.add(right);
const ceil = plane(X1 - X0, Z1 - Z0, PM({ albedo: '#dcdcd8' })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HH, (Z0 + Z1) / 2); scene.add(ceil);
const dielen = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#8a6a4c'; g.fillRect(0, 0, w, h); const pw = w / 8;
  for (let i = 0; i < 8; i++) { const c = 0.85 + R() * 0.25; g.fillStyle = `rgb(${150 * c | 0},${116 * c | 0},${84 * c | 0})`; g.fillRect(i * pw + 1, 0, pw - 2, h); }
  g.fillStyle = 'rgba(30,18,8,0.5)'; for (let i = 0; i <= 8; i++) g.fillRect(i * pw - 1, 0, 2, h);
});
dielen.wrapS = dielen.wrapT = THREE.RepeatWrapping;
const floor = plane(X1 - X0, Z1 - Z0, PM({ albedo: '#ffffff', map: dielen, repeat: [2, 2] })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (Z0 + Z1) / 2); scene.add(floor);
// Fenster: blaue Stunde vorbei, Stadt mit Lichtern (Fensterkreuz), leicht vor der Wand
const WX = -0.35, WY = 1.55, WW = 1.25, WH = 1.15;
const sky = canvasTex(512, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a1430'); gr.addColorStop(0.7, '#1b2f5c'); gr.addColorStop(1, '#2c3f6e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) { const x = i * 60 - 10 + R() * 20, bh = 120 + R() * 160; g.fillStyle = '#070a14'; g.fillRect(x, h - bh, 52, bh);
    for (let k = 0; k < 14; k++) if (R() < 0.45) { g.fillStyle = R() < 0.7 ? '#ffcf7a' : '#fff1d0'; g.fillRect(x + 6 + (k % 4) * 11, h - bh + 12 + Math.floor(k / 4) * 22, 6, 9); } }
});
const win = plane(WW, WH, new THREE.MeshBasicMaterial({ map: sky, toneMapped: false, color: '#9aa6c8' })); win.position.set(WX, WY, Z0 + 0.012); scene.add(win);
const frameM = new THREE.MeshStandardMaterial({ color: '#e6e6e2', roughness: 0.6 });
for (const [w, h, x, y] of [[WW + 0.1, 0.05, 0, WH / 2], [WW + 0.1, 0.07, 0, -WH / 2], [0.05, WH, -WW / 2, 0], [0.05, WH, WW / 2, 0], [0.035, WH, 0, 0]]) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), frameM); b.position.set(WX + x, WY + y, Z0 + 0.03); scene.add(b); }
// Sofa vor dem Fenster
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), mat);
const sofaM = PM({ albedo: '#3e5560' });
const SX = -0.45, SZ = Z0 + 0.55;
const seat = box(1.9, 0.42, 0.85, sofaM); seat.position.set(SX, 0.21, SZ); scene.add(seat);
const backrest = box(1.9, 0.42, 0.2, sofaM); backrest.position.set(SX, 0.62, SZ - 0.33); scene.add(backrest);
for (const s of [-1, 1]) { const arm = box(0.18, 0.6, 0.85, sofaM); arm.position.set(SX + s * 0.95, 0.3, SZ); scene.add(arm); }
const kissenM = new THREE.MeshStandardMaterial({ color: '#c9b79a', roughness: 0.9 });
for (const dx of [-0.55, 0.4]) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.12, 6, 6, 2), kissenM); k.position.set(SX + dx, 0.62, SZ - 0.18); k.rotation.set(-0.2, dx * 0.4, dx * 0.1); scene.add(k); }
const decke = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.5, 6, 1, 6), new THREE.MeshStandardMaterial({ color: '#7a3b3b', roughness: 0.95 })); decke.position.set(SX - 0.45, 0.445, SZ + 0.1); decke.rotation.y = 0.3; scene.add(decke);
// Beistelltisch rechts vom Sofa
const NT = v3(0.85, 0.52, Z0 + 0.45);
const ntMat = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.45 });
const ntTopM = new THREE.MeshStandardMaterial({ color: '#c8a57c', roughness: 0.4 });
const ntTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 48), ntTopM); ntTop.position.set(NT.x, 0.5 + 0.015, NT.z); ntTop.receiveShadow = true; scene.add(ntTop);
const ntLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 16), ntMat); ntLeg.position.set(NT.x, 0.25, NT.z); scene.add(ntLeg);
const ntFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.02, 32), ntMat); ntFoot.position.set(NT.x, 0.01, NT.z); scene.add(ntFoot);
const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 24), new THREE.MeshStandardMaterial({ color: '#e9e3d8', roughness: 0.35 })); mug.position.set(NT.x + 0.12, 0.53 + 0.045, NT.z + 0.06); scene.add(mug);
// Pflanze in der Ecke
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.3, 24), new THREE.MeshStandardMaterial({ color: '#b6683e', roughness: 0.8 })); pot.position.set(X1 - 0.3, 0.15, Z0 + 0.35); scene.add(pot);
const leafM = PM({ albedo: '#3f6b3a' });
for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), leafM); const a = i * 2.4; lf.scale.set(0.5, 1.6, 0.25); lf.position.set(X1 - 0.3 + Math.cos(a) * 0.12, 0.45 + (i % 3) * 0.12, Z0 + 0.35 + Math.sin(a) * 0.12); lf.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5); scene.add(lf); }

// ---------- Lampe ----------
const L = C.makeLamp();
L.group.position.set(NT.x - 0.05, 0.53, NT.z - 0.03); L.group.rotation.y = 0.0; scene.add(L.group);
const lampMid = () => L.group.localToWorld(v3(0, C.MID, 0));
const lampTop = () => L.group.localToWorld(v3(0, C.TOP * 0.55, 0));
const amb = new THREE.HemisphereLight('#7f8fc0', '#0b0c10', 0.05); scene.add(amb);
const fill = new THREE.DirectionalLight('#ffffff', 0); fill.position.set(-1.2, 1.6, 2.0); fill.target.position.copy(lampMid()); scene.add(fill, fill.target);

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'LED Crystal Lampe'),
  a: mk('tt', '17 Uhr.<br>Draußen schon dunkel.', 330),
  b: mk('tt', 'Drinnen: Polarlicht.', 330),
  c: mk('tt', 'Nur meine Lampe.<br>16 Farben.', 330),
  p: mk('tt big', '18,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.08, vig: 'rgba(0,0,6,.6)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 2.4, 'fenster'], [2.4, 4.2, 'sofa'], [4.2, 6.0, 'lampe'], [6.0, 7.2, 'raum'], [7.2, 8.4, 'fenster2']];
const TUERKIS = '#18e0b0', GRUEN = '#3cff7a', BLAU = '#2f8bff', LILA = '#a05cff';
// Farbe: Polarlicht-Tuerkis am Anfang und Ende, in der Mitte weich durch Gruen, Blau, Lila (Touch: Farbe wechseln)
const FARBEN = [[0, TUERKIS], [2.9, GRUEN], [3.45, BLAU], [3.95, LILA], [6.0, BLAU], [7.2, TUERKIS]];
function farbe(t) { let c = FARBEN[0][1]; for (const [s, f] of FARBEN) if (t >= s) c = f; return c; }

const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.01 * a);
function shoot(t, pos, tgt, a = 1, fov = 50) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
// Fenster-Einstellung als Funktion von u (Render 0 .. 2,4 und -1,2 .. 0,4 im Schluss): gleiche Kamera am Ende wie am Anfang
const W0 = v3(0.95, 1.0, 2.9), W1 = v3(0.8, 1.03, 2.6), WT0 = v3(0.0, 1.3, Z0), WT1 = v3(0.05, 1.35, Z0);
const wandCam = (u) => { const k = (u + 1.2) / 3.6; return [vlerp(W0, W1, k), vlerp(WT0, WT1, k)]; };

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  const col = new THREE.Color(farbe(t));
  // Projektion: Zeit periodisch (8 s), Schluss-Einstellung mit t - 8 -> identisch mit dem Anfang
  const tp = name === 'fenster2' ? t - 8 : t;
  const lp = lampMid();
  for (const m of mats) { m.uniforms.uLamp.value.copy(lp); m.uniforms.uCol.value.copy(col); m.uniforms.uT.value = tp; m.uniforms.uK.value = name === 'sofa' ? 1.9 : (name === 'fenster' || name === 'fenster2') ? 1.8 : 1.3;
    m.uniforms.uAmb.value.set('#090b12'); m.uniforms.uMoon.value.set('#182444'); m.uniforms.uMoonDir.value.set(0.15, -0.25, 1.0).normalize(); }
  L.setColor(col, 1);
  fill.intensity = (name === 'lampe') ? 0.7 : (name === 'raum' ? 0.45 : 0);
  r.toneMappingExposure = name === 'lampe' ? 0.8 : 1.0;

  if (name === 'fenster' || name === 'fenster2') {
    const u = name === 'fenster' ? t : t - 8; const [p, q] = wandCam(u); shoot(t, p, q, 1.0, 52);
  } else if (name === 'sofa') {
    shoot(t, vlerp(v3(1.35, 0.55, 1.3), v3(1.25, 0.6, 1.05), ease.inOut(sp)), v3(-0.9, 1.75, Z0), 0.8, 62);
  } else if (name === 'lampe') {
    const c = lampMid(); const a = lerp(-0.95, -0.7, ease.inOut(sp)), d = lerp(0.5, 0.44, ease.out(sp));
    shoot(t, v3(c.x + Math.sin(a) * d, c.y + 0.06, c.z + Math.cos(a) * d), c.clone().add(v3(0, 0.1, 0)), 0.3, 40);
  } else if (name === 'raum') {
    const c = lampMid(); shoot(t, vlerp(v3(1.1, 1.25, 2.6), v3(1.0, 1.2, 2.35), ease.out(sp)), v3(0.2, 0.75, Z0 + 0.3), 0.5, 50);
  }
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  tx.word.style.opacity = 1;   // Produktwort durchgehend (Titelbild mit Lampe + Wort)
  pop(tx.a, t < 2.4 ? t + 0.3 : t >= 7.3 ? t - 7.3 : -1, t < 2.4 ? seg(t, 2.3, 2.4) : 0);
  pop(tx.b, t >= 2.5 && t < 4.2 ? t - 2.5 : -1, seg(t, 4.1, 4.2));
  pop(tx.c, t >= 4.35 && t < 6.0 ? t - 4.35 : -1, seg(t, 5.9, 6.0));
  pop(tx.p, t >= 6.05 && t < 7.2 ? t - 6.05 : -1, seg(t, 7.1, 7.2));
  pop(tx.cta, t >= 6.35 && t < 7.2 ? t - 6.35 : -1, seg(t, 7.1, 7.2));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
