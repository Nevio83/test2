// Maios CGI – Tumbler Becher (Produkt 47, Storm Sea), "Heute Morgen um 7 eingefüllt.", Loop-Clip 8 s (Render 8,4 s), Handy-Look
// Zeitraffer eines ganzen Tages am Schreibtisch: Sonne wandert durchs Fenster, Schatten ziehen über den Tisch, Wanduhr rast,
// Abend, Nacht, wieder Morgen (periodisch in 8 s = 24 h). Effekte nur am Raum (Licht, Uhr), der Becher steht einfach da.
// Ablauf: Totale mit Fenster + Uhr (Hook) -> Deckel/Strohhalm nah (Isoliert, bis zu 12 Stunden) -> flach am Griff ->
//         Halbtotale mit Preis + Link -> zurück zur ersten Einstellung (Loop).
import * as THREE from 'three';
import { makeEnv, makeRenderer, aim, v3, clamp, lerp, seg, ease, rng, canvasTex, contactShadow } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makeTumbler } from '../lib/tumbler_models.js';
import { makePostPro } from '../lib/post_pro.js';

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
await document.fonts.load('800 40px Manrope', 'ßüÜ€·?:');

const r = makeRenderer(); r.toneMappingExposure = 0.95;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 120);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const R = rng(4747);
const P = makePostPro(r, scene, cam, { bloom: [0.18, 0.5, 0.92], aoRadius: 0.5 });

