"""Ton Nachtlicht-Story (20,5 s, kein Loop, 120 BPM, a-Moll Lo-Fi, Nachtstimmung). Schleppend bis 5,0 s, dann Beat.
   Musik: Am7 - Fmaj7 - Cmaj7 - G6, E-Piano + Bass; bis zur Idee nur schleppender Bass. Kein Klang-Logo, kein Schlussakkord.
   Geraeusche: Schritte (0-2,6), Stolpern (3,4-3,8), Idee (5,0), Explosion (8,2), Callouts, Schritte auf der Treppe (11-16), Licht an (11,7 / 14,4), Preis.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 20.5; OFF = 0.0; LOOP = 20.5; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(2525)


P = K.buf(D + 4); dr = K.buf(D + 4); kicks = []
CH = {'Am': (33, [57, 60, 64, 67]), 'F': (29, [57, 60, 64, 65]), 'C': (36, [59, 60, 64, 67]), 'G': (31, [59, 62, 64, 67])}
DROP = 5.0
names = ['Am', 'F', 'C', 'G']
for n in range(11):
    a = n * 2.0; c = names[n % 4]; bass, ch = CH[c]
    if a >= D: break
    K.put(P, mk.pad([hz(m) for m in ch], 2.1, cut=1700), a, 0.09)
    for st, ln, vel in ((0.0, 1.2, 0.6), (1.25, 0.55, 0.42)):
        for k, m in enumerate(ch): K.put(P, mk.reverb(K.epiano(hz(m), ln, vel), 1.8, 0.28), a + st + k * 0.02, 0.24, pan=(k - 1.5) * 0.25)
    K.put(P, mk.bass(hz(bass), 1.5 if a < DROP else 0.9, cut=250), a, 0.62)
    if a >= DROP - 0.3: K.put(P, mk.bass(hz(bass), 0.5, cut=250), a + 1.0, 0.5)
MEL = [(0.0, 69), (0.5, 72), (1.0, 76), (1.5, 72), (2.0, 74), (2.5, 76), (3.0, 79), (3.5, 81),
       (4.0, 79), (4.5, 76), (5.0, 74), (5.5, 72), (6.0, 71), (6.5, 74), (7.0, 79), (7.5, 74)]
for rep in range(3):
    for tt, m in MEL:
        t2 = rep * 8.0 + tt
        if t2 >= DROP - 0.5 and t2 < D - 0.8: K.put(P, mk.reverb(K.epiano(hz(m + 12), 0.5, 0.55), 1.6, 0.3), t2, 0.2, pan=0.15)
for i in range(int(D / S16)):
    tt = i * S16; st = i % 16
    if tt < DROP:
        if st in (0, 8): K.put(dr, mk.kick(), tt, 0.45); kicks.append(tt)
        continue
    if tt > 18.0: 
        if st in (0, 8): K.put(dr, mk.kick(), tt, 0.5); kicks.append(tt)
        continue
    if st in (0, 7, 10): K.put(dr, mk.kick(), tt, 0.62); kicks.append(tt)
    if st in (4, 12): K.put(dr, mk.snare(), tt, 0.16)
    if st % 2 == 0: K.put(dr, mk.hat(st % 8 == 6), tt, 0.07, pan=0.25)
g = mk.duck(len(P), kicks, S16, depth=0.3, rel=0.45); P *= g[:, None]
P = P + dr
vin = K.vinyl(D + 4, density=6.0)
P[:len(vin), 0] += vin * 0.4; P[:len(vin), 1] += vin * 0.4
N = int(D * SR)
musik = P[:N].copy()
fade = np.minimum(1, (D - np.arange(N) / SR) / 0.8)[:, None]; musik *= fade

fx = K.buf(D + 1)
def wasser(dur, gain=1.0, lo=500, hi=5500):
    n = int(dur * SR); x = K.bp(rng.normal(0, 1, n), lo, hi) * 0.3
    for _ in range(int(dur * 30)):
        i = int(rng.uniform(0, n - 500)); m = 200 + int(rng.uniform(0, 300))
        x[i:i + m] += K.bp(rng.normal(0, 1, m), 1200, 6500) * np.exp(-np.linspace(0, 14, m)) * rng.uniform(0.15, 0.5)
    env = np.minimum(1, np.minimum(np.arange(n) / (0.12 * SR), (n - np.arange(n)) / (0.2 * SR)))
    return K.lp(x, 6500) * env * gain
K.put(fx, K.lp(rng.normal(0, 1, int((D + 1) * SR)), 180) * 0.03, 0.0, 1.0)
for tt in np.arange(0.15, 2.6, 0.3): K.put(fx, K.pop(140 + int(rng.uniform(0, 40))), tt, 0.07)   # Schritte der Menge
K.put(fx, K.whoosh(0.3, 250, 1400), 2.6, 0.08)
K.put(fx, K.whoosh(0.25, 400, 1600), 3.3, 0.1); K.put(fx, K.thud(85), 3.65, 0.4); K.put(fx, K.pop(300), 3.75, 0.18)   # Stolpern + Kreuz
K.put(fx, K.whoosh(0.4, 300, 2000), 4.8, 0.1); K.put(fx, K.shimmer(0.6), 5.0, 0.16)       # Idee
for tt in (5.1, 7.7, 8.9, 9.5): K.put(fx, K.pop(900 + int(tt * 20)), tt, 0.16)          # Tags, Callouts
K.put(fx, K.whoosh(0.5, 200, 2500), 8.0, 0.12)                                           # Explosion
K.put(fx, K.whoosh(0.4, 300, 1800), 11.0, 0.1)
for tt in np.arange(11.15, 16.1, 0.375): K.put(fx, K.knock(170, 34, 0.2, 0.6), tt, 0.12)   # Schritte auf Holzstufen
K.put(fx, K.shimmer(0.5, 50, 1800, 6000), 11.7, 0.12); K.put(fx, K.shimmer(0.5, 50, 1800, 6000), 14.4, 0.12)   # Licht geht an
K.put(fx, K.pop(700), 15.0, 0.2)                                                          # Haken
K.put(fx, K.whoosh(0.4, 300, 1800), 16.1, 0.1); K.put(fx, K.pop(1100), 16.3, 0.2); K.put(fx, K.shimmer(0.7), 16.4, 0.14)  # Preis
K.put(fx, K.pop(900), 17.4, 0.16)                                                          # CTA
L = N
os.makedirs(OUT, exist_ok=True)
for name, x in (('ns_ton_mit_musik', musik[:L] * 0.7 + fx[:L]), ('ns_ton_ohne_musik', fx[:L])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -2.2)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
