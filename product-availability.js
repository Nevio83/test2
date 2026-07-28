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
      '.pa-disabled{opacity:.45!important;cursor:not-allowed!important;filter:grayscale(.6)}' +
      // Vormerkung
      '.pa-notify{margin:0 0 16px;padding:14px 16px;border-radius:14px;' +
      'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}' +
      '.pa-notify-label{display:block;font-size:14px;font-weight:600;margin-bottom:9px}' +
      '.pa-notify-row{display:flex;gap:8px;flex-wrap:wrap}' +
      '.pa-notify input{flex:1;min-width:170px;background:rgba(0,0,0,.3);color:inherit;' +
      'border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:11px 14px;' +
      'font-size:14.5px;font-family:inherit;outline:none}' +
      '.pa-notify input:focus{border-color:rgba(216,181,108,.6)}' +
      '.pa-notify button{background:#D8B56C;color:#13100B;border:none;border-radius:10px;' +
      'padding:11px 20px;font-weight:700;font-size:14.5px;font-family:inherit;cursor:pointer}' +
      '.pa-notify button:hover:not(:disabled){background:#E9CD8C}' +
      '.pa-notify button:disabled{opacity:.5;cursor:not-allowed}' +
      '.pa-notify-msg{margin:9px 0 0;font-size:13.5px;line-height:1.45}' +
      '.pa-notify-msg.ok{color:#86efac}.pa-notify-msg.err{color:#fca5a5}' +
      '.pa-notify-hint{margin:7px 0 0;font-size:12px;color:#8C8677;line-height:1.4}';
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

    var vormerkung = buildNotifyForm();

    var cartBtn = document.getElementById('cartBtn');
    if (cartBtn && cartBtn.parentElement) {
      cartBtn.parentElement.insertBefore(notice, cartBtn);
      cartBtn.parentElement.insertBefore(vormerkung, cartBtn);
    } else {
      var box = document.querySelector('.pp-buybox');
      if (box) { box.appendChild(notice); box.appendChild(vormerkung); }
    }

    disableButton(cartBtn);
    disableButton(document.querySelector('.pp-sticky-btn'));
  }

  /**
   * „Sag mir Bescheid, wenn es wieder da ist" — faengt genau die Kunden auf,
   * die schon kaufen wollten. Ohne das ist der Besuch verloren.
   */
  function buildNotifyForm() {
    var wrap = document.createElement('div');
    wrap.className = 'pa-notify';

    var label = document.createElement('label');
    label.className = 'pa-notify-label';
    label.setAttribute('for', 'pa-notify-mail');
    label.textContent = 'Sag mir Bescheid, wenn es wieder da ist';
    wrap.appendChild(label);

    var form = document.createElement('form');
    form.className = 'pa-notify-row';
    form.setAttribute('novalidate', '');

    var input = document.createElement('input');
    input.type = 'email';
    input.id = 'pa-notify-mail';
    input.placeholder = 'deine@email.de';
    input.autocomplete = 'email';
    input.required = true;

    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = 'Benachrichtigen';

    form.appendChild(input);
    form.appendChild(btn);
    wrap.appendChild(form);

    var msg = document.createElement('p');
    msg.className = 'pa-notify-msg';
    msg.setAttribute('role', 'status');
    msg.hidden = true;
    wrap.appendChild(msg);

    var hint = document.createElement('p');
    hint.className = 'pa-notify-hint';
    hint.textContent = 'Eine einzige E-Mail, sobald der Artikel wieder lieferbar ist. Keine Werbung.';
    wrap.appendChild(hint);

    function zeige(text, artOk) {
      msg.textContent = text;
      msg.className = 'pa-notify-msg ' + (artOk ? 'ok' : 'err');
      msg.hidden = false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var mail = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
        zeige('Bitte eine gültige E-Mail-Adresse eingeben.', false);
        input.focus();
        return;
      }
      btn.disabled = true;
      var vorher = btn.textContent;
      btn.textContent = 'Moment …';

      fetch('/api/stock-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mail, productId: pid })
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.ok && res.d.ok) {
            form.hidden = true;
            hint.hidden = true;
            zeige('✓ Eingetragen. Wir melden uns, sobald der Artikel wieder da ist.', true);
          } else {
            zeige(res.d.error || 'Das hat gerade nicht geklappt. Bitte später erneut versuchen.', false);
          }
        })
        .catch(function () {
          zeige('Verbindung fehlgeschlagen. Bitte später erneut versuchen.', false);
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = vorher;
        });
    });

    return wrap;
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
