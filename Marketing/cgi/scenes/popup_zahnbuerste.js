// Maios CGI – Elektrische Schallzahnbürste (Produkt 57), Pop-up-Buch aus Papier, Story 20,5 s.
// Neuer Stil: ein aufgeklapptes Pop-up-Buch (90°): hintere Seite steht als Kulisse, vordere liegt als Bühne. Jede Seite, die umgeblättert wird,
// klappt nach vorn und gibt die nächste Doppelseite frei; Papierelemente richten sich aus der Falz auf. Die Zahnbürste selbst ist echt (glänzend).
// Seiten: Sanduhr-Hook -> Schwingungen -> Timer 4 x 30 s -> 5 Putzmodi -> IPX7 (Wellen) -> 2 Ersatzköpfe -> Schwarz/Weiss + Preis -> Link.
import * as THREE from 'three';
import { makeRenderer, makeEnv, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import { makePostPro } from '../lib/post_pro.js';
import { makeZahnbuerste, makeErsatzkopf } from '../lib/zahnbuerste_models.js';

const style = document.createElement('style');
style.textContent = `
@font-face{font-family:'Manrope';src:url(fonts/manrope-latin.woff2) format('woff2');font-weight:200 800}
@font-face{font-family:'Manrope';src:url(fonts/manrope-latin-ext.woff2) format('woff2');font-weight:200 800;unicode-range:U+0100-02BA,U+20A0-20C0}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000}
#stage,#ov{position:absolute;inset:0} #stage canvas{display:block}
#ov{pointer-events:none;font-family:Manrope,sans-serif}
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(20,30,50,.55)}
.tword{position:absolute;top:208px;padding:7px 14px 6px;border-radius:12px;background:rgba(20,30,50,.55);font:700 32px Manrope;color:#fff}
.strip{position:absolute;left:0;width:1080px;text-align:center}
.strip span{display:inline-block;max-width:660px;font:800 58px/1.14 Manrope;color:#16233a;background:#fffaf0;padding:22px 40px 26px;
  clip-path:polygon(0 6%,4% 0,12% 4%,22% 0,33% 5%,45% 1%,57% 4%,68% 0,79% 5%,90% 1%,100% 4%,98% 50%,100% 96%,91% 100%,80% 95%,68% 100%,56% 96%,44% 100%,32% 95%,21% 100%,10% 96%,0 100%,2% 50%);
  filter:drop-shadow(0 8px 10px rgba(0,0,0,.35))}
.strip.y span{background:#ffe08a}
.price{position:absolute;left:0;width:1080px;text-align:center}
.price span{display:inline-block;font:800 156px/1 Manrope;color:#fffaf0;background:#e2574c;padding:24px 52px 30px;letter-spacing:-.02em;
  clip-path:polygon(0 3%,8% 0,20% 3%,35% 0,50% 3%,65% 0,80% 3%,92% 0,100% 4%,99% 50%,100% 97%,88% 100%,72% 97%,56% 100%,40% 97%,24% 100%,10% 97%,0 100%,1% 50%)}
.cta{position:absolute;left:290px;width:500px;text-align:center;font:800 46px Manrope;color:#16233a;background:#fffaf0;border-radius:6px;padding:22px 0;box-shadow:0 8px 16px rgba(0,0,0,.3)}
`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope', '600 30px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 40px Manrope', 'ßüÜäÄöÖ€·?:');

const r = makeRenderer(); r.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a3550');
const cam = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.02, 80);
const ENV = makeEnv(r); scene.environment = ENV; scene.environmentIntensity = 0.3;
const P = makePostPro(r, scene, cam, { bloom: [0.1, 0.5, 0.95], ao: false, grade: { uWarm: 0.03, uVig: 0.34, uContrast: 0.08 } });
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const R = rng(5757);

