// Maios CGI – 350ml Mixer Entsafter (Produkt 11, Blau), "Nach dem Training. Shake? Läuft schon.", Loop-Clip 8 s (Render 8,4 s)
// Abends im Gym: dunkle Halle, Neonleiste, Hantelbank mit Kurzhanteln und Handtuch. Der Mixer laeuft die ganze Zeit:
// Milch und Heidelbeeren ziehen als lila Wirbel durchs Glas.
// Ablauf: flach ueber die Bank (Fahrt) -> Wirbel nah von oben schraeg -> Hanteln im Vordergrund, Mixer dahinter ->
//         halbnah mit Preis -> zurueck zur ersten Einstellung (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex, contactShadow, GLSL_NOISE } from '../lib/core.js';
import * as M from '../lib/mixer_models.js';
import * as BR from '../lib/brand.js';
import { makeTiefe, stripEnv } from '../lib/tiefe.js';

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
await document.fonts.load('800 40px Manrope', 'ßü€·?:');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;


// ---------- Gym: Hantelbank (schwarzes Polster), Boden Gummi ----------
const gymFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#1d2026', roughness: 0.95 }));
gymFloor.rotation.x = -Math.PI / 2; gymFloor.position.y = -2.2; gymFloor.receiveShadow = true; scene.add(gymFloor);
const padMat = new THREE.MeshPhysicalMaterial({ color: '#1a1b1f', roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 });
const bench = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 2.6, 1, 1, 1), padMat); bench.position.set(-1.6, -0.25, 0); bench.receiveShadow = true; bench.castShadow = true; scene.add(bench);
const seam = new THREE.Mesh(new THREE.BoxGeometry(9.02, 0.04, 2.62), new THREE.MeshStandardMaterial({ color: '#3a3c42', roughness: 0.7 })); seam.position.set(-1.6, -0.02, 0); scene.add(seam);
const steel = new THREE.MeshStandardMaterial({ color: '#8b9097', metalness: 1, roughness: 0.3 });
const legM = new THREE.MeshStandardMaterial({ color: '#2b2e34', metalness: 0.6, roughness: 0.4 });
for (const x of [-5.2, 2.2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.7, 2.0), legM); leg.position.set(x, -1.35, 0); scene.add(leg); }
// Kurzhanteln (sechseckige Gewichte) auf der Bank
const hexM = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.6 });
function hantel(x, z, ry) { const g = new THREE.Group(); g.position.set(x, 0.28, z); g.rotation.y = ry; scene.add(g);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 20), steel); grip.rotation.z = Math.PI / 2; g.add(grip);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.32, 6), hexM); w.rotation.z = Math.PI / 2; w.position.x = s * 0.62; w.castShadow = true; g.add(w);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 20), steel); cap.rotation.z = Math.PI / 2; cap.position.x = s * 0.62; g.add(cap); }
  return g; }
hantel(1.55, 0.55, 0.35); hantel(1.9, -0.5, -0.2);
// Handtuch (gefaltet) links
const towel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.9, 6, 1, 4), new THREE.MeshStandardMaterial({ color: '#e9e6e0', roughness: 1 }));
towel.position.set(-1.7, 0.08, 0.3); towel.rotation.y = 0.25; towel.castShadow = true; scene.add(towel);
// Neonleiste und Gym-Lichter weit hinten (unscharf durch Tiefe-Hintergrund)
const neon = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: '#7fe3ff', toneMapped: false })); neon.position.set(0, 0.9, -14); scene.add(neon);
const neonL = new THREE.PointLight('#5ad1ff', 18, 0, 1.4); neonL.position.set(0, 4.6, -7.5); scene.add(neonL);

// ---------- Mixer (Blau) + Fluessigkeit ----------
const mats = M.makeMaterials();
const chromeEnv = stripEnv(r, { bg: '#2a2a2a', strips: [
  { w: 1.2, h: 9, pos: v3(-5.5, 0, 1.8), col: '#ffffff', I: 6 }, { w: 1.2, h: 9, pos: v3(5.5, 0, 0.8), col: '#f4fffb', I: 4 },
  { w: 3.0, h: 9, pos: v3(0, 0, -5.8), col: '#cfe9e1', I: 1.4 }, { w: 2.6, h: 9, pos: v3(-1.5, 0, 5.8), col: '#ffffff', I: 1.8 }], top: { w: 5, h: 5, col: '#ffffff', I: 2.5 } });
