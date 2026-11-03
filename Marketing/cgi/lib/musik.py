#!/usr/bin/env python3
"""Erzeugt rechtefreie Musikbetten fuer Kurzvideos.

Alles wird synthetisiert - keine Samples, keine Lizenzfragen. Das BPM steht im
Dateinamen, damit spaeter auf den Beat geschnitten werden kann (edit.py --beat).

    python3 musik.py <zielordner> [--stil upbeat_house] [--sekunden 64]
"""
import argparse, subprocess, sys
from pathlib import Path
import numpy as np
from scipy import signal

SR = 44100
rng = np.random.default_rng(7)


# ---------- Bausteine -------------------------------------------------------
def env(n, a, d, s, r):
    """ADSR in Sekunden -> Huellkurve der Laenge n."""
    a, d, r = (max(1, int(x * SR)) for x in (a, d, r))
    sus = max(0, n - a - d - r)
    return np.concatenate([
        np.linspace(0, 1, a),
        np.linspace(1, s, d),
        np.full(sus, s),
        np.linspace(s, 0, r)])[:n]


def lp(x, hz, order=4):
    return signal.sosfilt(signal.butter(order, min(hz, SR / 2 - 200), "lp", fs=SR, output="sos"), x)


def hp(x, hz, order=4):
    return signal.sosfilt(signal.butter(order, max(hz, 20), "hp", fs=SR, output="sos"), x)


def bp(x, lo, hi):
    return signal.sosfilt(signal.butter(4, [lo, min(hi, SR / 2 - 200)], "bp", fs=SR, output="sos"), x)


def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for c in ((1 - detune), 1.0, (1 + detune)) if detune else (1.0,):
        ph = np.cumsum(np.full(n, f * c / SR))
        out += signal.sawtooth(2 * np.pi * ph)
    return out / (3 if detune else 1)


def sine(f, n, fend=None):
    if fend is None:
        fend = f
    ph = np.cumsum(np.linspace(f, fend, n) / SR)
    return np.sin(2 * np.pi * ph)


def softclip(x, drive=1.6):
    return np.tanh(x * drive) / np.tanh(drive)


def tilt(x, g_low, g_mid, g_high, f_lo=220, f_hi=4500):
    """Dreiband-Waage. Baender werden per Subtraktion gebildet, summieren sich also exakt."""
    low = lp(x, f_lo)
    rest = x - low
    high = rest - lp(rest, f_hi)
    mid = rest - high
    return low * g_low + mid * g_mid + high * g_high


def reverb(x, decay=2.0, mix=0.25):
    """Schroeder-Hall: 4 Kamm- + 2 Allpassfilter."""
    out = np.zeros_like(x)
    for ms in (29.7, 37.1, 41.1, 43.7):
        d = int(ms / 1000 * SR)
        g = 10 ** (-3 * d / (decay * SR))
        buf = np.copy(x)
        for k in range(1, int(len(x) / d)):
            buf[k * d:] += g ** k * x[:len(x) - k * d]
        out += buf / 4
    for ms, g in ((5.0, 0.7), (1.7, 0.7)):
        d = int(ms / 1000 * SR)
        y = np.copy(out)
        y[d:] += -g * out[:-d]
        out = y
    return (1 - mix) * x + mix * lp(out, 6500)


# ---------- Instrumente -----------------------------------------------------
def kick(n=int(0.42 * SR)):
    body = sine(115, n, 44) * np.exp(-np.linspace(0, 9, n))
    click = hp(rng.normal(0, 1, n), 1800) * np.exp(-np.linspace(0, 220, n)) * 0.35
    return softclip(body * 0.72 + click * 1.4, 2.0)


def snare(n=int(0.24 * SR)):
    tone = (sine(190, n) + 0.5 * sine(285, n)) * np.exp(-np.linspace(0, 26, n))
    noise = bp(rng.normal(0, 1, n), 900, 8000) * np.exp(-np.linspace(0, 17, n))
    return softclip(0.35 * tone + 1.15 * noise, 1.4)


