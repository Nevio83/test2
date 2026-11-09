// Maios CGI – Elektrischer Wasserspender fuer Schreibtisch (Produkt 10, Weiss) mit Figur "Mo": "Jeden Morgen dasselbe.", Loop-Clip 8 s (Render 8,4 s)
// Vorbild-Muster (Marketing/cgi/vorbilder.md): wiederkehrende eigene Figur, Mini-Geschichte "das Uebliche" (Gallone schleppen, Pfuetze) -> Produkt als Loesung.
// Ablauf: Mo schleppt die Gallone (Hook) -> kippt, Pfuetze -> Spender, Schlauch rein, Glas fuellt sich, Mo freut sich -> Preis + Link -> zurueck zu Mo mit Gallone (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makeTiefe } from '../lib/tiefe.js';
import { makeWsSzene } from '../lib/ws_szene.js';
import * as WM from '../lib/ws_models.js';
import { makeKid } from '../lib/figur.js';

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
const { W, csW, G, J } = S;
const R = rng(12);
for (const m of [W.body]) { m.envMapIntensity = 0.45; m.sheen = 0; }
// Auslauf-Ende vorne wie am echten Geraet in Gehaeusefarbe, nur die Duese bleibt roségold
W.group.traverse((o) => { if (o.isMesh && o.material === W.metal && o.geometry.parameters && o.geometry.parameters.radiusTop === 0.082) o.material = W.body; });

// ---------- Zimmer: helle Wand (Salbei), Sonne mit Fensterkreuz und Blattschatten ----------
const wallMat = new THREE.MeshStandardMaterial({ color: '#7f9ea6', roughness: 0.93 });
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