// ---------- Papier ----------
const fiber = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) { g.strokeStyle = `rgba(${R() < 0.5 ? '60,60,60' : '200,200,200'},.12)`; g.lineWidth = 0.6 + R(); g.beginPath(); const x = R() * w, y = R() * h, a = R() * 6.3, l = 4 + R() * 14; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } }, false);
fiber.wrapS = fiber.wrapT = THREE.RepeatWrapping; fiber.repeat.set(2, 2);
const paperMat = (map, alpha = false) => new THREE.MeshStandardMaterial({ map, roughness: 0.92, bumpMap: fiber, bumpScale: 0.6, side: THREE.DoubleSide, transparent: false, alphaTest: alpha ? 0.5 : 0 });
const paperTex = (w, h, draw) => canvasTex(w, h, (g) => { draw(g, w, h); g.globalAlpha = 0.08; for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.5 ? '#fff' : '#000'; g.fillRect(R() * w, R() * h, 2, 2); } g.globalAlpha = 1; });
const flat = (col) => paperTex(64, 64, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); });
// Ausgeschnittene Papierfigur aus einer Zeichenfunktion (Alpha = Schnittkante), mit Papierdicke als Rand
function cutout(w, h, pxw, pxh, draw, col = null) {
  const t = paperTex(pxw, pxh, (g) => { g.clearRect(0, 0, pxw, pxh); draw(g, pxw, pxh); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paperMat(t, true)); m.castShadow = true; m.receiveShadow = true;
  m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5 });
  const grp = new THREE.Group(); m.position.y = h / 2; grp.add(m); return grp;
}

// ---------- Buch (90° offen): Falz entlang x bei y=0, z=0; Kulisse steht (y>0, z<0), Bühne liegt (z>0) ----------
const BW = 3.6, BH = 4.2;   // Seitenbreite (x) und -höhe
const BOOK = new THREE.Group(); scene.add(BOOK);
const cover = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.25, 0.08, BH + 0.2), new THREE.MeshStandardMaterial({ color: '#7a2f2a', roughness: 0.7, bumpMap: fiber, bumpScale: 0.4 })); cover.position.set(0, -0.06, BH / 2); cover.receiveShadow = true; BOOK.add(cover);
const coverB = cover.clone(); coverB.rotation.x = Math.PI / 2; coverB.position.set(0, BH / 2, -0.06); BOOK.add(coverB);
const pageStack = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.05, BH), new THREE.MeshStandardMaterial({ color: '#f3ece0', roughness: 0.9 })); pageStack.position.set(0, -0.01, BH / 2); pageStack.receiveShadow = true; BOOK.add(pageStack);
const desk = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#3a4a6a', roughness: 0.85 })); desk.rotation.x = -Math.PI / 2; desk.position.y = -0.1; desk.receiveShadow = true; scene.add(desk);

