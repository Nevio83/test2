// Maios CGI – Led crystal lampe (Produkt 21, Variante Holz boden = Wellenglas-Wuerfel), "An meiner Decke laeuft was.", Loop-Clip 8 s (Render 8,4 s)
// Handy-Look, Schlafzimmer bei Nacht, POV im Bett: rotierende Projektion zieht ueber die Decke. Farbe wechselt von Einstellung zu Einstellung.
// Ablauf: POV Decke (Hook) -> Lampe nah, Wand dahinter -> Zimmer vom Fussende -> Preis + Link -> zurueck zur Decke (Loop).
// Technik: Bloom (lib/post.js) auf Glanzlichtern.
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { stripEnv } from '../lib/tiefe.js';
import * as C from '../lib/crystal_models.js';
import { makePost } from '../lib/post.js';

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

// ---------- Schlafzimmer (Meter): Wand z = -1 (Fussende), Kopfende bei z = 3,4, Decke 2,5 ----------
const X0 = -1.6, X1 = 1.6, Z0 = -1.0, Z1 = 3.4, HH = 2.5;
const mats = [];
const PM = (o) => { const m = C.projMaterial(o); mats.push(m); return m; };
const plane = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), mat);
const back = plane(X1 - X0, HH, PM({ albedo: '#bdb5ae' })); back.position.set(0, HH / 2, Z0); scene.add(back);
const front = plane(X1 - X0, HH, PM({ albedo: '#bdb5ae' })); front.rotation.y = Math.PI; front.position.set(0, HH / 2, Z1); scene.add(front);
const left = plane(Z1 - Z0, HH, PM({ albedo: '#b6aea8' })); left.rotation.y = Math.PI / 2; left.position.set(X0, HH / 2, (Z0 + Z1) / 2); scene.add(left);
const right = plane(Z1 - Z0, HH, PM({ albedo: '#b6aea8' })); right.rotation.y = -Math.PI / 2; right.position.set(X1, HH / 2, (Z0 + Z1) / 2); scene.add(right);
const ceil = plane(X1 - X0, Z1 - Z0, PM({ albedo: '#d9d6d0' })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HH, (Z0 + Z1) / 2); scene.add(ceil);
const dielen = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#6f5a47'; g.fillRect(0, 0, w, h); const pw = w / 8;
  for (let i = 0; i < 8; i++) { const c = 0.85 + R() * 0.25; g.fillStyle = `rgb(${122 * c | 0},${98 * c | 0},${76 * c | 0})`; g.fillRect(i * pw + 1, 0, pw - 2, h); }
  g.fillStyle = 'rgba(30,18,8,0.5)'; for (let i = 0; i <= 8; i++) g.fillRect(i * pw - 1, 0, 2, h);
});
dielen.wrapS = dielen.wrapT = THREE.RepeatWrapping;
const floor = plane(X1 - X0, Z1 - Z0, PM({ albedo: '#ffffff', map: dielen, repeat: [2, 2] })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (Z0 + Z1) / 2); scene.add(floor);
// Bett: Matratze mit Bettdecke, Kissen, Kopfteil an der Stirnwand
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), mat);
const BX = -0.35, BZ0 = 0.0, BZ1 = 3.35;
const bedM = PM({ albedo: '#e3dfd8' }), duvetM = PM({ albedo: '#5d6f86' });
const frameB = box(1.7, 0.25, BZ1 - BZ0, PM({ albedo: '#4a3c30' })); frameB.position.set(BX, 0.125, (BZ0 + BZ1) / 2); scene.add(frameB);
const mattress = box(1.64, 0.2, BZ1 - BZ0 - 0.06, bedM); mattress.position.set(BX, 0.35, (BZ0 + BZ1) / 2); scene.add(mattress);
const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.14, 1.9, 14, 1, 14), duvetM); duvet.position.set(BX, 0.52, 0.95);
{ const p = duvet.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + 0.012 * Math.sin(x * 9 + z * 5) * Math.sin(z * 7 - x * 3)); } duvet.geometry.computeVertexNormals(); }
scene.add(duvet);
const headb = box(1.8, 0.9, 0.08, PM({ albedo: '#4a3c30' })); headb.position.set(BX, 0.7, Z1 - 0.04); scene.add(headb);
const pillowM = PM({ albedo: '#f0ece6' });
for (const dx of [-0.42, 0.42]) { const pw = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.15, 0.4, 10, 3, 6), pillowM); pw.position.set(BX + dx, 0.55, 3.0); pw.rotation.y = dx * 0.08; scene.add(pw);
  const pp = pw.geometry.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const e = 1 - 0.5 * Math.pow(Math.abs(x) / 0.31, 3); pp.setY(i, y * e + (y > 0 ? 0.03 * (1 - Math.pow(Math.abs(x) / 0.31, 2)) : 0)); } pw.geometry.computeVertexNormals(); }
