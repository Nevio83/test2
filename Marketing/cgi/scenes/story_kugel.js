// Maios CGI – Story-Video "Angst im Dunkeln" mit Comicfigur Mo, Krystall Ball Nachtlampe (Produkt 50), 23 s, ohne Stimme.
// Format (Trend: 3D-Storytime mit Figur, Problem -> Rueckblende -> Produkt als Loesung -> Link):
// Augen im Dunkeln -> Zimmer, Licht aus -> Schatten an der Wand (rot) -> unter der Decke -> Kugel auf dem Nachttisch ->
// Licht an, Mond leuchtet -> Schatten weg, Mo strahlt -> Mo schlaeft ein -> Produkt + Preis -> Link im Profil
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, canvasTex } from '../lib/core.js';
import * as KM from '../lib/kugel_models.js';
import { makeKid, toon } from '../lib/figur.js';

// ---------- Overlay (TikTok-Untertitel) ----------
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
.cta{position:absolute;left:250px;width:440px;text-align:center;font:800 46px Manrope;color:#111;background:#fff;border-radius:18px;padding:22px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.zzz{position:absolute;font:800 64px Manrope;color:#fff;text-shadow:0 0 10px rgba(255,210,140,.8)}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 45%,rgba(0,0,0,.6) 100%)}
#red{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(255,0,0,.05) 30%,rgba(150,0,0,.6) 100%);mix-blend-mode:multiply}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 40px Manrope', 'ßüö€');
const ov = document.getElementById('ov');
const mk = (cls, html, top, extra = {}) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; d.style.top = top + 'px'; Object.assign(d.style, extra); d.style.opacity = 0; ov.appendChild(d); return d; };
const red = document.createElement('div'); red.id = 'red'; red.style.opacity = 0; ov.appendChild(red);
const vig = document.createElement('div'); vig.id = 'vig'; ov.appendChild(vig);

const r = makeRenderer();
r.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b1222');
const cam = new THREE.PerspectiveCamera(34, 1080 / 1920, 0.05, 120);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };

// ---------- Zimmer ----------
const wallC = canvasTex(1024, 512, (g, w, h) => { g.fillStyle = '#5d74a8'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.07)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 26, h); });
wallC.wrapS = THREE.RepeatWrapping; wallC.repeat.set(3, 1);
const wallMat = toon('#ffffff', { map: wallC });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), wallMat); wall.position.set(0, 7, -3.6); wall.receiveShadow = true; scene.add(wall);
const side = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), wallMat); side.position.set(-6.5, 7, 3.4); side.rotation.y = Math.PI / 2; side.receiveShadow = true; scene.add(side);
const floorT = KM.woodTex(9, '#c99a6b', [150, 105, 70]); floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(4, 4);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), toon('#ffffff', { map: floorT })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
// Fenster mit Mond
const win = new THREE.Group(); win.position.set(3.2, 5.0, -3.55); scene.add(win);
{ const fr = toon('#e9e4da');
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.8), new THREE.MeshBasicMaterial({ map: canvasTex(256, 280, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d1b3d'); gr.addColorStop(1, '#2a4378'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(170, 80, 34, 0, 7); g.fill(); g.fillStyle = '#ffffff'; for (let i = 0; i < 30; i++) g.fillRect((i * 97) % w, (i * 53) % h, 2, 2); }) }));
  win.add(sky);
  for (const [w, h, x, y] of [[2.9, 0.16, 0, 1.45], [2.9, 0.16, 0, -1.45], [0.16, 3.0, -1.37, 0], [0.16, 3.0, 1.37, 0], [0.1, 2.8, 0, 0], [2.7, 0.1, 0, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), fr); b.position.set(x, y, 0.05); win.add(b); }
  const cur = toon('#7a4e8e'); for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.8, 0.15), cur); c.position.set(s * 1.75, -0.1, 0.12); c.castShadow = true; win.add(c); } }
