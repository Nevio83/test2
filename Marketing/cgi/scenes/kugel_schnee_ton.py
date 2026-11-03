"""Ton fuer "Draussen Regen. Bei mir schneit's." (Krystall Ball Nachtlampe Schneemann, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Musik: Winter-Lo-Fi in F-Dur (Bbmaj7 - Am7 - Gm7 - C9, je ein Takt), Regen statt Kerzenknistern.
   Alt (Vorlage): Dream-Lo-Fi in d-Moll mit Spieluhr-Melodie, Rhodes, Plattenknistern
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
rng = np.random.default_rng(53)

# ---------- Musik als 8-s-Schleife (Zeit = Sekunde der fertigen Datei) ----------
P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'Bb': (34, [57, 62, 65, 69]), 'Am': (33, [55, 60, 64, 67]), 'Gm': (31, [53, 58, 62, 65]), 'C': (36, [55, 58, 62, 64])}
PROG = [(0.0, 2.0, 'Bb'), (2.0, 4.0, 'Am'), (4.0, 6.0, 'Gm'), (6.0, 8.0, 'C')]
DROP = 2.2
for a, b, c in PROG:
    bass, ch = CH[c]
    K.put(P, mk.pad([hz(m) for m in ch], 2.1, cut=1800) , a, 0.1)
    for st, ln, vel in ((0.0, 1.3, 0.6), (1.25, 0.6, 0.42)):        # Rhodes: Akkord auf 1, Nachschlag auf 3-und
        for k, m in enumerate(ch): K.put(P, mk.reverb(K.epiano(hz(m), ln, vel), 2.0, 0.3), a + st + k * 0.02, 0.26, pan=(k - 1.5) * 0.25)
    K.put(P, mk.bass(hz(bass), 1.6 if a < DROP else 0.9, cut=240), a, 0.6)
    if a >= DROP - 0.3: K.put(P, mk.bass(hz(bass), 0.5, cut=240), a + 1.0, 0.5)
# Spieluhr: d-Moll mit Cis, langsam
MEL = [(0.0, 81), (0.75, 79), (1.0, 77), (1.5, 74), (2.0, 76), (2.5, 72), (3.0, 79), (3.5, 77),
       (4.0, 74), (4.5, 77), (5.0, 82), (5.5, 81), (6.0, 79), (6.75, 76), (7.0, 72), (7.5, 77)]
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
def regen(dur):
    n = int(dur * SR); x = K.bp(rng.normal(0, 1, n), 700, 6000) * 0.35
    for _ in range(int(dur * 40)):
        i = int(rng.uniform(0, n - 600)); m = 200 + int(rng.uniform(0, 300))
        x[i:i + m] += K.bp(rng.normal(0, 1, m), 1500, 7000) * np.exp(-np.linspace(0, 14, m)) * rng.uniform(0.2, 0.6)
    return K.lp(x, 6500)
rg = regen(LOOP); N8r = len(rg); rg2 = rg[(np.arange(int(D * SR)) - int(OFF * SR)) % N8r]   # periodisch, Naht unhoerbar
K.put(fx, rg2, 0.0, 0.10, pan=0.0)                                  # Regen am Fenster
K.put(fx, K.shimmer(0.6), 2.55, 0.18)                               # Schnitt in die Kugel
for tt in (4.2, 5.6, 7.0): K.put(fx, K.whoosh(0.3, 300, 2000), tt - 0.12, 0.08)
for tt, f in ((2.7, 980), (4.3, 860), (5.7, 700), (6.15, 1100), (7.5, 900)): K.put(fx, K.pop(f), tt, 0.2)
L = N
os.makedirs(OUT, exist_ok=True)
for name, x in (('ks_ton_mit_musik', musik[:L] * 0.7 + fx[:L]), ('ks_ton_ohne_musik', fx[:L])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
