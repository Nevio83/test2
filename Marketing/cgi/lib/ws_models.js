// 3D-Modell: Elektrischer Wasserspender fuer Schreibtisch (Produkt 10) – nach Shopfotos (Weiss/Schwarz)
// Einheiten: Sockeldurchmesser 2.0 ; y=0 Unterkante
import * as THREE from 'three';
import { canvasTex, rng } from './core.js';

export const WS_FARBEN = {
  weiss: { body: '#FBFBF9', tray: '#ECECEA', ink: '#9b9a95', nozzle: 'chrom', led: '#9fd8ff' },
  schwarz: { body: '#1d2431', tray: '#273041', ink: '#8b93a3', nozzle: 'rose', led: '#9fd8ff' },
};
export const NOZZLE = new THREE.Vector3(0, 2.3, -0.5);   // Austrittspunkt (unten an der Duese)
export const GLAS_POS = new THREE.Vector3(0, 0.386, -0.5);

function ringTex(F) {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const c = w / 2, R = w / 2;
    // Ring ist 0.85..0.97 des Radius; Kreise fuer Tasten + LED-Punkte vorne (unten im Bild = +z)
    const at = (deg, rr) => { const a = (90 + deg) * Math.PI / 180; return [c + Math.cos(a) * rr * R / 0.97, c + Math.sin(a) * rr * R / 0.97]; };
    g.fillStyle = F.ink;
    for (let i = 0; i < 6; i++) { const [x, y] = at(4 - i * 7.5, 0.905); g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.55; g.fillRect(x - 9, y - 26, 18, 3); g.fillRect(x - 7, y - 19, 14, 3); g.globalAlpha = 1; }
  });
}
function trayTex(F) {
  return canvasTex(512, 512, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gr.addColorStop(0, F.tray); gr.addColorStop(0.92, F.tray); gr.addColorStop(1, '#00000022');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = F.ink; g.lineWidth = 3; // Tropfen-Symbol
    g.beginPath(); g.moveTo(w / 2, h / 2 - 16); g.quadraticCurveTo(w / 2 + 12, h / 2 + 2, w / 2 + 9, h / 2 + 7); g.arc(w / 2, h / 2 + 6, 9, 0.1, Math.PI - 0.1); g.quadraticCurveTo(w / 2 - 12, h / 2 + 2, w / 2, h / 2 - 16); g.stroke();
  });
}

export function makeDispenser(farbe = 'weiss', env = {}) {
  const F = WS_FARBEN[farbe];
  const g = new THREE.Group(); g.name = 'spender';
  const body = new THREE.MeshPhysicalMaterial({ color: F.body, roughness: farbe === 'weiss' ? 0.48 : 0.42, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 0.2, sheenColor: new THREE.Color('#ffffff') });
  const tray = new THREE.MeshPhysicalMaterial({ map: trayTex(F), roughness: 0.3, clearcoat: 0.5 });
  const metal = F.nozzle === 'chrom'
    ? new THREE.MeshStandardMaterial({ color: '#e9e9e9', metalness: 1, roughness: 0.14 })
    : new THREE.MeshStandardMaterial({ color: '#d9a28a', metalness: 1, roughness: 0.22 });
  const prof = [[0, 0], [0.955, 0], [0.995, 0.035], [1.0, 0.08], [1.0, 0.33], [0.99, 0.375], [0.965, 0.4], [0.86, 0.4], [0.845, 0.386], [0.0, 0.386]].map(([x, y]) => new THREE.Vector2(x, y));
  const base = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), body); base.castShadow = true; base.receiveShadow = true; g.add(base);
  const tr = new THREE.Mesh(new THREE.CircleGeometry(0.846, 96), tray); tr.rotation.x = -Math.PI / 2; tr.position.y = 0.3865; tr.receiveShadow = true; g.add(tr);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.97, 128), new THREE.MeshStandardMaterial({ map: ringTex(F), transparent: true, depthWrite: false, roughness: 0.6 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4008; g.add(ring);
  // Tasten
  const btnMat = new THREE.MeshPhysicalMaterial({ color: F.body, roughness: 0.35, clearcoat: 0.6 });
  const ledMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color(F.led), emissiveIntensity: 0, roughness: 0.4 });
  const buttons = [];
  for (const deg of [-17, -32]) {
    const a = deg * Math.PI / 180, rr = 0.912;
    const bg = new THREE.Group(); bg.position.set(Math.sin(a) * rr, 0.4, Math.cos(a) * rr); bg.rotation.y = a; bg.scale.set(1.55, 1, 1); g.add(bg);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.022, 40), btnMat); b.position.y = 0.011; b.castShadow = true; bg.add(b);
    const l = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 8, 40), ledMat); l.rotation.x = Math.PI / 2; l.position.y = 0.023; bg.add(l);
    buttons.push(bg);
  }
  // Saeule mit Sockelnase
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 48), body); boss.position.set(0, 0.2, -0.92); boss.castShadow = true; g.add(boss);
  const bossTop = new THREE.Mesh(new THREE.CircleGeometry(0.2, 48), body); bossTop.rotation.x = -Math.PI / 2; bossTop.position.set(0, 0.401, -0.92); g.add(bossTop);
  const colH = 2.58 - 0.4;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.118, colH, 48), body); col.position.set(0, 0.4 + colH / 2, -0.92); col.castShadow = true; g.add(col);
  const colCap = new THREE.Mesh(new THREE.SphereGeometry(0.115, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), body); colCap.position.set(0, 2.58, -0.92); colCap.scale.y = 0.35; g.add(colCap);
  // Auslauf
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.48, 40), body); arm.rotation.x = Math.PI / 2; arm.position.set(0, 2.44, -0.68); arm.castShadow = true; g.add(arm);
  const armCap = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.012, 40), metal); armCap.rotation.x = Math.PI / 2; armCap.position.set(0, 2.44, -0.437); g.add(armCap);
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.1, 24), metal); noz.position.set(0, 2.35, -0.5); g.add(noz);
  // Ladebuchse hinten
  const port = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.02), new THREE.MeshStandardMaterial({ color: '#111' })); port.position.set(0.0, 0.16, -1.121); g.add(port);
  return { group: g, buttons, ledMat, body, metal, farbe };
}

