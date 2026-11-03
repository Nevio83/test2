// Maios CGI – 350ml Mixer Entsafter (Produkt 11), "Das ist kein Hexentrank.", Loop-Clip 8 s (Render 8,4 s), Handy-Look
// Halloween-Kueche bei Nacht: Kuerbis und Kerze nur im Hintergrund (Akzentlicht), Produktlicht neutral.
// Ablauf: Mixer laeuft, lila Wirbel (Hook) -> Wirbel nah -> Mixer stoppt, ganze Flasche ("Nur mein Fruehstueck.")
//         -> Aufsicht mit Blaubeeren, Preis + Link -> zurueck zur ersten Einstellung (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex, contactShadow } from '../lib/core.js';
import * as M from '../lib/mixer_models.js';
import * as BR from '../lib/brand.js';
import { makeTiefe, stripEnv } from '../lib/tiefe.js';

const style = document.createElement('style');
style.textContent = BR.CSS + `
.tt{position:absolute;left:70px;width:800px;text-align:center;font:800 68px Manrope;line-height:1.16;color:#fff;letter-spacing:-.005em;
  text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.75),0 0 22px rgba(0,0,0,.45)}
.tt.big{font-size:150px;letter-spacing:-.02em}
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(0,0,0,.42)}
.tword{position:absolute;top:213px;font:700 32px Manrope;color:#fff;letter-spacing:.01em;text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.7)}
.tcta{position:absolute;left:270px;width:400px;text-align:center;font:800 44px Manrope;color:#111;background:#fff;border-radius:18px;padding:20px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 40px Manrope', 'ßü€·?:');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;

// ---------- Kueche: dunkle Holzplatte ----------
const wood = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#2a1c15'; g.fillRect(0, 0, w, h);
  const R = rng(9);
  for (let i = 0; i < 260; i++) {
    const y = R() * h, a = 0.03 + R() * 0.07, lw = 1 + R() * 3;
    g.strokeStyle = R() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(120,80,55,${a})`; g.lineWidth = lw;
    g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.006 + i) * 6 + (R() - 0.5) * 2); g.stroke();
  }
  for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, (k + 1) * h / 4 - 2, w, 3); } // Brettfugen
});
wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(3, 3);
const counter = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5, metalness: 0, color: '#c9b3a6' }));
counter.rotation.x = -Math.PI / 2; counter.rotation.z = 0.12; counter.receiveShadow = true; scene.add(counter);

