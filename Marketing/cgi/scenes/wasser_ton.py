"""Ton fuer das Wasserspender-CGI-Video (14 s, 120 BPM)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
D = 14.0; SR = K.SR
CH = {'A': (33, [61, 64, 68, 71]), 'Fm': (30, [57, 61, 64, 68]), 'D': (38, [57, 61, 64, 66]), 'E': (40, [56, 61, 66, 71])}
PROG = [(0, 2, 'A'), (2, 4, 'Fm'), (4, 6, 'D'), (6, 8, 'E'), (8, 10, 'A'), (10, 11, 'D'), (11, 12, 'E'), (12, 14.0, 'A')]
musik = K.song(D, CH, PROG, drop=1.5, mutes=[(5.0, 5.5)], end=12.0, energy=[(6.5, 8.5)], extra_kicks=(5.5,))

fx = K.buf(D + 1.5)
K.put(fx, K.drop_hit(), 0.0, 0.3)
K.put(fx, K.shimmer(0.7, 45, 3000, 8000), 0.04, 0.28)
K.put(fx, K.pour(1.55, 900, 1900), 0.0, 0.28)                 # Hero: Glas laeuft voll
K.put(fx, K.shimmer(0.45), 1.3, 0.5)
K.put(fx, K.drop_hit(), 1.5, 0.3)
K.put(fx, K.whoosh(0.6, 300, 4200, 0.45), 1.9, 0.5)           # Goldstreif fegt
for i, x in enumerate([-1.6, -0.9, -0.2, 0.6, 1.4, -1.25, 1.1, -0.4, 0.35, 1.7, -1.8]):
    tt = 1.95 + 0.5 * ((x + 2) / 4 * 3.2) / 4.2
    for k in range(2): K.put(fx, K.plastic_hit(1400 + 300 * ((i * 7) % 5)), tt + k * 0.07 + 0.02 * (i % 3), 0.32 - k * 0.12, pan=x / 2.2)
K.put(fx, K.pop(K.hz(69)), 2.4, 0.4); K.put(fx, K.shimmer(0.5, 40), 2.35, 0.25)
K.put(fx, K.slide(0.85), 2.9, 0.5)                             # Schlauch
K.put(fx, K.bubbles(0.55, 8), 3.35, 0.45)
K.put(fx, K.whoosh(0.4, 400, 1800), 4.1, 0.15)
K.put(fx, K.clink(3100), 4.55, 0.45); K.put(fx, K.clink(3150), 4.66, 0.12)   # Glas setzt auf
K.put(fx, K.click(), 5.47, 0.6); K.put(fx, K.beep(1760), 5.5, 0.55); K.put(fx, K.beep(2350, 0.09), 5.64, 0.4)
K.put(fx, K.hum(2.2), 6.3, 0.35)                               # Pumpe
K.put(fx, K.pour(2.15, 700, 2300), 6.38, 0.6)                  # Wasser ins Glas (Ton steigt mit dem Pegel)
K.put(fx, K.beep(2350, 0.08), 8.42, 0.35)
K.put(fx, K.bubbles(0.4, 5), 8.45, 0.25)
K.put(fx, K.whoosh(0.35, 500, 2500), 8.55, 0.15)
K.put(fx, K.clack(), 8.95, 0.35)                               # Stecker
for k, m in enumerate((76, 81, 85)): K.put(fx, K.bell(K.hz(m), 0.9, 0.5), 9.02 + k * 0.08, 0.35)
K.put(fx, K.whoosh(0.35, 300, 2000), 9.42, 0.15); K.put(fx, K.whoosh(0.35, 300, 2000), 10.17, 0.15)
for i, m in enumerate((69, 76)): K.put(fx, K.pop(K.hz(m - 12)), 11.35 + i * 0.1, 0.45, pan=(i - 0.5))
K.put(fx, K.shimmer(0.6, 50), 11.15, 0.25)
K.put(fx, K.shimmer(0.45), 11.82, 0.5)
K.soundlogo(fx, 12.04, 0.95)

L = int(D * SR)
os.makedirs(OUT, exist_ok=True)
for name, x in (('ws_ton_mit_musik', musik[:L] * 0.55 + fx[:L]), ('ws_ton_ohne_musik', fx[:L])):
    I, P = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {P:.1f} dBTP')
