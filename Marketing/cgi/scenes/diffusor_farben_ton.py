"""Ton fuer "Mein Kaminfeuer ist kaputt." (Aroma Öl Diffusor Weiss, Farbwechsel; abgeleitet von diffusor_feuer_ton.py, neue Tonart, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Musik: warmer Chill in F-Dur (F - Am - Dm - Bb, je ein Takt) mit Marimba-Melodie, Rhodes, leisem Nebel-Rauschen
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
rng = np.random.default_rng(77)

# ---------- Musik als 8-s-Schleife (Zeit = Sekunde der fertigen Datei) ----------
P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'G': (31, [59, 62, 67, 71]), 'Em': (28, [59, 64, 67, 71]), 'C': (36, [60, 64, 67, 72]), 'D': (26, [57, 62, 66, 69])}
PROG = [(0.0, 2.0, 'G'), (2.0, 4.0, 'Em'), (4.0, 6.0, 'C'), (6.0, 8.0, 'D')]
DROP = 2.2  # erster Schnitt (Datei 2,2 s)
for a, b, c in PROG:
    bass, ch = CH[c]
    K.put(P, mk.pad([hz(m) for m in ch], 2.1, cut=1800) , a, 0.1)
    for st, ln, vel in ((0.0, 1.3, 0.6), (1.25, 0.6, 0.42)):        # Rhodes: Akkord auf 1, Nachschlag auf 3-und
        for k, m in enumerate(ch): K.put(P, mk.reverb(K.epiano(hz(m), ln, vel), 2.0, 0.3), a + st + k * 0.02, 0.26, pan=(k - 1.5) * 0.25)
    K.put(P, mk.bass(hz(bass), 1.6 if a < DROP else 0.9, cut=240), a, 0.6)
    if a >= DROP - 0.3: K.put(P, mk.bass(hz(bass), 0.5, cut=240), a + 1.0, 0.5)
# Marimba, ruhig
MEL = [(0.0, 79), (0.75, 83), (1.25, 86), (1.5, 83), (2.0, 83), (2.5, 79), (3.0, 76), (3.5, 79),
       (4.0, 84), (4.75, 79), (5.25, 76), (5.5, 79), (6.0, 81), (6.5, 78), (7.0, 74), (7.5, 78)]
for tt, m in MEL: K.put(P, mk.reverb(K.marimba(hz(m), 0.8, 0.85), 2.0, 0.35), tt, 0.3, pan=-0.15)
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
vin = K.lp(np.random.default_rng(3).normal(0, 1, N8), 2500) * 0.012   # leises Nebel-Rauschen
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
K.put(fx, K.lp(rng.normal(0, 1, int((D + 0.5) * SR)) * 0.02, 5000), 0.0, 1.0)   # Ultraschall-Nebel, ganz leise
for tt in (2.6, 4.2, 5.6, 7.0): K.put(fx, K.whoosh(0.3, 300, 2000), tt - 0.12, 0.08)
for tt in (0.7, 2.6, 4.2, 5.6): K.put(fx, K.shimmer(0.35), tt, 0.05)   # Farbwechsel
for tt, f in ((4.3, 860), (5.7, 700), (6.1, 1100)): K.put(fx, K.pop(f), tt, 0.2)
L = N
os.makedirs(OUT, exist_ok=True)
for name, x in (('dfa_ton_mit_musik', musik[:L] * 0.7 + fx[:L]), ('dfa_ton_ohne_musik', fx[:L])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -2.5)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
