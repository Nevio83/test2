// Maios CGI – Aroma Öl Diffusor (Produkt 42, Schwarz), "Dieses Feuer ist kalt.", Loop-Clip 8 s (Render 8,4 s), Handy-Look
// Schlafzimmer am Abend: Nachttisch aus dunklem Holz, Lichterkette als unscharfe Punkte, der Diffusor laeuft ab Bild 0
// (Flammen-Effekt aus Nebel und Licht, genau das, was products.json beschreibt).
// Ablauf: Kamera faehrt auf die Flamme zu (Hook) -> Flamme nah -> von unten: Rillen und Lichtring ("Nur Nebel mit Licht.")
//         -> mit Duftoel, Preis + Link -> zurueck zur ersten Einstellung (Loop).
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
const R = rng(42);

// ---------- Nachttisch (dunkles Nussholz) ----------
const wood = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#3a2618'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 240; i++) {
    const y = R() * h, a = 0.04 + R() * 0.08, lw = 1 + R() * 3;
    g.strokeStyle = R() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(150,100,64,${a})`; g.lineWidth = lw;
    g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.005 + i) * 7 + (R() - 0.5) * 2); g.stroke();
  }
});
wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 2);
const top = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 6), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4, color: '#d2b9a4' }));
top.position.set(0.4, -0.15, -0.6); top.receiveShadow = true; scene.add(top);

// Lichterkette und Leselampe als unscharfe Lichter im Hintergrund
const dotTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,236,200,1)'); gr.addColorStop(0.45, 'rgba(255,200,130,0.55)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const dots = [];
for (let i = 0; i < 16; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color('#ffd9a6') }));
  const x = -4.5 + i * 0.62, y = 3.4 + Math.sin(i * 0.9) * 0.45 + (i % 3) * 0.12; s.position.set(x, y, -6.5 - (i % 2) * 0.6); s.scale.setScalar(0.42 + R() * 0.2); s.userData.ph = R() * 6; scene.add(s); dots.push(s);
}
const lampG = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color('#ffc890') }));
lampG.position.set(-3.6, 2.2, -5.2); lampG.scale.setScalar(2.4); scene.add(lampG);

// ---------- Diffusor (Schwarz) + Duftoel ----------
const D = DM.makeDiffusor('schwarz'); scene.add(D.group); D.group.rotation.y = 0.3;
const cs = contactShadow(2.8, 0.6); cs.position.y = 0.003; scene.add(cs);
const oil = DM.makeOelflasche(); oil.position.set(1.55, 0, 0.55); oil.scale.setScalar(1.15); scene.add(oil);
const csO = contactShadow(0.8, 0.5); csO.position.set(1.55, 0.003, 0.55); scene.add(csO);
// Lichtfleck der Flamme auf dem Holz
const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48), new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color('#ff9a4a'), opacity: 0.25 }));
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.006; scene.add(pool);
const FL = v3(0, DM.H_TOP + 0.4, 0);

// ---------- Licht (Produktlicht neutral, Stimmung ueber Hintergrund und Flamme) ----------
const ENVD = stripEnv(r, { bg: '#0a0807', strips: [
  { w: 1.2, h: 9, pos: v3(-5.5, 0, 1.8), col: '#ffffff', I: 1.6 }, { w: 1.2, h: 9, pos: v3(5.5, 0, 0.8), col: '#fff3e6', I: 1.0 }], top: { w: 4, h: 4, col: '#ffffff', I: 0.8 } });
function abend(t) {
  T.mood(0); T.U.uHaloI.value = 0;
  T.U.uC0.value.set('#2a1a12'); T.U.uC1.value.set('#060404'); T.U.uCenter.value.set(0.5, 0.62);
  scene.environment = ENVD; scene.environmentIntensity = 0.5;
  T.key.color.set('#fff1de'); T.key.intensity = 0.7; T.key.position.set(-3.5, 6.5, 5.5);
  T.fill.intensity = 0.08; T.fill.color.set('#d6d0c8'); T.fill.groundColor.set('#0a0605');
  T.rim.color.set('#cfe2ff'); T.rim.intensity = 16; T.rim.position.set(2.6, 3.2, -2.6);
  dots.forEach((d) => (d.material.opacity = 0.75 + 0.25 * Math.sin(t * 1.3 + d.userData.ph)));
  T.haloAt(lampG.position, 0.16, 0.22, '#ff9e4a', 2);
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Diffusor'),
  a: mk('tt', 'Dieses Feuer<br>ist kalt.', 360),
  c: mk('tt', 'Nur Nebel mit Licht.<br>Aroma-Diffusor.', 330),
  p: mk('tt big', '26,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.07, vig: 'rgba(8,4,2,.6)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 2.6, 'flamme'], [2.6, 4.2, 'nah'], [4.2, 5.6, 'unten'], [5.6, 7.0, 'preis'], [7.0, 8.4, 'flamme2']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.02 * a);
function shoot(t, pos, tgt, a = 1, fov = 32) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
const A0 = v3(0.9, 2.7, 9.4), A1 = v3(0.6, 2.45, 7.9), AT0 = v3(0, 1.75, 0), AT1 = v3(0, 1.7, 0);
const flammeCam = (u) => [vlerp(A0, A1, u / 2.6), vlerp(AT0, AT1, u / 2.6)];

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  T.U.uTime.value = t; abend(t);
  D.set(1, t);
  pool.material.opacity = 0.22 * (0.9 + 0.1 * Math.sin(t * 11.3));

  if (name === 'flamme' || name === 'flamme2') { const u = name === 'flamme' ? t : t - DAUER; const [p, q] = flammeCam(u); shoot(t, p, q, 1.0, 32); }
  else if (name === 'nah') {
    const a = lerp(-0.35, -0.1, ease.inOut(sp));
    shoot(t, v3(Math.sin(a) * 3.8, 2.0, Math.cos(a) * 3.8), v3(0, 2.05, 0), 0.35, 34);
  } else if (name === 'unten') {
    const a = lerp(0.55, 0.38, ease.out(sp));
    shoot(t, v3(Math.sin(a) * 4.6, 0.32, Math.cos(a) * 4.6), v3(0, 1.5, 0), 0.4, 40);
  } else if (name === 'preis') {
    const a = lerp(0.85, 0.72, ease.out(sp));
    shoot(t, v3(Math.sin(a) * 8.0, 3.0, Math.cos(a) * 8.0), v3(0.5, 2.0, 0), 0.5, 32);
  }
  // Flammen-Ebenen zur Kamera drehen (Gruppe), damit die Flamme von allen Seiten voll wirkt
  D.flame.rotation.y = Math.atan2(cam.position.x, cam.position.z) - D.group.rotation.y;
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  const wordOn = t < 3.65 || t >= 7.45;   // Produktwort bis Datei-Sekunde 3,1
  tx.word.style.opacity = wordOn ? (t < 3.65 ? 1 - seg(t, 3.5, 3.65) : seg(t, 7.45, 7.6)) : 0;
  pop(tx.a, t < 2.6 ? t + 0.3 : t >= 7.5 ? t - 7.5 : -1, t < 2.6 ? seg(t, 2.5, 2.6) : 0);
  pop(tx.c, t >= 4.3 && t < 5.6 ? t - 4.3 : -1, seg(t, 5.5, 5.6));
  pop(tx.p, t >= 5.7 && t < 7.0 ? t - 5.7 : -1, seg(t, 6.9, 7.0));
  pop(tx.cta, t >= 6.15 && t < 7.0 ? t - 6.15 : -1, seg(t, 6.9, 7.0));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
