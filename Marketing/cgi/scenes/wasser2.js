// Maios CGI – Wasserspender (Produkt 10) – Fassung 2, Farbwelt "Tiefe" (Petrol), 14 s, 120 BPM
// Ziel: weisses Geraet, Glas und Wasser klar sichtbar (Kontrast), Wasser leuchtet von hinten, Kaustik-Licht.
import * as THREE from 'three';
import { makeRenderer, contactShadow, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as WM from '../lib/ws_models.js';
import * as BR from '../lib/brand.js';

const style = document.createElement('style'); style.textContent = BR.CSS; document.head.appendChild(style);
for (const f of ['300 40px Manrope', '500 40px Manrope', '700 40px Manrope', '40px Marcellus']) await document.fonts.load(f);
await document.fonts.load('700 40px Manrope', 'ß€·');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(26, 1080 / 1920, 0.05, 90);

// ---------- Farbwelt "Tiefe" ----------
export const TIEFE = { mitte: '#1f6273', rand: '#05181e', halo: '#c9f3ff', kaustik: '#8fe9ff', hell: '#e4eff0' };

function stripEnv({ bg, strips, top }) {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: bg, side: THREE.BackSide })));
  const add = (w, h, pos, col, I) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), side: THREE.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); s.add(m); };
  for (const st of strips) add(st.w, st.h, st.pos, st.col, st.I);
  if (top) add(top.w, top.h, v3(0, 5.8, 0), top.col, top.I);
  const pm = new THREE.PMREMGenerator(r); const tex = pm.fromScene(s, 0.02).texture; pm.dispose(); return tex;
}
const ENV = {
  tiefe: stripEnv({ bg: '#0b2a33', strips: [
    { w: 1.2, h: 9, pos: v3(-5.5, 0, 1.8), col: '#ffffff', I: 7 }, { w: 1.2, h: 9, pos: v3(5.5, 0, 0.8), col: '#eefcff', I: 6 },
    { w: 3.0, h: 9, pos: v3(0, 0, -5.8), col: '#9fe6f5', I: 1.6 }, { w: 2.6, h: 9, pos: v3(-1.5, 0, 5.8), col: '#ffffff', I: 1.8 }], top: { w: 5, h: 5, col: '#ffffff', I: 3.2 } }),
};

// Hintergrund als bildschirmfuellende, undurchsichtige Flaeche -> auch durch Glas/Wasser sichtbar (Transmission)
const lin = (h) => new THREE.Color(h);
const bgU = {
  uC0: { value: lin(TIEFE.mitte) }, uC1: { value: lin(TIEFE.rand) }, uCenter: { value: new THREE.Vector2(0.5, 0.56) },
  uHalo: { value: new THREE.Vector2(0.5, 0.5) }, uHaloCol: { value: lin(TIEFE.halo) }, uHaloR: { value: 0.2 }, uHaloI: { value: 0.0 },
  uSplit: { value: 0.0 }, uS0: { value: lin('#0d3a46') }, uS1: { value: lin(TIEFE.hell) }, uAspect: { value: 1080 / 1920 },
  uTime: { value: 0 }, uCaust: { value: 0.0 }, uCaustCol: { value: lin(TIEFE.kaustik) },
  // zweiter Lichthof (warm), z. B. hinter dem Lampenschirm
  uHalo2: { value: new THREE.Vector2(0.5, 0.5) }, uHalo2Col: { value: lin('#ffcf8f') }, uHalo2R: { value: 0.2 }, uHalo2I: { value: 0.0 },
};
const CAUSTIC = /* glsl */`
vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float caust(vec2 p, float t){
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 o = hash2(i + g); o = 0.5 + 0.45 * sin(t + 6.2831 * o);
    vec2 rr = g + o - f; float d = dot(rr, rr);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return 1.0 - smoothstep(0.0, 0.16, sqrt(d2) - sqrt(d1));
}`;
const bgMat = new THREE.ShaderMaterial({
  uniforms: bgU, depthWrite: false, depthTest: false, toneMapped: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
  fragmentShader: `varying vec2 vUv;
uniform vec3 uC0, uC1, uHaloCol, uS0, uS1, uCaustCol, uHalo2Col; uniform vec2 uCenter, uHalo, uHalo2; uniform float uHaloR, uHaloI, uSplit, uAspect, uTime, uCaust, uHalo2R, uHalo2I;
${CAUSTIC}
void main(){
  vec2 p = vUv;
  float rr = length((p - uCenter) * vec2(uAspect, 1.0));
  vec3 col = mix(uC0, uC1, smoothstep(0.0, 0.75, rr));
  if (uSplit > 0.0) { float s = smoothstep(uSplit - 0.003, uSplit + 0.003, p.x); col = mix(uS0, uS1, s) * (1.0 - 0.22 * smoothstep(0.25, 0.9, rr)); }
  float hr = length((p - uHalo) * vec2(uAspect, 1.0));
  col += uHaloCol * uHaloI * exp(-pow(hr / uHaloR, 2.0) * 1.4);
  float hr2 = length((p - uHalo2) * vec2(uAspect, 1.0));
  col += uHalo2Col * uHalo2I * exp(-pow(hr2 / uHalo2R, 2.0) * 1.4);
  float c =caust(vec2(p.x * uAspect, p.y) * 9.0, uTime * 0.9) * 0.6 + caust(vec2(p.x * uAspect, p.y) * 15.0 + 3.1, uTime * 1.3) * 0.4;
  col += uCaustCol * pow(c, 2.2) * uCaust * (1.0 - smoothstep(0.04, 0.3, hr));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
});
const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat); bgQuad.frustumCulled = false; bgQuad.renderOrder = -1000; scene.add(bgQuad);

// Kaustik-Licht auf dem Boden (additiv)
const cauU = { uTime: { value: 0 }, uI: { value: 0.0 }, uCol: { value: lin(TIEFE.kaustik) } };
const caustics = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShaderMaterial({
  uniforms: cauU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec2 vUv; uniform float uTime, uI; uniform vec3 uCol;
${CAUSTIC}
void main(){ vec2 p = vUv * 11.0; float c = caust(p, uTime * 1.1) * 0.6 + caust(p * 1.7 + 3.1, uTime * 1.5) * 0.4;
  float m = 1.0 - smoothstep(0.12, 0.5, length(vUv - 0.5));
  gl_FragColor = vec4(uCol * pow(c, 2.4) * m * uI, 1.0);
  #include <colorspace_fragment>
}`,
}));
caustics.rotation.x = -Math.PI / 2; caustics.position.y = 0.006; caustics.renderOrder = 2; scene.add(caustics);

