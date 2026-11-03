"""Ton fuer "Halloween. Ich frag die Kugel." (Krystall Ball Nachtlampe, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Musik: Dream-Lo-Fi in d-Moll (Dm - Bb - Gm - A, je ein Takt) mit Spieluhr-Melodie, Rhodes, Plattenknistern
   und einem leisen Pad, als Schleife von genau 8,0 s gebaut: Takt 1 beginnt bei Render-Sekunde 0,4 (= Anfang der
   fertigen Datei), dadurch sind die letzten und die ersten 0,4 s gleich und die Naht von finish.py --loop ist nicht
   zu hoeren. Beat ab dem ersten Schnitt (Datei 2,2 s). Kein Klang-Logo, kein Schlussakkord.
   Geraeusche: Kerzenknistern, Glitzer auf dem Schnitt in die Kugel, Pops auf den Einblendungen.
   Zwei Mischungen: mit Musik und nur Geraeusche.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 8.4; OFF = 0.4; LOOP = 8.0; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(50)

# ---------- Musik als 8-s-Schleife (Zeit = Sekunde der fertigen Datei) ----------
P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'Dm': (38, [57, 62, 65, 69]), 'Bb': (34, [58, 62, 65, 70]), 'Gm': (31, [58, 62, 67, 70]), 'A': (33, [57, 61, 64, 69])}
PROG = [(0.0, 2.0, 'Dm'), (2.0, 4.0, 'Bb'), (4.0, 6.0, 'Gm'), (6.0, 8.0, 'A')]
DROP = 2.2
for a, b, c in PROG:
    bass, ch = CH[c]
    K.put(P, mk.pad([hz(m) for m in ch], 2.1, cut=1800) , a, 0.1)
    for st, ln, vel in ((0.0, 1.3, 0.6), (1.25, 0.6, 0.42)):        # Rhodes: Akkord auf 1, Nachschlag auf 3-und
        for k, m in enumerate(ch): K.put(P, mk.reverb(K.epiano(hz(m), ln, vel), 2.0, 0.3), a + st + k * 0.02, 0.26, pan=(k - 1.5) * 0.25)
    K.put(P, mk.bass(hz(bass), 1.6 if a < DROP else 0.9, cut=240), a, 0.6)
    if a >= DROP - 0.3: K.put(P, mk.bass(hz(bass), 0.5, cut=240), a + 1.0, 0.5)
# Spieluhr: d-Moll mit Cis, langsam
MEL = [(0.0, 74), (0.5, 77), (1.0, 81), (1.5, 80), (2.0, 77), (3.0, 74), (3.5, 77),
       (4.0, 79), (4.5, 82), (5.0, 81), (5.5, 77), (6.0, 76), (6.5, 73), (7.0, 76), (7.5, 81)]
for tt, m in MEL: K.put(P, mk.reverb(K.spieluhr(hz(m), 1.4, 0.8), 2.4, 0.4), tt, 0.26, pan=-0.15)
for i in range(int(LOOP / S16)):
    tt = i * S16; st = i % 16
    if tt < DROP:
        if st % 4 == 2: K.put(dr, mk.hat(False), tt, 0.05, pan=0.25)
        continue
    if st in (0, 7, 10): K.put(dr, mk.kick(), tt, 0.62); kicks.append(tt)
    if st in (4, 12): K.put(dr, mk.snare(), tt, 0.16)
    if st % 2 == 0: K.put(dr, mk.hat(st % 8 == 6), tt, 0.07, pan=0.25)
K.put(dr, mk.kick(), DROP, 0.8); kicks.append(DROP)
g = mk.duck(len(P), kicks, S16, depth=0.3, rel=0.45); P *= g[:, None]
P = P + dr
N8 = int(LOOP * SR)
circ = P[:N8].copy(); tail = P[N8:]; circ[:len(tail)] += tail[:N8]       # Nachhall in den Anfang falten
vin = K.vinyl(LOOP, density=8.0)
circ[:, 0] += vin * 0.5; circ[:, 1] += vin * 0.5
N = int(D * SR)
idx = (np.arange(N) - int(OFF * SR)) % N8
musik = circ[idx]

# ---------- Geraeusche (Render-Zeit) ----------
fx = K.buf(D + 1)
def knister(dur, dichte=6.0):
    n = int(dur * SR); out = np.zeros(n)
    for _ in range(int(dur * dichte)):
        i = int(rng.uniform(0, n - 900)); m = 300 + int(rng.uniform(0, 500))
        out[i:i + m] += K.bp(rng.normal(0, 1, m), 900, 4200) * np.exp(-np.linspace(0, 12, m)) * rng.uniform(0.15, 0.5)
    return K.lp(out, 5000)
K.put(fx, knister(D + 0.5), 0.0, 0.14, pan=-0.3)                   # Kerzen
K.put(fx, K.shimmer(0.6), 2.55, 0.18)                               # Schnitt in die Kugel
for tt in (4.2, 5.6, 7.0): K.put(fx, K.whoosh(0.3, 300, 2000), tt - 0.12, 0.08)
for tt, f in ((2.7, 980), (4.3, 860), (5.7, 700), (6.15, 1100), (7.5, 900)): K.put(fx, K.pop(f), tt, 0.2)
L = N
os.makedirs(OUT, exist_ok=True)
for name, x in (('kw_ton_mit_musik', musik[:L] * 0.7 + fx[:L]), ('kw_ton_ohne_musik', fx[:L])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
