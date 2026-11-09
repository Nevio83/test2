"""Ton fuer "Jeden Morgen dasselbe." (Wasserspender mit Figur Mo, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Musik: kuechenhelles Lo-Fi in F-Dur (Fmaj7 - Dm7 - Bbmaj7 - C7), E-Piano + Bass; bis zum Spender (Render 3,8 s) nur schleppender Bass,
   dann Beat. Schleife von genau 8,0 s (Takt 1 bei Render-Sekunde 0,4). Kein Klang-Logo, kein Schlussakkord.
   Geraeusche: Stapfen, Schwappen und Pfuetze (Render 2,5-3,6), Schlauch-Ting (3,9), Wasser ins Glas (3,95-6,0), Pops auf den Einblendungen.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 8.4; OFF = 0.4; LOOP = 8.0; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(91)

P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'F': (29, [57, 60, 64, 65]), 'Dm': (26, [57, 60, 62, 65]), 'Bb': (34, [58, 62, 65, 69]), 'C': (31, [55, 58, 64, 67])}
PROG = [(0.0, 2.0, 'F'), (2.0, 4.0, 'Dm'), (4.0, 6.0, 'Bb'), (6.0, 8.0, 'C')]
DROP = 3.4      # = Render 3,8
for a, b, c in PROG:
    bass, ch = CH[c]
    K.put(P, mk.pad([hz(m) for m in ch], 2.1, cut=1700), a, 0.09)
    for st, ln, vel in ((0.0, 1.2, 0.6), (1.25, 0.55, 0.42)):
        for k, m in enumerate(ch): K.put(P, mk.reverb(K.epiano(hz(m), ln, vel), 1.8, 0.28), a + st + k * 0.02, 0.24, pan=(k - 1.5) * 0.25)
    K.put(P, mk.bass(hz(bass), 1.5 if a < DROP else 0.9, cut=250), a, 0.62)
    if a >= DROP - 0.3: K.put(P, mk.bass(hz(bass), 0.5, cut=250), a + 1.0, 0.5)
MEL = [(0.0, 76), (0.5, 72), (1.0, 76), (1.5, 79), (2.0, 74), (2.5, 77), (3.0, 81), (3.5, 77),
       (4.0, 77), (4.5, 74), (5.0, 70), (5.5, 74), (6.0, 76), (6.5, 79), (7.0, 72), (7.5, 67)]
for tt, m in MEL: K.put(P, mk.reverb(K.epiano(hz(m + 12), 0.5, 0.55), 1.6, 0.3), tt, 0.2, pan=0.15)
for i in range(int(LOOP / S16)):
    tt = i * S16; st = i % 16
    if tt < DROP:
        if st in (0, 8): K.put(dr, mk.kick(), tt, 0.45); kicks.append(tt)     # schleppende Schritte
        continue
    if st in (0, 7, 10): K.put(dr, mk.kick(), tt, 0.62); kicks.append(tt)
    if st in (4, 12): K.put(dr, mk.snare(), tt, 0.16)
    if st % 2 == 0: K.put(dr, mk.hat(st % 8 == 6), tt, 0.07, pan=0.25)
g = mk.duck(len(P), kicks, S16, depth=0.3, rel=0.45); P *= g[:, None]
P = P + dr
N8 = int(LOOP * SR)
circ = P[:N8].copy(); tail = P[N8:]; circ[:len(tail)] += tail[:N8]
vin = K.vinyl(LOOP, density=6.0)
circ[:, 0] += vin * 0.4; circ[:, 1] += vin * 0.4
N = int(D * SR)
idx = (np.arange(N) - int(OFF * SR)) % N8
musik = circ[idx]

fx = K.buf(D + 1)
def wasser(dur, gain=1.0, lo=500, hi=5500):
    n = int(dur * SR); x = K.bp(rng.normal(0, 1, n), lo, hi) * 0.3
    for _ in range(int(dur * 30)):
        i = int(rng.uniform(0, n - 500)); m = 200 + int(rng.uniform(0, 300))
        x[i:i + m] += K.bp(rng.normal(0, 1, m), 1200, 6500) * np.exp(-np.linspace(0, 14, m)) * rng.uniform(0.15, 0.5)
    env = np.minimum(1, np.minimum(np.arange(n) / (0.12 * SR), (n - np.arange(n)) / (0.2 * SR)))
    return K.lp(x, 6500) * env * gain
K.put(fx, K.lp(rng.normal(0, 1, int((D + 1) * SR)), 180) * 0.03, 0.0, 1.0)
for tt in np.arange(0.15, 2.4, 0.6): K.put(fx, K.pop(150), tt, 0.1); K.put(fx, K.pop(130), tt + 0.3, 0.08)       # Stapfen
K.put(fx, wasser(0.9, 1.0), 2.75, 0.22); K.put(fx, K.whoosh(0.3, 250, 1400), 2.6, 0.08)                          # Schwappen, Pfuetze
K.put(fx, K.pop(300), 3.25, 0.2)
K.put(fx, K.shimmer(0.6), 3.9, 0.18); K.put(fx, K.pop(700), 3.9, 0.2)                                           # Schlauch rein, Ting
K.put(fx, wasser(2.05, 1.0, 600, 6000), 3.95, 0.2)                                                              # Wasser ins Glas
for tt, f in ((0.3, 900), (2.55, 760), (3.95, 860), (5.35, 700), (6.4, 1100), (6.65, 900), (7.7, 820)): K.put(fx, K.pop(f), tt, 0.16)
L = N
os.makedirs(OUT, exist_ok=True)
for name, x in (('wf_ton_mit_musik', musik[:L] * 0.7 + fx[:L]), ('wf_ton_ohne_musik', fx[:L])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -2.2)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
