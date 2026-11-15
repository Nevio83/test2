from common import *
import sys,json
CFG=json.load(open(sys.argv[1],encoding='utf-8')); np.random.seed(5)
_B=os.path.dirname(os.path.abspath(sys.argv[1]))
for it in CFG['items']:   # Pfade: "pb/..." (Cloud) oder "produkt bilder/..." relativ zum Repo-Stamm
    p=it[1].replace('pb/','produkt bilder/',1) if it[1].startswith('pb/') else it[1]
    if not os.path.isabs(p):
        for basis in (os.getcwd(),_B,os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','..')):
            if os.path.exists(os.path.join(basis,p)): p=os.path.join(basis,p); break
    it[1]=p
SEG=CFG['seg']; LAST=CFG['last']; SW=0.22
order=CFG['items']; N=len(order); DUR=SEG*(N-1)+LAST
SC=1450; Y0=420
def prep(path):
    im=Image.open(path).convert('RGB'); w,h=im.size; m=min(w,h)
    im=im.crop(((w-m)//2,(h-m)//2,(w+m)//2,(h+m)//2)).resize((int(SC*1.04),int(SC*1.04)),Image.LANCZOS)
    return im
CACHE=[prep(p) for _,p in order]
def canvas(i,lt):
    im=CACHE[i]; S=im.size[0]
    z=1.0+0.05*min(1,lt/max(SEG,LAST)); s=int(SC*z)
    hx=math.sin(lt*2.1+i)*8+math.sin(lt*5.3+i)*3; hy=math.cos(lt*1.7+i*2)*7+math.sin(lt*4.4)*2
    ph=im.resize((s,s),Image.BILINEAR)
    x=(W-s)//2+int(hx); y=Y0-(s-SC)//2+int(hy)
    fr=Image.new('RGB',(W,H))
    fr.paste(ph,(x,y))
    if y>0:
        top=ph.crop((0,0,s,6)).resize((s,y+40)).filter(ImageFilter.GaussianBlur(25)); fr.paste(top,(x,0))
        m=Image.linear_gradient('L').resize((s,40)).transpose(Image.FLIP_TOP_BOTTOM); fr.paste(ph.crop((0,0,s,40)),(x,y),Image.eval(m,lambda v:255-v))
    bot_h=H-(y+s)
    if bot_h>0:
        b=ph.crop((0,s-6,s,s)).resize((s,bot_h)).filter(ImageFilter.GaussianBlur(25)); fr.paste(b,(x,y+s))
    return fr
def otext(d,xy,t,f,fill=(255,255,255),dark=False):
    if dark: d.text(xy,t,font=f,fill=(25,25,25) if fill==(255,255,255) else (150,95,40),anchor='ma')
    else: d.text(xy,t,font=f,fill=fill,stroke_width=6,stroke_fill=(15,15,15),anchor='ma')
fW=font(FM,34); f1=font(FB,56); f2=font(FB,48)
def frame(t):
    seg=min(int(t//SEG),N-1); lt=t-seg*SEG
    if seg>0 and lt<SW:
        p=ease(lt/SW); a=canvas(seg-1,SEG+lt); b=canvas(seg,lt)
        fr=Image.new('RGB',(W,H)); fr.paste(a,(-int(W*p),0)); fr.paste(b,(int(W*(1-p)),0))
        arr=np.asarray(fr).astype(np.float32); k=int(36*math.sin(math.pi*p))+1; st=max(1,k//4)
        rs=list(range(-k,k+1,st)); acc=sum(np.roll(arr,s_,axis=1) for s_ in rs)/len(rs)
        img=Image.fromarray(acc.astype(np.uint8))
    else:
        img=canvas(seg,lt)
        bf=max(0,8*(1-(lt-(SW if seg>0 else 0))/0.3))
        if bf>0.3: img=img.filter(ImageFilter.GaussianBlur(bf))
    # exposure breathing
    dk=np.asarray(img.crop((100,260,980,420)).convert('L')).mean()>170
    d=ImageDraw.Draw(img)
    end=t>=DUR-LAST+0.4
    l1=CFG['end1'] if end else (CFG['hook'] if t<CFG['mid_at'] else CFG['mid'])
    l2=CFG['end2'] if end else order[seg][0]
    XM=465   # Mitte des erlaubten Bereichs (rechts ab x 930 liegt TikToks Bedienleiste), nicht W//2
    if not (seg>0 and lt<SW) or end: otext(d,(XM,352),l2,f2,(255,226,140) if not end else (255,255,255),dk)
    otext(d,(XM,280),l1,f1,dark=dk)
    if end and CFG.get('end3'): otext(d,(XM,410),CFG['end3'],font(FM,34),dark=dk)   # Versandhinweis (Pflicht bei Preisnennung), knapp über der Fotokante – im Standbild prüfen
    pill(d,(50,200),"Werbung",fW,(15,15,15,230),(255,255,255))
    pill(d,(50+int(d.textlength("Werbung",font=fW))+44+14,200),CFG['wort'],fW,(232,232,232),(15,15,15))   # 14 px Abstand statt fester x=250 (Pillen berührten sich)
    arr=np.asarray(img).astype(np.int16)+np.random.normal(0,6,(H,W,1)).astype(np.int16)
    return Image.fromarray(np.clip(arr,0,255).astype(np.uint8))
if __name__=='__main__':
    out=sys.argv[2]
    if len(sys.argv)>3:
        for t in map(float,sys.argv[3:]): frame(t).save(f'{out}_{t}.png')
    else:
        pipe(out,int(DUR*FPS),frame)
        # Klang-Ereignisse für spot_ton.py: leiser Whoosh auf jedes Wischen, Ting, wenn Preis/Link erscheinen
        ev=[{'t':round(SEG*i,3),'typ':'whoosh','staerke':0.35} for i in range(1,N)]+[{'t':round(DUR-LAST+0.4,3),'typ':'ting','staerke':1.2}]
        json.dump({'dauer':round(DUR,3),'events':ev},open(os.path.splitext(out)[0]+'.events.json','w',encoding='utf-8'),indent=1)
