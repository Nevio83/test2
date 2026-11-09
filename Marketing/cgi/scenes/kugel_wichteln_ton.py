"""Ton fuer "Wichteln. Limit: 20 €." (Krystall Ball Nachtlampe Saturn, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Musik: warmer Weihnachts-Lo-Fi (eigene Melodie) in C-Dur (Cmaj7 - Am7 - Fmaj7 - G), Spieluhr + E-Piano, Plattenknistern.
   Schleife von genau 8,0 s: Takt 1 bei Render-Sekunde 0,4. Beat ab dem Oeffnen der Box (Render 3,5 s). Kein Klang-Logo, kein Schlussakkord.
   Geraeusche: Papier-Rascheln und Pop beim Oeffnen, Glitzer auf Saturn, Pops auf den Einblendungen, Schliessen am Ende.
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
CH = {'Bb': (36, [55, 59, 64, 67]), 'Am': (33, [57, 60, 64, 67]), 'Gm': (29, [57, 60, 64, 69]), 'C': (31, [55, 59, 62, 67])}
PROG = [(0.0, 2.0, 'Bb'), (2.0, 4.0, 'Am'), (4.0, 6.0, 'Gm'), (6.0, 8.0, 'C')]
DROP = 3.1
for a, b, c in PROG:
    bass, ch = CH[c]
    K.put(P, mk.pad([hz(m) for m in ch], 2.1, cut=1800) , a, 0.1)
    for st, ln, vel in ((0.0, 1.3, 0.6), (1.25, 0.6, 0.42)):        # Rhodes: Akkord auf 1, Nachschlag auf 3-und
        for k, m in enumerate(ch): K.put(P, mk.reverb(K.epiano(hz(m), ln, vel), 2.0, 0.3), a + st + k * 0.02, 0.26, pan=(k - 1.5) * 0.25)
    K.put(P, mk.bass(hz(bass), 1.6 if a < DROP else 0.9, cut=240), a, 0.6)
    if a >= DROP - 0.3: K.put(P, mk.bass(hz(bass), 0.5, cut=240), a + 1.0, 0.5)
# Spieluhr: d-Moll mit Cis, langsam
MEL = [(0.0, 79), (0.75, 76), (1.0, 79), (1.5, 84), (2.0, 81), (2.5, 76), (3.0, 72), (3.5, 76),
       (4.0, 77), (4.5, 81), (5.0, 84), (5.5, 81), (6.0, 83), (6.75, 79), (7.0, 74), (7.5, 79)]
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
K.put(fx, K.lp(rng.normal(0, 1, int((D + 1) * SR)), 180) * 0.035, 0.0, 1.0)      # leiser Raum
K.put(fx, K.whoosh(0.35, 250, 1800), 3.35, 0.14); K.put(fx, K.pop(520), 3.45, 0.3)   # Deckel
K.put(fx, K.whoosh(0.3, 300, 2200), 3.75, 0.1)                                       # Waende klappen
K.put(fx, K.shimmer(0.7), 4.3, 0.2)                                                  # Saturn glitzert
K.put(fx, K.whoosh(0.35, 250, 1800), 7.2, 0.12); K.put(fx, K.pop(480), 7.85, 0.22)  # Box schliesst sich
for tt, f in ((0.3, 900), (3.55, 860), (4.95, 700), (6.1, 1100), (6.4, 900), (7.6, 820)): K.put(fx, K.pop(f), tt, 0.18)
L = N
os.makedirs(OUT, exist_ok=True)
for name, x in (('wi_ton_mit_musik', musik[:L] * 0.7 + fx[:L]), ('wi_ton_ohne_musik', fx[:L])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -2.2)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
