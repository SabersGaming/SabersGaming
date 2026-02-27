'use strict';
// ============================================================
// SHOP — IAP / purchase logic. Writes state. No DOM.
// ============================================================

function purchaseProduct(productId) {
  const gs      = gameState;
  const product = CONFIG.SHOP_PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  if (product.isPermanent && gs.purchaseHistory.includes(productId)) {
    addLog(`${product.name} already owned.`, 'system');
    return;
  }

  // Simulate purchase (no real payment in testing mode)
  product.grant(gs);
  if (product.isPermanent) gs.purchaseHistory.push(productId);
  gs.statistics.lifetime.soulEssenceEarned = gs.statistics.lifetime.soulEssenceEarned || 0;

  addLog(`PURCHASED: ${product.name}!`, 'resource');
  document.getElementById('modal-shop').classList.remove('visible');
  saveGame();
  updateUI();
}

function openShopModal() {
  const gs = gameState;
  const content = document.getElementById('shop-content');

  const consumables = CONFIG.SHOP_PRODUCTS.filter(p => p.category === 'consumable');
  const premiums    = CONFIG.SHOP_PRODUCTS.filter(p => p.category === 'premium');

  let html = '<div class="shop-category-header">⚡ Consumables</div>';
  for (const p of consumables) {
    html += `<div class="shop-item">
      <div class="shop-item-info">
        <div class="shop-item-name">${p.name}</div>
        <div class="shop-item-desc">${p.description}</div>
      </div>
      <span class="shop-item-price">${p.displayPrice}</span>
      <button class="shop-item-btn" data-product="${p.id}">Buy</button>
    </div>`;
  }

  html += '<div class="shop-category-header">⭐ Premium</div>';
  for (const p of premiums) {
    const owned = gs.purchaseHistory.includes(p.id);
    html += `<div class="shop-item">
      <div class="shop-item-info">
        <div class="shop-item-name">${p.name}</div>
        <div class="shop-item-desc">${p.description}</div>
      </div>
      <span class="shop-item-price">${p.displayPrice}</span>
      <button class="shop-item-btn ${owned ? 'owned' : ''}" data-product="${p.id}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : 'Buy'}</button>
    </div>`;
  }

  content.innerHTML = html;

  content.querySelectorAll('.shop-item-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => purchaseProduct(btn.dataset.product));
  });

  document.getElementById('modal-shop').classList.add('visible');
}
