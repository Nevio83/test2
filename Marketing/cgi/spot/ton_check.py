"""Tonprüfung zum "Hören" ohne Ohren: misst den Ton eines fertigen Videos und macht ihn als Bild sichtbar.
Nur numpy + ffmpeg.

   py Marketing/cgi/spot/ton_check.py <video.mp4|ton.wav> <ausgabeordner> [--events <x>.events.json]

Ergebnis:
   - Konsole + <ordner>/ton_check.json: Lautheit (LUFS), Spitze (dBTP), Stille-Stellen, Einsätze (hörbare Anschläge)
     und – mit --events – welche Klang-Ereignisse im fertigen Ton wirklich zu hören sind (±70 ms).
   - <ordner>/ton_bild.png: Wellenform oben, Spektrogramm unten (Zeitachse = Video). Claude sieht sich das Bild an:
     Musik = gleichmäßige Bänder, Klicks/Tipps = senkrechte Striche, Whoosh = Fahne, Stimme = Formanten-Streifen.
Grenzen: Ob Musik "schön" klingt oder zur Stimmung passt, kann die Messung nicht sagen – das entscheidet Nevio.
"""
import argparse, json, os, subprocess
import numpy as np

ap = argparse.ArgumentParser(); ap.add_argument('quelle'); ap.add_argument('ordner'); ap.add_argument('--events')
a = ap.parse_args(); os.makedirs(a.ordner, exist_ok=True); SR = 22050

m = subprocess.run(['ffmpeg', '-nostdin', '-i', a.quelle, '-af', 'ebur128=peak=true,silencedetect=n=-45dB:d=0.4', '-f', 'null', '-'],
                   capture_output=True, text=True).stderr
z = [l.strip() for l in m.splitlines() if l.strip().startswith(('I:', 'Peak:'))]
I, P = float(z[-2].split()[1]), float(z[-1].split()[1])
stille = []
for l in m.splitlines():
    if 'silence_start' in l: stille.append([round(float(l.split('silence_start:')[1].split()[0]), 2), None])
    if 'silence_end' in l and stille: stille[-1][1] = round(float(l.split('silence_end:')[1].split('|')[0]), 2)

roh = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', a.quelle, '-vn', '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                     capture_output=True, check=True).stdout
x = np.frombuffer(roh, dtype=np.int16).astype(np.float32) / 32768
n_fft, hop = 1024, 256
idx = np.arange(n_fft)[None, :] + hop * np.arange(1 + (len(x) - n_fft) // hop)[:, None]
spec = np.abs(np.fft.rfft(x[idx] * np.hanning(n_fft), axis=1))
hoch = spec[:, int(1500 / (SR / n_fft)):]                       # Anschläge (Klick/Tipp/Pop) leben oben
flux = np.maximum(0, np.diff(np.log1p(hoch * 20), axis=0)).sum(1)
flux = (flux - np.median(flux)) / (flux.std() + 1e-9); t = (np.arange(len(flux)) + 1) * hop / SR
einsaetze = [round(float(t[i]), 3) for i in range(1, len(flux) - 1) if flux[i] > 2.5 and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1]]

bericht = {'quelle': a.quelle, 'lufs': I, 'spitze_dbtp': P, 'ok_lautheit': abs(I + 14) <= 1, 'ok_spitze': P <= -1.0,
           'stille': stille, 'einsaetze_s': einsaetze}
if a.events:
    ev = json.load(open(a.events, encoding='utf-8'))['events']
    kurz = [e for e in ev if e['typ'] in ('klick', 'tipp', 'pop', 'ting')]
    treffer = [e for e in kurz if any(abs(e['t'] - s) <= 0.07 for s in einsaetze)]
    bericht['ereignisse_hoerbar'] = f'{len(treffer)}/{len(kurz)}'
    bericht['ereignisse_unhoerbar_s'] = [e['t'] for e in kurz if e not in treffer][:20]

subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', a.quelle, '-filter_complex',
                '[0:a]aformat=channel_layouts=mono,asplit[w][s];'
                '[w]showwavespic=s=1600x240:colors=0x3F4BB5[wb];'
                '[s]showspectrumpic=s=1600x480:legend=1:scale=log:fscale=log:color=intensity[sb];'
                '[wb]scale=1820:240[wb2];[sb]scale=1820:-2[sb2];[wb2][sb2]vstack', '-frames:v', '1',
                os.path.join(a.ordner, 'ton_bild.png')], check=True)
json.dump(bericht, open(os.path.join(a.ordner, 'ton_check.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"Lautheit {I} LUFS ({'ok' if bericht['ok_lautheit'] else 'NICHT ok'}), Spitze {P} dBTP ({'ok' if bericht['ok_spitze'] else 'NICHT ok'})")
print(f"Stille ab 0,4 s: {stille or 'keine'}  |  hörbare Anschläge: {len(einsaetze)}" +
      (f"  |  Klang-Ereignisse hörbar: {bericht['ereignisse_hoerbar']}" if a.events else ''))
print('Bild:', os.path.join(a.ordner, 'ton_bild.png'))
