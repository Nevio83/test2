"""Bild + Ton zusammenfuehren, auf <=10 MB begrenzen, Lautheit/Spitzen nach AAC pruefen, Titelbild ziehen.
   python3 lib/finish.py bild.mp4 ton.wav ziel.mp4 --titel 8.6
   python3 lib/finish.py bild.mp4 ton.wav ziel.mp4 --loop 0.4 --titel 1.5

   --loop F  Loop-Clip: Die letzten F Sekunden (Bild und Ton) werden in die ersten F Sekunden
             ueberblendet, die Datei beginnt bei Sekunde F des Renders. Ihr letztes Bild ist damit
             ihr erstes, beim Wiederholen gibt es keinen Sprung. Die Datei wird F Sekunden kuerzer
             als bild.mp4, fuer 8 s Ergebnis also 8 + F Sekunden rendern.
             Die Szene muss trotzdem so enden, wie sie anfaengt (gleiche Kamera, gleiches Licht,
             gleicher Text); die Ueberblendung glaettet nur den Rest. Kein Klang-Logo und kein
             Schlussakkord am Ende, sonst hoert man die Naht.
   --titel   Sekunde in der FERTIGEN Datei (beim Loop also Renderzeit minus F).
"""
import argparse, subprocess, json, os
from fractions import Fraction

ap = argparse.ArgumentParser(); ap.add_argument('bild'); ap.add_argument('ton'); ap.add_argument('ziel')
ap.add_argument('--titel', type=float, default=None); ap.add_argument('--maxrate', default='4800k')
ap.add_argument('--loop', type=float, default=None)
a = ap.parse_args()
enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-maxrate', a.maxrate, '-bufsize', '9600k', '-profile:v', 'high', '-level', '4.1',
       '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart']
if a.loop is None:
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', a.bild, '-i', a.ton, '-map', '0:v:0', '-map', '1:a:0',
                    *enc, '-shortest', a.ziel], check=True)
else:
    st = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
                                    'stream=nb_read_frames,r_frame_rate', '-of', 'json', a.bild],
                                   capture_output=True, text=True, check=True).stdout)['streams'][0]
    fps, n = Fraction(st['r_frame_rate']), int(st['nb_read_frames'])
    f = max(2, round(a.loop * fps))                  # Ueberblendung in Bildern
    if n < 4 * f:
        raise SystemExit(f'--loop {a.loop}: Video zu kurz ({n} Bilder)')
    d, l = float(n / fps), float(f / fps)            # Renderlaenge und Ueberblendung in Sekunden
    x = float((f - 1) / fps)                         # Bild-Ueberblendung endet ein Bild frueher: letztes Bild = reiner Anfang
    fc = (f'[0:v]split=3[v1][v2][v3];'
          f'[v1]trim=start_frame={f}:end_frame={n - f},setpts=PTS-STARTPTS[mitte];'
          f'[v2]trim=start_frame={n - f}:end_frame={n},setpts=PTS-STARTPTS[ende];'
          f'[v3]trim=start_frame=0:end_frame={f},setpts=PTS-STARTPTS[anfang];'
          f'[ende][anfang]xfade=transition=fade:duration={x:.6f}:offset=0[naht];'
          f'[mitte][naht]concat=n=2:v=1:a=0[v];'
          f'[1:a]atrim=end={d:.6f},asetpts=PTS-STARTPTS,asplit=3[a1][a2][a3];'
          f'[a1]atrim=start={l:.6f}:end={d - l:.6f},asetpts=PTS-STARTPTS[amitte];'
          f'[a2]atrim=start={d - l:.6f},asetpts=PTS-STARTPTS[aende];'
          f'[a3]atrim=end={l:.6f},asetpts=PTS-STARTPTS[aanfang];'
          f'[aende][aanfang]acrossfade=d={l:.6f}:c1=tri:c2=tri[anaht];'
          f'[amitte][anaht]concat=n=2:v=0:a=1[a]')
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', a.bild, '-i', a.ton, '-filter_complex', fc,
                    '-map', '[v]', '-map', '[a]', *enc, a.ziel], check=True)
pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate', '-of', 'json', a.ziel], capture_output=True, text=True).stdout)
m = subprocess.run(['ffmpeg', '-nostdin', '-i', a.ziel, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
lines = [l.strip() for l in m.splitlines() if l.strip().startswith(('I:', 'Peak:'))]
print(f"{os.path.basename(a.ziel)}: {float(pr['format']['duration']):.2f}s  {int(pr['format']['size'])/1e6:.2f} MB  " +
      ' '.join(f"{s['codec_name']}{' %sx%s' % (s['width'], s['height']) if 'width' in s else ''}" for s in pr['streams']) + f"  {lines[-2]}  TP {lines[-1]}" +
      (f"  Loop {a.loop:g} s" if a.loop is not None else ''))
if a.titel is not None:
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', str(a.titel), '-i', a.ziel, '-frames:v', '1', '-q:v', '2', a.ziel.replace('.mp4', '_titelbild.jpg')], check=True)
