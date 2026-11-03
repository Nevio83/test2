"""Maios Motion – Klangbausteine: Musik-Instrumente, Geraeusche, Klang-Logo.
Alles synthetisiert (keine Samples). Baut auf musik.py aus dem tiktok-editor-Skill auf.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # musik.py liegt daneben
import numpy as np
from scipy import signal
import musik as mk

SR = mk.SR
rng = np.random.default_rng(5)
lp, hp, bp, env, softclip, sine, saw = mk.lp, mk.hp, mk.bp, mk.env, mk.softclip, mk.sine, mk.saw
hz = mk.hz


def buf(seconds):
    return np.zeros((int(seconds * SR), 2))


def put(b, x, at, gain=1.0, pan=0.0):
    """Mono oder Stereo bei Sekunde `at` einmischen (Panorama -1..1, Mitte = 1.0 je Kanal)."""
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4) * 1.4142, np.sin((pan + 1) * np.pi / 4) * 1.4142
        x = np.stack([x * l, x * r], 1)
    i = int(round(at * SR))
    s0 = max(0, -i); i = max(0, i)
    j = min(len(b), i + len(x) - s0)
    if j > i:
        b[i:j] += x[s0:s0 + (j - i)] * gain


def t_(n):
    return np.arange(n) / SR


# ---------- Instrumente ----------
def epiano(f, dur, vel=1.0):
    n = int(dur * SR); t = t_(n)
    I = 1.6 * np.exp(-t * 7) + 0.25
    car = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * t))
    tine = np.sin(2 * np.pi * f * 7.02 * t) * 0.06 * np.exp(-t * 26)
    a = np.minimum(1, t / 0.003) * np.exp(-t * 1.5)
    rel = np.minimum(1, (dur - t) / 0.08).clip(0, 1)
    return (car + tine) * a * rel * 0.55 * vel


def bell(f, dur=2.6, vel=1.0):
    n = int(dur * SR); t = t_(n)
    I = 2.4 * np.exp(-t * 2.2)
    x = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * 3.5 * t))
    x += 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3.5)
    a = np.minimum(1, t / 0.002) * np.exp(-t * 1.25)
    return x * a * 0.5 * vel


def pad(freqs, dur, cut=2600, width=True):
    l = mk.pad(freqs, dur, cut=cut, detune=0.005)
    r = mk.pad(freqs, dur, cut=cut, detune=0.0075) if width else l
    return np.stack([l, r], 1) * 0.5


# ---------- Geraeusche ----------
def sweep_noise(dur, f0, f1, q=1.2, shape=None, color=None):
    """Rauschen durch einen Bandpass, dessen Mitte von f0 nach f1 laeuft (stueckweise, ueberblendet)."""
    n = int(dur * SR); x = rng.normal(0, 1, n) if color is None else color
    out = np.zeros(n); hop = 1024; win = np.hanning(hop * 2)
    for s in range(0, n, hop):
        e = min(n, s + hop * 2); p = s / max(1, n - 1)
        fc = f0 * (f1 / f0) ** (p if shape is None else shape(p))
        lo, hi = max(30, fc / (1 + q)), min(SR / 2 - 300, fc * (1 + q))
        seg = signal.sosfilt(signal.butter(2, [lo, hi], 'bp', fs=SR, output='sos'), x[max(0, s - 2048):e])[-(e - s):]
        out[s:e] += seg * win[:e - s]
    return out


def whoosh(dur=0.5, f0=250, f1=3200, peak=0.55):
    n = int(dur * SR); t = np.linspace(0, 1, n)
    shape = lambda p: np.sin(np.pi * min(1, p / peak) / 2) if p < peak else 1 - 0.55 * (p - peak) / (1 - peak)
    x = sweep_noise(dur, f0, f1, q=0.9, shape=shape)
    a = np.where(t < peak, (t / peak) ** 2.2, np.exp(-(t - peak) / (1 - peak) * 3.5))
    return x * a * 1.4


def knock(f=230, dec=28, glass=1.0, bright=1.0):
    """Obst trifft auf Glas/Plastik: dumpfer Koerper + kurzer Glasklang."""
    n = int(0.45 * SR); t = t_(n)
    body = sine(f * 1.8, n, f) * np.exp(-t * dec)
    click = bp(rng.normal(0, 1, n), 900, 4200) * np.exp(-t * 160) * 0.6 * bright
    ring = (np.sin(2 * np.pi * 2650 * t) + 0.6 * np.sin(2 * np.pi * 4120 * t)) * np.exp(-t * 18) * 0.06 * glass
    return softclip(body * 0.9 + click + ring, 1.3)


def thud(f=95):
    n = int(0.9 * SR); t = t_(n)
    body = sine(f * 1.6, n, f) * np.exp(-t * 9)
    nz = lp(rng.normal(0, 1, n), 900) * np.exp(-t * 30) * 0.5
    return mk.reverb(softclip(body + nz, 1.2), decay=1.6, mix=0.3)


def pour(dur, f0=520, f1=1500):
    n = int(dur * SR); t = t_(n)
    base = sweep_noise(dur, f0, f1, q=0.35)
    glug = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * (9 + 3 * np.sin(t * 2.1)) * t))
    hiss = hp(rng.normal(0, 1, n), 4000) * 0.12
    a = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.18).clip(0, 1)
    return (base * glug * 1.3 + hiss) * a


def ratchet(times, at0=0.0):
    out = np.zeros(int((max(times) + 0.5) * SR))
    for k, tt in enumerate(times):
        n = int(0.03 * SR); t = t_(n)
        c = hp(rng.normal(0, 1, n), 2500) * np.exp(-t * 600) + np.sin(2 * np.pi * 4300 * t) * np.exp(-t * 220) * 0.4
        mk.place(out, c * (0.5 + 0.5 * k / max(1, len(times) - 1)), tt)
    return out


def clack():
    n = int(0.25 * SR); t = t_(n)
    return softclip(bp(rng.normal(0, 1, n), 700, 3500) * np.exp(-t * 90) * 1.6 + sine(340, n, 220) * np.exp(-t * 40), 1.4)


def click():
    n = int(0.12 * SR); t = t_(n)
    a = hp(rng.normal(0, 1, n), 3000) * np.exp(-t * 900)
    b = np.sin(2 * np.pi * 1450 * t) * np.exp(-t * 120) * 0.35
    out = a + b
    rel = np.zeros(n); k = int(0.07 * SR); rel[k:] = (hp(rng.normal(0, 1, n - k), 3500) * np.exp(-t[:n - k] * 1100)) * 0.5
    return out + rel


def powerup(dur=0.5):
    n = int(dur * SR); t = t_(n)
    f = 260 * (3.1 ** (t / dur))
    ph = np.cumsum(f / SR) * 2 * np.pi
    x = np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    return lp(x, 3000) * np.minimum(1, t / 0.05) * np.exp(-np.maximum(0, t - dur * 0.6) * 9) * 0.5


def motor(dur, up=0.32, down=0.3, f_run=150):
    n = int(dur * SR); t = t_(n)
    spd = np.clip(t / up, 0, 1) ** 1.4 * np.clip((dur - t) / down, 0, 1) ** 0.8
    f = f_run * spd * (1 + 0.015 * np.sin(2 * np.pi * 5.5 * t)) + 1
    ph = np.cumsum(f / SR) * 2 * np.pi
    hum = signal.sawtooth(ph) * 0.45 + np.sin(2 * ph) * 0.25 + np.sin(3 * ph) * 0.12
    hum = lp(hum, 2400) * spd
    air = bp(rng.normal(0, 1, n), 900, 5000) * spd ** 1.5 * 0.5
    chunks = np.zeros(n)
    for _ in range(26):
        tt = rng.uniform(0.05, min(0.9, dur * 0.5)); i = int(tt * SR); m = int(0.025 * SR)
        if i + m < n: chunks[i:i + m] += bp(rng.normal(0, 1, m), 600, 3000) * np.exp(-np.linspace(0, 8, m)) * rng.uniform(0.3, 0.9)
    return softclip(hum + air + chunks * 0.9, 1.5)


def shimmer(dur=0.45, density=70, lo=2600, hi=7800):
    n = int(dur * SR); out = np.zeros(n)
    for _ in range(int(density * dur)):
        tt = rng.beta(2, 2) * dur; f = rng.uniform(lo, hi); m = int(rng.uniform(0.05, 0.2) * SR)
        tm = t_(m); p = np.sin(2 * np.pi * f * tm) * np.exp(-tm * rng.uniform(25, 60)) * rng.uniform(0.2, 0.6)
        mk.place(out, p, tt)
    sw = sweep_noise(dur, 3000, 9000, q=0.5) * np.sin(np.pi * np.linspace(0, 1, n)) * 0.25
    return out + sw


def pop(f):
    n = int(0.3 * SR); t = t_(n)
    x = sine(f * 1.9, n, f) * np.exp(-t * 22) + np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 30) * 0.25
    return x * np.minimum(1, t / 0.002) * 0.8


def ting(f=2400):
    return bell(f, 1.4, 0.6)


def riser(dur, f0=400, f1=6000):
    n = int(dur * SR); t = np.linspace(0, 1, n)
    return sweep_noise(dur, f0, f1, q=0.6) * t ** 2 * 0.9


def drop_hit():
    n = int(1.2 * SR); t = t_(n)
    sub = sine(90, n, 38) * np.exp(-t * 3.5)
    nz = lp(rng.normal(0, 1, n), 2500) * np.exp(-t * 14) * 0.4
    return softclip(sub + nz, 1.4)


def soundlogo(b, at, gain=1.0):
    """Maios-Klanglogo: offener D-Dur-Klang als Glocken-Arpeggio (D5 - A5 - Fis6) + warme Flaeche."""
    for k, m in enumerate((74, 81, 90)):
        put(b, mk.reverb(bell(hz(m), 2.4, 0.9 - k * 0.12), decay=2.4, mix=0.32), at + k * 0.11, gain * 0.9, pan=(-0.35, 0.0, 0.35)[k])
    put(b, pad([hz(50), hz(57), hz(62), hz(66), hz(69)], 2.2, cut=1800), at - 0.02, gain * 0.55)
    put(b, shimmer(0.9, 40, 4000, 9000), at + 0.15, gain * 0.35)


def master(x, out_wav, lufs=-14.0, tp=-1.0):
    """Lautheit auf Ziel, Spitzen per 4x-Oversampling-Limiter unter tp dBTP."""
    import subprocess, json
    tmp = out_wav + '.roh.wav'
    write_wav(x, tmp)
    meas = subprocess.run(['ffmpeg', '-nostdin', '-i', tmp, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float([l for l in meas.splitlines() if l.strip().startswith('I:')][-1].split()[1])
    g = lufs - I
    for it in range(4):
        lim = 10 ** ((tp - 2.2) / 20)
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', tmp, '-af',
                        f'aresample=176400,volume={g:.2f}dB,alimiter=limit={lim:.4f}:level=false:attack=0.5:release=50,aresample=48000:resampler=soxr',
                        '-c:a', 'pcm_s16le', out_wav], check=True)
        m = subprocess.run(['ffmpeg', '-nostdin', '-i', out_wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
        lines = [l for l in m.splitlines() if l.strip().startswith(('I:', 'Peak:'))]
        I2 = float(lines[-2].split()[1]); P = float(lines[-1].split()[1])
        if abs(I2 - lufs) < 0.15: break
        g += lufs - I2
    return I2, P


def write_wav(x, path):
    import wave
    y = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype('<i2').tobytes())


# ---------- Maios-Musikbett (gleiche Instrumente, eigene Akkorde je Video) ----------
def song(D, chords, prog, drop=1.5, mutes=(), end=12.0, energy=(), bpm=120, intro_vel=0.75, extra_kicks=()):
    """chords: {name: (bass_midi, [stimmen])}, prog: [(von, bis, name)], mutes: [(von, bis)] ohne Drums/Bass."""
    BEAT = 60 / bpm; S16 = BEAT / 4
    mus = buf(D + 1.5); drums = buf(D + 1.5); kicks = []
    muted = lambda tt: any(a <= tt < b for a, b in mutes)
    for (a, b, c) in prog:
        bass, vs = chords[c]
        put(mus, pad([hz(m) for m in vs] + [hz(bass + 12)], (b - a) + 0.4, cut=2200 if a < drop else 3000), a, 0.55)
        if a < drop:
            for k in range(int((min(b, drop) - a) / (BEAT / 2))):
                m = vs[k % 4] + (12 if k % 8 >= 4 else 0)
                put(mus, epiano(hz(m), 0.9, 0.6), a + k * BEAT / 2, intro_vel, pan=(-0.4 if k % 2 else 0.4))
        else:
            for bt in np.arange(a, b - 1e-6, BEAT * 2):
                for m in vs: put(mus, epiano(hz(m), 0.8, 0.7), bt, 0.32, pan=-0.15)
                tt = bt + BEAT * 1.5
                if tt < b and not muted(tt):
                    for m in vs: put(mus, epiano(hz(m + 12), 0.35, 0.5), tt, 0.2, pan=0.25)
        if b > drop:
            for st in [0, 3, 6, 8, 11]:
                tt = a + st * S16
                if drop <= tt < min(b, end) and not muted(tt):
                    put(mus, mk.bass(hz(bass), S16 * 2.6, cut=420), tt, 0.95)
    for i in range(int(D / S16)):
        tt = i * S16
        if tt < drop or tt >= end or muted(tt): continue
        step = i % 16
        if step % 4 == 0: put(drums, mk.kick(), tt, 0.9); kicks.append(tt)
        if step in (4, 12): put(drums, mk.clap(), tt, 0.42, pan=0.05)
        put(drums, mk.shaker(), tt, 0.12 if step % 2 else 0.07, pan=0.35)
        if any(a <= tt < b for a, b in energy) and step % 4 == 2: put(drums, mk.hat(True), tt, 0.16, pan=-0.3)
    for tt in (end,) + tuple(extra_kicks):
        put(drums, mk.kick(), tt, 1.0); kicks.append(tt)
    g = mk.duck(len(mus), kicks, S16, depth=0.5, rel=0.5)
    mus *= g[:, None]
    mus = np.stack([mk.reverb(mus[:, 0], 1.8, 0.18), mk.reverb(mus[:, 1], 1.9, 0.18)], 1)
    out = mus + drums
    tt = np.arange(len(out)) / SR
    out *= np.clip((D + 0.6 - tt) / 1.2, 0, 1)[:, None]
    return out


def plastic_hit(f=1800):
    n = int(0.18 * SR); t = t_(n)
    x = bp(rng.normal(0, 1, n), f * 0.6, f * 2.2) * np.exp(-t * 55) + np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t * 70) * 0.4
    return x * 0.8


def clink(f=3200):
    n = int(1.0 * SR); t = t_(n)
    parts = [(1.0, 1.0, 6), (2.32, 0.5, 9), (4.25, 0.25, 14), (6.1, 0.12, 20)]
    x = sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * d) for k, a, d in parts)
    knock_ = bp(rng.normal(0, 1, n), 1500, 6000) * np.exp(-t * 300) * 0.6
    return (x * 0.35 + knock_) * np.minimum(1, t / 0.001)


def beep(f=1760, dur=0.11):
    n = int(dur * SR); t = t_(n)
    return np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.004) * np.minimum(1, (dur - t) / 0.02).clip(0, 1) * 0.4


def bubbles(dur=0.5, count=7):
    n = int(dur * SR); out = np.zeros(n)
    for _ in range(count):
        tt = rng.uniform(0, dur * 0.8); m = int(0.06 * SR); tm = t_(m)
        f0 = rng.uniform(380, 700); ph = np.cumsum(f0 * (1 + 2.2 * tm / 0.06) / SR) * 2 * np.pi
        mk.place(out, np.sin(ph) * np.exp(-tm * 45) * rng.uniform(0.3, 0.7), tt)
    return out


def hum(dur, f=118):
    n = int(dur * SR); t = t_(n)
    a = np.minimum(1, t / 0.15) * np.minimum(1, (dur - t) / 0.12).clip(0, 1)
    return lp(signal.sawtooth(2 * np.pi * f * t) * 0.3 + np.sin(2 * np.pi * f * 2 * t) * 0.3, 900) * a * 0.5


def slide(dur=0.6):
    n = int(dur * SR); t = np.linspace(0, 1, n)
    x = bp(rng.normal(0, 1, n), 600, 2600) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t * dur))
    return x * np.sin(np.pi * t) ** 0.7 * 0.35


def marimba(f, dur=0.6, vel=1.0):
    n = int(dur * SR); t = t_(n)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 6.5) + 0.42 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 22) + 0.12 * np.sin(2 * np.pi * f * 9.6 * t) * np.exp(-t * 45)
    click = bp(rng.normal(0, 1, n), 1500, 5000) * np.exp(-t * 400) * 0.15
    return (x + click) * np.minimum(1, t / 0.0015) * 0.75 * vel


def plip(f=700):
    """Wassertropfen: Sinus mit schnellem Aufwaertsgleiten."""
    n = int(0.12 * SR); t = t_(n)
    fr = f * (1 + 1.4 * (1 - np.exp(-t / 0.012)))
    ph = np.cumsum(fr / SR) * 2 * np.pi
    return np.sin(ph) * np.exp(-t * 38) * np.minimum(1, t / 0.001) * 0.7


def pluckchord(freqs, dur=0.28, vel=1.0):
    return sum(mk.pluck(f, dur, cut=4200, bright=0.6) for f in freqs) / len(freqs) * vel


def spieluhr(f, dur=1.5, vel=1.0):
    """Spieluhr: Metallzunge mit unharmonischen Obertoenen, kurzer Anschlag."""
    n = int(dur * SR); t = t_(n)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.0) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 7.5) + 0.1 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 15)
    tick = bp(rng.normal(0, 1, n), 2500, 9000) * np.exp(-t * 900) * 0.18
    return (x + tick) * np.minimum(1, t / 0.0008) * 0.5 * vel


def vinyl(dur, density=9.0, hiss=0.012):
    """Plattenknistern: seltene, gefilterte Knackser + leises Rauschen."""
    n = int(dur * SR); out = hp(rng.normal(0, 1, n), 3000) * hiss
    for _ in range(int(dur * density)):
        i = int(rng.uniform(0, n - 400)); m = 200 + int(rng.uniform(0, 200))
        out[i:i + m] += bp(rng.normal(0, 1, m), 1200, 7000) * np.exp(-np.linspace(0, 30, m)) * rng.uniform(0.05, 0.25)
    return out
