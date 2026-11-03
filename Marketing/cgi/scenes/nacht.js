// Maios CGI – Wasserspender "Gruselfakt um Mitternacht", 9 s, Handy-Look (Trend: Creepy Fact + POV, ohne Song)
// Ablauf: dunkles Zimmer, Mondlicht durch die Jalousie, Hook -> Knopf geht von allein runter, LED an ->
//         leuchtender Strahl, Kamera kreist -> Glas voll (Untersicht) -> Licht flackert an, Preis -> Schlussbild mit Link
// Vorlage (eigene Top-Videos): kurzer Clip, dunkles Zimmer mit Licht als Hingucker, weisse Text-Pointe mittig, keine Endkarte.
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, canvasTex } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makeTiefe } from '../lib/tiefe.js';
import { makeWsSzene } from '../lib/ws_szene.js';

const style = document.createElement('style');
style.textContent = BR.CSS + `
.tt{position:absolute;left:70px;width:800px;text-align:center;font:800 68px Manrope;line-height:1.16;color:#fff;letter-spacing:-.005em;
  text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.75),0 0 22px rgba(0,0,0,.45)}
.tt.big{font-size:150px;letter-spacing:-.02em}
.tt .y{color:#ffe7a6}
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(0,0,0,.42)}
.tcta{position:absolute;left:270px;width:400px;text-align:center;font:800 44px Manrope;color:#111;background:#fff;border-radius:18px;padding:20px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope', '40px Marcellus']) await document.fonts.load(f);
await document.fonts.load('800 40px Manrope', 'ß€·?:');

const r = makeRenderer(); r.localClippingEnabled = true;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
const S = makeWsSzene(scene, cam);
const { W, csW, G, J } = S;

// ---------- Zimmer: Wand mit Jalousie-Mondlicht ----------
const wallMat = new THREE.MeshStandardMaterial({ color: '#3b4a55', roughness: 0.92 });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), wallMat); wall.position.set(0, 5, -4.2); wall.receiveShadow = true; scene.add(wall);
const blinds = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const x0 = w * 0.16, x1 = w * 0.84, y0 = h * 0.12, y1 = h * 0.88;
  for (let y = y0; y < y1; y += 30) { const gr = g.createLinearGradient(0, y, 0, y + 19); gr.addColorStop(0, 'rgba(255,255,255,0.2)'); gr.addColorStop(0.35, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0.75)'); g.fillStyle = gr; g.fillRect(x0, y, x1 - x0, 19); }
  g.fillStyle = '#000'; g.fillRect(w * 0.495, 0, 9, h);   // Fensterkreuz
  g.filter = 'blur(3px)'; g.drawImage(g.canvas, 0, 0); g.filter = 'none';
});
const moon = new THREE.SpotLight('#b9d6ff', 0, 30, 0.36, 0.25, 1.2); moon.map = blinds; moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0003; moon.shadow.normalBias = 0.02;
moon.position.set(-7.5, 7.0, 7.5); moon.target.position.set(0.6, 1.1, -2.2); scene.add(moon, moon.target);
const glowL = new THREE.PointLight('#8fe6ff', 0, 4.5, 1.6); scene.add(glowL);   // Licht aus dem Wasser
const ceil = new THREE.PointLight('#ffffff', 0, 30, 1.2); ceil.position.set(1.5, 8, 4); scene.add(ceil);

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  a: mk('tt', 'Gruselfakt des Tages:', 330),
  b: mk('tt', 'Flaschen kippen?<br><span class="y">Nie wieder.</span>', 430),
  c: mk('tt', 'Ein Knopf.<br>Glas voll.', 330),
  p: mk('tt big', '38,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
function pop(d, tl, out = 0) {   // TikTok-Einblendung: kurz rein, leicht ueberschiessend
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { ripple: BR.ripple(), grain: BR.grain({ amount: 0.07, vig: 'rgba(0,6,10,.55)' }) };

export const DAUER = 9.0;
const SHOTS = [[0, 1.8, 'dunkel'], [1.8, 3.2, 'knopf'], [3.2, 5.0, 'strahl'], [5.0, 6.6, 'voll'], [6.6, 8.0, 'licht'], [8.0, 9.0, 'ende']];
const PRESS = 2.35, WATER0 = 2.5, WATER1 = 6.35, ON = [[6.72, 6.8], [6.9, 99]];

// Handkamera: kleine, unregelmaessige Bewegung
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.025 * a);
function shoot(t, from, to, tgt, p, a = 1, fov = 30) { lens(fov); const s = shake(t, a); aim(cam, vlerp(from, to, p).add(s), tgt.clone().add(s.multiplyScalar(0.6))); }

function nacht(t) {
  T.mood(0); T.key.intensity = 0; T.fill.intensity = 0.05; T.fill.color.set('#9fb8d8'); T.fill.groundColor.set('#05090c');
  T.rim.intensity = 7; T.rim.position.set(3.0, 3.2, -2.6); T.floor.visible = false;
  scene.environmentIntensity = 0.22; wallMat.color.set('#3b4a55');
  moon.intensity = 230 * (0.97 + 0.03 * Math.sin(t * 2.2)); ceil.intensity = 0;
}
function hell(k) {   // Licht an (k = 0..1), Produktlicht neutral
  T.mood(lerp(0, 1, k)); T.U.uHaloI.value = 0; T.floor.visible = false;
  T.key.intensity = 2.4 * k; T.fill.intensity = 0.05 + 0.5 * k; T.rim.intensity = 7 + 12 * k;
  scene.environmentIntensity = 0.22 + 0.7 * k; moon.intensity = 230 * (1 - 0.75 * k); ceil.intensity = 60 * k;
  wallMat.color.set('#3b4a55').lerp(new THREE.Color('#566b78'), k);
}
function setup(t, glass = true) {
  S.props.visible = S.desk.visible = true;
  S.placeDisp(W, csW, 0, 0, -0.45); csW.material.opacity = 0.7;
  J.group.visible = true; J.group.position.set(2.05, 0, -1.75); J.cap.visible = false;
  S.tubeAt(0.25, 2.05, -1.75).mesh.visible = true;
  if (glass) S.glassOn(W, G);
}

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  S.hideAll(); T.U.uTime.value = t; S.cauU.uTime.value = t; glowL.intensity = 0;
  nacht(t); setup(t);
  const h = S.water(t, WATER0, WATER1);
  const flowing = t > WATER0 && t < WATER1 + 0.1;
  S.stream.material.emissiveIntensity = 0.55;
  const nz = W.group.localToWorld(S.NOZZLE.clone());
  const gp = G.group.position.clone();
  if (t > PRESS) { S.ledOn(W, 3.4, true, t); glowL.position.set(gp.x, gp.y + 0.5 + h * 0.5, gp.z + 0.15); glowL.intensity = (flowing ? 3.6 : 1.8) * clamp((t - PRESS) / 0.15); }
  const press = seg(t, PRESS, PRESS + 0.05) * (1 - seg(t, PRESS + 0.2, PRESS + 0.3));
  W.buttons[0].position.y = 0.4 - 0.014 * press;
  W.group.updateMatrixWorld(true);

  if (name === 'dunkel') {
    shoot(t, v3(1.2, 3.5, 14.2), v3(1.0, 3.3, 12.9), v3(0.5, 2.1, -0.9), ease.out(sp), 1.2);
  } else if (name === 'knopf') {
    const b = W.buttons[0].localToWorld(v3(0, 0, 0)); moon.intensity *= 0.45;
    shoot(t, b.clone().add(v3(-1.25, 0.3, 1.7)), b.clone().add(v3(-1.0, 0.25, 1.38)), b.clone().add(v3(0.2, 0.12, -0.4)), ease.out(sp), 0.5, 32);
  } else if (name === 'strahl') {
    const c = v3(nz.x, nz.y - 0.55, nz.z); const a = lerp(-1.2, 0.15, ease.inOut(sp)); const R = 3.3;
    const pc = v3(c.x + Math.sin(a) * R, c.y + 0.25, c.z + Math.cos(a) * R); shoot(t, pc, pc, c.clone().add(v3(0, 0.25, 0)), 0, 0.4, 30);
  } else if (name === 'voll') {
    shoot(t, gp.clone().add(v3(0.85, 0.75, 4.6)), gp.clone().add(v3(0.7, 0.7, 4.0)), gp.clone().add(v3(0, 1.95, 0)), ease.out(sp), 0.5, 32);
  } else if (name === 'licht') {
    hell(t < ON[0][0] ? 0 : t < ON[0][1] ? 0.7 : t < ON[1][0] ? 0 : ease.out(seg(t, ON[1][0], ON[1][0] + 0.2)));
    shoot(t, v3(1.1, 3.4, 13.4), v3(1.0, 3.25, 12.4), v3(0.85, 2.0, -0.9), ease.out(sp), 0.8);
  } else if (name === 'ende') {
    hell(1);
    shoot(t, v3(-1.9, 3.3, 11.2), v3(-1.6, 3.2, 10.4), v3(0.6, 2.05, -0.8), ease.out(sp), 0.7);
  }
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  pop(tx.a, t < 1.8 ? t - 0.05 : -1, seg(t, 1.7, 1.8));
  pop(tx.b, t < 1.8 ? t - 0.7 : -1, seg(t, 1.7, 1.8));
  pop(tx.c, t >= 5.05 && t < 6.6 ? t - 5.05 : -1, seg(t, 6.5, 6.6));
  pop(tx.p, t >= 6.95 ? t - 6.95 : -1);
  pop(tx.cta, t >= 8.05 ? t - 8.05 : -1);
  if (name === 'knopf') { const p = S.screen(W.buttons[0], v3(0, 0.02, 0)); O.ripple(p[0], p[1], t - PRESS); } else O.ripple(0, 0, -1);
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
