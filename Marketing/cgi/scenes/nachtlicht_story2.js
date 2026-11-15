// Maios CGI – Nachtlichter mit Bewegungsmelder (Produkt 25) Story im @mehr.optic-Stil, 20,5 s, kein Loop: "Nachts leuchtet jeder mit dem Handy."
// Beats: Menge gleicher Figuren mit Handy-Taschenlampe vor der Nachtstadt -> eine Figur übersieht die Stufe (Ring, Kreuz) -> Blaupause "Eine Idee" ->
// Explosionsansicht (Bewegungsmelder, Klebestreifen) -> Treppe im Dunkeln: Figur geht los, Licht 1 geht an, Licht 2 geht an (Haken) ->
// Preis (Neon) vor der Wand mit zwei leuchtenden Nachtlichtern, "Flur oder Schlafzimmer?", Link im Profil.
// Neu gegenüber Flur (28.10.) und Mo-Story (4.11.): keine Kinderfigur, kein Flur/Lego, Treppe als Beweis, Blaupause + Explosionsansicht.
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makePostPro } from '../lib/post_pro.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { makeTiefe } from '../lib/tiefe.js';
import { makeKid } from '../lib/figur_pro.js';
import * as N from '../lib/nachtlicht_models.js';
import { STORY_CSS, makeKit } from '../lib/story_kit.js';

const style = document.createElement('style');
style.textContent = BR.CSS + STORY_CSS + `
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(0,0,0,.42)}
.tword{position:absolute;top:208px;padding:7px 14px 6px;border-radius:12px;background:rgba(0,0,0,.42);font:700 32px Manrope;color:#fff;letter-spacing:.01em;text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.7)}
.sub{left:105px!important;width:824px!important;font-size:66px!important}
.tcta{position:absolute;left:270px;width:400px;text-align:center;font:800 44px Manrope;color:#111;background:#fff;border-radius:18px;padding:20px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 italic 70px Manrope', 'ßüÜäÄöÖ€·?:✕✓');
await document.fonts.load('800 40px Manrope', 'ßüÜ€·?:');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.02, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;
const P = makePostPro(r, scene, cam, { bloom: [0.3, 0.55, 0.85], aoRadius: 0.5 });
const NOISE = (n, a = 0.3, sz = 512, rep = 4) => { const Rn = rng(n); const tx = canvasTex(sz, sz, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let i = 0; i < sz * 10; i++) { const v = 80 + Math.floor(Rn() * 100); g.fillStyle = `rgba(${v},${v},${v},${a})`; g.beginPath(); g.arc(Rn() * w, Rn() * h, 1 + Rn() * 5, 0, Math.PI * 2); g.fill(); } }, false); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(rep, rep); return tx; };
scene.fog = new THREE.FogExp2('#070b16', 0.02);

// ---------- Kulissen: Nachtstadt (blau-violett, spät), Blaupause, Treppenhaus, Preiswand ----------
const cityTex = canvasTex(1024, 1024, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#060a1f'); gr.addColorStop(0.55, '#141a45'); gr.addColorStop(1, '#2b2a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const Rc = rng(25);
  for (let i = 0; i < 110; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + Rc() * 0.6})`; g.fillRect(Rc() * w, Rc() * h * 0.5, 2, 2); }
  g.fillStyle = '#f4ecd2'; g.beginPath(); g.arc(w * 0.78, h * 0.16, 34, 0, Math.PI * 2); g.fill();
  for (let layer = 0; layer < 2; layer++) {
    let x = -20; const base = h * (0.62 + layer * 0.06);
    while (x < w) { const bw = 50 + Rc() * 80, bh = 120 + Rc() * (260 - layer * 90); g.fillStyle = layer ? '#070916' : '#0e1128'; g.fillRect(x, base - bh + layer * 40, bw, bh + 400);
      for (let wy = base - bh + 14 + layer * 40; wy < base + 20; wy += 22) for (let wx = x + 8; wx < x + bw - 10; wx += 16) if (Rc() < 0.12) { g.fillStyle = Rc() < 0.7 ? '#ffcf7a' : '#8fb6ff'; g.globalAlpha = 0.4 + Rc() * 0.5; g.fillRect(wx, wy, 7, 10); g.globalAlpha = 1; }
      x += bw + 4; }
  }
});
const city = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: cityTex, toneMapped: false })); city.position.set(0, 7.5, -9); scene.add(city);
const mirror = new Reflector(new THREE.PlaneGeometry(40, 30), { textureWidth: 540, textureHeight: 960, color: '#6a6f86' }); mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, -0.004, -14); scene.add(mirror);
const puddle = canvasTex(512, 512, (g, w, h) => { const Rp = rng(77); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { const x = Rp() * w, y = Rp() * h, rr = 20 + Rp() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } }, false); puddle.wrapS = puddle.wrapT = THREE.RepeatWrapping; puddle.repeat.set(5, 4);
const cityFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshPhysicalMaterial({ color: '#15172a', roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.45, roughnessMap: puddle, bumpMap: NOISE(31, 0.35, 512, 8), bumpScale: 0.4 })); cityFloor.rotation.x = -Math.PI / 2; cityFloor.position.z = -14; cityFloor.receiveShadow = true; scene.add(cityFloor);
// Stufe vor der Menge (die übersehene Kante)
const stepM = new THREE.MeshStandardMaterial({ color: '#6a7090', roughness: 0.7 });
const curb = new THREE.Mesh(new THREE.BoxGeometry(12, 0.28, 0.12), stepM); curb.position.set(0, -0.14, 0.94); curb.receiveShadow = true; scene.add(curb);
const curbTop = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), cityFloor.material); curbTop.rotation.x = -Math.PI / 2; curbTop.position.y = -0.28; curbTop.position.z = 16; scene.add(curbTop);