def clap(n=int(0.30 * SR)):
    out = np.zeros(n)
    for k, off in enumerate((0, 0.011, 0.021)):
        s = int(off * SR)
        seg = bp(rng.normal(0, 1, n - s), 1100, 6500) * np.exp(-np.linspace(0, 90, n - s))
        out[s:] += seg * (0.9 ** k)
    tail = bp(rng.normal(0, 1, n), 1200, 5200) * np.exp(-np.linspace(0, 13, n)) * 0.45
    return (out * 0.55 + tail) * 1.35


def hat(open_=False):
    n = int((0.20 if open_ else 0.055) * SR)
    return hp(rng.normal(0, 1, n), 7200) * np.exp(-np.linspace(0, 6 if open_ else 40, n)) * 0.85


def shaker(n=int(0.07 * SR)):
    return bp(rng.normal(0, 1, n), 5000, 12000) * np.exp(-np.linspace(0, 30, n)) * 0.95


def bass(f, dur, cut=380):
    n = int(dur * SR)
    x = 0.7 * sine(f, n) + 0.3 * saw(f, n)
    return softclip(lp(x, cut) * env(n, 0.006, 0.05, 0.85, 0.06), 1.3) * 0.5


def pad(freqs, dur, cut=3600, detune=0.006):
    n = int(dur * SR)
    x = sum(saw(f, n, detune) for f in freqs) / len(freqs)
    return lp(x, cut) * env(n, 0.35, 0.4, 0.75, 0.5) * 1.15


def pluck(f, dur, cut=6000, bright=1.0):
    n = int(dur * SR)
    x = saw(f, n, 0.004) * 0.6 + sine(f * 2, n) * 0.25
    x += hp(rng.normal(0, 1, n), 3000) * np.exp(-np.linspace(0, 160, n)) * 0.25 * bright
    return lp(x, cut) * env(n, 0.004, 0.16, 0.25, dur * 0.6) * 1.5


def mallet(f, dur):
    n = int(dur * SR)
    x = sine(f, n) + 0.5 * sine(f * 4.01, n) + 0.22 * sine(f * 9.2, n)
    return x * np.exp(-np.linspace(0, 7, n)) * 1.3


# ---------- Noten / Akkorde -------------------------------------------------
def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


CHORD = {"min": (0, 3, 7), "maj": (0, 4, 7), "min7": (0, 3, 7, 10), "maj7": (0, 4, 7, 11),
         "sus2": (0, 2, 7), "add9": (0, 4, 7, 14)}


def voicing(root, kind, octave=5, spread=True):
    base = root + 12 * octave
    ns = [base + i for i in CHORD[kind]]
    if spread:
        ns = [ns[0] - 12] + ns[1:] + [ns[1] + 12]
    return [hz(n) for n in ns]


def place(buf, x, at):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    if i < len(buf):
        buf[i:j] += x[:j - i]


def hits(pattern, bar_start, spb):
    """'x---x---' -> Zeitpunkte. spb = Sekunden pro Sechzehntel."""
    return [bar_start + k * spb for k, c in enumerate(pattern) if c == "x"]


def duck(n, kick_times, spb4, depth=0.62, rel=0.55):
    """Sidechain: Pegel faellt bei jedem Kick ein und kommt weich zurueck."""
    g = np.ones(n)
    ln = int(rel * spb4 * 4 * SR)
    shape = 1 - depth * np.exp(-np.linspace(0, 4.2, ln))
    for t in kick_times:
        i = int(t * SR)
        j = min(n, i + ln)
        if i < n:
            g[i:j] = np.minimum(g[i:j], shape[:j - i])
    return g


