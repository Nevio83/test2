// Maios CGI – Led crystal lampe (Produkt 21, Krone), "Meine Wände bewegen sich.", Loop-Clip 8 s (Render 8,4 s)
// Handy-Look, Halloween-Nacht im Schlafzimmer: rote Wasserwellen ziehen ueber Wand und Decke (Projektion der Lampe).
// Ablauf: Wand mit roten Wellen (Hook) -> Blick zur Decke, Farbwechsel -> Lampe nah: "Nur meine Lampe. 16 Farben."
//         -> Nachttisch halbnah, Preis + Link -> zurueck zur roten Wand (Loop).
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
const R = rng(31);

// ---------- Schlafzimmer (Meter): Rueckwand z = -1, linke Wand x = -1.5, Decke 2,5 ----------
const X0 = -1.5, X1 = 1.5, Z0 = -1.0, Z1 = 3.2, HH = 2.5;
const mats = [];
const PM = (o) => { const m = C.projMaterial(o); mats.push(m); return m; };
const plane = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), mat);
const back = plane(X1 - X0, HH, PM({ albedo: '#d4cdc4' })); back.position.set(0, HH / 2, Z0); scene.add(back);
const left = plane(Z1 - Z0, HH, PM({ albedo: '#cfc8bf' })); left.rotation.y = Math.PI / 2; left.position.set(X0, HH / 2, (Z0 + Z1) / 2); scene.add(left);
const right = plane(Z1 - Z0, HH, PM({ albedo: '#cfc8bf' })); right.rotation.y = -Math.PI / 2; right.position.set(X1, HH / 2, (Z0 + Z1) / 2); scene.add(right);
const ceil = plane(X1 - X0, Z1 - Z0, PM({ albedo: '#dcd7d0' })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HH, (Z0 + Z1) / 2); scene.add(ceil);
const parkett = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#6a4a33'; g.fillRect(0, 0, w, h); const pw = w / 6;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const y0 = j * h / 4 + (i % 2) * h / 8; const c = 0.8 + R() * 0.3; g.fillStyle = `rgb(${110 * c | 0},${80 * c | 0},${56 * c | 0})`; g.fillRect(i * pw + 1, y0 + 1, pw - 2, h / 4 - 2); }
  g.fillStyle = 'rgba(20,12,6,0.6)'; for (let i = 0; i <= 6; i++) g.fillRect(i * pw - 1, 0, 2, h);
});
parkett.wrapS = parkett.wrapT = THREE.RepeatWrapping;
const floor = plane(X1 - X0, Z1 - Z0, PM({ albedo: '#ffffff', map: parkett, repeat: [3, 4] })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (Z0 + Z1) / 2); scene.add(floor);

// Bett (links), Kopfteil an der Rueckwand, Decke und Kissen bekommen die Projektion mit
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), mat);
const bedX = -0.45, bedW = 1.45;
const frameMat = PM({ albedo: '#5b4636' });
const head = box(bedW + 0.08, 1.0, 0.06, PM({ albedo: '#6f6a74' })); head.position.set(bedX, 0.5, Z0 + 0.03); scene.add(head);
const bedBase = box(bedW + 0.08, 0.3, 2.05, frameMat); bedBase.position.set(bedX, 0.15, Z0 + 0.06 + 1.02); scene.add(bedBase);
const duvetMat = PM({ albedo: '#e9e6e2' });
const duvet = new THREE.Mesh(new THREE.BoxGeometry(bedW + 0.06, 0.2, 1.55, 24, 4, 24), duvetMat);
{ const p = duvet.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y > 0) p.setY(i, y + 0.03 * Math.sin(x * 6 + z * 3) * Math.cos(z * 4)); } duvet.geometry.computeVertexNormals(); }
duvet.position.set(bedX, 0.4, Z0 + 0.06 + 0.5 + 0.78); scene.add(duvet);
const pillowMat = new THREE.MeshStandardMaterial({ color: '#9a96a0', roughness: 0.9 });
for (const dx of [-0.36, 0.36]) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.38, 12, 4, 8), pillowMat);
  const p = k.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / 0.3, z = p.getZ(i) / 0.19; const f = Math.max(0, 1 - 0.55 * (x * x * x * x + z * z * z * z)); p.setY(i, p.getY(i) * (0.35 + 0.65 * f)); }
  k.geometry.computeVertexNormals(); k.position.set(bedX + dx, 0.56, Z0 + 0.26); k.rotation.x = -0.25; scene.add(k); }