const blueTex = canvasTex(1024, 1024, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h * 0.5, w * 0.8); gr.addColorStop(0, '#0e3aa0'); gr.addColorStop(1, '#061a52'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(150,190,255,.16)'; g.lineWidth = 2; for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  g.strokeStyle = 'rgba(150,190,255,.07)'; g.lineWidth = 1; for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
});
const blue = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: blueTex, toneMapped: false })); blue.position.set(0, 1.6, -4.2); scene.add(blue);

// Treppenhaus: Stufen steigen nach rechts (+x), Wand dahinter bei z = WALLZ
const STAIR = new THREE.Group(); scene.add(STAIR);
const NST = 8, RUN = 0.62, RISE = 0.34, X0 = -2.6, WALLZ = -1.15;
const stepY = (x) => RISE * clamp(Math.floor((x - X0) / RUN) + 1, 0, NST);   // Trittfläche unter x
{
  const wallTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#c9c0b2'; g.fillRect(0, 0, w, h); const Rw = rng(4); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Rw() < 0.5 ? '255,255,255' : '80,70,60'},${Rw() * 0.05})`; g.fillRect(Rw() * w, Rw() * h, 3, 3); } });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(4, 2);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, bumpMap: NOISE(21, 0.3, 512, 6), bumpScale: 0.7 })); wall.position.set(0, 3.2, WALLZ); wall.receiveShadow = true; STAIR.add(wall);
  const oak = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#8a6646'; g.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { g.fillStyle = i % 2 ? 'rgba(50,30,15,.14)' : 'rgba(255,225,180,.06)'; g.fillRect(0, i * 10, w, 9); } });
  oak.wrapS = oak.wrapT = THREE.RepeatWrapping; const treadM = new THREE.MeshPhysicalMaterial({ map: oak, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, bumpMap: NOISE(22, 0.35, 256, 3), bumpScale: 0.25 }), riserM = new THREE.MeshPhysicalMaterial({ color: '#efe9df', roughness: 0.6, clearcoat: 0.2 });
  for (let i = 0; i < NST; i++) {
    const x = X0 + i * RUN, y = (i + 1) * RISE;
    const blk = new THREE.Mesh(new THREE.BoxGeometry(RUN, y, 2.2), riserM); blk.position.set(x + RUN / 2, y / 2, WALLZ + 1.1); blk.receiveShadow = true; blk.castShadow = true; STAIR.add(blk);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(RUN + 0.06, 0.05, 2.25), treadM); tr.position.set(x + RUN / 2 - 0.03, y + 0.025, WALLZ + 1.12); tr.receiveShadow = true; tr.castShadow = true; STAIR.add(tr);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.25, 12), treadM); nose.rotation.x = Math.PI / 2; nose.position.set(x - 0.03, y + 0.025, WALLZ + 1.12); STAIR.add(nose);
    const sk = new THREE.Mesh(new THREE.BoxGeometry(RUN, 0.16, 0.03), riserM); sk.position.set(x + RUN / 2, y + 0.13, WALLZ + 0.015); sk.castShadow = true; STAIR.add(sk);
  }
  const lowFloor = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.6 })); lowFloor.rotation.x = -Math.PI / 2; lowFloor.position.set(0, 0, 3); lowFloor.receiveShadow = true; STAIR.add(lowFloor);
  const topFloor = new THREE.Mesh(new THREE.BoxGeometry(6, NST * RISE, 2.2), riserM); topFloor.position.set(X0 + NST * RUN + 3, NST * RISE / 2, WALLZ + 1.1); STAIR.add(topFloor);
  const topTread = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 2.25), treadM); topTread.position.set(X0 + NST * RUN + 3, NST * RISE + 0.025, WALLZ + 1.12); STAIR.add(topTread);
  const frameM = new THREE.MeshPhysicalMaterial({ color: '#1d1b19', roughness: 0.4, clearcoat: 0.5 });
  for (const [fx, fy, fw, fh] of [[-1.6, 2.3, 0.9, 1.15], [-0.45, 2.55, 0.7, 0.9]]) { const fr = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.05), frameM); fr.position.set(fx, fy, WALLZ + 0.03); fr.castShadow = true; STAIR.add(fr);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.12, fh - 0.12), new THREE.MeshStandardMaterial({ map: canvasTex(128, 160, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#d8c9b0'); gr.addColorStop(0.6, '#9fa89a'); gr.addColorStop(1, '#5b6a63'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(40,50,48,.5)'; g.beginPath(); g.moveTo(0, h * 0.7); g.lineTo(w * 0.35, h * 0.5); g.lineTo(w * 0.6, h * 0.62); g.lineTo(w, h * 0.45); g.lineTo(w, h); g.lineTo(0, h); g.fill(); }), roughness: 0.8 })); art.position.set(fx, fy, WALLZ + 0.056); STAIR.add(art); }
  // Handlauf an der Wand
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, Math.hypot(NST * RUN, NST * RISE) + 0.6, 16), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.4, metalness: 0.4 }));
  rail.rotation.z = -Math.PI / 2 + Math.atan2(RISE, RUN); rail.position.set(X0 + NST * RUN / 2, NST * RISE / 2 + 1.3, WALLZ + 0.1); STAIR.add(rail);
}
// zwei Nachtlichter an der Treppenwand (Massstab: Figur ~ 2 m)
const NLS = 1.7;
const woodBump = (n) => { n.wood.bumpMap = n.wood.map; n.wood.bumpScale = 0.4; n.wood.roughness = 0.5; n.lightMat.transmission = 0; n.lightMat.sheen = 0.6; };
const mkWallNL = (x, y) => { const n = N.makeNachtlicht(); woodBump(n); n.spot.castShadow = true; n.spot.shadow.mapSize.set(1024, 1024); n.spot.shadow.bias = -0.0005; n.spot.angle = 1.2; n.spot.penumbra = 1; n.group.scale.setScalar(NLS); n.group.rotation.y = -Math.PI / 2; n.group.position.set(x, y, WALLZ + 0.002); scene.add(n.group); return n; };
const NL1 = mkWallNL(X0 + 5 * RUN, stepY(X0 + 5 * RUN) + 0.58), NL2 = mkWallNL(X0 + 1 * RUN, stepY(X0 + 1 * RUN) + 0.58);
function setNL(n, k, I = 1) {   // Leuchtteil + Raumlicht (Massstab der Szene)
  k = k * k * (3 - 2 * k);
  n.lightMat.emissiveIntensity = 2.6 * k; n.lightMat.color.set('#f3efe7').lerp(new THREE.Color('#fff4e2'), k);
  n.pl.intensity = 3.2 * k * I; n.pl.distance = 0; n.spot.intensity = 9 * k * I;
}
// Preiswand: zwei Nachtlichter nebeneinander, warm beleuchtet
const PW = new THREE.Group(); scene.add(PW);
const pwall = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ color: '#3a4258', roughness: 0.92, bumpMap: NOISE(23, 0.3, 512, 10), bumpScale: 0.5 })); pwall.receiveShadow = true; pwall.position.set(0, 0, 0); PW.add(pwall);
const PNL = [-0.3, 0.3].map((x) => { const n = N.makeNachtlicht(); woodBump(n); n.group.scale.setScalar(2.6); n.group.rotation.y = -Math.PI / 2; n.group.position.set(x, 0, 0.003); PW.add(n.group); return n; });
PW.position.set(0, 1.0, -30);

