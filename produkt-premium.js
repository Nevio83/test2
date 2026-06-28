/* ========================================================
   MAIOS PRODUKT PREMIUM — Shared Behaviour
   Countdown · Viewers · Sticky Bar · Toast · Cart ·
   Wishlist · Bundles · UI initialisierung
   ======================================================== */

(function () {
  'use strict';

  /* --- Countdown --- */
  function initCountdown() {
    const boxes = document.querySelectorAll('.pp-cd-box[data-unit]');
    if (!boxes.length) return;

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    function tick() {
      const diff = Math.max(0, end - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      boxes.forEach(b => {
        if (b.dataset.unit === 'h') b.textContent = String(h).padStart(2, '0');
        if (b.dataset.unit === 'm') b.textContent = String(m).padStart(2, '0');
        if (b.dataset.unit === 's') b.textContent = String(s).padStart(2, '0');
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  /* --- Live Viewers --- */
  function initViewers() {
    const el = document.getElementById('pp-viewers-count');
    if (!el) return;
    const base = parseInt(el.textContent, 10) || 12;
    setInterval(() => {
      const delta = Math.floor(Math.random() * 5) - 2;
      el.textContent = Math.max(3, base + delta);
    }, 8000 + Math.random() * 4000);
  }

  /* --- Notification Toast --- */
  function showNotif(msg) {
    const el = document.getElementById('pp-notif');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('pp-notif-show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('pp-notif-show'), 3200);
  }
  window.showNotif = showNotif;

  /* --- Cart Helpers --- */
  function getCart() {
    try { return JSON.parse(localStorage.getItem('maiosCart') || '[]'); }
    catch { return []; }
  }
  function saveCart(c) { localStorage.setItem('maiosCart', JSON.stringify(c)); }
  function getCartCount() { return getCart().reduce((s, i) => s + (i.quantity || 1), 0); }

  function updateCartBadge() {
    const cnt = getCartCount();
    document.querySelectorAll('.pp-cart-badge').forEach(b => {
      b.textContent = cnt;
      b.style.display = cnt > 0 ? 'flex' : 'none';
    });
  }

  function addToCartAction(qty) {
    qty = qty || 1;
    const p = window.product;
    if (!p) return;
    const cart = getCart();
    const existing = cart.find(i => i.id === p.id);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + qty;
    } else {
      cart.push({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image,
        slug: p.slug || '',
        quantity: qty
      });
    }
    saveCart(cart);
    updateCartBadge();
    showNotif('✓ Zum Warenkorb hinzugefügt');
    showPurchaseToast();
  }
  window.addToCartAction = addToCartAction;

  /* --- Wishlist Helpers --- */
  function getWishlist() {
    try { return JSON.parse(localStorage.getItem('maiosWishlist') || '[]'); }
    catch { return []; }
  }
  function saveWishlist(w) { localStorage.setItem('maiosWishlist', JSON.stringify(w)); }

  function toggleWishlistAction() {
    const p = window.product;
    if (!p) return;
    const w = getWishlist();
    const idx = w.findIndex(i => i.id === p.id);
    const btn = document.getElementById('wishlistBtn') || document.querySelector('.pp-wish-btn');
    if (idx >= 0) {
      w.splice(idx, 1);
      saveWishlist(w);
      showNotif('Von Wunschliste entfernt');
      if (btn) { btn.innerHTML = '<i class="bi bi-heart"></i>'; btn.style.color = ''; }
    } else {
      w.push({ id: p.id, name: p.name, price: p.price, image: p.image, slug: p.slug || '' });
      saveWishlist(w);
      showNotif('❤ Zur Wunschliste hinzugefügt');
      if (btn) { btn.innerHTML = '<i class="bi bi-heart-fill"></i>'; btn.style.color = '#f472b6'; }
    }
  }
  window.toggleWishlistAction = toggleWishlistAction;

  function syncWishlistBtn() {
    const p = window.product;
    if (!p) return;
    const btn = document.getElementById('wishlistBtn') || document.querySelector('.pp-wish-btn');
    if (!btn) return;
    const isWishlisted = getWishlist().some(i => i.id === p.id);
    if (isWishlisted) {
      btn.innerHTML = '<i class="bi bi-heart-fill"></i>';
      btn.style.color = '#f472b6';
    }
  }

  /* --- Qty Control --- */
  function initQty() {
    const input = document.getElementById('pp-qty') || document.querySelector('.pp-qty-input');
    const plus  = document.getElementById('pp-qty-plus')  || document.querySelector('.pp-qty-btn[data-dir="+"]');
    const minus = document.getElementById('pp-qty-minus') || document.querySelector('.pp-qty-btn[data-dir="-"]');
    if (!input) return;

    function getQty() { return Math.max(1, parseInt(input.value, 10) || 1); }

    if (plus)  plus.addEventListener('click', () => { input.value = getQty() + 1; });
    if (minus) minus.addEventListener('click', () => { input.value = Math.max(1, getQty() - 1); });
    input.addEventListener('change', () => { if (getQty() < 1) input.value = 1; });
  }

  /* --- Cart / Wishlist Button Binding --- */
  function bindButtons() {
    const cartBtn = document.getElementById('cartBtn') || document.getElementById('heroCartBtn');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => {
        const qtyInput = document.getElementById('pp-qty') || document.querySelector('.pp-qty-input');
        const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
        addToCartAction(qty);
      });
    }

    const wishBtn = document.getElementById('wishlistBtn') || document.querySelector('.pp-wish-btn');
    if (wishBtn) {
      wishBtn.addEventListener('click', toggleWishlistAction);
    }
  }

  /* --- Sticky Bar --- */
  function initStickyBar() {
    const bar = document.getElementById('pp-sticky');
    if (!bar) return;
    const hero = document.querySelector('.pp-buybox') || document.querySelector('.pp-hero');
    const stickyBtn = bar.querySelector('.pp-sticky-btn');

    if (stickyBtn) {
      stickyBtn.addEventListener('click', () => {
        const qtyInput = document.getElementById('pp-qty') || document.querySelector('.pp-qty-input');
        const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
        addToCartAction(qty);
      });
    }

    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        bar.classList.toggle('pp-sticky-show', !e.isIntersecting);
      });
    }, { rootMargin: '0px 0px -80px 0px' });

    if (hero) obs.observe(hero);
  }

  /* --- Purchase Toast --- */
  function showPurchaseToast() {
    const toast = document.getElementById('pp-toast');
    if (!toast) return;
    toast.classList.add('pp-toast-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('pp-toast-show'), 4500);
  }
  window.showPurchaseToast = showPurchaseToast;

  /* --- Bundles (Fallback wenn bundle-images-final.js nicht greift) --- */
  function renderBundles(bundles) {
    const section = document.getElementById('bundle-section');
    if (!section) return;
    if (!bundles || !bundles.length) { section.style.display = 'none'; return; }

    const p = window.product;
    const einzelpreis = p ? p.price : 0;

    const html = bundles.map((b, i) => {
      const totalPrice = (einzelpreis * b.quantity + (b.extraCost || 0)).toFixed(2);
      const saving = b.saving ? `${b.saving}` : '';
      return `
      <div class="bundle-card${i === 0 ? ' selected' : ''}" onclick="selectBundle(${i})">
        <input class="bundle-radio" type="radio" name="bundle" ${i === 0 ? 'checked' : ''}>
        <div class="bundle-info">
          <div class="bundle-title">${b.title || b.quantity + 'x ' + (p ? p.name : '')}</div>
          <div class="bundle-prices">€${totalPrice}</div>
          ${saving ? `<div class="bundle-total bundle-savings">Du sparst ${saving}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    section.innerHTML = `
      <div class="bundle-box">
        <div class="bundle-header">🎁 SPARANGEBOTE</div>
        ${html}
        <button class="bundle-add-btn" onclick="addBundleToCart()">
          <i class="bi bi-bag-plus-fill"></i> Bundle in den Warenkorb
        </button>
      </div>`;
    section.style.display = '';
  }
  window.renderBundles = renderBundles;

  window.selectBundle = function (idx) {
    document.querySelectorAll('.bundle-card').forEach((c, i) => {
      c.classList.toggle('selected', i === idx);
      const r = c.querySelector('.bundle-radio');
      if (r) r.checked = (i === idx);
    });
  };

  window.addBundleToCart = function () {
    const card = document.querySelector('.bundle-card.selected');
    if (!card) return;
    const price = card.querySelector('.bundle-prices')?.textContent?.replace('€', '').trim();
    const title = card.querySelector('.bundle-title')?.textContent?.trim();
    const p = window.product;
    if (!p) return;
    const cart = getCart();
    cart.push({
      id: p.id,
      name: title || p.name,
      price: parseFloat(price) || p.price,
      image: p.image,
      slug: p.slug || '',
      quantity: 1
    });
    saveCart(cart);
    updateCartBadge();
    showNotif('✓ Bundle zum Warenkorb hinzugefügt');
    showPurchaseToast();
  };

  /* --- Notification element (legacy compat) --- */
  function showNotification(msg) { showNotif(msg); }
  window.showNotification = showNotification;

  /* --- Init --- */
  document.addEventListener('DOMContentLoaded', function () {
    initCountdown();
    initViewers();
    initQty();
    bindButtons();
    initStickyBar();
    updateCartBadge();
    syncWishlistBtn();
  });

})();