// Doppelseiten: Hintergrund (Kulisse) und Boden (Bühne) als Canvas-Texturen
const COL = { navy: '#1f3358', coral: '#f08a6c', mint: '#9fd8c5', sun: '#ffd36b', cream: '#fbf3e4', blue: '#5aa7e0', lilac: '#b7a6e8', pink: '#f7b6c4' };
function backTex(base, deco) { return paperTex(512, 600, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); if (deco) deco(g, w, h); }); }
const sunburst = (c1) => (g, w, h) => { g.save(); g.translate(w / 2, h * 0.62); for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.fillStyle = i % 2 ? c1 : 'rgba(0,0,0,0)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-60, -800); g.lineTo(60, -800); g.fill(); } g.restore(); };
const dots = (c) => (g, w, h) => { g.fillStyle = c; for (let y = 20; y < h; y += 46) for (let x = 20 + (y % 92 ? 23 : 0); x < w; x += 46) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); } };
const SPREADS = [
  { back: backTex(COL.navy, (g, w, h) => { g.fillStyle = '#2c4a7c'; g.fillRect(40, 40, w - 80, h * 0.55); g.fillStyle = '#d9e6f5'; g.globalAlpha = 0.25; g.fillRect(60, 60, w - 120, h * 0.5); g.globalAlpha = 1; }), floor: flat('#d8e3ee') },
  { back: backTex(COL.coral, sunburst('#f6a184')), floor: flat('#ffe1cf') },
  { back: backTex(COL.mint, dots('#86c7b1')), floor: flat('#e3f4ec') },
  { back: backTex(COL.lilac, (g, w, h) => { g.fillStyle = '#a593dc'; for (let i = 0; i < 6; i++) g.fillRect(0, i * 110 + 30, w, 40); }), floor: flat('#efe9fb') },
  { back: backTex('#cfe8f8', (g, w, h) => { g.fillStyle = '#a9d4f1'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(80 + i * 90, 90 + (i % 2) * 40, 34, 0, 7); g.fill(); } }), floor: flat('#2f7fc0') },
  { back: backTex(COL.sun, sunburst('#ffe39a')), floor: flat('#fff4d2') },
  { back: backTex(COL.pink, dots('#f39fb1')), floor: flat('#fde6eb') },
];
const BACKM = SPREADS.map((s) => paperMat(s.back)), FLOORM = SPREADS.map((s) => paperMat(s.floor));
const backPlane = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), BACKM[0]); backPlane.position.set(0, BH / 2, -0.005); backPlane.receiveShadow = true; BOOK.add(backPlane);
const floorPlane = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), FLOORM[0]); floorPlane.rotation.x = -Math.PI / 2; floorPlane.position.set(0, 0.02, BH / 2); floorPlane.receiveShadow = true; BOOK.add(floorPlane);
// Blatt, das umgeblättert wird: Vorderseite = alte Kulisse, Rückseite = neuer Boden; leicht gewölbt während der Bewegung
const LEAF = new THREE.Group(); BOOK.add(LEAF);
const leafGeo = new THREE.PlaneGeometry(BW, BH, 1, 24); leafGeo.translate(0, BH / 2, 0);
const leafBase = leafGeo.attributes.position.array.slice();
const leafF = new THREE.Mesh(leafGeo, BACKM[0]); leafF.castShadow = true; LEAF.add(leafF);
const leafB = new THREE.Mesh(leafGeo, FLOORM[1]); leafB.material = FLOORM[1]; leafB.scale.z = -1; LEAF.add(leafB);
leafF.material = BACKM[0];
function setLeaf(angle, from) {   // angle: 0 = steht (Kulisse), PI/2 = liegt auf der Bühne
  LEAF.visible = angle > 0.001 && angle < Math.PI / 2 - 0.001; LEAF.rotation.x = angle;
  leafF.material = BACKM[from]; leafB.material = FLOORM[Math.min(from + 1, SPREADS.length - 1)];
  const p = leafGeo.attributes.position; const bend = Math.sin(angle * 2) * 0.55;
  for (let i = 0; i < p.count; i++) { const y = leafBase[i * 3 + 1]; p.setZ(i, -bend * (y / BH) ** 2); }
  p.needsUpdate = true; leafGeo.computeVertexNormals();
}

