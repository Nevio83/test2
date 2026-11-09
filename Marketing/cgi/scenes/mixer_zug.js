// Maios CGI – 350ml Mixer Entsafter (Produkt 11, Rosa), "7:12 Uhr. Frühstück fährt mit.", Loop-Clip 8 s (Render 8,4 s), Handy-Look
// Pendlerzug zur blauen Stunde: Klapptisch am Fenster, draussen ziehen Huegel, Baeume und Masten vorbei (Shader, periodisch in 8 s).
// Der Mixer laeuft ab Bild 0 auf dem Klapptisch: Milch und Mango als orangefarbener Wirbel. Effekte nur am Raum (Landschaft, Licht).
// Ablauf: schraeg vom Gang, Fenster dahinter (Hook) -> Wirbel nah von oben -> flach ueber den Tisch, Fenster seitlich ->
//         halbtotale mit Preis + Link -> zurueck zur ersten Einstellung (Loop).
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
await document.fonts.load('800 40px Manrope', 'ßüÜ€·?:');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;


// ---------- Zug: Wand mit Fenster, Klapptisch, Sitze ----------
const R = rng(1110);
const ZG = new THREE.Group(); ZG.position.set(-2.4, 0, 0); ZG.scale.setScalar(3.2); scene.add(ZG);   // Zug im Massstab des Mixers (1 = 7,5 cm)
const panelM = new THREE.MeshStandardMaterial({ color: '#b9bcbf', roughness: 0.6 });
const wallL = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), panelM); wallL.rotation.y = Math.PI / 2; wallL.position.set(-0.02, 2, 0); wallL.receiveShadow = true; ZG.add(wallL);
// Fenster: Shader-Ebene vor der Wand (blaue Stunde, Landschaft zieht nach hinten, periodisch in 8 s)
const winU = { uTime: { value: 0 } };
const winM = new THREE.ShaderMaterial({ uniforms: winU, toneMapped: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: GLSL_NOISE + `
uniform float uTime; varying vec2 vUv;
const float TAU = 6.2831853;
float per(float s, float y, float f){ return snoise(vec3(cos(TAU * s) * f, sin(TAU * s) * f, y)); }
void main(){
  vec2 uv = vUv; float y = uv.y;
  vec2 c = abs(uv - 0.5) * vec2(1.0, 1.0); vec2 q = max(c - vec2(0.42, 0.40), 0.0); float rr = length(q / vec2(0.08, 0.10));
  float frame = smoothstep(0.92, 1.0, rr);
  vec3 sky = mix(vec3(0.95, 0.52, 0.28), vec3(0.16, 0.24, 0.48), smoothstep(0.30, 0.62, y));
  sky = mix(sky, vec3(0.06, 0.09, 0.22), smoothstep(0.62, 0.98, y));
  vec3 col = sky;
  float s1 = fract(uv.x * 0.25 + uTime / 8.0);                 // Huegel: 2 Umlaeufe in 8 s
  float hill = 0.33 + 0.05 * per(s1, 0.3, 1.2) + 0.02 * per(s1, 1.7, 3.0);
  col = mix(col, vec3(0.08, 0.09, 0.16), smoothstep(hill + 0.004, hill - 0.004, y));
  float s2 = fract(uv.x * 0.5 + uTime * 3.0 / 8.0);             // Lichter von Doerfern auf den Huegeln
  float lights = smoothstep(0.82, 0.95, per(s2, 4.2, 6.0)) * smoothstep(hill - 0.01, hill - 0.05, y) * smoothstep(hill - 0.12, hill - 0.06, y);
  col += vec3(1.0, 0.75, 0.4) * lights * 0.9;
  float s3 = fract(uv.x * 0.6 + uTime * 6.0 / 8.0);             // Baeume vorne, schnell
  float tree = 0.22 + 0.10 * max(per(s3, 2.1, 5.0), 0.0) + 0.04 * per(s3, 5.3, 14.0);
  col = mix(col, vec3(0.03, 0.04, 0.07), smoothstep(tree + 0.006, tree - 0.006, y));
  float s4 = fract(uv.x * 1.0 + uTime * 9.0 / 8.0);             // Oberleitungsmasten, sehr schnell (verwischt)
  float pole = smoothstep(0.035, 0.0, abs(s4 - 0.5)) * step(y, 0.92);
  col = mix(col, vec3(0.02, 0.03, 0.05), pole * 0.85);
  col *= 0.95;
  col = mix(col, vec3(0.62, 0.64, 0.66) * 0.55, frame);        // Fensterrahmen (dunkelgrau)
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}` });
const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.3), winM); win.rotation.y = Math.PI / 2; win.position.set(0, 1.55, -0.55); ZG.add(win);
const frameM = new THREE.MeshPhysicalMaterial({ color: '#c3c7cc', roughness: 0.45, clearcoat: 0.4 });
for (const zc of [-0.55, -4.5]) {
  for (const [w, h, y, z] of [[3.9, 0.3, 1.55 + 1.25, zc], [3.9, 0.3, 1.55 - 1.25, zc], [0.3, 2.8, 1.55, zc - 1.8], [0.3, 2.8, 1.55, zc + 1.8]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, w), frameM); b.position.set(0.04, y, z); ZG.add(b);
  }
}
const sill = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 9.0), new THREE.MeshStandardMaterial({ color: '#6c7076', roughness: 0.5 })); sill.position.set(0.15, 0.32, -2.5); ZG.add(sill);
const win2 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.3), winM); win2.rotation.y = Math.PI / 2; win2.position.set(0, 1.55, -4.5); ZG.add(win2);
const winGlow = new THREE.RectAreaLight ? null : null; void winGlow;
// Klapptisch (hellgrau) an der Wand
const tableM = new THREE.MeshPhysicalMaterial({ color: '#8e9296', roughness: 0.45, clearcoat: 0.2 });
const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 3.0), tableM); table.position.set(1.2, -0.06, -0.3); table.receiveShadow = true; table.castShadow = true; ZG.add(table);
const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 3.0), new THREE.MeshStandardMaterial({ color: '#2c2e31', roughness: 0.5 })); edge.position.set(2.42, -0.06, -0.3); ZG.add(edge);
// Sitze (dunkelblauer Stoff) vor und hinter dem Tisch
const fab = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#1d2a4a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1600; i++) { g.fillStyle = R() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; g.fillRect(R() * w, R() * h, 2, 2); } });
fab.wrapS = fab.wrapT = THREE.RepeatWrapping; fab.repeat.set(3, 3);
const seatM = new THREE.MeshStandardMaterial({ map: fab, roughness: 0.95 });
for (const z of [-2.35]) {
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.6, 0.5), seatM); back.position.set(1.8, 0.8, z); back.receiveShadow = true; ZG.add(back);
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.52), new THREE.MeshStandardMaterial({ color: '#cfd2d6', roughness: 0.9 })); head.position.set(1.8, 2.85, z); ZG.add(head);
}
// Kaffeebecher-freie Ecke: zwei Mangostuecke auf einem Brettchen und ein Handy
const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.5), new THREE.MeshStandardMaterial({ color: '#c79a63', roughness: 0.7 })); board.position.set(-1.4, 0.06, 1.7); board.rotation.y = 0.2; board.castShadow = true; board.receiveShadow = true; scene.add(board);
const mangoM = new THREE.MeshPhysicalMaterial({ color: '#ffae1f', roughness: 0.35, clearcoat: 0.6 });
for (const [x, z] of [[-1.8, 1.6], [-1.2, 1.85], [-1.5, 2.0], [-0.9, 1.5]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), mangoM); m.position.set(x, 0.19, z); m.rotation.y = R() * 3; m.castShadow = true; scene.add(m); }
const phone = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 2.0), new THREE.MeshPhysicalMaterial({ color: '#111214', roughness: 0.25, clearcoat: 1 })); phone.position.set(-1.6, 0.05, -2.3); phone.rotation.y = -0.3; phone.castShadow = true; scene.add(phone);
// Deckenlicht (warm) als Lichtquelle oben
const ceil = new THREE.PointLight('#ffe2bc', 40, 30, 1.4); ceil.position.set(3.0, 9.5, -0.4); ceil.castShadow = false; scene.add(ceil);
const winL = new THREE.PointLight('#7f9cff', 10, 10, 1.6); winL.position.set(-1.5, 3.5, -0.6); scene.add(winL);

