"""Ton fuer den Gruselfakt-Clip (Wasserspender): Spieluhr in d-Moll bis 2,5 s, die mit einem Klacken abbricht,
   eine halbe Sekunde Stille, dann ab dem Knopfdruck bei 3 s das Wasserspender-Thema (Tropical House, D-Dur,
   Marimba, Tropfen). Klang-Logo bei 12 s. Zwei Mischungen: mit Musik und nur Geraeusche.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
D = 14.0; SR = K.SR; BEAT = 0.5; S16 = BEAT / 4; BAR = 2.0
hz = K.hz
rng = np.random.default_rng(13)

# ---------- 0-2,5 s: Spieluhr in d-Moll, leicht verstimmt, bricht ab ----------
intro = K.buf(D + 1.5)
MB = [(0.0, 81), (0.5, 77), (1.0, 74), (1.25, 76), (1.5, 77), (1.75, 76), (2.0, 73), (2.25, 76)]
for k, (tt, m) in enumerate(MB):
    det = rng.uniform(-0.15, 0.15) - (0.5 if tt >= 2.0 else 0) - (1.0 if tt >= 2.25 else 0)   # zum Schluss sackt sie ab
    x = K.spieluhr(hz(m) * 2 ** (det / 12), 1.8, 0.85)
    if tt + len(x) / SR > 2.5: x = x[:int((2.5 - tt) * SR)] * np.linspace(1, 0.6, int((2.5 - tt) * SR))
    K.put(intro, mk.reverb(x, 2.6, 0.38), tt, 0.55, pan=0.12)
pad = K.pad([hz(50), hz(53), hz(57)], 2.6, cut=900)
K.put(intro, pad, 0.0, 0.32)
drone = mk.sine(hz(38), int(2.5 * SR)) * np.minimum(1, np.arange(int(2.5 * SR)) / SR / 0.4) * 0.3
K.put(intro, drone, 0.0, 0.6)
for tt in (0.5, 0.72, 1.5, 1.72): K.put(intro, K.thud(62), tt, 0.16)   # leiser Herzschlag
i25 = int(2.5 * SR); intro[i25:] *= 0; intro[i25 - 220:i25] *= np.linspace(1, 0, 220)[:, None]

# ---------- ab 3,0 s: Wasserspender-Thema ----------
CH = {
    'D': (38, [66, 69, 74, 76], [62, 66, 69]),
    'A6': (37, [64, 69, 73, 76], [61, 64, 69]),
    'Bm': (35, [66, 69, 71, 74], [62, 66, 71]),
    'G': (31, [66, 71, 74, 79], [62, 67, 71]),
}
PROG = [(3, 5, 'D'), (5, 7, 'A6'), (7, 9, 'Bm'), (9, 11, 'G'), (11, 12, 'A6'), (12, 14.0, 'D')]
HOOK1 = [(0, 81, 2), (2, 78, 2), (4, 81, 1), (5, 83, 2), (7, 81, 1), (8, 78, 2), (10, 76, 2), (12, 74, 2), (14, 76, 2)]
HOOK2 = [(0, 78, 2), (2, 81, 2), (4, 83, 1), (5, 86, 2), (7, 83, 1), (8, 81, 4), (12, 78, 2), (14, 76, 2)]
mus = K.buf(D + 1.5); drums = K.buf(D + 1.5); kicks = []
for (a, b, c) in PROG:
    bass, padv, pl = CH[c]
    K.put(mus, K.pad([hz(m) for m in padv], (b - a) + 0.35, cut=2600), a, 0.42)
    for k in range(int((b - a) / (BEAT / 2))):
        tt = a + k * BEAT / 2
        if k % 2 == 1 and tt < 12.0: K.put(mus, K.pluckchord([hz(m) for m in pl], 0.26, 0.9), tt, 0.5, pan=(0.3 if k % 4 == 1 else -0.3))
    for st, oc in [(0, 0), (3, 12), (6, 0), (8, 0), (11, 12), (14, 0)]:
        tt = a + st * S16
        if tt < min(b, 12.0): K.put(mus, mk.bass(hz(bass + oc), S16 * 2.2, cut=520), tt, 0.95)
for bar in range(5):
    t0 = 3.0 + bar * BAR
    for st, m, du in (HOOK1 if bar % 2 == 0 else HOOK2):
        tt = t0 + st * S16
        if tt >= 12.0: continue
        K.put(mus, K.marimba(hz(m), 0.7, 0.85), tt, 0.6, pan=0.12)
        K.put(mus, K.marimba(hz(m + 12), 0.4, 0.35), tt, 0.25, pan=-0.25)
K.put(mus, K.marimba(hz(74), 1.2, 0.9), 12.0, 0.6); K.put(mus, K.marimba(hz(81), 1.2, 0.6), 12.0, 0.4)
for i in range(int(D / S16)):
    tt = i * S16; step = i % 16
    if tt < 3.0 or tt >= 12.0: continue
    if step % 4 == 0: K.put(drums, mk.kick(), tt, 0.85); kicks.append(tt)
    if step in (4, 12): K.put(drums, mk.clap(), tt, 0.38, pan=0.05)
    if step % 4 == 2: K.put(drums, mk.hat(4.5 <= tt < 8.5), tt, 0.16 if 4.5 <= tt < 8.5 else 0.12, pan=-0.3)
    K.put(drums, mk.shaker(), tt, 0.1 if step % 2 else 0.05, pan=0.35)
for tt in (3.0, 12.0): K.put(drums, mk.kick(), tt, 1.0); kicks.append(tt)
for k in range(8): K.put(drums, mk.clap(), 11.5 + k * S16 * 0.5, 0.12 + 0.03 * k)
PENTA = [86, 88, 90, 93, 95, 98]
for i in range(int(D / S16)):
    tt = i * S16
    if tt < 3.25 or tt >= 12.0: continue
    dense = 4.5 <= tt < 8.3
    if (dense and rng.random() < 0.55) or (not dense and i % 8 == 5 and rng.random() < 0.7):
        K.put(mus, K.plip(hz(rng.choice(PENTA)) * 0.5), tt, 0.22 if dense else 0.16, pan=rng.uniform(-0.6, 0.6))
g = mk.duck(len(mus), kicks, S16, depth=0.45, rel=0.45)
mus *= g[:, None]
mus = np.stack([mk.reverb(mus[:, 0], 1.6, 0.16), mk.reverb(mus[:, 1], 1.7, 0.16)], 1)
musik = intro + mus + drums
tt = np.arange(len(musik)) / SR
musik *= np.clip((D + 0.6 - tt) / 1.2, 0, 1)[:, None]

# ---------- Geraeusche ----------
fx = K.buf(D + 1.5)
K.put(fx, K.drop_hit(), 0.0, 0.12)
K.put(fx, K.sweep_noise(1.2, 220, 120, 1.1), 1.25, 0.18)            # Plastik knarzt beim Kippen
for tt, f in ((1.42, 190), (1.78, 165), (2.12, 210), (2.38, 175)): K.put(fx, K.plip(f), tt, 0.55)   # Gluckern in Zeitlupe
K.put(fx, K.lp(K.pour(1.2, 300, 700), 1800), 1.3, 0.3)
for tt in (1.55, 1.95, 2.32): K.put(fx, K.lp(K.bubbles(0.35, 6), 2200), tt, 0.3)
K.put(fx, K.clack(), 2.5, 0.5); K.put(fx, K.knock(320, 40, 0.0, 0.5), 2.5, 0.25)   # Spieluhr bricht ab
K.put(fx, K.drop_hit(), 3.0, 0.3)
K.put(fx, K.click(), 3.04, 0.65); K.put(fx, K.beep(1760), 3.08, 0.45); K.put(fx, K.beep(2350, 0.09), 3.22, 0.32)
K.put(fx, K.shimmer(0.6, 50), 3.07, 0.34)
K.put(fx, K.hum(5.1, 118), 3.3, 0.26)
K.put(fx, K.hp(K.pour(5.0, 700, 2300), 450), 3.38, 0.24)
K.put(fx, K.whoosh(0.35, 400, 2200), 4.48, 0.12); K.put(fx, K.whoosh(0.35, 400, 2200), 6.48, 0.12)
K.put(fx, K.beep(2350, 0.08), 8.32, 0.32); K.put(fx, K.bubbles(0.4, 5), 8.35, 0.22)
K.put(fx, K.whoosh(0.35, 300, 2000), 8.47, 0.14); K.put(fx, K.whoosh(0.35, 300, 2000), 9.72, 0.14)
for i, m in enumerate((69, 76)): K.put(fx, K.pop(hz(m - 12)), 11.35 + i * 0.1, 0.4, pan=(i - 0.5))
K.put(fx, K.shimmer(0.6, 50), 11.15, 0.22)
K.put(fx, K.shimmer(0.45), 11.82, 0.45)
K.soundlogo(fx, 12.04, 0.95)

L = int(D * SR)
os.makedirs(OUT, exist_ok=True)
for name, x in (('grusel_ton_mit_musik', musik[:L] * 0.62 + fx[:L]), ('grusel_ton_ohne_musik', fx[:L]), ('grusel_nur_musik', musik[:L])):
    I, P = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {P:.1f} dBTP')
