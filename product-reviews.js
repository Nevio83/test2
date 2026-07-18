/**
 * product-reviews.js — Produktbewertungen (Sterne + Text)
 *
 * Framework-frei, selbst-ladende CSS. Wird auf allen Produktseiten eingebunden
 * und liest die Produkt-ID aus <body data-product-id="NN">. Zeigt Aggregat
 * (Durchschnitt + Anzahl), die letzten Bewertungen und ein Formular zum Abgeben.
 *
 * Backend: GET /api/reviews/:productId  ·  POST /api/reviews
 * Faellt ohne Bewertungen/DB sauber auf einen leeren Zustand zurueck.
 */
(function () {
  'use strict';

  var productId = (document.body && document.body.dataset && document.body.dataset.productId) || '';
  productId = String(productId).replace(/[^0-9]/g, '');
  if (!productId) return; // keine Produktseite -> nichts tun

  // ── Selbst-ladende Styles (an das Premium-Dark-Design angelehnt) ──
  var css = ''
    + '.pr-wrap{max-width:900px;margin:48px auto;padding:0 20px;'
    + 'font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#ece9f2}'
    + '.pr-card{background:#15151c;border:1px solid #26262f;border-radius:16px;padding:28px}'
    + '.pr-head{display:flex;flex-wrap:wrap;align-items:center;gap:18px;justify-content:space-between;'
    + 'border-bottom:1px solid #26262f;padding-bottom:20px;margin-bottom:8px}'
    + '.pr-title{font-size:22px;font-weight:700;margin:0}'
    + '.pr-agg{display:flex;align-items:center;gap:12px}'
    + '.pr-avg{font-size:30px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}'
    + '.pr-agg-meta{font-size:13px;color:#9b97a8}'
    + '.pr-stars{display:inline-flex;gap:2px}'
    + '.pr-stars svg{width:18px;height:18px;display:block}'
    + '.pr-star-full{fill:#f5b301}.pr-star-empty{fill:#3a3a44}'
    + '.pr-list{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column}'
    + '.pr-item{padding:20px 0;border-top:1px solid #232329}'
    + '.pr-item:first-child{border-top:none}'
    + '.pr-item-top{display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap}'
    + '.pr-author{font-weight:600;font-size:15px}'
    + '.pr-date{font-size:12.5px;color:#716d7d;margin-left:auto}'
    + '.pr-item-title{font-weight:600;font-size:14.5px;margin:2px 0 4px}'
    + '.pr-item-body{font-size:14.5px;color:#c8c4d4;line-height:1.6;margin:0;white-space:pre-wrap;word-break:break-word}'
    + '.pr-empty{color:#9b97a8;font-size:15px;padding:22px 0 6px}'
    + '.pr-formwrap{margin-top:26px;border-top:1px solid #26262f;padding-top:24px}'
    + '.pr-form-title{font-size:16px;font-weight:700;margin:0 0 16px}'
    + '.pr-field{margin-bottom:14px}'
    + '.pr-label{display:block;font-size:13px;color:#b9b5c6;margin-bottom:6px;font-weight:600}'
    + '.pr-input,.pr-textarea{width:100%;box-sizing:border-box;background:#0f0f14;border:1px solid #2c2c36;'
    + 'border-radius:10px;color:#ece9f2;font-size:14.5px;padding:11px 13px;font-family:inherit}'
    + '.pr-input:focus,.pr-textarea:focus{outline:none;border-color:#6a5cff;box-shadow:0 0 0 3px rgba(106,92,255,.22)}'
    + '.pr-textarea{min-height:96px;resize:vertical}'
    + '.pr-ratepick{display:inline-flex;gap:4px}'
    + '.pr-ratepick button{background:none;border:none;padding:2px;cursor:pointer;line-height:0}'
    + '.pr-ratepick svg{width:30px;height:30px}'
    + '.pr-ratepick .pr-star-empty{transition:fill .12s ease}'
    + '.pr-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}'
    + '.pr-submit{background:linear-gradient(135deg,#6a5cff,#8b5cf6);color:#fff;border:none;border-radius:10px;'
    + 'font-size:15px;font-weight:700;padding:12px 26px;cursor:pointer;transition:filter .15s ease}'
    + '.pr-submit:hover{filter:brightness(1.08)}'
    + '.pr-submit:disabled{opacity:.55;cursor:not-allowed}'
    + '.pr-msg{margin-top:12px;font-size:14px;border-radius:10px;padding:11px 14px;display:none}'
    + '.pr-msg.ok{display:block;background:#12331f;color:#5fd699;border:1px solid #1f6b40}'
    + '.pr-msg.err{display:block;background:#331217;color:#f2879b;border:1px solid #6b1f2c}'
    + '@media (prefers-reduced-motion:reduce){.pr-ratepick .pr-star-empty,.pr-submit{transition:none}}'
    + '@media (max-width:560px){.pr-card{padding:20px}.pr-avg{font-size:26px}}';
  var styleEl = document.createElement('style');
  styleEl.setAttribute('data-pr', '1');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── Helfer ────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function starSvg(cls) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="' + cls + '" '
      + 'd="M12 2l2.9 6.26 6.1.53-4.6 4.04 1.36 6.09L12 15.9 6.24 18.5 7.6 12.4 3 8.36l6.1-.53z"/></svg>';
  }
  function starsRow(rating) {
    var out = '';
    for (var i = 1; i <= 5; i++) out += starSvg(i <= Math.round(rating) ? 'pr-star-full' : 'pr-star-empty');
    return '<span class="pr-stars" role="img" aria-label="' + rating + ' von 5 Sternen">' + out + '</span>';
  }
  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return ''; }
  }

  // ── Grundgeruest einhaengen (vor dem Footer, sonst ans Ende) ──────
  var wrap = document.createElement('section');
  wrap.className = 'pr-wrap';
  wrap.id = 'produktbewertungen';
  wrap.innerHTML =
    '<div class="pr-card">'
    + '<div class="pr-head">'
    + '<h2 class="pr-title">Kundenbewertungen</h2>'
    + '<div class="pr-agg" id="pr-agg"></div>'
    + '</div>'
    + '<ul class="pr-list" id="pr-list"></ul>'
    + '<div class="pr-formwrap">'
    + '<h3 class="pr-form-title">Bewertung schreiben</h3>'
    + '<form id="pr-form" novalidate>'
    + '<div class="pr-field"><label class="pr-label">Ihre Bewertung</label>'
    + '<div class="pr-ratepick" id="pr-ratepick"></div></div>'
    + '<div class="pr-field"><label class="pr-label" for="pr-name">Name</label>'
    + '<input class="pr-input" id="pr-name" type="text" maxlength="60" autocomplete="name" required></div>'
    + '<div class="pr-field"><label class="pr-label" for="pr-rtitle">Titel (optional)</label>'
    + '<input class="pr-input" id="pr-rtitle" type="text" maxlength="120"></div>'
    + '<div class="pr-field"><label class="pr-label" for="pr-body">Ihre Erfahrung</label>'
    + '<textarea class="pr-textarea" id="pr-body" maxlength="2000" required></textarea></div>'
    + '<div class="pr-hp"><label>Website (bitte leer lassen)'
    + '<input id="pr-website" type="text" tabindex="-1" autocomplete="off"></label></div>'
    + '<button class="pr-submit" id="pr-submit" type="submit">Bewertung absenden</button>'
    + '<div class="pr-msg" id="pr-msg" role="status" aria-live="polite"></div>'
    + '</form></div></div>';

  function mount() {
    var footer = document.querySelector('footer');
    if (footer && footer.parentNode) footer.parentNode.insertBefore(wrap, footer);
    else (document.querySelector('main') || document.body).appendChild(wrap);
    initRatingPicker();
    loadReviews();
    document.getElementById('pr-form').addEventListener('submit', onSubmit);
  }

  // ── Sterne-Auswahl im Formular ────────────────────────────────────
  var chosenRating = 0;
  function initRatingPicker() {
    var box = document.getElementById('pr-ratepick');
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += '<button type="button" data-v="' + i + '" aria-label="' + i + ' Sterne">' + starSvg('pr-star-empty') + '</button>';
    }
    box.innerHTML = html;
    var btns = box.querySelectorAll('button');
    function paint(v) {
      btns.forEach(function (b, idx) {
        var path = b.querySelector('path');
        path.setAttribute('class', (idx + 1) <= v ? 'pr-star-full' : 'pr-star-empty');
      });
    }
    btns.forEach(function (b) {
      b.addEventListener('mouseenter', function () { paint(Number(b.dataset.v)); });
      b.addEventListener('click', function () { chosenRating = Number(b.dataset.v); paint(chosenRating); });
    });
    box.addEventListener('mouseleave', function () { paint(chosenRating); });
  }

  // ── Bewertungen laden + rendern ───────────────────────────────────
  function loadReviews() {
    fetch('/api/reviews/' + encodeURIComponent(productId), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(render)
      .catch(function () { render({ average: 0, count: 0, reviews: [] }); });
  }

  function render(data) {
    var agg = document.getElementById('pr-agg');
    var list = document.getElementById('pr-list');
    var count = data.count || 0;
    var avg = data.average || 0;
    if (count > 0) {
      agg.innerHTML = '<span class="pr-avg">' + avg.toFixed(1).replace('.', ',') + '</span>'
        + '<span>' + starsRow(avg) + '<br><span class="pr-agg-meta">'
        + count + (count === 1 ? ' Bewertung' : ' Bewertungen') + '</span></span>';
    } else {
      agg.innerHTML = '<span class="pr-agg-meta">Noch keine Bewertungen</span>';
    }
    var reviews = data.reviews || [];
    if (!reviews.length) {
      list.innerHTML = '<li class="pr-empty">Sei der Erste, der dieses Produkt bewertet.</li>';
      return;
    }
    list.innerHTML = reviews.map(function (rv) {
      return '<li class="pr-item">'
        + '<div class="pr-item-top">' + starsRow(rv.rating)
        + '<span class="pr-author">' + esc(rv.author_name) + '</span>'
        + '<span class="pr-date">' + fmtDate(rv.created_at) + '</span></div>'
        + (rv.title ? '<div class="pr-item-title">' + esc(rv.title) + '</div>' : '')
        + '<p class="pr-item-body">' + esc(rv.body) + '</p></li>';
    }).join('');
  }

  // ── Absenden ──────────────────────────────────────────────────────
  function showMsg(kind, text) {
    var m = document.getElementById('pr-msg');
    m.className = 'pr-msg ' + kind;
    m.textContent = text;
  }
  function onSubmit(e) {
    e.preventDefault();
    var name = document.getElementById('pr-name').value.trim();
    var body = document.getElementById('pr-body').value.trim();
    var title = document.getElementById('pr-rtitle').value.trim();
    var website = document.getElementById('pr-website').value;
    if (!chosenRating) { showMsg('err', 'Bitte wählen Sie eine Sternebewertung.'); return; }
    if (!name || body.length < 3) { showMsg('err', 'Bitte Name und einen kurzen Text angeben.'); return; }

    var btn = document.getElementById('pr-submit');
    btn.disabled = true;
    fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: productId, name: name, rating: chosenRating, title: title, body: body, website: website })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.ok) {
          showMsg('err', (res.j && res.j.error) || 'Bewertung konnte nicht gespeichert werden.');
          btn.disabled = false;
          return;
        }
        showMsg('ok', 'Vielen Dank! Ihre Bewertung wurde veröffentlicht.');
        document.getElementById('pr-form').reset();
        chosenRating = 0;
        initRatingPicker();
        loadReviews();
        setTimeout(function () { btn.disabled = false; }, 1200);
      })
      .catch(function () { showMsg('err', 'Netzwerkfehler. Bitte später erneut versuchen.'); btn.disabled = false; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