// ---------- Raum: Rückwand mit Fenster (links) und Wanduhr (rechts), Schreibtisch ----------
const WALLZ = -4.2;
const wallM = new THREE.MeshStandardMaterial({ color: '#d8d0c4', roughness: 0.95 });
const wallTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#d8d0c4'; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '90,80,70'},${R() * 0.05})`; g.fillRect(R() * w, R() * h, 3, 3); } });
wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(3, 3); wallM.map = wallTex; wallM.color.set('#ffffff');
const plaster = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { const v = 90 + Math.floor(R() * 80); g.fillStyle = `rgba(${v},${v},${v},.25)`; g.beginPath(); g.arc(R() * w, R() * h, 2 + R() * 7, 0, Math.PI * 2); g.fill(); } }, false);
plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping; plaster.repeat.set(4, 4); wallM.bumpMap = plaster; wallM.bumpScale = 0.6;
// Wand mit Fensterloch: vier Teile um das Fenster (x -5.6..-1.2, y 2.2..8.2)
const WX0 = -4.9, WX1 = -1.1, WY0 = 2.4, WY1 = 8.4;
const wp = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallM); m.position.set(x, y, WALLZ); m.receiveShadow = true; scene.add(m); return m; };
wp(30, 20, (WX1 + 15) , 6); wp(30, 20, WX0 - 15, 6); wp(WX1 - WX0, 20, (WX0 + WX1) / 2, WY1 + 10); wp(WX1 - WX0, WY0 + 10, (WX0 + WX1) / 2, WY0 - (WY0 + 10) / 2);
// Himmel hinter dem Fenster (Farbe je Tageszeit)
const skyC = document.createElement('canvas'); skyC.width = 64; skyC.height = 256; const skyG = skyC.getContext('2d');
const skyTex = new THREE.CanvasTexture(skyC); skyTex.colorSpace = THREE.SRGBColorSpace;
const sky = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false })); sky.position.set(-3.4, 5.4, WALLZ - 3); scene.add(sky);
const skyStops = [[0, '#0b1230', '#1a2550'], [5, '#141c44', '#2a2f5e'], [6.5, '#f0a46a', '#7aa0d6'], [9, '#8fc3f0', '#cfe6fb'], [16, '#8fc3f0', '#d8eefc'], [18.5, '#f08a4a', '#ffcf8a'], [20, '#2a2c6a', '#d9786a'], [21.5, '#0b1230', '#1d2756'], [24, '#0b1230', '#1a2550']];
function drawSky(h) {
  let i = 0; while (i < skyStops.length - 2 && h >= skyStops[i + 1][0]) i++;
  const [h0, a0, b0] = skyStops[i], [h1, a1, b1] = skyStops[i + 1]; const k = clamp((h - h0) / (h1 - h0));
  const ca = new THREE.Color(a0).lerp(new THREE.Color(a1), k), cb = new THREE.Color(b0).lerp(new THREE.Color(b1), k);
  const gr = skyG.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#' + ca.getHexString()); gr.addColorStop(1, '#' + cb.getHexString());
  skyG.fillStyle = gr; skyG.fillRect(0, 0, 64, 256);
  const night = 1 - clamp(Math.min((h - 5.5) / 1.2, (20.8 - h) / 1.2) + 1 - 1);
  if (h < 5.8 || h > 20.6) { const Rs = rng(9); skyG.fillStyle = 'rgba(255,255,255,.8)'; for (let s = 0; s < 22; s++) skyG.fillRect(Rs() * 64, Rs() * 160, 1, 1); }
  void night; skyTex.needsUpdate = true;
}
// Fensterrahmen + Sprossen (werfen die Schatten auf den Tisch)
const frameM = new THREE.MeshStandardMaterial({ color: '#f2efe9', roughness: 0.6 });
const fb = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameM); b.position.set(x, y, z); b.castShadow = true; scene.add(b); return b; };
const FW = 0.16, FZ = WALLZ - 0.05;
fb(WX1 - WX0 + FW, FW, 0.3, (WX0 + WX1) / 2, WY0, FZ); fb(WX1 - WX0 + FW, FW, 0.3, (WX0 + WX1) / 2, WY1, FZ);
fb(FW, WY1 - WY0, 0.3, WX0, (WY0 + WY1) / 2, FZ); fb(FW, WY1 - WY0, 0.3, WX1, (WY0 + WY1) / 2, FZ);
fb(0.09, WY1 - WY0, 0.12, (WX0 + WX1) / 2, (WY0 + WY1) / 2, FZ); fb(WX1 - WX0, 0.09, 0.12, (WX0 + WX1) / 2, (WY0 + WY1) / 2 + 0.6, FZ);
const sillB = fb(WX1 - WX0 + 0.6, 0.12, 0.6, (WX0 + WX1) / 2, WY0 - 0.06, WALLZ + 0.25); sillB.material = new THREE.MeshStandardMaterial({ color: '#efebe4', roughness: 0.5 });
// Wanduhr (rechts oben)
const CLK = new THREE.Group(); CLK.position.set(1.7, 5.3, WALLZ + 0.06); scene.add(CLK);
{
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.95, 64), new THREE.MeshStandardMaterial({ map: canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#222';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.save(); g.translate(256, 256); g.rotate(a); g.fillRect(-5, -230, 10, i % 3 ? 26 : 44); g.restore(); }
  }), roughness: 0.6 })); CLK.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.07, 16, 64), new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.4, metalness: 0.3 })); CLK.add(rim);
  const handM = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.5 });
  const hh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.02), handM); hh.geometry.translate(0, 0.22, 0); hh.position.z = 0.02; CLK.add(hh);
  const mh = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.78, 0.02), handM); mh.geometry.translate(0, 0.35, 0); mh.position.z = 0.035; CLK.add(mh);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), handM); pin.rotation.x = Math.PI / 2; pin.position.z = 0.05; CLK.add(pin);
  CLK.userData = { hh, mh };
}
// Schreibtisch (Eiche) + Deko: Notizbuch, Stift, Pflanze
const oakDraw = (bump) => (g, w, h) => {
  g.fillStyle = bump ? '#808080' : '#b08457'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { const y0 = R() * h, amp = 4 + R() * 14, f = 0.002 + R() * 0.006, ph = R() * 6;
    const dark = R() < 0.6; g.strokeStyle = bump ? (dark ? 'rgba(40,40,40,.25)' : 'rgba(200,200,200,.12)') : (dark ? `rgba(92,56,26,${0.08 + R() * 0.12})` : `rgba(255,226,180,${0.05 + R() * 0.07})`);
    g.lineWidth = 0.6 + R() * 2.4; g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.25); g.stroke(); }
  for (let i = 0; i < 6; i++) { const x = R() * w, y = R() * h; const gr = g.createRadialGradient(x, y, 0, x, y, 30); gr.addColorStop(0, bump ? 'rgba(30,30,30,.4)' : 'rgba(80,45,20,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 40, y - 40, 80, 80); }
};
const oak = canvasTex(2048, 1024, oakDraw(false)), oakB = canvasTex(1024, 512, oakDraw(true), false);
const desk = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 6), new THREE.MeshPhysicalMaterial({ map: oak, bumpMap: oakB, bumpScale: 0.5, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 })); desk.position.set(-1, -0.15, -1.2); desk.receiveShadow = true; scene.add(desk);
const book = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 2.7), new THREE.MeshPhysicalMaterial({ color: '#2f3b45', roughness: 0.75, sheen: 0.4, sheenColor: new THREE.Color('#8fa0b0') })); book.position.set(2.4, 0.09, -0.6); book.rotation.y = -0.25; book.castShadow = true; book.receiveShadow = true; scene.add(book);
const pages = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.12, 2.62), new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.9 })); pages.position.set(2.4, 0.11, -0.6); pages.rotation.y = -0.25; scene.add(pages);
const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 16), new THREE.MeshPhysicalMaterial({ color: '#c9a24a', roughness: 0.25, metalness: 0.8 })); pen.rotation.set(0, 0.5, Math.PI / 2); pen.position.set(2.5, 0.25, 0.2); pen.castShadow = true; scene.add(pen);
// Laptop (offen, hinten rechts)
const LAP = new THREE.Group(); LAP.position.set(2.9, 0, -3.0); LAP.rotation.y = -0.45; scene.add(LAP);
{ const alu = new THREE.MeshPhysicalMaterial({ color: '#b8bcc2', metalness: 0.85, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 2.2), alu); base.position.y = 0.05; base.castShadow = true; base.receiveShadow = true; LAP.add(base);
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.0), new THREE.MeshStandardMaterial({ color: '#1c1d20', roughness: 0.7 })); kb.rotation.x = -Math.PI / 2; kb.position.set(0, 0.101, -0.25); LAP.add(kb);
  const lidG = new THREE.Group(); lidG.position.set(0, 0.1, -1.1); lidG.rotation.x = -0.28; LAP.add(lidG);
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.1, 0.06), alu); back.position.y = 1.05; back.castShadow = true; lidG.add(back);
  const scrT = canvasTex(512, 340, (g, w, h) => { g.fillStyle = '#e9eef3'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9d3dd'; g.fillRect(0, 0, w, 26); g.fillStyle = '#d6dee6'; g.fillRect(0, 26, 120, h); for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(80,95,110,.35)'; g.fillRect(150, 50 + i * 28, 200 + (i * 37) % 140, 10); } });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.95, 1.85), new THREE.MeshStandardMaterial({ map: scrT, emissive: '#ffffff', emissiveMap: scrT, emissiveIntensity: 0.35, roughness: 0.2 })); screen.position.set(0, 1.07, 0.031); lidG.add(screen);
  LAP.userData.screen = screen; }
// Pflanze: Topf + gebogene Blaetter, die sich leicht im Luftzug bewegen
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.8, 48), new THREE.MeshPhysicalMaterial({ color: '#e8e2d8', roughness: 0.55, clearcoat: 0.4 })); pot.position.set(-3.6, 0.4, -2.4); pot.castShadow = true; pot.receiveShadow = true; scene.add(pot);
const soil = new THREE.Mesh(new THREE.CircleGeometry(0.46, 32), new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 1 })); soil.rotation.x = -Math.PI / 2; soil.position.set(-3.6, 0.76, -2.4); scene.add(soil);
const leafGeo = (() => { const gg = new THREE.PlaneGeometry(0.34, 1.3, 6, 16); const pa = gg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i) + 0.65; const wv = Math.sin(Math.PI * y / 1.3); pa.setX(i, x * (0.25 + wv)); pa.setY(i, y); pa.setZ(i, -0.18 * (y / 1.3) ** 2 - Math.abs(x) * 0.25); }
  gg.computeVertexNormals(); return gg; })();
