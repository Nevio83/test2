"""Ton fuer "Meine Wände bewegen sich." (Led crystal lampe, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Eigene Klangfarbe: glasige Glocken-Arpeggios und Wasser-Blubbern ueber dunkler Flaeche, e-Moll -> G-Dur
   (Em - C - G - D), als Schleife von genau 8,0 s (Takt 1 bei Render-Sekunde 0,4). Anfang duester und leise,
   Drop beim ersten Schnitt (Datei 2,0 s), bei "Nur meine Lampe." (Datei 3,8 s) heller. Kein Klang-Logo,
   kein Schlussakkord. Farbwechsel als leise Glas-Tings. Zwei Mischungen: mit Musik und nur Geraeusche.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 8.4; OFF = 0.4; LOOP = 8.0; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(21)

def glas(f, dur=1.2, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t * 3.0) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 7)
         + 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 14))
    return x * np.minimum(1, t / 0.002) * 0.5 * vel

P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'Em': (40, [64, 67, 71]), 'C': (36, [64, 67, 72]), 'G': (43, [62, 67, 71, 74]), 'D': (38, [62, 66, 69, 74])}
PROG = [(0.0, 2.0, 'Em'), (2.0, 3.8, 'C'), (3.8, 5.6, 'G'), (5.6, 8.0, 'D')]
for a, b, c in PROG:
    bass, ch = CH[c]
    K.put(P, K.pad([hz(m) for m in ch], b - a + 0.25, cut=1300 if a < 2.0 else 2600), a, 0.4 if a < 2.0 else 0.48)
    if a >= 2.0:
        for st in np.arange(0, b - a - 0.01, 0.5):
            K.put(P, mk.bass(hz(bass), 0.45, cut=300), a + st, 0.6)
    else:
        K.put(P, mk.bass(hz(bass), 1.9, cut=170), a, 0.45)
# Glas-Arpeggio in Sechzehnteln ab dem Drop, vorher langsame Viertel
for a, b, c in PROG:
    _, ch = CH[c]; notes = [m + 12 for m in ch]
    step = BEAT if a < 2.0 else S16 * 2
    for k, tt in enumerate(np.arange(a, b - 0.01, step)):
        m = notes[k % len(notes)]
        K.put(P, mk.reverb(glas(hz(m), 1.0, 0.9 if a < 2.0 else 0.7), 2.0, 0.35), tt, 0.22, pan=(0.3 if k % 2 else -0.3))
for i in range(int(LOOP / S16)):
    tt = i * S16; st = i % 16
    if tt < 2.0: continue
    if st in (0, 6, 8): K.put(dr, mk.kick(), tt, 0.6); kicks.append(tt)
    if st in (4, 12): K.put(dr, K.lp(mk.clap(), 4000), tt, 0.15)
    if st % 2 == 1: K.put(dr, mk.hat(), tt, 0.07, pan=0.25)
K.put(dr, mk.kick(), 2.0, 0.8); kicks.append(2.0)
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
# leises Wasser-Glucksen (die Wellen an der Wand), loop-gleich verteilt
for tt in (0.25, 1.1, 1.9, 3.0, 4.6, 5.5, 6.6, 7.6, 8.25):
    K.put(fx, K.bubbles(0.4, 4), tt % D, 0.06, pan=rng.uniform(-0.4, 0.4))
for tt, f in ((2.95, 2600), (3.3, 2900), (3.62, 3200), (3.92, 3500), (4.2, 2400)): K.put(fx, K.ting(f), tt, 0.12)   # Farbwechsel
for tt in (2.4, 4.2, 6.0, 7.2): K.put(fx, K.whoosh(0.3, 300, 2200), tt - 0.12, 0.09)
for tt, f in ((2.5, 820), (4.35, 900), (6.05, 700), (6.35, 1100), (7.25, 760)): K.put(fx, K.pop(f), tt, 0.18)
os.makedirs(OUT, exist_ok=True)
for name, x in (('crystal_ton_mit_musik', musik[:N] * 0.62 + fx[:N]), ('crystal_ton_ohne_musik', fx[:N])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