// ---------- Figuren (erwachsen, matt) mit Handy-Taschenlampe ----------
const trM = new THREE.MeshPhysicalMaterial({ color: '#2b3a4f', roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color('#7c8fb0'), bumpMap: NOISE(14, 0.5, 256, 8), bumpScale: 0.8 }), shoeM = new THREE.MeshPhysicalMaterial({ color: '#16181c', roughness: 0.45, clearcoat: 0.4 }), soleM = new THREE.MeshStandardMaterial({ color: '#e9e6df', roughness: 0.7 });
const LEG = 0.85 * 0.6;
const PUL = ['#51697c', '#c99a3a', '#b8503f', '#3f8a6a', '#4a5fa8', '#8a5aa0', '#607d8b'];
const coneGeo = new THREE.ConeGeometry(0.55, 3.2, 40, 1, true); coneGeo.translate(0, -1.6, 0);
const poolTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: '#fff3d6', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const coneMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  uniforms: { uOp: { value: 0.55 }, uCol: { value: new THREE.Color('#e4ecff') } },
  vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform float uOp; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float along = 1.0 - vUv.y; float e = abs(dot(normalize(vN), normalize(vV))); float a = uOp * pow(1.0 - along * 0.8, 2.2) * pow(e, 2.0) * smoothstep(0.0, 0.06, along); gl_FragColor = vec4(uCol * a, 1.0); }' });
