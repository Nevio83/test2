"""Ton fuer das Mixer-CGI-Video (14 s, 120 BPM). Erzeugt Musik, Geraeusche und zwei Mischungen.
   python3 scenes/mixer_ton.py out/
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
D = 14.0; BPM = 120; BEAT = 60 / BPM; S16 = BEAT / 4
SR = K.SR

# ---------- Musik ----------
CH = {  # Akkorde: (Bass, Stimmen) in MIDI
    'D': (38, [66, 69, 73, 76]), 'Bm': (35, [62, 66, 69, 73]), 'G': (31, [59, 62, 66, 69]), 'A': (33, [61, 66, 71, 76]),
}
PROG = [(0, 2, 'D'), (2, 4, 'Bm'), (4, 6, 'G'), (6, 8, 'A'), (8, 10, 'D'), (10, 11, 'G'), (11, 12, 'A'), (12, 14.0, 'D')]
mus = K.buf(D + 1.5); drums = K.buf(D + 1.5)
kicks = []

# Flaechen + E-Piano
for (a, b, c) in PROG:
    bass, vs = CH[c]
    K.put(mus, K.pad([K.hz(m) for m in vs] + [K.hz(bass + 12)], (b - a) + 0.4, cut=2200 if a < 1.5 else 3000), a, 0.55)
    if a < 1.5:  # Intro: weiche Arpeggios
        for k in range(int((min(b, 1.5) - a) / (BEAT / 2))):
            m = vs[k % 4] + (12 if k % 8 >= 4 else 0)
            K.put(mus, K.epiano(K.hz(m), 0.9, 0.6), a + k * BEAT / 2, 0.75, pan=(-0.4 if k % 2 else 0.4))
    else:
        for bt in np.arange(a, b - 1e-6, BEAT * 2):   # Akkord auf 1 und 3, Stabs auf "und"
            for m in vs: K.put(mus, K.epiano(K.hz(m), 0.8, 0.7), bt, 0.32, pan=-0.15)
            for off in (BEAT * 1.5,):
                if bt + off < b and not (5.75 <= bt + off < 6.25):
                    for m in vs: K.put(mus, K.epiano(K.hz(m + 12), 0.35, 0.5), bt + off, 0.2, pan=0.25)
    # Bass ab dem Drop
    if b > 1.5:
        for st in [0, 3, 6, 8, 11]:
            tt = a + st * S16
            if 1.5 <= tt < min(b, 12.0) and not (5.75 <= tt < 6.25):
                K.put(mus, mk.bass(K.hz(bass), S16 * 2.6, cut=420), tt, 0.95)

# Schlagzeug: ab 1.5 s (Schnitt auf das Obst), Pause beim Umdrehen, Ende bei 12 s
for i in range(int(D / S16)):
    tt = i * S16
    if tt < 1.5 or tt >= 12.0 or 5.75 <= tt < 6.25: continue
    step = i % 16
    if step % 4 == 0: K.put(drums, mk.kick(), tt, 0.9); kicks.append(tt)
    if step in (4, 12): K.put(drums, mk.clap(), tt, 0.42, pan=0.05)
    K.put(drums, mk.shaker(), tt, 0.12 if step % 2 else 0.07, pan=0.35)
    if 7.25 <= tt < 9.25 and step % 4 == 2: K.put(drums, mk.hat(True), tt, 0.16, pan=-0.3)
K.put(drums, mk.kick(), 12.0, 1.0); kicks.append(12.0)
K.put(drums, mk.kick(), 6.25, 1.0); kicks.append(6.25)
# Sidechain auf die Musik
g = mk.duck(len(mus), kicks, S16, depth=0.5, rel=0.5)
mus *= g[:, None]
mus = np.stack([mk.reverb(mus[:, 0], 1.8, 0.18), mk.reverb(mus[:, 1], 1.9, 0.18)], 1)
musik = mus + drums
# sanft ausblenden
n = len(musik); tt = np.arange(n) / SR
musik *= np.clip((D + 0.6 - tt) / 1.2, 0, 1)[:, None]

# ---------- Geraeusche ----------
fx = K.buf(D + 1.5)
K.put(fx, K.drop_hit(), 0.0, 0.32)
K.put(fx, K.shimmer(0.7, 45, 3000, 8000), 0.04, 0.3)
K.put(fx, K.riser(1.3, 500, 7000), 0.2, 0.18)
K.put(fx, K.shimmer(0.45), 1.3, 0.5)                         # Lichtstreif
K.put(fx, K.drop_hit(), 1.5, 0.35)
for i in range(7):                                           # Erdbeeren
    imp = 1.52 + i * 0.085 + 0.32
    K.put(fx, K.knock(240 + 25 * ((i * 3) % 5), 30, 1.0, 1.0), imp, 0.55 - i * 0.03, pan=((i % 3) - 1) * 0.3)
K.put(fx, K.whoosh(0.5, 2500, 300, 0.2), 2.42, 0.22)         # Zeitlupe-Einstieg
for i in range(5):                                           # Bananen (Zeitlupe)
    K.put(fx, K.thud(90 + 12 * i), 2.5 + i * 0.14 + 0.62, 0.42, pan=(i % 2) * 0.3 - 0.15)
K.put(fx, K.pour(1.15), 3.52, 0.42)                          # Milch
K.put(fx, K.whoosh(0.45, 300, 1800), 4.62, 0.2)              # Sockel kommt
K.put(fx, K.ratchet([0.0, 0.11, 0.21, 0.3, 0.38, 0.45, 0.51, 0.56]), 4.95, 0.5)
K.put(fx, K.clack(), 5.52, 0.55)
K.put(fx, K.whoosh(0.5, 220, 3400, 0.55), 5.74, 0.75)        # Umdrehen
K.put(fx, K.thud(80), 6.19, 0.5)
K.put(fx, K.click(), 6.58, 0.9)                              # Knopf
K.put(fx, K.powerup(0.5), 6.63, 0.45)
K.put(fx, K.ting(2600), 6.64, 0.35)
K.put(fx, K.lp(K.motor(2.0, 0.32, 0.28), 3800), 7.26, 0.42)    # Mixen
K.put(fx, K.whoosh(0.6, 400, 2200, 0.7), 9.25, 0.25)        # Anheben
K.put(fx, K.ting(3100), 9.32, 0.3, pan=-0.3)
for i, m in enumerate((74, 78, 81)):                         # drei Flaschen
    K.put(fx, K.pop(K.hz(m - 12)), 10.62 + i * 0.09, 0.45, pan=(i - 1) * 0.5)
K.put(fx, K.shimmer(0.6, 50), 10.45, 0.25)                   # Siegel
K.put(fx, K.shimmer(0.45), 11.82, 0.5)                       # Lichtstreif
K.soundlogo(fx, 12.04, 0.95)                                 # Klang-Logo

L = int(D * SR)
mix_m = musik[:L] * 0.55 + fx[:L] * 1.0
mix_o = fx[:L] * 1.0                                          # ohne Musik (fuer TikTok-Bibliothek)
os.makedirs(OUT, exist_ok=True)
for name, x in (('ton_mit_musik', mix_m), ('ton_ohne_musik', mix_o)):
    I, P = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {P:.1f} dBTP')
