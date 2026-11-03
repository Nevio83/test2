// 3D-Modell: 350ml Mixer Entsafter (Produkt 11) – nach Clip 15 + Shopfotos vermessen
// Einheiten: Durchmesser Flasche = 1.0 ; y=0 Unterkante Glas ; Gesamthoehe ~3.1
import * as THREE from 'three';
import { canvasTex, GLSL_NOISE, rng } from './core.js';

export const FARBEN = {
  rosa: { base: '#F1A3B3', ring: '#F3AABA', label: '#5d4648' },
  weiss: { base: '#F2EFEA', ring: '#F4F2EE', label: '#4b4744' },
  blau: { base: '#8CC8E6', ring: '#93CDEA', label: '#33505e' },
};

// Aussenkontur des Glases
export function rOuter(y) {
  if (y <= 1.83) return 0.5;
  if (y <= 2.62) { const u = (y - 1.83) / (2.62 - 1.83); return 0.30 + 0.20 * (Math.cos(Math.PI * u) + 1) / 2; }
  return 0.30;
}
export const GLAS_TOP = 2.86, BASE_TOP = 1.0, WALL = 0.028;
export const rInner = (y) => rOuter(y) - WALL;

function glassProfile() {
  const p = [];
  p.push(new THREE.Vector2(0.47, 0.0));
  for (let i = 0; i <= 60; i++) { const y = (i / 60) * GLAS_TOP; p.push(new THREE.Vector2(rOuter(y), y)); }
  p.push(new THREE.Vector2(0.272, GLAS_TOP)); // Lippe (innen)
  return p;
}

// ---------- Materialien ----------
export function makeMaterials() {
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transmission: 1, thickness: 0.06, roughness: 0.035, ior: 1.47,
    metalness: 0, specularIntensity: 1, envMapIntensity: 1.25, side: THREE.FrontSide,
    attenuationColor: new THREE.Color('#eef4f2'), attenuationDistance: 4,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: 1, roughness: 0.13, envMapIntensity: 1.4 });
  const dark = new THREE.MeshPhysicalMaterial({ color: '#141210', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  return { glass, chrome, dark };
}
function plastic(color, rough = 0.38) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.25, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.6 });
}
function silicone(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.62, sheen: 0.45, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5 });
}

// Aufdruck auf dem Glas (FRESH JUICE / MINI-FAST-PORTABLE / 350mL) – Aufdruck des echten Produkts
function labelTexture(color) {
  return canvasTex(2048, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    const cx = w / 2;
    g.font = '300 92px Manrope'; spaced(g, 'FRESH', cx, 120, 22);
    spaced(g, 'JUICE', cx, 220, 22);
    g.font = '500 30px Manrope'; spaced(g, 'MINI-FAST-PORTABLE', cx, 318, 5);
    g.font = '500 28px Manrope'; g.fillText('350mL', cx, 372);
  });
}
function spaced(g, text, cx, y, sp) {
  const ws = [...text].map((c) => g.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + sp * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((c, i) => { g.textAlign = 'left'; g.fillText(c, x, y); x += ws[i] + sp; });
  g.textAlign = 'center';
}

// Unterseite des Sockels: Rillen, weisser runder Aufkleber, Lueftung
function undersideTexture(color) {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    const c = w / 2;
    for (const [r, a] of [[478, 0.10], [440, 0.16], [330, 0.10]]) {
      g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = 10; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 4; g.beginPath(); g.arc(c, c, r - 8, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = '#f7f3ef'; g.beginPath(); g.arc(c + 70, c + 40, 175, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(80,70,70,0.32)';
    for (let i = 0; i < 6; i++) g.fillRect(c - 30, c - 50 + i * 30, 190 - (i % 3) * 40, 8);
    g.fillStyle = 'rgba(40,20,20,0.55)';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(c + 300 + i * 34, c - 250 + i * 34, 9, 13, 0.8, 0, Math.PI * 2); g.fill(); }
  });
}

// ---------- Flasche (Glas + Deckel + Silikonband mit Schlaufe + Aufdruck) ----------
export function makeBottle(farbe = 'rosa', mats = makeMaterials()) {
  const F = FARBEN[farbe];
  const group = new THREE.Group(); group.name = 'flasche';
  const glass = new THREE.Mesh(new THREE.LatheGeometry(glassProfile(), 128), mats.glass);
  glass.renderOrder = 5; group.add(glass);

  // Chromdeckel mit dunkler Glasplatte
  const capG = new THREE.Group(); capG.position.y = GLAS_TOP - 0.02; group.add(capG);
  const capPts = [[0, 0], [0.335, 0], [0.352, 0.02], [0.355, 0.2], [0.346, 0.245], [0.33, 0.26], [0.0, 0.26]].map(([x, y]) => new THREE.Vector2(x, y));
  const cap = new THREE.Mesh(new THREE.LatheGeometry(capPts, 96), mats.chrome); cap.castShadow = true; capG.add(cap);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.3, 64), mats.dark); top.rotation.x = -Math.PI / 2; top.position.y = 0.262; capG.add(top);

  // Silikonband am Hals + Trageschlaufe
  const sil = silicone(F.ring);
  const yb = 2.44, yt = 2.585;
  const bandPts = [];
  for (let i = 0; i <= 12; i++) { const y = yb + (yt - yb) * i / 12; bandPts.push(new THREE.Vector2(rOuter(y) + 0.032 + 0.006 * Math.sin(Math.PI * i / 12), y)); }
  bandPts.push(new THREE.Vector2(rOuter(yt) + 0.004, yt)); bandPts.unshift(new THREE.Vector2(rOuter(yb) + 0.004, yb));
  const band = new THREE.Mesh(new THREE.LatheGeometry(bandPts, 96), sil); band.castShadow = true; group.add(band);
  const loopG = new THREE.Group(); loopG.position.set(-0.36, (yb + yt) / 2, 0); group.add(loopG); // Drehpunkt am Band
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.034, 20, 96), sil);
  loop.scale.set(1, 1.08, 0.72); loop.position.set(-0.27, 0.02, 0); loop.castShadow = true; loopG.add(loop);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.055), sil); strap.position.set(-0.02, 0, 0); loopG.add(strap);

  // Aufdruck
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.5035, 0.5035, 0.62, 128, 1, true, -Math.PI, Math.PI * 2),
    new THREE.MeshStandardMaterial({ map: labelTexture(F.label), transparent: true, depthWrite: false, roughness: 0.5 }));
  lab.position.y = 0.43; lab.renderOrder = 6; group.add(lab);

  return { group, glass, cap: capG, band, loopG, label: lab, farbe };
}

