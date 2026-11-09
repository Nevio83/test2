// Maios CGI – Krystall Ball Nachtlampe (Produkt 50, Motiv Saturn), "Wichteln. Limit: 20 €.", Loop-Clip 8 s (Render 8,4 s), Handy-Look
// Dunkler Tisch, Lichterkette als Bokeh im Hintergrund (blinkt), Geschenkbox mit warmem Licht an den Fugen. Box geht auf, Kugel leuchtet.
// Ablauf: geschlossene Box (Hook) -> Box geht auf, Saturn -> Kugel nah -> Preis + Link -> Box schliesst sich, zurueck zum Anfang (Loop).
// Technik: Bloom (lib/post.js). Licht/Raum/Requisite bewegen sich, die Lampe macht nur, was products.json hergibt (leuchtet, 7 Motive).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex, contactShadow } from '../lib/core.js';
import * as KM from '../lib/kugel_models.js';
import * as BR from '../lib/brand.js';
import { makeTiefe } from '../lib/tiefe.js';
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
await document.fonts.load('800 40px Manrope', 'ßü€·?:');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;
const R = rng(33);



const P = makePost(r, scene, cam, { strength: 0.32, radius: 0.6, threshold: 0.88 });

// ---------- Tisch (Walnuss) ----------
const walnut = KM.woodTex(7, '#6b4a33', [40, 26, 16]); walnut.wrapS = walnut.wrapT = THREE.RepeatWrapping; walnut.repeat.set(2, 1); walnut.rotation = Math.PI / 2;
const table = new THREE.Mesh(new THREE.BoxGeometry(16, 0.36, 9), new THREE.MeshPhysicalMaterial({ map: walnut, roughness: 0.5, clearcoat: 0.25 }));
table.position.set(0, -0.18, -1.2); table.receiveShadow = true; scene.add(table);
// Bokeh-Lichterkette (Raum): warme Punkte hinten, blinken periodisch in 8 s
const BOK = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const bok = [];
const KCOL = ['#ffb35c', '#ffd08a', '#ff8f5a', '#ffe3b0'];
for (let i = 0; i < 34; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: BOK, color: KCOL[i % 4], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.7 }));
  const x = -7 + (i / 33) * 14, y = 4.4 + Math.sin(i * 0.9) * 1.3 + (i % 3) * 0.5; m.position.set(x, y, -8 + (i % 4) * 0.3);
  m.scale.setScalar(0.5 + R() * 0.9); m.userData = { k: 1 + (i % 3), ph: R() * 6.28, base: m.scale.x, x0: x, y0: y }; scene.add(m); bok.push(m);
}
// weitere Geschenke (Requisite, Raum)
function gbox(w, h, d, col, rib, x, z, ry) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') })); b.position.y = h / 2; b.castShadow = b.receiveShadow = true; g.add(b);
  const rm = new THREE.MeshPhysicalMaterial({ color: rib, roughness: 0.35, metalness: 0.3, clearcoat: 0.5 });
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.16), rm); r1.position.y = h / 2; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, h + 0.03, d + 0.02), rm); r2.position.y = h / 2; g.add(r2);
  const bow = new THREE.Mesh(new THREE.TorusKnotGeometry(0.16, 0.05, 40, 8, 2, 3), rm); bow.position.y = h + 0.08; g.add(bow);
  g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); return g;
}
gbox(1.5, 1.2, 1.4, '#7a2e3b', '#d8b56c', -3.6, -1.6, 0.4);
gbox(1.2, 1.7, 1.2, '#2f4d3c', '#e9dfcc', 3.4, -2.2, -0.3);
gbox(0.9, 0.8, 0.9, '#c8a86c', '#7a2e3b', 2.4, 0.9, 0.5);
gbox(0.8, 0.6, 1.1, '#f1e9dc', '#2f4d3c', -2.7, 1.5, -0.5);

