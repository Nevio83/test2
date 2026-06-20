/**
 * widerruf-button.js — EU-Widerrufsbutton
 *
 * Fügt auf jeder Seite einen gut sichtbaren Link „Vertrag widerrufen" in den
 * Footer ein (absoluter Pfad → funktioniert aus jeder Verzeichnistiefe).
 * Erfüllt die EU-Vorgabe eines dauerhaft erreichbaren Widerruf-Zugangs.
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

    var footer = document.querySelector('footer');
    if (footer) {
      // dezent in den vorhandenen Footer einreihen
      a.style.cssText =
        'display:inline-block;margin:10px auto 0;padding:0;color:inherit;' +
        'opacity:.85;font-size:14px;text-decoration:underline;text-align:center;';
      var wrap = document.createElement('div');
      wrap.style.cssText = 'width:100%;text-align:center;';
      wrap.appendChild(a);
      footer.appendChild(wrap);
    } else {
      // Seiten ohne Footer (z.B. Info-Seiten): dezenter fixer Link unten links
      a.style.cssText =
        'position:fixed;left:12px;bottom:12px;z-index:9998;background:#fff;' +
        'border:1px solid #ccc;border-radius:20px;padding:6px 14px;font-size:13px;' +
        'color:#333;text-decoration:none;box-shadow:0 2px 6px rgba(0,0,0,.15);';
      document.body.appendChild(a);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
