// Maios CGI – Figur "Mo" (Pro-Fassung, erwachsene Proportionen, matt, ruhiges Gesicht). Basis: figur.js
// (Alt:) Comicfigur "Mo" (eigene Figur fuer Story-Videos): grosser Kopf, Kulleraugen, Schlafanzug mit Sternen.
// Toon-Look (MeshToonMaterial), Gesicht (Mund + Augenbrauen) als Canvas-Abziehbild auf dem Kopf, alles zustandslos per set().
import * as THREE from 'three';
import { canvasTex } from './core.js';

let GRAD = null;
export function toonGrad() {
  if (GRAD) return GRAD;
  const d = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  GRAD = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  return GRAD;
}
export const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonGrad(), ...extra });

function pyjamaTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#7fb2e8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd86b';
    const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) star(50 + x * 100 + (y % 2) * 50, 50 + y * 100, 16);
  });
}

export function makeKid() {
  const root = new THREE.Group(); root.name = 'mo';
  const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
  const skin = mat('#d9a27e', 0.65), hair = mat('#16131a', 0.6), pj = mat('#51697c', 0.9);
  const white = mat('#f2efe8', 0.4), dark = new THREE.MeshBasicMaterial({ color: '#1a1420' });
  // Koerper (sitzend): Rumpf + Arme
  const body = new THREE.Group(); root.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.6, 8, 24), pj); torso.position.y = 0.95; torso.castShadow = true; body.add(torso);
  const arms = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(0.56 * s, 1.55, 0); body.add(p);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.72, 6, 12), pj); a.position.y = -0.45; a.castShadow = true; p.add(a);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin); hand.position.y = -0.95; p.add(hand);
    p.rotation.z = 0.25 * s; return p;
  });
  // Kopf
  const head = new THREE.Group(); head.position.y = 2.38; head.scale.setScalar(0.55); body.add(head);
  const R = 1.0;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), skin); skull.castShadow = true; head.add(skull);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 48, 32, 0, Math.PI * 2, 0, 1.25), hair); hairM.rotation.x = -0.32; hairM.castShadow = true; head.add(hairM);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skin); ear.position.set(0.98 * s, 0.0, 0); ear.scale.set(0.6, 1, 0.8); head.add(ear); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mat('#c58a66', 0.7)); nose.position.set(0, -0.08, 1.0); head.add(nose);
  // Augen (3D, Kulleraugen)
  const eyes = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(0.34 * s, 0.12, 0.84); head.add(g);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), white); ball.scale.z = 0.6; g.add(ball);
    const iris = new THREE.Group(); g.add(iris);
    const ir = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), dark); ir.position.z = 0.165; iris.add(ir);
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(0.05, 0.06, 0.17); iris.add(hl);
    const hl2 = new THREE.Mesh(new THREE.CircleGeometry(0.025, 10), hl.material); hl2.position.set(-0.05, -0.05, 0.17); iris.add(hl2);
    return { g, iris, ball };
  });
  // Gesicht: Mund + Brauen als Abziehbild (Kugelausschnitt vorn)
  const fc = document.createElement('canvas'); fc.width = 512; fc.height = 512;
  const faceTex = new THREE.CanvasTexture(fc); faceTex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, 48, 32, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 - 0.9, 1.8),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false }));
  face.renderOrder = 3; head.add(face);
  const fg = fc.getContext('2d');
  let lastKey = '';
  function drawFace(mouth, open, brow) {
    const key = `${mouth}|${open.toFixed(2)}|${brow.toFixed(2)}`; if (key === lastKey) return; lastKey = key;
    fg.clearRect(0, 0, 512, 512);
    // Patch: 1.8 rad breit -> Mitte (256,256). Mund ~ y 330, Brauen ~ y 150
    fg.strokeStyle = '#4a2a22'; fg.fillStyle = '#3a1c1a'; fg.lineCap = 'round'; fg.lineWidth = 9;
    const mx = 256, my = 338;
    if (mouth === 'o') { fg.beginPath(); fg.ellipse(mx, my, 22 + 10 * open, 26 + 26 * open, 0, 0, Math.PI * 2); fg.fill(); }
    else { const c = mouth === 'smile' ? 1 : mouth === 'frown' ? -1 : 0.15; const w = 52;
      if (open > 0.05 && c > 0) { fg.beginPath(); fg.moveTo(mx - w, my - 6); fg.quadraticCurveTo(mx, my + 30 * c + 50 * open, mx + w, my - 6); fg.closePath(); fg.fill(); fg.stroke(); }
      else { fg.beginPath(); fg.moveTo(mx - w, my); fg.quadraticCurveTo(mx, my + 34 * c, mx + w, my); fg.stroke(); } }
    // Brauen: brow -1 = Angst (innen hoch), +1 = froh/entspannt
    fg.lineWidth = 20; fg.strokeStyle = '#16131a';
    for (const s of [-1, 1]) { const x0 = 256 + s * 50, x1 = 256 + s * 128; const yIn = 150 - (brow < 0 ? -brow * 34 : 0) + (brow > 0 ? brow * 6 : 0), yOut = 150 + (brow < 0 ? -brow * 14 : 0) - (brow > 0 ? brow * 8 : 0);
      fg.beginPath(); fg.moveTo(x0, yIn - 40); fg.quadraticCurveTo((x0 + x1) / 2, Math.min(yIn, yOut) - 54, x1, yOut - 40); fg.stroke(); }
    faceTex.needsUpdate = true;
  }
  const api = {
    group: root, body, head, arms, eyes, torso,
    // look: [x,y] Blickrichtung -1..1, blink 0..1, eye: Augengroesse, mouth: 'smile'|'frown'|'o'|'flat', open 0..1, brow -1..1
    set({ look = [0, 0], blink = 0, eye = 1, mouth = 'flat', open = 0, brow = 0, armL = 0.25, armR = 0.25, fwd = 0, headTilt = 0, headTurn = 0, nod = 0 } = {}) {
      for (const e of eyes) { e.iris.position.set(look[0] * 0.07, look[1] * 0.06, 0); e.g.scale.set(eye * 0.66, eye * 0.66 * Math.max(0.06, 1 - blink), eye * 0.66); }
      drawFace(mouth, open, brow);
      arms[0].rotation.set(-fwd, 0, -armL); arms[1].rotation.set(-fwd, 0, armR);
      head.rotation.set(nod, headTurn, headTilt);
    },
  };
  api.set();
  return api;
}
