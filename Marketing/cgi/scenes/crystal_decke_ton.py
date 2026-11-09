"""Ton fuer "An meiner Decke laeuft was." (Led crystal lampe Holz boden, Schlafzimmer-POV, Loop-Clip: Render 8,4 s,
   Datei 8,0 s, 120 BPM). Dream-Pop: E-Piano mit Glocken-Arpeggio, a-Moll (Am - F - C - G),
   als Schleife von genau 8,0 s (Takt 1 bei Render-Sekunde 0,4). Anfang ruhig, Beat ab dem ersten Schnitt.
   Kein Klang-Logo, kein Schlussakkord. Farbwechsel als leise Tings, draussen leiser Stadtwind.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 8.4; OFF = 0.4; LOOP = 8.0; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(61)

def glas(f, dur=1.2, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t * 3.0) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 7)
         + 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 14))
    return x * np.minimum(1, t / 0.002) * 0.5 * vel

P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'D': (45, [64, 67, 69, 72]), 'Bm': (41, [60, 65, 69, 72]), 'G': (48, [60, 64, 67, 72]), 'A': (43, [62, 67, 71, 74])}
PROG = [(0.0, 3.2, 'D'), (3.2, 4.5, 'Bm'), (4.5, 5.7, 'G'), (5.7, 8.0, 'A')]
for a, b, c in PROG:
    bass, ch = CH[c]
    for k, m in enumerate(ch): K.put(P, mk.reverb(K.epiano(hz(m), b - a + 0.2, 0.5), 2.0, 0.3), a + k * 0.03, 0.22, pan=(k - 1.5) * 0.2)
    K.put(P, K.pad([hz(m) for m in ch], b - a + 0.25, cut=1300 if a < 3.2 else 2600), a, 0.4 if a < 3.2 else 0.48)
    if a >= 2.0:
        for st in np.arange(0, b - a - 0.01, 0.5):
            K.put(P, mk.bass(hz(bass), 0.45, cut=300), a + st, 0.6)
    else:
        K.put(P, mk.bass(hz(bass), 1.9, cut=170), a, 0.45)
# Glas-Arpeggio in Sechzehnteln ab dem Drop, vorher langsame Viertel
for a, b, c in PROG:
    _, ch = CH[c]; notes = [m + 12 for m in ch]
    step = BEAT if a < 3.2 else S16 * 2
    for k, tt in enumerate(np.arange(a, b - 0.01, step)):
        m = notes[k % len(notes)]
        K.put(P, mk.reverb(K.bell(hz(m), 0.9, 0.7 if a < 3.2 else 0.55), 2.2, 0.35), tt, 0.16, pan=(0.3 if k % 2 else -0.3))
for i in range(int(LOOP / S16)):
    tt = i * S16; st = i % 16
    if tt < 3.2: continue
    if st in (0, 6, 8): K.put(dr, mk.kick(), tt, 0.6); kicks.append(tt)
    if st in (4, 12): K.put(dr, K.lp(mk.clap(), 4000), tt, 0.15)
    if st % 2 == 1: K.put(dr, mk.hat(), tt, 0.07, pan=0.25)
K.put(dr, mk.kick(), 3.2, 0.8); kicks.append(3.2)
g = mk.duck(len(P), kicks, S16, depth=0.3, rel=0.4); P *= g[:, None]
P = P + dr
N8 = int(LOOP * SR)
circ = P[:N8].copy(); tail = P[N8:]; circ[:len(tail)] += tail[:N8]
N = int(D * SR)
musik = circ[(np.arange(N) - int(OFF * SR)) % N8]

# ---------- Geraeusche (Render-Zeit) ----------
fx = K.buf(D + 1)
amb = K.lp(rng.normal(0, 1, int((D + 1) * SR)), 200) * 0.05
K.put(fx, amb, 0.0, 1.0)
K.put(fx, K.sweep_noise(D + 0.5, 300, 700, 0.6), 0.0, 0.05)          # Stadtwind draussen, gleichmaessig
for tt, f in ((3.6, 2600), (4.9, 2900), (6.1, 3300), (7.2, 2500)): K.put(fx, K.ting(f), tt, 0.1)   # Farbwechsel
for tt in (3.6, 4.9, 6.1, 7.2): K.put(fx, K.whoosh(0.3, 300, 2200), tt - 0.12, 0.09)
for tt, f in ((0.3, 820), (3.7, 900), (5.0, 700), (6.15, 760), (6.45, 1100), (7.3, 820)): K.put(fx, K.pop(f), tt, 0.18)
os.makedirs(OUT, exist_ok=True)
for name, x in (('decke_ton_mit_musik', musik[:N] * 0.62 + fx[:N]), ('decke_ton_ohne_musik', fx[:N])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -2.2)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
