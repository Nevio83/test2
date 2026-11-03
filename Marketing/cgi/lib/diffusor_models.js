// 3D-Modell: Aroma Öl Diffusor (Produkt 42) – Vulkanform mit Spiralrillen, Lichtring unten, Flammen-Nebel oben
// Masse aus dem Shopfoto: 135 mm breit, 78 mm hoch. Einheit: Durchmesser = 2 (Hoehe 1,156).
import * as THREE from 'three';
import { GLSL_NOISE, v3 } from './core.js';

export const H_TOP = 1.156, R_TOP = 0.31, RING_Y = 0.3;
export const FARBEN = { schwarz: { body: '#1b1b1d', ring: '#b9b9bd' }, weiss: { body: '#efece6', ring: '#bdbdbd' } };

// Form 'shop' (ab 2.11.): nach dem Shopfoto (weiss) – bauchiger Unterteil, Ring auf 36 % Hoehe, gewoelbte Schulter,
// Rillen nur im Band zwischen Ring und Hals, breitere Oeffnung. Hoehe 1,23.
export const SHOP = { H_TOP: 1.23, R_TOP: 0.46, RING_Y: 0.44 };
export function makeDiffusor(farbe = 'schwarz', form = 'alt') {
  const F = FARBEN[farbe]; const shop = form === 'shop';
  const HT = shop ? SHOP.H_TOP : H_TOP, RY = shop ? SHOP.RING_Y : RING_Y;
  const g = new THREE.Group(); g.name = 'diffusor';
  const P = shop ? [[0.0, 0.05], [0.86, 0.05], [0.95, 0.09], [0.995, 0.17], [1.0, 0.27], [0.996, 0.37], [0.99, 0.46], [0.982, 0.55], [0.945, 0.65],
    [0.86, 0.77], [0.73, 0.9], [0.6, 1.03], [0.52, 1.14], [0.48, 1.205], [0.46, 1.23], [0.42, 1.23], [0.405, 1.2], [0.39, 1.18], [0.0, 1.17]] : [[0.0, 0.05], [0.84, 0.05], [0.95, 0.09], [0.995, 0.17], [1.0, 0.24], [0.99, 0.31], [0.955, 0.4], [0.86, 0.52], [0.74, 0.66], [0.6, 0.82],
    [0.47, 0.97], [0.37, 1.09], [0.325, 1.145], [0.31, 1.156], [0.27, 1.156], [0.255, 1.12], [0.24, 1.09], [0.0, 1.08]];
  // fein unterteilen, damit die Rillen sauber werden
  const pts = [];
  for (let i = 0; i < P.length - 1; i++) { const [r0, y0] = P[i], [r1, y1] = P[i + 1]; const n = (shop ? i >= 5 && i <= 13 : i >= 5 && i <= 11) ? (shop ? 16 : 10) : 2; for (let k = 0; k < n; k++) { const t = k / n; pts.push(new THREE.Vector2(r0 + (r1 - r0) * t, y0 + (y1 - y0) * t)); } }
  pts.push(new THREE.Vector2(...P[P.length - 1]));
  const geo = new THREE.LatheGeometry(pts, 360);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {   // Spiralrillen oberhalb des Rings
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); const r = Math.hypot(x, z); if (r < 0.05) continue;
    const th = Math.atan2(z, x); const w = shop ? THREE.MathUtils.smoothstep(y, 0.48, 0.56) * (1 - THREE.MathUtils.smoothstep(y, 0.95, 1.06)) : THREE.MathUtils.smoothstep(y, 0.36, 0.45) * (1 - THREE.MathUtils.smoothstep(y, 1.0, 1.1));
    const gr = Math.pow(0.5 + 0.5 * Math.sin((shop ? 18 : 14) * th + (shop ? 24.0 : 15.0) * y), 3);
    const k = 1 - (shop ? 0.016 : 0.028) * gr * w; pos.setX(i, x * k); pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  const body = new THREE.MeshPhysicalMaterial({ color: F.body, roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.5 });
  const mesh = new THREE.Mesh(geo, body); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  // Lichtring (aus: silbern, an: orange)
  const ringMat = new THREE.MeshStandardMaterial({ color: F.ring, metalness: 0.8, roughness: 0.3, emissive: new THREE.Color('#ff7a2a'), emissiveIntensity: 0 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.998, 0.008, 8, 200), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = RY; g.add(ring);
  // Fuesse
  const footMat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.6 });
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const f = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.05, 24), footMat); f.position.set(Math.cos(a) * 0.62, 0.025, Math.sin(a) * 0.62); g.add(f); }
  // Oeffnung oben (dunkel, darin Wasser mit Lichtschein)
  const hole = new THREE.Mesh(new THREE.CircleGeometry(shop ? 0.39 : 0.245, 48), new THREE.MeshBasicMaterial({ color: '#000' })); hole.rotation.x = -Math.PI / 2; hole.position.y = shop ? 1.172 : 1.082; g.add(hole);
  const glowU = { uI: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.55, 0.18) } };
  const glow = new THREE.Mesh(new THREE.CircleGeometry(shop ? 0.38 : 0.24, 48), new THREE.ShaderMaterial({ uniforms: glowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uI; uniform vec3 uCol; varying vec2 vUv; void main(){ float d = length(vUv-0.5)*2.0; gl_FragColor = vec4(uCol*uI*(1.0-d*d), 1.0); }' }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = shop ? 1.175 : 1.085; g.add(glow);

  // Flammen-Nebel: drei gekreuzte Ebenen mit Rausch-Shader (additiv)
  const flameU = { uTime: { value: 0 }, uI: { value: 0 }, uC0: { value: new THREE.Color('#ff4a0c') }, uC1: { value: new THREE.Color('#ffc66a') } };
  const flameMat = new THREE.ShaderMaterial({
    uniforms: flameU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: 'varying vec2 vUv; varying float vSeed; attribute float seed; void main(){ vUv = uv; vSeed = seed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: GLSL_NOISE + `
uniform float uTime, uI; uniform vec3 uC0, uC1; varying vec2 vUv; varying float vSeed;
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * snoise(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec2 uv = vUv; float y = uv.y;
  float t = uTime;
  float n = fbm(vec3(uv.x * 2.6 + vSeed * 7.0, y * 2.2 - t * 1.6, t * 0.35 + vSeed));
  float n2 = fbm(vec3(uv.x * 5.0 - vSeed * 3.0, y * 4.0 - t * 2.4, t * 0.5));
  float wob = 0.06 * sin(y * 7.0 - t * 3.1 + vSeed * 4.0);
  float hw = mix(0.27, 0.05, pow(y, 0.8));                     // breit unten, spitz oben
  float dx = abs(uv.x - 0.5 - wob - 0.08 * n * y);
  float body = 1.0 - smoothstep(hw * 0.55, hw, dx);
  float f = body * smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.45, 1.0, y + 0.35 * n + 0.15 * n2));
  f = clamp(f * (0.55 + 0.45 * n2), 0.0, 1.0) * (0.8 - 0.25 * y);
  vec3 col = mix(uC1, uC0, smoothstep(0.08, 0.6, y + 0.2 * n));
  gl_FragColor = vec4(col * f * uI, 1.0);
}`,
  });
  const flame = new THREE.Group(); flame.position.y = shop ? 1.16 : 1.07; g.add(flame);
  for (let k = 0; k < 3; k++) {
    const pg = new THREE.PlaneGeometry(0.95, 1.35); pg.translate(0, 0.675, 0);
    pg.setAttribute('seed', new THREE.Float32BufferAttribute(new Array(pg.attributes.position.count).fill(k * 0.37 + 0.1), 1));
    const m = new THREE.Mesh(pg, flameMat); m.rotation.y = k * Math.PI / 3; m.renderOrder = 20; flame.add(m);
  }
  const light = new THREE.PointLight('#ff8a3a', 0, 9, 1.6); light.position.set(0, shop ? 1.7 : 1.6, 0); g.add(light);
  const api = {
    group: g, body, ringMat, flameU, glowU, light, flame,
    set(on, t) {
      const fl = 0.9 + 0.07 * Math.sin(t * 11.3) + 0.05 * Math.sin(t * 23.7 + 1.1) + 0.04 * Math.sin(t * 5.1);
      flameU.uTime.value = t; flameU.uI.value = 0.95 * on; glowU.uI.value = 1.4 * on * fl;
      ringMat.emissiveIntensity = 2.2 * on; light.intensity = 7.5 * on * fl;
    },
  };
  api.set(0, 0);
  return api;
}

// Duftoel-Flaeschchen (Braunglas, schwarzer Deckel)
export function makeOelflasche() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: '#5a2a0c', roughness: 0.12, clearcoat: 1, transmission: 0, metalness: 0 });
  const prof = [[0, 0], [0.16, 0], [0.17, 0.02], [0.17, 0.38], [0.13, 0.45], [0.07, 0.48], [0.07, 0.52], [0, 0.52]].map(([x, y]) => new THREE.Vector2(x, y));
  const b = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), glass); b.castShadow = true; g.add(b);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.2, 32), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5 })); cap.position.y = 0.6; cap.castShadow = true; g.add(cap);
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.2, 48, 1, true), new THREE.MeshStandardMaterial({ color: '#e8e2d4', roughness: 0.8 })); lab.position.y = 0.2; g.add(lab);
  return g;
}
