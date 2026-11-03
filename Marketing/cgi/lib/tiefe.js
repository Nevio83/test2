// Maios Motion – Farbwelt "Tiefe" als Baustein: Petrol-Hintergrund (auch durch Glas sichtbar), Lichthoefe, Licht, Boden
import * as THREE from 'three';
import { v3 } from './core.js';

export const TIEFE = { mitte: '#1f6273', rand: '#05181e', halo: '#c9f3ff', kaustik: '#8fe9ff', hell: '#e4eff0', nacht: '#0e3542', nachtRand: '#03121a' };

export function stripEnv(r, { bg, strips, top }) {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  s.add(new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: bg, side: THREE.BackSide })));
  const add = (w, h, pos, col, I) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(I), side: THREE.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); s.add(m); };
  for (const st of strips) add(st.w, st.h, st.pos, st.col, st.I);
  if (top) add(top.w, top.h, v3(0, 5.8, 0), top.col, top.I);
  const pm = new THREE.PMREMGenerator(r); const tex = pm.fromScene(s, 0.02).texture; pm.dispose(); return tex;
}

export const CAUSTIC = /* glsl */`
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

export function makeTiefe(r, scene, cam) {
  const lin = (h) => new THREE.Color(h);
  const U = {
    uC0: { value: lin(TIEFE.mitte) }, uC1: { value: lin(TIEFE.rand) }, uCenter: { value: new THREE.Vector2(0.5, 0.56) },
    uHalo: { value: new THREE.Vector2(0.5, 0.5) }, uHaloCol: { value: lin(TIEFE.halo) }, uHaloR: { value: 0.2 }, uHaloI: { value: 0.0 },
    uHalo2: { value: new THREE.Vector2(0.5, 0.5) }, uHalo2Col: { value: lin('#ffcf8f') }, uHalo2R: { value: 0.2 }, uHalo2I: { value: 0.0 },
    uSplit: { value: 0.0 }, uS0: { value: lin('#0d3a46') }, uS1: { value: lin(TIEFE.hell) }, uAspect: { value: 1080 / 1920 },
    uTime: { value: 0 }, uCaust: { value: 0.0 }, uCaustCol: { value: lin(TIEFE.kaustik) }, uStars: { value: 0.0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: `varying vec2 vUv;