const leafM = new THREE.MeshPhysicalMaterial({ color: '#3d6e45', roughness: 0.45, clearcoat: 0.3, side: THREE.DoubleSide, sheen: 0.3, sheenColor: new THREE.Color('#9fd39f') });
const LEAVES = [];
for (let i = 0; i < 11; i++) { const l = new THREE.Mesh(leafGeo, leafM); const a = i / 11 * Math.PI * 2 + R() * 0.3; l.position.set(-3.6, 0.75, -2.4); l.rotation.set(0, a, 0); l.rotateX(-0.25 - R() * 0.35); l.scale.setScalar(0.8 + R() * 0.45); l.castShadow = true; scene.add(l); LEAVES.push({ l, a, ph: R() * 6, base: l.rotation.clone() }); }
// Sonnenstrahlen durchs Fenster (zwei gekreuzte Lichtbahnen) + Staub im Licht
const shaftTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.25, 'rgba(0,0,0,0)'); gx.addColorStop(0.75, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, h); });
const shaftM = new THREE.MeshBasicMaterial({ map: shaftTex, color: '#ffe9c8', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const SHAFT = new THREE.Group(); scene.add(SHAFT);
for (const rz of [0, Math.PI / 2]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 9), shaftM); pl.geometry.translate(0, -4.5, 0); pl.rotation.y = rz; SHAFT.add(pl); }
const DN = 260, dpos = new Float32Array(DN * 3), D0 = [];
for (let i = 0; i < DN; i++) D0.push([-4.6 + R() * 5.6, 0.4 + R() * 6.5, -4.0 + R() * 4.6, R() * 6.28, 0.05 + R() * 0.12]);
const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
const dotT = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ map: dotT, size: 0.045, color: '#fff2da', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); scene.add(dust);
function animEnv(t, day, sunDir) {
  const w = 2 * Math.PI * t / 8;
  for (const L of LEAVES) { L.l.rotation.copy(L.base); L.l.rotateX(0.04 * Math.sin(w * 2 + L.ph)); L.l.rotateZ(0.03 * Math.sin(w * 3 + L.ph * 1.7)); }
  for (let i = 0; i < DN; i++) { const d = D0[i]; dpos[i * 3] = d[0] + Math.sin(w + d[3]) * 0.25; dpos[i * 3 + 1] = d[1] + Math.sin(w * 2 + d[3] * 1.3) * d[4] * 3; dpos[i * 3 + 2] = d[2] + Math.cos(w + d[3]) * 0.2; }
  dGeo.attributes.position.needsUpdate = true; dust.material.opacity = 0.55 * day;
  SHAFT.position.set((WX0 + WX1) / 2, (WY0 + WY1) / 2, WALLZ - 0.1);
  SHAFT.quaternion.setFromUnitVectors(v3(0, -1, 0), sunDir.clone().normalize());
  shaftM.opacity = 0.075 * day;
}

