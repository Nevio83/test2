// Maios CGI – 350ml Mixer Entsafter (Produkt 11, Rosa), Satisfying-Loop 1. Folge, Loop-Clip 8 s (Render 8,4 s), Handy-Look
// Tag, Studio in Mint mit cremefarbenem Podest, Erdbeeren und Bananenscheiben als Requisiten. Der Mixer laeuft die ganze Zeit:
// Milch und Erdbeere ziehen als Marmor-Wirbel durchs Glas. Text nur Werbung, Produktwort, Preis + Link.
// Ablauf: 3/4-Seite (Fahrt) -> Wirbel nah -> Untersicht -> Aufsicht mit Preis -> zurueck zur ersten Einstellung (Loop).
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


// ---------- Studio: Mint-Verlauf, cremefarbenes Podest ----------
T.floor.visible = false;
const podMat = new THREE.MeshStandardMaterial({ color: '#f1e7dc', roughness: 0.62 });
const pod = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.2, 128), podMat); pod.position.y = -0.6; pod.receiveShadow = true; scene.add(pod);
const podEdge = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.02, 12, 128), podMat); podEdge.rotation.x = Math.PI / 2; scene.add(podEdge);

// ---------- Mixer (Rosa) + Fluessigkeit ----------
const mats = M.makeMaterials();
const chromeEnv = stripEnv(r, { bg: '#2a2a2a', strips: [
  { w: 1.2, h: 9, pos: v3(-5.5, 0, 1.8), col: '#ffffff', I: 6 }, { w: 1.2, h: 9, pos: v3(5.5, 0, 0.8), col: '#f4fffb', I: 4 },
  { w: 3.0, h: 9, pos: v3(0, 0, -5.8), col: '#cfe9e1', I: 1.4 }, { w: 2.6, h: 9, pos: v3(-1.5, 0, 5.8), col: '#ffffff', I: 1.8 }], top: { w: 5, h: 5, col: '#ffffff', I: 2.5 } });
mats.chrome.envMap = chromeEnv; mats.chrome.envMapIntensity = 0.85;
const B = M.makeBottle('rosa', mats), S = M.makeBase('rosa', mats);
const rig = new THREE.Group(); rig.add(B.group); B.group.add(S.group); scene.add(rig);
// Variante Rosa laut Shopfoto: Deckel rosa-metallisch mit verspiegeltem Rand, rosa Oberseite; Hals oberhalb des Bands wird nach oben breiter
const roseMetal = new THREE.MeshPhysicalMaterial({ color: '#f7cfd4', metalness: 0.45, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMap: chromeEnv, envMapIntensity: 1.5 });
const roseTop = new THREE.MeshPhysicalMaterial({ color: '#f3b9c1', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
const capMirror = new THREE.MeshPhysicalMaterial({ color: '#c4e8e8', metalness: 0.55, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08, envMap: chromeEnv, envMapIntensity: 1.5 });
B.cap.children[0].material = capMirror; void roseMetal; B.cap.children[1].material = roseTop;
{
  const flare = (y) => y <= 2.6 ? M.rOuter(y) : 0.30 + 0.045 * Math.pow((y - 2.6) / (M.GLAS_TOP - 2.6), 1.3);
  const prof = [new THREE.Vector2(0.47, 0.0)];
  for (let i = 0; i <= 80; i++) { const y = (i / 80) * M.GLAS_TOP; prof.push(new THREE.Vector2(y <= 2.6 ? M.rOuter(y) : flare(y), y)); }
  prof.push(new THREE.Vector2(0.31, M.GLAS_TOP));
  B.glass.geometry.dispose(); B.glass.geometry = new THREE.LatheGeometry(prof, 128);
  B.cap.scale.set(1.03, 1, 1.03);
}
const lm = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.25, clearcoat: 0.3, sheen: 0.5, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4 });
lm.userData.u = { uTime: { value: 0 }, uMilk: { value: new THREE.Color('#fbf1ea') }, uPink: { value: new THREE.Color('#ee6f93') }, uDeep: { value: new THREE.Color('#b8143a') }, uLight: { value: new THREE.Color('#f9d3dc') } };
lm.customProgramCacheKey = () => 'spirale';
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
const chunkMat = new THREE.MeshPhysicalMaterial({ color: '#d4203a', roughness: 0.4, clearcoat: 0.5 });
const chunkLight = new THREE.MeshPhysicalMaterial({ color: '#f0697c', roughness: 0.45, clearcoat: 0.4 });
const chunks = []; { const Rc = rng(4);
  for (let i = 0; i < 11; i++) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + Rc() * 0.025, 0), Rc() < 0.5 ? chunkMat : chunkLight); m.scale.set(1.25 + Rc() * 0.4, 0.55 + Rc() * 0.3, 0.8 + Rc() * 0.3);
    m.userData = { a0: Rc() * 6.283, y0: 1.35 + Rc() * 0.75, ph: Rc() * 6.283 }; B.group.add(m); chunks.push(m); } }
