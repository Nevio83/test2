// Maios CGI – Aroma Öl Diffusor (Produkt 42, Schwarz), "Mein Kürbis muss jetzt ausziehen.", Loop-Clip 8 s (Render 8,4 s), Handy-Look
// Trend „Christmas Switch“ (socialpilot, Nov. 2026): Halloween-Deko wird zur Weihnachtsdeko, das Produkt bleibt.
// Set: Wandregal aus Nussbaum vor einer salbeigrauen Wand am Abend. Der Diffusor laeuft durchgehend (orange Flamme).
// Der Wechsel passiert nur am Raum: Raumlicht flackert kurz weg (die Flamme nicht), danach Tannenbaum, Kugeln, Lichterkette.
// Ablauf: Halloween (Kuerbis, Kerzen, lila Licht) -> Flackern -> Weihnachten ("Ab heute: Weihnachtsmodus.")
//         -> Flamme nah ("Die Flamme darf bleiben.") -> Rillen + Lichtring tief ("Nur Nebel und LED-Licht.")
//         -> weit oben mit Preis + Link -> zurueck zur Halloween-Einstellung (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, clamp, lerp, seg, ease, rng, canvasTex, contactShadow } from '../lib/core.js';
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
await document.fonts.load('800 40px Manrope', 'ßüÖöä€·?:');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;
const R = rng(4211);
const dotTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const glowSprite = (col, s, op = 1) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(col), opacity: op })); sp.scale.setScalar(s); return sp; };

// ---------- Raum: Wand + Regalbrett (Nussbaum) ----------
const plaster = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#5f685f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const a = R() * 0.05; g.fillStyle = R() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; g.fillRect(R() * w, R() * h, 2 + R() * 5, 2 + R() * 5); }
});
plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping; plaster.repeat.set(3, 2);
const wallM = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.95, color: '#ffffff' });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), wallM); wall.position.set(0, 3, -3.2); wall.receiveShadow = true; scene.add(wall);
const walnut = canvasTex(1024, 512, (g, w, h) => {
  g.fillStyle = '#5a3a24'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) {
    const y = R() * h, a = 0.04 + R() * 0.09; g.strokeStyle = R() > 0.55 ? `rgba(30,16,8,${a})` : `rgba(150,105,70,${a})`; g.lineWidth = 1 + R() * 3;
    g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 24) g.lineTo(x, y + Math.sin(x * 0.006 + i) * 5); g.stroke();
  }
});
const shelfM = new THREE.MeshPhysicalMaterial({ map: walnut, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 });
const shelf = new THREE.Mesh(new THREE.BoxGeometry(9, 0.22, 3.4), shelfM); shelf.position.set(0, -0.11, -1.45); shelf.receiveShadow = true; shelf.castShadow = true; scene.add(shelf);
const below = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.MeshStandardMaterial({ color: '#2a2a26', roughness: 1 })); below.position.set(0, -5.2, 0.3); scene.add(below);

// ---------- Diffusor (Schwarz, Shop-Form) ----------
const D = DM.makeDiffusor('schwarz', 'shop'); scene.add(D.group); D.group.rotation.y = 0.5;
const cs = contactShadow(2.9, 0.6); cs.position.y = 0.003; scene.add(cs);
const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color('#ff8a3a'), opacity: 0.22 }));
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.006; scene.add(pool);
const wallGlow = glowSprite('#ff8a3a', 5.5, 0.16); wallGlow.position.set(0, 2.6, -3.1); scene.add(wallGlow);

// ---------- Halloween-Deko ----------
const HAL = new THREE.Group(); scene.add(HAL);
const PUMP = [];   // Kuerbis + Stiel: rollt ab Bild 0 Richtung Bildrand ("zieht aus")
{
  const geo = new THREE.SphereGeometry(0.85, 96, 64); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const th = Math.atan2(z, x);
    const rib = 1 - 0.07 * Math.pow(Math.abs(Math.cos(th * 5)), 0.6); const sq = 1 - 0.18 * Math.pow(Math.abs(y / 0.85), 3);
    p.setX(i, x * rib * sq * 1.12); p.setZ(i, z * rib * sq * 1.12); p.setY(i, y * 0.78);
  }
  geo.computeVertexNormals();
  const pump = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#d4621a', roughness: 0.55, clearcoat: 0.25, sheen: 0.3 }));
  pump.position.set(-1.75, 0.66, -1.75); pump.castShadow = true; pump.receiveShadow = true; HAL.add(pump); PUMP.push(pump);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.32, 12), new THREE.MeshStandardMaterial({ color: '#4a5a2a', roughness: 0.8 }));
  stem.position.set(-1.75, 1.38, -1.75); stem.rotation.z = 0.25; HAL.add(stem); PUMP.push(stem);
  const small = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#e9dcc4', roughness: 0.6 })); small.scale.setScalar(0.5); small.position.set(-1.3, 0.34, -0.75); small.castShadow = true; HAL.add(small);
  // Kerzen rechts (schwarz) mit kleinen Flammen
  for (const [x, z, h] of [[1.45, -1.25, 0.9], [1.85, -1.9, 1.3], [1.95, -0.85, 0.6]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, h, 32), new THREE.MeshStandardMaterial({ color: '#1a1716', roughness: 0.7 }));
    c.position.set(x, h / 2, z); c.castShadow = true; HAL.add(c);
    const f = glowSprite('#ffb15a', 0.32); f.position.set(x, h + 0.13, z); f.userData.ph = R() * 6; HAL.add(f);
    const f2 = glowSprite('#ffe2b0', 0.12); f2.position.set(x, h + 0.1, z); HAL.add(f2);
  }
}
const halAccent = glowSprite('#8a3cff', 7, 0.22); halAccent.position.set(-1.8, 2.6, -3.1); HAL.add(halAccent);

