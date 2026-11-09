// Maios CGI – Led crystal lampe (Produkt 21), Variante "Krone": Holzsockel + Krone aus gehaemmertem Acryl.
// Masse aus der Anleitung (120 x 120 mm), Einheit Meter. Licht per setColor(col, k).
// Die Projektion (Wasserwellen an Wand und Decke) macht die Szene mit projShader().
import * as THREE from 'three';
import { canvasTex, rng } from './core.js';

export const R_BASE = 0.06, H_BASE = 0.022, R_CROWN = 0.052, H_CROWN = 0.072, SPIKE = 0.038, NSPIKE = 6;
export const TOP = H_BASE + H_CROWN + SPIKE;      // Hoehe bis zu den Spitzen
export const MID = H_BASE + H_CROWN * 0.45;       // Lichtmitte

// gehaemmertes Muster (Zellen mit hellen Raendern), kachelbar in x
function hammer(w, h, seed) {
  const R = rng(seed), pts = [];
  for (let i = 0; i < 420; i++) pts.push([R() * w, R() * h]);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let d1 = 1e9, d2 = 1e9;
    for (const [px, py] of pts) for (const ox of [-w, 0, w]) {
      const dx = x - px - ox, dy = (y - py) * 0.8, d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    const e = Math.sqrt(d2) - Math.sqrt(d1);           // 0 an der Kante
    // runde Dellen: weiche, helle Kuppen mit Glanzpunkt, dunkle weiche Fugen (wie gehaemmertes Acryl)
    const dome = Math.pow(Math.max(0, Math.min(1, e / 9)), 0.7);
    const v = 0.15 + 0.6 * dome + 0.4 * Math.pow(Math.max(0, 1 - Math.sqrt(d1) / 7), 2);                  // heller Rand
    const k = (y * w + x) * 4; const val = Math.min(255, v * 230);
    img.data[k] = img.data[k + 1] = img.data[k + 2] = val; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function makeLamp() {
  const group = new THREE.Group();
  const R = rng(21);
  // ---------- Sockel: helles Holz, Touch-Taste vorne ----------
  const woodTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#d6ad7d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${90 + R() * 40 | 0},${55 + R() * 25 | 0},${25},${0.08 + R() * 0.16})`; g.lineWidth = 0.6 + R() * 2.2;
      const y = R() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (R() - 0.5) * 14, w * 0.7, y + (R() - 0.5) * 14, w, y + (R() - 0.5) * 6); g.stroke(); }
  });
  woodTex.wrapS = THREE.RepeatWrapping;
  const wood = new THREE.MeshStandardMaterial({ map: woodTex, color: '#ffe6c8', roughness: 0.55, emissive: new THREE.Color('#5a4128'), emissiveMap: woodTex, emissiveIntensity: 0.35 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R_BASE, R_BASE * 1.02, H_BASE, 96, 1, false), wood);
  base.position.y = H_BASE / 2; base.castShadow = base.receiveShadow = true; group.add(base);
  const bevel = new THREE.Mesh(new THREE.TorusGeometry(R_BASE - 0.0015, 0.0015, 8, 96), wood); bevel.rotation.x = Math.PI / 2; bevel.position.y = H_BASE; group.add(bevel);
  // Touch-Symbol (Ein/Aus) vorne eingebrannt
  const icon = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(70,40,18,0.85)'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.arc(64, 68, 24, -Math.PI * 0.32, Math.PI * 1.32); g.stroke(); g.beginPath(); g.moveTo(64, 34); g.lineTo(64, 64); g.stroke();
  });
  const iconM = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.012), new THREE.MeshStandardMaterial({ map: icon, transparent: true, roughness: 0.6, depthWrite: false }));
  iconM.position.set(0, H_BASE * 0.48, R_BASE * 1.01 + 0.0003); group.add(iconM);

  // ---------- Krone: offene Roehre, Oberkante mit 5 Spitzen, gehaemmerte Wand ----------
  const hm = hammer(512, 192, 7);
  const emiTex = new THREE.CanvasTexture(hm); emiTex.wrapS = emiTex.wrapT = THREE.RepeatWrapping; emiTex.repeat.set(2, 1.4); emiTex.colorSpace = THREE.SRGBColorSpace;
  const bumpTex = new THREE.CanvasTexture(hm); bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping; bumpTex.repeat.set(2, 1.4);
  const spike = (phi) => { const c = Math.cos(NSPIKE * phi); return SPIKE * (0.15 + 0.85 * Math.pow(Math.max(0, c), 2.2)) - SPIKE * 0.18 * Math.pow(Math.max(0, -c), 2); };
  function shell(rad, inner) {
    const geo = new THREE.CylinderGeometry(rad, rad * 0.985, 1, 160, 40, true);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), v = p.getY(i) + 0.5; const phi = Math.atan2(x, z);
      const top = H_CROWN + spike(phi); const y = H_BASE + v * top;
      // Spitzen laufen schmal zu: Radius oben an den Spitzen leicht nach innen
      const k = 1 - 0.06 * Math.max(0, v - 0.75) * 4 * (inner ? 1 : 1);
      const n = 1 + (inner ? 0 : 0.012 * Math.sin(phi * 23 + v * 9) * Math.sin(phi * 11 - v * 14));
      p.setXYZ(i, x * k * n, y, z * k * n); uv.setXY(i, uv.getX(i), y / TOP);
    }
    geo.computeVertexNormals(); return geo;
  }
  const crystal = new THREE.MeshStandardMaterial({
    color: '#2a2c36', roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.3,
    emissive: new THREE.Color('#ffffff'), emissiveMap: emiTex, emissiveIntensity: 1.0,
    bumpMap: bumpTex, bumpScale: 1.6, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6,
  });
  const outer = new THREE.Mesh(shell(R_CROWN, false), crystal); outer.renderOrder = 3; group.add(outer);
  const innerMat = crystal.clone(); innerMat.opacity = 0.35; innerMat.emissiveIntensity = 0.6;
  const inner = new THREE.Mesh(shell(R_CROWN - 0.004, true), innerMat); inner.renderOrder = 2; group.add(inner);
  // Kugeln auf den Spitzen
  const balls = [];
  for (let i = 0; i < NSPIKE; i++) {
    const phi = i * Math.PI * 2 / NSPIKE; const rr = R_CROWN * 0.94;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.0058, 20, 14), crystal); b.position.set(Math.sin(phi) * rr, H_BASE + H_CROWN + spike(phi) + 0.0035, Math.cos(phi) * rr);
    b.renderOrder = 4; group.add(b); balls.push(b);
  }
  // Leuchtkern (LED im Sockel strahlt nach oben) – additive Lichtwolke in der Krone
  const glowTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, false);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.scale.set(0.11, 0.11, 1); glow.position.y = MID; glow.renderOrder = 5; group.add(glow);
  // Punktlicht fuer Umgebung (Tisch, Sockel)
  const pl = new THREE.PointLight('#ffffff', 0, 2.5, 2); pl.position.y = MID + 0.01; group.add(pl);

  const col = new THREE.Color();
  function setColor(c, k = 1) {
    col.set(c);
    const em = col.clone().lerp(new THREE.Color('#ffffff'), 0.12);
    crystal.emissive.copy(em); crystal.emissiveIntensity = 1.15 * k;
    innerMat.emissive.copy(em); innerMat.emissiveIntensity = 0.7 * k;
    glow.material.color.copy(col.clone().lerp(new THREE.Color('#ffffff'), 0.45)).multiplyScalar(0.9 * k);
    pl.color.copy(col); pl.intensity = 0.9 * k;
  }
  setColor('#9b5cff', 1);
  return { group, setColor, crystal, wood, glow, pl };
}