const key = new THREE.DirectionalLight('#ffffff', 2.6); key.position.set(-3.5, 7, 5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -3, near: 0.5, far: 25 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const fill = new THREE.HemisphereLight('#eefaff', '#0b2a33', 0.6); scene.add(fill);
const rim = new THREE.PointLight('#bff1ff', 30, 14, 2); rim.position.set(2.8, 3.6, -3.2); scene.add(rim);
const lamp = new THREE.PointLight('#ffb766', 0, 9, 1.6); scene.add(lamp);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.45 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

function mood(m) {
  lamp.intensity = 0; bgU.uSplit.value = 0; bgU.uHaloI.value = 0; bgU.uHalo2I.value = 0; bgU.uCaust.value = 0; cauU.uI.value = 0;
  scene.environment = ENV.tiefe; scene.environmentIntensity = 1.0; key.intensity = 2.6; key.color.set('#ffffff'); fill.intensity = 0.6; fill.color.set('#eefaff'); fill.groundColor.set('#0b2a33'); rim.intensity = 30; floor.material.opacity = 0.45;
  bgU.uC0.value.set(TIEFE.mitte); bgU.uC1.value.set(TIEFE.rand); bgU.uCenter.value.set(0.5, 0.56);
  if (m === 'abend') {
    // Tiefe am Abend: dunklerer Petrol-Grund, Produktlicht bleibt neutral (Weiss bleibt weiss), Lampe nur als warmer Akzent
    scene.environmentIntensity = 0.85; key.intensity = 2.0; fill.intensity = 0.45;
    bgU.uC0.value.set('#174d5a'); bgU.uC1.value.set('#03141a'); bgU.uCenter.value.set(0.42, 0.56);
  }
  return m;
}
// Lichthof hinter einem Weltpunkt (projiziert) -> Glas/Wasser leuchten von hinten
function haloAt(world, radius = 0.2, I = 0.9) {
  const v = world.clone().project(cam); bgU.uHalo.value.set((v.x + 1) / 2, (v.y + 1) / 2); bgU.uHaloR.value = radius; bgU.uHaloI.value = I;
}

// ---------- Objekte ----------
const W = WM.makeDispenser('weiss'); scene.add(W.group);
const SW = WM.makeDispenser('schwarz'); scene.add(SW.group);
for (const D of [W, SW]) { D.ledMat.emissive.set('#79e6ff'); }
const csW = contactShadow(3.2, 0.55), csS = contactShadow(3.2, 0.55); scene.add(csW, csS);
const G = WM.makeGlass(); scene.add(G.group);
const G2 = WM.makeGlass(); scene.add(G2.group);
for (const gl of [G, G2]) { gl.mat.opacity = 0.16; gl.water.material.attenuationColor.set('#a9ecfb'); gl.water.material.attenuationDistance = 2.6; }
const J = WM.makeJug(); scene.add(J.group); J.water.material.attenuationColor.set('#a9ecfb'); J.water.material.attenuationDistance = 3.0;
const stream = WM.makeStream(); scene.add(stream); stream.material.emissive.set('#d8f8ff'); stream.material.emissiveIntensity = 0.12;
const R = rng(21);
const drops = []; for (let i = 0; i < 12; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.018 + R() * 0.02, 12, 8), WM.waterMat()); scene.add(d); drops.push({ m: d, a: R() * 6.28, v: 0.5 + R(), o: R() }); }
const bubbles = []; for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.012 + R() * 0.016, 10, 8), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.7, envMapIntensity: 2.4 })); scene.add(b); bubbles.push({ m: b, x: (R() - 0.5) * 0.4, z: (R() - 0.5) * 0.4, v: 0.5 + R() * 0.7, o: R() }); }
// LED-Leuchten (additiv) an den Tasten
const glowTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(220,250,255,1)'); gr.addColorStop(0.25, 'rgba(120,230,255,0.55)'); gr.addColorStop(1, 'rgba(120,230,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const glows = W.buttons.map((b) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); s.scale.setScalar(0.42); s.position.set(0, 0.06, 0); b.add(s); return s; });
// Flaschen-Chaos
const pets = []; const P0 = [[-1.6, 0.6], [-0.9, 1.1], [-0.2, 1.35], [0.6, 1.2], [1.4, 0.8], [-1.25, -0.1], [1.1, 0.05], [-0.4, 0.55], [0.35, 0.5], [1.7, -0.5], [-1.8, -0.6]];
P0.forEach(([x, z], i) => { const p = WM.makePet(i + 3); p.children[0].material.opacity = 0.42; scene.add(p); pets.push({ m: p, x, z, ry: R() * 6, tip: R() < 0.3 ? (R() - 0.5) * 2.6 : 0, d: R() }); });
// Schlauch
let tube = null;
function tubeAt(dip) {
  if (tube) { scene.remove(tube.mesh); tube.mesh.geometry.dispose(); }
  const jx = 2.5, jz = -1.9;
  const pts = [v3(0, 0.16, -1.13), v3(0.05, 0.08, -1.45), v3(0.6, 0.04, -2.1), v3(1.6, 0.05, -2.45), v3(2.25, 0.9, -2.3), v3(2.45, 2.55, -2.0), v3(jx, 3.15 - dip * 0.1, jz), v3(jx, 3.0 - dip, jz)];
  tube = WM.makeTube(pts, 0.034); tube.mat.opacity = 0.95; scene.add(tube.mesh); return tube;
}
// USB-Stecker
const plug = new THREE.Group(); scene.add(plug);
{ const pm = new THREE.MeshPhysicalMaterial({ color: '#f2f1ee', roughness: 0.4 }); const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.26), pm); head.position.z = -0.13; plug.add(head);
  const pin = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: '#cfcfcf', metalness: 1, roughness: 0.2 })); pin.position.z = 0.04; plug.add(pin);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v3(0, 0, -0.26), v3(0, -0.02, -0.7), v3(0.15, -0.12, -1.3), v3(0.6, -0.15, -2.4)]), 40, 0.025, 10), pm); plug.add(cable); }