// ---------- Weihnachts-Deko ----------
const XM = new THREE.Group(); scene.add(XM);
const xLights = [];
{
  const green = new THREE.MeshStandardMaterial({ color: '#1d4a2e', roughness: 0.85 });
  const tree = new THREE.Group(); tree.position.set(-1.65, 0, -1.8); XM.add(tree);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.5, 32), new THREE.MeshStandardMaterial({ color: '#e7e1d6', roughness: 0.6 })); pot.position.y = 0.25; pot.castShadow = true; tree.add(pot);
  const tiers = [[0.95, 1.0, 0.95], [0.75, 0.9, 1.5], [0.52, 0.8, 2.0], [0.3, 0.6, 2.42]];
  for (const [rad, h, y] of tiers) { const c = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 40, 1), green); c.position.y = y; c.castShadow = true; tree.add(c); }
  for (let i = 0; i < 46; i++) {   // Lichter als Spirale um den Baum
    const k = i / 46, y = 0.62 + k * 2.0, rad = lerp(0.9, 0.12, k) + 0.02, a = k * Math.PI * 9 + 0.4;
    const s = glowSprite('#ffd79a', 0.17); s.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad); s.userData.ph = R() * 6; tree.add(s); xLights.push(s);
  }
  const star = glowSprite('#fff0c8', 0.42); star.position.y = 2.8; tree.add(star); xLights.push(star);
  // Kugeln rechts (rot, glaenzend) + Tannenzweig
  const ballM = new THREE.MeshPhysicalMaterial({ color: '#b3121f', roughness: 0.18, metalness: 0.35, clearcoat: 1 });
  for (const [x, z, s] of [[1.45, -1.05, 0.32], [1.9, -1.75, 0.38], [1.95, -0.7, 0.24]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(s, 48, 32), ballM); b.position.set(x, s, z); b.castShadow = true; XM.add(b);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.18, 16), new THREE.MeshStandardMaterial({ color: '#c9b37a', metalness: 1, roughness: 0.3 })); cap.position.set(x, s * 2.02, z); XM.add(cap);
  }
  // Lichterkette an der Wand (durchhaengend)
  for (let i = 0; i < 40; i++) {
    const k = i / 39, x = lerp(-5.5, 5.5, k), y = 4.6 - 0.75 * Math.sin(Math.PI * ((k * 2) % 1));
    const s = glowSprite('#ffcf86', 0.34, 0.95); s.position.set(x, y, -3.05); s.userData.ph = R() * 6; XM.add(s); xLights.push(s);
  }
}
const xmAccent = glowSprite('#ffb86a', 7, 0.14); xmAccent.position.set(-1.7, 2.0, -3.1); XM.add(xmAccent);

// ---------- Licht: Abend ----------
const ENVD = stripEnv(r, { bg: '#0c0d0e', strips: [
  { w: 1.4, h: 9, pos: v3(-5.5, 0, 2.5), col: '#ffffff', I: 2.4 }, { w: 1.2, h: 9, pos: v3(5.5, 0, -1.5), col: '#e6ecff', I: 2.0 }], top: { w: 4, h: 4, col: '#ffffff', I: 1.0 } });
const SWITCH = 2.2;   // Kuerbis -> Baum (mitten im Flackern)
function roomLevel(tl) {   // Raumlicht flackert 1,95-2,45 weg, die Flamme bleibt
  if (tl < 1.95 || tl > 2.5) return 1;
  const u = (tl - 1.95) / 0.55; const fl = [1, 0.25, 0.9, 0.05, 0.02, 0.02, 0.3, 0.05, 0.6, 1, 1][Math.floor(u * 10)];
  return fl;
}
function licht(tl) {
  const L = roomLevel(tl); const xm = tl >= SWITCH;
  T.mood(0); T.U.uHaloI.value = 0;
  T.U.uC0.value.set('#1a1c1a'); T.U.uC1.value.set('#060707');
  scene.environment = ENVD; scene.environmentIntensity = 0.55 * L + 0.05;
  T.key.color.set('#fff1de'); T.key.intensity = 1.15 * L; T.key.position.set(-3.0, 6.5, 8);
  T.fill.intensity = 0.25 * L + 0.03; T.fill.color.set('#e9eef5'); T.fill.groundColor.set('#141210');
  T.rim.color.set(xm ? '#fff0dc' : '#c7b4ff'); T.rim.intensity = 16 * L + 2; T.rim.position.set(2.3, 3.0, -1.3);
  HAL.visible = !xm; XM.visible = xm;
  halAccent.material.opacity = 0.22 * L; xmAccent.material.opacity = 0.14 * L;
  xLights.forEach((s) => (s.material.opacity = (0.75 + 0.25 * Math.sin(tl * 2.3 + s.userData.ph)) * (0.35 + 0.65 * L)));
  HAL.children.forEach((c) => { if (c.isSprite && c.userData.ph != null) c.material.opacity = (0.8 + 0.2 * Math.sin(tl * 13 + c.userData.ph)) * (0.4 + 0.6 * L); });
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Diffusor'),
  a: mk('tt', 'Mein Kürbis muss<br>jetzt ausziehen.', 320),
  b: mk('tt', 'Ab heute:<br>Weihnachtsmodus.', 320),
  c: mk('tt', 'Die Flamme<br>darf bleiben.', 320),
  d: mk('tt', '130&nbsp;ml Tank.<br>Bis zu 6 Stunden.', 320),
  p: mk('tt big', '25,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.06, vig: 'rgba(6,6,6,.55)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 2.9, 'raum'], [2.9, 4.5, 'nah'], [4.5, 5.8, 'seite'], [5.8, 7.0, 'preis'], [7.0, 8.4, 'raum2']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.02 * a);