// ---------- Motorsockel mit Klingen und Knopf ----------
export function makeBase(farbe = 'rosa', mats = makeMaterials()) {
  const F = FARBEN[farbe];
  const g = new THREE.Group(); g.name = 'sockel';
  const pm = plastic(F.base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.466, 0.466, BASE_TOP + 0.02, 96), pm);
  body.position.y = (BASE_TOP + 0.02) / 2 - 0.02; body.castShadow = true; g.add(body);
  // Rand unten (etwas breiter als das Glas)
  const rimPts = [[0.44, -0.075], [0.497, -0.075], [0.512, -0.05], [0.514, 0.02], [0.505, 0.06], [0.47, 0.065]].map(([x, y]) => new THREE.Vector2(x, y));
  const rim = new THREE.Mesh(new THREE.LatheGeometry(rimPts, 96), pm); rim.castShadow = true; g.add(rim);
  // Unterseite
  const under = new THREE.Mesh(new THREE.CircleGeometry(0.45, 96), new THREE.MeshPhysicalMaterial({ map: undersideTexture(F.base), roughness: 0.45, clearcoat: 0.3 }));
  under.rotation.x = Math.PI / 2; under.position.y = -0.074; g.add(under);
  // Knopf + LED-Ring (Unterseite, links neben dem Aufkleber)
  const btnG = new THREE.Group(); btnG.position.set(-0.2, -0.076, 0.06); g.add(btnG);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.03, 48), plastic(F.base, 0.28)); btn.position.y = -0.01; btnG.add(btn);
  const ledMat = new THREE.MeshStandardMaterial({ color: '#fbf6ee', emissive: new THREE.Color('#ffe2b0'), emissiveIntensity: 0, roughness: 0.3 });
  const led = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.012, 12, 64), ledMat); led.rotation.x = Math.PI / 2; led.position.y = -0.004; btnG.add(led);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.03, 32), ledMat); dot.rotation.x = Math.PI / 2; dot.position.y = -0.0255; btnG.add(dot);
  // Oberseite: dunkler Einsatz + Klingen
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.45, 0.02, 64), new THREE.MeshPhysicalMaterial({ color: '#3a3433', roughness: 0.4 }));
  deck.position.y = BASE_TOP + 0.005; g.add(deck);
  const blades = new THREE.Group(); blades.position.y = BASE_TOP + 0.06; g.add(blades);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), mats.chrome); hub.scale.y = 0.7; blades.add(hub);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.065), mats.chrome);
    const p = new THREE.Group(); p.rotation.y = i * Math.PI / 2; b.position.x = 0.15; b.rotation.x = 0.35; b.rotation.z = (i % 2 ? 1 : -1) * 0.28; p.add(b); blades.add(p);
  }
  return { group: g, blades, button: btn, led, ledMat, btnG };
}

