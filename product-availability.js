/**
 * product-availability.js — Verfuegbarkeit auf der Produktseite.
 *
 * Bisher gab es im Shop gar keine Verfuegbarkeitsanzeige: das Feld inStock lag
 * zwar in den Produktdaten, wurde aber nirgends ausgewertet — ein bei CJ
 * ausverkauftes Produkt liess sich ganz normal kaufen.
 *
 * Dieses Skript liest die Verfuegbarkeit aus /products.json (dort mischt der
 * Server den aktuellen CJ-Bestandsstand dazu) und sperrt bei "nicht lieferbar"
 * die Kaufbuttons samt Hinweis.
 *
 * Das ist bewusst nur die sichtbare Haelfte. Verbindlich gesperrt wird im
 * Checkout auf dem Server (server.js, /api/create-checkout-session) — der
 * Warenkorb kommt aus localStorage und ist manipulierbar, eine reine
 * Browser-Sperre waere Deko.
 */
(function () {
  'use strict';

  var pid = Number(document.body && document.body.dataset && document.body.dataset.productId);
  if (!Number.isFinite(pid)) return; // keine Produktseite

  function injectStyles() {
    if (document.getElementById('pa-styles')) return;
    var s = document.createElement('style');
    s.id = 'pa-styles';
    s.textContent =
      '.pa-notice{display:flex;align-items:center;gap:10px;margin:14px 0;padding:12px 16px;' +
      'border-radius:14px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);' +
      'color:#fca5a5;font-size:14.5px;font-weight:600;line-height:1.4}' +
      '.pa-notice svg{flex-shrink:0;width:20px;height:20px}' +
      '.pa-notice small{display:block;font-weight:400;opacity:.85;margin-top:2px}' +
      '.pa-disabled{opacity:.45!important;cursor:not-allowed!important;filter:grayscale(.6)}';
    document.head.appendChild(s);
  }

  /** Sperrt einen Button hart: Klicks kommen gar nicht erst durch. */
  function disableButton(btn) {
    if (!btn) return;
    btn.classList.add('pa-disabled');
    btn.setAttribute('disabled', 'disabled');
    btn.setAttribute('aria-disabled', 'true');
    // Capture-Phase: die Kauf-Handler von produkt-premium.js haengen am Button
    // selbst und wuerden sonst trotz disabled-Attribut noch feuern.
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  function markUnavailable() {
    injectStyles();

    var notice = document.createElement('div');
    notice.className = 'pa-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>' +
      '<line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<span>Derzeit nicht lieferbar' +
      '<small>Der Artikel ist beim Lieferanten ausverkauft. Schau in ein paar Tagen wieder vorbei.</small></span>';

    var cartBtn = document.getElementById('cartBtn');
    if (cartBtn && cartBtn.parentElement) {
      cartBtn.parentElement.insertBefore(notice, cartBtn);
    } else {
      var box = document.querySelector('.pp-buybox');
      if (box) box.appendChild(notice);
    }

    disableButton(cartBtn);
    disableButton(document.querySelector('.pp-sticky-btn'));
  }

  function whenReady(cb) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(cb, 0); });
    } else {
      setTimeout(cb, 0);
    }
  }

  fetch('/products.json')
    .then(function (r) { return r.json(); })
    .then(function (prods) {
      var p = prods.find(function (x) { return Number(x.id) === pid; });
      // Nur bei ausdruecklichem false sperren. Fehlt das Feld, bleibt alles wie bisher.
      if (!p || p.inStock !== false) return;
      whenReady(markUnavailable);
    })
    .catch(function () { /* im Zweifel nicht sperren — Server blockt ohnehin */ });
})();
