// Maios CGI – Mo-Story "3 Uhr nachts" mit Erzählerstimme (Test 1 von 2), Nachtlichter mit Bewegungsmelder (Produkt 25), 22,4 s.
// Ablauf: Mo schreckt im Bett hoch -> steht in der Tür, Flur stockdunkel -> Bodenperspektive: Lego im Dunkeln ->
// Mo tastet mit ausgestreckten Armen -> Nachtlicht an der Wand, Mo läuft vorbei, Licht geht an -> Flur leuchtet,
// Mo steigt übers Lego, zweites Licht geht an -> zurück im Bett -> Produkt nah + Preis -> Link (Abbinder 1 s)
// Regeln ab 28.10.: Hook ohne Auflösung in 0-3 s, Bewegung ab Bild 0, Produktwort klein neben der Pille, Handy-Look.
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, canvasTex } from '../lib/core.js';
import * as KM from '../lib/kugel_models.js';
import * as N from '../lib/nachtlicht_models.js';
import { makeKid, toon } from '../lib/figur.js';

// ---------- Overlay (Handy-Look) ----------
const style = document.createElement('style');
style.textContent = `
@font-face{font-family:'Manrope';src:url(fonts/manrope-latin.woff2) format('woff2');font-weight:200 800}
@font-face{font-family:'Manrope';src:url(fonts/manrope-latin-ext.woff2) format('woff2');font-weight:200 800;unicode-range:U+0100-02BA,U+20A0-20C0}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000}
#stage,#ov{position:absolute;inset:0} #stage canvas{display:block}
#ov{pointer-events:none;font-family:Manrope,sans-serif}
.tt{position:absolute;left:70px;width:800px;text-align:center;font:800 70px Manrope;line-height:1.15;color:#fff;
  text-shadow:0 0 4px #000,0 0 4px #000,0 3px 8px rgba(0,0,0,.8)}
.tt .y{color:#ffd86b}
.big{font-size:132px}
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(0,0,0,.42)}
.pw{position:absolute;left:318px;top:212px;font:700 30px Manrope;color:#fff;padding:7px 16px 6px;border-radius:12px;background:rgba(0,0,0,.30);text-shadow:0 1px 4px rgba(0,0,0,.6)}
.cta{position:absolute;left:250px;width:440px;text-align:center;font:800 46px Manrope;color:#111;background:#fff;border-radius:18px;padding:22px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.zzz{position:absolute;font:800 64px Manrope;color:#fff;text-shadow:0 0 10px rgba(255,210,140,.8)}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 45%,rgba(0,0,0,.6) 100%)}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 40px Manrope', 'ßüöä€…');
const ov = document.getElementById('ov');
const mk = (cls, html, top, extra = {}) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; d.style.top = top + 'px'; Object.assign(d.style, extra); d.style.opacity = 0; ov.appendChild(d); return d; };
const vig = document.createElement('div'); vig.id = 'vig'; ov.appendChild(vig);

const r = makeRenderer();
r.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#05070d');
const cam = new THREE.PerspectiveCamera(34, 1080 / 1920, 0.05, 120);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };

// ---------- Schlafzimmer (z > 0) + Flur (z < 0) ----------
const wallC = canvasTex(1024, 512, (g, w, h) => { g.fillStyle = '#7d8fb8'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.06)'; for (let x = 0; x < w; x += 80) g.fillRect(x, 0, 30, h); });
wallC.wrapS = THREE.RepeatWrapping; wallC.repeat.set(3, 1);
const roomWall = toon('#ffffff', { map: wallC });
const hallWall = toon('#a89a88');
const floorT = KM.woodTex(9, '#b98a5e', [140, 98, 64]); floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(5, 8);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 60), toon('#ffffff', { map: floorT })); floor.rotation.x = -Math.PI / 2; floor.position.z = -6; floor.receiveShadow = true; scene.add(floor);
const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; scene.add(b); return b; };
// Wand mit Türöffnung bei z = 0 (Tür x -1.6..1.6, Höhe 7)
box(7.0, 12, 0.4, roomWall, -5.1, 6, 0.2); box(7.0, 12, 0.4, roomWall, 5.1, 6, 0.2); box(3.2, 5, 0.4, roomWall, 0, 9.5, 0.2);
const trim = toon('#f1ece2');
box(0.25, 7.1, 0.5, trim, -1.72, 3.55, 0.2); box(0.25, 7.1, 0.5, trim, 1.72, 3.55, 0.2); box(3.7, 0.25, 0.5, trim, 0, 7.1, 0.2);
// Seitenwand links mit Fenster (Mond)
const sideL = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), roomWall); sideL.position.set(-8.5, 6, 6); sideL.rotation.y = Math.PI / 2; sideL.receiveShadow = true; scene.add(sideL);
const sideR = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), roomWall); sideR.position.set(8.5, 6, 6); sideR.rotation.y = -Math.PI / 2; sideR.receiveShadow = true; scene.add(sideR);
// Flur: Wände x = ±2.4, Ende bei z = -19 mit Badtür
const hl = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), hallWall); hl.position.set(-2.4, 5, -9.6); hl.rotation.y = Math.PI / 2; hl.receiveShadow = hl.castShadow = true; scene.add(hl);
const hr = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), hallWall); hr.position.set(2.4, 5, -9.6); hr.rotation.y = -Math.PI / 2; hr.receiveShadow = hr.castShadow = true; scene.add(hr);
const hend = new THREE.Mesh(new THREE.PlaneGeometry(5, 10), hallWall); hend.position.set(0, 5, -19.4); hend.receiveShadow = true; scene.add(hend);
const ceilH = new THREE.Mesh(new THREE.PlaneGeometry(5, 20), toon('#cfc6b8')); ceilH.position.set(0, 9.2, -9.6); ceilH.rotation.x = Math.PI / 2; ceilH.castShadow = true; scene.add(ceilH);
box(2.8, 6.6, 0.12, toon('#f3efe8'), 0, 3.3, -19.3);                                  // Badtür
box(0.12, 0.12, 0.3, toon('#c9c2b4'), 0.95, 3.2, -19.2);                              // Klinke
// Lichtschalter ganz hinten (nur Requisite)
box(0.42, 0.42, 0.08, toon('#f6f3ee'), 2.36, 4.4, -17.6).rotation.y = -Math.PI / 2;
// Läufer im Flur
const rugT = canvasTex(128, 512, (g, w, h) => { g.fillStyle = '#5f7d94'; g.fillRect(0, 0, w, h); g.fillStyle = '#7f9db2'; for (let y = 16; y < h; y += 48) g.fillRect(8, y, w - 16, 10); });
const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 13), toon('#ffffff', { map: rugT })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.01, -9.5); rug.receiveShadow = true; scene.add(rug);
// Fensterlicht (Mond) im Schlafzimmer
const win = new THREE.Group(); win.position.set(-8.45, 5.2, 6.5); win.rotation.y = Math.PI / 2; scene.add(win);
{ const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d1b3d'); gr.addColorStop(1, '#2a4378'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(80, 70, 30, 0, 7); g.fill(); g.fillStyle = '#ffffff'; for (let i = 0; i < 30; i++) g.fillRect((i * 97) % w, (i * 53) % h, 2, 2); }) }));
  win.add(sky); const fr = toon('#e9e4da');
  for (const [w, h, x, y] of [[3.3, 0.16, 0, 1.55], [3.3, 0.16, 0, -1.55], [0.16, 3.2, -1.57, 0], [0.16, 3.2, 1.57, 0], [0.1, 3.0, 0, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), fr); b.position.set(x, y, 0.05); win.add(b); } }
// Bett rechts, Kopfende an der Türwand
const BX = 4.4, BZ = 4.2;
const woodM = toon('#a8744a');
box(3.8, 1.0, 7.0, woodM, BX, 0.5, BZ); box(4.0, 3.2, 0.35, woodM, BX, 1.6, 0.65);
box(3.6, 0.6, 6.6, toon('#f4f1ea'), BX, 1.3, BZ);
const pil = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), toon('#ffffff')); pil.scale.set(1.4, 0.38, 0.7); pil.position.set(BX, 1.85, 1.6); pil.castShadow = true; scene.add(pil);
const quiltT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5aa58f'; g.fillRect(0, 0, w, h); g.fillStyle = '#8cc7b0'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64); });
const quiltM = toon('#ffffff', { map: quiltT });
const blanket = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.5, 4.9, 8, 2, 8), quiltM); blanket.position.set(BX, 1.75, BZ + 1.0); blanket.castShadow = blanket.receiveShadow = true; scene.add(blanket);
// Teddy auf dem Boden + Stuhl (Zimmer lebt)
{ const ted = toon('#b07a4a'); const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), ted); b.position.set(-3.5, 0.45, 5.2); b.castShadow = true; scene.add(b);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), ted); h.position.set(-3.5, 1.05, 5.2); h.castShadow = true; scene.add(h);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), ted); e.position.set(-3.5 + s * 0.22, 1.3, 5.2); scene.add(e); } }

// ---------- Lego im Flur ----------
const lego = new THREE.Group(); lego.position.set(0.5, 0, -8.6); scene.add(lego);
function brick(color, x, z, ry, nx = 4) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.6 });
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; lego.add(g);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.2 * nx, 0.24, 0.4), m); b.position.y = 0.12; b.castShadow = true; g.add(b);
  for (let i = 0; i < nx; i++) for (let j = 0; j < 2; j++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 16), m); s.position.set(-0.1 * (nx - 1) + i * 0.2, 0.27, -0.1 + j * 0.2); s.castShadow = true; g.add(s); }
}
brick('#d8261f', 0, 0, 0.4); brick('#1f5fd8', -0.55, 0.35, -0.7, 2); brick('#f2c318', 0.3, 0.6, 1.2, 2);

// ---------- Nachtlichter (Produkt 25) an der linken Flurwand ----------
const NLS = 5.0;
const nlA = N.makeNachtlicht(), nlB = N.makeNachtlicht(N.nussTex(33));
const NL_Y = 1.25;
for (const [nl, z] of [[nlA, -6.6], [nlB, -13.2]]) { nl.group.scale.setScalar(NLS); nl.group.position.set(-2.39, NL_Y, z); scene.add(nl.group); nl.pl.intensity = 0; nl.spot.intensity = 0; }
const glowA = new THREE.PointLight('#ffc98a', 0, 0, 1.6); glowA.position.set(-1.9, NL_Y + N.LIGHT_MID * NLS, -6.6); scene.add(glowA);
const glowB = new THREE.PointLight('#ffc98a', 0, 0, 1.6); glowB.position.set(-1.9, NL_Y + N.LIGHT_MID * NLS, -13.2); scene.add(glowB);
const poolA = new THREE.SpotLight('#ffd2a0', 0, 0, 1.2, 0.8, 1.4); poolA.position.copy(glowA.position); poolA.target.position.set(0.6, 0, -6.6); poolA.castShadow = true; poolA.shadow.mapSize.set(1024, 1024); poolA.shadow.bias = -0.002; scene.add(poolA, poolA.target);
const poolB = new THREE.SpotLight('#ffd2a0', 0, 0, 1.2, 0.8, 1.4); poolB.position.copy(glowB.position); poolB.target.position.set(0.6, 0, -13.2); scene.add(poolB, poolB.target);
const haloT = KM.glowTex();
const mkHalo = (z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: haloT, color: '#ffb866', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); m.position.set(-2.37, NL_Y + N.LIGHT_MID * NLS, z); m.rotation.y = Math.PI / 2; scene.add(m); return m; };
const haloA = mkHalo(-6.6), haloB = mkHalo(-13.2);
function lights(kA, kB) {
  nlA.setOn(kA); nlB.setOn(kB); nlA.pl.intensity = nlA.spot.intensity = nlB.pl.intensity = nlB.spot.intensity = 0;
  glowA.intensity = 9 * kA; poolA.intensity = 30 * kA; haloA.material.opacity = 0.5 * kA; haloA.visible = kA > 0.01;
  glowB.intensity = 9 * kB; poolB.intensity = 30 * kB; haloB.material.opacity = 0.5 * kB; haloB.visible = kB > 0.01;
}

// ---------- Mo (mit Beinen zum Laufen) ----------
const K = makeKid(); scene.add(K.group);
const pjM = K.torso.material, skinM = K.arms[0].children[1].material;
const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.3 * s, 0.25, 0); K.group.add(p);
  const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.6, 6, 12), pjM); l.position.y = -0.5; l.castShadow = true; p.add(l);
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), skinM); f.scale.set(1, 0.6, 1.5); f.position.set(0, -1.02, 0.1); f.castShadow = true; p.add(f); return p; });
const LEG = 1.2;
function walk(t, speed = 1, amp = 0.45) { const w = Math.sin(t * 7.5 * speed); legs[0].rotation.x = w * amp; legs[1].rotation.x = -w * amp; K.body.position.y = Math.abs(Math.cos(t * 7.5 * speed)) * 0.06; }
const zz = [0, 1, 2].map(() => mk('zzz', 'z', 0));

// ---------- Licht ----------
const hemi = new THREE.HemisphereLight('#8aa6ff', '#141a30', 0.55); scene.add(hemi);
const moon = new THREE.DirectionalLight('#9fbaff', 1.5); moon.position.set(-12, 9, 9); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
Object.assign(moon.shadow.camera, { left: -26, right: 26, top: 22, bottom: -10, near: 1, far: 70 }); moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.001; scene.add(moon, moon.target); moon.target.position.set(2, 1.5, 3);
const spill = new THREE.PointLight('#7f9cff', 0, 0, 1.3); spill.position.set(0, 5.5, 1.8); scene.add(spill);   // Mondlicht aus der Tür in den Flur
const rim = new THREE.PointLight('#a9bcff', 0, 0, 1.6); scene.add(rim);                                     // Kante an Mo im Dunkeln

const tx = {
  pill: mk('tpill', 'Werbung', 208),
  pw: mk('pw', 'Nachtlicht', 0, { top: '212px' }),
  s1: mk('tt', 'Drei Uhr nachts.<br>Ich muss mal.', 330),
  s2: mk('tt', 'Der Flur:<br><span class="y">stockdunkel.</span>', 330),
  s3: mk('tt', 'Irgendwo liegen Bausteine.', 330),
  s4: mk('tt', 'Lichtschalter?<br>Ganz hinten.', 330),
  s5: mk('tt', 'Dann ein Schritt …', 330),
  s6: mk('tt', '… und der Weg <span class="y">leuchtet.</span>', 330),
  s7: mk('tt', 'Bausteine gesehen.<br>Füße heil.', 330),
  p1: mk('tt', 'Nachtlicht mit<br>Bewegungsmelder', 300),
  p2: mk('tt big', '23,99&nbsp;€', 470),
  cta: mk('cta', 'Link im Profil', 655),
};
function pop(d, tl, out = 0) { if (tl < 0) { d.style.opacity = 0; return; } const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out); d.style.transform = `scale(${lerp(0.82, 1, p)})`; }

export const DAUER = 23.4;
const SHOTS = [[0, 2.8, 'bett'], [2.8, 5.4, 'tuer'], [5.4, 8.0, 'lego'], [8.0, 10.6, 'tasten'], [10.6, 13.2, 'sensor'],
  [13.2, 15.8, 'flur'], [15.8, 17.9, 'zurueck'], [17.9, 20.8, 'produkt'], [20.8, 23.4, 'produkt2']];
const ON_A = 11.55, ON_B = 15.0;
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, 0).multiplyScalar(0.03 * a);
function shoot(t, from, to, tgt, p, a = 1, fov = 34) { lens(fov); const s = shake(t, a); aim(cam, vlerp(from, to, p).add(s), tgt.clone().add(s.multiplyScalar(0.5))); }
const blinkAt = (t, at) => Math.max(0, 1 - Math.abs(t - at) / 0.09);
const blinks = (t, list) => list.reduce((m, a) => Math.max(m, blinkAt(t, a)), 0);

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  hemi.intensity = 0.55; moon.intensity = 1.5; spill.intensity = 0; rim.intensity = 0;
  const kA = ease.out(seg(t, ON_A, ON_A + 0.3)), kB = ease.out(seg(t, ON_B, ON_B + 0.3));
  lights(kA, kB);
  K.group.visible = true; K.group.rotation.set(0, 0, 0); K.body.position.set(0, 0, 0); legs.forEach((l) => { l.visible = true; l.rotation.set(0, 0, 0); });
  zz.forEach((z) => (z.style.opacity = 0));
  let kid = { look: [0, 0], blink: blinks(t, [1.6, 4.3, 9.4, 14.2]), eye: 1, mouth: 'flat', open: 0, brow: 0 };

  if (name === 'bett') {
    legs.forEach((l) => (l.visible = false));
    const up = ease.outBack(seg(t, 0, 0.55));
    K.group.position.set(BX, 1.6, 1.9); K.group.rotation.set(-1.15 * (1 - up), 0, 0);
    kid = { ...kid, look: [-0.8, 0.1], eye: 1.15, mouth: t > 1.2 ? 'frown' : 'o', open: 0.35, brow: -0.7, armL: 0.35, armR: 0.35, headTurn: -0.35 * ease.inOut(seg(t, 0.9, 1.5)) };
    shoot(t, v3(1.6, 5.4, 15.5), v3(1.9, 5.1, 13.8), v3(BX - 0.4, 3.0, 2.0), ease.out(sp), 0.6, 34);
  } else if (name === 'tuer') {
    K.group.position.set(0.2, LEG, 1.4); K.group.rotation.y = Math.PI;
    kid = { ...kid, headTurn: Math.sin((t - t0) * 2.2) * 0.45 };
    spill.intensity = 2.2; hemi.intensity = 0.22;
    shoot(t, v3(2.6, 4.6, 12.0), v3(2.1, 4.4, 10.2), v3(-0.2, 3.2, -8), ease.inOut(sp), 0.5, 34);
  } else if (name === 'lego') {
    const z = lerp(-1.6, -3.6, seg(t, t0, t1)); K.group.position.set(0.15, LEG, z); K.group.rotation.y = Math.PI; walk(t, 0.55, 0.35);
    kid = { ...kid, look: [0, -0.5], mouth: 'flat', brow: -0.4, armL: 0.5, armR: 0.5, fwd: 0.6 };
    spill.intensity = 4; hemi.intensity = 0.22;
    rim.position.set(0.9, 1.2, -9.5); rim.intensity = 1.6; rim.color.set('#9fb2ff');
    shoot(t, v3(1.45, 0.55, -12.2), v3(1.25, 0.5, -11.4), v3(0.0, 1.0, -5.0), ease.out(sp), 0.4, 36);
  } else if (name === 'tasten') {
    const z = lerp(-3.8, -5.2, seg(t, t0, t1)); K.group.position.set(0.0, LEG, z); K.group.rotation.y = Math.PI; walk(t, 0.45, 0.3);
    kid = { ...kid, look: [Math.sin(t * 2.5) * 0.7, 0.2], eye: 1.05, blink: 0.35, mouth: 'frown', brow: -0.8, armL: 0.1, armR: 0.1, fwd: 1.45, headTurn: Math.sin(t * 1.6) * 0.25 };
    spill.intensity = 3; hemi.intensity = 0.22;
    rim.position.set(1.8, 4.5, z - 3.2); rim.intensity = 3.5;
    shoot(t, v3(1.9, 4.2, -15.0), v3(1.75, 4.1, -14.0), v3(-0.1, 3.0, -4.5), ease.inOut(sp), 0.6, 32);
  } else if (name === 'sensor') {
    const z = lerp(-5.6, -7.4, seg(t, t0, t1)); K.group.position.set(-0.6, LEG, z); K.group.rotation.y = Math.PI; walk(t, 0.5, 0.35);
    kid = { ...kid, look: [-0.8, -0.2], eye: t > ON_A + 0.2 ? 1.15 : 1, mouth: t > ON_A + 0.3 ? 'o' : 'frown', open: 0.3, brow: t > ON_A + 0.3 ? 0.4 : -0.6, armL: 0.2, armR: 0.2, fwd: lerp(1.3, 0.3, seg(t, ON_A, ON_A + 0.6)) };
    spill.intensity = 3; hemi.intensity = 0.25;
    rim.position.set(0.8, 2.5, -9.0); rim.intensity = 2.0;
    const c = v3(-2.39, NL_Y + N.LIGHT_MID * NLS * 0.4, -6.6);
    shoot(t, v3(-0.35, 1.45, -9.4), v3(-0.55, 1.35, -8.9), c.clone().add(v3(0.3, 0.5, 0.0)), ease.inOut(sp), 0.25, 32);
  } else if (name === 'flur') {
    const p = seg(t, t0, t1); const z = lerp(-7.2, -10.6, p);
    const side = Math.sin(seg(t, t0 + 0.2, t0 + 1.9) * Math.PI);
    K.group.position.set(lerp(0.0, -1.2, side), LEG + side * 0.12, z); K.group.rotation.y = Math.PI + side * 0.25; walk(t, 0.75, 0.5 + side * 0.15);
    kid = { ...kid, look: [0, -0.4], mouth: 'smile', open: 0.3, brow: 0.6, armL: 0.6 * side + 0.25, armR: 0.6 * side + 0.25 };
    spill.intensity = 2.5; hemi.intensity = 0.25;
    shoot(t, v3(1.2, 6.4, 1.6), v3(1.0, 6.1, 0.2), v3(-0.3, 1.2, -13.0), ease.inOut(sp), 0.5, 36);
  } else if (name === 'zurueck') {
    legs.forEach((l) => (l.visible = false));
    const lie = ease.inOut(seg(t, t0 + 0.3, t0 + 1.4));
    K.group.position.set(BX, 1.6, lerp(1.9, 2.4, lie)); K.group.rotation.set(-1.2 * lie, 0, 0);
    kid = { ...kid, blink: lie, mouth: 'smile', open: 0, brow: 0.6, armL: 0.25, armR: 0.25, headTilt: 0.2 * lie };
    spill.intensity = 3;
    shoot(t, v3(0.4, 6.0, 14.0), v3(0.8, 5.6, 12.6), v3(2.7, 2.3, 1.4), ease.inOut(sp), 0.4, 40);
    zz.forEach((z, i) => { const tl = t - (t0 + 1.3 + i * 0.35); if (tl < 0) return; const pp = (tl % 1.2) / 1.2; z.style.opacity = Math.sin(pp * Math.PI); z.style.left = (690 + pp * 90 + i * 26) + 'px'; z.style.top = (860 - pp * 220 - i * 20) + 'px'; z.style.fontSize = (46 + i * 12) + 'px'; });
  } else {
    K.group.visible = false; hemi.intensity = 0.3; spill.intensity = 2;
    const c = v3(-2.39, NL_Y + N.LIGHT_MID * NLS * 0.55, -13.2);
    if (name === 'produkt') {
      const a = lerp(-0.6, -0.2, ease.out(sp));
      const pos = c.clone().add(v3(Math.cos(a) * 4.8, 0.9, Math.sin(a) * 4.8));
      lens(30); aim(cam, pos, c.clone().add(v3(0.2, 0.55, 0)));
    } else {
      const a = lerp(0.55, 0.3, ease.out(sp));
      const pos = c.clone().add(v3(Math.cos(a) * 4.2, -0.15, Math.sin(a) * 4.2));
      lens(30); aim(cam, pos, c.clone().add(v3(0.2, 0.6, 0)));
    }
  }
  K.set(kid);
  scene.updateMatrixWorld(true);

  // ---------- Text ----------
  tx.pill.style.opacity = 1;
  tx.pw.style.opacity = t < 3.0 ? 1 : 1 - seg(t, 3.0, 3.2);
  const S = [[tx.s1, 0.1, 2.8], [tx.s2, 2.9, 5.4], [tx.s3, 5.5, 8.0], [tx.s4, 8.1, 10.6], [tx.s5, 10.7, 13.2], [tx.s6, 13.3, 15.8], [tx.s7, 15.9, 17.9]];
  for (const [d, a, b] of S) pop(d, t >= a && t < b ? t - a : -1, seg(t, b - 0.08, b));
  pop(tx.p1, t >= 18.0 ? t - 18.0 : -1); pop(tx.p2, t >= 19.8 ? t - 19.8 : -1);
  pop(tx.cta, t >= 22.4 ? t - 22.4 : -1);
  vig.style.opacity = name.startsWith('produkt') ? 0.5 : 1;
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
