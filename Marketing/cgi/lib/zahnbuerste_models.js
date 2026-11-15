// Maios CGI – Elektrische Schallzahnbürste (Produkt 57), Schwarz oder Weiss. Nach Shopfoto: schlanker Griff (leicht oval), goldene
// Taste mit Ring, darunter fünf Modus-Markierungen mit Aufdruck (White, Clean, Sensitive, Polish, Massage), Hals schmal, Kopf mit
// Borstenbüscheln (weiss/grau/schwarz). Einheiten: 1 = ca. 6 cm. Ursprung = Unterkante, +y oben, Vorderseite +z.
import * as THREE from 'three';
import { canvasTex } from './core.js';

export function makeZahnbuerste(farbe = 'schwarz', envMap = null) {
  const g = new THREE.Group(); g.name = 'zahnbuerste';
  const dark = farbe === 'schwarz';
  const body = new THREE.MeshPhysicalMaterial({ color: dark ? '#141516' : '#f2f2ef', roughness: dark ? 0.32 : 0.28, clearcoat: 0.7, clearcoatRoughness: 0.18, envMap, envMapIntensity: 0.9 });
  const gold = new THREE.MeshPhysicalMaterial({ color: dark ? '#d6a640' : '#c4c8cc', metalness: 0.9, roughness: 0.28, envMap, envMapIntensity: 1.1 });
  // Griff: Lathe, unten breiter, nach oben schmaler, leicht oval
  const prof = [[0, 0], [0.27, 0], [0.3, 0.04], [0.31, 0.2], [0.31, 2.2], [0.29, 2.9], [0.24, 3.25], [0.17, 3.45], [0.13, 3.6]];
  const handle = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 64), body); handle.scale.z = 0.82; handle.castShadow = true; g.add(handle);
  // Aufdruck vorn (Modus-Namen) als Abziehbild
  const decal = canvasTex(256, 1024, (c, w, h) => { c.clearRect(0, 0, w, h);
    c.fillStyle = dark ? 'rgba(220,220,220,.9)' : 'rgba(60,60,60,.9)'; c.font = '600 30px Manrope, sans-serif'; c.textAlign = 'center';
    ['White', 'Clean', 'Sensitive', 'Polish', 'Massage'].forEach((s, i) => { c.fillText(s, w / 2, 190 + i * 112); c.strokeStyle = c.fillStyle; c.lineWidth = 3; c.beginPath(); c.roundRect(w / 2 - 22, 128 + i * 112, 44, 26, 13); c.stroke(); }); });
  const dm = new THREE.Mesh(new THREE.CylinderGeometry(0.312, 0.312, 1.6, 48, 1, true, -0.55, 1.1), new THREE.MeshPhysicalMaterial({ map: decal, transparent: true, roughness: 0.3, clearcoat: 0.7 }));
  dm.scale.z = 0.82; dm.position.y = 1.15; g.add(dm);
  // Goldene Taste (Langloch) + Ring
  const pill = (w, h, d, m) => { const s = new THREE.Shape(); const r = w / 2; s.absarc(0, h / 2 - r, r, 0, Math.PI, false); s.absarc(0, -h / 2 + r, r, Math.PI, Math.PI * 2, false);
    const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 3 }); return new THREE.Mesh(geo, m); };
  const btn = pill(0.2, 0.46, 0.03, gold); btn.position.set(0, 2.25, 0.245); g.add(btn);
  const sym = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 24, Math.PI * 1.6), new THREE.MeshStandardMaterial({ color: dark ? '#7a5a18' : '#6f757b', roughness: 0.5 })); sym.position.set(0, 2.33, 0.29); sym.rotation.z = Math.PI * 0.7; g.add(sym);
  // Hals (eigene Gruppe, damit er vibrieren kann) + Kopf mit Borsten
  const neck = new THREE.Group(); neck.position.y = 3.55; g.add(neck);
  const np = [[0.13, 0], [0.12, 0.3], [0.085, 1.2], [0.1, 1.55], [0.12, 1.72], [0.1, 1.9], [0, 1.95]];
  const nk = new THREE.Mesh(new THREE.LatheGeometry(np.map(([x, y]) => new THREE.Vector2(x, y)), 40), body); nk.scale.z = 0.7; nk.castShadow = true; neck.add(nk);
  const headPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.08), body); headPlate.position.set(0, 1.6, 0.06); neck.add(headPlate);
  const bw = new THREE.MeshStandardMaterial({ color: dark ? '#f4f4f2' : '#ffffff', roughness: 0.8 }), bg = new THREE.MeshStandardMaterial({ color: dark ? '#a8acb0' : '#4fb7c9', roughness: 0.8 }), bb = new THREE.MeshStandardMaterial({ color: dark ? '#202224' : '#3fa58a', roughness: 0.8 });
  for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) { const m = r % 3 === 0 ? bw : (r + c) % 2 ? bb : bg; const tuft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.2, 10), m);
    tuft.rotation.x = Math.PI / 2; tuft.position.set((c - 0.5) * 0.1, 1.36 + r * 0.095, 0.2); tuft.castShadow = true; neck.add(tuft); }
  return { group: g, neck, body, btn };
}

// Aufsteck-Ersatzkopf (ohne Griff)
export function makeErsatzkopf(farbe = 'schwarz', envMap = null) {
  const zb = makeZahnbuerste(farbe, envMap); const g = new THREE.Group();
  zb.neck.position.y = 0; g.add(zb.neck);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.5, 32), zb.body); base.position.y = -0.2; base.scale.z = 0.8; base.castShadow = true; g.add(base);
  return { group: g };
}