# ---------- Stile -----------------------------------------------------------
def build(style, seconds):
    bpm = style["bpm"]
    spb = 60 / bpm / 4                       # Sekunden pro Sechzehntel
    bar = spb * 16
    bars = int(np.ceil(seconds / bar)) + 1
    n = int((bars * bar + 2) * SR)
    drum = np.zeros(n); tonal = np.zeros(n); air = np.zeros(n)
    ktimes = []
    prog = style["prog"]

    for b in range(bars):
        t0 = b * bar
        ch_root, ch_kind = prog[b % len(prog)]
        drop = style.get("intro_bars", 1) > b        # erste Takte ohne Drums
        if not drop:
            for t in hits(style["kick"], t0, spb):
                place(drum, kick(), t); ktimes.append(t)
            for t in hits(style.get("snare", ""), t0, spb):
                place(drum, style.get("snare_snd", snare)(), t)
            for t in hits(style.get("hat", ""), t0, spb):
                place(drum, hat(), t)
            for t in hits(style.get("ohat", ""), t0, spb):
                place(drum, hat(True) * 0.8, t)
            for t in hits(style.get("perc", ""), t0, spb):
                place(drum, shaker(), t)

        if style.get("bass"):
            bf = hz(ch_root + 12 * style.get("bass_oct", 2))
            for t in hits(style["bass"], t0, spb):
                place(tonal, bass(bf, spb * style.get("bass_len", 3), style.get("bass_cut", 380)), t)

        vs = voicing(ch_root, ch_kind, style.get("chord_oct", 5))
        if style.get("pad"):
            place(tonal, pad(vs, bar * 0.98, style.get("pad_cut", 3600)) * style.get("pad_lvl", 1.0), t0)
        if style.get("stab"):
            for t in hits(style["stab"], t0, spb):
                for f in vs[1:4]:
                    place(tonal, pluck(f, spb * 4, style.get("stab_cut", 6000)) * 0.42, t)
        if style.get("arp"):
            seq = style["arp"]
            for k, c in enumerate(seq):
                if c == "-":
                    continue
                f = vs[int(c) % len(vs)] * (2 if int(c) >= len(vs) else 1)
                snd = mallet if style.get("arp_snd") == "mallet" else pluck
                place(tonal, snd(f, spb * 3) * style.get("arp_lvl", 0.5), t0 + k * spb)

    if style.get("vinyl"):
        air += lp(hp(rng.normal(0, 1, n), 500), 9000) * 0.012

    g = duck(n, ktimes, spb, style.get("duck", 0.55)) if ktimes else 1.0
    mix = drum + tonal * g + air
    mix = reverb(mix, style.get("rev_decay", 1.8), style.get("rev_mix", 0.2))
    mix = hp(mix, 28, order=2)
    mix = tilt(mix, *style.get("tilt", (0.55, 1.5, 2.4)))
    mix = softclip(mix / (np.max(np.abs(mix)) + 1e-9) * 1.5, 1.9)
    mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.89

    # leichte Stereobreite: Hoehen minimal versetzt
    d = int(0.008 * SR)
    right = np.copy(mix); right[d:] = 0.85 * mix[:-d] + 0.15 * mix[d:]
    st = np.stack([mix, right], 1)[:int(seconds * SR)]
    fi, fo = int(0.6 * SR), int(1.6 * SR)
    st[:fi] *= np.linspace(0, 1, fi)[:, None]
    st[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return st.astype(np.float32)


STYLES = {
    "upbeat_house": dict(
        bpm=124, prog=[(9, "min"), (5, "maj"), (0, "maj"), (7, "maj")],
        kick="x---x---x---x---", ohat="--x---x---x---x-", hat="x-x-x-x-x-x-x-x-",
        bass="x-------x-------", bass_oct=2, bass_cut=420, bass_len=6,
        pad=True, pad_cut=4200, pad_lvl=0.8, stab="----x---x---x-x-", stab_cut=7000,
        perc="--------x-------", duck=0.6, rev_mix=0.18, intro_bars=1,
        tilt=(1.0, 1.6, 1.9)),
    "lofi_chill": dict(
        bpm=88, prog=[(9, "min7"), (2, "min7"), (5, "maj7"), (7, "maj")],
        kick="x-------x--x----", snare="----x-------x---", hat="x-x-x-x-x-x-x-x-",
        bass="x-------x-------", bass_oct=2, bass_cut=300, bass_len=6,
        pad=True, pad_cut=2800, pad_lvl=1.1, stab="x-----x---x-----", stab_cut=4200,
        arp="--4---2---0---2-", arp_snd="mallet", arp_lvl=0.55,
        vinyl=True, duck=0.35, rev_decay=2.4, rev_mix=0.3, intro_bars=1,
        tilt=(1.0, 1.6, 2.2)),
    "clean_minimal": dict(
        bpm=112, prog=[(0, "sus2"), (0, "sus2"), (9, "min"), (5, "maj")],
        kick="x-------x-------", perc="--x---x---x---x-",
        bass="x-------x-------", bass_oct=2, bass_cut=260, bass_len=7,
        pad=True, pad_cut=3000, pad_lvl=0.7,
        arp="0-2-4-2-0-2-4-2-", arp_snd="mallet", arp_lvl=0.85,
        hat="--x---x---x---x-", duck=0.3, rev_decay=2.6, rev_mix=0.26, intro_bars=1,
        tilt=(0.95, 1.6, 2.8)),
    "cinematic_soft": dict(
        bpm=96, prog=[(9, "min"), (5, "maj7"), (0, "add9"), (7, "sus2")],
        kick="x---------------",
        bass="x-------x-------", bass_oct=2, bass_cut=430, bass_len=8,
        pad=True, pad_cut=3400, pad_lvl=1.3, chord_oct=5,
        arp="0---3---5---3---", arp_lvl=0.8, perc="------x-----x-x-",
        duck=0.3, rev_decay=3.2, rev_mix=0.36, intro_bars=2,
        tilt=(1.8, 1.25, 3.0)),
    "bright_pop": dict(
        bpm=128, prog=[(0, "maj"), (7, "maj"), (9, "min"), (5, "maj")],
        kick="x---x---x---x---", snare="----x-------x---", snare_snd=clap,
        hat="x-x-x-x-x-x-x-x-", ohat="------x-------x-",
        bass="x---x---x---x---", bass_oct=2, bass_cut=500, bass_len=3,
        pad=True, pad_cut=4600, pad_lvl=0.6,
        arp="4-2-0-2-4-5-4-2-", arp_lvl=0.9, stab_cut=7500,
        duck=0.55, rev_mix=0.16, intro_bars=1,
        tilt=(0.95, 1.6, 2.4)),
}


def write_mp3(audio, path, lufs="-14"):
    p = subprocess.Popen(
        ["ffmpeg", "-nostdin", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
         "-af", f"loudnorm=I={lufs}:TP=-1.5:LRA=11,alimiter=limit=0.89:level=disabled", "-c:a", "libmp3lame", "-b:a", "256k",
         str(path), "-y"], stdin=subprocess.PIPE)
    p.communicate(audio.tobytes())
    if p.returncode:
        sys.exit("ffmpeg-Fehler beim Schreiben von " + str(path))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ziel")
    ap.add_argument("--stil", choices=sorted(STYLES), action="append")
    ap.add_argument("--sekunden", type=float, default=64.0)
    a = ap.parse_args()
    out = Path(a.ziel); out.mkdir(parents=True, exist_ok=True)
    for name in (a.stil or sorted(STYLES)):
        st = STYLES[name]
        audio = build(st, a.sekunden)
        f = out / f"{name}_{st['bpm']}bpm.mp3"
        write_mp3(audio, f)
        print(f"{f.name:34} {st['bpm']:3d} BPM  {a.sekunden:.0f}s")


if __name__ == "__main__":
    main()
