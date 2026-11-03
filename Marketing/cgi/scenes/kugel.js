// Maios CGI – Krystall Ball Nachtlampe (Produkt 50), Farbwelt "Tiefe", 14 s, 120 BPM
// Ablauf: leuchtender Mond (Ergebnis zuerst) -> Makro -> 01 Kugel drauf -> 02 Einstecken -> 03 Licht aus -> Mond an ->
//         rundum -> Deko fuers Zimmer -> Geschenk -> 4 von 7 Motiven -> Endkarte
import * as THREE from 'three';
import { makeRenderer, contactShadow, aim, v3, vlerp, clamp, lerp, seg, ease, canvasTex } from '../lib/core.js';
import * as KM from '../lib/kugel_models.js';
import * as BR from '../lib/brand.js';
import { makeTiefe } from '../lib/tiefe.js';

const style = document.createElement('style'); style.textContent = BR.CSS; document.head.appendChild(style);
for (const f of ['300 40px Manrope', '500 40px Manrope', '700 40px Manrope', '40px Marcellus']) await document.fonts.load(f);
await document.fonts.load('700 40px Manrope', 'ß€·');

const r = makeRenderer();
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(26, 1080 / 1920, 0.05, 120);
const T = makeTiefe(r, scene, cam);

// ---------- Objekte ----------
const wood = KM.woodTex();
const L = KM.makeLamp('mond', wood); scene.add(L.group);
const VAR = ['saturn', 'riesenrad', 'schneemann'].map((m) => { const x = KM.makeLamp(m, wood); scene.add(x.group); return x; });
const ALL = [L, ...VAR];
const csL = contactShadow(3.1, 0.5); scene.add(csL);
const glowT = KM.glowTex();
const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: glowT, color: new THREE.Color('#ffb15c'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
pool.rotation.x = -Math.PI / 2; pool.renderOrder = 2; scene.add(pool);
const pools = VAR.map(() => { const p = pool.clone(); p.material = pool.material.clone(); scene.add(p); return p; });
const dust = KM.makeDust(160, 9); scene.add(dust);
const plug = KM.makePlug(); scene.add(plug);
const gift = KM.makeGift(); scene.add(gift.group);
// Nachttisch (Walnuss) mit Buechern und Pflanze
const walnut = KM.woodTex(7, '#6b4a33', [40, 26, 16]); walnut.wrapS = walnut.wrapT = THREE.RepeatWrapping; walnut.repeat.set(2, 1); walnut.rotation = Math.PI / 2;
const stand = new THREE.Mesh(new THREE.BoxGeometry(9, 0.36, 4.2), new THREE.MeshPhysicalMaterial({ map: walnut, roughness: 0.5, clearcoat: 0.25 }));
stand.position.set(0, -0.18, -0.4); stand.receiveShadow = true; scene.add(stand);
const books = KM.makeBooks(); books.position.set(1.75, 0, -0.75); books.rotation.y = -0.25; books.scale.setScalar(0.85); scene.add(books);
const plant = KM.makePlant(); plant.position.set(-1.75, 0, -1.05); plant.scale.setScalar(1.15); scene.add(plant);

// ---------- Overlay (helle Schrift auf Petrol/Nacht) ----------
const CR = BR.C.creme;
const O = {
  pillA: BR.pill('Werbung', { x: 84, y: 208, dark: true }),
  head1: BR.headline([[{ t: 'Dein' }, { t: 'eigener' }], [{ t: 'Mond.', gold: true }]], { y: 262, size: 116, color: CR }),
  corners: BR.corners({ x0: 64, y0: 200, x1: 912, y1: 1490 }),
  head2: BR.headline([[{ t: 'Mitten' }, { t: 'im' }], [{ t: 'Kristall.', gold: true }]], { y: 250, size: 112, color: CR }),
  step: BR.step({ y: 228, dark: true }),
  head3: BR.headline([[{ t: 'Mond' }, { t: 'an.', gold: true }]], { y: 250, size: 126, color: CR }),
  head4: BR.headline([[{ t: 'Leuchtet' }], [{ t: 'rundum.', gold: true }]], { y: 250, size: 112, color: CR }),
  head5: BR.headline([[{ t: 'Deko' }, { t: 'fürs' }], [{ t: 'Zimmer.', gold: true }]], { y: 250, size: 112, color: CR }),
  head6: BR.headline([[{ t: 'Ideal' }, { t: 'als' }], [{ t: 'Geschenk.', gold: true }]], { y: 250, size: 112, color: CR }),
  head7: BR.headline([[{ t: 'In' }, { t: '7' }], [{ t: 'Motiven.', gold: true }]], { y: 236, size: 108, color: CR }),
  seal: BR.seal({ x: 690, y: 214, size: 226, dark: true }),
  end: BR.endcard({ name: 'Krystall Ball <b>Nachtlampe</b>', price: '17,99&nbsp;€', colors: '7 Motive' }),
  pillE: BR.pill('Werbung', { y: 172, dark: true, center: true }),
  ripple: BR.ripple(),
  streak: BR.streak(), flash: BR.flash(), grain: BR.grain({ amount: 0.06, vig: 'rgba(0,10,14,.46)' }),
};

// ---------- Helfer ----------
const BALL = (lamp) => lamp.group.localToWorld(v3(0, KM.BALL_Y, 0));
const lens = (fov) => { cam.fov = fov; cam.updateProjectionMatrix(); };
function placeLamp(lamp, x = 0, y = 0, z = 0, ry = 0, s = 1) { lamp.group.visible = true; lamp.group.position.set(x, y, z); lamp.group.rotation.set(0, ry, 0); lamp.group.scale.setScalar(s); lamp.group.updateMatrixWorld(true); }
function poolAt(p, lamp, I) { p.visible = I > 0.002; p.position.set(lamp.group.position.x, lamp.group.position.y + 0.004, lamp.group.position.z); p.scale.setScalar(0.75 * lamp.group.scale.x); p.material.opacity = I; }
function shadowAt(lamp, op = 1) { csL.visible = true; csL.position.set(lamp.group.position.x, lamp.group.position.y + 0.003, lamp.group.position.z); csL.material.opacity = op; }
function dustOn(I, t) { dust.visible = true; dust.material.uniforms.uI.value = I; dust.material.uniforms.uScale.value = L.eMat.uniforms.uScale.value; dust.position.set(Math.sin(t * 0.4) * 0.12, (t * 0.06) % 0.5 - 0.25, 0); dust.rotation.y = t * 0.05; }

const SHOTS = [
  [0, 1.5, 'held'], [1.5, 2.75, 'makro'], [2.75, 4.0, 'drauf'], [4.0, 5.0, 'stecker'], [5.0, 6.0, 'dunkel'], [6.0, 7.25, 'an'],
  [7.25, 8.5, 'rundum'], [8.5, 9.5, 'zimmer'], [9.5, 11.0, 'geschenk'], [11.0, 12.0, 'motive'], [12.0, 14.0, 'ende'],
];
export const DAUER = 14.0;
const ON_AT = 4.66;   // Lampe geht beim Einstecken an

function frame(t) {
  const sh = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, name] = sh; const sp = seg(t, t0, t1);
  for (const o of [...ALL.map((x) => x.group), csL, pool, ...pools, dust, plug, gift.group, stand, books, plant]) o.visible = false;
  T.U.uTime.value = t; T.floor.visible = true;
  let room = 0, on = 1;
  T.mood(0); T.U.uStars.value = 0.55;
  L.ball.position.y = KM.BALL_Y; L.ball.rotation.set(0, 0, 0);

  if (name === 'held') {
    placeLamp(L, 0, 0, 0, 0.3); shadowAt(L, 0.6);
    lens(26); aim(cam, vlerp(v3(0.9, 2.2, 11.6), v3(0.6, 2.05, 10.2), ease.out(sp)), v3(0, 1.28, 0));
    T.haloAt(v3(0, 1.3, 0), 0.19, 0.26, '#ffb866'); poolAt(pool, L, 0.32); dustOn(0.5, t);
  } else if (name === 'makro') {
    placeLamp(L, 0, 0, 0, 0.3 + sp * 0.25);
    lens(30); aim(cam, vlerp(v3(0.6, 2.05, 4.9), v3(0.4, 1.95, 4.15), ease.out(sp)), v3(0, 1.82, 0), lerp(0.03, -0.02, sp));
    T.haloAt(v3(0, 1.3, 0), 0.3, 0.18, '#ffb866');
  } else if (name === 'drauf') {
    room = 1; on = 0; T.mood(1);
    placeLamp(L, 0, 0, 0, 0.3); shadowAt(L, 1);
    const p = ease.inOutQuint(seg(t, 2.82, 3.42)); const bounce = t > 3.42 ? Math.exp(-(t - 3.42) * 12) * Math.sin((t - 3.42) * 34) * 0.03 : 0;
    L.ball.position.y = KM.BALL_Y + (1 - p) * 3.1 + Math.abs(bounce); L.ball.rotation.y = (1 - p) * 1.2;
    lens(28); aim(cam, vlerp(v3(4.7, 3.7, 9.0), v3(4.25, 3.45, 8.1), ease.out(sp)), v3(0, 1.45, 0));
    T.haloAt(BALL(L), 0.22, 0.75);
  } else if (name === 'stecker') {
    room = 1; T.mood(1);
    on = ease.out(seg(t, ON_AT, ON_AT + 0.3));
    placeLamp(L, 0, 0, 0, Math.PI + 0.45); shadowAt(L, 1);
    plug.visible = true;
    const port = L.group.localToWorld(KM.PORT.clone()); const dir = v3(0, 0, -1).applyEuler(L.group.rotation);
    const pin = ease.outQuint(seg(t, 4.22, 4.6));
    plug.position.copy(port.clone().add(dir.clone().multiplyScalar(lerp(1.4, 0.02, pin))));
    plug.rotation.set(0, L.group.rotation.y, 0);
    const a = Math.atan2(dir.x, dir.z) + 0.6, d0 = lerp(10.4, 9.7, ease.out(sp));
    lens(30); aim(cam, v3(Math.sin(a) * d0, 2.0, Math.cos(a) * d0), v3(0, 1.08, 0));
    T.haloAt(BALL(L), 0.2, 0.55 + 0.25 * on, on > 0.5 ? '#ffd9a8' : null);
    poolAt(pool, L, 0.12 * on);
  } else if (name === 'dunkel') {
    room = 1 - ease.inOut(seg(t, 5.26, 5.42)); T.mood(room);
    placeLamp(L, 0, 0, 0, 0.3); shadowAt(L, 0.4 + 0.6 * room);
    lens(26); aim(cam, vlerp(v3(0.45, 2.4, 12.6), v3(0.35, 2.2, 11.5), ease.out(sp)), v3(0, 1.3, 0));
    const swell = ease.out(seg(t, 5.5, 5.9));
    T.haloAt(v3(0, 1.3, 0), 0.19 + 0.03 * swell, 0.12 + 0.16 * (1 - room) * (0.6 + 0.4 * swell), room < 0.5 ? '#ffb866' : null);
    poolAt(pool, L, 0.1 + 0.24 * (1 - room)); T.U.uStars.value = 0.55 * (1 - room);
    if (room < 0.5) dustOn(0.35 + 0.15 * swell, t);
  } else if (name === 'an') {
    placeLamp(L, 0, 0, 0, 0.45);
    lens(28); aim(cam, vlerp(v3(-1.7, 0.85, 7.7), v3(-1.25, 1.0, 6.5), ease.out(sp)), v3(0, 1.5, 0));
    T.haloAt(v3(0, 1.3, 0), 0.24, 0.3, '#ffb866'); poolAt(pool, L, 0.36); dustOn(0.55, t);
  } else if (name === 'rundum') {
    placeLamp(L, 0, 0, 0, 0.3);
    const a = lerp(-0.95, 0.55, ease.inOut(sp)), R0 = 8.6;
    lens(28); aim(cam, v3(Math.sin(a) * R0, 2.3, Math.cos(a) * R0), v3(0, 1.5, 0));
    T.haloAt(v3(0, 1.3, 0), 0.2, 0.26, '#ffb866'); poolAt(pool, L, 0.32); dustOn(0.45, t);
  } else if (name === 'zimmer') {
    placeLamp(L, 0, 0, 0, 0.35); stand.visible = books.visible = plant.visible = true; T.floor.visible = false;
    lens(30); aim(cam, vlerp(v3(0.9, 2.9, 13.2), v3(0.55, 2.75, 12.2), sp), v3(0, 1.5, -0.3));
    T.haloAt(v3(0, 1.3, 0), 0.2, 0.24, '#ffb866'); poolAt(pool, L, 0.4); dustOn(0.35, t);
  } else if (name === 'geschenk') {
    room = 0.45; T.mood(room); placeLamp(L, 0, 0, 0, 0.3); gift.group.visible = true;
    const lid = ease.inOut(seg(t, 9.58, 9.98));
    gift.lid.position.set(lid * 1.6, gift.H + lid * 4.2, -lid * 1.2); gift.lid.rotation.set(-lid * 0.5, lid * 0.6, -lid * 0.7);
    gift.walls.forEach((w, i) => { const q = ease.outBack(seg(t, 9.86 + i * 0.05, 10.32 + i * 0.05)); w.rotation.x = Math.min(1.0, q) * Math.PI / 2 * (q > 1 ? 1 + (q - 1) * 0.05 : 1); });
    const open = seg(t, 9.6, 10.3);
    lens(30); aim(cam, vlerp(v3(0, 5.4, 12.8), v3(0, 4.6, 10.8), ease.out(sp)), v3(0, 1.3, 0));
    T.haloAt(v3(0, 1.3, 0), 0.16 + 0.06 * open, 0.08 + 0.22 * open, '#ffb866'); poolAt(pool, L, 0.12 + 0.28 * open);
    on = 0.35 + 0.65 * ease.out(open); if (t > 10.2) dustOn(0.4 * seg(t, 10.2, 10.6), t);
  } else if (name === 'motive') {
    const POS = [[-1.32, 2.75, -0.6], [1.32, 2.75, -0.6], [-1.32, 0, 0.6], [1.32, 0, 0.6]];
    ALL.forEach((lp, i) => {
      const q = ease.outBack(seg(t, t0 + 0.02 + i * 0.07, t0 + 0.5 + i * 0.07));
      placeLamp(lp, POS[i][0], POS[i][1] - (1 - Math.min(1, q)) * 1.2, POS[i][2], 0.25, Math.max(0.001, q));
      poolAt(i ? pools[i - 1] : pool, lp, 0.22 * clamp(q));
    });
    lens(26); aim(cam, vlerp(v3(0, 3.0, 24.4), v3(0, 2.95, 23.4), ease.out(sp)), v3(0, 2.9, 0));
    T.haloAt(v3(0, 2.6, 0), 0.3, 0.0);
  } else if (name === 'ende') {
    placeLamp(L, 0, 0, 0, lerp(0.0, 0.6, sp));
    lens(26); aim(cam, vlerp(v3(0, 1.45, 22.6), v3(0, 1.35, 21.5), ease.out(sp)), v3(0, 0.55, 0));
    T.haloAt(v3(0, 1.3, 0), 0.12, 0.3, '#ffb866'); poolAt(pool, L, 0.3); dustOn(0.3, t);
  }
  // Lampen schalten (Punktgroesse folgt der Brennweite)
  ALL.forEach((lp) => { if (lp.group.visible) lp.set(on, room, { cam, glowScale: name === 'motive' ? 0.6 : 1 }); });
  scene.updateMatrixWorld(true);

  // ---------- Overlay ----------
  O.pillA(t < 1.5 ? 1 - seg(t, 1.38, 1.5) : 0);
  O.head1(t < 1.5 ? t - 0.04 : -1, seg(t, 1.36, 1.5));
  O.corners(t < 1.5 ? t : -1, seg(t, 1.36, 1.5));
  O.head2(t >= 1.55 && t < 2.75 ? t - 1.55 : -1, seg(t, 2.6, 2.75));
  const steps = [[2.75, '01', 'Kugel drauf'], [4.0, '02', 'Einstecken'], [5.0, '03', 'Licht aus']];
  const st = [...steps].reverse().find((s) => t >= s[0]);
  O.step(st && t < 6.0 ? t - st[0] : -1, st ? st[1] : '', st ? st[2] : '', seg(t, 5.86, 6.0));
  O.head3(t >= 6.05 && t < 7.25 ? t - 6.05 : -1, seg(t, 7.1, 7.25));
  O.head4(t >= 7.3 && t < 8.5 ? t - 7.3 : -1, seg(t, 8.36, 8.5));
  O.head5(t >= 8.55 && t < 9.5 ? t - 8.55 : -1, seg(t, 9.38, 9.5));
  O.head6(t >= 9.55 && t < 11.0 ? t - 9.55 : -1, seg(t, 10.86, 11.0));
  O.head7(t >= 11.03 && t < 12 ? t - 11.03 : -1, seg(t, 11.88, 12.0));
  O.seal(t >= 11.15 && t < 12 ? t - 11.15 : -1, seg(t, 11.88, 12.0));
  if (name === 'stecker') { const v = L.group.localToWorld(KM.PORT.clone()).project(cam); O.ripple((v.x + 1) / 2 * 1080, (1 - v.y) / 2 * 1920, t - 4.6); } else O.ripple(0, 0, -1);
  O.end(t >= 12 ? t - 12 : -1, 0);
  O.pillE(t >= 12 ? ease.out(seg(t, 12.05, 12.35)) : 0);
  O.streak(t > 1.3 && t < 1.7 ? seg(t, 1.34, 1.66) : t > 2.55 && t < 2.95 ? seg(t, 2.59, 2.91) : t > 11.8 && t < 12.2 ? seg(t, 11.84, 12.16) : 0);
  O.flash(0);
  O.grain(Math.round(t * 30), 1);
  r.render(scene, cam);
}
window.__frame = frame; window.__dauer = DAUER; window.__ready = true;
