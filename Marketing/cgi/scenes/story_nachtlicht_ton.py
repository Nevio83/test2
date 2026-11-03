"""Ton fuer die Mo-Story "3 Uhr nachts" (Nachtlichter mit Bewegungsmelder, 22,4 s, mit Erzaehlerstimme):
   0-11,55 s Schleich-Musik in a-Moll (Pizzicato-Plucks, leiser Bass, Uhr-Ticken, Schritte), 11,55 s Licht geht an ->
   warmes F-Dur-Schlaflied (Marimba, Pad, sanfter Beat), Klang-Logo im Abbinder bei 21,4 s.
   Die Musik bleibt leise, weil die Stimme darueber liegt (stimme.py senkt sie zusaetzlich ab).
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
D = 23.4; SR = K.SR; BEAT = 0.5; S8 = BEAT / 2
hz = K.hz
ON_A, ON_B = 11.55, 15.0

mus = K.buf(D + 2); drums = K.buf(D + 2); kicks = []
# ---------- 0-11,55: a-Moll, auf Zehenspitzen ----------
PROG1 = [(0.0, 2.8, [45, 52, 57, 60]), (2.8, 5.4, [41, 48, 57, 60]), (5.4, 8.0, [43, 50, 55, 59]), (8.0, 10.6, [40, 47, 56, 59]), (10.6, ON_A, [45, 52, 57, 60])]
for a, b, ch in PROG1:
    K.put(mus, mk.bass(hz(ch[0] - 12), b - a, cut=220), a, 0.5)
    K.put(mus, K.pad([hz(m) for m in ch[1:]], b - a + 0.3, cut=1200), a, 0.18)
# Pizzicato-Linie auf Achteln (Schleichen)
PIZ = [69, 72, 76, 72, 69, 72, 76, 74, 65, 69, 72, 69, 65, 69, 72, 74, 67, 71, 74, 71, 67, 71, 74, 76, 68, 71, 76, 71, 68, 71, 74, 71]
i = 0; tt = 0.25
while tt < ON_A - 0.2:
    m = PIZ[i % len(PIZ)]
    if i % 2 == 0 or tt > 5.4: K.put(mus, mk.pluck(hz(m), 0.25, cut=2600, bright=0.6), tt, 0.22, pan=0.2 * ((i % 4) - 1.5))
    tt += S8; i += 1
for k in range(int(ON_A / 0.5)): K.put(mus, K.knock(1900 if k % 2 else 1500, 60, 0.0, 0.6), 0.1 + k * 0.5, 0.05, pan=-0.4)   # Uhr tickt
# ---------- ab 11,55: F-Dur, warm ----------
PROG2 = [(ON_A, 13.2, [41, 53, 57, 60]), (13.2, 15.8, [46, 53, 58, 62]), (15.8, 17.9, [38, 50, 57, 60]), (17.9, 20.8, [43, 55, 58, 62]), (20.8, 22.4, [36, 48, 55, 58]), (22.4, D, [41, 53, 57, 60])]
for a, b, ch in PROG2:
    K.put(mus, K.pad([hz(m) for m in ch], b - a + 0.4, cut=2400), a, 0.4)
    K.put(mus, mk.bass(hz(ch[0] - 12), b - a, cut=300), a, 0.5)
MEL = [77, 76, 74, 72, 74, 77, 81, 79, 77, 74, 72, 70, 72, 74, 77, 76, 74, 72, 70, 69, 70, 72, 74, 77, 76, 72]
for k, m in enumerate(MEL):
    tt = 11.8 + k * 0.36
    if tt < 22.3: K.put(mus, mk.reverb(K.marimba(hz(m), 0.6, 0.8), 1.8, 0.3), tt, 0.32, pan=0.12)
for i in range(int((22.4 - 13.2) / S8)):
    tt = 13.2 + i * S8
    if i % 4 == 0: K.put(drums, mk.kick(), tt, 0.4); kicks.append(tt)
    if i % 4 == 2: K.put(drums, mk.clap(), tt, 0.1)
    K.put(drums, mk.shaker(), tt, 0.04, pan=0.3)
g = mk.duck(len(mus), kicks, S8 / 2, depth=0.25, rel=0.5); mus *= g[:, None]
musik = mus + drums
t_ = np.arange(len(musik)) / SR
musik *= np.clip((D + 0.3 - t_) / 0.8, 0, 1)[:, None]

# ---------- Geraeusche ----------
fx = K.buf(D + 2)
K.put(fx, K.sweep_noise(0.45, 1500, 500, 0.9), 0.0, 0.25)                   # Decke raschelt beim Hochschrecken
K.put(fx, K.whoosh(0.25, 300, 1500), 2.75, 0.08)
K.put(fx, K.whoosh(0.25, 300, 1500), 5.35, 0.08)
for tt in np.arange(5.5, 11.4, 0.42): K.put(fx, K.thud(70), tt, 0.10)        # Schritte auf Zehenspitzen
K.put(fx, K.plastic_hit(2400), 6.6, 0.15)                                     # Lego klackert leise
K.put(fx, K.whoosh(0.25, 300, 1500), 7.95, 0.08); K.put(fx, K.whoosh(0.25, 300, 1500), 10.55, 0.08)
K.put(fx, K.shimmer(0.8, 55), ON_A, 0.4)                                      # Licht an
K.put(fx, K.whoosh(0.3, 300, 1800), 13.15, 0.1)
for tt in np.arange(13.3, 15.8, 0.36): K.put(fx, K.thud(80), tt, 0.09)
K.put(fx, K.shimmer(0.6, 45), ON_B, 0.3)
K.put(fx, K.whoosh(0.3, 300, 1800), 15.75, 0.1)
for tt in (17.3, 17.65, 18.0): K.put(fx, K.plip(520), tt, 0.1)                 # Zzz
K.put(fx, K.whoosh(0.3, 300, 2000), 17.85, 0.12); K.put(fx, K.whoosh(0.3, 300, 1800), 20.75, 0.1)
for tt, m in ((18.0, 69), (19.8, 74)): K.put(fx, K.pop(hz(m)), tt, 0.3)
K.soundlogo(fx, 22.4, 0.8)

L = int(D * SR)
os.makedirs(OUT, exist_ok=True)
for name, x in (('nl_ton_mit_musik', musik[:L] * 0.5 + fx[:L]), ('nl_ton_ohne_musik', fx[:L])):
    I, P = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {P:.1f} dBTP')
