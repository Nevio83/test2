"""Musik "hören" (messen) und passend auswählen – nur numpy + ffmpeg, keine Zusatzpakete.

   py Marketing/cgi/spot/musik.py analyse
        misst alle freigegebenen Stücke aus Marketing/musik (lizenzen.json: gewerblich_erlaubt = true):
        Tempo (BPM), erster Schlag, Taktlänge, Lautheit, Helligkeit (Klangfarbe), Energieverlauf, ruhige/volle Stellen.
        Ergebnis: Marketing/musik/analyse.json (wird von "wahl" gelesen).

   py Marketing/cgi/spot/musik.py wahl --dauer 11.2 --stimmung ruhig|warm|klar|lebhaft|filmisch [--stimme]
        wählt Stück + Startsekunde (auf einem Taktanfang, im Abschnitt mit gleichmäßiger Energie) und gibt
        die Befehlsteile für spot_ton.py aus (--musik ... --musik-ab ...) sowie die Schlaglänge, damit
        Szenenwechsel auf den Takt gelegt werden können.

Stimmung -> Stück (Vorschlag, die Messung entscheidet mit):
   ruhig    lofi_chill_88bpm        Nachtlampe, Diffusor, Wellness, Abend
   warm     cinematic_soft_96bpm    Geschenk, Wissensvideo (unter Stimme)
   klar     clean_minimal_112bpm    Technik, Motion-Spot, Finder, Drucker
   lebhaft  bright_pop_128bpm       Farben/Galerie, Mixer, Becher
   filmisch upbeat_house_124bpm     Küche/Aktion, schnelle Schnitte
"""
import argparse, json, os, subprocess, sys
import numpy as np

STAMM = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
MUSIK = os.path.join(STAMM, 'Marketing', 'musik')
SR = 22050
STIMMUNG = {'ruhig': 'lofi_chill_88bpm.mp3', 'warm': 'cinematic_soft_96bpm.mp3', 'klar': 'clean_minimal_112bpm.mp3',
            'lebhaft': 'bright_pop_128bpm.mp3', 'filmisch': 'upbeat_house_124bpm.mp3'}


def lade(datei):
    roh = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', datei, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(roh, dtype=np.int16).astype(np.float32) / 32768