// Requisiten
const props = new THREE.Group(); scene.add(props);
const wood = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#b98b5e'; g.fillRect(0, 0, w, h); const Rr = rng(5); for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(${90 + Rr() * 40},${55 + Rr() * 25},${30},${0.12 + Rr() * 0.18})`; g.lineWidth = 1 + Rr() * 4; g.beginPath(); const y = Rr() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 8 + (Rr() - 0.5) * 6); g.stroke(); } });
wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 2);
const desk = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 8), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.55, clearcoat: 0.2 })); desk.position.y = -0.15; desk.receiveShadow = true; props.add(desk);
const lap = new THREE.Group(); props.add(lap);
{ const al = new THREE.MeshStandardMaterial({ color: '#c9c9cb', metalness: 0.8, roughness: 0.35 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.8), al); b.position.y = 0.04; b.castShadow = true; lap.add(b);
  const scrG = new THREE.Group(); scrG.position.set(0, 0.08, -0.9); scrG.rotation.x = -0.32; lap.add(scrG);
  const s = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.75, 0.05), al); s.position.y = 0.875; s.castShadow = true; scrG.add(s);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(2.42, 1.58), new THREE.MeshBasicMaterial({ map: canvasTex(512, 340, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e9f4f5'); gr.addColorStop(1, '#bcd6da'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(11,42,51,.8)'; g.fillRect(40, 40, 200, 18); g.fillStyle = 'rgba(11,42,51,.3)'; for (let i = 0; i < 6; i++) g.fillRect(40, 90 + i * 30, 300 - i * 25, 10); g.fillStyle = 'rgba(31,98,115,.7)'; g.fillRect(380, 90, 90, 170); }) }));
  disp.position.set(0, 0.875, 0.027); scrG.add(disp);
  lap.position.set(-2.0, 0, -1.2); lap.rotation.y = 0.55; }
const plant = new THREE.Group(); props.add(plant);
{ const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.5, 0.75], [0.54, 0.8], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)), 48), new THREE.MeshPhysicalMaterial({ color: '#c97a5a', roughness: 0.7 })); pot.castShadow = true; plant.add(pot);
  const leaf = new THREE.MeshPhysicalMaterial({ color: '#7fae5c', roughness: 0.45, sheen: 0.3, side: THREE.DoubleSide }); const Rp = rng(8);
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), leaf); l.scale.set(0.35, 1, 0.08); const a = i / 9 * Math.PI * 2; l.position.set(Math.cos(a) * 0.28, 1.35 + Rp() * 0.5, Math.sin(a) * 0.28); l.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5); l.castShadow = true; plant.add(l); }
  plant.position.set(1.75, 0, -1.5); }