// ---------- Kuerbis + Kerze als unscharfe Lichter im Hintergrund ----------
function jackTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.56;
    // Koerper (kaum beleuchtet), Rippen
    for (const [dx, rx, c] of [[-120, 120, '#4a1f08'], [120, 120, '#4a1f08'], [-60, 130, '#5e2909'], [60, 130, '#5e2909'], [0, 140, '#6b300b']]) {
      const gr = g.createRadialGradient(cx + dx * 0.8, cy - 40, 10, cx + dx, cy, rx * 1.15);
      gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(20,8,2,0.95)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx + dx, cy, rx, 150, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#2b2410'; g.fillRect(cx - 14, cy - 196, 28, 52);            // Stiel
    // Gesicht: Augen + Mund, glueht von innen
    g.save(); g.shadowColor = '#ff9a2a'; g.shadowBlur = 40;
    const face = new Path2D();
    face.moveTo(cx - 108, cy - 20); face.lineTo(cx - 52, cy - 88); face.lineTo(cx - 22, cy - 14); face.closePath();
    face.moveTo(cx + 108, cy - 20); face.lineTo(cx + 52, cy - 88); face.lineTo(cx + 22, cy - 14); face.closePath();
    face.moveTo(cx - 132, cy + 30);
    const teeth = [[-100, 70], [-76, 40], [-48, 82], [-18, 46], [14, 84], [44, 46], [74, 80], [100, 40], [132, 30]];
    for (const [x, y] of teeth) face.lineTo(cx + x, cy + y);
    face.quadraticCurveTo(cx, cy + 150, cx - 132, cy + 30); face.closePath();
    const fg = g.createRadialGradient(cx, cy + 10, 10, cx, cy + 10, 170); fg.addColorStop(0, '#fff2b8'); fg.addColorStop(0.5, '#ffc050'); fg.addColorStop(1, '#ff7a18');
    g.fillStyle = fg; g.fill(face); g.fill(face); g.restore();
    // weich zeichnen (wie unscharf im Hintergrund)
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g2 = c2.getContext('2d');
    g2.filter = 'blur(9px)'; g2.drawImage(g.canvas, 0, 0); g.clearRect(0, 0, w, h); g.drawImage(c2, 0, 0);
  });
}
function candleTex() {
  return canvasTex(256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2;
    const body = g.createLinearGradient(cx - 46, 0, cx + 46, 0); body.addColorStop(0, '#6d5a48'); body.addColorStop(0.45, '#d8c3a5'); body.addColorStop(1, '#5a4838');
    g.fillStyle = body; g.fillRect(cx - 46, 260, 92, 252);
    const fl = g.createRadialGradient(cx, 200, 4, cx, 205, 60); fl.addColorStop(0, 'rgba(255,250,225,1)'); fl.addColorStop(0.35, 'rgba(255,200,110,0.95)'); fl.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = fl; g.beginPath(); g.ellipse(cx, 205, 26, 62, 0, 0, Math.PI * 2); g.fill();
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g2 = c2.getContext('2d');
    g2.filter = 'blur(7px)'; g2.drawImage(g.canvas, 0, 0); g.clearRect(0, 0, w, h); g.drawImage(c2, 0, 0);
  });
}
const bokehMat = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
const jack = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), bokehMat(jackTex())); jack.position.set(-2.5, 1.32, -4.6); scene.add(jack);
const candle = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), bokehMat(candleTex())); candle.position.set(2.15, 0.72, -3.9); scene.add(candle);
const candle2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0), bokehMat(candleTex())); candle2.position.set(2.85, 0.52, -5.2); scene.add(candle2);
const pumpL = new THREE.PointLight('#ff8f3a', 0, 9, 1.6); pumpL.position.set(-2.4, 1.4, -3.2); scene.add(pumpL);
const candL = new THREE.PointLight('#ffc77a', 0, 7, 1.8); candL.position.set(1.9, 1.5, -2.4); scene.add(candL);

// Nebel am Boden hinter dem Mixer (Raum-Effekt)
const fogTex = canvasTex(256, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h * 0.78, 4, w / 2, h * 0.78, w * 0.5);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const fogs = [];
for (let i = 0; i < 5; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false, opacity: 0.16, color: '#c9b7e4' }));
  m.userData = { x: -2.6 + i * 1.3, z: -1.35 - (i % 2) * 0.7, ph: i * 1.7 }; scene.add(m); fogs.push(m);
}

// ---------- Mixer (Weiss) + Fluessigkeit ----------
const mats = M.makeMaterials();
const chromeEnv = stripEnv(r, { bg: '#141414', strips: [
  { w: 1.2, h: 9, pos: v3(-5.5, 0, 1.8), col: '#ffffff', I: 6 }, { w: 1.2, h: 9, pos: v3(5.5, 0, 0.8), col: '#fff6ee', I: 4 },
  { w: 3.0, h: 9, pos: v3(0, 0, -5.8), col: '#d9d9d9', I: 1.2 }, { w: 2.6, h: 9, pos: v3(-1.5, 0, 5.8), col: '#ffffff', I: 1.6 }], top: { w: 5, h: 5, col: '#ffffff', I: 2.5 } });