const FAB = NOISE(12, 0.4, 256, 6), DEN = NOISE(13, 0.5, 256, 8);
function mkFigure(col, torch = true) {
  const K = makeKid(); scene.add(K.group); K.group.scale.setScalar(0.6);
  const cloth = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.92, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.45), bumpMap: FAB, bumpScale: 0.6 });
  K.torso.material = cloth; K.arms.forEach((a) => (a.children[0].material = cloth));
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(0.24 * s, 0.35, 0); K.group.add(p);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.62, 6, 12), trM); l.position.y = -0.5; l.castShadow = true; p.add(l);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), shoeM); f.scale.set(1, 0.6, 1.6); f.position.set(0, -1.07, 0.1); f.castShadow = true; p.add(f);
    const so = new THREE.Mesh(new THREE.SphereGeometry(0.205, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), soleM); so.scale.set(1.02, 0.35, 1.62); so.position.set(0, -1.08, 0.1); p.add(so); return p; });
  let cone = null, flash = null;
  if (torch) {   // Handy in der rechten Hand, Lichtkegel entlang des Arms
    const ph = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.04), new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.3 })); ph.position.set(0, -1.08, 0.12); ph.rotation.x = 0.2; K.arms[1].add(ph);
    flash = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })); flash.position.set(0, -1.2, 0.1); flash.rotation.x = Math.PI / 2; K.arms[1].add(flash);
    cone = new THREE.Mesh(coneGeo, coneMat); K.group.add(cone);
    const apex = v3(0.56, 1.2, 0.9), pool = v3(0.35, -0.84, 2.6), d = pool.clone().sub(apex);
    cone.position.copy(apex); cone.quaternion.setFromUnitVectors(v3(0, -1, 0), d.clone().normalize()); cone.scale.set(1, d.length() / 3.2, 1);
    var pl = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), poolMat); pl.rotation.x = -Math.PI / 2; pl.scale.set(1, 1.5, 1); pl.position.copy(pool).add(v3(0, 0.01, 0)); K.group.add(pl);
  }
  return { K, legs, cone, pool: typeof pl !== 'undefined' ? pl : null };
}
const SPOT = [[-1.7, 0], [0, 0], [1.7, 0], [-2.6, -1.9], [-0.9, -1.9], [0.9, -1.9], [2.6, -1.9]];
const crowd = SPOT.map((p, i) => ({ ...mkFigure(PUL[i]), x: p[0], z: p[1], ph: i * 0.37 }));
const hero = crowd[1];
function swing(f, u, amp = 0.3, skipR = false) { const w = Math.sin((u + f.ph) * 2 * Math.PI / 0.6); f.K.arms[0].rotation.x += w * amp; if (!skipR) f.K.arms[1].rotation.x -= w * amp; f.K.body.rotation.y = w * 0.06; f.K.head.rotation.z += Math.sin((u + f.ph) * 2 * Math.PI / 1.2) * 0.025; }
function walkFig(f, u, amp = 0.33) { const w = Math.sin((u + f.ph) * 2 * Math.PI / 0.6); f.legs[0].rotation.x = w * amp; f.legs[1].rotation.x = -w * amp; f.K.body.position.y = Math.abs(Math.cos((u + f.ph) * 2 * Math.PI / 0.6)) * 0.05; }
const dotT = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
const DUSTN = 220, dP = new Float32Array(DUSTN * 3), dS = []; { const Rd = rng(88); for (let i = 0; i < DUSTN; i++) dS.push([Rd(), Rd(), Rd(), Rd() * 6.28]); }
const dG = new THREE.BufferGeometry(); dG.setAttribute('position', new THREE.BufferAttribute(dP, 3));
const dust = new THREE.Points(dG, new THREE.PointsMaterial({ map: dotT, size: 0.03, color: '#ffe9c8', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); scene.add(dust);
function placeDust(t, box) { const [x0, y0, z0, x1, y1, z1] = box; for (let i = 0; i < DUSTN; i++) { const d = dS[i]; dP[i * 3] = lerp(x0, x1, d[0]) + Math.sin(t * 0.4 + d[3]) * 0.15; dP[i * 3 + 1] = lerp(y0, y1, (d[1] + t * 0.015) % 1); dP[i * 3 + 2] = lerp(z0, z1, d[2]) + Math.cos(t * 0.3 + d[3]) * 0.1; } dG.attributes.position.needsUpdate = true; }
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 12, 64), new THREE.MeshBasicMaterial({ color: '#ffd45c', toneMapped: false })); scene.add(ring);
const mo = mkFigure('#51697c', false); mo.ph = 0;

