// Maios CGI – Krystall Ball Nachtlampe (Produkt 50), "Draussen Regen. Bei mir schneit's.", Loop-Clip 8 s (Render 8,4 s), Handy-Look
// November-Abend am Fensterbrett: draussen Regen am Fenster (Streifen + Tropfen, Strassenlichter unscharf), drinnen leuchtet die Kugel mit
// dem Motiv Schneemann. Tee dampft daneben. Effekte nur am Raum (Regen, Dampf). Die Lampe leuchtet von Anfang an.
// Ablauf: Fensterbrett-Totale mit Regen (Hook) -> nah in die Kugel, Schneemann -> Sockel seitlich ("Ist meine Nachtlampe.")
//         -> von oben, Preis + Link -> zurueck zur ersten Einstellung (Loop).
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease, rng, canvasTex, contactShadow } from '../lib/core.js';
import * as KM from '../lib/kugel_models.js';
import * as BR from '../lib/brand.js';
import { makeTiefe } from '../lib/tiefe.js';

const style = document.createElement('style');
style.textContent = BR.CSS + `
.tt{position:absolute;left:70px;width:800px;text-align:center;font:800 68px Manrope;line-height:1.16;color:#fff;letter-spacing:-.005em;
  text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.75),0 0 22px rgba(0,0,0,.45)}
.tt.big{font-size:150px;letter-spacing:-.02em}
.tt.k{font-size:52px;font-weight:700;opacity:.95}
.tpill{position:absolute;left:84px;top:208px;font:700 28px Manrope;letter-spacing:.14em;text-transform:uppercase;color:#fff;padding:9px 20px 8px;border-radius:12px;background:rgba(0,0,0,.42)}
.tword{position:absolute;top:208px;padding:7px 14px 6px;border-radius:12px;background:rgba(0,0,0,.42);font:700 32px Manrope;color:#fff;letter-spacing:.01em;text-shadow:0 0 3px #000,0 2px 6px rgba(0,0,0,.7)}
.tcta{position:absolute;left:270px;width:400px;text-align:center;font:800 44px Manrope;color:#111;background:#fff;border-radius:18px;padding:20px 0;box-shadow:0 6px 24px rgba(0,0,0,.35)}`;
document.head.appendChild(style);
for (const f of ['700 40px Manrope', '800 40px Manrope']) await document.fonts.load(f);
await document.fonts.load('800 40px Manrope', 'ßü€·?:');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
T.floor.visible = false;
const R = rng(33);


