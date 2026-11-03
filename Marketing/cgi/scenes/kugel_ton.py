"""Musik fuer die Krystall Ball Nachtlampe: Dream-Lo-Fi mit Spieluhr-Melodie, Rhodes und Plattenknistern.
   120 BPM, D-Dur (Gmaj7 - A6 - F#m7 - Bm7, Schluss auf D), Drop beim ersten Schnitt, Pause beim Lichtausschalten,
   Leuchten bei 5,5 s mit Glitzern, Klang-Logo bei 12 s.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
D = 14.0; SR = K.SR; BEAT = 0.5; S16 = BEAT / 4; BAR = 2.0
hz = K.hz
CH = {  # Bass, Rhodes-Stimmen
    'Gmaj7': (31, [59, 62, 66, 69]),
    'A6': (33, [61, 64, 66, 69]),
    'F#m7': (30, [57, 61, 64, 69]),
    'Bm7': (35, [62, 66, 69, 71]),
    'D': (38, [62, 66, 69, 76]),
}
PROG = [(0, 2, 'Gmaj7'), (2, 4, 'A6'), (4, 5, 'F#m7'), (5, 6, 'Bm7'), (6, 8, 'Gmaj7'), (8, 10, 'A6'), (10, 11, 'F#m7'), (11, 12, 'Bm7'), (12, 14.0, 'D')]
MUTE = [(5.0, 5.5)]
muted = lambda t: any(a <= t < b for a, b in MUTE)
MEL = {  # (Schritt in 16teln, MIDI, Laenge)
    'A': [(0, 86, 3), (3, 83, 1), (4, 81, 2), (6, 78, 2), (8, 81, 2), (10, 83, 2), (12, 86, 4)],
    'B': [(0, 85, 3), (3, 81, 1), (4, 78, 2), (6, 76, 2), (8, 78, 2), (10, 81, 2), (12, 83, 4)],
    'C': [(0, 81, 2), (2, 85, 2), (4, 88, 2), (6, 86, 2), (8, 85, 2), (10, 81, 2), (12, 78, 4)],
}
ORDER = ['A', 'B', 'C', 'A', 'B', 'C']

mus = K.buf(D + 1.5); drums = K.buf(D + 1.5); kicks = []
for (a, b, c) in PROG:
    bass, vs = CH[c]
    K.put(mus, K.pad([hz(m) for m in vs] + [hz(bass + 24)], (b - a) + 0.4, cut=1500 if a < 1.5 else 2300), a, 0.36)
    # Rhodes: Akkord auf 1, leiser Nachschlag auf "2 und"
    for bt in np.arange(a, b - 1e-6, BAR / 2):
        if muted(bt): continue
        for k, m in enumerate(vs): K.put(mus, K.epiano(hz(m), 0.9, 0.55), bt + k * 0.012, 0.3 if bt >= 1.5 else 0.22, pan=-0.2)
        tt = bt + BEAT * 1.5
        if tt < b and bt >= 1.5 and not muted(tt):
            for m in vs[1:]: K.put(mus, K.epiano(hz(m), 0.35, 0.4), tt, 0.14, pan=0.25)
    if b > 1.5:   # warmer Sub-Bass: Grundton auf 1, kleiner Vorschlag vor der 3
        for st, du in [(0, 6), (7, 1), (8, 6)]:
            tt = a + st * S16
            if 1.5 <= tt < min(b, 12.0) and not muted(tt):
                K.put(mus, mk.bass(hz(bass + 12), S16 * du, cut=300), tt, 1.0)
# Spieluhr-Melodie (im Intro allein), ab 6 s zusaetzlich eine Oktave hoeher ganz leise
for bar, key in enumerate(ORDER):
    t0 = bar * BAR
    for st, m, du in MEL[key]:
        tt = t0 + st * S16
        if tt >= 12.0 or (muted(tt) and tt > 5.02): continue
        K.put(mus, K.spieluhr(hz(m), 1.6, 0.9 if tt >= 1.5 else 0.75), tt, 0.5, pan=0.15)
        if tt >= 6.0: K.put(mus, K.spieluhr(hz(m + 12), 0.9, 0.35), tt + 0.01, 0.16, pan=-0.3)
for k, m in enumerate((74, 78, 81)): K.put(mus, K.spieluhr(hz(m + 12), 2.0, 0.7), 12.0 + k * 0.06, 0.32)

# Lo-Fi-Schlagzeug ab dem Drop (weich, Hats mit leichtem Swing)
for i in range(int(D / S16)):
    tt = i * S16; step = i % 16
    if tt < 1.5 or tt >= 12.0 or muted(tt): continue
    if step in (0, 6, 10): K.put(drums, K.lp(mk.kick(), 2200), tt, 0.85 if step == 0 else 0.6); kicks.append(tt)
    if step in (4, 12): K.put(drums, mk.snare(), tt, 0.22, pan=0.05); K.put(drums, mk.clap(), tt, 0.12)
    if step % 2 == 0: K.put(drums, mk.hat(False), tt + (0.018 if step % 4 == 2 else 0), 0.1 if step % 4 else 0.06, pan=-0.3)
    if 6.0 <= tt < 12.0 and step % 4 == 2: K.put(drums, mk.shaker(), tt + 0.018, 0.07, pan=0.35)
for tt in (5.5, 12.0): K.put(drums, K.lp(mk.kick(), 2400), tt, 1.0); kicks.append(tt)
for k in range(4): K.put(drums, mk.snare(), 11.5 + k * S16, 0.06 + 0.03 * k, pan=0.0)    # kleiner Wirbel in die Endkarte
g = mk.duck(len(mus), kicks, S16, depth=0.35, rel=0.5)
mus *= g[:, None]
mus = np.stack([mk.reverb(mus[:, 0], 2.2, 0.24), mk.reverb(mus[:, 1], 2.3, 0.24)], 1)
crackle = K.vinyl(D + 0.5); K.put(mus, crackle, 0.0, 0.55)
musik = mus + drums
tt = np.arange(len(musik)) / SR
musik *= np.clip((D + 0.6 - tt) / 1.2, 0, 1)[:, None]

# ---------- Geraeusche auf die Bildaktionen ----------
fx = K.buf(D + 1.5)
K.put(fx, K.drop_hit(), 0.0, 0.16)
K.put(fx, K.shimmer(0.9, 40, 3000, 8500), 0.05, 0.22)
K.put(fx, K.shimmer(0.45), 1.3, 0.42); K.put(fx, K.drop_hit(), 1.5, 0.26)
for tt, f in ((1.72, 4200), (2.05, 5100), (2.38, 4600)): K.put(fx, K.ting(f), tt, 0.1, pan=(f - 4600) / 1500)
K.put(fx, K.whoosh(0.42, 350, 3800, 0.45), 2.58, 0.32)
K.put(fx, K.sweep_noise(0.6, 3200, 700, 1.4), 2.84, 0.12)
K.put(fx, K.knock(240, 30, 1.0, 0.7), 3.42, 0.5); K.put(fx, K.clink(2650), 3.42, 0.22); K.put(fx, K.clink(2700), 3.5, 0.07)
K.put(fx, K.slide(0.34), 4.24, 0.3)
K.put(fx, K.click(), 4.6, 0.6); K.put(fx, K.clack(), 4.6, 0.22)
K.put(fx, K.shimmer(0.5, 40), 4.66, 0.26); K.put(fx, K.bell(hz(86), 1.4, 0.4), 4.68, 0.14)
K.put(fx, K.riser(0.5, 500, 4000), 5.0, 0.1)
K.put(fx, K.click(), 5.26, 0.75); K.put(fx, K.clack(), 5.27, 0.28)
K.put(fx, K.shimmer(0.85, 60, 2500, 8500), 5.5, 0.34); K.put(fx, K.drop_hit(), 5.5, 0.22)
for k, m in enumerate((86, 90, 93)): K.put(fx, K.bell(hz(m), 1.2, 0.45), 5.52 + k * 0.08, 0.13, pan=(k - 1) * 0.4)
K.put(fx, K.shimmer(0.5, 30), 6.02, 0.16)
K.put(fx, K.whoosh(0.9, 220, 1900, 0.4), 7.25, 0.16)
K.put(fx, K.whoosh(0.35, 400, 2200), 8.46, 0.12)
K.put(fx, K.whoosh(0.45, 300, 3200, 0.5), 9.56, 0.3); K.put(fx, K.slide(0.3), 9.6, 0.18)
for i in range(4): K.put(fx, K.thud(105 + i * 8), 10.18 + i * 0.05, 0.24, pan=(-0.5, 0.5, 0.2, -0.2)[i])
K.put(fx, K.shimmer(0.7, 50), 10.22, 0.3)
for k, m in enumerate((74, 78, 81, 86)): K.put(fx, K.pop(hz(m - 12)), 11.04 + k * 0.07, 0.34, pan=(-0.4, 0.4, -0.4, 0.4)[k])
K.put(fx, K.shimmer(0.6, 40), 11.12, 0.18)
K.put(fx, K.shimmer(0.45), 11.82, 0.45)
K.soundlogo(fx, 12.04, 0.95)

L = int(D * SR)
os.makedirs(OUT, exist_ok=True)
for name, x in (('kugel_ton_mit_musik', musik[:L] * 0.62 + fx[:L]), ('kugel_ton_ohne_musik', fx[:L]), ('kugel_nur_musik', musik[:L])):
    I, P = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {P:.1f} dBTP')