// ---------- Nachtlicht für Blaupause (mit Klebestreifen für die Explosionsansicht) ----------
const BP = N.makeNachtlicht(); woodBump(BP); scene.add(BP.group);
const tape = new THREE.Mesh(new THREE.CylinderGeometry(N.DISC_R * 0.82, N.DISC_R * 0.82, 0.0016, 64), new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.9 }));
tape.rotation.z = Math.PI / 2; BP.group.add(tape);
const outlines = [];
BP.group.traverse((m) => { if (m.isMesh && m.geometry && ['LatheGeometry', 'CylinderGeometry'].includes(m.geometry.type)) { const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), new THREE.LineBasicMaterial({ color: '#ffe08a', toneMapped: false })); m.add(l); outlines.push(l); } });
const base = new Map(); BP.group.children.forEach((c) => base.set(c, c.position.clone()));
function explode(e) {   // Scheibe + Klebestreifen nach hinten, Leuchtteil nach unten
  for (const [c, p] of base) c.position.copy(p);
  BP.disc.position.x -= 0.05 * e; tape.position.set(-0.002 - 0.1 * e, 0, 0);
  BP.glow.position.y -= 0.05 * e;
}

// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = { pill: mk('tpill', 'Werbung', 208), word: mk('tword', 'Nachtlicht'), cta: mk('tcta', 'Link im Profil', 700) };
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
const KIT = makeKit(ov);
const O = { grain: BR.grain({ amount: 0.07, vig: 'rgba(2,4,8,.6)' }) };

// ---------- Zeitplan ----------
export const DAUER = 20.5;
const BEATS = [[0, 2.6, 'crowd'], [2.6, 5.0, 'kipp'], [5.0, 7.6, 'idee'], [7.6, 9.3, 'teile'], [9.3, 11.0, 'teile2'], [11.0, 12.3, 'hero1'], [12.3, 13.8, 'hero1b'], [13.8, 16.2, 'hero2'], [16.2, 20.5, 'preis']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.022 * a);
function shoot(t, pos, tgt, a = 1, fov = 32) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
function light(kind) {
  T.mood(1); T.U.uHaloI.value = 0; T.floor.visible = false;
  if (kind === 'city') { T.key.color.set('#9fb4ff'); T.key.intensity = 0.7; T.key.position.set(-3, 6, 7); T.fill.intensity = 0.45; T.fill.color.set('#6f7ad8'); T.fill.groundColor.set('#0a0c22'); T.rim.color.set('#8fd6ff'); T.rim.intensity = 34; T.rim.position.set(3, 3.5, -3); scene.environmentIntensity = 0.25; scene.fog.density = 0.012; r.toneMappingExposure = 0.85; }
  else if (kind === 'blue') { T.key.color.set('#fff4e6'); T.key.intensity = 2.4; T.key.position.set(2, 5, 10); T.fill.intensity = 0.55; T.fill.color.set('#7da2ff'); T.fill.groundColor.set('#0a1a4a'); T.rim.color.set('#ffe9a8'); T.rim.intensity = 36; T.rim.position.set(3, 3.5, -2.5); scene.environmentIntensity = 0.45; scene.fog.density = 0; r.toneMappingExposure = 0.85; }
  else if (kind === 'stair') { T.key.color.set('#b4ada6'); T.key.intensity = 0.32; T.key.position.set(-4, 7, 6); T.fill.intensity = 0.16; T.fill.color.set('#6c7fb0'); T.fill.groundColor.set('#120e0a'); T.rim.color.set('#9fb8ff'); T.rim.intensity = 6; T.rim.position.set(3.4, 4.6, 2.6); scene.environmentIntensity = 0.05; scene.fog.density = 0.0; r.toneMappingExposure = 0.9; }
  else { T.key.color.set('#ffd9b0'); T.key.intensity = 0.35; T.key.position.set(-2, 4, 6); T.fill.intensity = 0.18; T.fill.color.set('#8a7a66'); T.fill.groundColor.set('#1a120c'); T.rim.intensity = 0; scene.environmentIntensity = 0.15; scene.fog.density = 0; r.toneMappingExposure = 0.85; }
}
// Figur auf der Treppe: läuft von oben rechts nach unten links
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const stairY = (x) => { const f = (x - X0) / RUN; const i = Math.floor(f); const fr = f - i; return Math.min(NST * RISE, RISE * (clamp(i, 0, NST) + sstep(0.1, 0.5, fr))); };
function moOnStairs(x, t) {
  const g = mo.K.group;
  g.position.set(x, LEG + stairY(x + 0.12) + 0.02, WALLZ + 1.3); g.rotation.set(0.06, -Math.PI / 2 + 0.35, 0);
  walkFig(mo, t * 0.85, 0.42);
}