// ---------- Mo (eigene Figur) ----------
const K = makeKid(); scene.add(K.group); K.group.scale.setScalar(0.5);
const pjM = K.torso.material, skinM = K.arms[0].children[1].material;
const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.3 * s, 0.25, 0); K.group.add(p);
  const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.6, 6, 12), pjM); l.position.y = -0.5; l.castShadow = true; p.add(l);
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), skinM); f.scale.set(1, 0.6, 1.5); f.position.set(0, -1.02, 0.1); f.castShadow = true; p.add(f); return p; });
const LEG = 1.2 * 0.5;
const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshPhysicalMaterial({ color: '#cfeefa', roughness: 0.03, transparent: true, opacity: 0.78, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false }));
puddle.rotation.x = -Math.PI / 2; puddle.position.y = 0.012; puddle.renderOrder = 5; scene.add(puddle);
const splash = []; for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05 + R() * 0.04, 12, 8), WM.waterMat()); scene.add(d); splash.push({ m: d, a: R() * 6.28, v: 0.6 + R() * 0.8, o: R() }); }

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Wasserspender'),
  a: mk('tt', 'Jeden Morgen<br>dasselbe.', 330),
  b: mk('tt', 'Heben. Kippen.<br>Pfütze.', 330),
  c: mk('tt', 'Schlauch rein.<br>Läuft.', 330),
  d: mk('tt', 'Die Flasche<br>bleibt stehen.', 330),
  p: mk('tt big', '35,99&nbsp;€', 300),
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
const SHOTS = [[0, 2.4, 'schlepp'], [2.4, 3.8, 'kipp'], [3.8, 5.2, 'spender'], [5.2, 6.3, 'glas'], [6.3, 7.3, 'preis'], [7.3, 8.4, 'schlepp2']];
const ON0 = 3.95, ON1 = 6.0;
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.022 * a);
function shoot(t, pos, tgt, a = 1, fov = 32) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
const MO_A = v3(0.3, 0, 1.4);   // Mo mit Gallone
function tag() {
  T.mood(1); T.U.uHaloI.value = 0; T.floor.visible = false;
  T.key.color.set('#ffffff'); T.key.intensity = 1.6; T.key.position.set(-4, 7, 6);
  T.fill.intensity = 0.55; T.fill.color.set('#f6f0e8'); T.fill.groundColor.set('#5a4a3a');
  T.rim.color.set('#e8f6ff'); T.rim.intensity = 18; T.rim.position.set(3.2, 3.8, -2.4);
  scene.environmentIntensity = 0.8; sun.intensity = 380; r.toneMappingExposure = 0.84;
}
function moSet(o) { K.set(o); }
function walk(t, amp = 0.4) { const w = Math.sin(t * 2 * Math.PI / 0.6); legs[0].rotation.x = w * amp; legs[1].rotation.x = -w * amp; K.body.position.y = Math.abs(Math.cos(t * 2 * Math.PI / 0.6)) * 0.05; }
function carry(on) {   // Gallone in den Armen (lokal in Moes Raum) oder frei in der Szene
  if (on) { K.group.add(J.group); J.group.position.set(0, 0.0, 1.3); J.group.rotation.set(0, 0, 0); J.group.scale.setScalar(0.7); }
  else { scene.add(J.group); J.group.scale.setScalar(1); J.group.rotation.set(0, 0, 0); }
}

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  S.hideAll(); T.U.uTime.value = t; tag();
  S.props.visible = S.desk.visible = true; S.lap.visible = false; S.plant.visible = true;
  S.plant.position.set(-2.6, 0, -2.6);
  const tm = t % 8.4;
  puddle.visible = false; splash.forEach((s) => (s.m.visible = false)); TUBE.mesh.visible = false;
  K.group.visible = true; J.group.visible = true; J.cap.visible = true;
  const blink = (tm > 1.9 && tm < 2.02) || (tm > 5.1 && tm < 5.22) ? 1 : 0;

  if (name === 'schlepp' || name === 'schlepp2') {
    const u = name === 'schlepp2' ? t - DAUER : t;
    carry(true);
    K.group.position.set(MO_A.x, LEG, MO_A.z); K.group.rotation.set(0, 0.12, Math.sin(u * 2 * Math.PI / 1.2) * 0.07);
    walk(u * 1.0, 0.33);
    moSet({ look: [0, -0.55], blink, eye: 1.12, mouth: 'o', open: 0.25, brow: -0.55, fwd: 1.35, armL: 0.0, armR: 0.0, headTilt: Math.sin(u * 2 * Math.PI / 1.2 + 1) * 0.05 });
    shoot(t, vlerp(v3(1.5, 1.9, 9.2), v3(1.2, 1.85, 8.5), (u + 1.1) / 3.5), v3(0.2, 1.45, 1.4), 0.6, 30);
  } else if (name === 'kipp') {
    carry(true);
    const k = ease.inOut(seg(t, 2.4, 3.3));
    K.group.position.set(MO_A.x, LEG, MO_A.z); K.group.rotation.set(0, 0.12 + k * 0.1, 0.07 + k * 0.28);
    walk(t * 1.0, 0.33 * (1 - k * 0.8));
    // Gallone rutscht aus den Armen: kippt zur Seite, Wasser schwappt
    J.group.rotation.set(0, 0, -k * 0.7); J.group.position.set(k * 0.35, -k * 0.15, 1.3 + k * 0.3);
    puddle.visible = true; const pu = ease.out(seg(t, 2.9, 3.8)); puddle.scale.setScalar(0.001 + 1.15 * pu); puddle.position.set(MO_A.x + 0.5, 0.012, MO_A.z + 0.55);
    splash.forEach((s) => { const lt = seg(t, 2.8 + s.o * 0.25, 3.5 + s.o * 0.25); if (lt > 0 && lt < 1) { s.m.visible = true; s.m.position.set(MO_A.x + 0.5 + Math.cos(s.a) * lt * 0.9 * s.v, 0.5 + Math.sin(lt * Math.PI) * 0.55 * s.v, MO_A.z + 0.55 + Math.sin(s.a) * lt * 0.9 * s.v); } });
    moSet({ look: [0.3, -0.6], blink: 0, eye: 1.25, mouth: 'o', open: 0.6 + k * 0.4, brow: -0.6 - k * 0.4, fwd: 1.35 - k * 0.5, armL: k * 0.5, armR: k * 0.5, headTilt: k * 0.12 });
    shoot(t, vlerp(v3(1.2, 1.85, 8.5), v3(1.6, 2.0, 9.6), ease.out(sp)), v3(0.4, 1.75, 1.5), 0.8, 30);
  } else {
    carry(false);
    // Geraet, Gallone mit Schlauch, Glas
    S.placeDisp(W, csW, 0, 0, -0.42); csW.material.opacity = 0.65;
    J.group.position.set(2.05, 0, -1.75); J.cap.visible = false;
    TUBE.mesh.visible = true;
    S.glassOn(W, G); G.group.position.z += 0.08;
    S.water(t, ON0, ON1, G, W, 1.02); S.stream.material.emissiveIntensity = 0.3;
    S.ledOn(W, t > 3.9 && t < 6.15 ? 3.0 : 0, false, t);
    W.group.updateMatrixWorld(true);
    const gp = G.group.position.clone();
    // Mo steht links neben dem Geraet und freut sich
    const cheer = Math.sin(t * 2 * Math.PI / 0.7);
    legs.forEach((l) => (l.rotation.x = 0)); K.body.position.y = Math.max(0, cheer) * 0.07;
    if (name === 'spender') {
      K.group.position.set(-1.25, LEG, 2.1); K.group.rotation.set(0, 0.45, 0);
      const up = ease.out(seg(t, 4.2, 4.7));
      moSet({ look: [0.5, 0.35], blink: 0, eye: 1.15, mouth: 'smile', open: 0.5 + 0.3 * up, brow: 0.6 + 0.4 * up, fwd: lerp(0.15, -2.5, up), armL: 0.35, armR: 0.35, headTilt: cheer * 0.05 });
      shoot(t, vlerp(v3(-2.2, 3.4, 10.4), v3(-1.9, 3.3, 9.7), ease.out(sp)), v3(0.0, 1.55, -0.2), 0.5, 32);
    } else if (name === 'glas') {
      K.group.position.set(gp.x - 1.9, LEG, gp.z + 0.6); K.group.rotation.set(0, 0.7, 0);
      moSet({ look: [0.55, 0.45], blink, eye: 1.2, mouth: 'smile', open: 0.85, brow: 1, fwd: -2.4, armL: 0.35, armR: 0.35, headTilt: cheer * 0.06 });
      const a = lerp(-0.45, -0.1, ease.inOut(sp));
      shoot(t, v3(gp.x + Math.sin(a) * 6.0, gp.y + 1.5, gp.z + Math.cos(a) * 6.0), gp.clone().add(v3(-0.45, 1.6, 0)), 0.35, 32);
    } else {   // preis
      K.group.position.set(-1.9, LEG, 1.5); K.group.rotation.set(0, 0.8, 0);
      moSet({ look: [0.4, 0.3], blink, eye: 1.1, mouth: 'smile', open: 0.4, brow: 0.8, fwd: 0.1, armL: 0.3, armR: 0.3, headTilt: 0.04 });
      shoot(t, vlerp(v3(5.2, 3.0, 8.4), v3(4.8, 2.9, 7.8), ease.out(sp)), v3(0.4, 2.0, -0.5), 0.5, 32);
    }
  }
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  const wordOn = t < 3.35 || t >= 7.45;
  tx.word.style.opacity = wordOn ? (t < 3.35 ? 1 - seg(t, 3.2, 3.35) : seg(t, 7.45, 7.6)) : 0;
  pop(tx.a, t < 2.4 ? t + 0.3 : t >= 7.4 ? t - 7.4 + 0.2 : -1, t < 2.4 ? seg(t, 2.3, 2.4) : 0);
  pop(tx.b, t >= 2.5 && t < 3.8 ? t - 2.5 : -1, seg(t, 3.7, 3.8));
  pop(tx.c, t >= 3.9 && t < 5.2 ? t - 3.9 : -1, seg(t, 5.1, 5.2));
  pop(tx.d, t >= 5.3 && t < 6.3 ? t - 5.3 : -1, seg(t, 6.2, 6.3));
  pop(tx.p, t >= 6.35 && t < 7.3 ? t - 6.35 : -1, seg(t, 7.2, 7.3));
  pop(tx.cta, t >= 6.6 && t < 7.3 ? t - 6.6 : -1, seg(t, 7.2, 7.3));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
