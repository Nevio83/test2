"""Ton Pop-up-Zahnbürste (20,5 s, 112 BPM, D-Dur, leicht und luftig): gezupfte Akkorde (Ukulele-artig), Glockenspiel, Fingerschnipsen.
   Geräusche: Umblättern (Papier-Rascheln) bei jedem Seitenwechsel, Pop-ups (Papier-Klapp), Summen der Bürste, Timer-Tings, Wasser, Preis."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
SR = K.SR; D = 20.5; hz = K.hz; rng = np.random.default_rng(57)
BEAT = 60 / 112; S8 = BEAT / 2
P = K.buf(D + 3); dr = K.buf(D + 3)
PROG = [(38, [62, 66, 69, 74]), (35, [62, 66, 71, 74]), (43, [62, 67, 71, 74]), (45, [61, 64, 69, 73])]
bar = BEAT * 4
for n in range(int(D / bar) + 1):
    a = n * bar; b, ch = PROG[n % 4]
    if a >= D: break
    for st, v in ((0, 1.0), (1.5, 0.7), (2.5, 0.8), (3.0, 0.6)):
        if a + st * BEAT < D - 0.5: K.put(P, K.pluckchord([hz(m) for m in ch], 0.4, v), a + st * BEAT, 0.22)
    K.put(P, mk.bass(hz(b), bar * 0.9, cut=320), a, 0.4 if a >= 3.0 else 0.2)
for i in range(int(D / S8)):
    tt = i * S8
    if tt >= 3.0 and tt < D - 0.6 and i % 4 == 2: K.put(dr, mk.clap(), tt, 0.06)
    if tt >= 3.0 and tt < D - 0.6 and i % 2 == 0: K.put(dr, mk.hat(False), tt, 0.035, pan=0.3)
GL = [86, 90, 93, 90, 88, 86, 83, 86]
for i, m in enumerate(GL * 3):
    tt = 3.0 + i * BEAT * 0.5 * 2
    if tt < D - 0.8: K.put(P, mk.reverb(K.bell(hz(m), 0.8, 0.5), 1.4, 0.3), tt, 0.07, pan=-0.2)
P = P + dr
N = int(D * SR); musik = P[:N].copy(); musik *= np.minimum(1, (D - np.arange(N) / SR) / 0.5)[:, None]
fx = K.buf(D + 1)
def rustle(dur=0.55):
    n = int(dur * SR); x = rng.normal(0, 1, n); x = K.bp(x, 1500, 7000) * 0.4
    env = np.sin(np.linspace(0, np.pi, n)) ** 1.5 * (0.6 + 0.4 * np.abs(np.sin(np.linspace(0, 18, n))))
    return x * env
for T in (3.0, 5.8, 8.6, 11.4, 14.2, 17.0): K.put(fx, rustle(), T, 0.35); K.put(fx, K.slide(0.4), T + 0.1, 0.08)
for T in (0.1, 3.2, 6.0, 8.8, 11.6, 14.4, 17.2): K.put(fx, K.knock(600, 40, 0.1, 0.6), T + 0.3, 0.12)   # Pop-up klappt auf
K.put(fx, K.hum(2.0, f=255) * 0.35, 3.7, 0.4)                                                            # Bürste summt
for i in range(4): K.put(fx, K.ting(2000 + i * 200), 6.4 + i * 0.47, 0.14)                               # Timer-Viertel
for i in range(5): K.put(fx, K.pop(800 + i * 120), 9.25 + i * 0.2, 0.12)                                   # Reiter
K.put(fx, K.bubbles(1.6, 9), 11.9, 0.25)
for T in (15.0, 15.3): K.put(fx, K.pop(1000), T, 0.15)
for T in (0.15, 3.75, 6.45, 9.2, 12.0, 14.8, 17.6, 18.0, 19.5): K.put(fx, K.pop(1200), T, 0.1)
os.makedirs(OUT, exist_ok=True)
for name, x in (('pz_ton_mit_musik', musik * 0.7 + fx[:N]), ('pz_ton_ohne_musik', fx[:N])):
    I, Pk = K.master(x, f'{OUT}/{name}.wav', -14.0, -2.2); print(f'{name}: {I:.1f} LUFS, Spitze {Pk:.1f} dBTP')
