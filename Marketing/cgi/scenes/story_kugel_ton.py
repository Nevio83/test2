"""Ton fuer das Story-Video "Angst im Dunkeln" (Mo + Krystall Ball Nachtlampe, 23 s, ohne Stimme):
   0-9,2 s traurig-unheimlich in d-Moll (E-Piano, Drone, Herzschlag, Schatten-Wusch), 9,2 s fast Stille mit Funkeln,
   11,75 s Klick -> Lampe an -> Schlaflied in D-Dur (Spieluhr, Pad, sanfter Beat), Klang-Logo bei 21,4 s.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
D = 23.0; SR = K.SR; BEAT = 0.6; S8 = BEAT / 2
hz = K.hz
rng = np.random.default_rng(50)
CLICK = 11.75

mus = K.buf(D + 2); drums = K.buf(D + 2); kicks = []
# ---------- 0-9,2: d-Moll ----------
PROG1 = [(0.0, 2.2, [50, 57, 62, 65]), (2.2, 4.6, [46, 53, 62, 65]), (4.6, 7.0, [43, 50, 58, 62]), (7.0, 9.2, [45, 52, 61, 64])]
for a, b, ch in PROG1:
    for k, m in enumerate(ch): K.put(mus, mk.reverb(K.epiano(hz(m), b - a + 0.4, 0.55), 2.4, 0.35), a + k * 0.04, 0.3, pan=(k - 1.5) * 0.25)
    K.put(mus, mk.bass(hz(ch[0] - 12), b - a, cut=260), a, 0.6)
MEL1 = [(0.3, 74), (0.9, 77), (1.5, 76), (2.5, 74), (3.1, 72), (3.7, 70), (5.0, 69), (5.6, 70), (6.2, 69), (7.3, 73), (8.0, 76), (8.6, 73)]
for tt, m in MEL1: K.put(mus, mk.reverb(K.bell(hz(m), 1.4, 0.45), 2.6, 0.4), tt, 0.22, pan=0.15)
drone = mk.sine(hz(38), int(4.8 * SR)) * np.minimum(1, np.arange(int(4.8 * SR)) / SR / 0.6) * 0.4
K.put(mus, drone, 4.5, 0.7)
for tt in (4.7, 4.95, 5.5, 5.75, 6.3, 6.55, 7.1, 7.35, 7.9, 8.15): K.put(mus, K.thud(58), tt, 0.22)
fade = np.ones(len(mus)); i0, i1 = int(9.0 * SR), int(9.3 * SR); fade[i0:i1] = np.linspace(1, 0, i1 - i0); fade[i1:int(CLICK * SR)] = 0
mus *= fade[:, None]
# ---------- ab 11,75: D-Dur-Schlaflied ----------
PROG2 = [(CLICK, 13.6, [50, 57, 62, 66]), (13.6, 16.0, [47, 54, 62, 66]), (16.0, 18.4, [43, 55, 59, 62]), (18.4, 21.4, [45, 57, 61, 64]), (21.4, 23.0, [50, 57, 62, 66])]
for a, b, ch in PROG2:
    K.put(mus, K.pad([hz(m) for m in ch], b - a + 0.4, cut=2200), a, 0.45)
    K.put(mus, mk.bass(hz(ch[0] - 12), b - a, cut=300), a, 0.55)
MEL2 = [81, 78, 76, 74, 76, 78, 81, 83, 81, 78, 74, 76, 78, 76, 74, 73, 74, 76, 78, 81, 78, 76, 74, 74]
for k, m in enumerate(MEL2):
    tt = 12.0 + k * S8 * 1.25
    if tt < 21.3: K.put(mus, mk.reverb(K.spieluhr(hz(m), 1.4, 0.8), 2.2, 0.35), tt, 0.42, pan=0.12)
for i in range(int((21.4 - 13.6) / S8)):
    tt = 13.6 + i * S8
    if i % 4 == 0: K.put(drums, mk.kick(), tt, 0.45); kicks.append(tt)
    if i % 4 == 2: K.put(drums, mk.clap(), tt, 0.14)
    K.put(drums, mk.shaker(), tt, 0.05, pan=0.3)
g = mk.duck(len(mus), kicks, S8 / 2, depth=0.25, rel=0.5); mus *= g[:, None]
musik = mus + drums
tt = np.arange(len(musik)) / SR
musik *= np.clip((D + 0.3 - tt) / 1.0, 0, 1)[:, None]

# ---------- Geraeusche ----------
fx = K.buf(D + 2)
K.put(fx, K.whoosh(0.25, 300, 1500), 2.15, 0.1)
K.put(fx, K.click(), 2.45, 0.35)                                            # Lichtschalter aus
K.put(fx, K.sweep_noise(1.6, 90, 260, 1.3), 4.6, 0.35)                      # Schatten waechst (dunkles Rauschen)
K.put(fx, mk.lp(mk.saw(55, int(1.5 * SR)) * np.linspace(0, 1, int(1.5 * SR)) ** 2, 400) * 0.35, 5.2, 0.6)   # Grollen
K.put(fx, K.sweep_noise(0.5, 1800, 600, 0.9), 7.0, 0.25)                    # Decke hochziehen
K.put(fx, K.whoosh(0.3, 400, 2000), 9.15, 0.1)
K.put(fx, K.shimmer(0.7, 50), 9.3, 0.4)                                     # "DAS"
K.put(fx, K.click(), CLICK, 0.8); K.put(fx, K.shimmer(0.9, 60), CLICK + 0.05, 0.45)
K.put(fx, K.whoosh(0.3, 300, 1800), 13.55, 0.1); K.put(fx, K.whoosh(0.3, 300, 1800), 15.95, 0.1)
for tt in (17.2, 17.55, 17.9): K.put(fx, K.plip(520), tt, 0.12)              # Zzz
K.put(fx, K.whoosh(0.3, 300, 2000), 18.35, 0.12)
for tt, m in ((18.5, 69), (18.8, 74), (19.3, 78)): K.put(fx, K.pop(hz(m)), tt, 0.35)
K.soundlogo(fx, 21.4, 0.9)

L = int(D * SR)
os.makedirs(OUT, exist_ok=True)
for name, x in (('story_ton_mit_musik', musik[:L] * 0.62 + fx[:L]), ('story_ton_ohne_musik', fx[:L])):
    I, P = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {P:.1f} dBTP')
