// Maios CGI – Elektrische Kaffee- und Gewürzmühle (Produkt 55). Masse nach Shopfoto: schwarzer Sockel, Edelstahl-Unterteil mit
// schwarzem Drehknopf-Taster vorn, breiterer Edelstahl-Mahlbecher mit zwei Schrauben, durchsichtiger Deckel mit Rippen.
// Einheiten: 1 = ca. 8,5 cm. Ursprung = Bodenmitte, +y oben, Taster zeigt nach +z.
import * as THREE from 'three';

export const H_BASE = 0.32, H_LOW = 0.62, H_BOWL = 0.86, H_LID = 0.42;

export function makeMuehle(envMap = null) {
  const g = new THREE.Group(); g.name = 'muehle';
  const steel = new THREE.MeshPhysicalMaterial({ color: '#c9ced3', metalness: 1, roughness: 0.32, anisotropy: 0.8, envMap, envMapIntensity: 1.15 });
  const black = new THREE.MeshPhysicalMaterial({ color: '#121314', roughness: 0.38, clearcoat: 0.5 });
  const lidM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 0.92, thickness: 0.06, ior: 1.45, transparent: true, opacity: 0.6, envMap, envMapIntensity: 1.0, side: THREE.DoubleSide });
  const lathe = (pts, m, seg = 128) => { const me = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), m); me.castShadow = true; me.receiveShadow = true; g.add(me); return me; };
  // Sockel (schwarz, unten leicht eingezogen)
  lathe([[0, 0], [0.6, 0], [0.64, 0.03], [0.665, 0.12], [0.665, H_BASE]], black);
  // Unterteil (Edelstahl), oben leicht eingezogen
  const y1 = H_BASE, y2 = H_BASE + H_LOW;
  lathe([[0.665, y1], [0.665, y1 + 0.22], [0.6, y1 + 0.32], [0.585, y2 - 0.02], [0.59, y2]], steel);
  // Mahlbecher (breiter), unten abgerundet, oben Bördelrand
  const y3 = y2 + H_BOWL;
  const bowl = lathe([[0.59, y2], [0.66, y2 + 0.03], [0.72, y2 + 0.12], [0.735, y2 + 0.3], [0.74, y3 - 0.05], [0.755, y3 - 0.02], [0.755, y3]], steel);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.71, 0.66, H_BOWL - 0.1, 96, 1, true), new THREE.MeshPhysicalMaterial({ color: '#b8bcc0', metalness: 1, roughness: 0.3, side: THREE.BackSide, envMap }));
  inner.position.y = y3 - (H_BOWL - 0.1) / 2; g.add(inner);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.66, 64), new THREE.MeshPhysicalMaterial({ color: '#9da2a6', metalness: 1, roughness: 0.35, envMap })); floor.rotation.x = -Math.PI / 2; floor.position.y = y2 + 0.12; g.add(floor);
  // Messer (Kreuz) in der Mitte
  const blades = new THREE.Group(); blades.position.y = y2 + 0.2; g.add(blades);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.02, 0.09), steel); b.rotation.y = i * Math.PI / 2; b.rotation.z = (i ? 1 : -1) * 0.12; blades.add(b); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 24), steel); blades.add(hub);
  for (const s of [-1, 1]) { const sc = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), steel); sc.position.set(0.745 * s, y3 - 0.08, 0); g.add(sc); }
  // Taster vorn (schwarzer Knopf im Ring)
  const btn = new THREE.Group(); btn.position.set(0, y1 + 0.25, 0.66); g.add(btn);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 40), black); ring.rotation.x = Math.PI / 2; btn.add(ring);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), black); cap.rotation.x = Math.PI / 2; cap.scale.set(1, 0.5, 1); cap.position.z = 0.015; btn.add(cap);
  // Deckel (durchsichtig) als eigene Gruppe, damit er abgenommen werden kann
  const lid = new THREE.Group(); lid.position.y = y3; g.add(lid);
  const LP = [[0.76, -0.06], [0.77, 0.0], [0.765, 0.06], [0.73, 0.1], [0.72, H_LID - 0.04], [0.69, H_LID], [0, H_LID]].map(([x, y]) => new THREE.Vector2(x, y));
  const lidMesh = new THREE.Mesh(new THREE.LatheGeometry(LP, 96), lidM); lidMesh.renderOrder = 5; lid.add(lidMesh);
  for (let i = 0; i < 8; i++) { const rb = new THREE.Mesh(new THREE.BoxGeometry(0.02, H_LID - 0.16, 0.035), lidM); const a = i / 8 * Math.PI * 2; rb.position.set(Math.cos(a) * 0.715, 0.24, Math.sin(a) * 0.715); rb.rotation.y = -a; lid.add(rb); }
  return { group: g, lid, blades, btn, cap, steel, lidM, topY: y3, bowlY: y2 };
}
