"""Ton fuer "Mein Kuerbis muss jetzt ausziehen." (Aroma Öl Diffusor Schwarz, Christmas Switch; Loop-Clip: Render 8,4 s, Datei 8,0 s, 120 BPM).
   Musik als Schleife von genau 8,0 s (Takt 1 bei Render 0,4): Takt 1 Halloween in d-Moll (Spieluhr, tiefer Pad, keine Drums),
   dann Licht-Flackern mit Brummen und Knacken, ab Datei 2,1 s Weihnachten in F-Dur (F - Bb - C): Glocken, Schellen auf den
   Achteln, Kick und Bass. C-Dur am Ende fuehrt zurueck nach d-Moll (Loop). Kein Klang-Logo, kein Schlussakkord.
   Geraeusche: Ultraschall-Nebel ganz leise, Kuerbis rollt, Kerzenknistern im Halloween-Teil, Flacker-Knacken, Pops auf den Einblendungen.
   Zwei Mischungen: mit Musik und nur Geraeusche.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 8.4; OFF = 0.4; LOOP = 8.0; BEAT = 0.5; S8 = BEAT / 2
hz = K.hz
rng = np.random.default_rng(1109)

# ---------- Musik (Zeit = Sekunde der fertigen Datei) ----------
P = K.buf(LOOP + 4); dr = K.buf(LOOP + 4); kicks = []
DROP = 2.1
# Takt 1: d-Moll, Halloween
K.put(P, mk.pad([hz(m) for m in (50, 57, 62, 65)], 2.0, cut=900), 0.0, 0.16)
for tt, m in ((0.0, 74), (0.5, 77), (0.75, 76), (1.0, 74), (1.5, 69)):
    K.put(P, mk.reverb(K.spieluhr(hz(m), 1.2, 0.8), 2.4, 0.4), tt, 0.24, pan=0.2)
K.put(P, mk.bass(hz(38), 1.5, cut=180), 0.0, 0.45)
# Takte 2-4: F-Dur, Weihnachten
CH = {'F': (29, [60, 65, 69, 72]), 'Bb': (34, [62, 65, 70, 74]), 'C': (36, [60, 64, 67, 72])}
for a, b, c in ((2.0, 4.0, 'F'), (4.0, 6.0, 'Bb'), (6.0, 8.0, 'C')):
    bass, ch = CH[c]
    K.put(P, mk.pad([hz(m) for m in ch], 2.05, cut=2200), a + (0.1 if a == 2.0 else 0), 0.1)
    for st, vel in ((0.0, 0.55), (1.0, 0.4)):
        for k, m in enumerate(ch): K.put(P, mk.reverb(K.epiano(hz(m), 0.9, vel), 1.8, 0.3), a + st + k * 0.015 + (0.1 if a == 2.0 and st == 0 else 0), 0.22, pan=(k - 1.5) * 0.25)
    K.put(P, mk.bass(hz(bass), 0.9, cut=260), a + (0.1 if a == 2.0 else 0), 0.55); K.put(P, mk.bass(hz(bass), 0.45, cut=260), a + 1.0, 0.45)
MEL = [(2.1, 81), (2.5, 84), (3.0, 81), (3.5, 77), (4.0, 82), (4.5, 81), (5.0, 77), (5.5, 74), (6.0, 76), (6.5, 79), (7.0, 84), (7.5, 79)]
for tt, m in MEL: K.put(P, mk.reverb(K.bell(hz(m), 1.4, 0.8), 2.2, 0.35), tt, 0.16, pan=-0.15)
for i in range(int(LOOP / S8)):
    tt = i * S8
    if tt < DROP: continue
    st = i % 8
    K.put(dr, K.bp(rng.normal(0, 1, int(0.09 * SR)), 5000, 11000) * np.exp(-np.linspace(0, 9, int(0.09 * SR))), tt, 0.06 + 0.03 * (st % 2 == 1), pan=0.3)   # Schellen
    if st in (0, 4): K.put(dr, mk.kick(), tt, 0.55); kicks.append(tt)
    if st in (2, 6): K.put(dr, mk.clap(), tt, 0.1)
g = mk.duck(len(P), kicks, BEAT / 4, depth=0.25, rel=0.45); P *= g[:, None]
P = P + dr
N8 = int(LOOP * SR)
circ = P[:N8].copy(); tail = P[N8:]; circ[:len(tail)] += tail[:N8]   # Nachhall in den Anfang falten
N = int(D * SR)
idx = (np.arange(N) - int(OFF * SR)) % N8
musik = circ[idx]
# Flackern (Datei 1,55-2,1): Musik kurz duennen
fl = np.ones(N); a0, a1 = int((1.55 + OFF) * SR), int((2.1 + OFF) * SR); fl[a0:a1] = 0.35
fl = np.convolve(fl, np.ones(400) / 400, mode='same'); musik = musik * fl[:, None]

# ---------- Geraeusche (Render-Zeit) ----------
fx = K.buf(D + 1)
K.put(fx, K.lp(rng.normal(0, 1, int((D + 0.5) * SR)) * 0.018, 5000), 0.0, 1.0)   # Ultraschall-Nebel, leise
def knister(dur, dichte=7.0):
    n = int(dur * SR); out = np.zeros(n)
    for _ in range(int(dur * dichte)):
        i = int(rng.uniform(0, n - 900)); m = 300 + int(rng.uniform(0, 500))
        out[i:i + m] += K.bp(rng.normal(0, 1, m), 900, 4200) * np.exp(-np.linspace(0, 12, m)) * rng.uniform(0.15, 0.5)
    return K.lp(out, 5000)
K.put(fx, knister(2.2), 0.0, 0.18); K.put(fx, knister(1.4), 7.0, 0.18)
rl = K.lp(rng.normal(0, 1, int(1.8 * SR)), 180) * (0.5 + 0.5 * np.sin(np.linspace(0, 2 * np.pi * 7, int(1.8 * SR)))) * np.hanning(int(1.8 * SR))
K.put(fx, rl, 0.15, 0.5)                                          # Kuerbis rollt
K.put(fx, K.hum(0.55, 100), 1.95, 0.12)                       # Brummen beim Flackern
for tt in (1.98, 2.08, 2.2, 2.33, 2.45): K.put(fx, K.click(), tt, 0.25)
for tt in (2.9, 4.5, 5.8, 7.0): K.put(fx, K.whoosh(0.3, 300, 2000), tt - 0.12, 0.07)
K.put(fx, K.shimmer(0.5), 2.5, 0.05)
for tt, f in ((2.5, 760), (3.5, 900), (4.6, 820), (5.85, 700), (6.15, 1100)): K.put(fx, K.pop(f), tt, 0.18)
os.makedirs(OUT, exist_ok=True)
for name, x in (('dsw_ton_mit_musik', musik[:N] * 0.7 + fx[:N]), ('dsw_ton_ohne_musik', fx[:N])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -2.5)
    print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
