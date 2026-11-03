"""Ton fuer den Satisfying-Loop Mixer (Rosa, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Musik: ruhiger E-Piano-Groove in F-Dur (F - Am - Bb - C, je ein Takt), als Schleife von genau 8,0 s
   (Takt 1 bei Render-Sekunde 0,4). Weiche Drums ab dem ersten Schnitt (Datei 2,0 s). Kein Klang-Logo,
   kein Schlussakkord. Geraeusche: Mixer-Motor laeuft durchgehend (gleichmaessig, damit die Naht nicht auffaellt),
   leises Gluckern, Whoosh auf den Schnitten, Pops auf Preis und Link. Zwei Mischungen: mit Musik und nur Geraeusche.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 8.4; OFF = 0.4; LOOP = 8.0; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(11)

P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'F': (41, [65, 69, 72, 76]), 'Am': (45, [64, 69, 72, 76]), 'Bb': (46, [65, 70, 74, 77]), 'C': (48, [64, 67, 72, 74])}
PROG = [(0.0, 2.0, 'F'), (2.0, 4.0, 'Am'), (4.0, 6.0, 'Bb'), (6.0, 8.0, 'C')]
for a, b, c in PROG:
    bass, ch = CH[c]
    for st, vel in ((0.0, 1.0), (0.75, 0.6), (1.5, 0.8)):            # E-Piano-Akkorde, leicht synkopiert
        for m in ch: K.put(P, K.epiano(hz(m), 0.7, 0.55 * vel), a + st, 0.16, pan=((m % 5) - 2) * 0.1)
    K.put(P, K.pad([hz(m) for m in ch], b - a + 0.25, cut=2200), a, 0.22)
    for st in (0.0, 1.0, 1.5): K.put(P, mk.bass(hz(bass), 0.45, cut=320), a + st, 0.55)
MEL = [(0.5, 81), (1.0, 79), (1.25, 77), (3.0, 76), (3.5, 77), (5.0, 81), (5.25, 82), (5.5, 81), (7.0, 79), (7.5, 76)]
for tt, m in MEL: K.put(P, mk.reverb(K.marimba(hz(m), 0.6, 0.8), 1.5, 0.25), tt, 0.2, pan=0.2)
for i in range(int(LOOP / S16)):
    tt = i * S16; st = i % 16
    if tt < 2.0: continue
    if st in (0, 10): K.put(dr, mk.kick(), tt, 0.5); kicks.append(tt)
    if st in (4, 12): K.put(dr, K.lp(mk.snare(), 2600), tt, 0.12)
    if st % 2 == 0: K.put(dr, mk.shaker(), tt, 0.07 if st % 4 else 0.1, pan=-0.3)
K.put(dr, mk.kick(), 2.0, 0.7); kicks.append(2.0)
g = mk.duck(len(P), kicks, S16, depth=0.25, rel=0.4); P *= g[:, None]
P = P + dr
N8 = int(LOOP * SR)
circ = P[:N8].copy(); tail = P[N8:]; circ[:len(tail)] += tail[:N8]
N = int(D * SR)
musik = circ[(np.arange(N) - int(OFF * SR)) % N8]

fx = K.buf(D + 1)
mot = K.motor(12.0, up=0.3, down=0.3, f_run=165)
seg = mot[int(1.5 * SR): int(1.5 * SR) + N]
K.put(fx, seg, 0.0, 0.32)
for tt in (0.6, 1.7, 2.9, 4.4, 5.6, 6.9, 7.9): K.put(fx, K.bubbles(0.35, 4), tt, 0.05, pan=rng.uniform(-0.3, 0.3))
for tt in (2.4, 4.2, 6.0, 7.4): K.put(fx, K.whoosh(0.3, 300, 2400), tt - 0.12, 0.08)
for tt, f in ((6.05, 760), (6.4, 1100)): K.put(fx, K.pop(f), tt, 0.18)
os.makedirs(OUT, exist_ok=True)
for name, x in (('mixer_sat_ton_mit_musik', musik[:N] * 0.6 + fx[:N]), ('mixer_sat_ton_ohne_musik', fx[:N])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
