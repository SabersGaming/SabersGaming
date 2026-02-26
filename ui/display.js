// ============================================================
// ui/display.js — CORE DISPLAY SYSTEM
// Owns: addLog, renderEventLog, updateResourceDisplay,
//       updateCurseButtons, updateUI (master render), switchTab.
// PURE RENDER: reads state, writes DOM. NO logic. NO formulas.
// updateUI() is the single entry point called once per tick.
// ============================================================
'use strict';

// Event log buffer
var _eventLog = [];
var _eventLogMax = 150;

function addLog(text, type) {
  type = type || 'system';
  _eventLog.unshift({ text, type, ts: Date.now() });
  if (_eventLog.length > _eventLogMax) _eventLog.pop();
}

function renderEventLog() {
  const el = document.getElementById('event-log');
  if (!el) return;
  el.innerHTML = _eventLog.map(e =>
    `<div class="log-entry log-${e.type}">${e.text}</div>`
  ).join('');
}

function updateResourceDisplay() {
  const gs = gameState;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Landscape
  set('display-se',    formatNum(gs.soulEssence));
  set('display-dm',    formatNum(gs.darkMana));
  set('display-cm',    formatNum(gs.corpseMatter));
  set('display-level', gs.necromancyLevel);
  set('display-mult',  gs.permanentEssenceMultiplier.toFixed(1) + '×');
  set('display-tup',   gs.tomeUpgradePoints);
  // Portrait
  set('display-se-p',  formatNum(gs.soulEssence));
  set('display-dm-p',  formatNum(gs.darkMana));
  set('display-cm-p',  formatNum(gs.corpseMatter));
  set('display-level-p', gs.necromancyLevel);
  set('display-mult-p',  gs.permanentEssenceMultiplier.toFixed(1) + '×');
  set('display-tup-p',   gs.tomeUpgradePoints);

  // Units
  const zCap   = calcZombieCap();
  const gCap   = calcGhoulCap();
  const golCap = calcGolemCap();
  const wCap   = calcWraithCap();
  set('display-zombies', `${gs.units.zombie}/${zCap}`);
  set('display-ghouls',  `${gs.units.ghoul}/${gCap}`);
  set('display-golems',  `${gs.units.golem}/${golCap}`);
  set('display-wraiths', `${gs.units.wraith}/${wCap}`);

  // Tomes
  set('display-binding', `${gs.tomes.tome1_binding}/${gs.tomeCaps.tome1_binding}`);
  set('display-sight',   `${gs.tomes.tome2_sight}/${gs.tomeCaps.tome2_sight}`);

  // Rates
  const seRate = calcSEPerTick();
  const dmRate = calcDMPerTick();
  const cmRate = calcCMPerTick();
  set('display-se-rate', `+${formatNum(seRate)}/s`);
  set('display-dm-rate', dmRate > 0 ? `+${dmRate.toFixed(2)}/s` : '0/s');
  set('display-cm-rate', `+${cmRate.toFixed(3)}/s`);

  // Ascension cost
  const asc = getAscensionCost();
  set('display-ascend-cost', formatNum(asc));
  const ascBtn = document.getElementById('btn-ascend');
  if (ascBtn) ascBtn.disabled = gs.soulEssence < asc;
}

function updateCurseButtons() {
  const gs = gameState;
  const curses = gs.curses;

  const feastBtn = document.getElementById('btn-feast');
  const corpseBtn = document.getElementById('btn-corpse-grat');
  const ruinBtn = document.getElementById('btn-ruinous');

  if (feastBtn) {
    feastBtn.disabled = !curses.feastOfSoulsUnlocked ||
      gs.darkMana < CONFIG.CURSES.feastOfSouls.costDM ||
      !!curses.activeSpell;
    const lbl = feastBtn.querySelector('.curse-status');
    if (lbl) lbl.textContent = curses.activeSpell === 'feastOfSouls'
      ? `Active: ${formatTime(curses.spellDuration)}` : '';
  }
  if (corpseBtn) {
    corpseBtn.disabled = !curses.corpseGratificationUnlocked ||
      gs.darkMana < CONFIG.CURSES.corpseGratification.costDM ||
      gs.soulEssence < CONFIG.CURSES.corpseGratification.costSE ||
      curses.corpseGratificationCooldown > 0;
    const lbl = corpseBtn.querySelector('.curse-status');
    if (lbl) lbl.textContent = curses.corpseGratificationCooldown > 0
      ? `CD: ${formatTime(curses.corpseGratificationCooldown)}` : '';
  }
  if (ruinBtn) {
    ruinBtn.disabled = !curses.ruinousAmbitionUnlocked ||
      gs.darkMana < CONFIG.CURSES.ruinousAmbition.costDM ||
      !!curses.activeSpell || curses.ruinousAmbitionCooldown > 0;
    const lbl = ruinBtn.querySelector('.curse-status');
    if (lbl) lbl.textContent = curses.activeSpell === 'ruinousAmbition'
      ? `Active: ${formatTime(curses.spellDuration)}`
      : curses.ruinousAmbitionCooldown > 0
        ? `CD: ${formatTime(curses.ruinousAmbitionCooldown)}` : '';
  }
}

// ── Master Render — called ONCE per tick, always last ─────────
// This is the single legal DOM update entry point.
function updateUI() {
  updateResourceDisplay();
  updateCurseButtons();
  if (currentTab === 'event-log') renderEventLog();
  else if (currentTab === 'tower') renderTowerTab();
  else if (currentTab === 'raid')  renderRaidTab();
  else if (currentTab === 'boss')  renderBossTab();
  else if (currentTab === 'quests') renderQuestsTab();
  else if (currentTab === 'grimoire-codex') renderGrimoireCodexTab();
  else if (currentTab === 'stats') renderStatsTab();
}

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabId));
  updateUI();
}
