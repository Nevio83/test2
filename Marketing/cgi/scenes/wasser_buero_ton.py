"""Ton fuer "Ich steh nicht mehr auf." (Wasserspender Schwarz, Homeoffice, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Musik: Tropical House in A-Dur (A - E/G# - F#m - D, je ein Takt), Marimba-Hook, Plucks auf den Offbeats, Tropfen,
   als Schleife von genau 8,0 s gebaut: Takt 1 beginnt bei Render-Sekunde 0,4 (= Anfang der fertigen Datei), dadurch
   sind die letzten und die ersten 0,4 s gleich und die Naht von finish.py --loop ist nicht zu hoeren.
   Drop beim ersten Schnitt (Datei 2,2 s). Kein Klang-Logo, kein Schlussakkord.
   Geraeusche: Wasserstrahl ins Glas (laeuft bis 4,4 s und wieder ab 7,0 s), Pops auf den Einblendungen, leiser Raum.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 8.4; OFF = 0.4; LOOP = 8.0; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(10)
DROP = 2.2

P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'A': (33, [64, 69, 73, 76], [61, 64, 69]), 'E': (32, [64, 68, 71, 76], [59, 64, 68]),
      'F#m': (30, [64, 66, 69, 73], [61, 66, 69]), 'D': (26, [62, 66, 69, 74], [62, 66, 69])}
PROG = [(0.0, 2.0, 'A'), (2.0, 4.0, 'E'), (4.0, 6.0, 'F#m'), (6.0, 8.0, 'D')]
for a, b, c in PROG:
    bass, pad, pl = CH[c]
    K.put(P, K.pad([hz(m) for m in pad], 2.3, cut=1700 if a < DROP else 2600), a, 0.36)
    for k in range(8):
        tt = a + k * BEAT / 2 * 2 + BEAT / 2              # Offbeats
        if tt >= DROP - 0.01 and tt < b: K.put(P, K.pluckchord([hz(m) for m in pl], 0.26, 0.9), tt, 0.42, pan=(0.3 if k % 2 else -0.3))
    for st, oc in [(0, 0), (3, 12), (6, 0), (8, 0), (11, 12), (14, 0)]:
        tt = a + st * S16
        if tt >= DROP - 0.01: K.put(P, mk.bass(hz(bass + oc), S16 * 2.2, cut=520), tt, 0.9)
    if a < DROP: K.put(P, mk.bass(hz(bass), 1.8, cut=260), a, 0.5)
HOOK = [(0.0, 76), (0.5, 81), (0.75, 80), (1.0, 76), (1.5, 73), (2.0, 76), (2.5, 80), (3.0, 83), (3.5, 80),
        (4.0, 78), (4.5, 81), (4.75, 80), (5.0, 78), (5.5, 73), (6.0, 74), (6.5, 78), (7.0, 81), (7.5, 78)]
for tt, m in HOOK: K.put(P, mk.reverb(K.marimba(hz(m), 0.6, 0.9), 1.2, 0.2), tt, 0.32 if tt < DROP else 0.42, pan=0.15)
for tt in (0.875, 2.875, 4.875, 6.875): K.put(P, K.plip(900 + rng.uniform(-80, 80)), tt, 0.2, pan=-0.3)
for i in range(int(LOOP / S16)):
    tt = i * S16; st = i % 16
    if tt < DROP:
        if st % 4 == 2: K.put(dr, mk.shaker(), tt, 0.08, pan=0.3)
        continue
    if st % 4 == 0: K.put(dr, mk.kick(), tt, 0.75); kicks.append(tt)
    if st in (4, 12): K.put(dr, mk.clap(), tt, 0.25)
    if st % 2 == 1: K.put(dr, mk.hat(st % 4 == 2), tt, 0.09, pan=0.25)
    K.put(dr, mk.shaker(), tt, 0.05, pan=-0.2)
g = mk.duck(len(P), kicks, S16, depth=0.4, rel=0.4); P *= g[:, None]
P = P + dr
N8 = int(LOOP * SR)
circ = P[:N8].copy(); tail = P[N8:]; circ[:len(tail)] += tail[:N8]
N = int(D * SR)
idx = (np.arange(N) - int(OFF * SR)) % N8
musik = circ[idx]

# ---------- Geraeusche (Render-Zeit) ----------
fx = K.buf(D + 1)
K.put(fx, K.lp(K.pour(4.6, 700, 1300), 6000), -0.1, 0.34)          # laeuft schon ab Bild 0, aus bei 4,4 s
K.put(fx, K.lp(K.pour(1.6, 700, 900), 6000), 7.0, 0.34)              # Loop-Ende: laeuft wieder (wie der Anfang)
K.put(fx, K.lp(K.slide(0.4), 1400), 4.4, 0.18)
room = K.lp(rng.normal(0, 1, int((D + 0.5) * SR)), 700) * 0.01
fx[:len(room), 0] += room; fx[:len(room), 1] += room
for tt in (2.6, 4.2, 5.6, 7.0): K.put(fx, K.whoosh(0.3, 300, 2200), tt - 0.12, 0.08)
for tt, f in ((4.3, 860), (5.7, 700), (6.15, 1100), (7.5, 900)): K.put(fx, K.pop(f), tt, 0.2)
L = N
os.makedirs(OUT, exist_ok=True)
for name, x in (('wb_ton_mit_musik', musik[:L] * 0.66 + fx[:L]), ('wb_ton_ohne_musik', fx[:L])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
