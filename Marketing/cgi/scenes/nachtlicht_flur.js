// Maios CGI – Nachtlichter mit Bewegungsmelder (Produkt 25), "Das Licht geht von allein an.", Loop-Clip 8 s (Render 8,4 s)
// Handy-Look, POV im dunklen Flur um 3 Uhr nachts: Mondlicht durchs Fenster, Staub im Lichtstrahl.
// Ablauf: Flur dunkel, man geht auf das Nachtlicht zu, es geht an (Hook) -> Sensor-Auge nah -> "Kein Spuk.
//         Bewegungsmelder." -> Seitenansicht an der Wand, Preis + Link -> zurueck in den dunklen Flur (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { stripEnv } from '../lib/tiefe.js';
import * as N from '../lib/nachtlicht_models.js';

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
await document.fonts.load('800 40px Manrope', 'ßü€·?:');

const r = makeRenderer(); r.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#020306');
const cam = new THREE.PerspectiveCamera(55, 1080 / 1920, 0.01, 60);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
scene.environment = stripEnv(r, { bg: '#05070c', strips: [
  { w: 1.0, h: 9, pos: v3(-5.5, 0, 1.8), col: '#cfdcff', I: 1.4 }, { w: 1.0, h: 9, pos: v3(5.5, 0, 0.8), col: '#ffd7a8', I: 1.0 }], top: { w: 4, h: 4, col: '#bcd0ea', I: 0.6 } });
scene.environmentIntensity = 0.25;