// Sterne-Aufkleber
const stars = []; { const st = canvasTex(64, 64, (g) => { g.fillStyle = '#fff2a8'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 12 : 28; g.lineTo(32 + Math.cos(a) * rr, 34 + Math.sin(a) * rr); } g.fill(); });
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), new THREE.MeshBasicMaterial({ map: st, transparent: true, color: '#ffffff' })); s.position.set(-4.8 + i * 1.1, 7.6 + Math.sin(i * 2.1) * 0.6, -3.55); scene.add(s); stars.push(s); } }
// Bett
const bed = new THREE.Group(); scene.add(bed);
const woodM = toon('#a8744a');
{ const frame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 7.4), woodM); frame.position.set(0, 0.5, 0.3); frame.castShadow = frame.receiveShadow = true; bed.add(frame);
  const head = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.4, 0.35), woodM); head.position.set(0, 1.7, -3.3); head.castShadow = true; bed.add(head);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.6, 7.0), toon('#f4f1ea')); mat.position.set(0, 1.3, 0.3); mat.receiveShadow = true; bed.add(mat);
  const pil = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), toon('#ffffff')); pil.scale.set(1.5, 0.38, 0.75); pil.position.set(0, 1.85, -2.5); pil.castShadow = true; bed.add(pil); }
const quiltT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e58a6e'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0b58f'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64); });
const quiltM = toon('#ffffff', { map: quiltT });
const blanket = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.5, 5.6, 8, 2, 8), quiltM); blanket.position.set(0, 1.75, 1.15); blanket.castShadow = blanket.receiveShadow = true; scene.add(blanket);
const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 3.0, 8, 16), quiltM); legs.rotation.x = Math.PI / 2; legs.position.set(0, 2.0, 1.0); legs.scale.set(1.3, 1, 0.5); legs.castShadow = true; scene.add(legs);
const shield = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 0.45, 6, 6, 1), quiltM); shield.castShadow = true; scene.add(shield);   // hochgezogene Decke
// Nachttisch + Lampe
const ns = new THREE.Group(); ns.position.set(-3.6, 0, -2.4); scene.add(ns);
{ const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.3, 1.7), toon('#d9b38c')); top.position.y = 1.15; top.castShadow = top.receiveShadow = true; ns.add(top);
  const dr = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 0.05), toon('#c79c74')); dr.position.set(0, 1.35, 0.86); ns.add(dr);
  const kn = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), toon('#7a5233')); kn.position.set(0, 1.35, 0.9); ns.add(kn); }
const NS_TOP = 2.3, LS = 0.62;
const L = KM.makeLamp('mond', KM.woodTex()); L.group.scale.setScalar(LS); L.group.position.set(-3.6, NS_TOP, -2.25); L.group.rotation.y = 0.5; scene.add(L.group);
L.light.distance = 0; L.light.decay = 2; L.bounce.intensity = 0; L.eMat.uniforms.uSize.value = 0.009 * LS;
const warm = new THREE.PointLight('#ffb766', 0, 0, 1.6); warm.position.set(-3.6, NS_TOP + 0.9, -1.8); warm.castShadow = true; warm.shadow.mapSize.set(1024, 1024); warm.shadow.bias = -0.002; scene.add(warm);
const wallGlow = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: KM.glowTex(), color: '#ffb35c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); wallGlow.position.set(-3.4, 3.4, -3.5); scene.add(wallGlow);
// Schatten-Monster an der Wand
const monT = canvasTex(512, 640, (g, w, h) => {
  g.fillStyle = '#000'; g.beginPath();
  g.moveTo(140, 640); g.bezierCurveTo(110, 420, 120, 260, 190, 180); g.bezierCurveTo(200, 110, 240, 70, 256, 60); g.bezierCurveTo(272, 70, 312, 110, 322, 180);
  g.bezierCurveTo(392, 260, 402, 420, 372, 640); g.fill();
  // Hoerner
  g.beginPath(); g.moveTo(200, 150); g.quadraticCurveTo(150, 60, 120, 40); g.quadraticCurveTo(170, 110, 225, 130); g.fill();
  g.beginPath(); g.moveTo(312, 150); g.quadraticCurveTo(362, 60, 392, 40); g.quadraticCurveTo(342, 110, 287, 130); g.fill();
  // Arme mit Krallen
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(256 + s * 110, 300); g.quadraticCurveTo(256 + s * 230, 330, 256 + s * 240, 230); for (let k = 0; k < 4; k++) g.lineTo(256 + s * (232 + k * 8), 190 - k * 4); g.quadraticCurveTo(256 + s * 200, 300, 256 + s * 110, 360); g.fill(); }
  // Augen
  g.globalCompositeOperation = 'destination-out'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(256 + s * 40, 190, 18, 10, s * 0.4, 0, 7); g.fill(); }
});
const monster = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.25), new THREE.MeshBasicMaterial({ map: monT, transparent: true, depthWrite: false, opacity: 0.8 })); monster.position.set(2.6, 4.4, -3.52); scene.add(monster);
// Mo
const K = makeKid(); scene.add(K.group); K.group.position.set(0, 1.55, -1.75);
// Zzz
const zz = [0, 1, 2].map((i) => mk('zzz', 'z', 0));
// Licht
const hemi = new THREE.HemisphereLight('#9db7ff', '#1a1e33', 0.9); scene.add(hemi);
const moon = new THREE.DirectionalLight('#9fbaff', 1.6); moon.position.set(6, 9, 6); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
Object.assign(moon.shadow.camera, { left: -9, right: 9, top: 10, bottom: -2, near: 1, far: 30 }); moon.shadow.bias = -0.001; scene.add(moon, moon.target); moon.target.position.set(0, 1.5, -1);
const redL = new THREE.PointLight('#ff2a2a', 0, 0, 1.2); redL.position.set(1.5, 0.5, 2.5); scene.add(redL);
const fill = new THREE.PointLight('#ffffff', 0, 0, 2); fill.position.set(0, 4, 6); scene.add(fill);