function shoot(t, pos, tgt, a = 1, fov = 32) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
// Erste Einstellung: leicht von links oben, langsamer Zoom auf das Regal; u = t bzw. t - 8 -> nahtlos
const raumCam = (u) => { const a = -0.2 + 0.05 * u, R0 = 13.2 - 0.4 * u; return [v3(Math.sin(a) * R0, 2.9 - 0.08 * u, Math.cos(a) * R0), v3(0, 2.05, -0.9)]; };

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  const tl = name === 'raum2' ? t - 8 : t;
  T.U.uTime.value = tl; licht(tl);
  D.set(1, tl); D.glowU.uI.value *= 0.35;
  { const m = ease.inOut(seg(tl, 0.0, 1.9)); PUMP.forEach((o, i) => { o.position.x = -1.75 - 0.75 * m + (i ? Math.sin(-0.75 * m / 0.95) * 0.0 : 0); o.position.z = -1.75 - 0.15 * m; });
    PUMP[0].rotation.z = 0.75 * m / 0.95 + 0.04 * Math.sin(tl * 9) * (m > 0 && m < 1 ? 1 : 0); PUMP[1].position.y = 1.38 - 0.1 * m; PUMP[1].rotation.z = 0.25 + 0.75 * m / 0.95; PUMP[1].position.x = -1.75 - 0.75 * m - 0.6 * Math.sin(0.75 * m / 0.95); }
  pool.material.opacity = 0.22 * (0.9 + 0.1 * Math.sin(tl * 11.3));
  wallGlow.material.opacity = 0.16 * (0.9 + 0.1 * Math.sin(tl * 11.3 + 0.5));

  if (name === 'raum' || name === 'raum2') { const [p, q] = raumCam(tl); shoot(t, p, q, 0.8, 30); }
  else if (name === 'nah') {
    const a = lerp(0.15, 0.4, ease.inOut(sp));
    shoot(t, v3(Math.sin(a) * 3.9, 2.05 + 0.15 * sp, Math.cos(a) * 3.9), v3(-0.1, 1.95, -0.3), 0.35, 38);
  } else if (name === 'seite') {   // von rechts hinten oben, an den Kugeln vorbei auf Oeffnung und Lichtring
    const a = lerp(1.25, 1.05, ease.inOut(sp));
    shoot(t, v3(Math.sin(a) * 6.6, 3.9 - 0.2 * sp, Math.cos(a) * 6.6 - 0.4), v3(0.45, 1.55, 0.1), 0.3, 34);
  } else if (name === 'preis') {
    const a = lerp(0.35, 0.25, ease.out(sp));
    shoot(t, v3(Math.sin(a) * 11.2, 5.2, Math.cos(a) * 11.2), v3(0, 2.9, -0.6), 0.4, 32);
  }
  D.flame.rotation.y = Math.atan2(cam.position.x, cam.position.z) - D.group.rotation.y;
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1; tx.word.style.opacity = 1;
  tx.a.style.transform = 'none';
  tx.a.style.opacity = (t < 2.0 ? 1 - seg(t, 1.92, 2.0) : 0) + (t >= 7.0 ? 1 : 0);   // steht ab Render 0 (Loop)
  pop(tx.b, t >= 2.5 && t < 3.45 ? t - 2.5 : -1, seg(t, 3.38, 3.45));
  pop(tx.c, t >= 3.5 && t < 4.5 ? t - 3.5 : -1, seg(t, 4.42, 4.5));
  pop(tx.d, t >= 4.6 && t < 5.8 ? t - 4.6 : -1, seg(t, 5.72, 5.8));
  pop(tx.p, t >= 5.85 && t < 7.0 ? t - 5.85 : -1, seg(t, 6.92, 7.0));
  pop(tx.cta, t >= 6.15 && t < 7.0 ? t - 6.15 : -1, seg(t, 6.92, 7.0));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