// Trinkglas (Fake-Glas: transparent mit Reflexen; das Wasser darin ist transmissiv)
export function makeGlass() {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.3, 0], [0.33, 0.02], [0.345, 0.1], [0.37, 1.25], [0.375, 1.3], [0.355, 1.3], [0.35, 1.25], [0.325, 0.1], [0.3, 0.06], [0, 0.06]].map(([x, y]) => new THREE.Vector2(x, y));
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.22, envMapIntensity: 1.8, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1 });
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), m); mesh.renderOrder = 10; g.add(mesh);
  const water = new THREE.Mesh(new THREE.BufferGeometry(), waterMat()); g.add(water);
  return { group: g, water, mat: m };
}
export function waterMat() {
  return new THREE.MeshPhysicalMaterial({ color: '#f4fbfd', transmission: 1, thickness: 0.6, ior: 1.33, roughness: 0.0, attenuationColor: new THREE.Color('#e3f4f9'), attenuationDistance: 9, side: THREE.DoubleSide, envMapIntensity: 1.3 });
}
// Wasserkoerper im Glas (Hoehe h ab Glasboden), Oberflaeche mit Wellen
export function waterGeometry(h, t = 0, wave = 0) {
  const pts = [new THREE.Vector2(0.001, 0.06)];
  const rIn = (y) => 0.325 + (0.35 - 0.325) * (y - 0.1) / 1.15 - 0.004;
  for (let i = 0; i <= 8; i++) { const y = 0.06 + h * i / 8; pts.push(new THREE.Vector2(rIn(Math.max(0.1, y)), y)); }
  const rt = rIn(0.06 + h);
  for (let i = 1; i <= 10; i++) { const rr = rt * (1 - i / 10); pts.push(new THREE.Vector2(Math.max(0.001, rr), 0.06 + h + wave * 0.02 * Math.sin(t * 22 - rr * 30) * (rr / rt))); }
  return new THREE.LatheGeometry(pts, 64);
}

// 5-Liter-Kanister (Fake-Kunststoff) mit Wasser
export function makeJug() {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.78, 0], [0.82, 0.06], [0.83, 1.9], [0.75, 2.18], [0.42, 2.42], [0.2, 2.52], [0.19, 2.72], [0.0, 2.72]];
  const pts = prof.map(([x, y]) => new THREE.Vector2(x, y));
  const m = new THREE.MeshPhysicalMaterial({ color: '#dff0f7', roughness: 0.08, transparent: true, opacity: 0.3, envMapIntensity: 1.5, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), m); shell.renderOrder = 10; g.add(shell);
  // Rillen
  for (const y of [0.5, 1.0, 1.5]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.832, 0.012, 8, 96), m); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.16, 40), new THREE.MeshPhysicalMaterial({ color: '#2f7fd6', roughness: 0.35, clearcoat: 0.4 })); cap.position.y = 2.66; g.add(cap);
  const wpts = [[0, 0.03], [0.8, 0.03], [0.81, 1.75], [0.0, 1.75]].map(([x, y]) => new THREE.Vector2(x, y));
  const water = new THREE.Mesh(new THREE.LatheGeometry(wpts, 64), waterMat()); g.add(water);
  return { group: g, cap, water };
}

// Silikonschlauch entlang einer Kurve
export function makeTube(points, r = 0.035) {
  const curve = new THREE.CatmullRomCurve3(points);
  const m = new THREE.MeshPhysicalMaterial({ color: '#f4f4f2', roughness: 0.25, transparent: true, opacity: 0.85, clearcoat: 0.6 });
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, r, 16, false), m); mesh.castShadow = true;
  return { mesh, curve, mat: m };
}

// PET-Flasche 0,5 l (leer, fuer das Flaschen-Chaos)
export function makePet(seed = 1) {
  const R = rng(seed);
  const prof = [[0, 0], [0.2, 0], [0.235, 0.05], [0.24, 0.6], [0.225, 0.68], [0.24, 0.76], [0.24, 1.15], [0.17, 1.38], [0.095, 1.5], [0.09, 1.6], [0.0, 1.6]];
  const pts = prof.map(([x, y]) => new THREE.Vector2(x, y));
  const m = new THREE.MeshPhysicalMaterial({ color: '#e8f4fa', roughness: 0.06, transparent: true, opacity: 0.32, envMapIntensity: 1.6, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), m); shell.renderOrder = 9; g.add(shell);
  const capCol = ['#2f7fd6', '#e9e9e9', '#2f7fd6'][Math.floor(R() * 3)];
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.13, 24), new THREE.MeshPhysicalMaterial({ color: capCol, roughness: 0.4 })); cap.position.y = 1.66; cap.castShadow = true; g.add(cap);
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.243, 0.243, 0.3, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: '#cfe6f2', roughness: 0.5, side: THREE.DoubleSide })); lab.position.y = 0.92; g.add(lab);
  return g;
}

// Wasserstrahl (transmissiv) von der Duese bis y
export function makeStream() {
  const m = waterMat(); m.thickness = 0.12; m.emissive = new THREE.Color('#fff8ee'); m.emissiveIntensity = 0.35; m.envMapIntensity = 2.2;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 1, 20, 12, true), m);
  return mesh;
}