const nstand = new THREE.Group(); props.add(nstand);
{ const lampG = new THREE.Group(); nstand.add(lampG); lampG.position.set(2.1, 0, -1.0);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.12, 32), new THREE.MeshStandardMaterial({ color: '#2a241c', metalness: 0.6, roughness: 0.3 })); foot.position.y = 0.06; lampG.add(foot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 12), foot.material); stem.position.y = 1.2; lampG.add(stem);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 0.9, 48, 1, true), new THREE.MeshStandardMaterial({ color: '#f3dcb3', emissive: new THREE.Color('#ffb766'), emissiveIntensity: 1.6, side: THREE.DoubleSide, roughness: 0.9 }));
  shade.position.y = 2.45; lampG.add(shade); nstand.userData.lampPos = v3(2.1, 2.3, -1.0); }

// ---------- Overlay (helle Schrift auf Petrol) ----------
const CR = BR.C.creme;
const O = {
  pillA: BR.pill('Werbung', { x: 84, y: 208, dark: true }),
  head1: BR.headline([[{ t: 'Wasser' }, { t: 'auf' }], [{ t: 'Knopfdruck.', gold: true }]], { y: 262, size: 112, color: CR }),
  corners: BR.corners({ x0: 64, y0: 200, x1: 912, y1: 1490 }),
  head2: BR.headline([[{ t: 'Schluss' }, { t: 'mit' }], [{ t: 'Flaschenchaos.', gold: true }]], { y: 250, size: 104, color: CR, width: 900 }),
  step: BR.step({ y: 228, dark: true }),
  head3: BR.headline([[{ t: 'Glas' }, { t: 'voll.', gold: true }]], { y: 250, size: 122, color: CR }),
  head4: BR.headline([[{ t: 'Wieder' }], [{ t: 'aufladbar.', gold: true }]], { y: 250, size: 112, color: CR }),
  head5: BR.headline([[{ t: 'Fürs' }, { t: 'Büro.', gold: true }]], { y: 250, size: 116, color: CR }),
  head6: BR.headline([[{ t: 'Und' }, { t: 'zuhause.', gold: true }]], { y: 250, size: 116, color: CR }),
  head7: BR.headline([[{ t: 'In' }, { t: 'zwei' }], [{ t: 'Farben.', gold: true }]], { y: 236, size: 104, color: CR }),
  seal: BR.seal({ x: 690, y: 214, size: 226 }),
  vl: BR.vlabels(['Weiß', 'Schwarz'], ['#f4f2ee', '#1d2431'], [CR, BR.C.tinte]),
  ripple: BR.ripple(),
  end: BR.endcard({ name: 'Wasserspender <b>Schreibtisch</b>', price: '38,99&nbsp;€', colors: 'Weiß · Schwarz' }),
  pillE: BR.pill('Werbung', { y: 172, dark: true, center: true }),
  streak: BR.streak(), flash: BR.flash(), grain: BR.grain({ amount: 0.06, vig: 'rgba(0,12,16,.42)' }),
};
// Akku-Symbol (hell auf Petrol)
const batt = (() => { const d = document.createElement('div'); d.className = 'abs'; d.style.left = '84px'; d.style.top = '560px';
  d.innerHTML = `<svg width="300" height="140" viewBox="0 0 300 140"><rect x="6" y="20" width="250" height="100" rx="22" fill="none" stroke="#E9CD8C" stroke-width="8"/><rect x="262" y="50" width="22" height="40" rx="8" fill="#E9CD8C"/><rect class="f" x="22" y="36" width="0" height="68" rx="12" fill="#D8B56C"/><path class="z" d="M150 30 L118 76 H146 L134 112 L176 60 H148 Z" fill="#F5F0E6"/></svg>`;
  document.getElementById('ov').appendChild(d); const f = d.querySelector('.f');
  return (tl) => { d.style.opacity = tl < 0 ? 0 : ease.out(seg(tl, 0, 0.25)); d.style.visibility = tl < 0 ? 'hidden' : 'visible'; if (tl >= 0) f.setAttribute('width', 218 * ease.inOut(seg(tl, 0.2, 0.9))); }; })();