uniform vec3 uC0, uC1, uHaloCol, uHalo2Col, uS0, uS1, uCaustCol; uniform vec2 uCenter, uHalo, uHalo2;
uniform float uHaloR, uHaloI, uHalo2R, uHalo2I, uSplit, uAspect, uTime, uCaust, uStars;
${CAUSTIC}
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main(){
  vec2 p = vUv;
  float rr = length((p - uCenter) * vec2(uAspect, 1.0));
  vec3 col = mix(uC0, uC1, smoothstep(0.0, 0.75, rr));
  if (uSplit > 0.0) { float s = smoothstep(uSplit - 0.003, uSplit + 0.003, p.x); col = mix(uS0, uS1, s) * (1.0 - 0.22 * smoothstep(0.25, 0.9, rr)); }
  float hr = length((p - uHalo) * vec2(uAspect, 1.0));
  col += uHaloCol * uHaloI * exp(-pow(hr / uHaloR, 2.0) * 1.4);
  float hr2 = length((p - uHalo2) * vec2(uAspect, 1.0));
  col += uHalo2Col * uHalo2I * exp(-pow(hr2 / uHalo2R, 2.0) * 1.4);
  float c = caust(vec2(p.x * uAspect, p.y) * 9.0, uTime * 0.9) * 0.6 + caust(vec2(p.x * uAspect, p.y) * 15.0 + 3.1, uTime * 1.3) * 0.4;
  col += uCaustCol * pow(c, 2.2) * uCaust * (1.0 - smoothstep(0.04, 0.3, hr));
  if (uStars > 0.0) {   // feine Sterne im Nachthimmel (funkeln leicht)
    vec2 g = vec2(p.x * uAspect, p.y) * 160.0; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
    float h = h21(id); float s = step(0.986, h) * smoothstep(0.12, 0.0, length(f + (vec2(h21(id + 1.7), h21(id + 3.1)) - 0.5) * 0.6));
    col += vec3(0.85, 0.93, 1.0) * s * uStars * (0.6 + 0.4 * sin(uTime * 3.0 + h * 40.0)) * smoothstep(0.15, 0.6, p.y);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; quad.renderOrder = -1000; scene.add(quad);

  const ENV = {
    tiefe: stripEnv(r, { bg: '#0b2a33', strips: [
      { w: 1.2, h: 9, pos: v3(-5.5, 0, 1.8), col: '#ffffff', I: 7 }, { w: 1.2, h: 9, pos: v3(5.5, 0, 0.8), col: '#eefcff', I: 6 },
      { w: 3.0, h: 9, pos: v3(0, 0, -5.8), col: '#9fe6f5', I: 1.6 }, { w: 2.6, h: 9, pos: v3(-1.5, 0, 5.8), col: '#ffffff', I: 1.8 }], top: { w: 5, h: 5, col: '#ffffff', I: 3.2 } }),
    nacht: stripEnv(r, { bg: '#03111a', strips: [
      { w: 1.0, h: 9, pos: v3(-5.5, 0, 1.8), col: '#cfeaff', I: 2.0 }, { w: 1.0, h: 9, pos: v3(5.5, 0, 0.8), col: '#ffd7a8', I: 1.4 }], top: { w: 4, h: 4, col: '#bcd8ea', I: 0.8 } }),
  };

  const key = new THREE.DirectionalLight('#ffffff', 2.6); key.position.set(-3.5, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 7, bottom: -3, near: 0.5, far: 25 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const fill = new THREE.HemisphereLight('#eefaff', '#0b2a33', 0.6); scene.add(fill);
  const rim = new THREE.PointLight('#bff1ff', 30, 14, 2); rim.position.set(2.8, 3.6, -3.2); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.45 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const cMid = lin(TIEFE.mitte), cRand = lin(TIEFE.rand), nMid = lin(TIEFE.nacht), nRand = lin(TIEFE.nachtRand);
  // room: 1 = helles Tiefe (Licht an), 0 = Nacht (Raumlicht aus)
  function mood(room = 1) {
    U.uSplit.value = 0; U.uHaloI.value = 0; U.uHalo2I.value = 0; U.uCaust.value = 0; U.uStars.value = 0;
    U.uHaloCol.value.set(TIEFE.halo);
    U.uC0.value.copy(nMid).lerp(cMid, room); U.uC1.value.copy(nRand).lerp(cRand, room); U.uCenter.value.set(0.5, 0.56);
    scene.environment = room > 0.5 ? ENV.tiefe : ENV.nacht; scene.environmentIntensity = 0.35 + 0.65 * room;
    key.intensity = 2.6 * room; key.color.set('#ffffff'); fill.intensity = 0.12 + 0.48 * room; fill.color.set('#eefaff'); fill.groundColor.set('#0b2a33');
    rim.intensity = 4 + 26 * room; rim.color.set('#bff1ff'); floor.material.opacity = 0.45 * room + 0.1;
  }
  function haloAt(world, radius = 0.2, I = 0.9, col = null, which = 1) {
    const v = world.clone().project(cam);
    const P = which === 1 ? U.uHalo : U.uHalo2; P.value.set((v.x + 1) / 2, (v.y + 1) / 2);
    (which === 1 ? U.uHaloR : U.uHalo2R).value = radius; (which === 1 ? U.uHaloI : U.uHalo2I).value = I;
    if (col) (which === 1 ? U.uHaloCol : U.uHalo2Col).value.set(col);
  }
  return { U, quad, ENV, key, fill, rim, floor, mood, haloAt };
}
