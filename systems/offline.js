'use strict';
// ============================================================
// OFFLINE — Offline progress calculation and modal.
// ============================================================

function handleOfflineProgress() {
  const gs  = gameState;
  const now = Date.now();
  const elapsedSeconds = Math.min((now - gs.lastSaveTimestamp) / 1000, CONFIG.OFFLINE_CAP_SECONDS);
  gs.lastSaveTimestamp = now;

  if (elapsedSeconds < 60) return;

  gs.offlineTime = Math.floor(elapsedSeconds);
  if (gs.premiumUnlocked) gs.offlineTime = Math.min(Math.floor(gs.offlineTime * 2), CONFIG.OFFLINE_CAP_SECONDS);

  const bark = getOfflineBark(elapsedSeconds);
  showOfflineModal(Math.floor(elapsedSeconds), bark);
}

function getOfflineBark(seconds) {
  const barks = CONFIG.OFFLINE_BARKS;
  if (seconds >= 14400) return barks['14400'];
  if (seconds >= 7200)  return barks['7200'].replace('[time]', formatTime(seconds));
  if (seconds >= 3600)  return barks['3600'].replace('[time]', formatTime(seconds));
  if (seconds >= 1800)  return barks['1800'];
  return barks['300'];
}

function showOfflineModal(seconds, bark) {
  const gs   = gameState;
  const body = document.getElementById('offline-modal-body');
  body.innerHTML = `<p>${bark}</p><hr class="section-divider"><p>You were away for <strong>${formatTime(seconds)}</strong>. Allocate your offline production across resources:</p>`;

  const seEst = formatNum(Math.floor(calcSEPerTick() * seconds));
  const dmEst = formatNum(Math.floor(calcDMPerTick() * seconds));
  const cmEst = formatNum(Math.floor(calcCMPerTick() * seconds));

  const controls = document.getElementById('offline-controls');
  controls.innerHTML = `
    <div class="offline-slider-row">
      <label style="color:var(--text-necrotic);">Soul Essence — <span id="offline-se-time">${formatTime(seconds)}</span></label>
      <input type="range" class="offline-slider" id="offline-se-slider" min="0" max="${seconds}" value="${seconds}">
      <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">
        Estimated: <span id="offline-se-yield" class="text-necrotic">${seEst}</span> SE
      </div>
    </div>
    <div class="offline-slider-row" style="margin-top:10px;">
      <label style="color:var(--text-mana);">Dark Mana — <span id="offline-dm-time">${formatTime(0)}</span></label>
      <input type="range" class="offline-slider" id="offline-dm-slider" min="0" max="${seconds}" value="0">
      <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">
        Estimated: <span id="offline-dm-yield" class="text-mana">0</span> DM
      </div>
    </div>
    <div class="offline-slider-row" style="margin-top:10px;">
      <label style="color:var(--text-shadow);">Corpse Matter — <span id="offline-cm-time">${formatTime(0)}</span></label>
      <input type="range" class="offline-slider" id="offline-cm-slider" min="0" max="${seconds}" value="0">
      <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">
        Estimated: <span id="offline-cm-yield" class="text-shadow">0</span> CM
      </div>
    </div>
    <div style="font-size:11px;color:var(--text-dim);margin-top:8px;text-align:center;">
      Unallocated time is lost. Total: <span id="offline-total-time">${formatTime(seconds)}</span> / ${formatTime(seconds)}
    </div>`;

  // Wire sliders
  document.getElementById('offline-se-slider').addEventListener('input', () => updateOfflineSlider('se', seconds));
  document.getElementById('offline-dm-slider').addEventListener('input', () => updateOfflineSlider('dm', seconds));
  document.getElementById('offline-cm-slider').addEventListener('input', () => updateOfflineSlider('cm', seconds));

  document.getElementById('modal-offline').classList.add('visible');
}

function updateOfflineSlider(changed, max) {
  const seSlider = document.getElementById('offline-se-slider');
  const dmSlider = document.getElementById('offline-dm-slider');
  const cmSlider = document.getElementById('offline-cm-slider');
  if (!seSlider || !dmSlider || !cmSlider) return;

  let seVal = parseInt(seSlider.value);
  let dmVal = parseInt(dmSlider.value);
  let cmVal = parseInt(cmSlider.value);

  if (changed === 'se') {
    const remaining = max - seVal;
    if (dmVal + cmVal > remaining) {
      const ratio = (dmVal + cmVal) > 0 ? remaining / (dmVal + cmVal) : 0;
      dmVal = Math.floor(dmVal * ratio);
      cmVal = remaining - dmVal;
    }
  } else if (changed === 'dm') {
    const remaining = max - dmVal;
    if (seVal + cmVal > remaining) {
      const ratio = (seVal + cmVal) > 0 ? remaining / (seVal + cmVal) : 0;
      seVal = Math.floor(seVal * ratio);
      cmVal = remaining - seVal;
    }
  } else if (changed === 'cm') {
    const remaining = max - cmVal;
    if (seVal + dmVal > remaining) {
      const ratio = (seVal + dmVal) > 0 ? remaining / (seVal + dmVal) : 0;
      seVal = Math.floor(seVal * ratio);
      dmVal = remaining - seVal;
    }
  }

  seVal = Math.max(0, Math.min(max, seVal));
  dmVal = Math.max(0, Math.min(max, dmVal));
  cmVal = Math.max(0, Math.min(max, cmVal));

  seSlider.value = seVal;
  dmSlider.value = dmVal;
  cmSlider.value = cmVal;

  document.getElementById('offline-se-time').textContent = formatTime(seVal);
  document.getElementById('offline-dm-time').textContent = formatTime(dmVal);
  document.getElementById('offline-cm-time').textContent = formatTime(cmVal);

  document.getElementById('offline-se-yield').textContent = formatNum(Math.floor(calcSEPerTick() * seVal));
  document.getElementById('offline-dm-yield').textContent = formatNum(Math.floor(calcDMPerTick() * dmVal));
  document.getElementById('offline-cm-yield').textContent = formatNum(Math.floor(calcCMPerTick() * cmVal));

  const total = seVal + dmVal + cmVal;
  document.getElementById('offline-total-time').textContent = formatTime(total);
}

function applyOfflineProgress() {
  const gs       = gameState;
  const seSlider = document.getElementById('offline-se-slider');
  const dmSlider = document.getElementById('offline-dm-slider');
  const cmSlider = document.getElementById('offline-cm-slider');

  const seTime = seSlider ? parseInt(seSlider.value) : 0;
  const dmTime = dmSlider ? parseInt(dmSlider.value) : 0;
  const cmTime = cmSlider ? parseInt(cmSlider.value) : 0;

  const seGain = Math.floor(calcSEPerTick() * seTime);
  const dmGain = Math.floor(calcDMPerTick() * dmTime);
  const cmGain = Math.floor(calcCMPerTick() * cmTime);

  if (seGain > 0) { gs.soulEssence += seGain; gs.statistics.lifetime.soulEssenceEarned += seGain; }
  if (dmGain > 0) { gs.darkMana    += dmGain; gs.statistics.lifetime.darkManaEarned    += dmGain; }
  if (cmGain > 0) { gs.corpseMatter+= cmGain; gs.statistics.lifetime.corpseMatterEarned+= cmGain; }

  gs.offlineTime = 0;
  document.getElementById('modal-offline').classList.remove('visible');

  addLog(`Offline gains applied: +${formatNum(seGain)} SE, +${formatNum(dmGain)} DM, +${cmGain} CM`, 'system');
  updateUI();
}