// ---------- Variante "Holz boden": Wuerfel aus Wellenglas auf dunklem, quadratischem Sockel (Shopfoto) ----------
export const CUBE = 0.1, CUBE_BASE = 0.125, CUBE_BASE_H = 0.02;
export const CUBE_MID = CUBE_BASE_H + CUBE * 0.5, CUBE_TOP = CUBE_BASE_H + CUBE;
export function makeCube() {
  const group = new THREE.Group();
  const baseM = new THREE.MeshPhysicalMaterial({ color: '#2a2d37', roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(CUBE_BASE, CUBE_BASE_H, CUBE_BASE, 4, 1, 4), baseM);
  base.position.y = CUBE_BASE_H / 2; base.castShadow = base.receiveShadow = true; group.add(base);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(CUBE_BASE - 0.012, 0.004, CUBE_BASE - 0.012), new THREE.MeshStandardMaterial({ color: '#0b0c10', roughness: 0.5 }));
  lip.position.y = CUBE_BASE_H + 0.002; group.add(lip);
  // Touch-Symbol vorne am Sockel
  const icon = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(190,190,200,0.9)'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.arc(64, 68, 30, -Math.PI * 0.32, Math.PI * 1.32); g.stroke(); g.beginPath(); g.moveTo(64, 30); g.lineTo(64, 64); g.stroke();
  });
  const iconM = new THREE.Mesh(new THREE.PlaneGeometry(0.011, 0.011), new THREE.MeshBasicMaterial({ map: icon, transparent: true, depthWrite: false }));
  iconM.position.set(0, CUBE_BASE_H * 0.5, CUBE_BASE / 2 + 0.0003); group.add(iconM);
  // Wuerfel: Wellenmuster (Dellen) als Emissive + Bump
  const hm = hammer(512, 512, 13);
  const emi = new THREE.CanvasTexture(hm); emi.wrapS = emi.wrapT = THREE.RepeatWrapping; emi.repeat.set(1.2, 1.2); emi.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(hm); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(1.2, 1.2);
  const crystal = new THREE.MeshStandardMaterial({
    color: '#9fb0c8', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.8,
    emissive: new THREE.Color('#ffffff'), emissiveMap: emi, emissiveIntensity: 1.0,
    bumpMap: bump, bumpScale: 3.2, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6,
  });
  const outer = new THREE.Mesh(new THREE.BoxGeometry(CUBE, CUBE, CUBE, 1, 1, 1), crystal);
  outer.position.y = CUBE_BASE_H + CUBE / 2 + 0.002; outer.renderOrder = 3; group.add(outer);
  const innerMat = crystal.clone(); innerMat.opacity = 0.5; innerMat.emissiveIntensity = 0.6;
  const inner = new THREE.Mesh(new THREE.BoxGeometry(CUBE - 0.008, CUBE - 0.008, CUBE - 0.008), innerMat);
  inner.position.copy(outer.position); inner.renderOrder = 2; group.add(inner);
  const glowTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.scale.set(0.13, 0.13, 1); glow.position.y = CUBE_MID; glow.renderOrder = 5; group.add(glow);
  const pl = new THREE.PointLight('#ffffff', 0, 2.5, 2); pl.position.y = CUBE_MID + 0.01; group.add(pl);
  const col = new THREE.Color();
  function setColor(c, k = 1) {
    col.set(c); const em = col.clone().lerp(new THREE.Color('#ffffff'), 0.02);
    crystal.emissive.copy(em); crystal.emissiveIntensity = 0.85 * k; innerMat.emissive.copy(em); innerMat.emissiveIntensity = 0.55 * k;
    glow.material.color.copy(col.clone().lerp(new THREE.Color('#ffffff'), 0.45)).multiplyScalar(0.9 * k);
    pl.color.copy(col); pl.intensity = 0.9 * k;
  }
  setColor('#2f8bff', 1);
  return { group, setColor, crystal, glow, pl };
}

