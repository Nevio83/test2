import sys, time, subprocess, threading, http.server, functools, socketserver, argparse, os
from playwright.sync_api import sync_playwright
def serve(root, port):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a): pass
    socketserver.ThreadingTCPServer.allow_reuse_address=True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), functools.partial(Q, directory=root))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd
ap=argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('--out',default='out/test.mp4')
ap.add_argument('--fps',type=int,default=30); ap.add_argument('--von',type=float,default=0); ap.add_argument('--bis',type=float,default=1)
ap.add_argument('--port',type=int,default=8765); ap.add_argument('--stills',default='')
ap.add_argument('--q',type=int,default=93); ap.add_argument('--stilldir',default='out')
a=ap.parse_args()
root=os.path.dirname(os.path.abspath(__file__))+'/..'
serve(root,a.port)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'])
    pg=b.new_page(viewport={'width':1080,'height':1920})
    msgs=[]; pg.on('console', lambda m: msgs.append(m.text)); pg.on('pageerror', lambda e: msgs.append('ERR '+str(e)))
    pg.goto(f'http://127.0.0.1:{a.port}/{a.page}')
    try:
        pg.wait_for_function('window.__ready===true', timeout=60000)
    except Exception as e:
        print('\n'.join(msgs)); raise
    if a.stills:
        for t in [float(x) for x in a.stills.split(',')]:
            pg.evaluate(f'window.__frame({t})')
            pg.screenshot(path=f'{a.stilldir}/still_{t:05.2f}.jpg', type='jpeg', quality=90)
        print('\n'.join(msgs[-20:])); b.close(); sys.exit()
    n=int(round((a.bis-a.von)*a.fps))
    ff=subprocess.Popen(['ffmpeg','-nostdin','-v','error','-y','-f','image2pipe','-framerate',str(a.fps),'-i','-',
        '-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p',a.out],stdin=subprocess.PIPE)
    t0=time.time()
    for i in range(n):
        t=a.von+i/a.fps
        pg.evaluate(f'window.__frame({t})')
        ff.stdin.write(pg.screenshot(type='jpeg',quality=a.q))
        if i%30==0: print(f'frame {i}/{n}  {(time.time()-t0)/(i+1):.2f}s/frame', flush=True)
    ff.stdin.close(); ff.wait(); print(f'fertig {n} frames in {time.time()-t0:.0f}s'); print('\n'.join(msgs[-10:]))
    b.close()
