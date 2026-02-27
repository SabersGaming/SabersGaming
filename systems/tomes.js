'use strict';
// ============================================================
// TOMES — Tome purchasing, study, dark library. Writes state. No DOM.
// ============================================================

function buyTome(tomeKey) {
  const gs = gameState;
  const isSight = tomeKey === 'tome2_sight';
  const costDM  = isSight ? CONFIG.TOME_SIGHT_COST_DM : CONFIG.TOME_BINDING_COST_DM;
  const cap     = gs.tomeCaps[tomeKey];

  if (gs.tomes[tomeKey] >= cap) { addLog('Tome cap reached. Upgrade via Dark Library.', 'system'); return; }
  if (gs.darkMana < costDM)     { addLog('Insufficient Dark Mana for this Tome.', 'system'); return; }

  gs.darkMana -= costDM;
  gs.tomes[tomeKey]++;

  const statKey = isSight ? 'tomeSightPurchased' : 'tomeBindingPurchased';
  gs.statistics.lifetime[statKey]++;

  const name = isSight ? 'Tome of Sight' : 'Tome of Binding';
  addLog(`${name} acquired (${gs.tomes[tomeKey]}/${cap}).`, 'resource');
}

function doStudy() {
  const gs = gameState;
  if (gs.darkMana < CONFIG.STUDY_COST_DM) { addLog('Insufficient Dark Mana to Study.', 'system'); return; }
  gs.darkMana -= CONFIG.STUDY_COST_DM;
  gs.darkManaStudyBonus += CONFIG.STUDY_BONUS_DM;
  addLog(`Study complete. Dark Mana base generation +${CONFIG.STUDY_BONUS_DM.toFixed(2)}/tick.`, 'resource');
}

function openDarkLibrary() {
  const gs = gameState;
  document.getElementById('library-tup-display').textContent = gs.tomeUpgradePoints;

  const content  = document.getElementById('library-content');
  const binding  = gs.tomes.tome1_binding;
  const sight    = gs.tomes.tome2_sight;
  const bindingCap = gs.tomeCaps.tome1_binding;
  const sightCap   = gs.tomeCaps.tome2_sight;

  if (binding < bindingCap || sight < sightCap) {
    content.innerHTML = `<div class="library-locked-notice">
      The Dark Library is locked. Both Tomes must be at their current maximum caps before upgrades are available.<br><br>
      <span class="text-mana">Binding: ${binding}/${bindingCap}</span> |
      <span class="text-mana">Sight: ${sight}/${sightCap}</span>
    </div>`;
  } else {
    content.innerHTML = `
      <div class="library-upgrade-row">
        <div class="library-upgrade-info">
          <div class="library-upgrade-name">Binding Enhancement</div>
          <div class="library-upgrade-desc">Increase Tome of Binding cap by +1</div>
          <div class="library-upgrade-cap">Current cap: ${bindingCap} → ${bindingCap + 1}</div>
        </div>
        <button class="btn" id="btn-upgrade-binding" ${gs.tomeUpgradePoints < 1 ? 'disabled' : ''}>Upgrade (1 TUP)</button>
      </div>
      <div class="library-upgrade-row">
        <div class="library-upgrade-info">
          <div class="library-upgrade-name">Sight Enhancement</div>
          <div class="library-upgrade-desc">Increase Tome of Sight cap by +1</div>
          <div class="library-upgrade-cap">Current cap: ${sightCap} → ${sightCap + 1}</div>
        </div>
        <button class="btn" id="btn-upgrade-sight" ${gs.tomeUpgradePoints < 1 ? 'disabled' : ''}>Upgrade (1 TUP)</button>
      </div>`;

    // Wire buttons inside modal dynamically
    const bb = document.getElementById('btn-upgrade-binding');
    const bs = document.getElementById('btn-upgrade-sight');
    if (bb) bb.addEventListener('click', () => upgradeLibrary('binding'));
    if (bs) bs.addEventListener('click', () => upgradeLibrary('sight'));
  }

  document.getElementById('modal-library').classList.add('visible');
}

function upgradeLibrary(which) {
  const gs = gameState;
  if (gs.tomeUpgradePoints < CONFIG.TOME_LIBRARY_COST_TUP) { addLog('Insufficient Tome Upgrade Points.', 'system'); return; }
  gs.tomeUpgradePoints -= CONFIG.TOME_LIBRARY_COST_TUP;
  if (which === 'binding') {
    gs.tomeCaps.tome1_binding++;
    addLog(`Binding Enhancement: Tome of Binding cap increased to ${gs.tomeCaps.tome1_binding}!`, 'resource');
  } else {
    gs.tomeCaps.tome2_sight++;
    addLog(`Sight Enhancement: Tome of Sight cap increased to ${gs.tomeCaps.tome2_sight}!`, 'resource');
  }
  openDarkLibrary(); // refresh modal
}
