/**
 * product-video.js — Produkt-Video in der Galerie
 *
 * Blendet auf einer Produktseite ein optionales Produktvideo (z.B. das
 * TikTok-Creative) direkt in der Bildergalerie ein: als erstes Thumbnail mit
 * Play-Symbol, per Klick laeuft das Video als Overlay ueber dem Hauptbild.
 *
 * Gepflegt wird das ueber ein optionales Feld in products.json:
 *   "video":       "produkt videos/<datei>.mp4"   (Pflicht fuers Anzeigen)
 *   "videoPoster": "produkt bilder/<datei>.jpg"   (optional, sonst product.image)
 * Fehlt "video", passiert nichts — kein zusaetzliches Markup, kein Fehler.
 *
 * Bewusst NICHT in product-gallery-complete.js integriert: die Galerie arbeitet
 * intern mit Positions-Indizes ueber .gallery-thumbnail. Ein zusaetzliches
 * Element in dieser Liste wuerde Farb-/Bundle-Zuordnung verschieben. Das
 * Video-Thumbnail traegt daher eine eigene Klasse (.pv-thumb) und laeuft als
 * Overlay — die Galerie-Logik bleibt voellig unberuehrt.
 */
(function () {
  'use strict';

  var pid = Number(document.body && document.body.dataset && document.body.dataset.productId);
  if (!Number.isFinite(pid)) return; // keine Produktseite

  /** Baut aus einem products.json-Pfad eine root-relative URL. */
  function toUrl(p) {
    if (!p) return '';
    if (/^(https?:)?\/\//.test(p) || p.charAt(0) === '/') return p;
    return '/' + p;
  }

  function injectStyles() {
    if (document.getElementById('pv-styles')) return;
    var css =
      // Rahmen fuer Seiten ohne gebaute Galerie (Einzelbild) — nur Positionierung,
      // Groesse/Optik kommen weiterhin vom Bild selbst (.pp-main-img).
      '.pv-stage{position:relative;display:block}' +
      '.pv-stage>img{display:block}' +
      '.pv-thumb{position:relative;width:78px;height:78px;border-radius:14px;' +
      'border:2px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);' +
      'overflow:hidden;cursor:pointer;flex-shrink:0;padding:0;transition:border-color .2s}' +
      '.pv-thumb:hover,.pv-thumb:focus-visible{border-color:rgba(139,92,246,.6);outline:none}' +
      '.pv-thumb img{width:100%;height:100%;object-fit:contain;display:block}' +
      '.pv-thumb-play{position:absolute;inset:0;display:flex;align-items:center;' +
      'justify-content:center;background:rgba(0,0,0,.35)}' +
      '.pv-thumb-play svg{width:26px;height:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}' +
      '.pv-thumb-tag{position:absolute;left:0;right:0;bottom:0;font-size:9px;' +
      'font-weight:700;letter-spacing:.4px;text-align:center;color:#fff;' +
      'background:rgba(0,0,0,.6);padding:2px 0}' +
      '.pv-overlay{position:absolute;inset:0;z-index:20;background:#000;' +
      'border-radius:24px;overflow:hidden;display:flex;align-items:center;justify-content:center}' +
      '.pv-overlay video{width:100%;height:100%;object-fit:contain;background:#000}' +
      '.pv-close{position:absolute;top:10px;right:10px;z-index:21;width:34px;height:34px;' +
      'border-radius:50%;border:none;background:rgba(0,0,0,.6);color:#fff;font-size:20px;' +
      'line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}' +
      '.pv-close:hover,.pv-close:focus-visible{background:rgba(0,0,0,.85);outline:none}' +
      '@media(max-width:768px){.pv-thumb{width:60px;height:60px}' +
      '.pv-thumb-play svg{width:20px;height:20px}.pv-thumb-tag{font-size:8px}}';
    var s = document.createElement('style');
    s.id = 'pv-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /**
   * Ruft cb auf, sobald der DOM steht UND product-gallery-complete.js seinen
   * DOMContentLoaded-Handler abgearbeitet hat (dieses Skript wird nach der
   * Galerie eingebunden, das setTimeout(0) laesst ihr also den Vortritt).
   */
  function whenReady(cb) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(cb, 0); });
    } else {
      setTimeout(cb, 0);
    }
  }

  /**
   * Findet die Ankerpunkte fuer Overlay und Thumbnail-Streifen. Es gibt zwei
   * Layouts: die Galerie baut nur fuer Produkte mit mehreren Bildern einen
   * .gallery-main-image-Container; alle anderen Seiten behalten das schlichte
   * Einzelbild in .pp-gallery — dort wird das Bild in einen positionierten
   * Rahmen gehaengt und ein Streifen angelegt. Gibt null zurueck, wenn gar
   * kein Produktbild da ist.
   */
  function resolveMounts() {
    var galleryMain = document.querySelector('.gallery-main-image');
    if (galleryMain) {
      var strip = document.querySelector('.gallery-thumbnails');
      if (!strip) {
        strip = document.createElement('div');
        strip.className = 'gallery-thumbnails';
        galleryMain.parentElement.appendChild(strip);
      }
      return { stage: galleryMain, strip: strip };
    }

    var img = document.querySelector('.pp-gallery .main-product-image, .main-product-image');
    if (!img || !img.parentElement) return null;

    var stage = document.createElement('div');
    stage.className = 'pv-stage';
    img.parentElement.insertBefore(stage, img);
    stage.appendChild(img); // Bild-Element bleibt erhalten -> Farb-/Zoom-Logik laeuft weiter

    var newStrip = document.createElement('div');
    newStrip.className = 'gallery-thumbnails';
    stage.parentElement.insertBefore(newStrip, stage.nextSibling);
    return { stage: stage, strip: newStrip };
  }

  function mount(product, mainContainer, strip) {
    var videoUrl = toUrl(product.video);
    var posterUrl = toUrl(product.videoPoster || product.image);
    var overlay = null;

    function closeVideo() {
      if (!overlay) return;
      var v = overlay.querySelector('video');
      if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
      overlay.remove();
      overlay = null;
      document.removeEventListener('keydown', onKey, true);
    }

    // Capture-Phase noetig: keyboard-shortcuts.js haengt ebenfalls im Capture an
    // document und ruft bei Escape stopPropagation() — ein Bubble-Listener wuerde
    // nie ausgeloest. stopPropagation() blockt keine weiteren Listener am selben
    // Element in derselben Phase, dieser hier laeuft also trotzdem.
    function onKey(e) {
      if (e.key === 'Escape') closeVideo();
    }

    function openVideo() {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.className = 'pv-overlay';

      var video = document.createElement('video');
      video.src = videoUrl;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('playsinline', ''); // iOS: kein Zwangs-Vollbild
      video.preload = 'metadata';
      if (posterUrl) video.poster = posterUrl;
      // Schlaegt die Datei fehl (falscher Pfad, Codec), bleibt die Galerie nutzbar.
      video.addEventListener('error', function () {
        console.warn('⚠️ Produktvideo konnte nicht geladen werden:', videoUrl);
        closeVideo();
      });
      overlay.appendChild(video);

      var close = document.createElement('button');
      close.className = 'pv-close';
      close.type = 'button';
      close.innerHTML = '&times;';
      close.setAttribute('aria-label', 'Video schließen');
      close.addEventListener('click', function (e) {
        e.stopPropagation();
        closeVideo();
      });
      overlay.appendChild(close);

      mainContainer.appendChild(overlay);
      document.addEventListener('keydown', onKey, true);
    }

    // Video-Thumbnail — eigene Klasse, damit die Galerie-Indizes unberuehrt bleiben.
    var thumb = document.createElement('button');
    thumb.className = 'pv-thumb';
    thumb.type = 'button';
    thumb.setAttribute('aria-label', 'Produktvideo abspielen');

    if (posterUrl) {
      var img = document.createElement('img');
      img.src = posterUrl;
      img.alt = '';
      thumb.appendChild(img);
    }

    var play = document.createElement('div');
    play.className = 'pv-thumb-play';
    play.innerHTML =
      '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    thumb.appendChild(play);

    var tag = document.createElement('div');
    tag.className = 'pv-thumb-tag';
    tag.textContent = 'VIDEO';
    thumb.appendChild(tag);

    thumb.addEventListener('click', openVideo);
    strip.insertBefore(thumb, strip.firstChild);

    // Wechselt der Kunde auf ein Bild (Thumbnail oder Pfeil), Video ausblenden.
    strip.addEventListener('click', function (e) {
      if (!thumb.contains(e.target)) closeVideo();
    });
    var navs = mainContainer.querySelectorAll('.gallery-nav');
    for (var i = 0; i < navs.length; i++) {
      navs[i].addEventListener('click', closeVideo);
    }
  }

  fetch('/products.json')
    .then(function (r) { return r.json(); })
    .then(function (prods) {
      var p = prods.find(function (x) { return Number(x.id) === pid; });
      if (!p || !p.video) return; // kein Video gepflegt -> nichts tun
      whenReady(function () {
        var m = resolveMounts();
        if (!m) return;
        injectStyles();
        mount(p, m.stage, m.strip);
      });
    })
    .catch(function () { /* Video ist optional — Galerie funktioniert ohne */ });
})();