// ---------- Obst ----------
function strawberrySkin() {
  return canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9e0d1d'); gr.addColorStop(0.5, '#d41f2f'); gr.addColorStop(1, '#e8394a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const R = rng(11);
    for (let i = 0; i < 260; i++) {
      const x = R() * w, y = 8 + R() * (h - 16);
      g.fillStyle = 'rgba(90,0,10,0.45)'; g.beginPath(); g.ellipse(x, y, 5, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f1cf6a'; g.beginPath(); g.ellipse(x, y - 1, 2.2, 3.4, 0, 0, Math.PI * 2); g.fill();
    }
  });
}
function strawberryCut() {
  return canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * 0.55, 4, w / 2, h * 0.5, w * 0.52);
    gr.addColorStop(0, '#fff1ef'); gr.addColorStop(0.45, '#f6b3b5'); gr.addColorStop(0.78, '#e2414f'); gr.addColorStop(1, '#b8101f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(w / 2, h * 0.85); g.quadraticCurveTo(w / 2 + (i - 4) * 18, h * 0.5, w / 2 + (i - 4) * 22, h * 0.12); g.stroke(); }
  });
}
function bananaFace() {
  return canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    gr.addColorStop(0, '#efe0b0'); gr.addColorStop(0.35, '#f7edcb'); gr.addColorStop(0.9, '#f3e6bb'); gr.addColorStop(1, '#e2cf93');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,90,50,0.55)';
    for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 14, h / 2 + Math.sin(a) * 14, 4, 6, a, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(200,170,110,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3 + 0.5; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a) * 60, h / 2 + Math.sin(a) * 60); g.stroke(); }
  });
}

