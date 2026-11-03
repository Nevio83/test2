"""Ton fuer den Halloween-Reveal "Gruselig einfach" (Wasserspender, Ramalama-Format ohne Song).
   0-0,75 s heller Teaser, der wie ein Band auslaeuft; 0,75-2,5 s dunkler Puls (Herzschlag auf jedem Schlag,
   d-Moll-Drone, Riser), Pause; 2,75 s Trommelschlag + Drop, ab 3 s das Wasserspender-Thema (Tropical House, D-Dur,
   Marimba); 7-9 s Zeitlupe in Halbzeit und gedaempft; Fan-Wipe mit Fluegel-Wusch; Klang-Logo bei 11,04 s.
   Zwei Mischungen: mit Musik und nur Geraeusche.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import numpy as np
import klang as K
import musik as mk

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
D = 13.0; SR = K.SR; BEAT = 0.5; S16 = BEAT / 4
hz = K.hz
rng = np.random.default_rng(29)
HIT, PRESS, WATER0, SWAP, END = 2.75, 3.5, 3.72, 9.95, 11.0


def tapestop(x, t0, t1):
    """Ab t0 laeuft das Band aus: Tempo und Tonhoehe fallen bis t1 auf 0, danach Stille."""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    pos = i0 + np.cumsum(np.linspace(1, 0, i1 - i0) ** 1.3)
    y = x.copy()
    for c in range(2): y[i0:i1, c] = np.interp(pos, np.arange(len(x)), x[:, c])
    y[i1 - 160:i1] *= np.linspace(1, 0, 160)[:, None]; y[i1:] = 0
    return y


def lp_section(x, t0, t1, cut, fade=0.06):
    """Abschnitt t0-t1 tiefpassgefiltert (Zeitlupe), weich ein- und ausgeblendet."""
    f = np.stack([mk.lp(x[:, 0], cut), mk.lp(x[:, 1], cut)], 1)
    t = np.arange(len(x)) / SR
    w = np.clip((t - t0) / fade, 0, 1) * np.clip((t1 - t) / fade, 0, 1)
    return x * (1 - w[:, None]) + f * w[:, None]


def crash(dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    return mk.hp(rng.normal(0, 1, n), 4500) * np.exp(-t * 2.6) * 0.5


def fanwusch(dur=0.42):
    """Ventilatorfluegel: Wusch mit schnellem Flattern."""
    x = K.whoosh(dur, 180, 1700, 0.5)
    t = np.arange(len(x)) / SR
    return x * (0.5 + 0.5 * np.sin(2 * np.pi * 13 * t) ** 2)


CH = {
    'D': (38, [66, 69, 74, 76], [62, 66, 69]),
    'A6': (37, [64, 69, 73, 76], [61, 64, 69]),
    'Bm': (35, [66, 69, 71, 74], [62, 66, 71]),
    'G': (31, [66, 71, 74, 79], [62, 67, 71]),
}
HOOK1 = [(0, 81, 2), (2, 78, 2), (4, 81, 1), (5, 83, 2), (7, 81, 1), (8, 78, 2), (10, 76, 2), (12, 74, 2), (14, 76, 2)]
HOOK2 = [(0, 78, 2), (2, 81, 2), (4, 83, 1), (5, 86, 2), (7, 83, 1), (8, 81, 4), (12, 78, 2), (14, 76, 2)]
BASSPAT = [(0, 0), (3, 12), (6, 0), (8, 0), (11, 12), (14, 0)]

# ---------- 0-0,75 s: Teaser, das Glas laeuft voll; dann laeuft das Band aus ----------
teas = K.buf(D + 1.5)
K.put(teas, K.pad([hz(m) for m in (62, 66, 69, 74)], 0.9, cut=2600), 0.0, 0.42)
for tt in (0.0, 0.5): K.put(teas, mk.kick(), tt, 0.85)
K.put(teas, mk.clap(), 0.5, 0.35, pan=0.05)
K.put(teas, mk.hat(), 0.25, 0.14, pan=-0.3)
for k in range(6): K.put(teas, mk.shaker(), k * S16, 0.1 if k % 2 else 0.05, pan=0.35)
for st, oc in BASSPAT[:3]: K.put(teas, mk.bass(hz(38 + oc), S16 * 2.2, cut=520), st * S16, 0.95)
for st, m, du in HOOK1[:4]:
    K.put(teas, K.marimba(hz(m), 0.7, 0.85), st * S16, 0.6, pan=0.12)
    K.put(teas, K.marimba(hz(m + 12), 0.4, 0.35), st * S16, 0.25, pan=-0.25)
K.put(teas, K.pluckchord([hz(m) for m in (62, 66, 69)], 0.26, 0.9), 0.25, 0.5, pan=0.3)
teas = tapestop(teas, 0.52, 0.75)

# ---------- 0,75-2,47 s: dunkler Puls, dann Pause bis zum Schlag ----------
dark = K.buf(D + 1.5)
n = int(2.0 * SR); tn = np.arange(n) / SR
sub = (mk.sine(hz(26), n) * 0.35 + mk.sine(hz(38), n) * 0.22) * np.minimum(1, tn / 0.25) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.9 * tn))
K.put(dark, sub, 0.75, 0.9)
moll = mk.lp(sum(mk.saw(hz(m), n, 0.004) for m in (50, 53, 57)), 650) * 0.12 * np.minimum(1, tn / 0.6)
K.put(dark, moll, 0.75, 0.8)
dum = mk.lp(mk.kick(), 200)
for k, tt in enumerate((0.75, 1.25, 1.75, 2.25)):   # Herzschlag auf jedem Schlag, wird lauter
    K.put(dark, dum, tt, 0.7 + 0.08 * k); K.put(dark, dum, tt + 0.17, 0.4 + 0.05 * k)
K.put(dark, K.riser(0.86, 300, 4500), 1.62, 0.22)
i0, i1 = int(2.47 * SR), int(HIT * SR)
dark[i0 - 220:i0] *= np.linspace(1, 0, 220)[:, None]; dark[i0:i1] = 0

# ---------- 2,75 s: Trommelschlag, Licht an; ab 3 s das Thema ----------
mus = K.buf(D + 1.5); drums = K.buf(D + 1.5); kicks = [HIT]
K.put(drums, mk.kick(), HIT, 1.1); K.put(drums, mk.clap(), HIT, 0.5); K.put(drums, K.drop_hit(), HIT, 0.6)
K.put(drums, crash(1.6), HIT, 0.3, pan=0.1)
PROG = [(HIT, 5, 'D'), (5, 7, 'A6'), (7, 9, 'Bm'), (9, 11, 'G'), (11, 13.0, 'D')]
for (a, b, c) in PROG:
    bass, padv, pl = CH[c]
    K.put(mus, K.pad([hz(m) for m in padv], (b - a) + 0.35, cut=2600), a, 0.42)
    if a == 7:   # Zeitlupe: lange Basstoene statt Muster
        for tt in (7.0, 8.0): K.put(mus, mk.bass(hz(bass), 0.9, cut=420), tt, 0.85)
        continue
    g0 = max(a, 3.0)
    for k in range(int((b - g0) / (BEAT / 2))):
        tt = g0 + k * BEAT / 2
        if k % 2 == 1 and tt < END: K.put(mus, K.pluckchord([hz(m) for m in pl], 0.26, 0.9), tt, 0.5, pan=(0.3 if k % 4 == 1 else -0.3))
    for st, oc in BASSPAT:
        tt = g0 + st * S16
        if tt < min(b, END): K.put(mus, mk.bass(hz(bass + oc), S16 * 2.2, cut=520), tt, 0.95)
for t0, hook in ((3.0, HOOK1), (5.0, HOOK2), (9.0, HOOK1)):
    for st, m, du in hook:
        tt = t0 + st * S16
        if tt >= t0 + 2.0 or tt >= END: continue
        K.put(mus, K.marimba(hz(m), 0.7, 0.85), tt, 0.6, pan=0.12)
        K.put(mus, K.marimba(hz(m + 12), 0.4, 0.35), tt, 0.25, pan=-0.25)
for tt, m in ((7.0, 83), (7.5, 78), (8.0, 81), (8.5, 78)):   # Zeitlupe: wenige lange Marimba-Toene mit Hall
    K.put(mus, mk.reverb(K.marimba(hz(m), 1.4, 0.8), 2.4, 0.4), tt, 0.55, pan=0.1)
K.put(mus, K.marimba(hz(74), 1.2, 0.9), END, 0.6); K.put(mus, K.marimba(hz(81), 1.2, 0.6), END, 0.4)
for i in range(int(D / S16)):
    tt = i * S16
    if tt < 3.0 or tt >= END: continue
    step = int(round((tt - 3.0) / S16)) % 16
    if 7.0 <= tt < 9.0:   # Halbzeit
        if tt in (7.0, 7.75, 8.5): K.put(drums, mk.kick(), tt, 0.8); kicks.append(tt)
        if tt == 8.0: K.put(drums, mk.reverb(mk.clap(), 1.8, 0.35), tt, 0.45)
        continue
    if step % 4 == 0: K.put(drums, mk.kick(), tt, 0.85); kicks.append(tt)
    if step in (4, 12): K.put(drums, mk.clap(), tt, 0.38, pan=0.05)
    if step % 4 == 2: K.put(drums, mk.hat(False), tt, 0.13, pan=-0.3)
    K.put(drums, mk.shaker(), tt, 0.1 if step % 2 else 0.05, pan=0.35)
for k in range(8): K.put(drums, mk.clap(), 8.5 + k * S16 * 0.5, 0.1 + 0.03 * k)   # Wirbel in den Fan-Wipe
K.put(drums, mk.kick(), END, 1.0); kicks.append(END)
PENTA = [86, 88, 90, 93, 95, 98]
for i in range(int(D / S16)):
    tt = i * S16
    if tt < 3.75 or tt >= 7.0: continue
    if rng.random() < (0.5 if tt >= 4.0 else 0.25):
        K.put(mus, K.plip(hz(rng.choice(PENTA)) * 0.5), tt, 0.2, pan=rng.uniform(-0.6, 0.6))
g = mk.duck(len(mus), kicks, S16, depth=0.45, rel=0.45)
mus *= g[:, None]
mus = np.stack([mk.reverb(mus[:, 0], 1.6, 0.16), mk.reverb(mus[:, 1], 1.7, 0.16)], 1)
groove = lp_section(mus + drums, 7.0, 9.0, 1100)
musik = teas + dark + groove
tt = np.arange(len(musik)) / SR
musik *= np.clip((D + 0.6 - tt) / 1.2, 0, 1)[:, None]

# ---------- Geraeusche ----------
fx = K.buf(D + 1.5)
pour0 = K.hp(K.pour(0.75, 800, 2100), 450); pour0[-300:] *= np.linspace(1, 0, 300)
K.put(fx, pour0, 0.0, 0.26); K.put(fx, K.bubbles(0.35, 5), 0.3, 0.2)
K.put(fx, K.clack(), 0.74, 0.35); K.put(fx, K.thud(55), 0.75, 0.5)          # Licht aus
K.put(fx, K.sweep_noise(1.72, 200, 520, 0.9), 0.75, 0.12)                     # Nebel
K.put(fx, K.clack(), HIT - 0.01, 0.45); K.put(fx, K.drop_hit(), HIT, 0.35)   # Licht an
K.put(fx, K.shimmer(0.6, 50), HIT + 0.01, 0.34)
K.put(fx, K.whoosh(0.3, 400, 2200), 3.23, 0.1)
K.put(fx, K.click(), PRESS, 0.65); K.put(fx, K.beep(1760), PRESS + 0.04, 0.45); K.put(fx, K.beep(2350, 0.09), PRESS + 0.18, 0.32)
K.put(fx, K.hum(3.28, 118), WATER0, 0.26)
K.put(fx, K.hp(K.pour(3.2, 700, 2300), 450), WATER0 + 0.08, 0.24)
for tt in (4.98, 6.98, 8.98): K.put(fx, K.whoosh(0.35, 400, 2200), tt, 0.12)
K.put(fx, K.hum(2.0, 64), 7.0, 0.2)                                             # Zeitlupe: tiefer, langsamer
K.put(fx, K.lp(K.pour(2.0, 250, 650), 1100), 7.0, 0.3)
for tt, f in ((7.3, 330), (7.8, 280), (8.3, 300), (8.72, 260)): K.put(fx, mk.reverb(K.plip(f), 2.2, 0.35), tt, 0.5)
K.put(fx, K.pop(hz(57)), 9.05, 0.4)                                             # In Weiss.
K.put(fx, fanwusch(0.42), 9.74, 0.55); K.put(fx, K.thud(80), SWAP, 0.3)
K.put(fx, K.pop(hz(64)), 10.02, 0.4)                                            # In Schwarz.
K.put(fx, K.ting(2400), 10.12, 0.18)
K.put(fx, K.shimmer(0.45), 10.82, 0.45)
K.soundlogo(fx, 11.04, 0.95)

L = int(D * SR)
os.makedirs(OUT, exist_ok=True)
for name, x in (('reveal_ton_mit_musik', musik[:L] * 0.62 + fx[:L]), ('reveal_ton_ohne_musik', fx[:L]), ('reveal_nur_musik', musik[:L])):
    I, P = K.master(x, f'{OUT}/{name}.wav', -14.0, -1.0)
    print(f'{name}: {I:.1f} LUFS, Spitze {P:.1f} dBTP')