function frame(t) {
  const sh = BEATS.find((s) => t >= s[0] && t < s[1]) || BEATS[BEATS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1); const tl = t - t0;
  KIT.hideAll(); T.U.uTime.value = t;
  const isCity = name === 'crowd' || name === 'kipp';
  const isBlue = name === 'idee' || name === 'teile' || name === 'teile2';
  const isHero = name === 'hero1' || name === 'hero1b' || name === 'hero2';
  let FP = v3(0, 1.2, 0), AP = 0.0008; dust.visible = false;
  light(isCity ? 'city' : isBlue ? 'blue' : isHero ? 'stair' : 'preis');
  city.visible = cityFloor.visible = curb.visible = curbTop.visible = mirror.visible = isCity; blue.visible = isBlue; STAIR.visible = isHero;
  NL1.group.visible = NL2.group.visible = isHero; setNL(NL1, 0); setNL(NL2, 0);
  PW.visible = name === 'preis'; PNL.forEach((n) => setNL(n, 0));
  mo.K.group.visible = isHero;
  ring.visible = false; BP.group.visible = false; outlines.forEach((l) => (l.visible = false));
  crowd.forEach((f) => (f.K.group.visible = false));
  let subs = null, tagT = null, gold = true, tagTop = 300;

  if (isCity) {
    const k = name === 'kipp' ? ease.inOut(seg(t, 3.0, 3.7)) : 0;
    const drift = t * 0.16;
    crowd.forEach((f) => {
      const isH = name === 'kipp' && f === hero;
      f.K.group.visible = true; f.K.group.position.set(f.x, LEG, f.z + drift + (f === hero ? 0.3 + 0.2 * k : 0));
      f.K.group.rotation.set(isH ? 0.55 * k : 0, Math.sin(t * 0.9 + f.ph * 3) * 0.25, Math.sin((t + f.ph) * 2 * Math.PI / 1.2) * 0.05);
      walkFig(f, t, isH ? 0.33 * (1 - k) : 0.33);
      if (isH && k === 0) { f.K.set({ look: [0, -0.6], blink: 0, eye: 1.05, mouth: 'flat', brow: -0.2, fwd: 1.2, armL: 0.35, armR: 0.15 }); swing(f, t, 0.28, true); }
      const sweep = Math.sin(t * 1.6 + f.ph * 4) * 0.35;    // Lampe schwenkt
      if (isH) {   // Stolpern: Fuss bleibt an der Kante haengen, Koerper kippt um den Fuss nach vorn, Arme rudern, Lichtkegel schwenkt hoch
        const pitch = 0.62 * k - 0.12 * ease.inOut(seg(t, 3.9, 4.6));
        const drop = 0.26 * ease.in(seg(t, 3.35, 3.75));
        const zb = f.z + drift + 0.3 + 0.55 * ease.out(seg(t, 2.6, 3.6));
        f.K.group.position.set(f.x, LEG * Math.cos(pitch) - drop, zb + LEG * Math.sin(pitch)); f.K.group.rotation.set(pitch, 0.05, Math.sin(t * 7) * 0.04 * k);
        const fl = Math.sin(t * 13) * 0.35 * k;
        f.K.set({ look: [0, -0.6 + k * 0.4], blink: 0, eye: 1.1 + 0.1 * k, mouth: 'o', open: 0.2 + k * 0.6, brow: -0.4 - k * 0.6, fwd: lerp(1.2, 2.6, k), armL: lerp(0.4, 1.4, k), armR: lerp(0.15, 1.1, k), headTilt: k * 0.1 });
        f.K.arms[0].rotation.x += fl; f.K.arms[1].rotation.x -= fl * 0.7;
        f.legs[0].rotation.x = lerp(f.legs[0].rotation.x, -0.5, k); f.legs[1].rotation.x = lerp(f.legs[1].rotation.x, 0.6, k);
      } else { f.K.set({ look: [sweep, -0.5], blink: 0.3, eye: 1.0, mouth: 'flat', brow: -0.2, fwd: 1.2 + 0.06 * Math.sin(t * 2 + f.ph), armL: 0.35, armR: 0.15 }); swing(f, t, 0.28, true); }
    });
    dust.visible = true; placeDust(t, [-4, 0.1, -3, 4, 3.5, 3]); if (hero.cone) { hero.cone.visible = name !== 'kipp'; hero.pool.visible = name !== 'kipp'; } FP = v3(0, 1.4, 0.3 + t * 0.16); AP = name === 'crowd' ? 0.0009 : 0.0016;
    if (name === 'crowd') { shoot(t, vlerp(v3(0, 1.5, 11.0), v3(0, 1.4, 9.8), sp), v3(0, 1.1, 0.2), 0.5, 40); subs = [['Nachts', 'leuchtet', 'jeder', 'mit', 'dem', 'Handy.'], t < 0.9 ? 2 : t < 1.6 ? 4 : 6, t - 0.15]; }
    else {
      ring.visible = true; hero.K.group.updateMatrixWorld(true); hero.K.head.getWorldPosition(ring.position); ring.lookAt(cam.position); ring.scale.setScalar(0.68 * (1 + 0.05 * Math.sin(t * 9)));
      shoot(t, vlerp(v3(0.7, 1.5, 7.9), v3(0.7, 1.4, 7.2), ease.out(sp)), v3(0.1, 0.9, 1.0), 0.8, 34);
      subs = [['Die', 'Stufe', 'sieht', 'keiner.'], tl < 0.9 ? 2 : 4, tl - 0.15];
      KIT.mark(0, 'no', t - 3.75, 780, 960);
    }
  } else if (isBlue) {
    FP = v3(0, 2.3, 0); AP = 0.0004;
    BP.group.visible = true; outlines.forEach((l) => (l.visible = true));
    BP.lightMat.emissive.set('#ffd7a0');
    if (name === 'idee') {
      explode(0); BP.lightMat.emissiveIntensity = 1.4 * ease.out(seg(t, 5.6, 6.2)); BP.lightMat.color.set('#ffffff');
      BP.group.position.set(0, 2.35, 0); BP.group.scale.setScalar(10); BP.group.rotation.set(0, -1.15 + tl * 0.22, 0.0);
      shoot(t, v3(0.0, 1.9, 11.2), v3(0, 1.35, 0), 0.3, 32);
      tagT = ['Eine Idee', tl - 0.1];
      subs = [['Ein', 'Licht,', 'das', 'dich', 'sieht.'], tl < 0.8 ? 2 : tl < 1.4 ? 4 : 5, tl - 0.3];
    } else {
      const e = ease.inOut(seg(t, 7.8, 8.8)); explode(e); BP.lightMat.emissiveIntensity = 1.0; BP.lightMat.color.set('#ffffff');
      const two = name === 'teile2'; const tt2 = t - 7.6;
      BP.group.position.set(-0.45, 2.5, 0); BP.group.scale.setScalar(10); BP.group.rotation.set(0, (two ? -1.35 : -1.05) + tt2 * 0.09, 0); BP.group.updateMatrixWorld(true);
      if (two) shoot(t, v3(-1.2, 2.6, 10.2), v3(-0.3, 1.5, 0), 0.3, 32); else shoot(t, v3(0.6, 1.9, 11.2), v3(0, 1.3, 0), 0.3, 32);
      const sens = scr(BP.dome, v3(0, 0, 0)); const tp = scr(tape, v3(0, N.DISC_R * 0.75, 0));
      KIT.callout(0, 'Bewegungsmelder', t - 8.9, sens, [770, sens[1] + 230]);
      KIT.callout(1, 'Klebestreifen', t - 9.5, tp, [215, tp[1] + 230]);
      tagT = ['Batterie: bis zu 12 Monate', tt2 - 0.1];
      subs = [['Einfach', 'an', 'die', 'Wand', 'kleben.'], tt2 < 1.3 ? 1 : tt2 < 1.8 ? 3 : 5, tt2 - 0.5];
    }
  } else if (isHero) {
    mo.K.group.visible = true;
    dust.visible = true; placeDust(t, [-2.5, 0.6, -1.1, 2.6, 3.8, 0.8]);
    if (name === 'hero1' || name === 'hero1b') {
      const x = lerp(X0 + 7.6 * RUN, X0 + 4.9 * RUN, seg(t, 11.0, 13.8));
      moOnStairs(x, t);
      const on1 = seg(t, 12.45, 12.75); setNL(NL1, on1);
      mo.K.set({ look: [0.5, -0.5], blink: 0, eye: 1.05, mouth: on1 > 0.5 ? 'smile' : 'flat', brow: lerp(-0.2, 0.4, on1), fwd: 0.15, armL: 0.3, armR: 0.3, headTurn: -0.25 }); swing(mo, t * 0.85, 0.32);
      if (name === 'hero1') {
        shoot(t, vlerp(v3(-0.4, 3.5, 7.8), v3(0.0, 3.4, 7.2), ease.out(sp)), v3(1.2, 3.0, WALLZ + 0.6), 0.5, 34);
        FP = mo.K.group.position.clone().add(v3(0, 0.8, 0)); AP = 0.001;
        subs = [['Du', 'gehst', 'los.'], tl < 0.4 ? 1 : 3, tl - 0.05];
      } else {   // nah am Nachtlicht: Beine laufen unscharf vorbei, Licht geht an
        const L = NL1.group.position;
        shoot(t, vlerp(v3(L.x + 0.55, L.y - 0.05, WALLZ + 0.98), v3(L.x + 0.42, L.y - 0.02, WALLZ + 0.9), ease.out(sp)), v3(L.x - 0.02, L.y - 0.18, WALLZ), 0.25, 40); r.toneMappingExposure = 0.62; setNL(NL1, on1, 0.12);
        FP = v3(L.x, L.y - 0.12, WALLZ); AP = 0.0028;
        subs = [['Es', 'geht', 'an.'], tl < 0.25 ? 1 : 3, tl - 0.1];
      }
    } else {
      const x = lerp(X0 + 4.7 * RUN, X0 + 2.0 * RUN, seg(t, 13.8, 16.2));
      moOnStairs(x, t);
      setNL(NL1, 1); const on2 = seg(t, 14.4, 14.7); setNL(NL2, on2);
      mo.K.set({ look: [0.4, -0.6], blink: 0, eye: 1.05, mouth: 'smile', open: 0.15, brow: 0.6, fwd: 0.15, armL: 0.3, armR: 0.3, headTurn: -0.15 }); swing(mo, t * 0.85, 0.32);
      const a = lerp(0.5, 0.15, ease.inOut(sp));
      shoot(t, v3(Math.sin(a) * 8.2 - 0.6, 3.0, Math.cos(a) * 8.2 - 0.2), v3(lerp(-0.2, -0.9, ease.inOut(sp)), lerp(2.0, 1.3, ease.inOut(sp)), WALLZ + 0.6), 0.4, 34);
      FP = mo.K.group.position.clone().add(v3(0, 0.6, 0)); AP = 0.0009;
      subs = [['Warmes', 'Licht.', 'Kein', 'Handy.'], tl < 0.9 ? 2 : 4, tl - 0.1];
      KIT.mark(1, 'ok', t - 15.0, 820, 1020);
    }
  } else {   // preis: zwei leuchtende Nachtlichter an der Wand, Neon-Preis
    PNL.forEach((n) => { setNL(n, 1, 0.22); n.pl.intensity = 0.25; n.wood.color.set('#9a6f5c'); }); T.key.color.set('#ffffff'); T.key.intensity = 1.3; T.key.position.set(1, 3, 8);
    if (t < 18.3) { const k = seg(t, 16.2, 18.3); const z = lerp(3.4, 3.15, ease.out(k));
      shoot(t, v3(lerp(0.2, 0.0, k), 1.1, PW.position.z + z), v3(0, 1.08, PW.position.z), 0.25, 32); }
    else { const k = seg(t, 18.3, 20.5); shoot(t, v3(lerp(1.5, 1.3, ease.out(k)), 1.25, PW.position.z + lerp(2.7, 2.5, k)), v3(0.05, 1.02, PW.position.z), 0.25, 32); }
    FP = PW.position.clone().add(v3(0, 0.05, 0)); AP = 0.0012;
    KIT.neonNum('23,99&nbsp;€', tl - 0.1, 0, 330);
    tagT = ['Flur oder Schlafzimmer?', tl - 0.5]; tagTop = 590;
  }
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  tx.pill.style.opacity = 1;
  tx.word.style.opacity = t < 3.3 ? 1 - seg(t, 3.1, 3.3) : t >= 16.4 ? seg(t, 16.4, 16.6) : 0;
  const outE = (name === 'teile' || name === 'preis') ? 0 : seg(t, t1 - 0.12, t1);
  if (subs) KIT.subtitle(subs[0], subs[1], subs[2], outE);
  if (tagT) KIT.tagPill(tagT[0], tagT[1], gold, outE, tagTop);
  const cta = t >= 19.5 ? t - 19.5 : -1;
  tx.cta.style.opacity = cta < 0 ? 0 : clamp(cta / 0.15); tx.cta.style.transform = `scale(${lerp(0.9, 1, ease.out(seg(cta, 0, 0.3)))})`;
  O.grain(Math.round(t * 30), 1);
  cam.updateMatrixWorld(); P.focus(cam.position.distanceTo(FP), AP, 0.01);
  P.render();
}
function scr(obj, local) { cam.updateMatrixWorld(); obj.updateWorldMatrix(true, false); const v = obj.localToWorld(local.clone()); v.project(cam); return [(v.x + 1) / 2 * 1080, (1 - v.y) / 2 * 1920]; }
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
