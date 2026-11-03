// Maios CGI – Wasserspender-Szene als Baustein (fuer Clips nach Wasserspender v2): Geraete, Glas, Flasche, Strahl,
// Tropfen, Schlauch, USB-Stecker, Buero-/Zuhause-Requisiten, Kaustik am Boden und die Zustands-Helfer.
import * as THREE from 'three';
import { contactShadow, v3, clamp, seg, ease, rng, canvasTex } from './core.js';
import * as WM from './ws_models.js';
import { TIEFE, CAUSTIC } from './tiefe.js';

export function makeWsSzene(scene, cam) {
  const lin = (h) => new THREE.Color(h);
  // Kaustik-Licht auf dem Boden (additiv)
  const cauU = { uTime: { value: 0 }, uI: { value: 0.0 }, uCol: { value: lin(TIEFE.kaustik) } };
  const caustics = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.ShaderMaterial({
    uniforms: cauU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime, uI; uniform vec3 uCol;
${CAUSTIC}
void main(){ vec2 p = vUv * 11.0; float c = caust(p, uTime * 1.1) * 0.6 + caust(p * 1.7 + 3.1, uTime * 1.5) * 0.4;
  float m = 1.0 - smoothstep(0.12, 0.5, length(vUv - 0.5));
  gl_FragColor = vec4(uCol * pow(c, 2.4) * m * uI, 1.0);
  #include <colorspace_fragment>
}`,
  }));
  caustics.rotation.x = -Math.PI / 2; caustics.position.y = 0.006; caustics.renderOrder = 2; scene.add(caustics);
  const lamp = new THREE.PointLight('#ffb766', 0, 9, 1.6); scene.add(lamp);

  const W = WM.makeDispenser('weiss'); scene.add(W.group);
  const SW = WM.makeDispenser('schwarz'); scene.add(SW.group);
  for (const D of [W, SW]) D.ledMat.emissive.set('#79e6ff');
  const csW = contactShadow(3.2, 0.55), csS = contactShadow(3.2, 0.55); scene.add(csW, csS);
  const G = WM.makeGlass(); scene.add(G.group);
  const G2 = WM.makeGlass(); scene.add(G2.group);
  for (const gl of [G, G2]) { gl.mat.opacity = 0.16; gl.water.material.attenuationColor.set('#a9ecfb'); gl.water.material.attenuationDistance = 2.6; }
  const J = WM.makeJug(); scene.add(J.group); J.water.material.attenuationColor.set('#a9ecfb'); J.water.material.attenuationDistance = 3.0;
  const stream = WM.makeStream(); scene.add(stream); stream.material.emissive.set('#d8f8ff'); stream.material.emissiveIntensity = 0.12;
  const R = rng(21);
  const drops = []; for (let i = 0; i < 12; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.018 + R() * 0.02, 12, 8), WM.waterMat()); scene.add(d); drops.push({ m: d, a: R() * 6.28, v: 0.5 + R(), o: R() }); }
  const bubbles = []; for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.012 + R() * 0.016, 10, 8), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.7, envMapIntensity: 2.4 })); scene.add(b); bubbles.push({ m: b, x: (R() - 0.5) * 0.4, z: (R() - 0.5) * 0.4, v: 0.5 + R() * 0.7, o: R() }); }
  const glowTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(220,250,255,1)'); gr.addColorStop(0.25, 'rgba(120,230,255,0.55)'); gr.addColorStop(1, 'rgba(120,230,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const mkGlows = (D) => D.buttons.map((b) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); s.scale.setScalar(0.42); s.position.set(0, 0.06, 0); b.add(s); return s; });
  const glows = mkGlows(W), glowsS = mkGlows(SW);
  let tube = null;
  function tubeAt(dip, jx = 2.5, jz = -1.9) {
    if (tube) { scene.remove(tube.mesh); tube.mesh.geometry.dispose(); }
    const pts = [v3(0, 0.16, -1.13), v3(0.05, 0.08, -1.45), v3(0.6, 0.04, -2.1), v3(1.6, 0.05, -2.45), v3(jx - 0.25, 0.9, jz - 0.4), v3(jx - 0.05, 2.55, jz - 0.1), v3(jx, 3.15 - dip * 0.1, jz), v3(jx, 3.0 - dip, jz)];
    tube = WM.makeTube(pts, 0.034); tube.mat.opacity = 0.95; scene.add(tube.mesh); return tube;
  }
  const plug = new THREE.Group(); scene.add(plug);
  { const pm = new THREE.MeshPhysicalMaterial({ color: '#f2f1ee', roughness: 0.4 }); const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.26), pm); head.position.z = -0.13; plug.add(head);
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: '#cfcfcf', metalness: 1, roughness: 0.2 })); pin.position.z = 0.04; plug.add(pin);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v3(0, 0, -0.26), v3(0, -0.02, -0.7), v3(0.15, -0.12, -1.3), v3(0.6, -0.15, -2.4)]), 40, 0.025, 10), pm); plug.add(cable); }
  // Requisiten (Buero, Zuhause)
  const props = new THREE.Group(); scene.add(props);
  const wood = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#b98b5e'; g.fillRect(0, 0, w, h); const Rr = rng(5); for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(${90 + Rr() * 40},${55 + Rr() * 25},${30},${0.12 + Rr() * 0.18})`; g.lineWidth = 1 + Rr() * 4; g.beginPath(); const y = Rr() * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 8 + (Rr() - 0.5) * 6); g.stroke(); } });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2, 2);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 8), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.55, clearcoat: 0.2 })); desk.position.y = -0.15; desk.receiveShadow = true; props.add(desk);
  const lap = new THREE.Group(); props.add(lap);
  { const al = new THREE.MeshStandardMaterial({ color: '#c9c9cb', metalness: 0.8, roughness: 0.35 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.8), al); b.position.y = 0.04; b.castShadow = true; lap.add(b);
    const scrG = new THREE.Group(); scrG.position.set(0, 0.08, -0.9); scrG.rotation.x = -0.32; lap.add(scrG);
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.75, 0.05), al); s.position.y = 0.875; s.castShadow = true; scrG.add(s);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(2.42, 1.58), new THREE.MeshBasicMaterial({ map: canvasTex(512, 340, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e9f4f5'); gr.addColorStop(1, '#bcd6da'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(11,42,51,.8)'; g.fillRect(40, 40, 200, 18); g.fillStyle = 'rgba(11,42,51,.3)'; for (let i = 0; i < 6; i++) g.fillRect(40, 90 + i * 30, 300 - i * 25, 10); g.fillStyle = 'rgba(31,98,115,.7)'; g.fillRect(380, 90, 90, 170); }) }));
    disp.position.set(0, 0.875, 0.027); scrG.add(disp);
    lap.position.set(-2.0, 0, -1.2); lap.rotation.y = 0.55; }
  const plant = new THREE.Group(); props.add(plant);
  { const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.42, 0], [0.5, 0.75], [0.54, 0.8], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y)), 48), new THREE.MeshPhysicalMaterial({ color: '#c97a5a', roughness: 0.7 })); pot.castShadow = true; plant.add(pot);
    const leaf = new THREE.MeshPhysicalMaterial({ color: '#7fae5c', roughness: 0.45, sheen: 0.3, side: THREE.DoubleSide }); const Rp = rng(8);
    for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), leaf); l.scale.set(0.35, 1, 0.08); const a = i / 9 * Math.PI * 2; l.position.set(Math.cos(a) * 0.28, 1.35 + Rp() * 0.5, Math.sin(a) * 0.28); l.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5); l.castShadow = true; plant.add(l); }
    plant.position.set(1.75, 0, -1.5); }
  const nstand = new THREE.Group(); props.add(nstand);
  { const lampG = new THREE.Group(); nstand.add(lampG); lampG.position.set(2.1, 0, -1.0);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.12, 32), new THREE.MeshStandardMaterial({ color: '#2a241c', metalness: 0.6, roughness: 0.3 })); foot.position.y = 0.06; lampG.add(foot);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 12), foot.material); stem.position.y = 1.2; lampG.add(stem);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 0.9, 48, 1, true), new THREE.MeshStandardMaterial({ color: '#f3dcb3', emissive: new THREE.Color('#ffb766'), emissiveIntensity: 1.6, side: THREE.DoubleSide, roughness: 0.9 }));
    shade.position.y = 2.45; lampG.add(shade); nstand.userData.lampPos = v3(2.1, 2.3, -1.0); }

  // ---------- Zustands-Helfer ----------
  function hideAll() {
    for (const o of [W.group, SW.group, csW, csS, G.group, G2.group, J.group, stream, plug, props, lap, plant, nstand, desk, caustics]) o.visible = false;
    if (tube) tube.mesh.visible = false;
    drops.forEach((d) => (d.m.visible = false)); bubbles.forEach((b) => (b.m.visible = false));
    for (const D of [W, SW]) { D.ledMat.emissiveIntensity = 0; D.buttons.forEach((b) => (b.position.y = 0.4)); D.group.scale.setScalar(1); }
    [...glows, ...glowsS].forEach((g) => (g.visible = false)); G2.water.visible = false; G.water.visible = false;
    lamp.intensity = 0; cauU.uI.value = 0;
  }
  function placeDisp(D, cs, x = 0, z = 0, ry = 0, y = 0) { D.group.visible = true; D.group.position.set(x, y, z); D.group.rotation.set(0, ry, 0); D.group.updateMatrixWorld(true); cs.visible = true; cs.position.set(x, y + 0.003, z - 0.3); cs.scale.setScalar(1); cs.material.opacity = 1; }
  function glassOn(D, glass, drop = 0, show = true) { D.group.updateMatrixWorld(true); glass.group.visible = show; const p = D.group.localToWorld(WM.GLAS_POS.clone()); glass.group.position.set(p.x, p.y + drop, p.z); glass.group.rotation.set(0, 0, 0); }
  function setWater(glass, h, t = 0, wave = 0) { glass.water.visible = h > 0.004; if (glass.water.visible) { glass.water.geometry.dispose(); glass.water.geometry = WM.waterGeometry(h, t, wave); } }
  // Wasser laeuft von on0 bis on1 aus der Duese ins Glas
  function water(t, on0, on1, glass = G, disp = W, maxH = 1.02, slow = 1) {
    const h = maxH * ease.inOut(seg(t, on0 + 0.15, on1));
    const nz = disp.group.localToWorld(WM.NOZZLE.clone());
    const gw = glass.group.position; const surf = gw.y + 0.06 + h;
    setWater(glass, h, t, t > on0 && t < on1 + 0.2 ? 1 : 0);
    stream.visible = false; drops.forEach((d) => (d.m.visible = false)); bubbles.forEach((b) => (b.m.visible = false));
    if (t > on0 && t < on1 + 0.2) {
      const bot = Math.max(surf, nz.y - (t - on0) * 9);
      const top = t > on1 ? nz.y - (t - on1) * 9 : nz.y;
      if (top > bot) { stream.visible = true; stream.position.set(nz.x, (top + bot) / 2, nz.z); stream.scale.set(1 + 0.06 * Math.sin(t * 50 * slow), top - bot, 1 + 0.06 * Math.cos(t * 43 * slow)); }
      const ts = t * slow;
      if (bot <= surf + 0.01) drops.forEach((d) => { const lt = ((ts * 2.2 + d.o) % 0.4) / 0.4; d.m.visible = true; const rr = 0.04 + lt * 0.16 * d.v; d.m.position.set(nz.x + Math.cos(d.a) * rr, surf + Math.sin(lt * Math.PI) * 0.16 * d.v, nz.z + Math.sin(d.a) * rr); });
      bubbles.forEach((b) => { const lt = ((ts * b.v * 0.9 + b.o) % 1); const y = gw.y + 0.1 + lt * Math.max(0.05, h - 0.05); if (h > 0.1) { b.m.visible = true; b.m.position.set(gw.x + b.x * 0.6, y, gw.z + b.z * 0.6); } });
    }
    return h;
  }
  const glassMid = (gl, h = 0.65) => v3(gl.group.position.x, gl.group.position.y + h, gl.group.position.z);
  function causticsAt(x, z, I = 0.55, size = 1) { caustics.visible = true; caustics.position.set(x, 0.006, z); caustics.scale.setScalar(size); cauU.uI.value = I; }
  const ledOn = (D, I = 3, glow = false, t = 0) => { D.ledMat.emissiveIntensity = I; if (glow) (D === W ? glows : glowsS).forEach((g) => { g.visible = true; g.scale.setScalar(0.27 + 0.03 * Math.sin(t * 9)); }); };
  const screen = (obj, local) => { const v = obj.localToWorld(local.clone()); v.project(cam); return [(v.x + 1) / 2 * 1080, (1 - v.y) / 2 * 1920]; };
  return { W, SW, csW, csS, G, G2, J, stream, drops, bubbles, glows, glowsS, plug, props, desk, lap, plant, nstand, lamp, caustics, cauU,
    tubeAt, hideAll, placeDisp, glassOn, setWater, water, glassMid, causticsAt, ledOn, screen, NOZZLE: WM.NOZZLE, waterGeometry: WM.waterGeometry, waterMat: WM.waterMat };
}
