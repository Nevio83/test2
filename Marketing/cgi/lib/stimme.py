"""Erzaehlerstimme fuer Story-Videos: Bildschirmtext -> Sprache (Piper, deutsch), unter die Musik gemischt.

   python3 lib/stimme.py ton.wav text.json ziel.wav --modell <pfad>/de_DE-thorsten-high.onnx
   Optionen: --tempo 1.0 (kleiner = schneller), --ducking 9 (dB Musik unter der Stimme), --lufs -14

   text.json: [[sekunde, "Text"], ...] -- dieselben Einblendungen wie im Bild, in derselben Reihenfolge.
   HTML aus den Szenen (<br>, <span>, &nbsp;) wird entfernt, Preise werden sprechbar ("17,99 €" -> "17 Euro 99").
   Ergebnis: ziel.wav (48 kHz, Stereo) = Musik mit Stimme, Musik unter der Stimme abgesenkt, auf -14 LUFS
   und Spitze <= -1,5 dBTP gebracht. Danach wie immer finish.py. Zeilen, die laenger sind als ihr Zeitfenster
   bis zur naechsten Einblendung, werden gemeldet: dann Text kuerzen oder --tempo kleiner machen.

   Einmalig: pip install piper-tts (bzw. py -m pip install piper-tts). Modell + .onnx.json liegen in
   Marketing/data/piper/piper/. Videos mit dieser Stimme beim Upload als KI-Inhalt kennzeichnen.
"""
import argparse, json, re, subprocess, os, tempfile, html
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

SR = 48000


def sprechbar(text):
    t = html.unescape(re.sub(r'<br\s*/?>', ' ', text))
    t = re.sub(r'<[^>]+>', '', t)
    t = re.sub(r'(\d+),(\d{2})\s*€', r'\1 Euro \2', t)
    t = re.sub(r'\b([A-ZÄÖÜ]{2,})\b', lambda m: m.group(1).lower(), t)   # "DAS" nicht buchstabieren
    t = t.replace('€', ' Euro').replace('…', '...').replace('–', ',')
    return re.sub(r'\s+', ' ', t).strip()


def lies(pfad):
    rate, a = wavfile.read(pfad)
    a = a.astype(np.float32)
    if a.dtype != np.float32 or np.abs(a).max() > 2:
        a = a / 32768.0
    if a.ndim == 1:
        a = np.stack([a, a], 1)
    if rate != SR:
        a = resample_poly(a, SR, rate, axis=0).astype(np.float32)
    return a


def sprich(stimme, text, tempo):
    from piper import SynthesisConfig
    teile, rate = [], 22050
    for stueck in stimme.synthesize(text, syn_config=SynthesisConfig(length_scale=tempo)):
        teile.append(np.asarray(stueck.audio_float_array, dtype=np.float32))
        rate = stueck.sample_rate
    a = np.concatenate(teile) if teile else np.zeros(1, np.float32)
    laut_genug = np.flatnonzero(np.abs(a) > 0.02 * (np.abs(a).max() or 1))
    if len(laut_genug):                                  # Stille vorn und hinten weg, 30 ms Luft lassen
        pad = int(0.03 * rate)
        a = a[max(0, laut_genug[0] - pad):laut_genug[-1] + pad]
    return resample_poly(a, SR, rate).astype(np.float32)


def glatt(belegt, g, ms_an=80, ms_ab=250):
    """Huelle fuer die Musik: 1 = voll, g = unter der Stimme. Schnell runter, langsam wieder hoch (1-ms-Raster)."""
    blk = SR // 1000
    n = -(-len(belegt) // blk)
    roh = np.pad(belegt, (0, n * blk - len(belegt))).reshape(n, blk).any(1)
    ziel = np.where(roh, g, 1.0)
    a_an, a_ab = np.exp(-1 / ms_an), np.exp(-1 / ms_ab)
    out, y = np.empty(n), 1.0
    for i in range(n):
        k = a_an if ziel[i] < y else a_ab
        y = k * y + (1 - k) * ziel[i]
        out[i] = y
    return np.interp(np.arange(len(belegt)) / blk, np.arange(n) + 0.5, out).astype(np.float32)


def laut(ein, aus, ziel_lufs, tp=-1.5):
    """Zweistufiges loudnorm (linear), damit die Dynamik bleibt."""
    filt = f'loudnorm=I={ziel_lufs}:TP={tp}:LRA=11:print_format=json'
    m = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', ein, '-af', filt, '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
    filt2 = (f"loudnorm=I={ziel_lufs}:TP={tp}:LRA=11:linear=true:measured_I={j['input_i']}:measured_TP={j['input_tp']}"
             f":measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}")
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', ein, '-af', filt2, '-ar', str(SR), '-ac', '2',
                    '-c:a', 'pcm_s16le', aus], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ton'); ap.add_argument('text'); ap.add_argument('ziel')
    ap.add_argument('--modell', required=True); ap.add_argument('--tempo', type=float, default=1.0)
    ap.add_argument('--ducking', type=float, default=9.0); ap.add_argument('--lufs', type=float, default=-14.0)
    a = ap.parse_args()
    from piper import PiperVoice
    stimme = PiperVoice.load(a.modell)
    musik = lies(a.ton)
    zeilen = sorted(json.load(open(a.text, encoding='utf-8')), key=lambda z: z[0])
    spur = np.zeros(len(musik), np.float32)
    belegt = np.zeros(len(musik), bool)
    probleme = 0
    for i, (ab, text) in enumerate(zeilen):
        satz = sprechbar(text)
        if not satz:
            continue
        s = sprich(stimme, satz, a.tempo)
        bis = zeilen[i + 1][0] if i + 1 < len(zeilen) else len(musik) / SR
        dauer, fenster = len(s) / SR, bis - ab
        ok = dauer <= fenster
        probleme += not ok
        print(f'{ab:6.2f} s  {dauer:4.2f} s / {fenster:4.2f} s  {"ok " if ok else "ZU LANG"}  {satz}')
        i0 = int(ab * SR)
        i1 = min(len(spur), i0 + len(s))
        spur[i0:i1] += s[:i1 - i0]
        belegt[i0:i1] = True
    g = 10 ** (-a.ducking / 20)
    huelle = glatt(belegt, g)
    mix = musik * huelle[:, None] + spur[:, None] * 0.9
    mix /= max(1.0, float(np.abs(mix).max()) / 0.98)
    with tempfile.TemporaryDirectory() as tmp:
        roh = os.path.join(tmp, 'roh.wav')
        wavfile.write(roh, SR, (mix * 32767).astype(np.int16))
        laut(roh, a.ziel, a.lufs)
    print(f'{os.path.basename(a.ziel)}: {len(musik) / SR:.2f} s, Stimme unter {a.ducking:g} dB Musik, Ziel {a.lufs:g} LUFS'
          + (f' -- {probleme} Zeile(n) zu lang' if probleme else ''))


if __name__ == '__main__':
    main()