// Projektion der Lampe auf Raumflaechen (Wasserwellen, langsam drehend), periodisch in 8 s.
// Material fuer Wand/Decke/Boden: Grundfarbe * (Umgebung + Projektion)
export function projMaterial({ albedo = '#cfc8be', map = null, repeat = [1, 1] } = {}) {
  const u = {
    uAlb: { value: new THREE.Color(albedo) }, uMap: { value: map }, uUseMap: { value: map ? 1 : 0 }, uRep: { value: new THREE.Vector2(...repeat) },
    uLamp: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color('#ff3b1f') }, uK: { value: 1 }, uT: { value: 0 },
    uAmb: { value: new THREE.Color('#0d1018') }, uMoon: { value: new THREE.Color('#000000') }, uMoonDir: { value: new THREE.Vector3(0, 0, 1) },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vUv = uv; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uAlb; uniform sampler2D uMap; uniform float uUseMap; uniform vec2 uRep;
      uniform vec3 uLamp; uniform vec3 uCol; uniform float uK; uniform float uT; uniform vec3 uAmb; uniform vec3 uMoon; uniform vec3 uMoonDir;
      varying vec3 vW; varying vec3 vN; varying vec2 vUv;
      #define TAU 6.28318530718
      float caust(vec2 p, float time){
        vec2 i = p; float c = 1.0; float inten = 0.005;
        for (int n = 0; n < 5; n++) {
          float m = (n==0)?1.0:(n==1)?-1.0:(n==2)?2.0:(n==3)?-2.0:1.0;
          float t = time*m + float(n)*1.7;
          i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
          c += 1.0/length(vec2(p.x/(sin(i.x + t)/inten), p.y/(cos(i.y + t)/inten)));
        }
        c /= 5.0; c = 1.17 - pow(c, 1.4); return pow(abs(c), 6.0);
      }
      void main(){
        vec3 alb = uAlb; if (uUseMap > 0.5) alb *= texture2D(uMap, vUv*uRep).rgb;
        vec3 L = vW - uLamp; float dist = length(L); vec3 d = L/dist;
        float ph = uT/8.0;                                     // Phase 0..1 in 8 s
        // Projektion ohne Pol: Richtung auf eine Ebene ueber der Lampe abbilden; in 8 s zieht das Muster genau eine Kachel weiter
        vec2 uv = d.xz/(d.y + 1.35)*2.2 + vec2(ph, 0.0);
        vec2 p = mod(uv*TAU, TAU) - 250.0;
        float c = caust(p, ph*TAU);
        vec2 p2 = mod((uv*1.6 + vec2(0.37, 0.11))*TAU, TAU) - 250.0;
        float c2 = caust(p2, -ph*TAU + 1.3);
        float wave = clamp(c*1.1 + c2*0.55, 0.0, 1.6);
        float up = smoothstep(-0.35, 0.15, d.y);                 // nach unten verdeckt der Sockel
        float ndl = max(dot(normalize(vN), -d), 0.0);
        float fall = 1.0/(0.25 + dist*dist);
        vec3 proj = uCol*uK*fall*ndl*up*(0.22 + 1.0*wave);
        vec3 moon = uMoon*max(dot(normalize(vN), -uMoonDir), 0.0);
        vec3 col = alb*(uAmb + proj + moon);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  m.toneMapped = true;
  return m;
}