// ---------- Fenster mit Regen (Shader-Ebene hinter der Fensterbank) ----------
const bokTex = canvasTex(512, 1024, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g2 = c2.getContext('2d');
  for (let i = 0; i < 26; i++) {   // Strassenlichter, unscharf, untere Bildhaelfte
    const x = R() * w, y = h * (0.52 + R() * 0.38), rr = 10 + R() * 26, warm = R() > 0.3;
    const gr = g2.createRadialGradient(x, y, 0, x, y, rr);
    const c = warm ? '255,170,80' : '150,190,255'; const a = 0.25 + R() * 0.45;
    gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(0.7, `rgba(${c},${a * 0.7})`); gr.addColorStop(1, `rgba(${c},0)`);
    g2.fillStyle = gr; g2.beginPath(); g2.arc(x, y, rr, 0, Math.PI * 2); g2.fill();
  }
  g.filter = 'blur(6px)'; g.drawImage(c2, 0, 0); g.filter = 'none';
});
const dropTex = canvasTex(1024, 1024, (g, w, h) => {   // Tropfen auf der Scheibe (stehend)
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = R() * w, y = R() * h, rr = 1.5 + Math.pow(R(), 3) * 7;
    const gr = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0, x, y, rr);
    gr.addColorStop(0, 'rgba(220,235,255,0.9)'); gr.addColorStop(0.5, 'rgba(160,190,230,0.35)'); gr.addColorStop(1, 'rgba(120,150,200,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr * 0.85, rr, 0, 0, Math.PI * 2); g.fill();
  }
}, false);
dropTex.wrapS = dropTex.wrapT = THREE.RepeatWrapping;
const winU = { uT: { value: 0 }, uBok: { value: bokTex }, uDrops: { value: dropTex } };
const winMat = new THREE.ShaderMaterial({
  uniforms: winU, toneMapped: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec2 vUv; uniform float uT; uniform sampler2D uBok, uDrops;
float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  vec3 col = mix(vec3(0.010, 0.016, 0.032), vec3(0.045, 0.065, 0.11), smoothstep(0.1, 1.0, uv.y));
  col += texture2D(uBok, uv).rgb * 0.9;
  // Regenstreifen draussen: Spalten, Phase periodisch in 8,4 s (ganzzahlige Umlaeufe)
  float cols = 170.0; float cx = floor(uv.x * cols); float r = h1(cx + 0.37), r2 = h1(cx * 1.7 + 4.1);
  float sp = (5.0 + floor(r * 4.0)) / 8.4;
  float ph = fract(uv.y * 1.3 + uT * sp + r2);
  float lx = abs(fract(uv.x * cols) - 0.5);
  float streak = smoothstep(0.0, 0.03, ph) * (1.0 - smoothstep(0.03, 0.22, ph)) * (1.0 - smoothstep(0.05, 0.22, lx)) * step(0.45, r2);
  col += vec3(0.55, 0.65, 0.8) * streak * 0.32;
  // Tropfen auf der Scheibe + zwei Laeufer, die langsam herunterrinnen (Periode 8,4 s)
  vec4 d = texture2D(uDrops, uv * vec2(1.6, 1.6));
  col += d.rgb * d.a * 0.09;
  for (int k = 0; k < 7; k++) {
    float fk = float(k); float x0 = 0.12 + fk * 0.13 + 0.03 * sin(fk * 5.0);
    float yk = 1.0 - fract(uT / 8.4 * (1.0 + mod(fk, 2.0)) + h1(fk + 9.0));
    vec2 q = (uv - vec2(x0 + 0.004 * sin(uv.y * 40.0 + fk), yk)) * vec2(260.0, 160.0);
    float drop = exp(-dot(q, q) * 0.5);
    float trail = (1.0 - smoothstep(0.0, 0.0035, abs(uv.x - x0 - 0.004 * sin(uv.y * 40.0 + fk)))) * step(yk, uv.y) * exp(-(uv.y - yk) * 9.0);
    col += vec3(0.75, 0.85, 1.0) * (drop * 0.55 + trail * 0.12);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
});
const win = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), winMat); win.position.set(0, 4.5, -2.6); win.renderOrder = -500; scene.add(win);
// Fensterrahmen (weiss lackiertes Holz) und Fensterbank
const frameMat = new THREE.MeshStandardMaterial({ color: '#3c3a37', roughness: 0.7 });
const fbar = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), frameMat); m.position.set(x, y, -2.45); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
fbar(0.42, 12, -3.3, 5); fbar(0.42, 12, 3.6, 5); fbar(0.3, 12, -2.75, 5); fbar(14, 0.5, 0, 0.25); fbar(14, 0.3, 0, 6.6);
const sillTex = canvasTex(1024, 256, (g, w, h) => {
  g.fillStyle = '#d9d3c9'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${R() > 0.5 ? '255,255,255' : '90,80,70'},${0.03 + R() * 0.05})`; g.fillRect(R() * w, R() * h, 2, 2); }
});
const sill = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 4.2), new THREE.MeshPhysicalMaterial({ map: sillTex, roughness: 0.35, clearcoat: 0.4 }));
sill.position.set(0, -0.15, -0.5); sill.receiveShadow = true; scene.add(sill);
const sillFront = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 0.2), new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.9 }));
sillFront.position.set(0, -1.8, 1.7); scene.add(sillFront);

// ---------- Teetasse mit Dampf (Raum, bewegt sich ab Bild 0) ----------
const mug = new THREE.Group(); scene.add(mug);
const mugMat = new THREE.MeshPhysicalMaterial({ color: '#3f5a4a', roughness: 0.3, clearcoat: 0.6 });
const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.9, 48, 1, true), mugMat); mugBody.position.y = 0.45; mugBody.castShadow = true; mug.add(mugBody);
const mugIn = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.36, 0.88, 48, 1, true), new THREE.MeshStandardMaterial({ color: '#e8e2d6', side: THREE.BackSide, roughness: 0.4 })); mugIn.position.y = 0.46; mug.add(mugIn);
const tea = new THREE.Mesh(new THREE.CircleGeometry(0.39, 48), new THREE.MeshPhysicalMaterial({ color: '#6b3410', roughness: 0.1, clearcoat: 1 })); tea.rotation.x = -Math.PI / 2; tea.position.y = 0.78; mug.add(tea);
const mugBot = new THREE.Mesh(new THREE.CircleGeometry(0.38, 48), mugMat); mugBot.rotation.x = Math.PI / 2; mugBot.position.y = 0.002; mug.add(mugBot);
const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 16, 40, Math.PI * 1.2), mugMat); handle.position.set(0.45, 0.46, 0); handle.rotation.z = -Math.PI * 0.6; mug.add(handle);
mug.position.set(1.75, 0, 0.75); mug.rotation.y = 0.4;
const steamTex = canvasTex(128, 256, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - w / 2) / (w / 2), v = Math.sin(Math.PI * y / h); const k = Math.max(0, 1 - Math.abs(dx)) * v;
    const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = 255 * k * k * 0.8;
  }
  g.putImageData(img, 0, 0);
});
const steam = [];
for (let i = 0; i < 5; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.1), new THREE.MeshBasicMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0, color: '#e9eef5' }));
  m.userData = { o: i / 5, sw: 0.6 + R() * 0.5, ph: R() * 6.28 }; scene.add(m); steam.push(m);
}
const BOK = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });

// ---------- Lampe (Motiv Schneemann) ----------
const L = KM.makeLamp('schneemann', KM.woodTex()); scene.add(L.group);
L.group.rotation.y = 0.2;
L.base.group.scale.set(0.84, 1.08, 0.84);   // Sockel schmaler als die Kugel wie auf dem Shopfoto
const cs = contactShadow(2.6, 0.6); cs.position.y = 0.003; scene.add(cs);
const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshBasicMaterial({ map: KM.glowTex([[0, 'rgba(255,214,150,0.5)'], [0.4, 'rgba(255,180,110,0.16)'], [1, 'rgba(255,170,90,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.006; scene.add(pool);
const BALL = v3(0, KM.BALL_Y, 0);
// warme Spiegelung der Kugel in der Scheibe (Raum)
const refl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: BOK, color: '#ffb46a', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
refl.position.set(0.35, 1.4, -2.29); scene.add(refl);

// ---------- Licht ----------
const mugL = new THREE.PointLight('#ffd2a0', 0, 3, 1.5); mugL.position.set(1.0, 1.2, 1.6); scene.add(mugL);
const moon = new THREE.PointLight('#9ec2ff', 0, 14, 1.4); moon.position.set(-1.5, 4.5, -2.2); scene.add(moon);
function nacht(t) {
  T.mood(0);
  T.U.uC0.value.set('#0b1422'); T.U.uC1.value.set('#03060c');
  T.key.color.set('#fff1de'); T.key.intensity = 0.75; T.key.position.set(-3.5, 7.5, 5.5);
  T.fill.intensity = 0.12; T.fill.color.set('#b9c9e6'); T.fill.groundColor.set('#06080c');
  T.rim.color.set('#a9c8ff'); T.rim.intensity = 18; T.rim.position.set(-2.4, 3.4, -2.0);
  moon.intensity = 6; mugL.intensity = 1.6;
  scene.environmentIntensity = 0.35;
}
// ---------- Overlay ----------
const ov = document.getElementById('ov');
const mk = (cls, html, top) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; if (top != null) d.style.top = top + 'px'; d.style.opacity = 0; ov.appendChild(d); return d; };
const tx = {
  pill: mk('tpill', 'Werbung', 208),
  word: mk('tword', 'Nachtlampe'),
  a: mk('tt', 'Draußen Regen.<br>Bei mir schneit&rsquo;s.', 360),
  b: mk('tt', 'Schneemann, Tanne<br>und Mond.', 330),
  c: mk('tt', 'Ist meine<br>Nachtlampe.', 330),
  p: mk('tt big', '17,99&nbsp;€', 300),
  cta: mk('tcta', 'Link im Profil', 500),
};
tx.word.style.left = (84 + tx.pill.offsetWidth + 10) + 'px';
function pop(d, tl, out = 0) {
  if (tl < 0) { d.style.opacity = 0; return; }
  const p = ease.outBack(seg(tl, 0, 0.22)); d.style.opacity = clamp(tl / 0.08) * (1 - out);
  d.style.transform = `scale(${lerp(0.82, 1, p)})`;
}
const O = { grain: BR.grain({ amount: 0.07, vig: 'rgba(2,4,10,.6)' }) };

// ---------- Zeitplan ----------
export const DAUER = 8.4;
const SHOTS = [[0, 2.6, 'fenster'], [2.6, 4.2, 'nah'], [4.2, 5.6, 'sockel'], [5.6, 7.0, 'preis'], [7.0, 8.4, 'fenster2']];
const shake = (t, a = 1) => v3(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.3 + 1) * 0.25, Math.sin(t * 2.1 + 2) * 0.5 + Math.sin(t * 5.2) * 0.2, Math.sin(t * 1.3 + 4) * 0.3).multiplyScalar(0.025 * a);
function shoot(t, pos, tgt, a = 1, fov = 30) { lens(fov); const s = shake(t, a); aim(cam, pos.clone().add(s), tgt.clone().add(s.multiplyScalar(0.6))); }
const W0 = v3(-1.0, 2.7, 9.4), W1 = v3(-0.7, 2.45, 7.6), WT0 = v3(0.55, 1.95, -0.4), WT1 = v3(0.5, 1.85, -0.4);
const fensterCam = (u) => [vlerp(W0, W1, u / 2.6), vlerp(WT0, WT1, u / 2.6)];

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  T.U.uTime.value = t; winU.uT.value = t; nacht(t);
  if (name === 'fenster' || name === 'fenster2') {
    const u = name === 'fenster' ? t : t - DAUER; const [p, q] = fensterCam(u);
    shoot(t, p, q, 1.0, 36);
  } else if (name === 'nah') {
    const a = lerp(-0.35, -0.1, ease.inOut(sp)), d = lerp(5.4, 4.9, ease.out(sp));
    shoot(t, v3(Math.sin(a) * d, BALL.y + 0.35, Math.cos(a) * d), BALL.clone().add(v3(0, 0.45, 0)), 0.35, 36);
  } else if (name === 'sockel') {
    const a = lerp(-0.42, -0.55, ease.out(sp)), d = 6.4;
    shoot(t, v3(Math.sin(a) * d, 0.45, Math.cos(a) * d), v3(0, 1.4, 0), 0.4, 36);
  } else if (name === 'preis') {
    const a = lerp(0.3, 0.2, ease.out(sp));
    shoot(t, v3(Math.sin(a) * 7.6, 3.4, Math.cos(a) * 7.6), v3(0.1, 1.9, 0), 0.5, 34);
  }
  L.set(1, 0.3, { cam, glowScale: 0.5 }); L.eMat.uniforms.uCol.value.set('#fff0d6');
  L.eMat.uniforms.uI.value *= 1 + 0.08 * Math.sin(t * 2 * Math.PI / 2.8);   // Gravur funkelt leicht (Licht, Periode passt in 8,4 s)
  L.bottom.material.opacity *= 0.55;
  steam.forEach((m) => {
    const d = m.userData; const ph = ((t / 2.8 + d.o) % 1 + 1) % 1;   // 3 Umlaeufe in 8,4 s
    m.position.set(mug.position.x + Math.sin(ph * 5 + d.ph) * 0.12 * d.sw, 1.0 + ph * 1.5, mug.position.z);
    m.scale.set(0.7 + ph * 1.4, 0.8 + ph * 0.8, 1);
    m.lookAt(cam.position.x, m.position.y, cam.position.z); m.rotation.z = Math.sin(ph * 4 + d.ph) * 0.3;
    m.material.opacity = 0.5 * Math.sin(Math.PI * ph);
  });
  scene.updateMatrixWorld(true);

  tx.pill.style.opacity = 1;
  const wordOn = t < 4.2 || t >= 7.45;
  tx.word.style.opacity = wordOn ? (t < 4.2 ? 1 - seg(t, 4.05, 4.2) : seg(t, 7.45, 7.6)) : 0;
  pop(tx.a, t < 2.6 ? t + 0.3 : t >= 7.5 ? t - 7.5 : -1, t < 2.6 ? seg(t, 2.5, 2.6) : 0);
  pop(tx.b, t >= 2.7 && t < 4.2 ? t - 2.7 : -1, seg(t, 4.1, 4.2));
  pop(tx.c, t >= 4.3 && t < 5.6 ? t - 4.3 : -1, seg(t, 5.5, 5.6));
  pop(tx.p, t >= 5.7 && t < 7.0 ? t - 5.7 : -1, seg(t, 6.9, 7.0));
  pop(tx.cta, t >= 6.15 && t < 7.0 ? t - 6.15 : -1, seg(t, 6.9, 7.0));
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
