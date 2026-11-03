// Maios CGI – Krystall Ball Nachtlampe (Produkt 50): Holzsockel mit LED, Glaskugel, Gravur als Lichtpunkte
// Masse aus den Produktfotos: Kugel-Durchmesser = 2 Einheiten, Sockel ~1,1 x Kugel breit, ~0,28 x Kugel hoch.
import * as THREE from 'three';
import { canvasTex, rng, v3 } from './core.js';

export const R_BALL = 1.0;
export const BASE_R = 1.1, BASE_H = 0.56;
export const BALL_Y = 1.3;                 // Kugelmitte (liegt auf dem Rand der Mulde)
export const LED_Y = 0.245;
export const PORT = new THREE.Vector3(0, 0.2, -1.1);   // USB-Buchse hinten

// ---------- Holz (Buche, hell) ----------
export function woodTex(seed = 3, base = '#e4c79f', line = [176, 132, 86]) {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const R = rng(seed);
    for (let i = 0; i < 260; i++) {           // Maserung laeuft senkrecht (u = Umfang, v = Hoehe)
      const x0 = R() * w, a = 0.05 + R() * 0.16, lw = 0.6 + R() * 2.6, wob = 4 + R() * 14, ph = R() * 6;
      g.strokeStyle = `rgba(${line[0]},${line[1]},${line[2]},${a})`; g.lineWidth = lw; g.beginPath();
      for (let y = 0; y <= h; y += 16) { const x = x0 + Math.sin(y * 0.006 + ph) * wob + Math.sin(y * 0.021 + ph * 2) * wob * 0.3; y ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${line[0] - 30},${line[1] - 30},${line[2] - 20},${0.05 + R() * 0.08})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 3 + R() * 9); }  // Markstrahlen
  });
}

// ---------- Sockel ----------
export function makeBase(tex) {
  const g = new THREE.Group(); g.name = 'sockel';
  const P = [[0, 0], [1.04, 0], [1.085, 0.012], [1.1, 0.045], [1.1, 0.51], [1.088, 0.548], [1.055, 0.56], [0.7, 0.56], [0.665, 0.552], [0.645, 0.53],
    [0.63, 0.4], [0.55, 0.262], [0.0, 0.24]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(P, 160);
  // Oberseite und Mulde planar mappen (gerade Maserung), Seite im Umfang
  const pos = geo.attributes.position, uv = geo.attributes.uv; geo.computeVertexNormals(); const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(nrm.getY(i)) > 0.6) uv.setXY(i, 0.5 + pos.getX(i) * 0.28, 0.5 + pos.getZ(i) * 0.28);
    else uv.setXY(i, uv.getX(i) * 2.0, pos.getY(i) * 0.55);
  }
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const wood = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.62, clearcoat: 0.08, clearcoatRoughness: 0.6, sheen: 0.15, sheenColor: new THREE.Color('#fff2dc') });
  const body = new THREE.Mesh(geo, wood); body.castShadow = true; body.receiveShadow = true; g.add(body);
  // LED-Flaeche in der Mulde
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#5b5045') });
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.3, 48), ledMat); led.rotation.x = -Math.PI / 2; led.position.y = LED_Y + 0.003; g.add(led);
  // USB-Buchse hinten
  const port = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.075, 0.03), new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5 }));
  port.position.copy(PORT); port.position.z += 0.005; g.add(port);
  const portRim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.105, 0.02), new THREE.MeshStandardMaterial({ color: '#9c9c9c', metalness: 1, roughness: 0.3 }));
  portRim.position.copy(PORT); portRim.position.z += 0.012; g.add(portRim);
  return { group: g, wood, ledMat, body };
}

