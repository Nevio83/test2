"""Ton für den Motion-Spot: eigene Musik + Klick-/Tipp-/Whoosh-/Pop-/Ting-Klänge genau auf die Ereignisse der Animation.
Alle Klänge werden hier synthetisiert (keine Samples, keine fremden Rechte). Braucht nur numpy + ffmpeg.

   py Marketing/cgi/spot/spot_ton.py <video>.events.json <musik.mp3|keine> ziel.wav [--musik-db -6] [--sfx-db 0] [--musik-ab <s>]
        Stück und --musik-ab vorher mit "py Marketing/cgi/spot/musik.py wahl --dauer <s> --stimmung <…>" bestimmen.
        [--spur stimme.wav --spur-ab 0.0 --ducking 12]   Stimme (Format W) oder Originalton (eigene Clips) dazumischen;
                                                         die Musik wird unter der Spur um --ducking dB abgesenkt.
   Ohne Klang-Ereignisse geht auch eine Liste {"dauer": 12, "events": []}.
   Die Fassung "ohne Musik" bekommt KEINE Klänge, sondern eine stumme Tonspur (anullsrc), siehe Skill maios-video.

Die Musik nur aus Marketing/musik nehmen und vorher in lizenzen.json prüfen (gewerblich_erlaubt = true).
Ergebnis: ziel.wav, 48 kHz Stereo, auf -14 LUFS und Spitze <= -1,5 dBTP gebracht (zweistufiges loudnorm).
Danach wie immer:  py Marketing/cgi/lib/finish.py bild.mp4 ziel.wav fertig.mp4 --titel 0.8
"""
import argparse, json, subprocess, sys
import numpy as np

SR = 48000
ap = argparse.ArgumentParser()
ap.add_argument('events'); ap.add_argument('musik'); ap.add_argument('ziel')
ap.add_argument('--musik-db', type=float, default=-6.0); ap.add_argument('--sfx-db', type=float, default=0.0)
ap.add_argument('--musik-ab', type=float, default=0.0)   # Startsekunde im Stück (aus musik.py wahl, liegt auf einem Taktanfang)
ap.add_argument('--spur', default=None); ap.add_argument('--spur-ab', type=float, default=0.0); ap.add_argument('--ducking', type=float, default=12.0)
a = ap.parse_args()
E = json.load(open(a.events, encoding='utf-8'))
D = float(E['dauer']); N = int(D * SR)
rng = np.random.default_rng(7)

def t_(sek): return np.arange(int(sek * SR)) / SR
def decay(n, tau): return np.exp(-np.arange(n) / (tau * SR))
def onepole_lp(x, a_):   # a_ je Sample (0..1), kleiner = dunkler
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s += a_[i] * (x[i] - s); y[i] = s
    return y

def klick():
    n = int(0.03 * SR); nz = np.diff(rng.standard_normal(n + 1)) * decay(n, 0.0025)
    return 0.5 * nz + 0.35 * np.sin(2 * np.pi * 2100 * t_(0.03)) * decay(n, 0.006)
def tipp():
    n = int(0.025 * SR); f = rng.uniform(1300, 1900)
    return 0.22 * np.sin(2 * np.pi * f * t_(0.025)) * decay(n, 0.004) + 0.12 * np.diff(rng.standard_normal(n + 1)) * decay(n, 0.0015)
def whoosh(d=0.45):
    n = int(d * SR); x = rng.standard_normal(n); p = np.linspace(0, 1, n)
    hull = np.sin(np.pi * p) ** 1.6; a_ = 0.02 + 0.25 * np.sin(np.pi * p) ** 2
    y = onepole_lp(x, a_); y = y - onepole_lp(y, np.full(n, 0.01))
    return 0.9 * y * hull / (np.abs(y).max() + 1e-9)
def pop():
    n = int(0.09 * SR); tt = t_(0.09); f = 950 * np.exp(-tt * 30) + 260
    return 0.45 * np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(n, 0.025)
def ting():
    n = int(0.7 * SR); tt = t_(0.7)
    return (0.22 * np.sin(2 * np.pi * 2349 * tt) + 0.09 * np.sin(2 * np.pi * 3524 * tt)) * decay(n, 0.18) * (1 - decay(n, 0.001))
KL = {'klick': klick, 'tipp': tipp, 'whoosh': whoosh, 'pop': pop, 'ting': ting}

sfx = np.zeros(N)
for e in E['events']:
    f = KL.get(e['typ'])
    if not f: continue
    x = f() * float(e.get('staerke', 1)); i = int(e['t'] * SR)
    if i >= N: continue
    m = min(len(x), N - i); sfx[i:i + m] += x[:m]
sfx *= 10 ** (a.sfx_db / 20)
stereo = np.stack([sfx, sfx], 1)

def lade(datei):
    roh = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', datei, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(roh, dtype=np.int16).reshape(-1, 2).astype(np.float64) / 32768

duck = np.ones(N)
if a.spur:
    sp = lade(a.spur); i0 = int(a.spur_ab * SR); m = max(0, min(len(sp), N - i0))
    spur = np.zeros((N, 2)); spur[i0:i0 + m] = sp[:m]
    hull = np.abs(spur).mean(1); k = int(0.15 * SR)   # Hüllkurve der Spur, geglättet
    hull = np.convolve(hull, np.ones(k) / k, mode='same'); aktiv = np.clip(hull / (hull.max() + 1e-9) * 8, 0, 1)
    duck = 1 - aktiv * (1 - 10 ** (-a.ducking / 20))
    stereo += spur
if a.musik != 'keine':
    mu = lade(a.musik)[int(a.musik_ab * SR):]
    if len(mu) < N: mu = np.concatenate([mu] * (N // len(mu) + 1))
    mu = mu[:N].copy(); fi, fo = int(0.25 * SR), int(1.0 * SR)
    mu[:fi] *= np.linspace(0, 1, fi)[:, None]; mu[-fo:] *= np.linspace(1, 0, fo)[:, None]
    stereo += mu * 10 ** (a.musik_db / 20) * duck[:, None]
if not np.any(stereo):
    raise SystemExit('Kein Ton: weder Klänge noch Musik noch Spur. Für die Fassung ohne Musik eine stumme Spur mit anullsrc anlegen.')

roh = a.ziel + '.roh.wav'
pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16).tobytes()
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', roh], input=pcm, check=True)
LN = 'loudnorm=I=-14:TP=-3.2:LRA=9'   # Reserve: AAC hebt die Spitze bei heller Musik um bis zu ~1,6 dB (gemessen 15.11.; Ziel nach finish.py: <= -1 dBTP)
m = subprocess.run(['ffmpeg', '-nostdin', '-i', roh, '-af', LN + ':print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
j = json.loads(m[m.rfind('{'):m.rfind('}') + 1])
subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', roh, '-af',
                f"{LN}:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample={SR}",
                '-c:a', 'pcm_s16le', a.ziel], check=True)
import os
os.remove(roh)
chk = subprocess.run(['ffmpeg', '-nostdin', '-i', a.ziel, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
print(a.ziel, ' '.join(l.strip() for l in chk.splitlines() if l.strip().startswith(('I:', 'Peak:')))[-60:])
