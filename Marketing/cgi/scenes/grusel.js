// Maios CGI – Wasserspender "Gruselfakt" (Trend: Creepy Fact Storytime), Farbwelt Tiefe, 14 s, 120 BPM
// Ablauf: dunkel + Gruselfakt-Hook -> Flasche kippt in Zeitlupe, Wasser geht daneben -> Spieluhr bricht ab (Standbild) ->
//         Knopf, Licht an -> Strahl, Glas voll -> Buero -> Zuhause -> zwei Farben -> Endkarte
// Hook-Fassung ueber window.HOOK: 'a' = "Jedes Glas: Gallone kippen." (27.10.), 'b' = "Flasche kippen ist vorbei." (30.10.)
import * as THREE from 'three';
import { makeRenderer, aim, v3, vlerp, clamp, lerp, seg, ease } from '../lib/core.js';
import * as BR from '../lib/brand.js';
import { makeTiefe } from '../lib/tiefe.js';
import { makeWsSzene } from '../lib/ws_szene.js';

const HOOK = (window.HOOK || 'a');
const style = document.createElement('style'); style.textContent = BR.CSS; document.head.appendChild(style);
for (const f of ['300 40px Manrope', '500 40px Manrope', '700 40px Manrope', '40px Marcellus']) await document.fonts.load(f);
await document.fonts.load('700 40px Manrope', 'ß€·');

const r = makeRenderer(); r.localClippingEnabled = true;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(26, 1080 / 1920, 0.05, 90);
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
const T = makeTiefe(r, scene, cam);
const S = makeWsSzene(scene, cam);
const { W, SW, csW, csS, G, G2, J } = S;
const rim2 = new THREE.PointLight('#cfeeff', 0, 14, 2); rim2.position.set(-3.2, 3.2, -3.0); scene.add(rim2);

// ---------- Kippen: Flasche dreht um ihre linke Bodenkante, Wasserbogen, Spritzer, Pfuetze ----------
const tipG = new THREE.Group(); scene.add(tipG);
const JR = 0.83; J.group.parent.remove(J.group); tipG.add(J.group); J.group.position.set(JR, 0, 0);
const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1.75); J.water.material.clippingPlanes = [clip];
J.group.children[0].material.opacity = 0.5; J.group.children[0].material.color.set('#e8f6fb');
const pourMat = S.waterMat(); pourMat.thickness = 0.2; pourMat.emissive = new THREE.Color('#d8f8ff'); pourMat.emissiveIntensity = 0.18; pourMat.envMapIntensity = 2.2;
let pour = null;
const GX = -1.35, GZ = 0.1;   // Glas neben der Flasche
function pourArc(p0, dir, speed, rad = 0.07) {   // Wasserbogen aus dem Hals bis Wasser im Glas oder Boden
  if (pour) { scene.remove(pour); pour.geometry.dispose(); }
  const pts = []; let hit = 'boden';
  for (let i = 0; i <= 80; i++) {
    const k = i * 0.012; const p = v3(p0.x + dir.x * speed * k, p0.y + dir.y * speed * k - 4.9 * k * k, p0.z);
    const inGlass = Math.hypot(p.x - GX, p.z - GZ) < 0.33;
    pts.push(p);
    if (inGlass && p.y < 1.24) { hit = 'glas'; break; }
    if (p.y < 0.02) break;
  }
  pour = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, rad, 12), pourMat); scene.add(pour);
  return { end: pts[pts.length - 1], hit };
}
const splash = []; for (let i = 0; i < 18; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.025 + (i % 5) * 0.008, 12, 8), S.waterMat()); scene.add(d); splash.push({ m: d, a: i * 2.39, v: 0.6 + (i * 0.37) % 0.8, o: (i * 0.618) % 1 }); }

// ---------- Overlay ----------
const CR = BR.C.creme;
const kicker = (() => { const d = document.createElement('div'); d.className = 'abs'; Object.assign(d.style, { left: '84px', top: '292px', font: '700 34px Manrope', letterSpacing: '.3em', textTransform: 'uppercase', color: '#E9CD8C' }); d.textContent = 'Gruselfakt'; document.getElementById('ov').appendChild(d);
  return (tl, out = 0) => { const p = ease.outQuint(seg(tl, 0, 0.4)); d.style.opacity = tl < 0 ? 0 : p * (1 - out); d.style.visibility = tl < 0 ? 'hidden' : 'visible'; d.style.transform = `translateY(${(1 - p) * 24}px)`; }; })();