const tx = {
  pill: mk('tpill', 'Werbung', 208),
  s1: mk('tt', 'Als Kind hatte ich <span class="y">mega Angst</span> im Dunkeln.', 330),
  s2: mk('tt', 'Jede Nacht: Licht&nbsp;aus&nbsp;…', 330),
  s3: mk('tt', '… und überall <span class="y">Schatten.</span>', 330),
  s4: mk('tt', 'Ich unter der Decke.<br>Jede. Nacht.', 330),
  s5: mk('tt', 'Bis ich <span class="y">DAS</span> bekommen hab:', 330),
  s6: mk('tt', 'Mein eigener Mond.', 330),
  s7: mk('tt', 'Und die Schatten?<br><span class="y">Einfach weg.</span>', 330),
  s8: mk('tt', 'Seitdem ist Schlafen<br>kein Drama mehr.', 330),
  p1: mk('tt', 'Krystall Ball<br>Nachtlampe', 300),
  p2: mk('tt big', '17,99&nbsp;€', 470),
  p3: mk('tt', '<span class="y">7 Motive</span>', 650, { fontSize: '54px' }),
  cta: mk('cta', 'Link im Profil', 790),
};
function pop(d, tl, out = 0) { if (tl < 0) { d.style.opacity = 0; return; } const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out); d.style.transform = `scale(${lerp(0.82, 1, p)})`; }

export const DAUER = 23.0;
const SHOTS = [[0, 2.2, 'augen'], [2.2, 4.6, 'zimmer'], [4.6, 7.0, 'schatten'], [7.0, 9.2, 'decke'], [9.2, 11.4, 'kugel'], [11.4, 13.6, 'an'],
  [13.6, 16.0, 'warm'], [16.0, 18.4, 'schlaf'], [18.4, 21.4, 'produkt'], [21.4, 23.0, 'cta']];
const CLICK = 11.75;
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, 0).multiplyScalar(0.03 * a);
function shoot(t, from, to, tgt, p, a = 1, fov = 34) { lens(fov); const s = shake(t, a); aim(cam, vlerp(from, to, p).add(s), tgt.clone().add(s.multiplyScalar(0.5))); }

