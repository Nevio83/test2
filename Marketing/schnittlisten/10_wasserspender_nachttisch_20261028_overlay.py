"""Animierte Overlays fuer den Schnitt "Mein Nachttisch hat ein Geheimnis." (Wasserspender, 11,17 s):
Werbung-Pille durchgehend, Produktwort in den ersten 3 s, Text-Einblendungen mit Pop-in, Endkarte, die von unten
hereinschiebt. Schreibt eine PNG-Sequenz mit Alpha (30 fps)."""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, D = 1080, 1920, 30, 11.17
OUT = 'ov'; os.makedirs(OUT, exist_ok=True)
F_XB = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
F_B = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
if not os.path.exists(F_B): F_B = F_XB
font = lambda p, s: ImageFont.truetype(p, s)

TEXTS = [  # start, ende, Zeilen
    (0.0, 2.3, ['Mein Nachttisch', 'hat ein Geheimnis.']),
    (3.35, 5.05, ['Kein Kanister', 'in Sicht.']),
    (5.15, 6.70, ['Die Flasche wohnt', 'im Schrank.']),
    (6.80, 8.45, ['Schlauch rein.', 'Knopf drücken.']),
]
END0 = 9.35

def ease_out_back(x):
    c1 = 1.70158; c3 = c1 + 1; x = min(max(x, 0), 1)
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2

def text_block(lines, size=76):
    f = font(F_XB, size)
    pad = 10; lh = int(size * 1.18)
    widths = [f.getbbox(l)[2] - f.getbbox(l)[0] for l in lines]
    bw, bh = max(widths) + 2 * pad + 40, lh * len(lines) + 2 * pad + 20
    img = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    sh = Image.new('RGBA', (bw, bh), (0, 0, 0, 0)); ds = ImageDraw.Draw(sh)
    d = ImageDraw.Draw(img)
    for i, l in enumerate(lines):
        w = widths[i]; x = (bw - w) / 2; y = pad + 10 + i * lh
        ds.text((x, y + 3), l, font=f, fill=(0, 0, 0, 200))
        d.text((x, y), l, font=f, fill=(255, 255, 255, 255))
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    out = Image.alpha_composite(sh, sh); out = Image.alpha_composite(out, img)
    return out

def pill(text, size=28, spacing=4, bg=(0, 0, 0, 115)):
    f = font(F_B, size)
    t = text if spacing == 0 else text
    bb = f.getbbox(t); w = bb[2] - bb[0] + (len(t) * spacing if spacing else 0)
    img = Image.new('RGBA', (w + 40, size + 22), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, img.width - 1, img.height - 1], 12, fill=bg)
    x = 20
    for ch in t:
        d.text((x, 9), ch, font=f, fill=(255, 255, 255, 255)); x += f.getbbox(ch)[2] - f.getbbox(ch)[0] + spacing if ch != ' ' else size * 0.3 + spacing
    return img

P_WERB = pill('WERBUNG', 28, 4)
P_WORD = pill('Wasserspender', 32, 0)
BLOCKS = [(a, b, text_block(l)) for a, b, l in TEXTS]

def endcard():
    cw, ch = 860, 560
    img = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, cw - 1, ch - 1], 36, fill=(12, 16, 20, 188))
    f1, f2, f3, f4 = font(F_B, 46), font(F_XB, 150), font(F_B, 44), font(F_XB, 46)
    def c(t, f, y, fill=(255, 255, 255, 255)):
        bb = f.getbbox(t); d.text(((cw - (bb[2] - bb[0])) / 2 - bb[0], y), t, font=f, fill=fill)
    c('Elektrischer Wasserspender', f1, 38)
    c('38,99 €', f2, 104)
    c('Weiß · Schwarz', f3, 300, (225, 232, 236, 255))
    bw, bh = 420, 92; x0 = (cw - bw) / 2; y0 = 400
    d.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], 22, fill=(255, 255, 255, 255))
    bb = f4.getbbox('Link im Profil'); d.text(((cw - (bb[2] - bb[0])) / 2 - bb[0], y0 + (bh - (bb[3] - bb[1])) / 2 - bb[1]), 'Link im Profil', font=f4, fill=(17, 17, 17, 255))
    return img
END = endcard()

def paste_scaled(base, im, cx, cy, s, a):
    if a <= 0.001: return
    w, h = max(1, int(im.width * s)), max(1, int(im.height * s))
    t = im.resize((w, h), Image.LANCZOS)
    if a < 1:
        al = t.getchannel('A').point(lambda v: int(v * a)); t.putalpha(al)
    base.alpha_composite(t, (int(cx - w / 2), int(cy - h / 2)))

N = int(round(D * FPS))
TCX = 470   # Textmitte links der rechten Sperrzone (wie im Handy-Look)
for i in range(N):
    t = i / FPS
    fr = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fr.alpha_composite(P_WERB, (84, 208))
    if t < 3.0:
        a = 1 - min(max((t - 2.85) / 0.15, 0), 1)
        tmp = P_WORD.copy(); tmp.putalpha(tmp.getchannel('A').point(lambda v: int(v * a))); fr.alpha_composite(tmp, (84 + P_WERB.width + 10, 208))
    for a0, a1, blk in BLOCKS:
        if a0 <= t < a1:
            k = (t - a0) / 0.24 if a0 > 0 else 1.0          # erste Einblendung steht ab Bild 0
            s = 0.8 + 0.2 * ease_out_back(k); al = min(1, (t - a0) / 0.08) if a0 > 0 else 1
            al *= 1 - min(max((t - (a1 - 0.1)) / 0.1, 0), 1)
            paste_scaled(fr, blk, TCX, 330 + blk.height / 2, s, al)
    if t >= END0:
        k = min(1, (t - END0) / 0.32); y = 1500 - 520 * (1 - (1 - k) ** 3)
        paste_scaled(fr, END, TCX, y - 300 + 0, 1.0, min(1, k * 1.6))
    fr.save(f'{OUT}/o_{i:04d}.png')
print('frames', N)
