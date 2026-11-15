import numpy as np, subprocess, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H,FPS=1080,1920,30
import os
def _f(*namen):
    # Poppins wie in der Cloud (abgenommener Look); lokal zuerst Marketing/cgi/real/fonts/, sonst Windows-Ersatz (Segoe UI)
    orte=[os.path.join(os.path.dirname(os.path.abspath(__file__)),'fonts'),'/usr/share/fonts/truetype/google-fonts','C:/Windows/Fonts']
    for n in namen:
        for o in orte:
            p=os.path.join(o,n)
            if os.path.exists(p): return p
    raise SystemExit('Schrift fehlt: '+', '.join(namen))
FB=_f('Poppins-Bold.ttf','segoeuib.ttf')
FS=_f('Poppins-SemiBold.ttf','seguisb.ttf','segoeuib.ttf')
FM=_f('Poppins-Medium.ttf','segoeui.ttf')
def font(p,s): return ImageFont.truetype(p,s)
def ease(x): x=max(0,min(1,x)); return x*x*(3-2*x)
def pipe(out,n,frame_fn):
    p=subprocess.Popen(['ffmpeg','-nostdin','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r',str(FPS),out],stdin=subprocess.PIPE)
    for i in range(n):
        im=frame_fn(i/FPS); p.stdin.write((im.convert('RGB').tobytes() if hasattr(im,'convert') else im.tobytes()))
    p.stdin.close(); p.wait()
def pill(d,xy,text,f,fill,tc):
    x,y=xy; w=d.textlength(text,font=f)
    d.rounded_rectangle((x,y,x+w+44,y+f.size+26),radius=(f.size+26)//2,fill=fill)
    d.text((x+22,y+10),text,font=f,fill=tc)
