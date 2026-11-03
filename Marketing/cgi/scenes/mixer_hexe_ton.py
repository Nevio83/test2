"""Ton fuer "Das ist kein Hexentrank." (Mixer, Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Musik: E-Piano-Groove in a-Moll (Am - F - Dm - E, je ein Takt) mit Spieluhr-Motiv, als Schleife von genau
   8,0 s gebaut: Takt 1 beginnt bei Render-Sekunde 0,4 (= Anfang der fertigen Datei), dadurch sind die letzten
   und die ersten 0,4 s gleich und die Naht von finish.py --loop ist nicht zu hoeren. Drop beim ersten Schnitt
   (Datei 2,2 s), kurze Pause, wenn der Mixer ausgeht (Datei 3,45-3,7 s), danach der Groove bis zum Ende.
   Kein Klang-Logo, kein Schlussakkord. Geraeusche: Mixer-Motor (laeuft bis 3,86 s, wieder ab 7,0 s),
   Auslaufen, Kerzenknistern, Pops auf den Einblendungen. Zwei Mischungen: mit Musik und nur Geraeusche.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 8.4; OFF = 0.4; LOOP = 8.0; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(31)
STOP, START2 = 3.86, 7.0

# ---------- Musik als 8-s-Schleife (Zeit = Sekunde der fertigen Datei) ----------
P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
CH = {'Am': (33, [57, 60, 64, 69]), 'F': (29, [57, 60, 65, 69]), 'Dm': (26, [57, 62, 65, 69]), 'E': (28, [56, 59, 64, 68])}
PROG = [(0.0, 2.0, 'Am'), (2.0, 4.0, 'F'), (4.0, 6.0, 'Dm'), (6.0, 8.0, 'E')]
BREAK = (3.45, 3.7)
for a, b, c in PROG:
    bass, ch = CH[c]
    for st, ln, vel in ((0.0, 1.4, 0.75), (1.5, 0.45, 0.55)):     # Akkord auf 1, kurzer Nachschlag auf 4-und
        tt = a + st
        if BREAK[0] <= tt < BREAK[1]: continue
        for k, m in enumerate(ch): K.put(P, mk.reverb(K.epiano(hz(m), ln, vel), 1.6, 0.22), tt + k * 0.015, 0.3, pan=(k - 1.5) * 0.22)
    if a >= 2.0:                                                   # Bass ab dem Drop
        for st, ln in ((0.0, 0.7), (0.75, 0.2), (1.0, 0.45), (1.75, 0.2)):
            tt = a + st
            if BREAK[0] - 0.05 <= tt < BREAK[1]: continue
            K.put(P, mk.bass(hz(bass + (12 if st in (0.75, 1.75) else 0)), ln, cut=330), tt, 0.85)
    else:
        K.put(P, mk.bass(hz(bass), 1.9, cut=220), a, 0.55)
# Spieluhr-Motiv (a-Moll mit Dis = gruselig), Takt 1 und Variante in Takt 3
MEL = [(0.0, 81), (0.25, 84), (0.5, 88), (1.0, 87), (1.25, 88), (1.5, 84),
       (4.0, 81), (4.25, 86), (4.5, 89), (5.0, 88), (5.25, 86), (5.5, 81), (6.5, 80), (7.0, 83), (7.5, 88)]
for tt, m in MEL: K.put(P, mk.reverb(K.spieluhr(hz(m), 1.3, 0.8), 2.2, 0.35), tt, 0.24, pan=0.2)
for i in range(int(LOOP / S16)):
    tt = i * S16; st = i % 16
    if BREAK[0] <= tt < BREAK[1]: continue
    if tt < 2.2:                                                   # vor dem Drop nur Kick auf 1 und leise Hats
        if st == 0: K.put(dr, mk.kick(), tt, 0.55); kicks.append(tt)
        if st % 2 == 0: K.put(dr, mk.hat(False), tt, 0.06, pan=-0.25)
        continue
    if st in (0, 6, 10): K.put(dr, mk.kick(), tt, 0.8); kicks.append(tt)
    if st in (4, 12): K.put(dr, mk.clap(), tt, 0.3)
    K.put(dr, mk.hat(st % 4 == 2), tt, 0.1 if st % 2 else 0.13, pan=-0.25)
K.put(dr, mk.kick(), 2.2, 0.95); kicks.append(2.2)                 # Drop auf dem ersten Schnitt
K.put(dr, mk.kick(), BREAK[1], 0.9); kicks.append(BREAK[1])        # zurueck nach der Pause
g = mk.duck(len(P), kicks, S16, depth=0.38, rel=0.4); P *= g[:, None]
P = P + dr
N8 = int(LOOP * SR)
circ = P[:N8].copy(); tail = P[N8:]; circ[:len(tail)] += tail[:N8]       # Nachhall in den Anfang falten
N = int(D * SR)
idx = (np.arange(N) - int(OFF * SR)) % N8
musik = circ[idx]

# ---------- Geraeusche (Render-Zeit) ----------
fx = K.buf(D + 1); mot = K.buf(D + 1)
def knister(dur, dichte=7.0):
    n = int(dur * SR); out = np.zeros(n)
    for _ in range(int(dur * dichte)):
        i = int(rng.uniform(0, n - 900)); m = 300 + int(rng.uniform(0, 500))
        out[i:i + m] += K.bp(rng.normal(0, 1, m), 900, 4200) * np.exp(-np.linspace(0, 12, m)) * rng.uniform(0.15, 0.5)
    return K.lp(out, 5000)
K.put(fx, knister(D + 0.5), 0.0, 0.16, pan=0.35)                   # Kerzen
m1 = K.motor(4.5, up=0.3, down=0.28, f_run=160)                    # laeuft schon, geht bei 3,86 s aus
K.put(mot, K.lp(m1, 4200), STOP + 0.28 - 4.5, 0.32)
K.put(fx, K.lp(K.slide(0.5), 1200), STOP + 0.05, 0.4)              # Fluessigkeit beruhigt sich
K.put(fx, K.click(), STOP - 0.02, 0.35)
m2 = K.motor(2.2, up=0.22, down=0.001, f_run=160)                  # laeuft wieder (Loop)
K.put(mot, K.lp(m2, 4200), START2, 0.32)
K.put(fx, K.click(), START2 - 0.02, 0.35)
for tt in (2.6, 4.0, 5.6, 7.0): K.put(fx, K.whoosh(0.3, 300, 2200), tt - 0.12, 0.1)   # Schnitte
for tt, f in ((4.1, 900), (5.7, 700), (6.15, 1100), (7.5, 820)): K.put(fx, K.pop(f), tt, 0.22)
L = N
os.makedirs(OUT, exist_ok=True)
for name, x in (('hexe_ton_mit_musik', musik[:L] * 0.62 + mot[:L] * 0.38 + fx[:L]), ('hexe_ton_ohne_musik', mot[:L] + fx[:L])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