// ---------- Pop-up-Elemente je Doppelseite (stehen an der Falz auf, Winkel folgt dem Blatt) ----------
const POP = SPREADS.map(() => { const g = new THREE.Group(); BOOK.add(g); return g; });
const hinge = (grp, obj, z) => { const h = new THREE.Group(); h.position.z = z; h.add(obj); grp.add(h); h.userData.pop = true; return h; };
// 0: Hook – Spiegel, Waschbecken, Sanduhr, Papierfigur mit alter Bürste
{ const g = POP[0];
  hinge(g, cutout(1.6, 2.0, 256, 320, (c, w, h) => { c.fillStyle = '#e8eef5'; c.beginPath(); c.roundRect(10, 10, w - 20, h - 20, 110); c.fill(); c.fillStyle = '#c2d3e6'; c.beginPath(); c.roundRect(30, 30, w - 60, h - 60, 95); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(60, 60, 18, 120); }), 0.3).children[0].position.set(-0.85, 1.4, 0);
  hinge(g, cutout(1.8, 1.0, 360, 200, (c, w, h) => { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, 20); c.lineTo(w, 20); c.lineTo(w - 50, h); c.lineTo(50, h); c.fill(); c.fillStyle = '#b8c4d2'; c.fillRect(w * 0.45, 0, 40, 26); }), 0.9).children[0].position.set(-0.8, 0, 0);
  const glass = hinge(g, cutout(0.9, 1.5, 180, 300, (c, w, h) => { c.fillStyle = '#ffd36b'; c.fillRect(10, 0, w - 20, 22); c.fillRect(10, h - 22, w - 20, 22); c.fillStyle = '#e9f3ff'; c.beginPath(); c.moveTo(25, 22); c.lineTo(w - 25, 22); c.lineTo(w / 2 + 10, h / 2); c.lineTo(w - 25, h - 22); c.lineTo(25, h - 22); c.lineTo(w / 2 - 10, h / 2); c.fill(); c.fillStyle = '#f0b44c'; c.beginPath(); c.moveTo(45, h - 22); c.lineTo(w - 45, h - 22); c.lineTo(w / 2, h * 0.62); c.fill(); c.font = '800 44px Manrope'; c.fillStyle = '#1f3358'; c.textAlign = 'center'; }), 1.2); glass.children[0].position.set(1.0, 0, 0); g.userData.glass = glass;
  const fig = hinge(g, new THREE.Group(), 1.7); g.userData.fig = fig;
  const bodyC = cutout(0.9, 1.9, 180, 380, (c, w, h) => { c.fillStyle = '#f0c29b'; c.beginPath(); c.arc(w / 2, 52, 46, 0, 7); c.fill(); c.fillStyle = '#2b2b3a'; c.beginPath(); c.arc(w / 2, 40, 48, Math.PI, 0); c.fill(); c.fillStyle = '#7a5cc4'; c.beginPath(); c.roundRect(25, 100, w - 50, 170, 30); c.fill(); c.fillStyle = '#334'; c.fillRect(42, 265, 36, 110); c.fillRect(w - 78, 265, 36, 110);
    c.fillStyle = '#1f2533'; c.beginPath(); c.arc(w / 2 - 15, 50, 5, 0, 7); c.arc(w / 2 + 15, 50, 5, 0, 7); c.fill(); });
  bodyC.position.x = 0.2; fig.children[0].add(bodyC);
  const arm = new THREE.Group(); arm.position.set(0.48, 1.55, 0.02); fig.children[0].add(arm);
  const armC = cutout(0.18, 0.62, 40, 140, (c, w, h) => { c.fillStyle = '#7a5cc4'; c.beginPath(); c.roundRect(4, 0, w - 8, h - 10, 14); c.fill(); c.fillStyle = '#f0c29b'; c.beginPath(); c.arc(w / 2, h - 14, 14, 0, 7); c.fill(); });
  armC.rotation.z = Math.PI; arm.add(armC);
  const oldB = cutout(0.08, 0.6, 20, 140, (c, w, h) => { c.fillStyle = '#5aa7e0'; c.fillRect(4, 0, w - 8, h); c.fillStyle = '#fff'; c.fillRect(0, 0, w, 30); }); oldB.position.set(0.05, -0.62, 0.01); oldB.rotation.z = 0.2; arm.add(oldB); g.userData.arm = arm;
}
// Echte Zahnbürsten
const ZB = makeZahnbuerste('schwarz', ENV); ZB.group.scale.setScalar(0.52); scene.add(ZB.group);
const ZW = makeZahnbuerste('weiss', ENV); ZW.group.scale.setScalar(0.52); scene.add(ZW.group);
const HEADS = [makeErsatzkopf('schwarz', ENV), makeErsatzkopf('schwarz', ENV)]; HEADS.forEach((h) => { h.group.scale.setScalar(0.52); scene.add(h.group); });
// 1: Schwingungslinien (Zickzack aus Papier) um den Kopf
{ const g = POP[1];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const z = cutout(0.5, 0.12, 200, 48, (c, w, h) => { c.strokeStyle = '#1f3358'; c.lineWidth = 12; c.lineJoin = 'round'; c.beginPath(); for (let x = 0; x <= w; x += 25) c.lineTo(x, x % 50 ? 8 : h - 8); c.stroke(); });
    const hh = hinge(g, z, 1.25); hh.children[0].position.set(s * (0.55 + i * 0.12), 2.5 + i * 0.35 - 0.35, 0); hh.children[0].rotation.z = s * (0.5 - i * 0.25); hh.userData.zig = [s, i]; }
  const cloud = cutout(2.6, 1.0, 520, 200, (c, w, h) => { c.fillStyle = '#fff4ec'; for (const [x, y, rr] of [[90, 120, 70], [190, 90, 90], [310, 100, 85], [420, 125, 65], [250, 150, 70]]) { c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill(); } });
  hinge(g, cloud, 0.25).children[0].position.set(0, 2.9, 0);
}
// 2: Timer-Uhr aus vier Viertelsegmenten
const QUADS = [];
{ const g = POP[2];
  const face = cutout(2.2, 2.2, 440, 440, (c, w, h) => { c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, 7); c.fill(); c.strokeStyle = '#1f3358'; c.lineWidth = 10; c.stroke(); c.fillStyle = '#1f3358'; for (let i = 0; i < 4; i++) { c.save(); c.translate(w / 2, h / 2); c.rotate(i * Math.PI / 2); c.fillRect(-6, -w / 2 + 14, 12, 34); c.restore(); } });
  const fh = hinge(g, face, 0.4); fh.children[0].position.set(0, 0.7, 0);
  const qcol = ['#f08a6c', '#ffd36b', '#9fd8c5', '#7aa6e8'];
  for (let i = 0; i < 4; i++) { const q = cutout(1.0, 1.0, 200, 200, (c, w, h) => { c.fillStyle = qcol[i]; c.beginPath(); c.moveTo(0, h); c.arc(0, h, w - 4, -Math.PI / 2, 0); c.closePath(); c.fill(); });
    const qq = new THREE.Group(); qq.position.set(0, 1.1, 0.02); qq.rotation.z = -i * Math.PI / 2; q.children[0].position.set(0.5, 0.5, 0); qq.add(q); fh.children[0].add(qq); QUADS.push(qq); }
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.02), new THREE.MeshStandardMaterial({ color: '#1f3358' })); hand.geometry.translate(0, 0.45, 0); hand.position.set(0, 1.1, 0.05); fh.children[0].add(hand); g.userData.hand = hand;
}
// 3: fünf Lesezeichen-Reiter mit den Modi
const TABS = [];
{ const g = POP[3]; const names = ['White', 'Clean', 'Sensitive', 'Polish', 'Massage']; const cols = ['#ffffff', '#9fd8c5', '#f7b6c4', '#ffd36b', '#9fb8f0'];
  names.forEach((n, i) => { const t = cutout(1.5, 0.42, 300, 84, (c, w, h) => { c.fillStyle = cols[i]; c.beginPath(); c.moveTo(0, 0); c.lineTo(w - 40, 0); c.lineTo(w, h / 2); c.lineTo(w - 40, h); c.lineTo(0, h); c.fill(); c.font = '800 44px Manrope'; c.fillStyle = '#16233a'; c.fillText(n, 22, 58); });
    t.position.set(-2.4, 2.75 - i * 0.48, 0.02); g.add(t); t.userData.i = i; TABS.push(t); });
}
// 4: Papierwellen (drei Lagen) mit Tropfen
const WAVES = [];
{ const g = POP[4]; const cols = ['#1e6fb0', '#3b8fd0', '#7cc0ef'];
  for (let i = 0; i < 3; i++) { const wv = cutout(4.6, 0.9, 920, 180, (c, w, h) => { c.fillStyle = cols[i]; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 10) c.lineTo(x, 50 + Math.sin(x / 60 + i) * 26); c.lineTo(w, h); c.fill(); });
    const hh = hinge(g, wv, 0.6 + i * 0.55); WAVES.push(hh); }
  for (let i = 0; i < 4; i++) { const d = cutout(0.22, 0.32, 60, 88, (c, w, h) => { c.fillStyle = '#bfe3fb'; c.beginPath(); c.moveTo(w / 2, 0); c.quadraticCurveTo(w, h * 0.65, w / 2, h); c.quadraticCurveTo(0, h * 0.65, w / 2, 0); c.fill(); });
    const hh = hinge(g, d, 0.9 + i * 0.3); hh.children[0].position.set(-1.1 + i * 0.75, 1.0, 0); hh.userData.drop = i; }
}
// 5/6: kleine Podeste aus Papier
const podest = (x, z, col) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.22, 40), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, bumpMap: fiber, bumpScale: 0.5 })); p.position.set(x, 0.11, z); p.castShadow = true; p.receiveShadow = true; return p; };
const PD5 = [podest(-0.95, 1.4, '#ffe39a'), podest(0, 1.4, '#ffe39a'), podest(0.95, 1.4, '#ffe39a')]; PD5.forEach((p) => POP[5].add(p));
const PD6 = [podest(-0.6, 1.3, '#f39fb1'), podest(0.6, 1.3, '#f39fb1')]; PD6.forEach((p) => POP[6].add(p));

