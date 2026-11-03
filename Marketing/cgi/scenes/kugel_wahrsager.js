// Maios CGI – Krystall Ball Nachtlampe (Produkt 50), "Halloween. Ich frag die Kugel.", Loop-Clip 8 s (Render 8,4 s), Handy-Look
// Halloween-Nacht am Wahrsagertisch: dunkles Samttuch, Kerzen als unscharfe Lichter, lila Nebel zieht um den Tisch (Raum-Effekt).
// Die Lampe (Motiv Saturn) leuchtet von Anfang an, sie macht nichts, was sie nicht kann.
// Ablauf: Kamera faehrt auf die Kugel zu (Hook) -> nah in die Kugel, Saturn -> Sockel von unten ("Keine Magie. Nur meine Nachtlampe.")
//         -> Aufsicht, Preis + Link -> zurueck zur ersten Einstellung (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex, contactShadow } from '../lib/core.js';
import * as KM from '../lib/kugel_models.js';
import * as BR from '../lib/brand.js';
import { makeTiefe } from '../lib/tiefe.js';

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

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;
const R = rng(21);

// ---------- Tisch mit dunklem Samttuch ----------
const samt = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#2a1238'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) {            // weiche Falten
    const x = R() * w, a = 0.05 + R() * 0.08, lw = 30 + R() * 90;
    const gr = g.createLinearGradient(x - lw, 0, x + lw, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, R() > 0.5 ? `rgba(0,0,0,${a * 2})` : `rgba(120,70,150,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - lw, 0, lw * 2, h);
  }
  for (let i = 0; i < 40000; i++) { g.fillStyle = `rgba(${R() > 0.5 ? '255,220,255' : '0,0,0'},${0.03 + R() * 0.04})`; g.fillRect(R() * w, R() * h, 1, 1); }  // Flor
});
samt.wrapS = samt.wrapT = THREE.RepeatWrapping; samt.repeat.set(2, 2);
const cloth = new THREE.Mesh(new THREE.CircleGeometry(6.5, 96), new THREE.MeshPhysicalMaterial({ map: samt, roughness: 0.85, sheen: 1.0, sheenColor: new THREE.Color('#7a4f96'), sheenRoughness: 0.5, color: '#8f7f9a' }));
cloth.rotation.x = -Math.PI / 2; cloth.receiveShadow = true; scene.add(cloth);
// Tischkante mit herabfallendem Tuch
const drape = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.7, 3.2, 96, 1, true), new THREE.MeshPhysicalMaterial({ map: samt, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#9a70b8'), color: '#a898b0', side: THREE.DoubleSide }));
drape.position.y = -1.6; scene.add(drape);

// Tarotkarten (Rueckseite) und ein paar Kristallsplitter als Requisite
const cardTex = canvasTex(256, 420, (g, w, h) => {
  g.fillStyle = '#efe3c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#3b1d4d'; g.fillRect(10, 10, w - 20, h - 20);
  g.strokeStyle = '#c9a25f'; g.lineWidth = 4; g.strokeRect(22, 22, w - 44, h - 44);
  g.beginPath(); g.arc(w / 2, h / 2, 54, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(w / 2 + 18, h / 2 - 8, 44, 0, Math.PI * 2); g.fillStyle = '#3b1d4d'; g.fill();
  for (let i = 0; i < 26; i++) { g.fillStyle = '#c9a25f'; g.fillRect(30 + R() * (w - 60), 30 + R() * (h - 60), 3, 3); }
});
const cards = new THREE.Group(); scene.add(cards);
[[1.75, 1.05, 0.5], [2.05, 0.55, 0.15], [1.5, 1.55, 0.85]].forEach(([x, z, ry], i) => {
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 1.02), [0, 0, new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.6 }), 0, 0, 0].map((m) => m || new THREE.MeshStandardMaterial({ color: '#efe3c8', roughness: 0.7 })));
  c.position.set(x, 0.007 + i * 0.013, z); c.rotation.y = ry; c.castShadow = c.receiveShadow = true; cards.add(c);
});

// ---------- Kerzen als unscharfe Lichter im Hintergrund ----------
function candleTex(blur = 7) {
  return canvasTex(256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); const cx = w / 2;
    const body = g.createLinearGradient(cx - 46, 0, cx + 46, 0); body.addColorStop(0, '#5a4a3c'); body.addColorStop(0.45, '#cdb894'); body.addColorStop(1, '#4a3c30');
    g.fillStyle = body; g.fillRect(cx - 46, 260, 92, 252);
    const fl = g.createRadialGradient(cx, 200, 4, cx, 205, 60); fl.addColorStop(0, 'rgba(255,250,225,1)'); fl.addColorStop(0.35, 'rgba(255,200,110,0.95)'); fl.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = fl; g.beginPath(); g.ellipse(cx, 205, 26, 62, 0, 0, Math.PI * 2); g.fill();
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g2 = c2.getContext('2d');
    g2.filter = `blur(${blur}px)`; g2.drawImage(g.canvas, 0, 0); g.clearRect(0, 0, w, h); g.drawImage(c2, 0, 0);
  });
}
const bokehMat = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
const CT = candleTex(7), CT2 = candleTex(12);
const candles = [[-1.7, 0.0, -3.6, 0.6, CT], [-1.0, 0.0, -6.4, 0.5, CT2], [1.9, 0.0, -4.4, 0.7, CT], [2.7, 0.0, -6.6, 0.55, CT2], [0.5, 0.0, -7.6, 0.45, CT2]].map(([x, y, z, s, tex]) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 2), bokehMat(tex)); m.position.set(x, y + s, z); scene.add(m); return m;
});
const candL = new THREE.PointLight('#ffb56a', 0, 9, 1.6); candL.position.set(-2.0, 1.6, -2.6); scene.add(candL);
const candR = new THREE.PointLight('#ffc27a', 0, 9, 1.6); candR.position.set(2.4, 1.7, -3.0); scene.add(candR);

// ---------- Lila Nebel zieht um den Tisch (Raum-Effekt, nur vor und hinter der Kugel, Unterkante auf dem Tuch) ----------
const fogTex = canvasTex(256, 128, (g, w, h) => {   // weich bis an jeden Rand: keine harte Kante an Tuch oder Bildrand
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - w / 2) / (w / 2), dy = (y - h * 0.62) / (h * 0.5); const rr = Math.sqrt(dx * dx + dy * dy);
    const k = Math.max(0, 1 - rr); const v = Math.sin(Math.PI * y / h); const n = 0.75 + 0.25 * Math.sin(x * 0.09 + Math.sin(y * 0.13) * 2);
    const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 255 * k * k * v * n * 0.9;
  }
  g.putImageData(img, 0, 0);
});
const fogs = [];
for (let i = 0; i < 9; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.7), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false, opacity: 0.0, color: i % 3 ? '#b99ae6' : '#e0c8ff' }));
  // Ring um die Kugel: Radius 2,2..3,4, eigene Geschwindigkeit
  m.userData = { a0: i / 9 * Math.PI * 2, rad: 2.2 + (i % 3) * 0.6, w: (i % 2 ? 1 : -1) * 2 * Math.PI / 8.4, op: 0.34 + (i % 2) * 0.12 };
  scene.add(m); fogs.push(m);
}
// Nebelschwaden vor der Kugel (zwischen Kamera und Tisch), ziehen quer durchs Bild; Periode 8,4 s = nahtloser Loop
const front = [];
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.5), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false, opacity: 0, color: '#d4bdf5' }));
  m.userData = { o: i / 4, z: 3.0 + (i % 2) * 1.1, y: 0.35 + (i % 2) * 0.25 }; scene.add(m); front.push(m);
}

// ---------- Lampe (Motiv Saturn) ----------
const L = KM.makeLamp('saturn', KM.woodTex()); scene.add(L.group);
L.group.rotation.y = -0.25;
const cs = contactShadow(2.6, 0.6); cs.position.y = 0.003; scene.add(cs);
const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshBasicMaterial({ map: KM.glowTex([[0, 'rgba(255,214,150,0.55)'], [0.4, 'rgba(255,180,110,0.18)'], [1, 'rgba(255,170,90,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.006; scene.add(pool);
const BALL = v3(0, KM.BALL_Y, 0);

// ---------- Licht ----------
function nacht(t) {
  T.mood(0);
  T.U.uC0.value.set('#24102f'); T.U.uC1.value.set('#05020a'); T.U.uCenter.value.set(0.5, 0.6);
  T.key.color.set('#fff1de'); T.key.intensity = 0.9; T.key.position.set(-3.5, 7.5, 5.5);
  T.fill.intensity = 0.1; T.fill.color.set('#cbbbe6'); T.fill.groundColor.set('#0e0614');
  T.rim.color.set('#c7b6ff'); T.rim.intensity = 22; T.rim.position.set(2.8, 3.6, -2.6);
  scene.environmentIntensity = 0.38;
  const f1 = 0.78 + 0.16 * Math.sin(t * 13.1) + 0.08 * Math.sin(t * 29.7 + 1.3);
  const f2 = 0.76 + 0.16 * Math.sin(t * 17.3 + 2) + 0.09 * Math.sin(t * 41.1);
  candL.intensity = 3.2 * f1; candR.intensity = 2.8 * f2;
  candles.forEach((c, i) => c.material.color.setScalar((i % 2 ? f2 : f1) * (i > 2 ? 0.8 : 1)));
  T.haloAt(candles[0].position.clone().add(v3(0, 0.25, 0)), 0.1, 0.2 * f1, '#ffb060', 2);
  T.haloAt(BALL, 0.22, 0.07, '#7d4fb0', 1);   // lila Schein hinter der Kugel (Raum, nicht Produkt)
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Nachtlampe'),
  k: mk('tt k', '', 330),
  a: mk('tt', 'Halloween.<br>Ich frag die Kugel.', 360),
  b: mk('tt', 'Sie zeigt mir<br>den Saturn.', 330),
  c: mk('tt', 'Keine Magie.<br>Nur meine Nachtlampe.', 330),
  p: mk('tt big', '17,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.07, vig: 'rgba(6,2,10,.62)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 2.6, 'tisch'], [2.6, 4.2, 'nah'], [4.2, 5.6, 'sockel'], [5.6, 7.0, 'preis'], [7.0, 8.4, 'tisch2']];

const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.025 * a);
function shoot(t, pos, tgt, a = 1, fov = 30) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
// Erste Einstellung: gleichmaessige Fahrt auf die Kugel zu, u = t (Anfang) bzw. t - 8,4 (Ende), laeuft nahtlos in den Anfang
const W0 = v3(0.9, 2.85, 11.6), W1 = v3(0.55, 2.55, 8.8), WT0 = v3(0, 2.4, 0), WT1 = v3(0, 2.3, 0);
const tischCam = (u) => [vlerp(W0, W1, u / 2.6), vlerp(WT0, WT1, u / 2.6)];

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  T.U.uTime.value = t; nacht(t);

  if (name === 'tisch' || name === 'tisch2') {
    const u = name === 'tisch' ? t : t - DAUER; const [p, q] = tischCam(u);
    shoot(t, p, q, 1.0, 36);
  } else if (name === 'nah') {
    const a = lerp(0.3, 0.55, ease.inOut(sp)), d = lerp(4.6, 4.1, ease.out(sp));
    shoot(t, v3(Math.sin(a) * d, BALL.y + 0.25, Math.cos(a) * d), BALL.clone().add(v3(0, 0.78, 0)), 0.35, 34);
  } else if (name === 'sockel') {
    const a = lerp(0.7, 0.5, ease.out(sp)), d = 5.6;
    shoot(t, v3(Math.sin(a) * d, 0.5, Math.cos(a) * d), v3(0, 1.55, 0), 0.4, 36);
  } else if (name === 'preis') {
    const a = lerp(0.95, 0.8, ease.out(sp));
    shoot(t, v3(Math.sin(a) * 8.0, 2.7, Math.cos(a) * 8.0), v3(0.1, 2.2, 0), 0.5, 34);
  }
  L.set(1, 0.3, { cam, glowScale: 0.8 }); L.eMat.uniforms.uCol.value.set('#ffdcaa');   // Gravur warm wie auf dem Foto

  // Nebel: zieht langsam um den Tisch, steht mit der Unterkante auf dem Tuch, nicht auf Kugelhoehe direkt neben der Kugel
  fogs.forEach((m) => {
    const d = m.userData; const a = d.a0 + t * d.w;
    m.position.set(Math.cos(a) * d.rad, 0.8, Math.sin(a) * d.rad);
    m.lookAt(cam.position.x, m.position.y, cam.position.z);
    m.material.opacity = d.op;
  });
  front.forEach((m) => {
    const d = m.userData; const ph = ((t / 8.4 + d.o) % 1 + 1) % 1;
    m.position.set(lerp(-3.2, 3.2, ph), d.y, d.z); m.lookAt(cam.position.x, m.position.y, cam.position.z);
    m.material.opacity = 0.62 * Math.sin(Math.PI * ph);
  });
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  const wordOn = t < 3.35 || t >= 7.45;
  tx.word.style.opacity = wordOn ? (t < 3.35 ? 1 - seg(t, 3.2, 3.35) : seg(t, 7.45, 7.6)) : 0;
  pop(tx.a, t < 2.6 ? t + 0.3 : t >= 7.5 ? t - 7.5 : -1, t < 2.6 ? seg(t, 2.5, 2.6) : 0);
  pop(tx.b, t >= 2.7 && t < 4.2 ? t - 2.7 : -1, seg(t, 4.1, 4.2));
  pop(tx.c, t >= 4.3 && t < 5.6 ? t - 4.3 : -1, seg(t, 5.5, 5.6));
  pop(tx.p, t >= 5.7 && t < 7.0 ? t - 5.7 : -1, seg(t, 6.9, 7.0));
  pop(tx.cta, t >= 6.15 && t < 7.0 ? t - 6.15 : -1, seg(t, 6.9, 7.0));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