const O = {
  pillA: BR.pill('Werbung', { x: 84, y: 208, dark: true }),
  head1: HOOK === 'b'
    ? BR.headline([[{ t: 'Flasche' }, { t: 'kippen' }], [{ t: 'ist' }, { t: 'vorbei.', gold: true }]], { y: 300, size: 112, color: CR })
    : BR.headline([[{ t: 'Jedes' }, { t: 'Glas:' }], [{ t: 'Gallone', gold: true }, { t: 'kippen.', gold: true }]], { y: 350, size: 112, color: CR }),
  corners: BR.corners({ x0: 64, y0: 200, x1: 912, y1: 1490 }),
  head2: BR.headline([[{ t: 'Ab' }, { t: 'jetzt:' }], [{ t: 'ein' }, { t: 'Knopf.', gold: true }]], { y: 250, size: 116, color: CR }),
  head5: BR.headline([[{ t: 'Fürs' }, { t: 'Büro.', gold: true }]], { y: 250, size: 116, color: CR }),
  head6: BR.headline([[{ t: 'Und' }, { t: 'zuhause.', gold: true }]], { y: 250, size: 116, color: CR }),
  head7: BR.headline([[{ t: 'In' }, { t: 'zwei' }], [{ t: 'Farben.', gold: true }]], { y: 236, size: 104, color: CR }),
  seal: BR.seal({ x: 690, y: 214, size: 226 }),
  vl: BR.vlabels(['Weiß', 'Schwarz'], ['#f4f2ee', '#1d2431'], [CR, BR.C.tinte]),
  ripple: BR.ripple(),
  end: BR.endcard({ name: 'Wasserspender <b>Schreibtisch</b>', price: '38,99&nbsp;€', colors: 'Weiß · Schwarz' }),
  pillE: BR.pill('Werbung', { y: 172, dark: true, center: true }),
  streak: BR.streak(), flash: BR.flash(), grain: BR.grain({ amount: 0.06, vig: 'rgba(0,12,16,.42)' }),
};
const stageCanvas = r.domElement;

const SHOTS = [
  [0, 1.25, 'grusel'], [1.25, 2.5, 'kippen'], [2.5, 3.0, 'stille'], [3.0, 4.5, 'knopf'], [4.5, 6.5, 'strahl'], [6.5, 8.5, 'voll'],
  [8.5, 9.75, 'buero'], [9.75, 11.0, 'zuhause'], [11.0, 12.0, 'farben'], [12.0, 14.0, 'ende'],
];
export const DAUER = 14.0;
const PRESS = 3.04, LIGHT = 3.07, WATER0 = 3.3, WATER1 = 8.3;