mats.chrome.envMap = chromeEnv; mats.chrome.envMapIntensity = 0.75;   // Chrom spiegelt helle Streifen: bleibt silbern, auch im dunklen Raum
const B = M.makeBottle('weiss', mats), S = M.makeBase('weiss', mats);
const rig = new THREE.Group(); rig.add(B.group); B.group.add(S.group); scene.add(rig);
const lm = M.makeLiquidMaterial({ milk: '#cdb3e6', smoothie: '#5a2680', deep: '#26093f', light: '#a77fcb' });
const liq = new THREE.Mesh(new THREE.BufferGeometry(), lm); B.group.add(liq);
const cs = contactShadow(1.9, 0.55); scene.add(cs);
rig.position.set(0, 0.075, 0); cs.position.set(0, 0.003, 0);

// Blaubeeren auf dem Brett
const berryMat = new THREE.MeshPhysicalMaterial({ color: '#2a2c5e', roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color('#9fa9dc'), sheenRoughness: 0.45 });
const crownMat = new THREE.MeshStandardMaterial({ color: '#1a1024', roughness: 0.8 });
const berries = new THREE.Group(); scene.add(berries);
const BR_POS = [[0.95, 0.55], [1.12, 0.32], [0.78, 0.86], [1.3, 0.7], [-0.92, 0.72], [-0.7, 1.02], [0.55, 1.25]];
const Rb = rng(17);
for (const [x, z] of BR_POS) {
  const s = 0.07 + Rb() * 0.015; const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 16), berryMat); b.scale.y = 0.88; b.castShadow = true; g.add(b);
  const c = new THREE.Mesh(new THREE.TorusGeometry(s * 0.32, s * 0.12, 6, 10), crownMat); c.rotation.x = Math.PI / 2; c.position.y = s * 0.86; g.add(c);
  g.position.set(x, s * 0.88, z); g.rotation.set((Rb() - 0.5) * 0.8, Rb() * 6, (Rb() - 0.5) * 0.8); berries.add(g);
}