export function makeFruitKit() {
  // Erdbeerhaelfte
  const prof = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16; const y = u * 0.36; const r = 0.165 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.04)), 0.75) * (0.55 + 0.45 * u); prof.push(new THREE.Vector2(Math.max(0.0005, r), y)); }
  prof[0].x = 0.0005; prof[prof.length - 1].x = 0.0005;
  const skin = new THREE.LatheGeometry(prof, 24, 0, Math.PI);
  const shape = new THREE.Shape(); shape.moveTo(0, 0);
  prof.forEach((p) => shape.lineTo(p.x, p.y)); [...prof].reverse().forEach((p) => shape.lineTo(-p.x, p.y));
  const cutG = new THREE.ShapeGeometry(shape, 16);
  const uv = cutG.attributes.uv, pos = cutG.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 0.36 + 0.5, pos.getY(i) / 0.36);
  cutG.rotateY(-Math.PI / 2);
  const skinM = new THREE.MeshPhysicalMaterial({ map: strawberrySkin(), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const cutM = new THREE.MeshPhysicalMaterial({ map: strawberryCut(), roughness: 0.45, side: THREE.DoubleSide, sheen: 0.4, sheenColor: new THREE.Color('#ffd6d6') });
  // Bananenscheibe
  const banG = new THREE.CylinderGeometry(0.19, 0.19, 0.085, 36);
  const banFace = new THREE.MeshPhysicalMaterial({ map: bananaFace(), roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#fff8e0') });
  const banSide = new THREE.MeshPhysicalMaterial({ color: '#efe2b4', roughness: 0.6 });
  return {
    erdbeere() {
      const g = new THREE.Group();
      const a = new THREE.Mesh(skin, skinM), b = new THREE.Mesh(cutG, cutM);
      a.castShadow = b.castShadow = true; g.add(a, b);
      g.children.forEach((m) => (m.position.y = -0.18));
      g.userData.r = 0.17; return g;
    },
    banane() {
      const m = new THREE.Mesh(banG, [banSide, banFace, banFace]); m.castShadow = true;
      const g = new THREE.Group(); g.add(m); g.userData.r = 0.19; return g;
    },
  };
}

// ---------- Fluessigkeit (Milch -> Smoothie) ----------
export function makeLiquidMaterial(opts = {}) {
  const u = {
    uMix: { value: 0 }, uTime: { value: 0 }, uSwirl: { value: 0 }, uTop: { value: 2.3 }, uBottom: { value: 1.0 },
    uMilk: { value: new THREE.Color(opts.milk || '#f6f1e8') },
    uPink: { value: new THREE.Color(opts.smoothie || '#ee8fae') },
    uDeep: { value: new THREE.Color(opts.deep || '#c41d48') },
    uLight: { value: new THREE.Color(opts.light || '#f7d4de') },
  };
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.28, clearcoat: 0.2, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4 });
  m.userData.u = u;
  m.customProgramCacheKey = () => 'fluessig';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vLoc;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLoc = position;');
    sh.fragmentShader = `varying vec3 vLoc;
uniform float uMix, uTime, uSwirl, uTop, uBottom; uniform vec3 uMilk, uPink, uDeep, uLight;
${GLSL_NOISE}
` + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  float ang = atan(vLoc.z, vLoc.x);
  float hh = clamp((vLoc.y - uBottom) / max(0.01, uTop - uBottom), 0.0, 1.0);
  float sw = snoise(vec3(cos(ang) * 1.3 + vLoc.y * 0.8 - uTime * 0.4, sin(ang) * 1.3 + uTime * 0.3, vLoc.y * 2.2 - uTime * 0.9 + ang * uSwirl * 0.6));
  float st = snoise(vec3(ang * 2.0 + vLoc.y * 5.0 - uTime * 7.0 * uSwirl, vLoc.y * 3.0, uTime * 0.5));
  float k = smoothstep(0.0, 1.0, clamp(uMix * 1.25 + sw * 0.32 - 0.12 + (1.0 - hh) * -0.1, 0.0, 1.0));
  vec3 col = mix(uMilk, uPink, k);
  float streak = smoothstep(0.35, 0.75, st) * clamp(uMix * (1.0 - uMix) * 4.0, 0.0, 1.0) * uSwirl;
  col = mix(col, uDeep, streak * 0.75);
  // fertiger Smoothie: unten heller, oben Schaumrand, feine Kerne
  float done = smoothstep(0.82, 1.0, uMix);
  col = mix(col, mix(uPink, uLight, 0.55), done * (1.0 - smoothstep(0.0, 0.28, hh)) * 0.8);
  col = mix(col, uLight, done * smoothstep(0.93, 1.0, hh) * 0.7);
  float sp = smoothstep(0.78, 0.86, snoise(vLoc * 38.0));
  col = mix(col, uDeep * 0.7, sp * done * 0.55);
  vec4 diffuseColor = vec4( col, opacity );`);
  };
  return m;
}

// Fluessigkeitskoerper als Drehkoerper zwischen ya und yb (lokale Flaschen-y)
// surface: 'oben' (Schwerkraft -y, aufrecht) oder 'unten' (kopfueber)
export function liquidGeometry(ya, yb, surface = 'oben', vortex = 0, wobble = 0, t = 0, inset = 0.016) {
  const pts = [], N = 40;
  const r = (y) => Math.max(0.01, rInner(y) - inset);
  if (surface === 'oben') {
    pts.push(new THREE.Vector2(0.001, ya));
    for (let i = 0; i <= N; i++) { const y = ya + (yb - ya) * i / N; pts.push(new THREE.Vector2(r(y), y)); }
    const rt = r(yb);
    for (let i = 1; i <= 12; i++) { const rr = rt * (1 - i / 12); const d = vortex * (1 - (rr / rt) ** 2) ; pts.push(new THREE.Vector2(Math.max(0.001, rr), yb - d + wobble * Math.sin(t * 9 + i) * 0.01)); }
  } else {
    const rt = r(ya);
    for (let i = 12; i >= 1; i--) { const rr = rt * (1 - i / 12); const d = vortex * (1 - (rr / rt) ** 2); pts.push(new THREE.Vector2(Math.max(0.001, rr), ya + d + wobble * Math.sin(t * 9 + i) * 0.01)); }
    for (let i = 0; i <= N; i++) { const y = ya + (yb - ya) * i / N; pts.push(new THREE.Vector2(r(y), y)); }
    pts.push(new THREE.Vector2(0.001, yb));
  }
  return new THREE.LatheGeometry(pts, 72);
}

// Packen: Stuecke in den Hohlraum stapeln.
// dir = -1: Schwerkraft nach lokal -y (aufrecht, Stapel waechst ab yLow)
// dir = +1: Schwerkraft nach lokal +y (kopfueber, Stapel waechst ab yHigh nach unten)
export function pack(pieces, yLow, yHigh, seed = 3, dir = -1, key = 'target') {
  const R = rng(seed), placed = [];
  for (const p of pieces) {
    const rp = p.r; let best = null;
    for (let k = 0; k < 320; k++) {
      const y = yLow + rp * 0.6 + R() * (yHigh - yLow - rp * 1.2);
      const rmax = Math.max(0.0, rInner(y) - rp * 0.86);
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * rmax;
      const c = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
      let ok = true;
      for (const q of placed) if (q.pos.distanceTo(c) < (q.r + rp) * 0.8) { ok = false; break; }
      if (ok && (!best || (dir < 0 ? c.y < best.y : c.y > best.y))) best = c;
    }
    if (!best) best = new THREE.Vector3(0, dir < 0 ? yHigh : yLow, 0);
    placed.push({ pos: best, r: rp });
    p[key] = best;
  }
  return pieces;
}