// ---------- Glaskugel ----------
const GLASS_VS = /* glsl */`
varying vec3 vN; varying vec3 vW; varying vec3 vL;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const GLASS_FS = /* glsl */`
uniform vec3 uRim; uniform float uRimI; uniform float uSpec; uniform vec3 uWarm; uniform float uOn; uniform float uBack; uniform float uDark;
uniform vec3 uK1; uniform vec3 uK2;
varying vec3 vN; varying vec3 vW; varying vec3 vL;
void main(){
  vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  float f = 1.0 - clamp(abs(dot(N, V)), 0.0, 1.0);          // 0 Mitte, 1 Silhouette
  float thin = smoothstep(0.8, 0.975, f);                     // heller Randstrich
  float ring = smoothstep(0.32, 0.78, f) * (1.0 - thin);      // dunkler Glasrand (Vollglas)
  vec3 R = reflect(-V, N);
  float g1 = pow(max(dot(R, normalize(uK1)), 0.0), 1600.0) * 3.0;  // kleine, harte Glanzpunkte
  float g2 = pow(max(dot(R, normalize(uK2)), 0.0), 900.0) * 1.6;
  float win = smoothstep(0.975, 0.993, dot(R, normalize(uK1))) * 0.18;
  float hy = clamp(vL.y, -1.0, 1.0);
  float warm = uOn * (smoothstep(-0.45, -1.0, hy) * 0.75 + thin * 0.55 + ring * 0.18);
  vec3 col = uRim * thin * uRimI + vec3(1.0, 0.99, 0.97) * (g1 + g2 + win) * uSpec + uWarm * warm;
  float a = clamp(ring * uDark + thin * 0.25, 0.0, 0.9);
  gl_FragColor = vec4(col * uBack, a * uBack);
}`;
export function glassMat(side) {
  return new THREE.ShaderMaterial({
    uniforms: { uRim: { value: new THREE.Color('#e6f8ff') }, uRimI: { value: 0.9 }, uSpec: { value: side === THREE.BackSide ? 0.0 : 1.0 }, uWarm: { value: new THREE.Color('#ffc277') }, uOn: { value: 0 },
      uBack: { value: side === THREE.BackSide ? 0.5 : 1.0 }, uDark: { value: side === THREE.BackSide ? 0.12 : 0.34 }, uK1: { value: v3(-0.55, 0.62, 0.55) }, uK2: { value: v3(0.75, 0.25, 0.6) } },
    vertexShader: GLASS_VS, fragmentShader: GLASS_FS, transparent: true, depthWrite: false, side,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

// weicher Lichtfleck (additiv)
export function glowTex(stops = [[0, 'rgba(255,236,200,1)'], [0.3, 'rgba(255,196,120,0.55)'], [1, 'rgba(255,170,90,0)']]) {
  return canvasTex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); for (const [o, c] of stops) gr.addColorStop(o, c); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
}
const GLOW = glowTex();
const CAP = glowTex([[0, 'rgba(255,240,205,1)'], [0.55, 'rgba(255,214,140,0.9)'], [0.8, 'rgba(255,190,110,0.35)'], [1, 'rgba(255,170,90,0)']]);
function addMat(map, color = '#ffffff') { return new THREE.MeshBasicMaterial({ map, color: new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }); }

// ---------- Gravur: Lichtpunkte im Glas ----------
const PT_VS = /* glsl */`
attribute float aB; uniform float uSize; uniform float uScale; uniform float uR;
varying float vB; varying float vDepth;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vDepth = clamp((c.z - mv.z) / uR * 0.5 + 0.5, 0.0, 1.0);          // 1 = weit hinten
  gl_PointSize = max(1.0, uSize * uScale / -mv.z);
  float lift = 1.12 - 0.42 * clamp((position.y / uR + 1.0) * 0.5, 0.0, 1.0); // unten heller (LED)
  vB = aB * lift; }`;
const PT_FS = /* glsl */`
uniform vec3 uCol; uniform float uI; uniform float uBackDim;
varying float vB; varying float vDepth;
void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.05, length(d));
  float k = mix(1.0, uBackDim, smoothstep(0.35, 0.95, vDepth));
  gl_FragColor = vec4(uCol * vB * uI * a * k, 1.0); }`;
export function engravingMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color('#fff1d8') }, uI: { value: 0.2 }, uSize: { value: 0.009 }, uScale: { value: 4000 }, uR: { value: 0.75 }, uBackDim: { value: 0.32 } },
    vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// kleine 3D-Rauschfunktion fuer Mondmeere
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t); const u = s(xf), v = s(yf), w = s(zf);
  let r = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++)
    r += hash3(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  return r;
}
const fbm = (x, y, z) => vnoise(x, y, z) * 0.55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.15;

function cloud(pts, bri) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('aB', new THREE.Float32BufferAttribute(bri, 1)); g.computeBoundingSphere(); return g; }
function randSphere(R) { const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u); return [s * Math.cos(a), u, s * Math.sin(a)]; }

export function motifGeometry(name, seed = 11) {
  const R = rng(seed); const P = [], B = [];
  const add = (x, y, z, b) => { P.push(x, y, z); B.push(b); };
  if (name === 'mond') {
    const Rm = 0.75, craters = [];
    for (let i = 0; i < 46; i++) craters.push({ c: randSphere(R), r: 0.04 + Math.pow(R(), 2.4) * 0.22 });
    let n = 0;
    while (n < 78000) {
      const [x, y, z] = randSphere(R);
      const m = fbm(x * 1.6 + 3.1, y * 1.6, z * 1.6 + 1.7);       // Mondmeere: dunklere, duenner gravierte Flaechen
      let dens = m > 0.52 ? 0.2 : 1.0;
      let bri = m > 0.52 ? 0.45 : 0.95 + fbm(x * 9, y * 9, z * 9) * 0.4;
      for (const cr of craters) {
        const d = Math.acos(Math.min(1, x * cr.c[0] + y * cr.c[1] + z * cr.c[2]));
        if (d < cr.r * 1.25) { const q = d / cr.r; if (q < 0.8) { dens *= 0.55; bri *= 0.8; } else if (q < 1.2) { dens = Math.min(1, dens * 1.5); bri *= 1.25; } }
      }
      if (R() > dens) continue;
      const rr = Rm * (1 - Math.pow(R(), 3) * 0.06);
      add(x * rr, y * rr, z * rr, bri); n++;
    }
    for (let i = 0; i < 1600; i++) { const [x, y, z] = randSphere(R); const rr = Rm * Math.cbrt(R()) * 0.95; add(x * rr, y * rr, z * rr, 0.25); }  // leichter Nebel innen
  } else if (name === 'saturn') {
    const Rp = 0.38, tilt = 0.32;
    for (let i = 0; i < 30000; i++) { const [x, y, z] = randSphere(R); const band = 0.7 + 0.3 * Math.sin(y * 26 + Math.sin(x * 3) * 0.5); add(x * Rp, y * Rp, z * Rp, band); }
    for (let i = 0; i < 26000; i++) {
      const rr = 0.5 + R() * 0.36; if (rr > 0.69 && rr < 0.72) continue; const a = R() * Math.PI * 2;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = (R() - 0.5) * 0.012;
      if (Math.hypot(x, z) < Rp * 1.02 && z < 0 && false) continue;
      add(x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt), rr > 0.72 ? 0.65 : 0.9);
    }
    for (let i = 0; i < 4000; i++) { const [x, y, z] = randSphere(R); add(0.6 + x * 0.09, 0.42 + y * 0.09, 0.05 + z * 0.09, 0.85); }
    for (let i = 0; i < 300; i++) { const [x, y, z] = randSphere(R); const rr = 0.55 + R() * 0.3; add(x * rr, y * rr, z * rr, 1.6); }   // Sterne
  } else if (name === 'riesenrad') {
    const Rw = 0.6, cy = 0.1, nS = 28;
    const line = (a, b, n, bri) => { for (let i = 0; i < n; i++) { const t = R(); add(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, bri); } };
    for (const zz of [-0.06, 0.06]) {
      for (let i = 0; i < 3200; i++) { const a = R() * Math.PI * 2; add(Math.cos(a) * Rw, cy + Math.sin(a) * Rw, zz + (R() - 0.5) * 0.006, 1.0); }
      for (let i = 0; i < 1400; i++) { const a = R() * Math.PI * 2; add(Math.cos(a) * Rw * 0.93, cy + Math.sin(a) * Rw * 0.93, zz, 0.7); }
      for (let k = 0; k < nS; k++) { const a = k / nS * Math.PI * 2; line([0, cy, zz], [Math.cos(a) * Rw, cy + Math.sin(a) * Rw, zz], 140, 0.75); }
    }
    for (let k = 0; k < 24; k++) {   // Gondeln
      const a = k / 24 * Math.PI * 2, gx = Math.cos(a) * (Rw + 0.05), gy = cy + Math.sin(a) * (Rw + 0.05);
      for (let i = 0; i < 70; i++) { const b = R() * Math.PI * 2; add(gx + Math.cos(b) * 0.028, gy + Math.sin(b) * 0.028 - 0.02, (R() - 0.5) * 0.08, 1.4); }
    }
    for (let i = 0; i < 600; i++) { const [x, y, z] = randSphere(R); add(x * 0.05, cy + y * 0.05, z * 0.09, 1.3); }    // Nabe
    for (const s of [-1, 1]) for (const zz of [-0.12, 0.12]) line([0, cy, zz * 0.4], [s * 0.36, -0.68, zz], 520, 0.9);  // Stuetzen
    for (let i = 0; i < 1600; i++) add((R() - 0.5) * 0.95, -0.7 + (R() - 0.5) * 0.02, (R() - 0.5) * 0.3, 0.6);          // Plattform
  } else if (name === 'schneemann') {
    // nach Shopfoto: kleiner Schneemann mit Muetze links vorn, grosser mit Zylinder rechts, beide mit Schal; Tanne rechts hinten, Haus links hinten, Mond oben
    const sphere = (cx, cy, cz, r, n, bri) => { for (let i = 0; i < n; i++) { const [x, y, z] = randSphere(R); const rr = r * (1 - R() * 0.05); add(cx + x * rr, cy + y * rr, cz + z * rr, bri * (0.85 + 0.3 * R())); } };
    const men = [{ x: -0.26, z: 0.2, s: 0.72, hat: 'muetze' }, { x: 0.06, z: 0.1, s: 1.0, hat: 'zylinder' }];
    for (const m of men) {
      const s = m.s, yb = -0.62 + 0.2 * s, yh = yb + 0.2 * s + 0.12 * s;
      sphere(m.x, yb, m.z, 0.2 * s, Math.round(9000 * s), 0.95); sphere(m.x, yh, m.z, 0.14 * s, Math.round(5000 * s), 1.0);
      const yn = yb + 0.17 * s;   // Schal am Hals, ein Ende haengt
      for (let i = 0; i < 1200 * s; i++) { const a = R() * Math.PI * 2; add(m.x + Math.cos(a) * 0.13 * s, yn + (R() - 0.5) * 0.035 * s, m.z + Math.sin(a) * 0.13 * s, 1.3); }
      for (let i = 0; i < 500 * s; i++) { const t2 = R(); add(m.x + 0.06 * s + (R() - 0.5) * 0.04 * s, yn - t2 * 0.16 * s, m.z + 0.12 * s, 1.25); }
      for (let i = 0; i < 160; i++) { const [a, b, c] = randSphere(R); add(m.x + 0.03 * s + a * 0.018, yh + b * 0.018, m.z + 0.14 * s + c * 0.018, 1.4); }   // Nase
      const yt = yh + 0.12 * s;
      if (m.hat === 'zylinder') {
        for (let i = 0; i < 1800; i++) { const a = R() * Math.PI * 2, hh = R() * 0.15 * s; add(m.x + Math.cos(a) * 0.085 * s, yt + hh, m.z + Math.sin(a) * 0.085 * s, 0.7); }
        for (let i = 0; i < 800; i++) { const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.15 * s; add(m.x + Math.cos(a) * rr, yt, m.z + Math.sin(a) * rr, 0.9); }
      } else {
        for (let i = 0; i < 1500; i++) { const [a, b, c] = randSphere(R); if (b < 0) continue; add(m.x + a * 0.12 * s, yt - 0.03 + b * 0.11 * s, m.z + c * 0.12 * s, 0.85); }
        sphere(m.x, yt + 0.1 * s, m.z, 0.035, 400, 1.2);   // Bommel
      }
    }
    for (let i = 0; i < 16000; i++) {   // Tanne rechts hinten: gestufte Zweige
      const tier = Math.floor(R() * 5), y0 = -0.5 + tier * 0.17, h = 0.3, t = R(), rr = (1 - t) * (0.3 - tier * 0.045) * Math.sqrt(R());
      const a = R() * Math.PI * 2; const ragged = 1 + 0.25 * Math.sin(a * 9 + tier);
      add(0.4 + Math.cos(a) * rr * ragged, y0 + t * h, -0.36 + Math.sin(a) * rr * ragged, 0.75 + (R() < 0.02 ? 0.9 : 0));
    }
    sphere(0.4, 0.38, -0.36, 0.03, 300, 1.6);   // Stern auf der Spitze
    for (let i = 0; i < 3200; i++) {   // Haus mit Dach links hinten
      const u = R(), v = R(); if (R() < 0.6) add(-0.42 + u * 0.26, -0.62 + v * 0.18, -0.25, 0.75); else { const w = (1 - v) * 0.17; add(-0.29 + (u - 0.5) * 2 * w, -0.44 + v * 0.13, -0.25, 0.95); }
    }
    for (let i = 0; i < 1100; i++) {   // Rentierschlitten am Himmel links oben: feine Silhouette, ansteigend
      const k = R(), u = R(); const lx = -0.55 + u * 0.32, ly = 0.26 + u * 0.1;
      if (k < 0.4) add(-0.55 + R() * 0.1, 0.25 + Math.pow(R(), 2) * 0.05, -0.1, 0.8);            // Schlitten
      else if (k < 0.55) add(lx, ly, -0.1, 0.6);                                                    // Zugleine
      else { const j = Math.floor(R() * 2), bx = -0.36 + j * 0.1, by = 0.31 + j * 0.035; const q = R(); add(bx + (q - 0.5) * 0.055, by + Math.sin(q * 3.1) * 0.012 + (R() < 0.25 ? -R() * 0.035 : 0), -0.1, 0.8); }
    }
    for (let k = 0; k < 16; k++) {   // Schneesterne
      const [x, y, z] = randSphere(R); const rr = 0.45 + R() * 0.35; const cx = x * rr, cy = Math.abs(y) * rr * 0.9 + 0.0, cz = z * rr * 0.6, sz = 0.025 + R() * 0.02;
      for (let a = 0; a < 6; a++) for (let i = 0; i < 26; i++) { const t2 = R(), ang = a * Math.PI / 3; add(cx + Math.cos(ang) * sz * t2, cy + Math.sin(ang) * sz * t2, cz, 1.5); }
    }
    sphere(-0.02, 0.55, -0.15, 0.09, 2400, 1.1);     // Mond
    for (let i = 0; i < 2200; i++) add((R() - 0.5) * 1.1, -0.66 + (R() - 0.5) * 0.02, (R() - 0.5) * 0.7, 0.55);   // Boden
  }
  return cloud(P, B);
}

// ---------- Komplette Lampe ----------
export function makeLamp(motif = 'mond', tex = null) {
  const lamp = new THREE.Group(); lamp.name = 'kugellampe';
  const base = makeBase(tex || woodTex());
  lamp.add(base.group);
  const ball = new THREE.Group(); ball.position.y = BALL_Y; lamp.add(ball);
  const geo = new THREE.SphereGeometry(R_BALL, 96, 64);
  const back = new THREE.Mesh(geo, glassMat(THREE.BackSide)); back.renderOrder = 10; ball.add(back);
  const eMat = engravingMat();
  const pts = new THREE.Points(motifGeometry(motif), eMat); pts.renderOrder = 11; pts.frustumCulled = false; ball.add(pts);
  const front = new THREE.Mesh(geo, glassMat(THREE.FrontSide)); front.renderOrder = 12; ball.add(front);
  // Lichtkappe oben (gebuendeltes LED-Licht) und Gluehen unten
  // Kappe als Kugelkalotte innen oben: von der Seite eine leuchtende Sichel/Ellipse wie auf den Fotos
  const capMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color('#ffe7b8') }, opacity: { value: 0 } },
    vertexShader: 'varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uCol; uniform float opacity; varying vec3 vL; void main(){ float r = length(vL.xz) / 0.55; float a = (1.0 - smoothstep(0.55, 1.0, r)) * (0.75 + 0.25 * (1.0 - r)); gl_FragColor = vec4(uCol * a * opacity * 1.35, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  Object.defineProperty(capMat, 'opacity', { get() { return this.uniforms.opacity.value; }, set(v) { if (this.uniforms) this.uniforms.opacity.value = v; } });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.975, 64, 12, 0, Math.PI * 2, 0, 0.6), capMat); cap.renderOrder = 13; ball.add(cap);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.8, 48), addMat(GLOW, '#ffb562')); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -0.86; bottom.renderOrder = 13; ball.add(bottom);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: new THREE.Color('#ffbf73'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  aura.scale.setScalar(2.5); aura.renderOrder = 9; ball.add(aura);
  const ledGlow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), addMat(GLOW, '#ffc27a')); ledGlow.rotation.x = -Math.PI / 2; ledGlow.position.y = LED_Y + 0.01; ledGlow.renderOrder = 8; lamp.add(ledGlow);
  const light = new THREE.PointLight('#ffc27a', 0, 7, 1.7); light.position.set(0, BALL_Y - 0.2, 0); lamp.add(light);
  const bounce = new THREE.PointLight('#ffb878', 0, 6, 2); bounce.position.set(0, 0.55, 2.0); lamp.add(bounce);   // Licht vom Boden zurueck auf den Sockel
  const api = {
    group: lamp, ball, base, pts, eMat, front, back, cap, bottom, aura, ledGlow, light, bounce,
    // on: 0..1 Lampe an, room: 0..1 Raumlicht (Gravur im Hellen als Milchglas sichtbar)
    set(on = 0, room = 1, { cam = null, glowScale = 1 } = {}) {
      eMat.uniforms.uI.value = (0.3 * room + 0.08) * (1 - on) + on * 1.15;
      eMat.uniforms.uCol.value.set('#fbfbf8').lerp(new THREE.Color('#fff0d6'), on);
      for (const m of [front.material, back.material]) { m.uniforms.uOn.value = on; m.uniforms.uRimI.value = 0.55 + 0.5 * room + 0.25 * on; }
      front.material.uniforms.uSpec.value = 0.55 + 0.6 * room;
      cap.material.opacity = on; bottom.material.opacity = 0.75 * on; aura.material.opacity = 0.12 * on * glowScale; ledGlow.material.opacity = 0.9 * on;
      cap.visible = bottom.visible = aura.visible = ledGlow.visible = on > 0.002;
      base.ledMat.color.set('#5b5045').lerp(new THREE.Color('#ffe2b0'), on);
      light.intensity = 9 * on; bounce.intensity = 2.2 * on * (1 - 0.6 * room);
      if (cam) eMat.uniforms.uScale.value = 960 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    },
  };
  api.set(0, 1);
  return api;
}

// ---------- USB-Stecker mit Kabel ----------
export function makePlug() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: '#f2f1ee', roughness: 0.42, clearcoat: 0.3 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.3), white); head.position.z = -0.15; head.castShadow = true; g.add(head);
  const pin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.055, 0.09), new THREE.MeshStandardMaterial({ color: '#cfcfcf', metalness: 1, roughness: 0.22 })); pin.position.z = 0.045; g.add(pin);
  const curve = new THREE.CatmullRomCurve3([v3(0, 0, -0.3), v3(0, -0.04, -0.8), v3(0.25, -0.16, -1.5), v3(0.9, -0.19, -2.6), v3(1.8, -0.19, -3.6)]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.032, 10), white); cable.castShadow = true; g.add(cable);
  return g;
}

// ---------- Geschenkbox (Waende klappen auf) ----------
export function makeGift(S = 1.25, Hh = 2.55) {
  const g = new THREE.Group();
  const paper = new THREE.MeshPhysicalMaterial({ color: '#f1e9dc', roughness: 0.75, sheen: 0.3, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide });
  const ribbon = new THREE.MeshPhysicalMaterial({ color: '#d8b56c', roughness: 0.32, metalness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide });
  const walls = [];
  for (let k = 0; k < 4; k++) {
    const hinge = new THREE.Group(); hinge.rotation.y = k * Math.PI / 2; g.add(hinge);
    const pivot = new THREE.Group(); pivot.position.set(0, 0, S); hinge.add(pivot);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(2 * S, Hh), paper); wall.position.y = Hh / 2; wall.castShadow = true; pivot.add(wall);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(0.34, Hh), ribbon); band.position.set(0, Hh / 2, 0.004); pivot.add(band);
    walls.push(pivot);
  }
  const floorM = new THREE.Mesh(new THREE.PlaneGeometry(2 * S, 2 * S), paper); floorM.rotation.x = -Math.PI / 2; floorM.position.y = 0.002; floorM.receiveShadow = true; g.add(floorM);
  const lid = new THREE.Group(); lid.position.y = Hh; g.add(lid);
  const lidBox = new THREE.Mesh(new THREE.BoxGeometry(2 * S + 0.12, 0.42, 2 * S + 0.12), paper); lidBox.position.y = 0.17; lidBox.castShadow = true; lid.add(lidBox);
  for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2 * S + 0.14, 0.43, 0.34), ribbon); b.position.y = 0.17; b.rotation.y = r; lid.add(b); }
  for (const s of [-1, 1]) {   // Schleife
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.09, 12, 40), ribbon); loop.scale.set(1, 0.62, 0.55); loop.position.set(s * 0.34, 0.5, 0); loop.rotation.set(0, 0, s * 0.35); lid.add(loop);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.75), ribbon); tail.position.set(s * 0.18, 0.4, 0.32); tail.rotation.set(0.25, s * 0.5, 0); lid.add(tail);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), ribbon); knot.scale.set(1, 0.75, 0.9); knot.position.y = 0.45; lid.add(knot);
  return { group: g, walls, lid, S, H: Hh };
}

// ---------- Requisiten ----------
export function makeBooks() {
  const g = new THREE.Group();
  const cols = ['#2c4a52', '#c97a5a', '#e9dfcc'];
  [[2.3, 0.34, 1.6, 0.0, 0.05], [2.1, 0.3, 1.5, 0.34, -0.12], [1.9, 0.26, 1.4, 0.64, 0.2]].forEach(([w, h, d, y, ry], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhysicalMaterial({ color: cols[i], roughness: 0.7 }));
    m.position.y = y + h / 2; m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, h - 0.07, d - 0.03), new THREE.MeshPhysicalMaterial({ color: '#f4efe4', roughness: 0.9 }));
    pages.position.set(0.035, y + h / 2, 0); pages.rotation.y = ry; g.add(pages);
  });
  return g;
}
export function makePlant() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.5, 0.75], [0.54, 0.8], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)), 48), new THREE.MeshPhysicalMaterial({ color: '#e8e2d6', roughness: 0.6 }));
  pot.castShadow = true; g.add(pot);
  const leaf = new THREE.MeshPhysicalMaterial({ color: '#6f9a52', roughness: 0.45, sheen: 0.3, side: THREE.DoubleSide }); const R = rng(8);
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), leaf); l.scale.set(0.35, 1, 0.08); const a = i / 9 * Math.PI * 2; l.position.set(Math.cos(a) * 0.28, 1.35 + R() * 0.5, Math.sin(a) * 0.28); l.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5); l.castShadow = true; g.add(l); }
  return g;
}

// ---------- Staubflocken im Licht ----------
export function makeDust(n = 140, seed = 5) {
  const R = rng(seed); const P = [], B = [];
  for (let i = 0; i < n; i++) { P.push((R() - 0.5) * 5, 0.2 + R() * 3.4, (R() - 0.5) * 3); B.push(0.3 + R() * 0.7); }
  const m = engravingMat(); m.uniforms.uSize.value = 0.016; m.uniforms.uBackDim.value = 1.0; m.uniforms.uR.value = 3.0;
  const p = new THREE.Points(cloud(P, B), m); p.frustumCulled = false; p.renderOrder = 14;
  return p;
}