// Nachttisch rechts vom Bett, Lampe darauf (Holz boden: Wuerfel)
const NT = v3(0.78, 0.0, 2.75);
const ntM = PM({ albedo: '#3d3128' });
const ntBody = box(0.46, 0.5, 0.42, ntM); ntBody.position.set(NT.x, 0.25, NT.z); scene.add(ntBody);
const ntTop = box(0.5, 0.03, 0.46, PM({ albedo: '#b89168' })); ntTop.position.set(NT.x, 0.515, NT.z); scene.add(ntTop);
const books = box(0.2, 0.05, 0.14, PM({ albedo: '#6d8a8f' })); books.position.set(NT.x - 0.1, 0.555, NT.z + 0.12); books.rotation.y = 0.3; scene.add(books);
const wglas = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.09, 24), new THREE.MeshPhysicalMaterial({ color: '#cfe6ee', roughness: 0.05, transmission: 0.9, thickness: 0.02, transparent: true, opacity: 0.8 })); wglas.position.set(NT.x + 0.17, 0.575, NT.z - 0.12); scene.add(wglas);
// Vorhang links als dunkle Flaeche mit Falten (Raum, gibt Tiefe)
const vorhang = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.3, 40, 1), PM({ albedo: '#4a4f5a' }));
{ const p = vorhang.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.06 * Math.sin(p.getX(i) * 18)); vorhang.geometry.computeVertexNormals(); }
vorhang.rotation.y = Math.PI / 2; vorhang.position.set(X0 + 0.02, 1.2, 1.2); scene.add(vorhang);
// Staub im Lichtkegel: kleine Punkte, die langsam steigen (Periode 8 s)
const dustN = 90, dustG = new THREE.BufferGeometry(); const dp = new Float32Array(dustN * 3), dph = []; for (let i = 0; i < dustN; i++) { dph.push(R()); dp[i * 3] = 0; }
dustG.setAttribute('position', new THREE.BufferAttribute(dp, 3));
const dustM = new THREE.PointsMaterial({ size: 0.012, color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
const dust = new THREE.Points(dustG, dustM); dust.frustumCulled = false; scene.add(dust);

// ---------- Lampe ----------
const L = C.makeCube();
L.group.position.set(NT.x + 0.0, 0.53, NT.z - 0.02); L.group.rotation.y = 0.4; scene.add(L.group);
const lampMid = () => L.group.localToWorld(v3(0, C.CUBE_MID, 0));
const amb = new THREE.HemisphereLight('#7f8fc0', '#0b0c10', 0.05); scene.add(amb);
const fill = new THREE.DirectionalLight('#ffffff', 0); fill.position.set(-1.2, 1.6, 2.0); fill.target.position.copy(lampMid()); scene.add(fill, fill.target);
const P = makePost(r, scene, cam, { strength: 0.32, radius: 0.55, threshold: 0.92 });

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'LED Crystal Lampe'),
  a: mk('tt', 'An meiner Decke<br>läuft was.', 330),
  b: mk('tt', 'Kommt aus<br>dieser Lampe.', 330),
  c: mk('tt', '16 Farben.<br>Die Projektion dreht sich.', 330),
  p: mk('tt big', '19,99&nbsp;€', 300),
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
const SHOTS = [[0, 3.6, 'decke'], [3.6, 4.9, 'lampe'], [4.9, 6.1, 'raum'], [6.1, 7.2, 'preis'], [7.2, 8.4, 'decke2']];
const FARBE = { decke: '#ff3d8f', lampe: '#2f8bff', raum: '#ffa11f', preis: '#a05cff', decke2: '#ff3d8f' };

const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.01 * a);
function shoot(t, pos, tgt, a = 1, fov = 50) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
// Einstellung 1: Kamera kippt von der leuchtenden Lampe (Wand mit Projektion) hoch zur Decke; Schluss kippt zurueck, bei u = 0 gleich dem Anfang
const D0 = v3(-0.32, 0.64, 2.64), DTL = v3(0.8, 0.82, 2.72), DTC = v3(0.38, 2.5, 1.7);
const tiltW = (u) => ease.inOut(clamp(u >= 0 ? u / 3.2 : -u / 0.8));   // langsames Hochkippen am Anfang (3,2 s), Zurueckkippen am Schluss (0,8 s)
const deckeCam = (u) => { const w = tiltW(u); const dr = u > 0 ? Math.sin(u * 0.9) * 0.05 * w : 0; return [D0.clone(), vlerp(DTL, DTC, w).add(v3(dr, dr * 0.5, 0))]; };

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  const col = new THREE.Color(FARBE[name]);
  const tp = name === 'decke2' ? t - 8 : t;
  const lp = lampMid();
  for (const m of mats) { m.uniforms.uLamp.value.copy(lp); m.uniforms.uCol.value.copy(col); m.uniforms.uT.value = tp;
    m.uniforms.uK.value = (name === 'decke' || name === 'decke2') ? 2.6 : name === 'lampe' ? 1.6 : 1.5;
    m.uniforms.uAmb.value.set('#07080d'); m.uniforms.uMoon.value.set('#101a30'); m.uniforms.uMoonDir.value.set(-0.4, -0.2, -0.9).normalize(); }
  L.setColor(col, 1);
  fill.intensity = (name === 'lampe') ? 0.5 : (name === 'raum' || name === 'preis' ? 0.35 : 0);
  r.toneMappingExposure = name === 'lampe' ? 0.85 : 1.0;
  // Staub steigt (eine Umlaufperiode = 8 s), nur ueber der Lampe
  { const pa = dustG.attributes.position; for (let i = 0; i < dustN; i++) { const ph = (((tp / 8 + dph[i]) % 1) + 1) % 1; const a = dph[i] * 40 + i;
    pa.setXYZ(i, lp.x - 0.45 + Math.sin(a) * 0.5 + Math.sin(ph * 6.28 + a) * 0.04, 0.7 + ph * 1.7, lp.z - 0.5 + Math.cos(a * 1.3) * 0.7); } pa.needsUpdate = true; dustM.color.copy(col).lerp(new THREE.Color('#ffffff'), 0.5); }

  if (name === 'decke' || name === 'decke2') {
    const u = name === 'decke' ? t : t - 8; const [p, q] = deckeCam(u); shoot(t, p, q, 0.8, 66);
  } else if (name === 'lampe') {
    const c = lampMid(); const a = lerp(-0.75, -0.55, ease.inOut(sp)), d = lerp(0.5, 0.44, ease.out(sp));
    // von vorn-links auf die Lampe, dahinter die rechte Wand mit Projektion
    shoot(t, v3(c.x - Math.cos(a) * d, c.y + 0.13, c.z + Math.sin(a) * d * -1 + 0.0), c.clone().add(v3(0.0, 0.0, 0)), 0.3, 40);
  } else if (name === 'raum') {
    shoot(t, vlerp(v3(-0.3, 0.95, 1.0), v3(-0.2, 0.97, 1.25), ease.out(sp)), v3(0.72, 0.8, 2.8), 0.5, 52);
  } else if (name === 'preis') {
    shoot(t, vlerp(v3(-0.3, 1.0, 1.3), v3(-0.2, 1.02, 1.6), ease.out(sp)), v3(0.66, 0.78, 2.9), 0.5, 50);
  }
  scene.updateMatrixWorld(true);

  tx.pill.style.opacity = 1;
  tx.word.style.opacity = 1;
  pop(tx.a, t < 3.6 ? t + 0.3 : t >= 7.3 ? t - 7.3 : -1, t < 3.6 ? seg(t, 3.5, 3.6) : 0);
  pop(tx.b, t >= 3.7 && t < 4.9 ? t - 3.7 : -1, seg(t, 4.8, 4.9));
  pop(tx.c, t >= 5.0 && t < 6.1 ? t - 5.0 : -1, seg(t, 6.0, 6.1));
  pop(tx.p, t >= 6.15 && t < 7.2 ? t - 6.15 : -1, seg(t, 7.1, 7.2));
  pop(tx.cta, t >= 6.45 && t < 7.2 ? t - 6.45 : -1, seg(t, 7.1, 7.2));
  O.grain(Math.round(t * 30), 1);
  P.render();
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