const stageCanvas = r.domElement;

// ---------- Zustaende ----------
const WATER0 = 6.35, WATER1 = 8.4;
function water(t, on0 = WATER0, on1 = WATER1, glass = G, disp = W, maxH = 1.02) {
  const h = maxH * ease.inOut(seg(t, on0 + 0.15, on1));
  const nz = disp.group.localToWorld(WM.NOZZLE.clone());
  const gw = glass.group.position;
  const surf = gw.y + 0.06 + h;
  glass.water.visible = h > 0.004;
  if (glass.water.visible) { glass.water.geometry.dispose(); glass.water.geometry = WM.waterGeometry(h, t, t > on0 && t < on1 + 0.2 ? 1 : 0); }
  stream.visible = false; drops.forEach((d) => (d.m.visible = false)); bubbles.forEach((b) => (b.m.visible = false));
  if (t > on0 && t < on1 + 0.2) {
    const bot = Math.max(surf, nz.y - (t - on0) * 9);
    const top = t > on1 ? nz.y - (t - on1) * 9 : nz.y;
    if (top > bot) { stream.visible = true; stream.position.set(nz.x, (top + bot) / 2, nz.z); stream.scale.set(1 + 0.06 * Math.sin(t * 50), top - bot, 1 + 0.06 * Math.cos(t * 43)); }
    if (bot <= surf + 0.01) drops.forEach((d) => { const lt = ((t * 2.2 + d.o) % 0.4) / 0.4; d.m.visible = true; const rr = 0.04 + lt * 0.16 * d.v; d.m.position.set(nz.x + Math.cos(d.a) * rr, surf + Math.sin(lt * Math.PI) * 0.16 * d.v, nz.z + Math.sin(d.a) * rr); });
    bubbles.forEach((b) => { const lt = ((t * b.v * 0.9 + b.o) % 1); const y = gw.y + 0.1 + lt * Math.max(0.05, h - 0.05); if (h > 0.1) { b.m.visible = true; b.m.position.set(gw.x + b.x * 0.6, y, gw.z + b.z * 0.6); } });
  }
  return h;
}
function placeDisp(D, cs, x = 0, z = 0, ry = 0, y = 0) { D.group.visible = true; D.group.position.set(x, y, z); D.group.rotation.set(0, ry, 0); D.group.updateMatrixWorld(true); cs.visible = true; cs.position.set(x, 0.003, z - 0.3); cs.scale.setScalar(1); cs.material.opacity = 1; }
function glassOn(D, glass, drop = 0, show = true) { D.group.updateMatrixWorld(true); glass.group.visible = show; const p = D.group.localToWorld(WM.GLAS_POS.clone()); glass.group.position.set(p.x, p.y + drop, p.z); glass.group.rotation.set(0, 0, 0); }
const screen = (obj, local) => { const v = obj.localToWorld(local.clone()); v.project(cam); return [(v.x + 1) / 2 * 1080, (1 - v.y) / 2 * 1920]; };
const glassMid = (gl, h = 0.65) => v3(gl.group.position.x, gl.group.position.y + h, gl.group.position.z);
function causticsAt(x, z, I = 0.55, size = 1) { caustics.visible = true; caustics.position.set(x, 0.006, z); caustics.scale.setScalar(size); cauU.uI.value = I; }

