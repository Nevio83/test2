/**
 * widerruf-button.js — EU-Widerrufsbutton
 *
 * Fügt auf jeder Seite einen gut sichtbaren, prominenten Button
 * „Vertrag widerrufen" in den Footer ein (absoluter Pfad → funktioniert aus
 * jeder Verzeichnistiefe). Erfüllt die EU-Vorgabe eines dauerhaft erreichbaren,
 * deutlich hervorgehobenen Widerruf-Zugangs.
 */
(function () {
  'use strict';

  // Nicht auf der Widerruf-Seite selbst oder im Admin-Bereich anzeigen
  var p = location.pathname;
  if (p.indexOf('widerruf.html') !== -1 || p.indexOf('a29715347575') !== -1) return;

  function build() {
    if (document.getElementById('eu-widerruf-link')) return;

    var a = document.createElement('a');
    a.id = 'eu-widerruf-link';
    a.href = '/infos/widerruf.html';
    a.textContent = '↩ Vertrag widerrufen';
    a.setAttribute('aria-label', 'Vertrag widerrufen (gesetzliches Widerrufsrecht)');

    // Prominenter Button-Stil (Marken-Akzent, sichtbar auf hell & dunkel)
    var btn =
      'display:inline-block;background:#E91E63;color:#fff;font-weight:700;' +
      'font-size:15px;line-height:1;padding:12px 24px;border-radius:999px;' +
      'text-decoration:none;box-shadow:0 4px 14px rgba(233,30,99,.4);' +
      'letter-spacing:.2px;';

    var footer = document.querySelector('footer');
    if (footer) {
      a.style.cssText = btn;
      var wrap = document.createElement('div');
      wrap.style.cssText = 'width:100%;text-align:center;margin-top:18px;';
      wrap.appendChild(a);
      footer.appendChild(wrap);
    } else {
      // Seiten ohne Footer: fixer, prominenter Button unten links
      a.style.cssText = btn + 'position:fixed;left:14px;bottom:14px;z-index:9998;';
      document.body.appendChild(a);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
