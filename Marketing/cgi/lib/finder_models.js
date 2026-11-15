// 3D-Modell: Bluetooth Anti-Lost Finder Wassertropfen (Produkt 17) – nach Shopfoto: Tropfenform, grosser runder Knopf unten, Schluesselloch mit grauem Rand oben.
// Einheit: Breite des Koerpers = 1.0, Hoehe ~1.32, Dicke ~0.32. Schalen vorne/hinten + Platine fuer die Explosionsansicht.
import * as THREE from 'three';

export const FARBEN = { schwarz: '#2c2c2c', weiss: '#f8f8f8', gruen: '#7ed321', pink: '#e91e63', gold: '#ffd700', silber: '#c0c0c0' };
const R1 = 0.5, R2 = 0.22, C2Y = 0.82;   // grosser Kreis (0,0), kleiner Kreis oben (0,C2Y)

function drop(r1, r2, c2y, hole = null) {
  const d = c2y, a = Math.asin((r1 - r2) / d);
  const s = new THREE.Shape();
  s.moveTo(r1 * Math.cos(a), r1 * Math.sin(a));
  s.absarc(0, 0, r1, a, -Math.PI - a, true);                       // unten herum (im Uhrzeigersinn)
  s.lineTo(r2 * Math.cos(Math.PI - a), c2y + r2 * Math.sin(Math.PI - a));
  s.absarc(0, c2y, r2, Math.PI - a, a, true);                       // oben herum
  s.closePath();
  if (hole) { const h = new THREE.Path(); h.absarc(hole[0], hole[1], hole[2], 0, Math.PI * 2, false); s.holes.push(h); }
  return s;
}

export function makeFinder(farbe = 'weiss') {
  const g = new THREE.Group(); g.name = 'finder';
  const col = FARBEN[farbe];
  const body = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35 });
  const edge = (r) => ({ depth: 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 6, curveSegments: 64 });
  const HOLE = [0, 0.62, 0.17];
  const geo = new THREE.ExtrudeGeometry(drop(R1 - 0.05, R2 - 0.05, C2Y, HOLE), edge());
  const front = new THREE.Mesh(geo, body); front.position.z = 0.05; front.castShadow = true; front.receiveShadow = true;
  const back = new THREE.Mesh(geo, body); back.position.z = -0.19; back.castShadow = true; back.receiveShadow = true;
  const fg = new THREE.Group(); fg.add(front);                         // Vorderseite: Knopf, Rand, LED-Punkt
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.012, 64), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.34, clearcoat: 0.8 }));
  btn.rotation.x = Math.PI / 2; btn.position.set(0, -0.1, 0.246); fg.add(btn);
  const groove = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.009, 8, 80), new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.55), roughness: 0.6 }));
  groove.position.set(0, -0.1, 0.244); fg.add(groove);
  const grey = new THREE.MeshStandardMaterial({ color: '#8d9095', roughness: 0.5 });
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.115, 0.17, 48), grey); rim.position.set(0, 0.62, 0.2425); fg.add(rim);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.016, 16), new THREE.MeshBasicMaterial({ color: '#0b0b0b' })); dot.position.set(0.2, 0.42, 0.2425); fg.add(dot);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.5, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#8d9095', roughness: 0.55, side: THREE.DoubleSide }));
  tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.62, 0); fg.add(tube);
  // Platine (nur in der Explosionsansicht sichtbar)
  const bg = new THREE.Group(); bg.visible = false;
  const pcb = new THREE.Mesh(new THREE.ExtrudeGeometry(drop(0.36, 0.1, C2Y - 0.04), { depth: 0.03, bevelEnabled: false, curveSegments: 48 }), new THREE.MeshStandardMaterial({ color: '#1d7a52', roughness: 0.5, metalness: 0.2 }));
  pcb.position.z = -0.015; bg.add(pcb);
  const chipM = new THREE.MeshStandardMaterial({ color: '#15171b', roughness: 0.4 });
  for (const [x, y, w, h] of [[0.08, 0.38, 0.22, 0.16], [-0.14, 0.22, 0.12, 0.1], [0.14, 0.12, 0.1, 0.1]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), chipM); c.position.set(x, y, 0.04); bg.add(c); }
  const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 48), new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 1, roughness: 0.3 }));
  cell.rotation.x = Math.PI / 2; cell.position.set(0, -0.1, -0.05); bg.add(cell);
  const trace = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.235, 48), new THREE.MeshBasicMaterial({ color: '#7fe0ae' })); trace.position.set(0, 0.2, 0.0305); bg.add(trace);
  g.add(back, bg, fg);
  const api = {
    group: g, body, front: fg, back, board: bg, rim,
    explode(e) { fg.position.z = 0.75 * e; back.position.z = -0.19 - 0.75 * e; bg.visible = e > 0.02; bg.position.z = 0; },
    HOLE: new THREE.Vector3(0, 0.62, 0),
  };
  return api;
}

// Schluesselbund: Finder am Ring, zwei Schluessel (alles in Finder-Einheiten, Bund liegt in der XY-Ebene)
export function makeKeys(farbe = 'weiss') {
  const F = makeFinder(farbe); const g = new THREE.Group(); g.add(F.group);
  const metal = new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 0.95, roughness: 0.32 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 12, 64), metal); ring.rotation.y = Math.PI / 2; ring.position.set(0, 0.62 + 0.21, 0); ring.castShadow = true; g.add(ring);
  for (const [ang, len, col] of [[0.35, 1.0, '#cfd3d8'], [-0.5, 0.85, '#d8b45a']]) {
    const k = new THREE.Group(); k.position.set(0, 1.07, 0); k.rotation.z = ang; g.add(k);
    const m = new THREE.MeshStandardMaterial({ color: col, metalness: 0.9, roughness: 0.34 });
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 36), m); head.rotation.x = Math.PI / 2; head.position.y = 0.15; head.castShadow = true; k.add(head);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 20), new THREE.MeshBasicMaterial({ color: '#17171a' })); hole.rotation.x = Math.PI / 2; hole.position.set(0, 0.15, 0.002); k.add(hole);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, len, 0.04), m); blade.position.y = 0.15 + 0.2 + len / 2 - 0.05; blade.castShadow = true; k.add(blade);
    for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), m); t.position.set(0.1, 0.5 + i * 0.16, 0); k.add(t); }
  }
  return { group: g, finder: F };
}