// ---------- Lampe (Saturn) in der Geschenkbox ----------
const L = KM.makeLamp('saturn', KM.woodTex()); scene.add(L.group);
L.group.rotation.y = 0.35;
L.base.group.scale.set(0.84, 1.08, 0.84);
const gift = KM.makeGift(); scene.add(gift.group);
// Bug-Fix (Z-Fighting im geoeffneten Zustand): flache Waende, Boden, Schatten und Lichtpfuetze liegen auf eigenen Hoehen
gift.walls.forEach((pv, i) => { pv.position.y = 0.04 + i * 0.015; pv.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.polygonOffset = true; o.material.polygonOffsetFactor = -1 - i; o.material.polygonOffsetUnits = -1; } }); });
const giftFloor = gift.group.children.find((c) => c.geometry && c.geometry.type === 'PlaneGeometry' && c.rotation.x !== 0);
if (giftFloor) giftFloor.position.y = 0.02;
const cs = contactShadow(3.4, 0.6); cs.position.y = 0.03; scene.add(cs);
const pool = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), new THREE.MeshBasicMaterial({ map: KM.glowTex([[0, 'rgba(255,214,150,0.6)'], [0.4, 'rgba(255,180,110,0.2)'], [1, 'rgba(255,170,90,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.09; scene.add(pool);
const leak = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.0), new THREE.MeshBasicMaterial({ map: BOK, color: '#ffb35c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
leak.position.set(0, gift.H + 0.75, 0.2); scene.add(leak);
const BALL = v3(0, KM.BALL_Y, 0);
const keyL = new THREE.PointLight('#ffd2a0', 0, 16, 1.4); keyL.position.set(-3.2, 5.5, 5.0); scene.add(keyL);
const innerL = new THREE.PointLight('#ffb35c', 0, 7, 1.6); innerL.position.set(0, 1.5, 0); scene.add(innerL);
function nacht() {
  T.mood(0);
  T.U.uC0.value.set('#1a0f10'); T.U.uC1.value.set('#050304');
  T.key.color.set('#fff1de'); T.key.intensity = 0.8; T.key.position.set(-3.5, 7.5, 5.5);
  T.fill.intensity = 0.14; T.fill.color.set('#e6d3c0'); T.fill.groundColor.set('#0a0605');
  T.rim.color.set('#ffcf9a'); T.rim.intensity = 14; T.rim.position.set(2.4, 3.4, -2.0);
  keyL.intensity = 4.5; scene.environmentIntensity = 0.3;
}
// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Nachtlampe'),
  a: mk('tt', 'Wichteln.<br>Limit: 20&nbsp;€.', 360),
  b: mk('tt', 'Kristallkugel<br>mit Saturn.', 330),
  c: mk('tt', 'Unter 20&nbsp;€.<br>Geht doch.', 330),
  p: mk('tt big', '16,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.07, vig: 'rgba(8,3,2,.6)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 3.4, 'box'], [3.4, 4.8, 'auf'], [4.8, 6.0, 'nah'], [6.0, 7.2, 'preis'], [7.2, 8.4, 'box2']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.025 * a);
function shoot(t, pos, tgt, a = 1, fov = 30) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
const B0 = v3(2.4, 3.6, 15.4), B1 = v3(1.1, 3.1, 12.0), BT0 = v3(0, 2.75, 0), BT1 = v3(0, 2.8, 0);
const boxCam = (u) => { const k = (u + 0.8) / 4.2; return [vlerp(B0, B1, k), vlerp(BT0, BT1, k)]; };

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  const tm = t % 8;   // Raum-Animation periodisch in 8 s (Schluss = Anfang)
  T.U.uTime.value = tm; nacht();
  // Box: offen (1) / zu (0). Oeffnen 3,45-4,1, Schliessen 7,2-7,85
  const openA = seg(t, 3.45, 4.1), closeA = seg(t, 7.2, 7.85);
  const lidO = ease.inOut(seg(t, 3.45, 3.85)) * (1 - ease.inOut(seg(t, 7.45, 7.85)));
  gift.lid.position.set(lidO * 1.6, gift.H + lidO * 4.2, -lidO * 1.2); gift.lid.rotation.set(-lidO * 0.5, lidO * 0.6, -lidO * 0.7);
  gift.walls.forEach((w, i) => {
    const qo = ease.outBack(seg(t, 3.7 + i * 0.05, 4.16 + i * 0.05)); const qc = ease.inOut(seg(t, 7.2 + (3 - i) * 0.04, 7.55 + (3 - i) * 0.04));
    const q = t < 5 ? qo : 1 - qc; w.rotation.x = Math.min(1.0, q) * Math.PI / 2 * (q > 1 ? 1 + (q - 1) * 0.05 : 1);
  });
  const openness = t < 5 ? ease.out(openA) : 1 - ease.out(closeA);
  const lampOn = openness;   // Licht der Kugel sichtbar, wenn die Waende offen sind
  L.set(1, 0.3, { cam, glowScale: 0.5 }); L.eMat.uniforms.uCol.value.set('#fff0d6');
  L.eMat.uniforms.uI.value *= 1 + 0.08 * Math.sin(tm * 2 * Math.PI / 2.0);
  L.bottom.material.opacity *= 0.55;
  innerL.intensity = 4 + 6 * openness;
  const twk = 0.5 + 0.5 * Math.sin(tm * 2 * Math.PI / 2.0);
  leak.material.opacity = (0.16 + 0.34 * twk) * (1 - openness);
  pool.material.opacity = (0.22 + 0.2 * openness + 0.05 * Math.sin(tm * 2 * Math.PI / 2.0)) * (1 - 0.6 * openness);
  bok.forEach((m) => { const d = m.userData; const f = 0.55 + 0.45 * Math.sin(tm * 2 * Math.PI * d.k / 8 + d.ph); m.material.opacity = 0.25 + 0.6 * f; m.scale.setScalar(d.base * (0.9 + 0.2 * f)); m.position.x = d.x0 + Math.sin(tm * 2 * Math.PI / 8 + d.ph) * 0.45; m.position.y = d.y0 + Math.sin(tm * 2 * Math.PI / 4 + d.ph * 2) * 0.18; m.lookAt(cam.position); });
  if (name === 'box' || name === 'box2') {
    const u = name === 'box' ? t : t - 8; const [p, q] = boxCam(u); shoot(t, p, q, 1.0, 32);
  } else if (name === 'auf') {
    shoot(t, vlerp(v3(-1.0, 2.9, 11.2), v3(-0.5, 2.1, 7.4), ease.out(sp)), v3(0, 1.8, 0), 0.8, 32);
  } else if (name === 'nah') {
    const a = lerp(-0.5, -0.1, ease.inOut(sp)), d = lerp(7.4, 6.7, ease.out(sp));
    shoot(t, v3(Math.sin(a) * d, BALL.y + 0.4, Math.cos(a) * d), BALL.clone().add(v3(0, 0.35, 0)), 0.35, 36);
  } else if (name === 'preis') {
    const a = lerp(-0.55, -0.4, ease.out(sp));
    shoot(t, v3(Math.sin(a) * 8.2, 2.8, Math.cos(a) * 8.2), v3(0.2, 1.7, 0), 0.5, 34);
  }
  scene.updateMatrixWorld(true);
  tx.pill.style.opacity = 1; tx.word.style.opacity = 1;
  pop(tx.a, t < 3.4 ? t + 0.3 : t >= 7.55 ? t - 7.55 : -1, t < 3.4 ? seg(t, 3.3, 3.4) : 0);
  pop(tx.b, t >= 3.5 && t < 4.8 ? t - 3.5 : -1, seg(t, 4.7, 4.8));
  pop(tx.c, t >= 4.9 && t < 6.0 ? t - 4.9 : -1, seg(t, 5.9, 6.0));
  pop(tx.p, t >= 6.05 && t < 7.2 ? t - 6.05 : -1, seg(t, 7.1, 7.2));
  pop(tx.cta, t >= 6.35 && t < 7.2 ? t - 6.35 : -1, seg(t, 7.1, 7.2));
  O.grain(Math.round(t * 30), 1);
  P.render();
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