const RX = 0.6; const ROTY = 0.75, CA = 0.55;
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
lm.userData.u = { uTime: { value: 0 }, uMilk: { value: new THREE.Color('#fff0d8') }, uPink: { value: new THREE.Color('#ffa12a') }, uDeep: { value: new THREE.Color('#e2621a') }, uLight: { value: new THREE.Color('#ffe3b4') } };
lm.customProgramCacheKey = () => 'spirale_mango';
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
const chunkMat = new THREE.MeshPhysicalMaterial({ color: '#f39a12', roughness: 0.35, clearcoat: 0.7 });
const chunkLight = new THREE.MeshPhysicalMaterial({ color: '#ffc33a', roughness: 0.4, clearcoat: 0.6 });
const chunks = []; { const Rc = rng(4);
  for (let i = 0; i < 11; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1 + Rc() * 0.03, 0.09, 0.1), Rc() < 0.5 ? chunkMat : chunkLight); m.scale.set(1, 0.9, 1);
    m.userData = { a0: Rc() * 6.283, y0: 1.35 + Rc() * 0.75, ph: Rc() * 6.283 }; B.group.add(m); chunks.push(m); } }
const cs = contactShadow(1.9, 0.4); scene.add(cs);
rig.position.set(RX, 0.075, 0); cs.position.set(RX, 0.003, 0);


