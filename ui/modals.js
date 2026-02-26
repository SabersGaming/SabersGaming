// ============================================================
// ui/modals.js — MODAL & TICKER UI
// Shop modal, story modal, ticker rotation.
// PURE RENDER: reads state + config, writes DOM.
// NO state mutations except purchaseProduct grant().
// ============================================================
"use strict";

// Shop modal opener
function openShopModal() {
  const gs = gameState;
  let html = "";
  for (const p of CONFIG.SHOP_PRODUCTS) {
    const isOwned = p.isPermanent && gs.purchaseHistory.includes(p.id);
    html += `<div class="shop-item ${isOwned ? "owned" : ""}">
      <div class="shop-item-name">${p.name}</div>
      <div class="shop-item-desc">${p.description}</div>
      <button class="shop-item-btn ${isOwned ? "owned" : ""}" ${isOwned ? "disabled" : ""} onclick="purchaseProduct('${p.id}')">${isOwned ? "Owned" : p.displayPrice}</button>
    </div>`;
  }
  document.getElementById("modal-shop-items").innerHTML = html;
  document.getElementById("modal-shop").classList.add("visible");
}

  const gs = gameState;
  const el = document.getElementById('shop-content');

  const categories = {};
  for (const p of CONFIG.SHOP_PRODUCTS) {
    if (!categories[p.category]) categories[p.category] = [];
    categories[p.category].push(p);
  }

  let html = '';
  const catLabels = { consumable: 'Resources & Consumables', premium: 'Premium Features' };
  for (const [cat, prods] of Object.entries(categories)) {
    html += `<div class="shop-category-header">${catLabels[cat] || cat}</div>`;
    for (const p of prods) {
      const isOwned = p.isPermanent && gs.premiumUnlocked;
      html += `<div class="shop-item">
        <div class="shop-item-info">
          <div class="shop-item-name">${p.name}</div>
          <div class="shop-item-desc">${p.description}</div>
        </div>
        <span class="shop-item-price">${p.displayPrice}</span>
        <button class="shop-item-btn ${isOwned ? 'owned' : ''}" ${isOwned ? 'disabled' : ''} onclick="purchaseProduct('${p.id}')">
          ${isOwned ? 'OWNED ✓' : 'Get Free'}
        </button>
      </div>`;
    }
  }

  el.innerHTML = html;
  document.getElementById('modal-shop').classList.add('visible');
}

function purchaseProduct(productId) {
  const gs = gameState;
  const product = CONFIG.SHOP_PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  if (product.isPermanent && gs.premiumUnlocked) return;

  // Simulate purchase
  const txId = 'SIM-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  product.grant(gs);
  if (!gs.purchaseHistory) gs.purchaseHistory = [];
  gs.purchaseHistory.push({ productId, txId, timestamp: Date.now() });

  addLog(`Purchase: ${product.name} applied! (TX: ${txId})`, 'system');
  saveGame();
  openShopModal(); // refresh
  updateUI();
}

// ---------- MODALS ----------
var storyCallback = null;
function showStoryModal(title, body, callback) {
  document.getElementById('modal-story-title').textContent = title;
  document.getElementById('modal-story-body').innerHTML = body.replace(/\n/g, '<br>');
  storyCallback = callback || null;
  document.getElementById('modal-story').classList.add('visible');
}

function closeStoryModal() {
  document.getElementById('modal-story').classList.remove('visible');
  if (storyCallback) {
    const cb = storyCallback;
    storyCallback = null;
    cb();
  }
}

// ---------- TICKER ----------
function rotateTicker() {
  const el = document.getElementById('ticker-text');
  const msgs = CONFIG.TICKER_MESSAGES;
  tickerIndex = (tickerIndex + 1) % msgs.length;
  // Build a wide scrolling string
  el.textContent = msgs.join('   ·   ');
  // Reset animation
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = '';
}

// ============================================================
// SAVE MODULE — IndexedDB local save + Firebase cloud
// ============================================================
var db = null;