// ---------- Licht ----------
const key = new THREE.DirectionalLight('#fff4e6', 2.4); key.position.set(-3, 7, 7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5;
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 6, bottom: -2, near: 1, far: 25 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key);
const fill = new THREE.HemisphereLight('#f4f7ff', '#4a3a3a', 0.85); scene.add(fill);
const rim = new THREE.DirectionalLight('#cfe0ff', 0.8); rim.position.set(4, 5, -4); scene.add(rim);

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = { pill: mk('tpill', 'Werbung', 208), word: mk('tword', 'Zahnbürste'),
  t0: mk('strip', '<span>Zwei Minuten können<br>lang sein.</span>', 290), t1: mk('strip y', '<span>Bis zu 40.000 Schwingungen<br>pro Minute.</span>', 290),
  t2: mk('strip', '<span>2-Minuten-Timer,<br>30-Sekunden-Intervall.</span>', 290), t3: mk('strip y', '<span>5 Putzmodi.</span>', 290),
  t4: mk('strip', '<span>Wasserdicht<br>nach IPX7.</span>', 290), t5: mk('strip y', '<span>Mit 2 Ersatz-<br>bürstenköpfen.</span>', 290),
  p: mk('price', '<span>18,99&nbsp;€</span>', 280), t6: mk('strip y', '<span>Schwarz oder Weiß?</span>', 510), cta: mk('cta', 'Link im Profil', 520) };
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function slap(d, tl, out = 0, rot = 0) { if (tl < 0) { d.style.opacity = 0; return; } const k = ease.outBack(seg(tl, 0, 0.28)); d.style.opacity = clamp(tl / 0.06) * (1 - out); d.style.transform = `translateY(${lerp(-40, 0, k)}px) rotate(${rot}deg) scale(${lerp(0.9, 1, k)})`; }

