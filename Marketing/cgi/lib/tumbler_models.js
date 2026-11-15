// Maios CGI – Tumbler Becher (Produkt 47): isolierter 40-Oz-Becher mit Griff und Strohhalm. Masse nach Shopfoto
// (Storm Sea): schmaler Fuss (Getraenkehalter-Teil), Stufe, breiter Koerper, Edelstahlband, hellgrauer Deckel mit Drehschieber, Strohhalm, D-Griff.
// v2 (11.11.): Pulverbeschichtung mit feiner Struktur (Bump), Deckel mit vertiefter Oberseite und Drehschieber, Strohhalm als Rohr mit Wand,
// Griff mit weichen Uebergaengen. Einheiten: 1 = 10 cm. Ursprung = Bodenmitte, +y nach oben, Griff zeigt nach -x.
import * as THREE from 'three';
import { canvasTex, rng } from './core.js';

export const FARBEN = { 'storm sea': '#56707f', schwarz: '#1d1f22', 'cream weiss': '#efe9da', 'bay leaves': '#9aab9a', 'red rust': '#9a4a35', peony: '#f3b6c9', 'hell lila': '#d9c3dc' };
export const H_BODY = 2.55, H_BAND = 0.12, H_LID = 0.26;

let PEEL = null;
function peelTex() {   // feine Orangenhaut der Pulverbeschichtung
  if (PEEL) return PEEL;
  const R = rng(47);
  PEEL = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 100 + Math.floor(R() * 60); g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.beginPath(); g.arc(R() * w, R() * h, 1 + R() * 2.5, 0, Math.PI * 2); g.fill(); }
  }, false);
  PEEL.wrapS = PEEL.wrapT = THREE.RepeatWrapping; PEEL.repeat.set(3, 2);
  return PEEL;
}

export function makeTumbler(farbe = 'storm sea') {
  const g = new THREE.Group(); g.name = 'tumbler';
  const col = new THREE.Color(FARBEN[farbe] || farbe);
  const paint = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.45, bumpMap: peelTex(), bumpScale: 0.35, sheen: 0.15, sheenColor: new THREE.Color('#ffffff') });
  const steel = new THREE.MeshPhysicalMaterial({ color: '#e2e4e6', metalness: 1.0, roughness: 0.22, anisotropy: 0.6 });
  const lidM = new THREE.MeshPhysicalMaterial({ color: '#b9bdc1', roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  const lidDark = new THREE.MeshPhysicalMaterial({ color: '#c3c6c9', roughness: 0.45 });
  const strawM = new THREE.MeshPhysicalMaterial({ color: '#b9d3e3', roughness: 0.18, transmission: 0.55, thickness: 0.04, ior: 1.45, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  // Koerper: Fuss r 0.43 -> 0.47 (0..1.0), weiche Stufe bis 1.2 auf r 0.635, oben r 0.67 bei H_BODY; unten Fase
  const pts = [[0, 0], [0.38, 0], [0.415, 0.012], [0.43, 0.045], [0.45, 0.5], [0.47, 0.96]];
  for (let i = 0; i <= 12; i++) { const k = i / 12, s = k * k * (3 - 2 * k); pts.push([0.47 + 0.165 * s, 0.96 + 0.26 * k]); }
  pts.push([0.655, 1.8], [0.668, H_BODY - 0.02], [0.67, H_BODY]);
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 128), paint); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.672, 0.671, H_BAND, 128, 1, true), steel); band.position.y = H_BODY + H_BAND / 2; g.add(band);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.668, 0.008, 8, 128), steel); lip.rotation.x = Math.PI / 2; lip.position.y = H_BODY + H_BAND; g.add(lip);
  // Deckel: Rand, vertiefte Oberseite, Drehschieber mit Griffsteg, Strohhalm-Durchfuehrung
  const L0 = H_BODY + H_BAND;
  const LP = [[0.665, 0], [0.668, 0.02], [0.665, H_LID * 0.72], [0.645, H_LID - 0.012], [0.6, H_LID], [0.54, H_LID - 0.02], [0.5, H_LID - 0.05], [0.0, H_LID - 0.05]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const lid = new THREE.Mesh(new THREE.LatheGeometry(LP, 128), lidM); lid.position.y = L0; lid.castShadow = true; lid.receiveShadow = true; g.add(lid);
  const cover = new THREE.Group(); cover.position.set(0, L0 + H_LID - 0.05, 0); cover.rotation.y = 0.35; g.add(cover);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.47, 0.035, 96), lidM); disc.position.y = 0.0175; disc.castShadow = true; cover.add(disc);
  const ridgeShape = new THREE.Shape(); { const w = 0.62, h = 0.13, rr = 0.06; ridgeShape.moveTo(-w / 2 + rr, -h / 2); ridgeShape.lineTo(w / 2 - rr, -h / 2); ridgeShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr); ridgeShape.lineTo(w / 2, h / 2 - rr); ridgeShape.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2); ridgeShape.lineTo(-w / 2 + rr, h / 2); ridgeShape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr); ridgeShape.lineTo(-w / 2, -h / 2 + rr); ridgeShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2); }
  const ridge = new THREE.Mesh(new THREE.ExtrudeGeometry(ridgeShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 10 }), lidM);
  ridge.rotation.x = -Math.PI / 2; ridge.position.set(-0.12, 0.035, 0); ridge.castShadow = true; cover.add(ridge);
  const hole = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 12, 40), lidDark); hole.rotation.x = Math.PI / 2; hole.position.set(0.22, 0.04, 0); cover.add(hole);
  const sip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.1), new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.6 })); sip.position.set(-0.36, 0.037, 0); cover.add(sip);
  // Strohhalm (Rohr mit Wand), steht durch die Oeffnung
  const strawP = new THREE.Vector3(); cover.updateMatrixWorld(true); hole.getWorldPosition(strawP);
  const straw = new THREE.Group(); straw.position.set(strawP.x, L0 + H_LID - 0.2, strawP.z); straw.rotation.z = -0.02; g.add(straw);
  straw.add(new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 1.6, 32, 1, true), strawM));
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 1.6, 32, 1, true), strawM); straw.add(inner);
  const sTop = new THREE.Mesh(new THREE.RingGeometry(0.044, 0.056, 32), strawM); sTop.rotation.x = -Math.PI / 2; sTop.position.y = 0.8; straw.add(sTop);
  // Griff: D-Form als Rohr, leicht flach, mit verdickten Anschluessen
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.6, 2.36, 0), new THREE.Vector3(-0.88, 2.42, 0), new THREE.Vector3(-1.08, 2.32, 0), new THREE.Vector3(-1.14, 2.0, 0),
    new THREE.Vector3(-1.13, 1.52, 0), new THREE.Vector3(-1.07, 1.3, 0), new THREE.Vector3(-0.86, 1.22, 0), new THREE.Vector3(-0.58, 1.24, 0)]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(path, 120, 0.115, 28, false), paint); handle.scale.z = 0.82; handle.castShadow = true; handle.receiveShadow = true; g.add(handle);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 20), paint); cap.scale.set(1.0, 0.95, 0.72); cap.position.set(-0.63, 2.34, 0); cap.castShadow = true; g.add(cap);
  const cap2 = cap.clone(); cap2.position.set(-0.6, 1.25, 0); cap2.scale.set(0.9, 0.75, 0.66); g.add(cap2);
  return { group: g, paint, steel, lidM, strawM, straw, body, handle, lid, cover };
}