// ---------- Licht ----------
function nacht(t) {
  T.mood(0);
  T.U.uC0.value.set('#2b1934'); T.U.uC1.value.set('#060309'); T.U.uCenter.value.set(0.42, 0.62);
  T.key.color.set('#fff1de'); T.key.intensity = 2.5; T.key.position.set(-3.2, 7.5, 6.5);
  T.fill.intensity = 0.14; T.fill.color.set('#cfc6e6'); T.fill.groundColor.set('#120a14');
  T.rim.color.set('#c9d2ff'); T.rim.intensity = 26; T.rim.position.set(2.6, 3.8, -2.8);
  scene.environmentIntensity = 0.42;
  const fl = 0.86 + 0.09 * Math.sin(t * 13.1) + 0.05 * Math.sin(t * 29.7 + 1.3) + 0.04 * Math.sin(t * 7.3 + 0.4);
  const fc = 0.84 + 0.1 * Math.sin(t * 17.3 + 2) + 0.06 * Math.sin(t * 41.1);
  pumpL.intensity = 4.2 * fl; candL.intensity = 2.6 * fc;
  jack.material.color.setScalar(0.95 * fl); candle.material.color.setScalar(fc); candle2.material.color.setScalar(0.8 * fc);
  // warme Lichthoefe hinter Kuerbis und Kerze (klein und schwach)
  T.haloAt(jack.position.clone().add(v3(0, -0.05, 0)), 0.17, 0.26 * fl, '#ff8a2e', 1);
  T.haloAt(candle.position.clone().add(v3(0, 0.2, 0)), 0.09, 0.22 * fc, '#ffc070', 2);
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Mixer'),
  a: mk('tt', 'Das ist kein<br>Hexentrank.', 330),
  b: mk('tt', 'Nur mein<br>Frühstück.', 330),
  p: mk('tt big', '40,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 16) + 'px';
function pop(d, tl, out = 0) {   // TikTok-Einblendung: kurz rein, leicht ueberschiessend
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.07, vig: 'rgba(6,2,10,.6)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 2.6, 'wirbel'], [2.6, 4.0, 'nah'], [4.0, 5.6, 'fertig'], [5.6, 7.0, 'preis'], [7.0, 8.4, 'wirbel2']];
const STOP = 3.86;          // Mixer geht aus (Auslaufen bis ~4,1 s)
const START2 = 7.0;         // laeuft wieder (Loop)

// Handkamera
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.03 * a);
function shoot(t, pos, tgt, a = 1, fov = 30) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
// Erste Einstellung als gleichmaessige Fahrt, u = t (Anfang) bzw. t - 8,4 (Ende): laeuft nahtlos in den Anfang
const W0 = v3(0.6, 2.15, 12.4), W1 = v3(0.42, 2.1, 10.9), WT = v3(0, 2.05, 0);
const wirbelCam = (u) => vlerp(W0, W1, u / 2.6);

function contents(t, blend, mix) {
  const u = lm.userData.u; u.uTime.value = t;
  const top = lerp(2.4, 2.36, blend);
  u.uMix.value = mix; u.uSwirl.value = blend > 0.02 ? 1 : 0; u.uTop.value = top; u.uBottom.value = 1.02;
  liq.geometry.dispose(); liq.geometry = M.liquidGeometry(1.02, top, 'oben', 0.32 * blend, blend > 0.02 ? 1 : 0, t);
  S.blades.rotation.y = t * 60 * blend;
}

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  T.U.uTime.value = t; nacht(t);

  // Mixer: laeuft bis STOP, steht still bis START2, laeuft dann wieder
  let blend = 1, mix = 0.62;
  if (t >= STOP && t < START2) { const k = seg(t, STOP, STOP + 0.28); blend = 1 - ease.out(k); mix = lerp(0.62, 1, ease.inOut(seg(t, STOP, STOP + 0.5))); }
  contents(t, blend, mix);
  const vib = blend;
  rig.position.set((Math.sin(t * 91) + Math.sin(t * 57)) * 0.004 * vib, 0.075, 0); rig.rotation.set(0, -0.35, Math.sin(t * 73) * 0.004 * vib);

  if (name === 'wirbel' || name === 'wirbel2') {
    const u = name === 'wirbel' ? t : t - DAUER;
    shoot(t, wirbelCam(u), WT, 1.0, 30);
  } else if (name === 'nah') {
    const a = lerp(0.55, 0.98, ease.inOut(sp)), R = 5.3;
    shoot(t, v3(Math.sin(a) * R, 1.6 + 0.12 * sp, Math.cos(a) * R), v3(-0.34, 1.98, 0), 0.4, 30);
  } else if (name === 'fertig') {
    const a = lerp(-0.62, -0.44, ease.out(sp)), R = 12.2;
    shoot(t, v3(Math.sin(a) * R, 2.9, Math.cos(a) * R), v3(-0.12, 2.25, 0), 0.6, 28);
  } else if (name === 'preis') {
    shoot(t, vlerp(v3(1.5, 6.3, 11.6), v3(1.3, 6.0, 10.8), ease.out(sp)), v3(0.2, 2.35, 0.3), 0.5, 30);
  }
  // Nebel (nach der Kamera, steht mit der Unterkante auf dem Brett)
  fogs.forEach((m) => { const d = m.userData; m.position.set(d.x + 0.25 * Math.sin(t * 0.35 + d.ph), 0.78, d.z); m.lookAt(cam.position.x, m.position.y, cam.position.z); });
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  const wordOn = t < 3.35 || t >= 7.45;
  tx.word.style.opacity = wordOn ? (t < 3.35 ? 1 - seg(t, 3.2, 3.35) : seg(t, 7.45, 7.6)) : 0;
  pop(tx.a, t < 2.6 ? t + 0.3 : t >= 7.5 ? t - 7.5 : -1, t < 2.6 ? seg(t, 2.5, 2.6) : 0);   // am Anfang schon voll da (Loop-Naht)
  pop(tx.b, t >= 4.1 && t < 5.6 ? t - 4.1 : -1, seg(t, 5.5, 5.6));
  pop(tx.p, t >= 5.7 && t < 7.0 ? t - 5.7 : -1, seg(t, 6.9, 7.0));
  pop(tx.cta, t >= 6.15 && t < 7.0 ? t - 6.15 : -1, seg(t, 6.9, 7.0));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
