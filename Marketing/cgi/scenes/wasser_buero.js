// Maios CGI – Elektrischer Wasserspender fuer Schreibtisch (Produkt 10, Schwarz), "Homeoffice. Ich steh nicht mehr auf.", Loop-Clip 8 s (Render 8,4 s)
// Handy-Look, Homeoffice am Nachmittag: Sonne durchs Fenster (Fensterkreuz und Blattschatten an der Wand), Laptop, Pflanze.
// Das Wasser laeuft schon ab Bild 0 (gedrueckt wurde vorher, kein Knopf bewegt sich von allein).
// Ablauf: Strahl ins Glas (Hook) -> Glas nah von unten -> weit: Schlauch in die Gallone ("Holt's direkt aus der Flasche.")
//         -> andere Seite, Preis + Link -> zurueck zur ersten Einstellung (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makeTiefe } from '../lib/tiefe.js';
import { makeWsSzene } from '../lib/ws_szene.js';
import * as WM from '../lib/ws_models.js';

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
await document.fonts.load('800 40px Manrope', 'ßü€·?:\'');

const r = makeRenderer(); r.localClippingEnabled = true;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
const S = makeWsSzene(scene, cam);
const { SW, csS, G, J } = S;
const R = rng(12);
for (const m of [SW.body]) { m.envMapIntensity = 0.45; m.sheen = 0; }
// Auslauf-Ende vorne wie am echten Geraet in Gehaeusefarbe, nur die Duese bleibt roségold
SW.group.traverse((o) => { if (o.isMesh && o.material === SW.metal && o.geometry.parameters && o.geometry.parameters.radiusTop === 0.082) o.material = SW.body; });

// ---------- Zimmer: helle Wand (Salbei), Sonne mit Fensterkreuz und Blattschatten ----------
const wallMat = new THREE.MeshStandardMaterial({ color: '#5f725e', roughness: 0.93 });
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

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Wasserspender'),
  k: mk('tt k', '', 330),
  a: mk('tt', 'Homeoffice.<br>Ich steh nicht mehr auf.', 360),
  b: mk('tt', 'Kein Weg<br>zur Küche.', 330),
  c: mk('tt', 'Holt’s direkt aus<br>der Flasche.', 330),
  p: mk('tt big', '38,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.06, vig: 'rgba(10,12,8,.38)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 2.6, 'strahl'], [2.6, 4.2, 'nah'], [4.2, 5.6, 'gallone'], [5.6, 7.0, 'preis'], [7.0, 8.4, 'strahl2']];
const ON0 = -1.6, ON1 = 4.4;     // Wasser laeuft (in "Fuellzeit"), Loop-Einstellungen nehmen u statt t

const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.022 * a);
function shoot(t, pos, tgt, a = 1, fov = 32) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
const A0 = v3(1.45, 2.95, 8.4), A1 = v3(1.0, 2.8, 7.1), AT0 = v3(0.05, 1.75, -0.5), AT1 = v3(0.0, 1.68, -0.5);
const strahlCam = (u) => [vlerp(A0, A1, u / 2.6), vlerp(AT0, AT1, u / 2.6)];

function tag() {
  T.mood(1); T.U.uHaloI.value = 0; T.floor.visible = false;
  T.key.color.set('#ffffff'); T.key.intensity = 1.6; T.key.position.set(-4, 7, 6);
  T.fill.intensity = 0.55; T.fill.color.set('#f3f6f2'); T.fill.groundColor.set('#5a4a3a');
  T.rim.color.set('#e8f6ff'); T.rim.intensity = 18; T.rim.position.set(3.2, 3.8, -2.4);
  scene.environmentIntensity = 0.8; sun.intensity = 400; r.toneMappingExposure = 0.82;
}

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  S.hideAll(); T.U.uTime.value = t; tag();
  S.props.visible = S.desk.visible = S.lap.visible = S.plant.visible = true;
  S.plant.position.set(-2.6, 0, -2.6);
  S.placeDisp(SW, csS, 0, 0, -0.42); csS.material.opacity = 0.65;
  J.group.visible = true; J.group.position.set(2.05, 0, -1.75); J.cap.visible = false;
  TUBE.mesh.visible = true;
  S.glassOn(SW, G); G.group.position.z += 0.08;   // Glas nicht in die Saeule schieben
  const loop = name === 'strahl' || name === 'strahl2';
  if (loop) sun.intensity = 250;   // Wand hinter dem Hook-Text etwas dunkler (Lesbarkeit)
  const u = name === 'strahl2' ? t - DAUER : t;          // Fuellzeit: Anfang und Ende gleich
  S.water(u, ON0, ON1, G, SW, 1.02);
  S.stream.material.emissiveIntensity = 0.3;
  S.ledOn(SW, u < ON1 + 0.1 ? 3.0 : 0, false, t);
  SW.group.updateMatrixWorld(true);
  const gp = G.group.position.clone();

  if (loop) { const [p, q] = strahlCam(u); shoot(t, p, q, 1.0, 32); }
  else if (name === 'nah') {
    const a = lerp(-0.35, -0.05, ease.inOut(sp));
    shoot(t, v3(gp.x + Math.sin(a) * 4.4, gp.y + 0.9, gp.z + Math.cos(a) * 4.4), gp.clone().add(v3(0, 1.55, 0)), 0.35, 30);
  } else if (name === 'gallone') {
    shoot(t, vlerp(v3(-2.2, 3.6, 10.6), v3(-1.9, 3.45, 9.8), ease.out(sp)), v3(0.9, 2.15, -1.0), 0.5, 32);
  } else if (name === 'preis') {
    shoot(t, vlerp(v3(5.2, 3.0, 8.4), v3(4.8, 2.9, 7.8), ease.out(sp)), v3(0.7, 2.35, -0.9), 0.5, 32);
  }
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  const wordOn = t < 3.35 || t >= 7.45;
  tx.word.style.opacity = wordOn ? (t < 3.35 ? 1 - seg(t, 3.2, 3.35) : seg(t, 7.45, 7.6)) : 0;
  pop(tx.a, t < 2.6 ? t + 0.3 : t >= 7.5 ? t - 7.5 : -1, t < 2.6 ? seg(t, 2.5, 2.6) : 0);
  pop(tx.b, -1);   // Nah-Einstellung ohne Text: Saeule und Strahl stehen mittig
  pop(tx.c, t >= 4.3 && t < 5.6 ? t - 4.3 : -1, seg(t, 5.5, 5.6));
  pop(tx.p, t >= 5.7 && t < 7.0 ? t - 5.7 : -1, seg(t, 6.9, 7.0));
  pop(tx.cta, t >= 6.15 && t < 7.0 ? t - 6.15 : -1, seg(t, 6.9, 7.0));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
