"""Ton fuer "7:12 Uhr. Frühstück fährt mit." (Mixer Rosa im Pendlerzug, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Musik: morgendlicher Lo-Fi in D-Dur (D - Bm - G - A), E-Piano auf Viertel-Synkopen, weiche Pluck-Melodie,
   Beat ab Datei 2,4 s (erster Schnitt), als Schleife von genau 8,0 s (Takt 1 bei Render-Sekunde 0,4).
   A-Dur am Ende fuehrt zurueck nach D (Loop). Kein Klang-Logo, kein Schlussakkord.
   Geraeusche: Mixer-Motor durchgehend, Schienenstoesse im Takt (ta-tamm), Zugrauschen tief, Pops auf den Texten.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 8.4; OFF = 0.4; LOOP = 8.0; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(1110)

P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'D': (38, [62, 66, 69, 74]), 'Bm': (35, [62, 66, 71, 74]), 'G': (43, [62, 67, 71, 74]), 'A': (45, [61, 64, 69, 73])}
PROG = [(0.0, 2.0, 'D'), (2.0, 4.0, 'Bm'), (4.0, 6.0, 'G'), (6.0, 8.0, 'A')]
DROP = 2.4
for a, b, c in PROG:
    bass, ch = CH[c]
    for st, vel in ((0.0, 1.0), (0.75, 0.55), (1.25, 0.7)):
        for m in ch: K.put(P, mk.reverb(K.epiano(hz(m), 0.6, 0.5 * vel), 1.6, 0.25), a + st, 0.15, pan=((m % 5) - 2) * 0.1)
    K.put(P, K.pad([hz(m) for m in ch], b - a + 0.25, cut=1800), a, 0.18)
    for st in ((0.0, 1.0) if a < DROP else (0.0, 0.75, 1.0, 1.5)): K.put(P, mk.bass(hz(bass), 0.4, cut=300), a + st, 0.5)
MEL = [(0.0, 78), (0.5, 81), (1.0, 78), (1.5, 76), (2.5, 74), (3.0, 78), (3.5, 74), (4.0, 79), (4.5, 83), (5.0, 81), (5.5, 79), (6.5, 76), (7.0, 78), (7.5, 81)]
for tt, m in MEL: K.put(P, mk.reverb(mk.pluck(hz(m), 0.5, cut=4200), 1.6, 0.3), tt, 0.16, pan=0.2)
for i in range(int(LOOP / S16)):
    tt = i * S16; st = i % 16
    if tt < DROP: continue
    if st in (0, 6, 8, 14): K.put(dr, mk.kick(), tt, 0.48); kicks.append(tt)
    if st in (4, 12): K.put(dr, mk.snare(), tt, 0.12)
    if st % 2 == 0: K.put(dr, mk.hat(st % 8 == 6), tt, 0.05, pan=0.25)
g = mk.duck(len(P), kicks, S16, depth=0.22, rel=0.4); P *= g[:, None]
P = P + dr
N8 = int(LOOP * SR)
circ = P[:N8].copy(); tail = P[N8:]; circ[:len(tail)] += tail[:N8]
N = int(D * SR)
musik = circ[(np.arange(N) - int(OFF * SR)) % N8]

# ---------- Geraeusche (als 8-s-Schleife, damit die Naht nicht hoerbar ist) ----------
fxl = K.buf(LOOP + 2)
mot = K.motor(12.0, up=0.3, down=0.3, f_run=165)
K.put(fxl, mot[int(1.5 * SR): int(1.5 * SR) + N8], 0.0, 0.28)
K.put(fxl, K.lp(rng.normal(0, 1, N8), 260) * 0.06, 0.0, 1.0)          # Zugrauschen tief
for tt in np.arange(0.0, LOOP, 1.0):                                    # Schienenstoesse: ta-tamm
    K.put(fxl, K.thud(70), tt, 0.16); K.put(fxl, K.thud(62), tt + 0.18, 0.12)
fl = fxl[:N8].copy(); tl = fxl[N8:]; fl[:len(tl)] += tl[:N8]
fx = fl[(np.arange(N) - int(OFF * SR)) % N8].copy()
ev = K.buf(D + 1)
for tt in (2.8, 4.6, 5.9, 7.1): K.put(ev, K.whoosh(0.3, 300, 2400), tt - 0.12, 0.07)
for tt, f in ((3.62, 820), (4.7, 900), (5.95, 760), (6.25, 1100)): K.put(ev, K.pop(f), tt, 0.18)
fx = fx + ev[:N]
os.makedirs(OUT, exist_ok=True)
for name, x in (('zug_ton_mit_musik', musik[:N] * 0.6 + fx[:N]), ('zug_ton_ohne_musik', fx[:N])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -2.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