function dunkel(t) {   // Nacht, nur Randlicht (leichtes Flackern)
  T.mood(0); T.U.uStars.value = 0.35;
  const fl = 0.9 + 0.1 * Math.sin(t * 23) * Math.sin(t * 7.3);
  T.rim.position.set(3.0, 3.4, -3.0); T.rim.intensity = 26 * fl; rim2.intensity = 14 * fl;
  T.fill.intensity = 0.2; scene.environmentIntensity = 0.3;
  T.key.intensity = 0.55; T.key.color.set('#dcecff');   // schwaches Mondlicht, damit Weiss weiss bleibt
}
function kippen(tt) {  // Zustand der Kipp-Einstellung zur Zeit tt (Zeitlupe)
  J.group.visible = true; J.cap.visible = false;
  tipG.position.set(1.15 - JR, 0, 0.1); const th = lerp(0.68, 1.06, ease.inOut(seg(tt, 1.25, 2.5)));
  tipG.rotation.set(0, 0, th); tipG.updateMatrixWorld(true);
  const neck = J.group.localToWorld(v3(0, 2.62, 0)); const axis = v3(-Math.sin(th), Math.cos(th), 0);
  clip.constant = lerp(1.75, neck.y - 0.05, clamp((th - 0.6) / 0.4));
  G2.group.visible = true; G2.group.position.set(GX, 0, GZ); S.setWater(G2, lerp(0.75, 1.12, seg(tt, 1.5, 2.3)), tt * 0.3, 1);
  const { end, hit } = pourArc(neck, axis, 0.5, 0.075 + 0.01 * Math.sin(tt * 9));
  // Spritzer dort, wo der Strahl auftrifft (langsam, Zeitlupe)
  splash.forEach((s) => { const lt = ((tt * 0.55 * s.v + s.o) % 1); s.m.visible = true; const rr = 0.08 + lt * 0.7 * s.v;
    s.m.position.set(end.x + Math.cos(s.a) * rr * 0.8, Math.max(0.02, end.y + Math.sin(lt * Math.PI) * 0.55 * s.v - lt * 0.5), end.z + Math.sin(s.a) * rr * 0.6); });
  const land = end;
  return { neck, land };
}

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  S.hideAll(); J.group.visible = false; tipG.rotation.set(0, 0, 0); if (pour) pour.visible = false; splash.forEach((s) => (s.m.visible = false));
  stageCanvas.style.filter = ''; T.floor.visible = true; T.U.uTime.value = t; S.cauU.uTime.value = t; rim2.intensity = 0;
  T.mood(1); T.rim.position.set(2.8, 3.6, -3.2);

  if (name === 'grusel') {
    dunkel(t);
    S.placeDisp(W, csW, 0, 0, -0.5); S.glassOn(W, G); S.setWater(G, 1.0);
    lens(26); aim(cam, vlerp(v3(1.6, 1.1, 12.6), v3(1.3, 1.2, 11.4), ease.out(sp)), v3(-0.25, 1.55, -0.3));
    T.haloAt(S.glassMid(G), 0.16, 0.5);
  } else if (name === 'kippen' || name === 'stille') {
    dunkel(t);
    const tt = name === 'stille' ? 2.5 : t;
    const { neck } = kippen(tt);
    const push = name === 'stille' ? ease.out(seg(t, 2.5, 3.0)) * 0.35 : 0;
    lens(26); aim(cam, vlerp(v3(-0.45, 2.3, 12.9), v3(-0.55, 2.25, 12.1), ease.out(seg(tt, 1.25, 2.5))).add(v3(0, 0, -push)), v3(-0.72, 1.6, 0.1));
    T.haloAt(v3(GX, 1.0, GZ), 0.15, 0.45); T.haloAt(neck, 0.12, 0.2, '#c9f3ff', 2);
    if (name === 'stille') stageCanvas.style.filter = `saturate(${lerp(1, 0.45, seg(t, 2.5, 2.6))}) brightness(${lerp(1, 0.78, seg(t, 2.5, 2.6))})`;
  } else if (name === 'knopf') {
    const room = ease.out(seg(t, LIGHT, LIGHT + 0.16)); if (room < 1) dunkel(t);
    T.mood(room); if (room < 1) { T.rim.intensity = lerp(26, 30, room); rim2.intensity = 14 * (1 - room); }
    S.placeDisp(W, csW, 0, 0, -0.6); S.glassOn(W, G); S.water(t, WATER0, WATER1);
    const press = seg(t, PRESS, PRESS + 0.04) * (1 - seg(t, PRESS + 0.18, PRESS + 0.28));
    W.buttons[0].position.y = 0.4 - 0.012 * press;
    if (t > LIGHT) S.ledOn(W, 3.2, true, t);
    lens(26); aim(cam, vlerp(v3(-1.45, 2.05, 3.45), v3(-1.3, 1.9, 3.15), ease.out(sp)), v3(-0.6, 0.62, 0.57));
    T.haloAt(W.group.localToWorld(v3(-0.25, 0.42, 0.87)), 0.12, t > LIGHT ? 0.5 : 0.0);
  } else if (name === 'strahl') {
    S.placeDisp(W, csW, 0, 0, -0.35); S.glassOn(W, G); S.water(t, WATER0, WATER1); S.ledOn(W, 3.5);
    lens(26); aim(cam, vlerp(v3(1.5, 2.6, 3.4), v3(1.3, 2.45, 3.0), ease.out(sp)), v3(0, 1.95, -0.45));
    T.haloAt(v3(G.group.position.x, 1.6, G.group.position.z), 0.2, 0.9); T.U.uCaust.value = 0.1;
  } else if (name === 'voll') {
    S.placeDisp(W, csW, 0, 0, -0.35); S.glassOn(W, G); S.water(t, WATER0, WATER1); if (t < WATER1) S.ledOn(W, 3.5);
    lens(26); aim(cam, vlerp(v3(-1.8, 1.4, 6.6), v3(-1.6, 1.3, 5.8), ease.out(sp)), v3(0, 1.05, -0.45));
    T.haloAt(S.glassMid(G, 0.6), 0.24, 1.0); T.U.uCaust.value = 0.12; S.causticsAt(0, -0.4, 0.55);
  } else if (name === 'buero') {
    S.props.visible = S.desk.visible = S.lap.visible = S.plant.visible = true; T.floor.visible = false;
    S.placeDisp(W, csW, 0.2, 0, -0.3); S.glassOn(W, G); S.setWater(G, 1.02);
    lens(26); aim(cam, vlerp(v3(0.9, 3.6, 12.6), v3(0.4, 3.5, 11.8), sp), v3(-0.3, 1.25, -0.7));
    T.haloAt(S.glassMid(G, 0.6), 0.14, 0.75);
  } else if (name === 'zuhause') {
    T.mood(1); scene.environmentIntensity = 0.85; T.key.intensity = 2.0; T.fill.intensity = 0.45;   // Abend: Grund dunkler, Produktlicht neutral
    T.U.uC0.value.set('#174d5a'); T.U.uC1.value.set('#03141a'); T.U.uCenter.value.set(0.42, 0.56);
    S.props.visible = S.desk.visible = S.nstand.visible = true; T.floor.visible = false;
    S.lamp.intensity = 7; S.lamp.position.copy(S.nstand.userData.lampPos);
    S.placeDisp(W, csW, -0.3, 0, -0.2); S.glassOn(W, G); S.setWater(G, 0.7);
    lens(26); aim(cam, vlerp(v3(-1.6, 2.6, 9.6), v3(-1.1, 2.55, 8.9), sp), v3(0.3, 1.45, -0.6));
    T.haloAt(S.glassMid(G, 0.5), 0.17, 0.85);
    T.haloAt(S.nstand.userData.lampPos.clone().add(v3(0, 0.15, 0)), 0.26, 0.3, '#ffcf8f', 2);
  } else if (name === 'farben') {
    [[W, csW, G, -1.12], [SW, csS, G2, 1.12]].forEach(([D, cs, gl, x], i) => {
      const p = ease.outBack(seg(t, t0 + 0.05 + i * 0.1, t0 + 0.6 + i * 0.1));
      S.placeDisp(D, cs, x, 0, -0.45); D.group.position.y = (1 - p) * -3.8; D.group.updateMatrixWorld(true); cs.material.opacity = p; S.glassOn(D, gl); S.setWater(gl, 0.95);
    });
    lens(26); aim(cam, vlerp(v3(0, 2.8, 19.5), v3(0, 2.7, 18.6), ease.out(sp)), v3(0, 1.45, -0.4));
    T.U.uSplit.value = 0.5; T.floor.material.opacity = 0.3;
  } else if (name === 'ende') {
    S.placeDisp(W, csW, 0, 0, lerp(-0.9, 0.3, sp)); S.glassOn(W, G); S.setWater(G, 1.02);
    lens(26); aim(cam, vlerp(v3(0, 1.4, 22.5), v3(0, 1.3, 21.4), ease.out(sp)), v3(0, 0.5, -0.4));
    T.haloAt(v3(0, 1.0, -0.5), 0.2, 0.8); T.U.uCaust.value = 0.05; S.causticsAt(0, -0.3, 0.4);
    T.rim.position.set(2.6, 3.4, -2.8);
  }
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  const hookOut = seg(t, 2.36, 2.5);
  O.pillA(t < 2.5 ? 1 - hookOut : 0);
  if (HOOK !== 'b') kicker(t < 2.5 ? t - 0.02 : -1, hookOut); else kicker(-1);
  O.head1(t < 2.5 ? t - 0.08 : -1, hookOut);
  O.corners(t < 1.25 ? t : -1, seg(t, 1.12, 1.25));
  O.head2(t >= 3.08 && t < 4.5 ? t - 3.08 : -1, seg(t, 4.36, 4.5));
  O.head5(t >= 8.52 && t < 9.75 ? t - 8.52 : -1, seg(t, 9.62, 9.75));
  O.head6(t >= 9.77 && t < 11.0 ? t - 9.77 : -1, seg(t, 10.88, 11.0));
  O.head7(t >= 11.03 && t < 12 ? t - 11.03 : -1, seg(t, 11.88, 12.0));
  O.seal(t >= 11.15 && t < 12 ? t - 11.15 : -1, seg(t, 11.88, 12.0));
  if (name === 'farben') O.vl([W, SW].map((D) => { const p = S.screen(D.group, v3(0, 0, 1.05)); return [p[0], p[1] + 30]; }), t - 11.0); else O.vl([], -1);
  if (name === 'knopf') { const p = S.screen(W.buttons[0], v3(0, 0.02, 0)); O.ripple(p[0], p[1], t - LIGHT); } else O.ripple(0, 0, -1);
  O.end(t >= 12 ? t - 12 : -1, 0);
  O.pillE(t >= 12 ? ease.out(seg(t, 12.05, 12.35)) : 0);
  O.streak(t > 11.8 && t < 12.2 ? seg(t, 11.84, 12.16) : 0);
  O.flash(t >= LIGHT && t < LIGHT + 0.2 ? 0.55 * (1 - seg(t, LIGHT, LIGHT + 0.2)) : 0);
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