// ---------- Tumbler (Storm Sea) ----------
const TB = makeTumbler('storm sea'); TB.group.rotation.y = -0.55; scene.add(TB.group);
const ENVT = makeEnv(r); scene.environment = ENVT; TB.steel.envMapIntensity = 1.0;
const cs = contactShadow(2.2, 0.35); cs.position.set(0, 0.005, 0); scene.add(cs);

// ---------- Licht: Sonne durchs Fenster, Himmel, Mond ----------
const sun = new THREE.DirectionalLight('#fff1dc', 3); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -4, near: 1, far: 40 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe0ff', '#3a2a1c', 0.5); scene.add(hemi);
const moon = new THREE.DirectionalLight('#7f98d8', 0.5); moon.position.set(-3.4, 7, -8); scene.add(moon);
const front = new THREE.DirectionalLight('#f4f1ec', 1.0); front.position.set(4, 6, 12); scene.add(front);
const lampL = new THREE.PointLight('#ffc98a', 0, 12, 1.6); lampL.position.set(3.2, 3.2, 1.6); scene.add(lampL);   // Raumlicht abends
const tod = (t) => { const u = (((t - 0.4) % 8) + 8) % 8; return u < 6.6 ? 7 + u * 12 / 6.6 : (19 + (u - 6.6) * 12 / 1.4) % 24; };   // 7-19 Uhr in 6,6 s, Nacht im Schnelldurchlauf   // 8 s = 24 h, t = 0 -> 7 Uhr
function setDay(t) {
  const h = tod(t);
  const day = clamp(Math.sin(Math.PI * (h - 6) / 14));                 // 6..20 Uhr
  const low = 1 - clamp(Math.sin(Math.PI * (h - 6) / 14) * 2.2);       // tiefe Sonne = warm
  const az = lerp(-0.9, 0.9, clamp((h - 6) / 14));                     // wandert von links nach rechts
  sun.position.set(-3.4 + Math.sin(az) * 6, 2.0 + 6 * day, WALLZ - 9 + Math.cos(az) * 1.5);
  sun.color.set('#fff1dc').lerp(new THREE.Color('#ff9a52'), low * 0.85);
  sun.intensity = 3.4 * clamp(day * 1.6);
  hemi.intensity = 0.12 + 0.5 * day; hemi.color.set('#cfe0ff').lerp(new THREE.Color('#5d6fa8'), 1 - day);
  const night = 1 - clamp(day * 3);
  moon.intensity = 0.9 * night;
  const eve = clamp((h - 19.2) / 0.8) * clamp((23.5 - h) / 0.8) + clamp((6.6 - h) / 0.6) * clamp((h - 5.2) / 0.6);   // Raumlicht abends + früh
  lampL.intensity = 14 * eve + 6 * night; front.intensity = 0.9 + 0.6 * day + 0.5 * night;
  drawSky(h);
  scene.environmentIntensity = 0.12 + 0.3 * day;
  const sunDir = sun.target.position.clone().sub(sun.position); animEnv(t, clamp(day * 1.3) * (1 - low * 0.3), sunDir);
  LAP.userData.screen.material.emissiveIntensity = 0.25 + 0.5 * (1 - day);
  const ang = (h / 12) * Math.PI * 2; CLK.userData.hh.rotation.z = -ang; CLK.userData.mh.rotation.z = -h * Math.PI * 2;
  scene.background = new THREE.Color('#0a0c14');
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Tumbler'),
  hook: mk('tt', 'Heute Morgen<br>um 7 eingefüllt.', 300),
  b: mk('tt', 'Isoliert.<br>Bis zu 12 Stunden.', 300),
  c: mk('tt', 'Mit Griff<br>und Strohhalm.', 300),
  p: mk('tt big', '24,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.06, vig: 'rgba(4,8,14,.45)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 3.0, 'weit'], [3.0, 4.7, 'nah'], [4.7, 6.1, 'griff'], [6.1, 7.6, 'preis'], [7.6, 8.4, 'weit2']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.02 * a);