mats.chrome.envMap = chromeEnv; mats.chrome.envMapIntensity = 0.85;
const B = M.makeBottle('blau', mats), S = M.makeBase('blau', mats);
const rig = new THREE.Group(); rig.add(B.group); B.group.add(S.group); scene.add(rig);
// Variante Blau laut Shopfoto: verchromter Deckelrand, hellblaue Oberseite; Hals oberhalb des Bands wird nach oben breiter
const blueTop = new THREE.MeshPhysicalMaterial({ color: '#8cc8e6', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
B.cap.children[1].material = blueTop;
{
  const flare = (y) => y <= 2.6 ? M.rOuter(y) : 0.30 + 0.045 * Math.pow((y - 2.6) / (M.GLAS_TOP - 2.6), 1.3);
  const prof = [new THREE.Vector2(0.47, 0.0)];
  for (let i = 0; i <= 80; i++) { const y = (i / 80) * M.GLAS_TOP; prof.push(new THREE.Vector2(y <= 2.6 ? M.rOuter(y) : flare(y), y)); }
  prof.push(new THREE.Vector2(0.31, M.GLAS_TOP));
  B.glass.geometry.dispose(); B.glass.geometry = new THREE.LatheGeometry(prof, 128);
  B.cap.scale.set(1.03, 1, 1.03);
}
const lm = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.25, clearcoat: 0.3, sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4 });
lm.userData.u = { uTime: { value: 0 }, uMilk: { value: new THREE.Color('#f6eef4') }, uPink: { value: new THREE.Color('#9a64c4') }, uDeep: { value: new THREE.Color('#3c1d6b') }, uLight: { value: new THREE.Color('#e7d9f0') } };
lm.customProgramCacheKey = () => 'spirale_blau';
lm.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, lm.userData.u);
  sh.vertexShader = 'varying vec3 vLoc;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLoc = position;');
  sh.fragmentShader = `varying vec3 vLoc; uniform float uTime; uniform vec3 uMilk, uPink, uDeep, uLight;
${GLSL_NOISE}
` + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  float ang = atan(vLoc.z, vLoc.x) - uTime * 4.712389;           // 6 Umdrehungen in 8 s
  float h = vLoc.y;
  float n = snoise(vec3(cos(ang) * 1.4, sin(ang) * 1.4, h * 1.6)) * 0.9 + snoise(vec3(cos(ang) * 3.0, sin(ang) * 3.0, h * 4.0)) * 0.3;
  float band = sin(ang * 2.0 + h * 5.0 + n * 2.2);
  float k = smoothstep(-0.35, 0.35, band);
  vec3 col = mix(uMilk, uPink, k);
  col = mix(col, uDeep, (1.0 - smoothstep(0.0, 0.12, abs(band - 0.55))) * 0.35);
  col = mix(col, uLight, smoothstep(2.26, 2.36, h) * 0.7);       // Schaumrand oben
  vec4 diffuseColor = vec4( col, opacity );`);
};
const liq = new THREE.Mesh(new THREE.BufferGeometry(), lm); B.group.add(liq);
const chunkMat = new THREE.MeshPhysicalMaterial({ color: '#2a2552', roughness: 0.35, clearcoat: 0.7 });
const chunkLight = new THREE.MeshPhysicalMaterial({ color: '#4a3a86', roughness: 0.4, clearcoat: 0.6 });
const chunks = []; { const Rc = rng(4);
  for (let i = 0; i < 11; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.055 + Rc() * 0.015, 14, 10), Rc() < 0.5 ? chunkMat : chunkLight); m.scale.set(1, 0.9, 1);
    m.userData = { a0: Rc() * 6.283, y0: 1.35 + Rc() * 0.75, ph: Rc() * 6.283 }; B.group.add(m); chunks.push(m); } }
const cs = contactShadow(1.9, 0.4); scene.add(cs);
rig.position.set(0, 0.075, 0); cs.position.set(0, 0.003, 0);

// Ein paar Heidelbeeren und eine Banane auf dem Handtuch
const kit = M.makeFruitKit();
const berryM = new THREE.MeshPhysicalMaterial({ color: '#2b2a5a', roughness: 0.35, clearcoat: 0.6 });
for (const [x, z] of [[-1.3, 0.75], [-1.45, 0.62], [-1.15, 0.6], [-2.0, 0.1]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), berryM); b.position.set(x, 0.23, z); b.castShadow = true; scene.add(b); }
for (const [x, z, ry] of [[-2.2, 0.55, 0.3], [-1.95, 0.8, 1.1]]) { const g = kit.banane(); g.rotation.set(0.1, ry, 0.05); g.position.set(x, 0.2, z); scene.add(g); }

// ---------- Licht: Tag, neutral ----------
function tag(t) {
  T.mood(0.25);
  T.U.uC0.value.set('#3a4a5e'); T.U.uC1.value.set('#0b0e14'); T.U.uCenter.value.set(0.5, 0.6);
  T.key.color.set('#ffffff'); T.key.intensity = 2.4; T.key.position.set(-3.5, 7.5, 5.5);
  T.fill.intensity = 0.4; T.fill.color.set('#dfe8ff'); T.fill.groundColor.set('#1a1d24');
  T.rim.color.set('#7fe3ff'); T.rim.intensity = 40; T.rim.position.set(2.8, 3.8, -3.0);
  scene.environment = T.ENV.tiefe; scene.environmentIntensity = 0.45;
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Mixer'),
  hook: mk('tt', 'Nach dem Training.<br>Shake? Läuft schon.', 300),
  b: mk('tt', 'Banane, Beeren, Milch.', 300),
  c: mk('tt', 'Mixer für unterwegs.<br>350&nbsp;ml.', 300),
  p: mk('tt big', '40,99&nbsp;€', 300),
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
const SHOTS = [[0, 2.4, 'seite'], [2.4, 4.2, 'nah'], [4.2, 6.0, 'hantel'], [6.0, 7.4, 'preis'], [7.4, 8.4, 'seite2']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.02 * a);
function shoot(t, pos, tgt, a = 1, fov = 30) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
// Erste Einstellung: gleichmaessige Kreisfahrt, u = t (Anfang) bzw. t - 8 (Ende) -> nahtlos
const seiteCam = (u) => { const a = 0.55 - 0.16 * u, R = 12.6 - 0.35 * u; return [v3(Math.sin(a) * R, 1.9, Math.cos(a) * R), v3(-0.2, 2.45, 0)]; };

function contents(t) {
  lm.userData.u.uTime.value = t;
  const top = 2.36;
  liq.geometry.dispose(); liq.geometry = M.liquidGeometry(1.02, top, 'oben', 0.3, 1, t);
  S.blades.rotation.y = t * 60;
  // Erdbeerstuecke kreisen an der Glaswand (halb in der Fluessigkeit), periodisch in 8 s
  for (const c of chunks) { const d = c.userData; const a = d.a0 + t * 3.14159;
    const y = d.y0 + 0.28 * Math.sin(t * Math.PI / 2 + d.ph); const rr = M.rInner(y) - 0.016;
    c.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); c.rotation.set(t * 2.4 + d.ph, a, t * 1.7); }
}

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  const tl = name === 'seite2' ? t - 8 : t;      // Fluessigkeit + Kamera im Schluss wie am Anfang
  T.U.uTime.value = tl; tag(tl);
  contents(tl);
  rig.position.set((Math.sin(tl * 91) + Math.sin(tl * 57)) * 0.004, 0.075, 0); rig.rotation.set(0, -0.35, Math.sin(tl * 73) * 0.004);

  if (name === 'seite' || name === 'seite2') {
    const [p, q] = seiteCam(tl); shoot(t, p, q, 0.6, 30);
  } else if (name === 'nah') {
    const a = lerp(-0.2, 0.15, ease.inOut(sp)), R = 6.4;
    shoot(t, v3(Math.sin(a) * R, 4.6 - 0.2 * sp, Math.cos(a) * R), v3(0, 2.75, 0), 0.3, 30);
  } else if (name === 'hantel') {
    const a = lerp(1.05, 0.9, ease.inOut(sp)), R = lerp(10.2, 9.6, ease.out(sp));
    shoot(t, v3(Math.sin(a) * R, 0.9, Math.cos(a) * R), v3(0.4, 2.15, 0), 0.4, 32);
  } else if (name === 'preis') {
    const a = lerp(-0.35, -0.22, ease.out(sp));
    shoot(t, v3(Math.sin(a) * 11.5, lerp(4.6, 4.3, ease.out(sp)), Math.cos(a) * 11.5), v3(-0.4, 2.2, 0), 0.4, 32);
  }
  // Halo hinter dem Glas (Glas und Fluessigkeit heben sich vom Grund ab)
  T.haloAt(v3(0, 1.8, 0), 0.24, 0.3, '#cfefff', 1);
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  tx.word.style.opacity = 1;
  tx.hook.style.transform = 'none';
  tx.hook.style.opacity = t < 2.4 ? 1 : (t >= 7.4 ? 1 : 0);
  pop(tx.b, t >= 2.5 && t < 4.2 ? t - 2.5 : -1, seg(t, 4.1, 4.2));
  pop(tx.c, t >= 4.3 && t < 6.0 ? t - 4.3 : -1, seg(t, 5.9, 6.0));
  pop(tx.p, t >= 6.05 && t < 7.4 ? t - 6.05 : -1, seg(t, 7.3, 7.4));
  pop(tx.cta, t >= 6.4 && t < 7.4 ? t - 6.4 : -1, seg(t, 7.3, 7.4));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