// ---------- Zeitplan ----------
export const DAUER = 20.5;
const TURN = [3.0, 5.8, 8.6, 11.4, 14.2, 17.0];   // Umblättern beginnt (Dauer 0,55 s)
const TD = 0.55;
const shake = (t, a = 1) => v3(Math.sin(t * 1.3) * 0.5 + Math.sin(t * 3.1 + 1) * 0.2, Math.sin(t * 1.7 + 2) * 0.4, 0).multiplyScalar(0.02 * a);
function shoot(t, pos, tgt, fov = 32, a = 1) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.5))); }
const spring = (x) => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.cos(x * Math.PI * 2.2) * Math.exp(-x * 5.5) * (1 - x) - (1 - x) * 0;
function popAngle(grpIdx, t) {   // 0 = flach, 1 = steht
  const start = grpIdx === 0 ? -1 : TURN[grpIdx - 1];
  const end = grpIdx < TURN.length ? TURN[grpIdx] : 99;
  const up = grpIdx === 0 ? 1 : spring(seg(t, start + TD, start + TD + 0.8));
  const down = 1 - ease.in(seg(t, end, end + TD * 0.32));
  return clamp(up) * down;
}

function frame(t) {
  // Seite, Blatt
  let cur = 0; for (let i = 0; i < TURN.length; i++) if (t >= TURN[i] + TD) cur = i + 1;
  const turning = TURN.findIndex((T) => t >= T && t < T + TD);
  backPlane.material = BACKM[turning >= 0 ? turning + 1 : cur]; floorPlane.material = FLOORM[turning >= 0 ? turning : cur];
  if (turning >= 0) { const k = ease.inOut(seg(t, TURN[turning], TURN[turning] + TD)); setLeaf(k * Math.PI / 2, turning); } else setLeaf(0, 0);
  // Pop-ups aufrichten
  POP.forEach((g, i) => { const a = popAngle(i, t); g.visible = a > 0.01; g.children.forEach((h) => { if (h.userData.pop) h.rotation.x = -(1 - a) * Math.PI / 2; else { h.scale.y = Math.max(0.01, a); } }); });
  // Echte Bürsten: Sichtbarkeit und Haltung je Seite
  ZB.group.visible = ZW.group.visible = false; HEADS.forEach((h) => (h.group.visible = false));
  const SC = 0.42; const stand = (obj, x, z, a, ry = 0) => { obj.group.visible = a > 0.02; obj.group.position.set(x, 0.0 + (1 - a) * -1.2, z); obj.group.rotation.set(0, ry, 0); obj.group.scale.setScalar(SC * Math.max(0.01, a)); };
  let FP = v3(0, 1.4, 0.8), AP = 0.001;
  if (cur === 0 && turning < 0) {   // Hook: Figur putzt gelangweilt, Sanduhr dreht sich
    const g = POP[0]; g.userData.arm.rotation.z = 0.35 + Math.sin(t * 9) * 0.25; g.userData.glass.children[0].rotation.z = Math.sin(t * 1.3) * 0.04;
    g.userData.fig.children[0].rotation.y = 0.25 + Math.sin(t * 2) * 0.05;
    shoot(t, vlerp(v3(0.5, 3.6, 10.2), v3(0.3, 3.4, 9.4), seg(t, 0, 3)), v3(0.1, 1.55, 0.7), 32, 0.6); FP = v3(0.3, 1.2, 1.4);
  }
  const pa = (i) => popAngle(i, t);
  if (pa(1) > 0.02) { stand(ZB, 0, 1.1, pa(1)); ZB.neck.position.x = Math.sin(t * 90) * 0.012;
    POP[1].children.forEach((h) => { if (h.userData.zig) { const [s, i] = h.userData.zig; h.children[0].position.x = s * (0.55 + i * 0.12 + Math.abs(Math.sin(t * 14 + i)) * 0.06); } }); }
  if (pa(2) > 0.02) { const tt = seg(t, 6.4, 8.3); QUADS.forEach((q, i) => { const k = ease.outBack(seg(tt, i / 4, i / 4 + 0.18)); q.scale.setScalar(Math.max(0.001, k)); }); POP[2].userData.hand.rotation.z = -tt * Math.PI * 2; }
  if (pa(3) > 0.02) { stand(ZB, 0.6, 1.5, pa(3), -0.4); TABS.forEach((tb) => { const k = ease.outBack(seg(t, 9.25 + tb.userData.i * 0.2, 9.6 + tb.userData.i * 0.2)); tb.position.x = lerp(-2.4, -0.78, k) + (1 - pa(3)) * -2; }); }
  if (pa(4) > 0.02) { stand(ZB, 0.15, 1.45, pa(4), 0.3); ZB.group.position.y += Math.sin(t * 3) * 0.04; WAVES.forEach((w, i) => (w.children[0].position.x = Math.sin(t * 1.6 + i * 1.3) * 0.18));
    POP[4].children.forEach((h) => { if (h.userData.drop != null) h.children[0].position.y = 1.0 + ((t * 0.9 + h.userData.drop * 0.27) % 1) * 1.2; }); }
  if (pa(5) > 0.02) { stand(ZB, 0, 1.4, pa(5)); ZB.group.position.y += 0.22; const ah = [ease.outBack(seg(t, 15.0, 15.4)), ease.outBack(seg(t, 15.3, 15.7))];
    HEADS.forEach((h, i) => { h.group.visible = ah[i] > 0.02; h.group.position.set(i ? 0.95 : -0.95, 0.22 + 0.13, 1.4); h.group.scale.setScalar(0.42 * Math.max(0.01, ah[i] * pa(5))); h.group.rotation.y = i ? -0.3 : 0.3; }); }
  if (pa(6) > 0.02) { stand(ZB, -0.6, 1.3, pa(6), 0.2); stand(ZW, 0.6, 1.3, pa(6), -0.2); ZB.group.position.y += 0.22; ZW.group.position.y += 0.22; }
  // Kamera je Seite
  if (cur >= 1 || turning >= 0) {
    const c = turning >= 0 ? turning + 1 : cur;
    if (c === 1) { shoot(t, v3(-0.6, 3.0, 9.6), v3(0, 1.75, 0.9), 32); FP = v3(0, 2.4, 1.1); AP = 0.0016; }
    else if (c === 2) { shoot(t, v3(0.5, 3.0, 9.4), v3(0, 1.75, 0.5), 32); FP = v3(0, 1.9, 0.4); }
    else if (c === 3) { shoot(t, v3(-0.4, 3.0, 9.6), v3(0, 1.75, 0.7), 32); FP = v3(0.3, 1.6, 1.2); }
    else if (c === 4) { shoot(t, v3(0.9, 2.8, 9.2), v3(0.1, 1.6, 1.1), 32); FP = v3(0.15, 1.2, 1.4); AP = 0.0016; }
    else if (c === 5) { shoot(t, v3(-0.3, 2.8, 9.2), v3(0, 1.55, 1.1), 32); FP = v3(0, 1.0, 1.4); }
    else if (t < 19.5) { shoot(t, v3(lerp(0.4, 0.1, seg(t, 17.5, 19.4)), 2.8, 9.4), v3(0, 1.95, 1.0), 32); FP = v3(0, 1.2, 1.3); }
    else { shoot(t, v3(1.6, 2.2, 8.0), v3(0.1, 2.25, 1.2), 30); FP = v3(0.3, 1.3, 1.3); AP = 0.0018; }
  }
  // ---------- Overlay ----------
  tx.pill.style.opacity = 1; tx.word.style.opacity = t < 3.2 || t >= 17.2 ? 1 : 0;
  const w = (a, b) => (t >= a && t < b ? t - a : -1);
  slap(tx.t0, w(0.15, 3.0), 0, -1.5); slap(tx.t1, w(3.75, 5.8), 0, 1); slap(tx.t2, w(6.45, 8.6), 0, -1); slap(tx.t3, w(9.2, 11.4), 0, 1.5);
  slap(tx.t4, w(12.0, 14.2), 0, -1); slap(tx.t5, w(14.8, 17.0), 0, 1); slap(tx.p, w(17.6, 99), 0, -2); slap(tx.t6, w(18.0, 19.5), 0, 1.5); slap(tx.cta, w(19.5, 99), 0, -1);
  scene.updateMatrixWorld(true); cam.updateMatrixWorld();
  P.focus(cam.position.distanceTo(FP), AP, 0.01);
  P.render();
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