function shoot(t, pos, tgt, a = 1, fov = 30) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
const weitCam = (u) => { const a = 0.22 - 0.05 * u, Rr = 20.5 - 1.2 * u; return [v3(Math.sin(a) * Rr - 0.6, 4.0, Math.cos(a) * Rr), v3(-0.6, 2.9, -1.5)]; };

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  const tl = name === 'weit2' ? t - 8 : t;
  setDay(tl);
  if (name === 'weit' || name === 'weit2') { const [p, q] = weitCam(tl); shoot(t, p, q, 0.6, 30); }
  else if (name === 'nah') { const a = lerp(0.9, 1.15, ease.inOut(sp)); shoot(t, v3(Math.sin(a) * 4.2, 5.4 - 0.2 * sp, Math.cos(a) * 4.2), v3(0, 3.15, 0), 0.3, 32); }
  else if (name === 'griff') { const a = lerp(-0.25, -0.45, ease.inOut(sp)); shoot(t, v3(Math.sin(a) * 7.6, 0.8, Math.cos(a) * 7.6), v3(-0.3, 2.65, 0), 0.4, 32); }
  else { const a = lerp(-0.8, -0.9, ease.out(sp)); shoot(t, v3(Math.sin(a) * 9.6, 4.6, Math.cos(a) * 9.6), v3(-0.4, 2.6, -0.4), 0.4, 32); }
  scene.updateMatrixWorld(true);
  // ---------- Overlay ----------
  tx.pill.style.opacity = 1; tx.word.style.opacity = 1;
  tx.hook.style.transform = 'none';
  tx.hook.style.opacity = t < 3.0 ? 1 : (t >= 7.6 ? 1 : 0);
  pop(tx.b, t >= 3.45 && t < 4.7 ? t - 3.45 : -1, seg(t, 4.62, 4.7));
  pop(tx.c, t >= 4.8 && t < 6.1 ? t - 4.8 : -1, seg(t, 6.02, 6.1));
  pop(tx.p, t >= 6.15 && t < 7.6 ? t - 6.15 : -1, seg(t, 7.52, 7.6));
  pop(tx.cta, t >= 6.5 && t < 7.6 ? t - 6.5 : -1, seg(t, 7.52, 7.6));
  O.grain(Math.round(t * 30), 1);
  const fp = name === 'nah' ? v3(0, lerp(3.2, 2.6, ease.inOut(sp)), 0) : v3(0, 2.2, 0);
  const ap = name === 'nah' ? 0.0022 : name === 'griff' ? 0.0016 : name === 'preis' ? 0.0011 : 0.0008;
  P.focus(cam.position.distanceTo(fp), ap, 0.008);
  P.render();
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
