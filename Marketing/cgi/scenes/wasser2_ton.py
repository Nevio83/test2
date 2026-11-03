"""Neue Musik fuer den Wasserspender (Fassung 2): helles Tropical-House mit Marimba-Hook und Wassertropfen.
   120 BPM, D-Dur (I - V6 - vi - IV), Drop beim ersten Schnitt, Pause vor dem Piepton, Klang-Logo bei 12 s.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
D = 14.0; SR = K.SR; BEAT = 0.5; S16 = BEAT / 4; BAR = 2.0
hz = K.hz
CH = {  # Bass, Flaeche (ohne Grundton), Pluck-Stimmen
    'D': (38, [66, 69, 74, 76], [62, 66, 69]),
    'A6': (37, [64, 69, 73, 76], [61, 64, 69]),
    'Bm': (35, [66, 69, 71, 74], [62, 66, 71]),
    'G': (31, [66, 71, 74, 79], [62, 67, 71]),
}
PROG = [(0, 2, 'D'), (2, 4, 'A6'), (4, 6, 'Bm'), (6, 8, 'G'), (8, 10, 'D'), (10, 11, 'A6'), (11, 12, 'G'), (12, 14.0, 'D')]
MUTE = [(5.0, 5.5)]
muted = lambda t: any(a <= t < b for a, b in MUTE)
HOOK1 = [(0, 81, 2), (2, 78, 2), (4, 81, 1), (5, 83, 2), (7, 81, 1), (8, 78, 2), (10, 76, 2), (12, 74, 2), (14, 76, 2)]
HOOK2 = [(0, 78, 2), (2, 81, 2), (4, 83, 1), (5, 86, 2), (7, 83, 1), (8, 81, 4), (12, 78, 2), (14, 76, 2)]

mus = K.buf(D + 1.5); drums = K.buf(D + 1.5); kicks = []
for (a, b, c) in PROG:
    bass, pad, pl = CH[c]
    K.put(mus, K.pad([hz(m) for m in pad], (b - a) + 0.35, cut=1800 if a < 1.5 else 2600), a, 0.42)
    if b > 1.5:   # Off-Beat-Plucks (Tropical House)
        for k in range(int((b - a) / (BEAT / 2))):
            tt = a + k * BEAT / 2
            if k % 2 == 1 and tt >= 1.5 and tt < 12.0 and not muted(tt):
                K.put(mus, K.pluckchord([hz(m) for m in pl], 0.26, 0.9), tt, 0.5, pan=(0.3 if k % 4 == 1 else -0.3))
        for st, oc in [(0, 0), (3, 12), (6, 0), (8, 0), (11, 12), (14, 0)]:   # Bass mit Oktavspruengen
            tt = a + st * S16
            if 1.5 <= tt < min(b, 12.0) and not muted(tt):
                K.put(mus, mk.bass(hz(bass + oc), S16 * 2.2, cut=520), tt, 0.95)
# Marimba-Hook (ab 0 s, im Intro leiser)
for bar in range(6):
    t0 = bar * BAR
    for st, m, du in (HOOK1 if bar % 2 == 0 else HOOK2):
        tt = t0 + st * S16
        if tt >= 12.0 or muted(tt): continue
        v = 0.55 if tt < 1.5 else 0.85
        K.put(mus, K.marimba(hz(m), 0.7, v), tt, 0.6, pan=0.12)
        if tt >= 1.5: K.put(mus, K.marimba(hz(m + 12), 0.4, 0.35), tt, 0.25, pan=-0.25)
# Schlusston
K.put(mus, K.marimba(hz(74), 1.2, 0.9), 12.0, 0.6); K.put(mus, K.marimba(hz(81), 1.2, 0.6), 12.0, 0.4)

# Schlagzeug
for i in range(int(D / S16)):
    tt = i * S16; step = i % 16
    if tt < 1.5 or tt >= 12.0 or muted(tt): continue
    if step % 4 == 0: K.put(drums, mk.kick(), tt, 0.85); kicks.append(tt)
    if step in (4, 12): K.put(drums, mk.clap(), tt, 0.38, pan=0.05)
    if step % 4 == 2: K.put(drums, mk.hat(6.0 <= tt < 8.5), tt, 0.17 if 6.0 <= tt < 8.5 else 0.12, pan=-0.3)
    K.put(drums, mk.shaker(), tt, 0.1 if step % 2 else 0.05, pan=0.35)
for tt in (5.5, 12.0): K.put(drums, mk.kick(), tt, 1.0); kicks.append(tt)
for k in range(8): K.put(drums, mk.clap(), 11.5 + k * S16 / 1.0 * 0.5, 0.12 + 0.03 * k, pan=0.0)   # kleiner Wirbel in die Endkarte
# Wassertropfen-Percussion (Pentatonik), dichter waehrend das Glas laeuft
rng = np.random.default_rng(3); PENTA = [86, 88, 90, 93, 95, 98]
for i in range(int(D / S16)):
    tt = i * S16
    if tt < 0.25 or tt >= 12.0 or muted(tt): continue
    dense = 6.25 <= tt < 8.5
    if (dense and rng.random() < 0.55) or (not dense and i % 8 == 5 and rng.random() < 0.7):
        K.put(mus, K.plip(hz(rng.choice(PENTA)) * 0.5), tt, 0.22 if dense else 0.16, pan=rng.uniform(-0.6, 0.6))
g = mk.duck(len(mus), kicks, S16, depth=0.45, rel=0.45)
mus *= g[:, None]
mus = np.stack([mk.reverb(mus[:, 0], 1.6, 0.16), mk.reverb(mus[:, 1], 1.7, 0.16)], 1)
musik = mus + drums
tt = np.arange(len(musik)) / SR
musik *= np.clip((D + 0.6 - tt) / 1.2, 0, 1)[:, None]

# ---------- Geraeusche (wie Fassung 1, auf die Bildaktionen) ----------
fx = K.buf(D + 1.5)
K.put(fx, K.drop_hit(), 0.0, 0.25)
K.put(fx, K.shimmer(0.7, 45, 3000, 8000), 0.04, 0.25)
K.put(fx, K.hp(K.pour(1.55, 900, 1900), 500), 0.0, 0.16)
K.put(fx, K.riser(1.2, 600, 7000), 0.3, 0.14)
K.put(fx, K.shimmer(0.45), 1.3, 0.45)
K.put(fx, K.drop_hit(), 1.5, 0.3)
K.put(fx, K.whoosh(0.6, 300, 4200, 0.45), 1.9, 0.45)
for i, x in enumerate([-1.6, -0.9, -0.2, 0.6, 1.4, -1.25, 1.1, -0.4, 0.35, 1.7, -1.8]):
    t1 = 1.95 + 0.5 * ((x + 2) / 4 * 3.2) / 4.2
    for k in range(2): K.put(fx, K.plastic_hit(1400 + 300 * ((i * 7) % 5)), t1 + k * 0.07 + 0.02 * (i % 3), 0.28 - k * 0.1, pan=x / 2.2)
K.put(fx, K.pop(hz(69)), 2.4, 0.35); K.put(fx, K.shimmer(0.5, 40), 2.35, 0.22)
K.put(fx, K.slide(0.85), 2.9, 0.45)
K.put(fx, K.bubbles(0.55, 8), 3.35, 0.4)
K.put(fx, K.whoosh(0.4, 400, 1800), 4.1, 0.14)
K.put(fx, K.clink(3100), 4.55, 0.42); K.put(fx, K.clink(3150), 4.66, 0.1)
K.put(fx, K.riser(0.5, 800, 5000), 5.0, 0.18)
K.put(fx, K.click(), 5.47, 0.6); K.put(fx, K.beep(1760), 5.5, 0.5); K.put(fx, K.beep(2350, 0.09), 5.64, 0.38)
K.put(fx, K.hum(2.2), 6.3, 0.3)
K.put(fx, K.hp(K.pour(2.15, 700, 2300), 450), 6.38, 0.34)
K.put(fx, K.beep(2350, 0.08), 8.42, 0.32)
K.put(fx, K.bubbles(0.4, 5), 8.45, 0.22)
K.put(fx, K.whoosh(0.35, 500, 2500), 8.55, 0.14)
K.put(fx, K.clack(), 8.95, 0.32)
for k, m in enumerate((76, 81, 85)): K.put(fx, K.bell(hz(m), 0.9, 0.5), 9.02 + k * 0.08, 0.3)
K.put(fx, K.whoosh(0.35, 300, 2000), 9.42, 0.14); K.put(fx, K.whoosh(0.35, 300, 2000), 10.17, 0.14)
for i, m in enumerate((69, 76)): K.put(fx, K.pop(hz(m - 12)), 11.35 + i * 0.1, 0.4, pan=(i - 0.5))
K.put(fx, K.shimmer(0.6, 50), 11.15, 0.22)
K.put(fx, K.shimmer(0.45), 11.82, 0.45)
K.soundlogo(fx, 12.04, 0.95)

L = int(D * SR)
os.makedirs(OUT, exist_ok=True)
for name, x in (('ws2_ton_mit_musik', musik[:L] * 0.6 + fx[:L]), ('ws2_ton_ohne_musik', fx[:L]), ('ws2_nur_musik', musik[:L])):
    I, P = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {P:.1f} dBTP')
