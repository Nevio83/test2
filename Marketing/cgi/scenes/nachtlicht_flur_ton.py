"""Ton fuer "Das Licht geht von allein an." (Nachtlichter mit Bewegungsmelder, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Eigene Klangfarbe: Kalimba (Zupfton) ueber weicher Flaeche, h-Moll -> D-Dur (Bm - G - D - A), als Schleife von genau
   8,0 s: Takt 1 beginnt bei Render-Sekunde 0,4 (= Anfang der Datei), letzte und erste 0,4 s sind gleich.
   Anfang leise und duester (Flur, Schritte, Haus knarzt), Licht geht an (Datei 0,1 s) mit warmem Aufklang,
   Drop beim ersten Schnitt (Datei 2,0 s), bei "Kein Spuk." (Datei 3,5 s) Wechsel nach D-Dur. Kein Klang-Logo,
   kein Schlussakkord. Zwei Mischungen: mit Musik und nur Geraeusche.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 8.4; OFF = 0.4; LOOP = 8.0; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(44)
ON = 0.5

def kalimba(f, dur=0.9, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 4.2) + 0.22 * np.sin(2 * np.pi * f * 5.95 * t) * np.exp(-t * 18) + 0.08 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 9)
    tick = K.bp(rng.normal(0, 1, n), 1800, 7000) * np.exp(-t * 600) * 0.12
    return (x + tick) * np.minimum(1, t / 0.001) * 0.6 * vel

# ---------- Musik als 8-s-Schleife (Zeit = Sekunde der Datei) ----------
P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'Bm': (35, [62, 66, 71]), 'G': (31, [62, 67, 71]), 'D': (38, [62, 66, 69, 74]), 'A': (33, [61, 64, 69, 73])}
PROG = [(0.0, 2.0, 'Bm'), (2.0, 3.5, 'G'), (3.5, 6.0, 'D'), (6.0, 8.0, 'A')]
for a, b, c in PROG:
    bass, ch = CH[c]
    K.put(P, K.pad([hz(m) for m in ch], b - a + 0.25, cut=1500 if a < 3.5 else 2400), a, 0.42 if a < 2.0 else 0.5)
    if a >= 2.0:
        for st in np.arange(0, b - a - 0.01, 1.0):
            K.put(P, mk.bass(hz(bass), 0.8, cut=260), a + st, 0.7)
    else:
        K.put(P, mk.bass(hz(bass), 1.9, cut=180), a, 0.4)
# Kalimba-Motiv: am Anfang zoegernd, ab "Kein Spuk." warm und fliessend
MEL = [(0.1, 74), (0.6, 71), (1.1, 73), (1.6, 66),
       (2.0, 74), (2.25, 71), (2.5, 67), (3.0, 71),
       (3.5, 78), (3.75, 74), (4.0, 69), (4.25, 74), (4.5, 76), (5.0, 78), (5.25, 74), (5.5, 69),
       (6.0, 76), (6.25, 73), (6.5, 69), (6.75, 73), (7.0, 76), (7.5, 73)]
for tt, m in MEL: K.put(P, mk.reverb(kalimba(hz(m), 1.0, 0.85), 1.8, 0.3), tt, 0.3, pan=(0.25 if m % 2 else -0.2))
for i in range(int(LOOP / S16)):
    tt = i * S16; st = i % 16
    if tt < 2.0: continue                                         # vor dem Drop keine Drums
    if st in (0, 8): K.put(dr, mk.kick(), tt, 0.62); kicks.append(tt)
    if st in (4, 12): K.put(dr, K.lp(mk.snare(), 3000), tt, 0.16)
    if st % 2 == 0: K.put(dr, mk.shaker(), tt, 0.08 if st % 4 else 0.11, pan=0.3)
K.put(dr, mk.kick(), 2.0, 0.8); kicks.append(2.0)
g = mk.duck(len(P), kicks, S16, depth=0.3, rel=0.4); P *= g[:, None]
P = P + dr
N8 = int(LOOP * SR)
circ = P[:N8].copy(); tail = P[N8:]; circ[:len(tail)] += tail[:N8]
N = int(D * SR)
musik = circ[(np.arange(N) - int(OFF * SR)) % N8]

# ---------- Geraeusche (Render-Zeit) ----------
fx = K.buf(D + 1)
def schritt():
    n = int(0.35 * SR); t = np.arange(n) / SR
    body = K.lp(rng.normal(0, 1, n), 380) * np.exp(-t * 26) * 0.9
    tap = K.bp(rng.normal(0, 1, n), 700, 2600) * np.exp(-t * 90) * 0.35
    return body + tap
def knarzen(dur=0.6, f=210):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f * (1 + 0.25 * np.sin(2 * np.pi * 1.3 * t)) + 30 * np.sin(2 * np.pi * 7 * t)
    ph = np.cumsum(fr / SR) * 2 * np.pi
    x = np.sign(np.sin(ph)) * (np.abs(np.sin(ph)) ** 3)
    return K.bp(x, 300, 2500) * np.sin(np.pi * t / dur) ** 2 * 0.25
amb = K.lp(rng.normal(0, 1, int((D + 1) * SR)), 220) * 0.05                    # Raumrauschen, Wind
K.put(fx, amb, 0.0, 1.0)
STEPS = [k / 1.8 for k in range(5)] + [D - k / 1.8 for k in range(3)]       # Schritte (POV), 1,8 pro Sekunde, Loop-gleich
for k, tt in enumerate(STEPS):
    K.put(fx, schritt(), tt, 0.22, pan=(-0.1 if k % 2 else 0.1))
K.put(fx, knarzen(0.7, 190), 1.35, 1.0, pan=-0.5)                              # Haus knarzt
K.put(fx, knarzen(0.6, 230), 7.35, 0.8, pan=-0.4)
# Licht geht an: warmer Aufklang (Glocke + Flaeche + Glitzer)
K.put(fx, mk.reverb(K.bell(hz(86), 1.6, 0.5), 2.2, 0.4), ON, 0.18, pan=0.3)
K.put(fx, K.shimmer(0.6, 40, 3000, 8000), ON + 0.02, 0.08)
for tt in (2.4, 3.8, 5.4, 7.0): K.put(fx, K.whoosh(0.3, 300, 2200), tt - 0.12, 0.09)   # Schnitte
for tt, f in ((3.9, 880), (5.5, 700), (5.95, 1100), (7.45, 820)): K.put(fx, K.pop(f), tt, 0.2)
os.makedirs(OUT, exist_ok=True)
for name, x in (('flur_ton_mit_musik', musik[:N] * 0.62 + fx[:N]), ('flur_ton_ohne_musik', fx[:N])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