// Bild ueber dem Bett
const pic = box(0.62, 0.44, 0.025, PM({ albedo: '#2a2622' })); pic.position.set(bedX, 1.6, Z0 + 0.015); scene.add(pic);
const picIn = plane(0.54, 0.36, PM({ albedo: '#8c8f96' })); picIn.position.set(bedX, 1.6, Z0 + 0.029); scene.add(picIn);
// Nachttisch rechts vom Bett
const NT = v3(0.62, 0.5, Z0 + 0.25);
const ntMat = new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.5 });
const nt = box(0.46, 0.5, 0.4, ntMat); nt.position.set(NT.x, 0.25, NT.z); nt.castShadow = nt.receiveShadow = true; scene.add(nt);
const ntTop = box(0.48, 0.025, 0.42, new THREE.MeshStandardMaterial({ color: '#4a3628', roughness: 0.35 })); ntTop.position.set(NT.x, 0.5 + 0.0125, NT.z); ntTop.receiveShadow = true; scene.add(ntTop);
const drawer = box(0.4, 0.012, 0.004, new THREE.MeshStandardMaterial({ color: '#1e1610', roughness: 0.6 })); drawer.position.set(NT.x, 0.33, NT.z + 0.201); scene.add(drawer);
// Buch und Glas auf dem Nachttisch
const book = box(0.15, 0.025, 0.21, new THREE.MeshStandardMaterial({ color: '#2b3b4c', roughness: 0.7 })); book.position.set(NT.x + 0.13, 0.525 + 0.0125, NT.z - 0.02); book.rotation.y = 0.25; scene.add(book);

// ---------- Lampe ----------
const L = C.makeLamp();
L.group.position.set(NT.x - 0.06, 0.525, NT.z + 0.02); L.group.rotation.y = 0.0; scene.add(L.group);
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
  a: mk('tt', 'Halloween.<br>Meine Wände<br>bewegen sich.', 330),
  b: mk('tt', 'Rot, Lila, Grün,<br>Blau …', 330),
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
const SHOTS = [[0, 2.4, 'wand'], [2.4, 4.2, 'decke'], [4.2, 6.0, 'lampe'], [6.0, 7.2, 'tisch'], [7.2, 8.4, 'wand2']];
const ROT = '#ff2d14', LILA = '#9b4dff', GRUEN = '#22e06a', BLAU = '#2f7bff', ORANGE = '#ff8a1a';
// Farbe der Lampe ueber die Zeit (Touch: Farbe wechseln). Halloween-Rot am Anfang und Ende.
const FARBEN = [[0, ROT], [2.95, LILA], [3.3, GRUEN], [3.62, BLAU], [3.92, ORANGE], [4.2, LILA], [7.2, ROT]];
function farbe(t) { let c = FARBEN[0][1]; for (const [s, f] of FARBEN) if (t >= s) c = f; return c; }

const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.01 * a);
function shoot(t, pos, tgt, a = 1, fov = 50) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
// Wand-Einstellung als Funktion von u (Render 0 .. 2,4 und -1,2 .. 0,4 im Schluss): gleiche Kamera am Ende wie am Anfang
const W0 = v3(-0.15, 1.2, 2.6), W1 = v3(-0.05, 1.22, 2.35), WT0 = v3(-0.25, 1.75, Z0), WT1 = v3(-0.2, 1.8, Z0);
const wandCam = (u) => { const k = (u + 1.2) / 3.6; return [vlerp(W0, W1, k), vlerp(WT0, WT1, k)]; };

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  const col = new THREE.Color(farbe(t));
  // Projektion: Zeit periodisch (8 s), Schluss-Einstellung mit t - 8 -> identisch mit dem Anfang
  const tp = name === 'wand2' ? t - 8 : t;
  const lp = lampMid();
  for (const m of mats) { m.uniforms.uLamp.value.copy(lp); m.uniforms.uCol.value.copy(col); m.uniforms.uT.value = tp; m.uniforms.uK.value = name === 'decke' ? 1.9 : (name === 'wand' || name === 'wand2') ? 1.7 : 1.25;
    m.uniforms.uAmb.value.set('#07080d'); m.uniforms.uMoon.value.set('#0b1020'); m.uniforms.uMoonDir.value.set(0.8, -0.35, -0.5).normalize(); }
  L.setColor(col, 1);
  fill.intensity = (name === 'lampe') ? 0.8 : (name === 'tisch' ? 0.5 : 0);
  r.toneMappingExposure = name === 'lampe' ? 0.8 : 1.0;

  if (name === 'wand' || name === 'wand2') {
    const u = name === 'wand' ? t : t - 8; const [p, q] = wandCam(u); shoot(t, p, q, 1.0, 50);
  } else if (name === 'decke') {
    shoot(t, vlerp(v3(1.25, 1.55, 2.9), v3(1.15, 1.5, 2.6), ease.inOut(sp)), v3(-0.35, 1.35, -1.0), 0.8, 62);
  } else if (name === 'lampe') {
    const c = lampMid(); const a = lerp(0.55, 0.35, ease.inOut(sp)), d = lerp(0.56, 0.5, ease.out(sp));
    shoot(t, v3(c.x - Math.sin(a) * d, c.y + 0.1, c.z + Math.cos(a) * d), c.clone().add(v3(0, 0.1, 0)), 0.3, 36);
  } else if (name === 'tisch') {
    const c = lampMid(); shoot(t, vlerp(v3(c.x - 0.75, 1.05, c.z + 1.25), v3(c.x - 0.66, 1.0, c.z + 1.08), ease.out(sp)), c.clone().add(v3(-0.05, 0.32, 0)), 0.5, 46);
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
