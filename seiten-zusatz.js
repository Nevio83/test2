/**
 * seiten-zusatz.js — Brotkrumen (sichtbar + Strukturdaten) und Kontakt-Knopf
 *
 * Wird von allen Kundenseiten außer der Startseite-Kasse eingebunden.
 *  1. Brotkrumen „Start › Seitenname" unter der Kopfleiste, dazu ein
 *     BreadcrumbList-Block für Google. Der Seitenname kommt aus dem <title>
 *     bzw. der Überschrift der Seite — nichts ist eingetippt.
 *  2. Ein dauerhaft sichtbarer Knopf „Fragen? Schreib uns" zur Kontaktseite.
 *     Er verspricht bewusst KEINEN Live-Support rund um die Uhr, sondern nur,
 *     was stimmt: Das Formular ist jederzeit erreichbar, die Antwort kommt in
 *     der Regel innerhalb von 24 Stunden (steht so auch auf der Kontaktseite).
 *
 * Stile laufen über element.style (CSSOM) — ein <style>-Block bräuchte unter
 * der CSP einen Hash (siehe csp-inline.js).
 */
(function () {
  'use strict';

  var pfad = location.pathname;
  if (pfad.indexOf('a29715347575') !== -1) return;          // Admin
  var istStart = pfad === '/' || /\/index\.html$/.test(pfad);

  function seitenname() {
    var t = (document.title || '').split(/\s[—–|-]\s/)[0].trim();
    if (!t) {
      var h = document.querySelector('h1');
      t = h ? h.textContent.trim() : '';
    }
    return t;
  }

  function brotkrumen() {
    if (istStart || document.getElementById('maios-brotkrumen')) return;
    var name = seitenname();
    if (!name) return;

    var nav = document.createElement('nav');
    nav.id = 'maios-brotkrumen';
    nav.setAttribute('aria-label', 'Brotkrumen');
    nav.style.cssText = 'max-width:1200px;margin:0 auto;padding:10px 16px;' +
      'font-size:13px;line-height:1.4;opacity:.8;';

    var start = document.createElement('a');
    start.href = '/';
    start.textContent = 'Start';
    start.style.cssText = 'color:inherit;text-decoration:underline;';

    var trenner = document.createElement('span');
    trenner.textContent = ' › ';
    trenner.setAttribute('aria-hidden', 'true');

    var aktuell = document.createElement('span');
    aktuell.textContent = name;
    aktuell.setAttribute('aria-current', 'page');

    nav.appendChild(start);
    nav.appendChild(trenner);
    nav.appendChild(aktuell);

    // Produktseiten: unter der Kopfleiste; Infoseiten: vor der Überschrift
    var ziel = document.querySelector('.pp-nav');
    if (ziel && ziel.parentNode) {
      ziel.parentNode.insertBefore(nav, ziel.nextSibling);
    } else {
      var haupt = document.querySelector('main') || document.querySelector('.container') || document.body;
      haupt.insertBefore(nav, haupt.firstChild);
    }

    var ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Start', item: location.origin + '/' },
        { '@type': 'ListItem', position: 2, name: name, item: location.origin + pfad }
      ]
    });
    document.head.appendChild(ld);
  }

  function kontaktKnopf() {
    if (pfad.indexOf('/infos/kontakt.html') !== -1) return;  // dort ist das Formular selbst
    if (document.getElementById('maios-kontakt-knopf')) return;

    var a = document.createElement('a');
    a.id = 'maios-kontakt-knopf';
    a.href = '/infos/kontakt.html';
    a.textContent = 'Fragen? Schreib uns';
    a.title = 'Kontaktformular – Antwort in der Regel innerhalb von 24 Stunden';
    a.setAttribute('aria-label', 'Fragen? Zum Kontaktformular – Antwort in der Regel innerhalb von 24 Stunden');
    // Produktseiten haben unten eine Kaufleiste (#pp-sticky, ca. 80 px hoch,
    // blendet sich beim Scrollen ein) — der Knopf sitzt dann darüber.
    var unten = document.getElementById('pp-sticky') ? 100 : 16;
    a.style.cssText = 'position:fixed;right:16px;bottom:' + unten + 'px;z-index:9997;' +
      'background:#D8B56C;color:#13100B;font-weight:700;font-size:14px;line-height:1;' +
      'padding:12px 18px;border-radius:999px;text-decoration:none;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.35);';
    document.body.appendChild(a);
  }

  function los() { brotkrumen(); kontaktKnopf(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', los);
  } else {
    los();
  }
})();
