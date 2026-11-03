// Maios CGI – Nachtlichter mit Bewegungsmelder (Produkt 25): Holzstab (Nussbaum) mit Sensor-Auge, opalweisser Leuchtteil,
// runde Holzscheibe als Wandhalter. Masse aus dem Shopfoto (Stabbreite = 1): Scheibe 2,4, Holzteil 4,1, Leuchtteil 3,25.
// Einheiten: Meter. Ursprung = Wandflaeche in der Mitte der Scheibe, +x zeigt von der Wand in den Raum, +y nach oben.
import * as THREE from 'three';
import { woodTex } from './kugel_models.js';

export const STICK_R = 0.016;                         // Stab 3,2 cm breit
export const WOOD_L = 0.13, LIGHT_L = 0.103;          // Holzteil und Leuchtteil
export const DISC_R = 0.0385, DISC_T = 0.008;         // Wandscheibe
export const TOP = 0.0705;                            // Stab-Oberkante ueber der Scheibenmitte (Scheibe sitzt bei 30 % der Laenge)
export const AXIS_X = DISC_T + STICK_R;               // Stabachse vor der Wand
export const SENSOR_Y = TOP - 0.026;                  // Sensor-Auge
export const LIGHT_MID = TOP - WOOD_L - LIGHT_L / 2;  // Mitte des Leuchtteils

export function nussTex(seed = 21) { return woodTex(seed, '#6a4a34', [44, 28, 18]); }

export function makeNachtlicht(tex = nussTex()) {
  const g = new THREE.Group(); g.name = 'nachtlicht';
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const wood = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.58, clearcoat: 0.15, clearcoatRoughness: 0.5, sheen: 0.12, sheenColor: new THREE.Color('#ffe9cc') });
  // Wandscheibe (Achse = x)
  const discTex = tex.clone(); discTex.needsUpdate = true; discTex.repeat.set(0.55, 0.55);
  const discMat = wood.clone(); discMat.map = discTex;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(DISC_R, DISC_R, DISC_T, 96), discMat);
  disc.rotation.z = Math.PI / 2; disc.position.x = DISC_T / 2; disc.castShadow = true; disc.receiveShadow = true; g.add(disc);
  // Holzstab mit leicht gefaster Oberkante
  const b = 0.0016, prof = [[0, 0], [STICK_R, 0], [STICK_R, WOOD_L - b], [STICK_R - b * 0.6, WOOD_L - b * 0.25], [STICK_R - b, WOOD_L], [0, WOOD_L]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const woodGeo = new THREE.LatheGeometry(prof, 72);
  const uv = woodGeo.attributes.uv, pos = woodGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setY(i, pos.getY(i) * 4.0);   // Maserung laengs
  const stick = new THREE.Mesh(woodGeo, wood); stick.position.set(AXIS_X, TOP - WOOD_L, 0); stick.castShadow = true; stick.receiveShadow = true; g.add(stick);
  // Leuchtteil (opalweisses Acryl), unten weich gerundet
  const lb = 0.003, lprof = [[0, 0], [STICK_R - lb, 0], [STICK_R - lb * 0.3, lb * 0.3], [STICK_R, lb], [STICK_R, LIGHT_L - 0.0006], [STICK_R - 0.0008, LIGHT_L], [0, LIGHT_L]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const lightMat = new THREE.MeshPhysicalMaterial({ color: '#f3efe7', roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.3, emissive: new THREE.Color('#ffd7a0'), emissiveIntensity: 0, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') });
  const glow = new THREE.Mesh(new THREE.LatheGeometry(lprof, 72), lightMat); glow.position.set(AXIS_X, TOP - WOOD_L - LIGHT_L, 0); g.add(glow);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(STICK_R - 0.0002, 0.00045, 8, 72), new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 0.6 }));
  seam.rotation.x = Math.PI / 2; seam.position.set(AXIS_X, TOP - WOOD_L, 0); g.add(seam);
  // Sensor-Auge (schwarze Kuppel) + kleiner Lichtsensor darunter, vorne auf dem Holz
  const sensMat = new THREE.MeshPhysicalMaterial({ color: '#0b0b0d', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.0012, 48), new THREE.MeshPhysicalMaterial({ color: '#17120f', roughness: 0.4 }));
  ring.rotation.z = Math.PI / 2; ring.position.set(AXIS_X + STICK_R - 0.0009, SENSOR_Y, 0); g.add(ring);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.0053, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), sensMat);
  dome.rotation.z = -Math.PI / 2; dome.scale.set(1, 0.75, 1); dome.position.set(AXIS_X + STICK_R + 0.0004, SENSOR_Y, 0); g.add(dome);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0011, 16, 8), sensMat);
  dot.position.set(AXIS_X + STICK_R - 0.0002, SENSOR_Y - 0.0125, 0); g.add(dot);
  // Licht (wird von der Szene geregelt)
  const pl = new THREE.PointLight('#ffd8ad', 0, 0, 2); pl.position.set(AXIS_X + STICK_R + 0.03, LIGHT_MID, 0); pl.castShadow = false; g.add(pl);
  const spot = new THREE.SpotLight('#ffd9b0', 0, 0, 1.15, 0.9, 2); spot.position.set(AXIS_X + 0.02, LIGHT_MID - 0.02, 0);
  spot.target.position.set(AXIS_X + 0.25, -1.0, 0); g.add(spot, spot.target);
  function setOn(k) {   // k = 0 (aus) .. 1 (an)
    lightMat.emissiveIntensity = 2.6 * k; lightMat.color.set('#f3efe7').lerp(new THREE.Color('#fff4e2'), k);
    pl.intensity = 0.8 * k; spot.intensity = 2.4 * k;
  }
  return { group: g, wood, lightMat, pl, spot, setOn, dome, stick, glow, disc };
}
