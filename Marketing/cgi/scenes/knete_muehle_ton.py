"""Ton Knete-Mühle (20,5 s, 12-fps-Stop-Motion, 100 BPM, G-Dur, verspielt): Marimba + Pizzicato-Bass + Shaker.
   Geräusche: Bohnen-Hüpfer (Plips), Deckel (Klonk), Taster (Klick), Mahlwerk (Motor), Gewürze, Preis-Pop. Kein Gesang, keine Stimme."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 20.5; hz = K.hz; rng = np.random.default_rng(55)
BEAT = 0.6; S8 = BEAT / 2
P = K.buf(D + 3); dr = K.buf(D + 3)
PROG = [('G', 43, [67, 71, 74]), ('Em', 40, [67, 71, 76]), ('C', 36, [67, 72, 76]), ('D', 38, [66, 69, 74])]
bar = BEAT * 4
for n in range(int(D / bar) + 1):
    a = n * bar; _, b, ch = PROG[n % 4]
    if a >= D: break
    for st in (0, 2):  # Pizzicato-Bass auf 1 und 3
        K.put(P, mk.pluck(hz(b), 0.35, cut=900), a + st * BEAT, 0.5)
    for k, st in enumerate((0.5, 1.5, 2.5, 3.0, 3.5)):
        m = ch[k % 3] + 12
        if a + st * BEAT < D - 0.6: K.put(P, mk.reverb(K.marimba(hz(m), 0.5, 0.8), 1.2, 0.2), a + st * BEAT, 0.22, pan=(k - 2) * 0.2)
MEL = [79, 83, 86, 83, 81, 79, 76, 79, 81, 83, 79, 74, 76, 79, 81, 86]
for i in range(int(D / S8)):
    tt = i * S8
    if 3.0 <= tt < D - 0.8 and i % 2 == 0: K.put(P, mk.reverb(K.marimba(hz(MEL[(i // 2) % 16]), 0.4, 0.7), 1.2, 0.25), tt, 0.16, pan=0.25)
    if tt >= 3.0 and tt < D - 0.5: K.put(dr, mk.shaker(), tt, 0.05 if i % 2 else 0.03, pan=-0.2)
    if tt >= 6.0 and tt < D - 0.5 and i % 8 == 0: K.put(dr, mk.kick(), tt, 0.35)
    if tt >= 6.0 and tt < D - 0.5 and i % 8 == 4: K.put(dr, mk.clap(), tt, 0.1)
P = P + dr
N = int(D * SR); musik = P[:N].copy(); musik *= np.minimum(1, (D - np.arange(N) / SR) / 0.5)[:, None]
fx = K.buf(D + 1)
K.put(fx, K.lp(rng.normal(0, 1, int((D + 1) * SR)), 200) * 0.02, 0, 1.0)
for i in range(44): K.put(fx, K.plip(500 + (i % 7) * 60), 3.05 + i * 0.058 + 0.4, 0.06)           # Bohnen landen
for tt in np.arange(0.4, 2.8, 0.55): K.put(fx, K.plip(420), tt, 0.04)                               # Bohnen wackeln
K.put(fx, K.whoosh(0.3, 300, 1500), 6.0, 0.08); K.put(fx, K.knock(260, 22, 0.6), 6.35, 0.3)          # Deckel
K.put(fx, K.click(), 7.35, 0.4)                                                                       # Taster
mot = K.motor(2.4, up=0.15, down=0.25, f_run=210); K.put(fx, mot, 8.45, 0.35)                         # Mahlen
for tt in (8.7, 11.2, 13.8, 16.4, 17.0, 19.5): K.put(fx, K.pop(900 + int(tt * 15)), tt, 0.14)          # Schilder
for i in range(10): K.put(fx, K.plip(900 + i * 40), 13.9 + i * 0.09 + 0.4, 0.05)                       # Pfeffer
K.put(fx, K.knock(320, 30, 0.3), 15.4, 0.15)
for i in range(3): K.put(fx, K.knock(380, 30, 0.2), 15.8 + i * 0.12, 0.12)
K.put(fx, K.shimmer(0.6), 16.3, 0.12)
os.makedirs(OUT, exist_ok=True)
for name, x in (('km_ton_mit_musik', musik * 0.7 + fx[:N]), ('km_ton_ohne_musik', fx[:N])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -2.2); print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