const cs = contactShadow(1.9, 0.4); scene.add(cs);
rig.position.set(0, 0.075, 0); cs.position.set(0, 0.003, 0);

// Requisiten: Erdbeeren und Bananenscheiben auf dem Podest
const kit = M.makeFruitKit();
const props = new THREE.Group(); scene.add(props);
const PROPS = [['e', 1.05, 0.55, 0.3], ['e', 1.3, 0.1, 2.2], ['b', 0.95, 1.0, 0], ['b', 1.22, 0.82, 0.6], ['e', -1.2, -0.6, 4.0], ['b', -0.9, -0.95, 1.2]];
for (const [typ, x, z, ry] of PROPS) {
  const g = typ === 'e' ? kit.erdbeere() : kit.banane();
  if (typ === 'e') { g.rotation.set(0, ry, Math.PI / 2); g.position.set(x, 0.17, z); }
  else { g.rotation.set(0.12, ry, 0.08); g.position.set(x, 0.045, z); }
  props.add(g);
}

// ---------- Licht: Tag, neutral ----------
function tag(t) {
  T.mood(1);
  T.U.uC0.value.set('#bfe9dc'); T.U.uC1.value.set('#4f9c8d'); T.U.uCenter.value.set(0.5, 0.62);
  T.key.color.set('#ffffff'); T.key.intensity = 2.6; T.key.position.set(-3.5, 7.5, 5.5);
  T.fill.intensity = 0.75; T.fill.color.set('#f4fffb'); T.fill.groundColor.set('#6a8f86');
  T.rim.color.set('#ffffff'); T.rim.intensity = 30; T.rim.position.set(2.8, 3.8, -3.0);
  scene.environment = T.ENV.tiefe; scene.environmentIntensity = 0.55;
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Mixer'),
  hook: mk('tt', 'Hier hat niemand<br>umgerührt.', 300),
  p: mk('tt big', '40,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.045, vig: 'rgba(10,40,34,.32)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 2.4, 'seite'], [2.4, 4.2, 'nah'], [4.2, 6.0, 'unten'], [6.0, 7.4, 'preis'], [7.4, 8.4, 'seite2']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.02 * a);
function shoot(t, pos, tgt, a = 1, fov = 30) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
// Erste Einstellung: gleichmaessige Kreisfahrt, u = t (Anfang) bzw. t - 8 (Ende) -> nahtlos
const seiteCam = (u) => { const a = -0.75 + 0.2 * u, R = 10.5 - 0.35 * u; return [v3(Math.sin(a) * R, 2.35, Math.cos(a) * R), v3(0, 2.0, 0)]; };

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
    const a = lerp(0.25, 0.62, ease.inOut(sp)), R = 6.0;
    shoot(t, v3(Math.sin(a) * R, 2.0 + 0.08 * sp, Math.cos(a) * R), v3(0, 2.3, 0), 0.3, 30);
  } else if (name === 'unten') {
    const a = lerp(-0.45, -0.2, ease.inOut(sp)), R = lerp(6.8, 6.3, ease.out(sp));
    shoot(t, v3(Math.sin(a) * R, 0.75, Math.cos(a) * R), v3(0, 1.85, 0), 0.4, 34);
  } else if (name === 'preis') {
    const a = lerp(0.5, 0.38, ease.out(sp));
    shoot(t, v3(Math.sin(a) * 10.5, lerp(6.4, 6.0, ease.out(sp)), Math.cos(a) * 10.5), v3(0, 2.75, 0), 0.4, 30);
  }
  // Halo hinter dem Glas (Glas und Fluessigkeit heben sich vom Grund ab)
  T.haloAt(v3(0, 1.8, 0), 0.24, 0.35, '#ffffff', 1);
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  tx.word.style.opacity = 1;
  tx.hook.style.transform = 'none';
  tx.hook.style.opacity = t < 2.4 ? 1 : (t >= 7.4 ? 1 : 0);
  pop(tx.p, t >= 6.05 && t < 7.4 ? t - 6.05 : -1, seg(t, 7.3, 7.4));
  pop(tx.cta, t >= 6.4 && t < 7.4 ? t - 6.4 : -1, seg(t, 7.3, 7.4));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