// ---------- Flur (Meter): Breite 1,3, Hoehe 2,5, Nachtlicht rechts bei z = 0 ----------
const HW = 0.65, HH = 2.5, Z0 = -3.4, Z1 = 7.0;
const R = rng(5);
const parkett = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#6e4e36'; g.fillRect(0, 0, w, h);
  const pw = w / 6;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    const y0 = j * h / 4 + (i % 2) * h / 8; const c = 0.8 + R() * 0.3;
    g.fillStyle = `rgb(${110 * c | 0},${78 * c | 0},${54 * c | 0})`; g.fillRect(i * pw + 1, y0 + 1, pw - 2, h / 4 - 2);
    for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(50,30,18,${0.05 + R() * 0.1})`; g.lineWidth = 1 + R() * 2; const x = i * pw + R() * pw; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (R() - 0.5) * 8, y0 + h / 4); g.stroke(); }
  }
  g.fillStyle = 'rgba(20,12,6,0.6)'; for (let i = 0; i <= 6; i++) g.fillRect(i * pw - 1, 0, 2, h);
});
parkett.wrapS = parkett.wrapT = THREE.RepeatWrapping; parkett.repeat.set(1.3 / 0.9, (Z1 - Z0) / 1.6);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, Z1 - Z0), new THREE.MeshStandardMaterial({ map: parkett, roughness: 0.42, color: '#b9a99a' }));
floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (Z0 + Z1) / 2); floor.receiveShadow = true; scene.add(floor);
const wallMat = new THREE.MeshStandardMaterial({ color: '#cfc7ba', roughness: 0.9 });
const wallR = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0, HH), wallMat); wallR.rotation.y = -Math.PI / 2; wallR.position.set(HW, HH / 2, (Z0 + Z1) / 2); wallR.receiveShadow = true; scene.add(wallR);
const wallL = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0, HH), wallMat); wallL.rotation.y = Math.PI / 2; wallL.position.set(-HW, HH / 2, (Z0 + Z1) / 2); wallL.receiveShadow = true; scene.add(wallL);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, Z1 - Z0), new THREE.MeshStandardMaterial({ color: '#bdb6ab', roughness: 0.95 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HH, (Z0 + Z1) / 2); scene.add(ceil);
const back = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, HH), wallMat); back.position.set(0, HH / 2, Z0); back.receiveShadow = true; scene.add(back);
// Tuer am Ende, einen Spalt offen (dahinter schwarz)
const doorMat = new THREE.MeshStandardMaterial({ color: '#d9d3c8', roughness: 0.6 });
const frameMat = new THREE.MeshStandardMaterial({ color: '#e6e1d8', roughness: 0.5 });
const gap = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 2.02), new THREE.MeshBasicMaterial({ color: '#000000' })); gap.position.set(0.05, 1.01, Z0 + 0.002); scene.add(gap);
const door = new THREE.Mesh(new THREE.BoxGeometry(0.82, 2.0, 0.04), doorMat); door.geometry.translate(0.41, 1.0, 0);
door.position.set(-0.36, 0, Z0 + 0.02); door.rotation.y = -0.22; door.castShadow = door.receiveShadow = true; scene.add(door);
for (const [w, h, x, y] of [[0.06, 2.08, -0.4, 1.04], [0.06, 2.08, 0.5, 1.04], [0.96, 0.06, 0.05, 2.05]]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), frameMat); m.position.set(x, y, Z0 + 0.015); m.receiveShadow = true; scene.add(m);
}
// Fussleisten
const leiste = new THREE.MeshStandardMaterial({ color: '#ece8e0', roughness: 0.55 });
for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, Z1 - Z0), leiste); m.position.set(sx * (HW - 0.006), 0.035, (Z0 + Z1) / 2); m.receiveShadow = true; scene.add(m); }
// Bild an der linken Wand (Rahmen + dunkles Motiv)
const pic = new THREE.Group(); scene.add(pic);
const pf = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.38), new THREE.MeshStandardMaterial({ color: '#1d1714', roughness: 0.5 })); pic.add(pf);
const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), new THREE.MeshStandardMaterial({ color: '#5d6a73', roughness: 0.8 })); pm.rotation.y = Math.PI / 2; pm.position.x = 0.011; pic.add(pm);
pic.position.set(-HW + 0.012, 1.5, -1.2);

// ---------- Nachtlicht an der rechten Wand ----------
const NL = N.makeNachtlicht();
// Nussbaum im warmen Nahlicht nicht rosa werden lassen: Holz abdunkeln, kein Sheen
for (const m of [NL.wood, NL.disc.material]) { m.color.set('#8a7062'); m.sheen = 0; }
NL.group.position.set(HW - 0.0005, 0.92, 0); NL.group.rotation.y = Math.PI; scene.add(NL.group);
const sensorW = () => NL.group.localToWorld(v3(N.AXIS_X + N.STICK_R, N.SENSOR_Y, 0));
const lightW = () => NL.group.localToWorld(v3(N.AXIS_X, N.LIGHT_MID, 0));

// ---------- Licht ----------
const amb = new THREE.HemisphereLight('#8ea6d6', '#0b0d12', 0.06); scene.add(amb);
const key = new THREE.DirectionalLight('#ffffff', 0); key.position.set(-2.0, 2.2, 1.6); key.target.position.set(0.6, 0.9, 0); scene.add(key, key.target);
// Mondlicht durchs Fenster (links, ausserhalb des Bilds): Fensterkreuz als Lichtmuster
const pane = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff'; const x0 = w * 0.18, x1 = w * 0.82, y0 = h * 0.12, y1 = h * 0.88, m = 12;
  g.fillRect(x0, y0, (x1 - x0) / 2 - m / 2, (y1 - y0) / 2 - m / 2); g.fillRect(w / 2 + m / 2, y0, (x1 - x0) / 2 - m / 2, (y1 - y0) / 2 - m / 2);
  g.fillRect(x0, h / 2 + m / 2, (x1 - x0) / 2 - m / 2, (y1 - y0) / 2 - m / 2); g.fillRect(w / 2 + m / 2, h / 2 + m / 2, (x1 - x0) / 2 - m / 2, (y1 - y0) / 2 - m / 2);
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g2 = c2.getContext('2d'); g2.filter = 'blur(4px)'; g2.drawImage(g.canvas, 0, 0); g.drawImage(c2, 0, 0);
});
const moon = new THREE.SpotLight('#a9c3ff', 0, 0, 0.42, 0.3, 2); moon.map = pane; moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0002; moon.shadow.normalBias = 0.01;
moon.position.set(-2.6, 2.9, 1.9); moon.target.position.set(0.55, 0.25, 0.9); scene.add(moon, moon.target);
wallL.visible = true;   // Mond kommt durch ein Fenster in der linken Wand: linke Wand wirft keinen Schatten
wallL.castShadow = false;

// Staub im Mondlicht
const dustTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const DN = 160, dpos = new Float32Array(DN * 3), dseed = [];
for (let i = 0; i < DN; i++) dseed.push([R() * 1.1 - 0.55, 0.2 + R() * 1.9, -0.4 + R() * 2.6, R() * 6.28, 0.3 + R() * 0.7]);
const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: dustTex, size: 0.008, transparent: true, opacity: 0.55, depthWrite: false, color: '#c9d8ff', blending: THREE.AdditiveBlending }));
scene.add(dust);

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Nachtlicht'),
  k: mk('tt k', '3 Uhr nachts im Flur:', 330),
  a: mk('tt', 'Das Licht geht<br>von allein an.', 410),
  b: mk('tt', 'Kein Spuk.<br>Bewegungsmelder.', 330),
  p: mk('tt big', '23,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.08, vig: 'rgba(0,2,8,.62)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 2.4, 'flur'], [2.4, 3.8, 'sensor'], [3.8, 5.4, 'wand'], [5.4, 7.0, 'seite'], [7.0, 8.4, 'flur2']];
const ON = 0.5;   // Nachtlicht geht an, sobald man naeher kommt (Datei 0,1 s)

// POV: gehen mit leichtem Wippen (1,8 Schritte pro Sekunde), Handkamera
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.012 * a);
function shoot(t, pos, tgt, a = 1, fov = 55) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
const F0 = v3(-0.1, 1.5, 3.15), F1 = v3(0.0, 1.46, 2.0), FT0 = v3(0.42, 0.95, -0.3), FT1 = v3(0.5, 0.9, -0.15);
const flurCam = (u) => { const k = u / 2.4; const step = Math.sin(u * Math.PI * 1.8); return [vlerp(F0, F1, k).add(v3(0.008 * step, 0.012 * Math.abs(step), 0)), vlerp(FT0, FT1, k)]; };

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  // Licht: an ab ON, im Schluss-Flur wieder aus (Schnitt, kein Ausblenden)
  const on = name === 'flur2' ? 0 : ease.out(seg(t, ON, ON + 0.3));
  NL.setOn(on);
  moon.intensity = 26 * (0.97 + 0.03 * Math.sin(t * 2.3));
  amb.intensity = 0.06;
  // Belichtung je Einstellung (nah am Licht weniger), neutrales Fuelllicht auf dem Produkt in den Naheinstellungen
  r.toneMappingExposure = name === 'sensor' ? 0.42 : (name === 'wand' || name === 'seite') ? 0.5 : 1.0;   // nah am Licht knapp belichten: Nussbaum bleibt dunkelbraun
  key.intensity = (name === 'flur' || name === 'flur2') ? 0 : 0.5;

  if (name === 'flur' || name === 'flur2') {
    const u = name === 'flur' ? t : t - DAUER; const [p, q] = flurCam(u);
    shoot(t, p, q, 1.0, 55);
  } else if (name === 'sensor') {
    const s = sensorW(); const a = lerp(-0.6, -0.38, ease.inOut(sp)), d = lerp(0.36, 0.3, sp);
    // Kamera vor der Wand (Raum = -x), leicht von vorne-oben; Stab rechts der Mitte, oben links bleibt Wand
    shoot(t, v3(s.x - Math.cos(a) * d, s.y + 0.04, s.z + Math.sin(a) * d), s.clone().add(v3(0, -0.06, -0.035)), 0.15, 40);
  } else if (name === 'wand') {
    const c = lightW(); shoot(t, vlerp(v3(c.x - 0.95, 1.05, 0.62), v3(c.x - 0.85, 1.02, 0.5), ease.out(sp)), v3(c.x - 0.02, 0.84, 0.0), 0.5, 45);
  } else if (name === 'seite') {
    const c = lightW(); shoot(t, vlerp(v3(c.x - 0.3, 1.0, 1.15), v3(c.x - 0.26, 0.99, 1.02), ease.out(sp)), v3(c.x - 0.04, 0.95, -0.05), 0.4, 42);
  }
  // Staub
  for (let i = 0; i < DN; i++) { const [x, y, z, ph, v] = dseed[i]; dpos[i * 3] = x + 0.05 * Math.sin(t * 0.3 * v + ph); dpos[i * 3 + 1] = y + 0.04 * Math.sin(t * 0.21 * v + ph * 2) - 0.01 * t * v; dpos[i * 3 + 2] = z + 0.04 * Math.cos(t * 0.27 * v + ph); }
  dgeo.attributes.position.needsUpdate = true;
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  const wordOn = t < 3.35 || t >= 7.45;
  tx.word.style.opacity = wordOn ? (t < 3.35 ? 1 - seg(t, 3.2, 3.35) : seg(t, 7.45, 7.6)) : 0;
  pop(tx.k, t < 2.4 ? t + 0.3 : t >= 7.45 ? t - 7.45 : -1, t < 2.4 ? seg(t, 2.3, 2.4) : 0);
  pop(tx.a, t < 2.4 ? t + 0.3 : t >= 7.6 ? t - 7.6 : -1, t < 2.4 ? seg(t, 2.3, 2.4) : 0);
  pop(tx.b, t >= 3.9 && t < 5.4 ? t - 3.9 : -1, seg(t, 5.3, 5.4));
  pop(tx.p, t >= 5.5 && t < 7.0 ? t - 5.5 : -1, seg(t, 6.9, 7.0));
  pop(tx.cta, t >= 5.95 && t < 7.0 ? t - 5.95 : -1, seg(t, 6.9, 7.0));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
