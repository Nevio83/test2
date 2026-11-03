"""Ton fuer "Gruselfakt um Mitternacht" (Wasserspender, 9 s, 120 BPM): Uhr tickt im dunklen Zimmer, tiefer Drone,
   Herzschlag; Knopf klickt bei 2,35 s von allein -> dunkler E-Piano-Beat in d-Moll (Dm - Bb - Gm - A) mit Wasser;
   Licht flackert an bei 6,7 s -> Wechsel nach D-Dur, Klang-Logo bei 8,0 s. Zwei Mischungen: mit Musik und nur Geraeusche.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
D = 9.0; SR = K.SR; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(27)
PRESS, W0, W1, ON = 2.35, 2.5, 6.35, 6.9

# ---------- Musik ----------
mus = K.buf(D + 2); drums = K.buf(D + 2); kicks = []
# 0-2,35 s: Drone + Glocke, sehr leise
drone = mk.sine(hz(38), int(2.6 * SR)) * np.minimum(1, np.arange(int(2.6 * SR)) / SR / 0.3) * 0.35
K.put(mus, drone, 0.0, 0.7)
K.put(mus, K.pad([hz(50), hz(57), hz(62)], 2.5, cut=700), 0.0, 0.35)
K.put(mus, mk.reverb(K.bell(hz(74), 2.0, 0.5), 2.8, 0.45), 0.05, 0.35, pan=-0.2)
K.put(mus, mk.reverb(K.bell(hz(77), 2.0, 0.4), 2.8, 0.45), 1.05, 0.3, pan=0.2)
# 2,35-6,9 s: dunkler Beat, d-Moll
CH = {'Dm': (38, [62, 65, 69, 72]), 'Bb': (34, [62, 65, 70, 74]), 'Gm': (31, [62, 67, 70, 74]), 'A': (33, [61, 64, 69, 73])}
PROG = [(2.35, 3.5, 'Dm'), (3.5, 4.5, 'Bb'), (4.5, 5.5, 'Gm'), (5.5, 6.72, 'A')]
for a, b, c in PROG:
    bass, ch = CH[c]
    for k, m in enumerate(ch): K.put(mus, mk.reverb(K.epiano(hz(m), b - a + 0.2, 0.7), 1.8, 0.25), a + k * 0.02, 0.32, pan=(k - 1.5) * 0.2)
    K.put(mus, mk.bass(hz(bass), b - a, cut=300), a, 0.9)
    for st in (6, 10):
        tt = a + st * S16
        if tt < b: K.put(mus, mk.bass(hz(bass + 12), S16 * 1.6, cut=500), tt, 0.5)
MEL = [(2.85, 81), (3.1, 77), (3.35, 76), (3.85, 74), (4.35, 77), (4.6, 81), (4.85, 82), (5.35, 79), (5.85, 76), (6.1, 73), (6.35, 76)]
for tt, m in MEL: K.put(mus, mk.reverb(K.bell(hz(m), 1.2, 0.6), 2.0, 0.35), tt, 0.26, pan=0.15)
for i in range(int(D / S16)):
    tt = i * S16; st = i % 16
    if tt < PRESS or tt >= 6.72: continue
    if st in (0, 7, 10): K.put(drums, mk.kick(), tt, 0.8); kicks.append(tt)
    if st in (4, 12): K.put(drums, mk.clap(), tt, 0.32)
    K.put(drums, mk.hat(False), tt, 0.09 if st % 2 else 0.13, pan=-0.25)
# Licht an: D-Dur, heller Akkord + Klang-Logo
K.put(drums, mk.kick(), ON, 1.0); kicks.append(ON)
K.put(mus, K.pad([hz(50), hz(57), hz(62), hz(66), hz(69)], 2.0, cut=2400), ON, 0.5)
for k, m in enumerate((62, 66, 69, 74)): K.put(mus, mk.reverb(K.epiano(hz(m), 1.4, 0.8), 2.0, 0.3), ON + k * 0.03, 0.34)
K.put(mus, mk.bass(hz(38), 1.1, cut=320), ON, 0.9)
g = mk.duck(len(mus), kicks, S16, depth=0.4, rel=0.4); mus *= g[:, None]
musik = mus + drums
tt = np.arange(len(musik)) / SR
musik *= np.clip((D + 0.4 - tt) / 1.0, 0, 1)[:, None]

# ---------- Geraeusche ----------
fx = K.buf(D + 2)
for k in range(5): K.put(fx, K.knock(2400 if k % 2 == 0 else 2100, 90, 0.0, 0.7), 0.1 + k * 0.5, 0.18, pan=0.4)   # Uhr tickt
for tt in (0.55, 0.75, 1.55, 1.75): K.put(fx, K.thud(60), tt, 0.14)                                        # Herzschlag
K.put(fx, K.whoosh(0.3, 300, 1800), 1.68, 0.12)
K.put(fx, K.click(), PRESS, 0.75); K.put(fx, K.beep(1760), PRESS + 0.04, 0.4)                                  # Knopf geht von allein
K.put(fx, K.shimmer(0.5, 40), PRESS + 0.03, 0.3)
K.put(fx, K.hum(W1 - W0 + 0.1, 118), W0, 0.22)
K.put(fx, K.hp(K.pour(W1 - W0, 700, 2200), 450), W0 + 0.05, 0.26)
for tt in (2.62, 2.9, 3.3): K.put(fx, K.plip(rng.uniform(500, 900)), tt, 0.35)
K.put(fx, K.whoosh(0.35, 400, 2200), 3.08, 0.12); K.put(fx, K.whoosh(0.35, 400, 2200), 4.88, 0.12)
K.put(fx, K.lp(K.bubbles(0.5, 6), 2500), 5.6, 0.25)
K.put(fx, K.beep(2350, 0.08), W1, 0.3)
for tt in (6.72, 6.9): K.put(fx, K.click(), tt, 0.5)                                                           # Lichtschalter flackert
K.put(fx, K.sweep_noise(0.12, 3000, 6000, 1.0), 6.72, 0.08)
K.put(fx, K.whoosh(0.3, 300, 2000), 7.88, 0.12)
K.soundlogo(fx, 8.0, 0.9)

L = int(D * SR)
os.makedirs(OUT, exist_ok=True)
for name, x in (('nacht_ton_mit_musik', musik[:L] * 0.6 + fx[:L]), ('nacht_ton_ohne_musik', fx[:L])):
    I, P = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {P:.1f} dBTP')