const SHOTS = [
  [0, 1.5, 'held'], [1.5, 2.75, 'chaos'], [2.75, 4.0, 'schlauch'], [4.0, 5.0, 'glas'], [5.0, 6.0, 'tippen'], [6.0, 7.25, 'strahl'],
  [7.25, 8.5, 'voll'], [8.5, 9.5, 'akku'], [9.5, 10.25, 'buero'], [10.25, 11.0, 'zuhause'], [11.0, 12.0, 'farben'], [12.0, 14.0, 'ende'],
];
export const DAUER = 14.0;

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const lt = t - t0, sp = seg(t, t0, t1);
  for (const o of [W.group, SW.group, csW, csS, G.group, G2.group, J.group, stream, plug, props, lap, plant, nstand, desk, caustics]) o.visible = false;
  if (tube) tube.mesh.visible = false;
  pets.forEach((p) => (p.m.visible = false)); drops.forEach((d) => (d.m.visible = false)); bubbles.forEach((b) => (b.m.visible = false));
  W.ledMat.emissiveIntensity = 0; glows.forEach((g) => (g.visible = false)); W.buttons.forEach((b) => (b.position.y = 0.4)); G2.water.visible = false;
  stageCanvas.style.filter = ''; floor.visible = true;
  bgU.uTime.value = t; cauU.uTime.value = t;
  let md = mood('tiefe');
  const ledOn = (I = 3, glow = false) => { W.ledMat.emissiveIntensity = I; if (glow) glows.forEach((g) => { g.visible = true; g.scale.setScalar(0.27 + 0.03 * Math.sin(t * 9)); }); };

  if (name === 'held') {
    placeDisp(W, csW, 0, 0, -0.5); glassOn(W, G); water(t, -0.6, 1.7, G, W, 1.0); ledOn(3);
    cam.fov = 26; aim(cam, vlerp(v3(1.6, 1.1, 12.6), v3(1.3, 1.25, 11.2), ease.out(sp)), vlerp(v3(-0.25, 1.6, -0.3), v3(-0.25, 1.62, -0.3), sp));
    haloAt(glassMid(G), 0.17, 1.0); bgU.uCaust.value = 0.12; causticsAt(0, -0.3, 0.6);
    rim.position.set(lerp(3, -3, sp), 3.6, -3.2);
  } else if (name === 'chaos') {
    const sweep = seg(t, 1.95, 2.45);
    const reveal = ease.outBack(seg(t, 2.25, 2.7));
    pets.forEach((p) => {
      p.m.visible = true;
      const k = clamp((sweep * 4.2) - (p.x + 2) / 4 * 3.2);
      const fly = ease.in(k);
      p.m.position.set(p.x + fly * 7, fly * 2.5 + Math.sin(fly * Math.PI) * 1.2, p.z - fly * 1.5);
      p.m.rotation.set(p.tip * (1 - fly) + fly * 4 * (p.d - 0.5), p.ry + fly * 6, (p.tip ? Math.sign(p.tip) * 1.45 : 0) * (1 - fly) - fly * 3);
      if (p.tip) { p.m.position.y += 0.24 * (1 - fly); }
    });
    if (reveal > 0) { placeDisp(W, csW, 0, -0.4, -0.5); W.group.scale.setScalar(Math.max(0.001, reveal)); csW.material.opacity = clamp(reveal); } else W.group.scale.setScalar(1);
    cam.fov = 30; aim(cam, vlerp(v3(0.6, 4.9, 10.8), v3(0.5, 4.6, 9.9), ease.out(sp)), v3(0, 1.75, 0.2));
    haloAt(v3(0, 1.0, -0.2), 0.3, 0.45 + 0.4 * clamp(reveal));
  } else if (name === 'schlauch') {
    placeDisp(W, csW, 0, 0, 0); J.group.visible = true; J.group.position.set(2.5, 0, -1.9); J.cap.visible = false;
    const dip = 1.5 * ease.inOut(seg(t, 2.9, 3.75));
    tubeAt(dip - 0.2).mesh.visible = true;
    cam.fov = 30; aim(cam, vlerp(v3(5.4, 4.6, 3.6), v3(5.0, 4.3, 3.1), ease.out(sp)), v3(2.3, 2.45, -1.9));
    haloAt(v3(2.5, 1.1, -1.9), 0.32, 0.85); bgU.uCaust.value = 0.1;
  } else if (name === 'glas') {
    placeDisp(W, csW, 0, 0, -0.35); W.group.scale.setScalar(1);
    const p = ease.outQuint(seg(t, 4.05, 4.55)); const bounce = t > 4.55 ? Math.exp(-(t - 4.55) * 14) * Math.sin((t - 4.55) * 40) * 0.025 : 0;
    glassOn(W, G, (1 - p) * 2.2 + Math.abs(bounce)); G.water.visible = false;
    cam.fov = 28; aim(cam, vlerp(v3(2.1, 2.6, 9.0), v3(1.8, 2.45, 8.2), ease.out(sp)), v3(0, 1.4, -0.4));
    haloAt(glassMid(G), 0.16, 0.85); causticsAt(0, -0.3, 0.35);
  } else if (name === 'tippen') {
    placeDisp(W, csW, 0, 0, -0.6); glassOn(W, G); G.water.visible = false;
    const press = seg(t, 5.46, 5.5) * (1 - seg(t, 5.64, 5.74));
    W.buttons[0].position.y = 0.4 - 0.012 * press;
    if (t > 5.5) ledOn(3.2, true);
    cam.fov = 30; aim(cam, vlerp(v3(-1.45, 2.05, 3.45), v3(-1.3, 1.9, 3.15), ease.out(sp)), v3(-0.6, 0.62, 0.57));
    haloAt(W.group.localToWorld(v3(-0.25, 0.42, 0.87)), 0.12, t > 5.5 ? 0.5 : 0.0);
  } else if (name === 'strahl') {
    placeDisp(W, csW, 0, 0, -0.35); glassOn(W, G); water(t); ledOn(3.5);
    cam.fov = 30; aim(cam, vlerp(v3(1.5, 2.6, 3.4), v3(1.3, 2.45, 3.0), ease.out(sp)), v3(0, 1.95, -0.45));
    haloAt(v3(G.group.position.x, 1.6, G.group.position.z), 0.2, 0.9); bgU.uCaust.value = 0.1;
  } else if (name === 'voll') {
    placeDisp(W, csW, 0, 0, -0.35); glassOn(W, G); water(t); if (t < 8.4) ledOn(3.5);
    cam.fov = 28; aim(cam, vlerp(v3(-1.8, 1.4, 6.6), v3(-1.6, 1.3, 5.8), ease.out(sp)), v3(0, 1.05, -0.45));
    haloAt(glassMid(G, 0.6), 0.24, 1.0); bgU.uCaust.value = 0.12; causticsAt(0, -0.4, 0.55);
  } else if (name === 'akku') {
    placeDisp(W, csW, 0, 0, Math.PI + 0.55); G.group.visible = false;
    plug.visible = true; const port = W.group.localToWorld(v3(0, 0.16, -1.121));
    const pin = ease.outQuint(seg(t, 8.6, 9.0));
    const dir = v3(0, 0, -1).applyEuler(W.group.rotation);
    plug.position.copy(port.clone().add(dir.clone().multiplyScalar(lerp(0.9, 0.03, pin))));
    plug.rotation.set(0, W.group.rotation.y, 0);
    cam.fov = 30; aim(cam, vlerp(v3(2.47, 1.16, 4.03), v3(2.3, 1.1, 3.75), ease.out(sp)), v3(0.44, 0.53, 1.05));
    haloAt(port, 0.22, 0.55 * ease.out(seg(t, 8.9, 9.2)) + 0.2);
  } else if (name === 'buero') {
    props.visible = desk.visible = lap.visible = plant.visible = true; floor.visible = false;
    placeDisp(W, csW, 0.2, 0, -0.3); glassOn(W, G); G.water.visible = true; G.water.geometry.dispose(); G.water.geometry = WM.waterGeometry(1.02);
    cam.fov = 30; aim(cam, vlerp(v3(0.9, 3.6, 12.6), v3(0.4, 3.5, 11.8), sp), v3(-0.3, 1.25, -0.7));
    haloAt(glassMid(G, 0.6), 0.14, 0.75);
  } else if (name === 'zuhause') {
    md = mood('abend'); props.visible = desk.visible = nstand.visible = true; floor.visible = false;
    lamp.intensity = 7; lamp.position.copy(nstand.userData.lampPos);
    placeDisp(W, csW, -0.3, 0, -0.2); glassOn(W, G); G.water.visible = true; G.water.geometry.dispose(); G.water.geometry = WM.waterGeometry(0.7);
    cam.fov = 28; aim(cam, vlerp(v3(-1.6, 2.6, 9.6), v3(-1.1, 2.55, 8.9), sp), v3(0.3, 1.45, -0.6));
    haloAt(glassMid(G, 0.5), 0.17, 0.85);
    const lp = nstand.userData.lampPos.clone().add(v3(0, 0.15, 0)).project(cam); bgU.uHalo2.value.set((lp.x + 1) / 2, (lp.y + 1) / 2); bgU.uHalo2R.value = 0.26; bgU.uHalo2I.value = 0.3;
  } else if (name === 'farben') {
    [[W, csW, G, -1.12], [SW, csS, G2, 1.12]].forEach(([D, cs, gl, x], i) => {
      const p = ease.outBack(seg(t, t0 + 0.05 + i * 0.1, t0 + 0.6 + i * 0.1));
      placeDisp(D, cs, x, 0, -0.45); D.group.position.y = (1 - p) * -3.8; D.group.updateMatrixWorld(true); cs.material.opacity = p; glassOn(D, gl); gl.water.visible = true; gl.water.geometry.dispose(); gl.water.geometry = WM.waterGeometry(0.95);
    });
    cam.fov = 24; aim(cam, vlerp(v3(0, 2.8, 19.5), v3(0, 2.7, 18.6), ease.out(sp)), v3(0, 1.45, -0.4));
    bgU.uSplit.value = 0.5; floor.material.opacity = 0.3;
  } else if (name === 'ende') {
    placeDisp(W, csW, 0, 0, lerp(-0.9, 0.3, sp)); glassOn(W, G); G.water.visible = true; G.water.geometry.dispose(); G.water.geometry = WM.waterGeometry(1.02);
    cam.fov = 26; aim(cam, vlerp(v3(0, 1.4, 22.5), v3(0, 1.3, 21.4), ease.out(sp)), v3(0, 0.5, -0.4));
    haloAt(v3(0, 1.0, -0.5), 0.2, 0.8); bgU.uCaust.value = 0.05; causticsAt(0, -0.3, 0.4);
    rim.position.set(2.6, 3.4, -2.8);
  }
  if (name !== 'chaos') W.group.scale.setScalar(1);
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  O.pillA(t < 1.5 ? 1 - seg(t, 1.38, 1.5) : 0);
  O.head1(t < 1.5 ? t - 0.04 : -1, seg(t, 1.36, 1.5));
  O.corners(t < 1.5 ? t : -1, seg(t, 1.36, 1.5));
  O.head2(t >= 1.55 && t < 2.75 ? t - 1.55 : -1, seg(t, 2.6, 2.75));
  const steps = [[2.75, '01', 'Schlauch rein'], [4.0, '02', 'Glas drauf'], [5.0, '03', 'Antippen']];
  const st = [...steps].reverse().find((s) => t >= s[0]);
  O.step(st && t < 7.25 ? t - st[0] : -1, st ? st[1] : '', st ? st[2] : '', seg(t, 7.1, 7.25));
  O.head3(t >= 7.4 && t < 8.5 ? t - 7.4 : -1, seg(t, 8.36, 8.5));
  O.head4(t >= 8.55 && t < 9.5 ? t - 8.55 : -1, seg(t, 9.38, 9.5));
  batt(t >= 8.6 && t < 9.5 ? t - 8.6 : -1);
  O.head5(t >= 9.52 && t < 10.25 ? t - 9.52 : -1, seg(t, 10.15, 10.25));
  O.head6(t >= 10.27 && t < 11.0 ? t - 10.27 : -1, seg(t, 10.9, 11.0));
  O.head7(t >= 11.03 && t < 12 ? t - 11.03 : -1, seg(t, 11.88, 12.0));
  O.seal(t >= 11.15 && t < 12 ? t - 11.15 : -1, seg(t, 11.88, 12.0));
  if (name === 'farben') O.vl([W, SW].map((D) => { const p = screen(D.group, v3(0, 0, 1.05)); return [p[0], p[1] + 30]; }), t - 11.0); else O.vl([], -1);
  if (name === 'tippen') { const p = screen(W.buttons[0], v3(0, 0.02, 0)); O.ripple(p[0], p[1], t - 5.5); } else O.ripple(0, 0, -1);
  O.end(t >= 12 ? t - 12 : -1, 0);
  O.pillE(t >= 12 ? ease.out(seg(t, 12.05, 12.35)) : 0);
  O.streak(t > 1.3 && t < 1.7 ? seg(t, 1.34, 1.66) : t > 1.9 && t < 2.5 ? seg(t, 1.95, 2.45) : t > 11.8 && t < 12.2 ? seg(t, 11.84, 12.16) : 0);
  O.flash(0);
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