// ---------- Licht: Tag, neutral ----------
function tag(t) {
  T.mood(0.25); T.U.uHaloI.value = 0;
  T.U.uC0.value.set('#2a2e36'); T.U.uC1.value.set('#0b0d12'); T.U.uCenter.value.set(0.5, 0.6);
  T.key.color.set('#fff4e6'); T.key.intensity = 1.6; T.key.position.set(2.5, 8, 3.5);
  T.fill.intensity = 0.35; T.fill.color.set('#e6ecff'); T.fill.groundColor.set('#1a1d24');
  T.rim.color.set('#9fb6ff'); T.rim.intensity = 14; T.rim.position.set(-2.0, 3.2, -1.6);
  scene.environment = T.ENV.tiefe; scene.environmentIntensity = 0.4;
  winU.uTime.value = t;
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Mixer'),
  hook: mk('tt', '7:12 Uhr.<br>Frühstück fährt mit.', 300),
  b: mk('tt', 'Mango, Milch,<br>einmal durch.', 300),
  c: mk('tt', 'Nächster Halt:<br>Büro.', 300),
  p: mk('tt big', '47,99&nbsp;€', 300),
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
const SHOTS = [[0, 2.8, 'seite'], [2.8, 4.6, 'nah'], [4.6, 5.9, 'flach'], [5.9, 7.1, 'preis'], [7.1, 8.4, 'seite2']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.02 * a);
function shoot(t, pos, tgt, a = 1, fov = 30) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
// Erste Einstellung: gleichmaessige Kreisfahrt, u = t (Anfang) bzw. t - 8 (Ende) -> nahtlos
const seiteCam = (u) => { const a = CA - 0.05 * u, R = 11.6 - 0.3 * u; return [v3(RX + Math.sin(a) * R, 2.7, Math.cos(a) * R), v3(RX - 1.3, 2.6, -1.6)]; };

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
  rig.position.set(RX + (Math.sin(tl * 91) + Math.sin(tl * 57)) * 0.004, 0.075, 0); rig.rotation.set(0, ROTY, Math.sin(tl * 73) * 0.004);

  if (name === 'seite' || name === 'seite2') {
    const [p, q] = seiteCam(tl); shoot(t, p, q, 0.6, 30);
  } else if (name === 'nah') {
    const a = lerp(0.75, 1.0, ease.inOut(sp)), R = 5.2;
    shoot(t, v3(RX + Math.sin(a) * R, 4.4 - 0.2 * sp, Math.cos(a) * R), v3(RX - 0.3, 2.5, 0), 0.3, 32);
  } else if (name === 'flach') {
    const a = lerp(0.25, 0.4, ease.inOut(sp)), R = lerp(7.4, 7.0, ease.out(sp));
    shoot(t, v3(RX + Math.sin(a) * R * 1.12, 0.75, Math.cos(a) * R * 1.12), v3(RX - 0.6, 2.75, -0.6), 0.4, 32);
  } else if (name === 'preis') {
    const a = lerp(1.25, 1.15, ease.out(sp));
    shoot(t, v3(RX + Math.sin(a) * 11.8, lerp(5.0, 4.7, ease.out(sp)), Math.cos(a) * 11.8), v3(RX - 0.9, 2.5, -0.4), 0.4, 32);
  }
  // Halo hinter dem Glas (Glas und Fluessigkeit heben sich vom Grund ab)
  
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  tx.word.style.opacity = 1;
  tx.hook.style.transform = 'none';
  tx.hook.style.opacity = t < 2.8 ? 1 : (t >= 7.1 ? 1 : 0);
  pop(tx.b, t >= 3.62 && t < 4.6 ? t - 3.62 : -1, seg(t, 4.52, 4.6));
  pop(tx.c, t >= 4.7 && t < 5.9 ? t - 4.7 : -1, seg(t, 5.82, 5.9));
  pop(tx.p, t >= 5.95 && t < 7.1 ? t - 5.95 : -1, seg(t, 7.02, 7.1));
  pop(tx.cta, t >= 6.25 && t < 7.1 ? t - 6.25 : -1, seg(t, 7.02, 7.1));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