def lufs(datei):
    m = subprocess.run(['ffmpeg', '-nostdin', '-i', datei, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    z = [l.strip() for l in m.splitlines() if l.strip().startswith(('I:', 'Peak:'))]
    return float(z[-2].split()[1]), float(z[-1].split()[1])


def analyse_stueck(datei):
    x = lade(datei); n_fft, hop = 2048, 512
    fen = np.hanning(n_fft).astype(np.float32)
    nfr = 1 + (len(x) - n_fft) // hop
    idx = np.arange(n_fft)[None, :] + hop * np.arange(nfr)[:, None]
    spec = np.abs(np.fft.rfft(x[idx] * fen, axis=1))
    fr_t = (np.arange(nfr) * hop + n_fft / 2) / SR
    # Einsatzstärke (spektraler Fluss) -> Tempo über Autokorrelation
    lg = np.log1p(spec * 10)
    flux = np.maximum(0, np.diff(lg, axis=0)).sum(1); flux = np.concatenate([[0], flux])
    flux = (flux - flux.mean()) / (flux.std() + 1e-9)
    fps = SR / hop; ac = np.correlate(flux, flux, 'full')[len(flux) - 1:]
    lags = np.arange(len(ac)); bpm_l = 60 * fps / np.maximum(lags, 1)
    ok = (bpm_l >= 70) & (bpm_l <= 180)
    gew = ac * np.exp(-0.5 * (np.log2(np.maximum(bpm_l, 1) / 115)) ** 2)   # leichte Vorliebe für 90–140
    lag = lags[ok][np.argmax(gew[ok])]
    bpm = 60 * fps / lag
    # Phase: Verschiebung, bei der die Schläge am meisten Einsatzstärke treffen
    per = lag; ph = np.argmax([flux[p::per].sum() for p in range(per)])
    schlag0 = float(fr_t[ph]); schlag = 60 / bpm
    # Energie (RMS) je Schlag, Helligkeit
    rms = np.sqrt((spec ** 2).mean(1)); rms = rms / (rms.max() + 1e-9)
    freqs = np.fft.rfftfreq(n_fft, 1 / SR)
    zentroid = float((spec * freqs).sum() / (spec.sum() + 1e-9))
    dauer = len(x) / SR
    sek = np.arange(0, int(dauer))
    energie = [round(float(rms[(fr_t >= s) & (fr_t < s + 1)].mean()), 3) for s in sek]
    voll = [s for s, e in zip(sek, energie) if e >= 0.6]
    I, P = lufs(datei)
    return {'bpm': round(float(bpm), 1), 'schlag_s': round(schlag, 4), 'takt_s': round(4 * schlag, 3), 'erster_schlag_s': round(schlag0, 3),
            'dauer_s': round(dauer, 2), 'lufs': I, 'spitze_dbtp': P, 'helligkeit_hz': round(zentroid),
            'energie_je_s': energie, 'erste_volle_s': int(voll[0]) if voll else 0}


def freigegeben():
    liz = json.load(open(os.path.join(MUSIK, 'lizenzen.json'), encoding='utf-8'))['stuecke']
    return [k for k, v in liz.items() if v.get('gewerblich_erlaubt') is True and os.path.exists(os.path.join(MUSIK, k))]


def cmd_analyse(a):
    erg = {'_hinweis': 'Erzeugt von Marketing/cgi/spot/musik.py analyse. Nur Stücke mit gewerblich_erlaubt = true.', 'stuecke': {}}
    for k in freigegeben():
        print('messe', k, flush=True); erg['stuecke'][k] = analyse_stueck(os.path.join(MUSIK, k))
        s = erg['stuecke'][k]; print(f"   {s['bpm']} BPM, Takt {s['takt_s']} s, {s['lufs']} LUFS, Helligkeit {s['helligkeit_hz']} Hz, voll ab {s['erste_volle_s']} s")
    json.dump(erg, open(os.path.join(MUSIK, 'analyse.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('geschrieben: Marketing/musik/analyse.json')


def cmd_wahl(a):
    p = os.path.join(MUSIK, 'analyse.json')
    if not os.path.exists(p): sys.exit('Erst "musik.py analyse" laufen lassen.')
    an = json.load(open(p, encoding='utf-8'))['stuecke']
    name = a.stueck or STIMMUNG[a.stimmung]
    if name not in an: sys.exit(f'{name} nicht freigegeben/analysiert. Freigegeben: {", ".join(an)}')
    s = an[name]; e = np.array(s['energie_je_s']); D = a.dauer
    # Start: Abschnitt der Länge D mit hoher, gleichmäßiger Energie; bei Stimme lieber ruhiger
    best, bw = 0.0, -9
    for st in range(0, max(1, int(len(e) - D))):
        f = e[st:st + int(np.ceil(D))]
        if len(f) == 0: continue
        w = (-abs(f.mean() - 0.55) if a.stimme else f.mean()) - f.std()
        if w > bw: bw, best = w, st
    # auf den nächsten Taktanfang legen
    t0, takt = s['erster_schlag_s'], s['takt_s']
    k = max(0, round((best - t0) / takt)); ab = round(t0 + k * takt, 3)
    if ab + D > s['dauer_s']: ab = max(0.0, round(s['dauer_s'] - D - 0.5, 3))
    print(json.dumps({'stueck': name, 'musik_ab_s': ab, 'bpm': s['bpm'], 'schlag_s': s['schlag_s'], 'takt_s': takt,
                      'szenenlaengen_auf_schlag_s': [round(s['schlag_s'] * k, 2) for k in (2, 3, 4) if s['schlag_s'] * k <= 2.2],
                      'spot_ton_teil': f'Marketing/musik/{name} ... --musik-ab {ab}',
                      'musik_db': -12 if a.stimme else -6}, ensure_ascii=False, indent=1))


ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
sub.add_parser('analyse')
w = sub.add_parser('wahl'); w.add_argument('--dauer', type=float, required=True); w.add_argument('--stimmung', choices=list(STIMMUNG), default='klar')
w.add_argument('--stueck'); w.add_argument('--stimme', action='store_true')
a = ap.parse_args()
{'analyse': cmd_analyse, 'wahl': cmd_wahl}[a.cmd](a)
