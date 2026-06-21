/**
 * markt-insights.js — Aggregierte Marktforschung fürs Admin-Panel.
 * Alle Auswertungen sind Summen/Durchschnitte (DSGVO-konform, keine Personen-Profile).
 * Relative URLs lösen unter /a29715347575/ auf (Basic-Auth-geschützter Pfad).
 */
(function () {
  'use strict';

  let days = 30;

  async function getJSON(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' bei ' + url);
    return res.json();
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function el(id) { return document.getElementById(id); }
  function empty(node, text) { node.innerHTML = '<div class="empty">' + esc(text || 'Noch keine Daten.') + '</div>'; }

  // Pfad lesbar machen (ohne PII, rein kosmetisch).
  function prettyPath(p) {
    if (!p) return '–';
    if (p === '/' || /\/index\.html$/.test(p)) return 'Startseite';
    if (/cart\.html$/.test(p)) return 'Warenkorb';
    if (/wishlist\.html$/.test(p)) return 'Wunschliste';
    let m = p.match(/\/produkte\/(.+?)\.html$/);
    if (m) return 'Produkt: ' + m[1].replace(/-/g, ' ');
    m = p.match(/\/infos\/(.+?)\.html$/);
    if (m) return 'Info: ' + m[1].replace(/-/g, ' ');
    return p;
  }

  // Generische Balken-Liste.
  function barList(node, rows, opts) {
    opts = opts || {};
    const getLabel = opts.label || ((r) => r.label);
    const getVal = opts.value || ((r) => r.value);
    if (!rows || !rows.length) { empty(node, opts.emptyText); return; }
    const max = Math.max.apply(null, rows.map(getVal).concat([1]));
    node.innerHTML = rows.map((r) => {
      const v = getVal(r);
      const pct = Math.max(2, Math.round((v / max) * 100));
      const cls = typeof opts.cls === 'function' ? opts.cls(r) : (opts.cls || '');
      const valText = opts.valText ? opts.valText(r) : v;
      return '<div class="bar-row">' +
        '<div class="bar-top"><span class="bar-label">' + esc(getLabel(r)) + '</span>' +
        '<span class="bar-val">' + esc(valText) + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
      '</div>';
    }).join('');
  }

  // ── Conversion-Funnel ──────────────────────────────────────────────
  function renderFunnel(d) {
    const node = el('funnel');
    const visitors = d.visitors || 0;
    const steps = [
      { label: 'Besucher', value: visitors },
      { label: 'Produktseite gesehen', value: d.productViewers || 0 },
      { label: 'Warenkorb erreicht', value: d.cartReachers || 0 },
      { label: 'Kauf', value: d.buyers || 0 }
    ];
    if (!visitors) { empty(node, 'Noch keine Besucherdaten im Zeitraum.'); return; }
    let html = '';
    steps.forEach((s, i) => {
      const pctOfTop = visitors ? Math.round((s.value / visitors) * 100) : 0;
      const width = Math.max(18, pctOfTop) + '%';
      if (i > 0) {
        const prev = steps[i - 1].value;
        const drop = prev > 0 ? Math.round((1 - s.value / prev) * 100) : 0;
        if (drop > 0) html += '<div class="funnel-drop">▼ ' + drop + '% Absprung</div>';
      }
      html += '<div class="funnel-step" style="width:' + width + '">' +
        '<div class="fs-label">' + esc(s.label) + ' · ' + pctOfTop + '% der Besucher</div>' +
        '<div class="fs-value">' + s.value.toLocaleString('de-DE') + '</div>' +
      '</div>';
    });
    // Explizite Schlüssel-Kennzahlen
    const cart = d.cartReachers || 0;
    const buyers = d.buyers || 0;
    const abandon = cart > 0 ? Math.round((1 - buyers / cart) * 100) : null;
    const conv = visitors > 0 ? ((buyers / visitors) * 100).toFixed(1) : null;
    html += '<div class="funnel-kpis">' +
      '<div class="fk"><div class="fk-val' + (abandon != null && abandon >= 70 ? ' bad' : '') + '">' +
        (abandon == null ? '–' : abandon + '%') + '</div>' +
        '<div class="fk-lab">Warenkorbabbruch <span class="fk-hint">(Warenkorb erreicht, aber nicht gekauft)</span></div></div>' +
      '<div class="fk"><div class="fk-val">' + (conv == null ? '–' : conv + '%') + '</div>' +
        '<div class="fk-lab">Gesamt-Conversion <span class="fk-hint">(Besucher → Kauf)</span></div></div>' +
    '</div>';
    node.innerHTML = html;
  }

  // ── Suchbegriffe ───────────────────────────────────────────────────
  function renderSearch(d) {
    const summary = el('search-summary');
    if (d && d.total) {
      summary.innerHTML = esc(d.total.toLocaleString('de-DE')) + ' Suchen · ' +
        '<strong>' + esc((d.zero || 0).toLocaleString('de-DE')) + '</strong> ohne Treffer';
    } else {
      summary.textContent = 'Wonach suchen Besucher? (Suchbegriff-Tracking sammelt ab jetzt Daten.)';
    }
    barList(el('search-top'), (d && d.top) || [], {
      label: (r) => r.term,
      value: (r) => r.searches,
      valText: (r) => r.searches + '× · ⌀ ' + (r.avg_results == null ? '?' : r.avg_results) + ' Treffer',
      cls: (r) => (r.avg_results === 0 ? 'warn' : ''),
      emptyText: 'Noch keine Suchanfragen erfasst.'
    });
    barList(el('search-none'), (d && d.noResults) || [], {
      label: (r) => r.term,
      value: (r) => r.searches,
      valText: (r) => r.searches + '× gesucht',
      cls: () => 'warn',
      emptyText: 'Keine Null-Treffer-Suchen – euer Sortiment deckt die Nachfrage ab.'
    });
  }

  // ── Zeit-/Tagesmuster ──────────────────────────────────────────────
  function renderTimeChart(node, rows, labelFn) {
    if (!rows || !rows.length) { empty(node, 'Noch keine Daten.'); return; }
    const vMax = Math.max.apply(null, rows.map((r) => r.views).concat([1]));
    const oMax = Math.max.apply(null, rows.map((r) => r.orders).concat([1]));
    node.innerHTML = rows.map((r) => {
      const vh = Math.round((r.views / vMax) * 100);
      const oh = Math.round((r.orders / oMax) * 100);
      const title = labelFn(r) + ': ' + r.views + ' Aufrufe, ' + r.orders + ' Bestellungen';
      return '<div class="tcol" title="' + esc(title) + '">' +
        '<div style="display:flex;align-items:flex-end;gap:2px;width:100%;height:100%">' +
          '<div class="tbar" style="height:' + Math.max(2, vh) + '%"></div>' +
          '<div class="tbar orders" style="height:' + Math.max(0, oh) + '%"></div>' +
        '</div>' +
        '<div class="tlabel">' + esc(labelFn(r)) + '</div>' +
      '</div>';
    }).join('');
  }

  const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  // ── Alles laden ────────────────────────────────────────────────────
  async function loadAll() {
    const q = '?days=' + days;
    const results = await Promise.allSettled([
      getJSON('api/insights/funnel' + q),
      getJSON('api/insights/search' + q),
      getJSON('api/insights/referrers' + q),
      getJSON('api/views/top-countries' + q),
      getJSON('api/views/devices' + q),
      getJSON('api/views/browsers' + q),
      getJSON('api/insights/hourly' + q),
      getJSON('api/insights/weekday' + q),
      getJSON('api/views/entry-pages' + q),
      getJSON('api/insights/exit-pages' + q)
    ]);
    const val = (i) => (results[i].status === 'fulfilled' ? results[i].value : null);

    if (val(0)) renderFunnel(val(0)); else empty(el('funnel'), 'Funnel nicht verfügbar.');
    renderSearch(val(1) || {});

    barList(el('referrers'), val(2) || [], {
      label: (r) => r.source, value: (r) => r.views,
      valText: (r) => r.views + ' Aufrufe (' + r.unique_views + ' Besucher)',
      emptyText: 'Noch keine Referrer-Daten.'
    });
    barList(el('countries'), val(3) || [], {
      label: (r) => r.country, value: (r) => r.views,
      valText: (r) => r.views + ' Aufrufe (' + r.unique_views + ' Besucher)',
      emptyText: 'Noch keine Länderdaten.'
    });
    barList(el('devices'), val(4) || [], {
      label: (r) => r.device, value: (r) => r.views,
      valText: (r) => r.views + ' Aufrufe',
      emptyText: 'Noch keine Gerätedaten (nur bei voller Einwilligung).'
    });
    barList(el('browsers'), val(5) || [], {
      label: (r) => r.browser, value: (r) => r.views,
      valText: (r) => r.views + ' Aufrufe',
      emptyText: 'Noch keine Browserdaten (nur bei voller Einwilligung).'
    });

    renderTimeChart(el('hourly'), val(6) || [], (r) => String(r.hour));
    renderTimeChart(el('weekday'), val(7) || [], (r) => WEEKDAYS[r.dow] || String(r.dow));

    barList(el('entry-pages'), val(8) || [], {
      label: (r) => prettyPath(r.path), value: (r) => r.entries,
      valText: (r) => r.entries + ' Einstiege',
      cls: () => 'ok', emptyText: 'Noch keine Einstiegsdaten.'
    });
    barList(el('exit-pages'), val(9) || [], {
      label: (r) => prettyPath(r.path), value: (r) => r.exits,
      valText: (r) => r.exits + ' Ausstiege',
      cls: () => 'warn', emptyText: 'Noch keine Ausstiegsdaten.'
    });
  }

  function attachRange() {
    const group = el('range-filter');
    if (!group) return;
    const buttons = group.querySelectorAll('button[data-days]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        days = parseInt(btn.dataset.days, 10) || 30;
        buttons.forEach((b) => b.classList.toggle('active', b === btn));
        loadAll().catch((e) => console.error('Insights laden fehlgeschlagen:', e.message));
      });
    });
  }

  function init() {
    attachRange();
    loadAll().catch((e) => console.error('Insights laden fehlgeschlagen:', e.message));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