function nacht() { hemi.intensity = 0.85; hemi.color.set('#8aa6ff'); hemi.groundColor.set('#141a30'); moon.intensity = 1.5; warm.intensity = 0; redL.intensity = 0; fill.intensity = 0; scene.background.set('#0b1222'); wallMat.color.set('#ffffff'); }
function hell(k) { // Nachtlampe an: warmes Licht vom Nachttisch, Mond schwaecher
  hemi.intensity = lerp(0.85, 0.75, k); hemi.color.set('#8aa6ff').lerp(new THREE.Color('#ffd6a8'), k * 0.6);
  moon.intensity = lerp(1.5, 0.7, k); warm.intensity = 32 * k; wallGlow.material.opacity = 0.55 * k; wallGlow.visible = k > 0.01;
}
const blinkAt = (t, at) => Math.max(0, 1 - Math.abs(t - at) / 0.09);
const blinks = (t, list) => list.reduce((m, a) => Math.max(m, blinkAt(t, a)), 0);

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  nacht(); hell(0); monster.visible = false; shield.visible = false; red.style.opacity = 0; L.set(0, 0.35, { cam });
  K.group.visible = true; K.group.position.set(0, 1.55, -1.75); K.group.rotation.set(0, 0, 0); K.body.position.set(0, 0, 0);
  zz.forEach((z) => (z.style.opacity = 0));
  const lampOn = t >= CLICK ? ease.out(seg(t, CLICK, CLICK + 0.35)) : 0;
  if (lampOn > 0) { hell(lampOn); L.set(lampOn, 0.35, { cam, glowScale: 0.8 }); L.eMat.uniforms.uI.value *= 0.75; }
  let kid = { look: [0, 0], blink: blinks(t, [1.4, 3.9, 14.9]), eye: 1, mouth: 'flat', open: 0, brow: 0 };

  if (name === 'augen') {
    kid = { ...kid, look: [Math.sin(t * 2.6) > 0 ? 0.9 : -0.9, 0.1], eye: 1.12, mouth: 'o', open: 0.2, brow: -1 };
    shoot(t, v3(0.0, 4.25, 4.4), v3(0.0, 4.25, 3.7), v3(0, 4.25, -1.75), ease.out(sp), 0.6, 30);
    hemi.intensity = 0.6; fill.intensity = 18; fill.color.set('#b9cbff');
  } else if (name === 'zimmer') {
    kid = { ...kid, look: [0.6, 0.2], mouth: 'frown', brow: -0.6, armL: 0.5, armR: 0.5, fwd: 0.9 };
    shoot(t, v3(1.2, 4.6, 13.2), v3(0.9, 4.4, 11.6), v3(-0.9, 3.0, -1.6), ease.inOut(sp), 0.8);
  } else if (name === 'schatten') {
    monster.visible = true; const g = ease.inOut(seg(t, t0, t1)); monster.scale.setScalar(lerp(0.7, 1.25, g)); monster.position.set(-2.3, 2.9 + 2.6 * lerp(0.7, 1.25, g), -3.52);
    hemi.color.set('#ff7777'); hemi.intensity = 0.7; redL.intensity = 30; moon.color.set('#ffb0b0'); red.style.opacity = 1;
    kid = { ...kid, look: [-0.9, 0.5], eye: 1.2, mouth: 'o', open: 0.5 + 0.2 * Math.sin(t * 20), brow: -1, armL: 0.6, armR: 0.6, fwd: 1.3 };
    K.body.position.x = Math.sin(t * 45) * 0.02;
    shoot(t, v3(3.2, 2.4, 8.4), v3(2.8, 2.4, 7.4), v3(-1.2, 4.4, -3.0), ease.out(sp), 2.0, 40);
  } else if (name === 'decke') {
    const down = ease.inOut(seg(t, t0, t0 + 0.6));
    K.group.position.y = 1.55 - 1.2 * down; shield.visible = true; shield.position.set(0, lerp(0.3, 1.45, down), -0.85); shield.rotation.x = -0.08;
    K.body.position.x = Math.sin(t * 50) * 0.025 * down;
    kid = { ...kid, look: [Math.sin(t * 3) * 0.8, 0.1], eye: 1.15, brow: -1, blink: blinks(t, [8.3]), armL: 0.1, armR: 0.1, fwd: 2.3 };
    shoot(t, v3(0.0, 3.3, 6.2), v3(0.0, 3.25, 5.4), v3(0, 2.9, -1.6), ease.out(sp), 0.8, 34);
  } else if (name === 'kugel') {
    K.group.position.y = 0.35; shield.visible = true; shield.position.set(0, 1.45, -0.85);
    const lp = L.group.position;
    shoot(t, lp.clone().add(v3(1.6, 1.3, 4.6)), lp.clone().add(v3(1.2, 1.2, 3.8)), lp.clone().add(v3(0, 1.45, 0)), ease.inOut(sp), 0.4, 32);
  } else if (name === 'an') {
    K.group.position.y = 0.35; shield.visible = true; shield.position.set(0, 1.45, -0.85);
    const lp = L.group.position; const p = ease.inOut(sp);
    shoot(t, lp.clone().add(v3(0.7, 1.2, 4.6)), lp.clone().add(v3(0.5, 1.15, 3.8)), lp.clone().add(v3(0, 1.35, 0)), p, 0.3, 32);
  } else if (name === 'warm') {
    const up = ease.out(seg(t, t0 + 0.2, t0 + 0.9)); K.group.position.y = lerp(0.35, 1.55, up);
    shield.visible = up < 0.98; shield.position.set(0, lerp(1.45, 0.2, up), -0.85);
    const happy = seg(t, t0 + 1.0, t0 + 1.5);
    kid = { ...kid, look: [-0.9, 0.2], eye: 1.12, mouth: happy > 0 ? 'smile' : 'o', open: happy > 0 ? 0.6 * happy : 0.3, brow: happy > 0 ? 1 : 0, armL: 0.25, armR: 0.25, headTurn: -0.35, headTilt: 0.1 * happy };
    shoot(t, v3(1.6, 4.3, 12.2), v3(1.3, 4.1, 10.8), v3(-1.3, 3.0, -1.8), ease.inOut(sp), 0.6);
  } else if (name === 'schlaf') {
    const lie = ease.inOut(seg(t, t0 + 0.2, t0 + 1.2));
    K.group.position.set(0, 1.55, lerp(-1.75, -0.25, lie)); K.group.rotation.set(-1.25 * lie, 0, 0.0);
    kid = { ...kid, blink: lie, mouth: 'smile', open: 0, brow: 0.6, armL: 0.25, armR: 0.25, headTilt: 0.25 * lie, nod: 0.3 * lie };
    shoot(t, v3(-0.5, 7.4, 4.2), v3(-0.4, 7.0, 3.6), v3(0, 2.2, -2.2), ease.inOut(sp), 0.4, 34);
    zz.forEach((z, i) => { const tl = t - (t0 + 1.2 + i * 0.35); if (tl < 0) return; const p = (tl % 1.2) / 1.2; z.style.opacity = Math.sin(p * Math.PI); z.style.left = (560 + p * 120 + i * 30) + 'px'; z.style.top = (820 - p * 260 - i * 20) + 'px'; z.style.fontSize = (48 + i * 14) + 'px'; });
  } else if (name === 'produkt' || name === 'cta') {
    K.group.visible = false; L.group.rotation.y = 0.5 + (t - 18.4) * 0.35;
    const lp = L.group.position;
    const tt = seg(t, 18.4, 23.0);
    shoot(t, lp.clone().add(v3(0, 1.2, 6.6)), lp.clone().add(v3(0, 1.15, 5.8)), lp.clone().add(v3(0, 1.55, 0)), ease.out(tt), 0.3, 32);
  }
  K.set(kid);
  scene.updateMatrixWorld(true);

  // ---------- Untertitel ----------
  tx.pill.style.opacity = 1;
  const S = [[tx.s1, 0.1, 2.2], [tx.s2, 2.3, 4.6], [tx.s3, 4.7, 7.0], [tx.s4, 7.15, 9.2], [tx.s5, 9.3, 11.4], [tx.s6, 11.9, 13.6], [tx.s7, 14.0, 16.0], [tx.s8, 16.2, 18.4]];
  for (const [d, a, b] of S) pop(d, t >= a && t < b ? t - a : -1, seg(t, b - 0.08, b));
  pop(tx.p1, t >= 18.5 ? t - 18.5 : -1); pop(tx.p2, t >= 18.8 ? t - 18.8 : -1); pop(tx.p3, t >= 19.3 ? t - 19.3 : -1);
  pop(tx.cta, t >= 21.4 ? t - 21.4 : -1);
  vig.style.opacity = name === 'produkt' || name === 'cta' ? 0.6 : 1;
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
