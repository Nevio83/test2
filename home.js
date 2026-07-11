/**
 * home.js — Logik der Startseite (Design „Editorial Dark & Gold").
 *
 * Eigenständig (kein app.js auf dieser Seite). Integration mit dem Bestand:
 *  - Warenkorb:  localStorage 'cart' im app.js-/cart.js-Format
 *                (Produkt-Spread + quantity + cartItemId, Varianten via selectedColor*).
 *  - Wunschliste: localStorage 'wishlist' [{id,name,price,image,description}].
 *  - Produktcache: localStorage 'allProducts' (cart.js löst darüber Slug-URLs auf).
 *  - Suche: anonymes Tracking → POST /api/track/search (consent-gated, wie app.js).
 *  - Newsletter: echte Double-Opt-In-API → POST /api/newsletter/subscribe.
 *  - Produktlinks: /produkte/<slug>.html (SEO-Slugs aus products.json).
 */
(function () {
  'use strict';

  // ── Konfiguration ─────────────────────────────────────────
  var REEL_IDS = [44, 46, 43, 33, 47];
  var BEST_ORDER = [46, 37, 47, 43, 33, 50, 27, 18];
  var DEAL_POOL = [44, 46, 43, 33, 27, 18, 50, 37, 47, 21];
  var REEL_SECS = 5;
  // Marketing-Kennzahlen der Stats-Sektion (bei Bedarf anpassen):
  var STAT_CUSTOMERS = 2400;
  var STAT_RATING = 4.8;
  var STAT_RETURN_DAYS = 30; // deckt sich mit infos/retouren.html

  var CAT_META = {
    'Technik/Gadgets':       { short: 'Technik',  label: 'Technik & Gadgets', tag: 'Smarte Helfer',    accent: '#7FA8C9', rgb: '127,168,201', icon: 'bi-cpu' },
    'Beleuchtung':           { short: 'Licht',    label: 'Beleuchtung',       tag: 'Licht & Stimmung', accent: '#E4B053', rgb: '228,176,83',  icon: 'bi-lightbulb' },
    'Haushalt und Küche':    { short: 'Haushalt', label: 'Haushalt & Küche',  tag: 'Alltag, veredelt', accent: '#C98A6A', rgb: '201,138,106', icon: 'bi-house-heart' },
    'Körperpflege/Wellness': { short: 'Wellness', label: 'Wellness',          tag: 'Zeit für dich',    accent: '#8FB08A', rgb: '143,176,138', icon: 'bi-flower1' }
  };
  var FALLBACK_AC = { short: 'Sortiment', accent: '#D8B56C', rgb: '216,181,108', icon: 'bi-gem' };

  var COLOR_WORDS = ['schwarz','weiß','weiss','white','black','blau','blue','navy','marine','hellblau','dunkelblau','grün','gruen','green','mint','oliv','rot','red','gelb','yellow','lila','violett','violet','purple','grau','gray','grey','anthrazit','braun','brown','orange','beige','sand','khaki','gold','golden','silber','silver','rosa','pink','türkis','tuerkis','turquoise','cyan','magenta','creme','cream','champagner','champagne','bronze','kupfer','copper','natur','transparent','klar','clear','elfenbein','ivory','roségold','rosegold'];

  // ── State ─────────────────────────────────────────────────
  var products = [];      // ohne ALI-Produkte
  var currentCat = 'alle';
  var currentSort = 'beliebt';
  var scene = 0;
  var reelTimer = null;
  var qvState = null;     // { product, qty, colorIdx }
  var statsStarted = false;

  // ── Helpers ───────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function eur(n) { return (Number(n) || 0).toFixed(2).replace('.', ',') + ' €'; }
  function el(id) { return document.getElementById(id); }
  function acFor(cat) { return CAT_META[cat] || FALLBACK_AC; }
  function imgUrl(p) { return encodeURI('/' + String(p).replace(/^\//, '')); }
  function productHref(p) { return p && p.slug ? '/produkte/' + p.slug + '.html' : '/produkte/produkt-' + p.id + '.html'; }
  function byId(id) { return products.find(function (p) { return Number(p.id) === Number(id); }); }

  // Deterministische Pseudo-Werte (wie im Design-Prototyp; später durch echte Daten ersetzbar)
  function rating(id) { return 4.2 + ((id * 7) % 8) / 10; }
  function reviews(id) { return 23 + ((id * 13) % 180); }
  function stockOf(id) { return 3 + ((id * 5) % 15); }
  function soldToday(id) { return 8 + ((id * 37) % 40); }
  function stars(r) { var f = Math.round(r); return '★★★★★'.slice(0, f) + '☆☆☆☆☆'.slice(0, 5 - f); }

  function isColorName(name) {
    if (!name) return false;
    var words = String(name).toLowerCase().replace(/[^a-zäöüß ]/g, ' ').split(/\s+/).filter(Boolean);
    return words.some(function (w) { return COLOR_WORDS.indexOf(w) !== -1; });
  }

  function secondImg(p) {
    var imgs = [p.image].concat((p.colors || []).map(function (c) { return c.image; })).filter(Boolean);
    var uniq = imgs.filter(function (x, i) { return imgs.indexOf(x) === i; });
    return uniq[1] || '';
  }

  function discountPct(price, orig) { return '−' + Math.round((1 - price / orig) * 100) + ' %'; }

  // ── Warenkorb (app.js-/cart.js-kompatibles Format) ────────
  function getCart() {
    try { return JSON.parse(localStorage.getItem('cart')) || []; } catch (e) { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
  }
  function cartCount() {
    return getCart().reduce(function (a, c) { return a + (Number(c.quantity) || 1); }, 0);
  }
  function cartSubtotal() {
    return getCart().reduce(function (a, c) { return a + (Number(c.price) || 0) * (Number(c.quantity) || 1); }, 0);
  }

  function addToCart(product, qty, variant) {
    qty = Math.max(1, Number(qty) || 1);
    var cart = getCart();
    var existing;
    if (variant && variant.name) {
      existing = cart.find(function (i) {
        return i.isBundle !== true && Number(i.id) === Number(product.id) && i.selectedColor === variant.name;
      });
    } else {
      existing = cart.find(function (i) {
        return i.isBundle !== true && Number(i.id) === Number(product.id) && !i.selectedColor;
      });
    }
    var displayName = product.name;
    if (existing) {
      existing.quantity = (Number(existing.quantity) || 1) + qty;
      displayName = existing.name;
    } else {
      var item = Object.assign({}, product, { quantity: qty });
      if (variant && variant.name) {
        var cleanName = product.name.replace(/\s*\([^)]*\)$/, '');
        item.name = cleanName + ' (' + variant.name + ')';
        item.selectedColor = variant.name;
        item.selectedColorCode = variant.code || '#000000';
        item.selectedColorSku = variant.sku || 'default';
        item.price = variant.price != null ? variant.price : product.price;
        item.originalPrice = variant.originalPrice != null ? variant.originalPrice : product.originalPrice;
        if (variant.image) item.image = variant.image;
        item.cartItemId = product.id + '-' + variant.name.replace(/\s+/g, '-').toLowerCase();
        displayName = item.name;
      } else {
        item.cartItemId = product.id + '-no-color';
      }
      cart.push(item);
    }
    saveCart(cart);
    pulseBadge();
    showToast(displayName + ' wurde zum Warenkorb hinzugefügt');
  }

  // Direkt-Add ohne Variantenwahl (Quick-Add, Karte, Reel, Deal):
  // bei Produkten mit Farben/Modellen wird automatisch die ERSTE Variante gewählt,
  // damit die Warenkorb-Zeile eine konkrete Variante (Preis/SKU/Bild) hat.
  function quickAdd(p, qty) {
    var first = p.colors && p.colors.length ? p.colors[0] : null;
    addToCart(p, qty || 1, first);
  }

  // ── Wunschliste (app.js-Format) ───────────────────────────
  function getWishlist() {
    try { return JSON.parse(localStorage.getItem('wishlist')) || []; } catch (e) { return []; }
  }
  function isWished(id) {
    return getWishlist().some(function (i) { return Number(i.id) === Number(id); });
  }
  function toggleWish(product) {
    var list = getWishlist();
    if (isWished(product.id)) {
      list = list.filter(function (i) { return Number(i.id) !== Number(product.id); });
      showToast('Von der Wunschliste entfernt');
    } else {
      list.push({ id: product.id, name: product.name, price: product.price, image: product.image, description: product.description });
      showToast('Zur Wunschliste hinzugefügt');
    }
    localStorage.setItem('wishlist', JSON.stringify(list));
    updateWishUI();
  }

  // ── Kürzlich angesehen ────────────────────────────────────
  function getRecent() {
    try {
      var r = JSON.parse(localStorage.getItem('maios_recent') || '[]');
      return Array.isArray(r) ? r.filter(function (x) { return typeof x === 'number'; }) : [];
    } catch (e) { return []; }
  }
  function recordRecent(id) {
    var r = [id].concat(getRecent().filter(function (x) { return x !== id; })).slice(0, 12);
    try { localStorage.setItem('maios_recent', JSON.stringify(r)); } catch (e) { /* voll/blockiert */ }
    renderRecent();
  }

  // ── Such-Tracking (anonym, consent-gated — wie app.js) ────
  var searchTrackTimer = null;
  function queueSearchTracking(term, count) {
    term = (term || '').trim();
    if (term.length < 2) return;
    clearTimeout(searchTrackTimer);
    searchTrackTimer = setTimeout(function () { trackSearch(term, count); }, 1200);
  }
  function trackSearch(term, resultCount) {
    try {
      var level = null;
      if (window.MaiosConsent && typeof window.MaiosConsent.level === 'function') level = window.MaiosConsent.level();
      if (!level) { try { level = localStorage.getItem('maios_cookie_consent'); } catch (e) { /* ignore */ } }
      if (level !== 'all' && level !== 'essential') return;
      var sid = null;
      try { sid = level === 'all' ? localStorage.getItem('maios_vid') : sessionStorage.getItem('maios_sid'); } catch (e) { /* ignore */ }
      fetch('/api/track/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ term: term.slice(0, 120), results_count: typeof resultCount === 'number' ? resultCount : null, consent_level: level, session_id: sid })
      }).catch(function () { /* Tracking stört nie */ });
    } catch (e) { /* ignore */ }
  }

  // ── UI: Badges / Toast ────────────────────────────────────
  function updateCartUI() {
    var n = cartCount();
    el('cartCount').textContent = n;
    el('drawerCount').textContent = '(' + n + ')';
    var mob = el('mobileCartCount'); if (mob) mob.textContent = n;
    var sticky = el('stickyCartCount');
    if (sticky) { sticky.textContent = n; sticky.style.display = n > 0 ? 'flex' : 'none'; }
    renderDrawerItems();
  }
  function updateWishUI() {
    var n = getWishlist().length;
    var b = el('wishBadge');
    b.textContent = n;
    b.style.display = n > 0 ? 'flex' : 'none';
    document.querySelectorAll('.pcard .wish').forEach(function (btn) {
      var id = Number(btn.getAttribute('data-id'));
      var on = isWished(id);
      btn.classList.toggle('active', on);
      var ic = btn.querySelector('i');
      if (ic) ic.className = 'bi ' + (on ? 'bi-heart-fill' : 'bi-heart');
    });
  }
  function pulseBadge() {
    var b = el('cartCount');
    b.classList.remove('pulse');
    void b.offsetWidth; // Animation neu starten
    b.classList.add('pulse');
  }
  var toastTimer = null;
  function showToast(msg) {
    el('toastMsg').textContent = msg;
    el('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el('toast').classList.remove('show'); }, 2400);
  }

  // ── Produktkarte ──────────────────────────────────────────
  function cardHTML(p, rank, ranked) {
    var ac = acFor(p.category);
    var hasDisc = !!p.originalPrice && p.originalPrice > p.price;
    var r = rating(p.id);
    var stock = stockOf(p.id);
    var sec = secondImg(p);
    var href = productHref(p);
    var wished = isWished(p.id);
    return '<div class="pcard-wrap" style="animation-delay:' + ((rank != null ? rank : 0) % 12) * 50 + 'ms;">' +
      '<div class="pcard" style="--ac:' + ac.accent + ';--ac-rgb:' + ac.rgb + ';">' +
        '<span class="rail"></span>' +
        '<div class="stagewrap">' +
          '<a class="stage" href="' + href + '" aria-label="' + esc(p.name) + '">' +
            '<img class="main" src="' + imgUrl(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
            (sec ? '<img class="second" src="' + imgUrl(sec) + '" alt="" aria-hidden="true" loading="lazy">' : '') +
            (hasDisc ? '<span class="disc">' + discountPct(p.price, p.originalPrice) + '</span>' : '') +
          '</a>' +
          '<button class="wish' + (wished ? ' active' : '') + '" data-id="' + p.id + '" data-action="wish" aria-label="Merken"><i class="bi ' + (wished ? 'bi-heart-fill' : 'bi-heart') + '"></i></button>' +
          '<button class="quickadd" data-id="' + p.id + '" data-action="add" aria-label="Schnell in den Warenkorb"><i class="bi bi-lightning-charge-fill"></i> Quick-Add</button>' +
        '</div>' +
        '<div class="body">' +
          '<div class="toprow">' +
            (ranked === true && rank != null ? '<span class="rank">' + String(rank + 1).padStart(2, '0') + '</span>' : '') +
            '<div class="cattag"><i class="bi ' + ac.icon + '"></i><span>' + esc(ac.short) + '</span></div>' +
          '</div>' +
          '<h3><a href="' + href + '">' + esc(p.name) + '</a></h3>' +
          '<div class="rating"><span class="stars">' + stars(r) + '</span> ' + r.toFixed(1).replace('.', ',') + ' (' + reviews(p.id) + ')</div>' +
          '<div class="social"><i class="bi bi-fire"></i> ' + soldToday(p.id) + ' heute gekauft</div>' +
          '<div class="priceline"><span class="price">' + eur(p.price) + '</span>' + (hasDisc ? '<span class="strike">' + eur(p.originalPrice) + '</span>' : '') + '</div>' +
          (stock <= 8 ? '<div class="lowstock">Nur noch ' + stock + ' Stück</div>' : '') +
          '<div class="ctas">' +
            '<button class="addbtn" data-id="' + p.id + '" data-action="add">In den Warenkorb</button>' +
            '<button class="eyebtn" data-id="' + p.id + '" data-action="qv" aria-label="Schnellansicht" title="Schnellansicht"><i class="bi bi-eye"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Klick-Delegation für Karten-Buttons (add / qv / wish)
  function attachGridActions(container) {
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      e.preventDefault();
      var p = byId(btn.getAttribute('data-id'));
      if (!p) return;
      var action = btn.getAttribute('data-action');
      if (action === 'add') quickAdd(p, 1);
      else if (action === 'qv') openQv(p.id);
      else if (action === 'wish') toggleWish(p);
    });
  }

  // ── Showreel ──────────────────────────────────────────────
  function renderReel() {
    var ids = REEL_IDS.filter(function (id) { return byId(id); });
    if (!ids.length) return;
    var idx = scene % ids.length;
    var p = byId(ids[idx]);
    var ac = acFor(p.category);
    var hasDisc = !!p.originalPrice && p.originalPrice > p.price;
    var r = rating(p.id);
    var alt = idx % 2 === 0;
    el('reelCounter').textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(ids.length).padStart(2, '0');
    el('reelBody').innerHTML =
      '<div class="reel-stage">' +
        (hasDisc ? '<span class="badge">' + discountPct(p.price, p.originalPrice) + '</span>' : '') +
        '<img class="product ' + (alt ? 'anim-a' : 'anim-b') + '" src="' + imgUrl(p.image) + '" alt="' + esc(p.name) + '" style="animation-duration:' + (REEL_SECS + 1) + 's;">' +
        '<button class="reel-prev" id="reelPrev" aria-label="Vorheriges Produkt"><i class="bi bi-arrow-left"></i></button>' +
        '<button class="reel-next" id="reelNext" aria-label="Nächstes Produkt"><i class="bi bi-arrow-right"></i></button>' +
      '</div>' +
      '<div class="reel-text">' +
        '<div class="reel-tagline">' + esc(ac.short) + ' — handverlesen für dich</div>' +
        '<h1 class="reel-name"><a href="' + productHref(p) + '">' + esc(p.name) + '</a></h1>' +
        '<p class="reel-desc">' + esc(p.description || '') + '</p>' +
        '<div class="reel-priceline">' +
          '<span class="reel-price">' + eur(p.price) + '</span>' +
          (hasDisc ? '<span class="strike">' + eur(p.originalPrice) + '</span>' : '') +
          '<span class="reel-rating"><span class="stars">' + stars(r) + '</span> ' + r.toFixed(1).replace('.', ',') + '</span>' +
        '</div>' +
        '<div class="reel-ctas">' +
          '<button class="cta-gold" id="reelAdd"><i class="bi bi-bag-plus"></i> In den Warenkorb</button>' +
          '<a class="cta-line" href="' + productHref(p) + '">Details</a>' +
        '</div>' +
      '</div>';
    el('reelThumbs').innerHTML = ids.map(function (id, i) {
      var tp = byId(id);
      var cls = 'reel-thumb' + (i === idx ? ' active' : i < idx ? ' done' : '');
      return '<button class="' + cls + '" data-scene="' + i + '" title="' + esc(tp.name) + '" aria-label="' + esc(tp.name) + '">' +
        '<img src="' + imgUrl(tp.image) + '" alt="">' + '<span class="bar"></span></button>';
    }).join('');
    el('reelAdd').addEventListener('click', function () { quickAdd(p, 1); });
    el('reelPrev').addEventListener('click', function () { goScene(idx - 1); });
    el('reelNext').addEventListener('click', function () { goScene(idx + 1); });
    el('reelThumbs').querySelectorAll('[data-scene]').forEach(function (b) {
      b.addEventListener('click', function () { goScene(Number(b.getAttribute('data-scene'))); });
    });
  }
  function goScene(i) {
    var n = REEL_IDS.filter(function (id) { return byId(id); }).length || 1;
    scene = ((i % n) + n) % n;
    renderReel();
    setupReelTimer();
  }
  function setupReelTimer() {
    clearInterval(reelTimer);
    reelTimer = setInterval(function () { scene++; renderReel(); }, REEL_SECS * 1000);
  }

  // ── Kategorie-Kacheln ─────────────────────────────────────
  function renderCatTiles() {
    el('catGrid').innerHTML = Object.keys(CAT_META).map(function (key) {
      var m = CAT_META[key];
      var items = products.filter(function (p) { return p.category === key; });
      var rep = items.find(function (p) { return p.image; }) || items[0];
      return '<button class="cat-tile" data-cat="' + esc(key) + '" style="--ac:' + m.accent + ';--ac-rgb:' + m.rgb + ';">' +
        '<span class="rail"></span>' +
        '<span class="icon-badge"><i class="bi ' + m.icon + '"></i></span>' +
        '<div class="img-wrap">' + (rep ? '<img src="' + imgUrl(rep.image) + '" alt="' + esc(m.label) + '" loading="lazy">' : '') + '</div>' +
        '<div class="shade"></div>' +
        '<div class="info">' +
          '<div class="tag">' + esc(m.tag) + '</div>' +
          '<div class="row"><div class="label">' + esc(m.label) + '</div><span class="arrow"><i class="bi bi-arrow-up-right"></i></span></div>' +
          '<div class="count">' + items.length + ' Produkte</div>' +
        '</div>' +
      '</button>';
    }).join('');
    el('catGrid').querySelectorAll('.cat-tile').forEach(function (t) {
      t.addEventListener('click', function () {
        currentCat = t.getAttribute('data-cat');
        renderChips();
        renderAllGrid();
        var s = el('sortiment');
        window.scrollTo({ top: s.getBoundingClientRect().top + window.pageYOffset - 20, behavior: 'smooth' });
      });
    });
  }

  // ── Deal des Tages ────────────────────────────────────────
  function renderDeal() {
    var pool = DEAL_POOL.filter(function (id) { return byId(id); });
    if (!pool.length) return;
    var p = byId(pool[Math.floor(Date.now() / 86400000) % pool.length]);
    var hasDisc = !!p.originalPrice && p.originalPrice > p.price;
    var r = rating(p.id);
    el('dealPanel').innerHTML =
      '<div class="deal-stage">' +
        '<img src="' + imgUrl(p.image) + '" alt="' + esc(p.name) + '">' +
        (hasDisc ? '<div class="badge">' + discountPct(p.price, p.originalPrice) + '</div>' : '') +
      '</div>' +
      '<div class="deal-info">' +
        '<div class="deal-live"><span class="pulse-dot"></span> Deal des Tages — endet in</div>' +
        '<div class="countdown">' +
          '<div class="cd-cell"><div class="cd-num" data-cd="h">–</div><div class="cd-lbl">STUNDEN</div></div>' +
          '<div class="cd-sep">:</div>' +
          '<div class="cd-cell"><div class="cd-num" data-cd="m">–</div><div class="cd-lbl">MINUTEN</div></div>' +
          '<div class="cd-sep">:</div>' +
          '<div class="cd-cell"><div class="cd-num" data-cd="s">–</div><div class="cd-lbl">SEKUNDEN</div></div>' +
        '</div>' +
        '<h2 class="deal-name"><a href="' + productHref(p) + '">' + esc(p.name) + '</a></h2>' +
        '<div class="deal-rating"><span class="stars">' + stars(r) + '</span> ' + r.toFixed(1).replace('.', ',') + ' · ' + reviews(p.id) + ' Bewertungen</div>' +
        '<p class="deal-desc">' + esc(p.description || '') + '</p>' +
        '<div class="deal-priceline">' +
          '<span class="deal-price">' + eur(p.price) + '</span>' +
          (hasDisc ? '<span class="strike">' + eur(p.originalPrice) + '</span><span class="deal-save">Du sparst ' + eur(p.originalPrice - p.price) + '</span>' : '') +
        '</div>' +
        '<div>' +
          '<div class="deal-stockrow"><span class="left">Nur noch ' + stockOf(p.id) + ' Stück verfügbar</span><span>82 % verkauft</span></div>' +
          '<div class="deal-bar-track"><div class="deal-bar"></div></div>' +
        '</div>' +
        '<div class="deal-ctas">' +
          '<button class="deal-add" id="dealAdd">In den Warenkorb — ' + eur(p.price) + '</button>' +
          '<button class="deal-eye" id="dealQv" aria-label="Details ansehen"><i class="bi bi-eye"></i></button>' +
        '</div>' +
      '</div>';
    el('dealAdd').addEventListener('click', function () { quickAdd(p, 1); });
    el('dealQv').addEventListener('click', function () { openQv(p.id); });
    tickCountdown();
  }
  function tickCountdown() {
    var now = new Date();
    var end = new Date(now); end.setHours(23, 59, 59, 999);
    var d = Math.max(0, end - now);
    var h = Math.floor(d / 3600000); d -= h * 3600000;
    var m = Math.floor(d / 60000); d -= m * 60000;
    var s = Math.floor(d / 1000);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    document.querySelectorAll('[data-cd="h"]').forEach(function (x) { x.textContent = pad(h); });
    document.querySelectorAll('[data-cd="m"]').forEach(function (x) { x.textContent = pad(m); });
    document.querySelectorAll('[data-cd="s"]').forEach(function (x) { x.textContent = pad(s); });
  }

  // ── Bestseller + Sortiment ────────────────────────────────
  function renderBestsellers() {
    var list = BEST_ORDER.map(byId).filter(Boolean);
    el('bestGrid').innerHTML = list.map(function (p, i) { return cardHTML(p, i, true); }).join('');
    updateWishUI();
  }

  var SORTS = [
    { key: 'beliebt', label: 'Beliebt', fn: function (a, b) { return reviews(b.id) - reviews(a.id); } },
    { key: 'preis-auf', label: 'Preis ↑', fn: function (a, b) { return a.price - b.price; } },
    { key: 'preis-ab', label: 'Preis ↓', fn: function (a, b) { return b.price - a.price; } },
    { key: 'rabatt', label: 'Rabatt', fn: function (a, b) { return discFrac(b) - discFrac(a); } }
  ];
  function discFrac(p) { return p.originalPrice && p.originalPrice > p.price ? (p.originalPrice - p.price) / p.originalPrice : 0; }

  function renderChips() {
    var cats = [{ key: 'alle', label: 'Alle', ac: { accent: '#D8B56C', rgb: '216,181,108', icon: 'bi-grid' } }]
      .concat(Object.keys(CAT_META).map(function (k) { return { key: k, label: CAT_META[k].label, ac: CAT_META[k] }; }));
    el('catChips').innerHTML = cats.map(function (c) {
      var count = c.key === 'alle' ? products.length : products.filter(function (p) { return p.category === c.key; }).length;
      return '<button class="chip' + (currentCat === c.key ? ' active' : '') + '" data-cat="' + esc(c.key) + '" style="--ac:' + c.ac.accent + ';--ac-rgb:' + c.ac.rgb + ';">' +
        '<i class="bi ' + c.ac.icon + '"></i> ' + esc(c.label) + ' <span class="n">' + count + '</span></button>';
    }).join('');
    el('catChips').querySelectorAll('.chip').forEach(function (c) {
      c.addEventListener('click', function () {
        currentCat = c.getAttribute('data-cat');
        renderChips();
        renderAllGrid();
      });
    });
    el('sortPills').innerHTML = SORTS.map(function (o) {
      return '<button class="sort-pill' + (currentSort === o.key ? ' active' : '') + '" data-sort="' + o.key + '">' + o.label + '</button>';
    }).join('');
    el('sortPills').querySelectorAll('.sort-pill').forEach(function (b) {
      b.addEventListener('click', function () {
        currentSort = b.getAttribute('data-sort');
        renderChips();
        renderAllGrid();
      });
    });
  }

  function renderAllGrid() {
    var list = currentCat === 'alle' ? products.slice() : products.filter(function (p) { return p.category === currentCat; });
    var sort = SORTS.find(function (s) { return s.key === currentSort; }) || SORTS[0];
    list.sort(sort.fn);
    el('gridCount').textContent = list.length + (list.length === 1 ? ' Produkt' : ' Produkte');
    el('allGrid').innerHTML = list.map(function (p, i) { return cardHTML(p, i); }).join('');
    updateWishUI();
  }

  // ── Suche ─────────────────────────────────────────────────
  function searchProducts(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    return products.filter(function (p) { return (p.name + ' ' + p.category).toLowerCase().indexOf(q) !== -1; }).slice(0, 6);
  }
  function searchHitHTML(p) {
    var ac = acFor(p.category);
    return '<button class="search-hit" data-id="' + p.id + '">' +
      '<div class="thumb"><img src="' + imgUrl(p.image) + '" alt=""></div>' +
      '<div class="meta"><div class="cat">' + esc(ac.short) + '</div><div class="name">' + esc(p.name) + '</div></div>' +
      '<span class="price">' + eur(p.price) + '</span></button>';
  }
  function bindSearch(inputId, dropEl, clearBtn) {
    var input = el(inputId);
    if (!input) return;
    input.addEventListener('input', function () {
      var q = input.value;
      var hits = searchProducts(q);
      if (clearBtn) clearBtn.style.display = q.trim() ? 'flex' : 'none';
      if (!q.trim()) { dropEl.style.display = 'none'; dropEl.innerHTML = ''; return; }
      dropEl.style.display = 'block';
      dropEl.innerHTML = hits.length
        ? hits.map(searchHitHTML).join('')
        : '<div class="search-empty">Keine Treffer. Versuch einen anderen Begriff.</div>';
      dropEl.querySelectorAll('.search-hit').forEach(function (h) {
        h.addEventListener('click', function () {
          input.value = '';
          dropEl.style.display = 'none';
          if (clearBtn) clearBtn.style.display = 'none';
          closeMobileMenu();
          openQv(Number(h.getAttribute('data-id')));
        });
      });
      queueSearchTracking(q, hits.length);
    });
  }

  // ── Warenkorb-Drawer + Mini-Cart ──────────────────────────
  function openDrawer() { el('drawerWrap').style.display = 'block'; renderDrawerItems(); }
  function closeDrawer() { el('drawerWrap').style.display = 'none'; }
  function renderDrawerItems() {
    var box = el('drawerItems');
    if (!box) return;
    var cart = getCart();
    el('drawerSubtotal').textContent = eur(cartSubtotal());
    if (!cart.length) {
      box.innerHTML = '<div class="empty"><i class="bi bi-bag"></i><div>Dein Warenkorb ist noch leer.</div></div>';
      renderMiniCart();
      return;
    }
    box.innerHTML = cart.map(function (c, i) {
      return '<div class="d-item">' +
        '<div class="thumb"><img src="' + imgUrl(c.image || '') + '" alt="' + esc(c.name) + '"></div>' +
        '<div class="mid">' +
          '<div class="name">' + esc(c.name) + '</div>' +
          '<div class="qtyrow">' +
            '<div class="stepper">' +
              '<button data-idx="' + i + '" data-op="dec" aria-label="Weniger">−</button>' +
              '<span>' + (Number(c.quantity) || 1) + '</span>' +
              '<button data-idx="' + i + '" data-op="inc" aria-label="Mehr">+</button>' +
            '</div>' +
            '<span class="line">' + eur((Number(c.price) || 0) * (Number(c.quantity) || 1)) + '</span>' +
          '</div>' +
        '</div>' +
        '<button class="rm" data-idx="' + i + '" data-op="rm" aria-label="Entfernen"><i class="bi bi-trash3"></i></button>' +
      '</div>';
    }).join('');
    box.querySelectorAll('button[data-op]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cart2 = getCart();
        var i = Number(b.getAttribute('data-idx'));
        var op = b.getAttribute('data-op');
        if (!cart2[i]) return;
        if (op === 'inc') cart2[i].quantity = (Number(cart2[i].quantity) || 1) + 1;
        else if (op === 'dec') {
          var q = (Number(cart2[i].quantity) || 1) - 1;
          if (q <= 0) cart2.splice(i, 1); // bei 1 -> Artikel entfernen
          else cart2[i].quantity = q;
        }
        else if (op === 'rm') cart2.splice(i, 1);
        saveCart(cart2);
      });
    });
    renderMiniCart();
  }
  function renderMiniCart() {
    var box = el('miniCart');
    if (!box) return;
    var cart = getCart();
    if (!cart.length) {
      box.innerHTML = '<div class="empty"><i class="bi bi-bag"></i>Noch nichts im Warenkorb.</div>';
      return;
    }
    var rows = cart.slice(0, 3).map(function (c) {
      return '<div class="mini-row">' +
        '<div class="thumb"><img src="' + imgUrl(c.image || '') + '" alt=""></div>' +
        '<div style="flex:1;min-width:0;"><div class="name">' + esc(c.name) + '</div>' +
        '<div class="sub">' + (Number(c.quantity) || 1) + '× · ' + eur((Number(c.price) || 0) * (Number(c.quantity) || 1)) + '</div></div>' +
      '</div>';
    }).join('');
    var more = cart.length > 3 ? '<div class="mini-more">+' + (cart.length - 3) + ' weitere Artikel</div>' : '';
    box.innerHTML = rows + more +
      '<div class="mini-total"><span class="lbl">Zwischensumme</span><span class="val">' + eur(cartSubtotal()) + '</span></div>' +
      '<a class="gold-btn" href="/cart.html">Warenkorb ansehen</a>';
  }

  // ── Quick-View ────────────────────────────────────────────
  function openQv(id) {
    var p = byId(id);
    if (!p) return;
    recordRecent(Number(id));
    qvState = { product: p, qty: 1, colorIdx: 0 };
    renderQv();
    el('qvWrap').style.display = 'block';
  }
  function closeQv() {
    el('qvWrap').style.display = 'none';
    el('qvWrap').innerHTML = '';
    qvState = null;
  }
  function renderQv() {
    if (!qvState) return;
    var p = qvState.product;
    var ac = acFor(p.category);
    var colors = p.colors || [];
    var sel = colors[qvState.colorIdx];
    var vPrice = sel && sel.price != null ? sel.price : p.price;
    var vOrig = sel && sel.originalPrice != null ? sel.originalPrice : p.originalPrice;
    var hasDisc = !!(vOrig && vOrig > vPrice);
    var r = rating(p.id);
    var stock = stockOf(p.id);
    var anyMotif = colors.some(function (c) { return !!c.image && !isColorName(c.name); });
    var allMotif = colors.length > 0 && colors.every(function (c) { return !!c.image && !isColorName(c.name); });
    var varLabel = allMotif ? 'Motiv' : anyMotif ? 'Variante' : 'Farbe';
    var name = sel && sel.name ? p.name + ' — ' + sel.name : p.name;
    var img = sel && sel.image ? sel.image : p.image;
    // Einheitliche Darstellung pro Produkt: haben ALLE Varianten ein Bild,
    // werden alle als Bild-Thumbnails gezeigt — sonst alle als Farbkreise.
    // (Nie gemischt, unabhängig davon, ob der Name ein Farbwort ist.)
    var allHaveImg = colors.length > 0 && colors.every(function (c) { return !!c.image; });
    var swatches = colors.map(function (c, i) {
      var isSel = i === qvState.colorIdx;
      if (allHaveImg) {
        return '<button class="motif' + (isSel ? ' sel' : '') + '" data-cidx="' + i + '" title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '"><img src="' + imgUrl(c.image) + '" alt="' + esc(c.name) + '" loading="lazy"></button>';
      }
      return '<button class="swatch' + (isSel ? ' sel' : '') + '" data-cidx="' + i + '" title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '" style="background:' + esc(c.code || '#444') + ';"></button>';
    }).join('');
    el('qvWrap').innerHTML =
      '<div class="qv-overlay" id="qvOverlay">' +
        '<div class="qv" style="--ac:' + ac.accent + ';--ac-rgb:' + ac.rgb + ';">' +
          '<button class="close" id="qvClose" aria-label="Schließen"><i class="bi bi-x-lg"></i></button>' +
          '<div class="stage"><img src="' + imgUrl(img) + '" alt="' + esc(name) + '"></div>' +
          '<div class="info">' +
            '<div class="cattag"><i class="bi ' + ac.icon + '"></i><span>' + esc(ac.short) + '</span></div>' +
            '<h3>' + esc(name) + '</h3>' +
            '<div class="rating"><span class="stars">' + stars(r) + '</span> ' + r.toFixed(1).replace('.', ',') + ' · ' + reviews(p.id) + ' Bewertungen</div>' +
            '<div class="priceline">' +
              '<span class="price">' + eur(vPrice) + '</span>' +
              (hasDisc ? '<span class="strike">' + eur(vOrig) + '</span><span class="disc">' + discountPct(vPrice, vOrig) + '</span>' : '') +
            '</div>' +
            '<p class="desc">' + esc(p.description || '') + '</p>' +
            (colors.length ? '<div><div class="var-lbl">' + varLabel + ': <span>' + esc(sel ? sel.name : '') + '</span></div><div class="swatches">' + swatches + '</div></div>' : '') +
            '<div class="shiprow">' +
              '<span><i class="bi bi-truck"></i> Lieferung: ' + esc(p.shippingTime || '6–13 Werktage') + '</span>' +
              (stock <= 8 ? '<span class="low">Nur noch ' + stock + ' Stück</span>' : '') +
            '</div>' +
            '<div class="buyrow">' +
              '<div class="stepper">' +
                '<button id="qvDec" aria-label="Weniger">−</button><span id="qvQty">' + qvState.qty + '</span><button id="qvInc" aria-label="Mehr">+</button>' +
              '</div>' +
              '<button class="addbtn" id="qvAdd">In den Warenkorb — ' + eur(vPrice * qvState.qty) + '</button>' +
            '</div>' +
            '<a class="detail-link" href="' + productHref(p) + '">Zur Produktseite mit allen Details →</a>' +
            '<div class="trust">' +
              '<span><i class="bi bi-shield-check"></i> Käuferschutz</span>' +
              '<span><i class="bi bi-arrow-repeat"></i> 30 Tage Rückgabe</span>' +
              '<span><i class="bi bi-lock"></i> Sichere Zahlung</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    el('qvOverlay').addEventListener('click', function (e) { if (e.target === el('qvOverlay')) closeQv(); });
    el('qvClose').addEventListener('click', closeQv);
    el('qvInc').addEventListener('click', function () { qvState.qty++; renderQv(); });
    el('qvDec').addEventListener('click', function () { qvState.qty = Math.max(1, qvState.qty - 1); renderQv(); });
    el('qvAdd').addEventListener('click', function () {
      addToCart(p, qvState.qty, colors[qvState.colorIdx]);
      closeQv();
    });
    el('qvWrap').querySelectorAll('[data-cidx]').forEach(function (b) {
      b.addEventListener('click', function () { qvState.colorIdx = Number(b.getAttribute('data-cidx')); renderQv(); });
    });
  }

  // ── Kürzlich angesehen ────────────────────────────────────
  function renderRecent() {
    var items = getRecent().map(byId).filter(Boolean).slice(0, 10);
    var sec = el('recentSec');
    if (!items.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    el('recentStrip').innerHTML = items.map(function (p) {
      var ac = acFor(p.category);
      return '<button class="recent-card" data-id="' + p.id + '" style="--ac:' + ac.accent + ';" aria-label="' + esc(p.name) + '">' +
        '<div class="stage"><img src="' + imgUrl(p.image) + '" alt="' + esc(p.name) + '" loading="lazy"></div>' +
        '<div class="body">' +
          '<div class="cattag"><i class="bi ' + ac.icon + '"></i><span>' + esc(ac.short) + '</span></div>' +
          '<div class="name">' + esc(p.name) + '</div>' +
          '<div class="price">' + eur(p.price) + '</div>' +
        '</div>' +
      '</button>';
    }).join('');
    el('recentStrip').querySelectorAll('.recent-card').forEach(function (c) {
      c.addEventListener('click', function () { openQv(Number(c.getAttribute('data-id'))); });
    });
  }

  // ── Newsletter (echte Double-Opt-In-API) ──────────────────
  function bindNewsletter() {
    var form = el('nlForm');
    var msg = el('nlMsg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = el('nlEmail').value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.className = 'nl-msg err';
        msg.textContent = 'Bitte gib eine gültige E-Mail-Adresse ein.';
        return;
      }
      var btn = el('nlSubmit');
      btn.disabled = true;
      msg.className = 'nl-msg';
      msg.textContent = 'Einen Moment …';
      fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, source: 'startseite' })
      }).then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
        .then(function (r) {
          btn.disabled = false;
          if (r.ok && r.d && r.d.success) {
            msg.className = 'nl-msg ok';
            msg.textContent = r.d.message || 'Fast geschafft! Bitte bestätige den Link in deiner E-Mail.';
            el('nlEmail').value = '';
          } else {
            msg.className = 'nl-msg err';
            msg.textContent = (r.d && r.d.error) || 'Anmeldung gerade nicht möglich. Bitte später erneut versuchen.';
          }
        })
        .catch(function () {
          btn.disabled = false;
          msg.className = 'nl-msg err';
          msg.textContent = 'Verbindung fehlgeschlagen. Bitte später erneut versuchen.';
        });
    });
  }

  // ── Header / Scroll / Reveals / Stats ─────────────────────
  function bindHeader() {
    var nav = el('mainNav');
    var lastY = window.pageYOffset || 0;
    var hidden = false;
    window.addEventListener('scroll', function () {
      var y = window.pageYOffset || 0;
      if (y < 120) hidden = false;
      else if (y > lastY && y - lastY > 4) hidden = true;
      else if (y < lastY && lastY - y > 4) hidden = false;
      nav.classList.toggle('nav-hidden', hidden);
      lastY = y;
    }, { passive: true });
  }
  function bindSpotlight() {
    var spot = el('spotlight');
    var pend = false;
    window.addEventListener('pointermove', function (e) {
      if (pend) return;
      pend = true;
      var x = e.clientX, y = e.clientY;
      requestAnimationFrame(function () {
        pend = false;
        spot.style.background = 'radial-gradient(600px circle at ' + x + 'px ' + y + 'px, rgba(216,181,108,.10), transparent 62%)';
      });
    }, { passive: true });
  }
  function bindReveals() {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('on');
          if (en.target.id === 'statsSec') startStats();
          obs.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('[data-reveal]').forEach(function (s) { obs.observe(s); });
    // Fallback: nach 9s alles einblenden
    setTimeout(function () {
      document.querySelectorAll('[data-reveal]').forEach(function (s) { s.classList.add('on'); });
      startStats();
    }, 9000);
  }
  function startStats() {
    if (statsStarted) return;
    statsStarted = true;
    var t0 = performance.now();
    var dur = 1500;
    function tick(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      document.querySelector('[data-stat="customers"]').textContent = Math.round(STAT_CUSTOMERS * e).toLocaleString('de-DE') + '+';
      document.querySelector('[data-stat="rating"]').textContent = (STAT_RATING * e).toFixed(1).replace('.', ',');
      document.querySelector('[data-stat="products"]').textContent = Math.round((products.length || 40) * e);
      document.querySelector('[data-stat="days"]').textContent = Math.round(STAT_RETURN_DAYS * e);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ── Mobile-Menü / Drawer-Bindings ─────────────────────────
  function closeMobileMenu() { el('mobileWrap').style.display = 'none'; }
  function bindChrome() {
    el('hambBtn').addEventListener('click', function () { el('mobileWrap').style.display = 'block'; });
    el('mobileOverlay').addEventListener('click', closeMobileMenu);
    el('mobileClose').addEventListener('click', closeMobileMenu);
    el('mobileWrap').querySelectorAll('nav a').forEach(function (a) { a.addEventListener('click', closeMobileMenu); });
    el('cartBtn').addEventListener('click', openDrawer);
    el('stickyCartBtn').addEventListener('click', openDrawer);
    el('drawerOverlay').addEventListener('click', closeDrawer);
    el('drawerClose').addEventListener('click', closeDrawer);
    el('drawerContinue').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDrawer(); closeQv(); closeMobileMenu(); }
    });
    // Mini-Cart bei Hover (nur Desktop sinnvoll)
    var wrap = el('cartWrap');
    var hideT = null;
    wrap.addEventListener('mouseenter', function () {
      if (window.innerWidth <= 860) return;
      clearTimeout(hideT);
      renderMiniCart();
      el('miniCart').style.display = 'block';
    });
    wrap.addEventListener('mouseleave', function () {
      hideT = setTimeout(function () { el('miniCart').style.display = 'none'; }, 200);
    });
    // Such-Dropdown schließen bei Klick außerhalb
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-search')) {
        var d = el('searchDrop');
        if (d) d.style.display = 'none';
      }
    });
    var clearBtn = el('searchClear');
    clearBtn.addEventListener('click', function () {
      el('searchInputDesk').value = '';
      el('searchDrop').style.display = 'none';
      clearBtn.style.display = 'none';
    });
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    document.querySelector('.reel').style.setProperty('--reel-secs', REEL_SECS + 's');
    bindHeader();
    bindSpotlight();
    bindReveals();
    bindChrome();
    bindNewsletter();
    updateCartUI();
    updateWishUI();
    attachGridActions(el('bestGrid'));
    attachGridActions(el('allGrid'));
    setInterval(tickCountdown, 1000);

    fetch('products.json?v=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (all) {
        // Cache für cart.js (Slug-Auflösung, Add-ons) — VOLLSTÄNDIGE Liste
        try { localStorage.setItem('allProducts', JSON.stringify(all)); } catch (e) { /* voll */ }
        // ALI-Produkte auf der Startseite ausblenden (wie app.js)
        products = all.filter(function (p) { return !p.sku || String(p.sku).indexOf('ALI') !== 0; });
        renderReel();
        setupReelTimer();
        renderCatTiles();
        renderDeal();
        renderBestsellers();
        renderChips();
        renderAllGrid();
        renderRecent();
      })
      .catch(function (e) {
        console.error('❌ products.json laden fehlgeschlagen:', e);
        el('bestGrid').innerHTML = '<div style="color:#A79E8B;padding:30px;">Produkte konnten nicht geladen werden. Bitte Seite neu laden.</div>';
        el('allGrid').innerHTML = '';
      });

    bindSearch('searchInputDesk', el('searchDrop'), el('searchClear'));
    bindSearch('searchInputMobile', el('mobileResults'), null);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
