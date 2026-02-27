'use strict';
// ============================================================
// DISPLAY — Resource display, curse buttons, main updateUI.
// Reads state. Writes DOM only. No formulas.
// ============================================================

function updateResourceDisplay() {
  const gs = gameState;

  const seStr   = formatNum(gs.soulEssence);
  const dmStr   = formatNum(gs.darkMana);
  const cmStr   = formatNum(gs.corpseMatter);
  const lvStr   = String(gs.necromancyLevel);
  const multStr = gs.permanentEssenceMultiplier.toFixed(1) + '×';
  const tupStr  = String(gs.tomeUpgradePoints);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('display-se',     seStr);
  set('display-dm',     dmStr);
  set('display-cm',     cmStr);
  set('display-level',  lvStr);
  set('display-mult',   multStr);
  set('display-tup',    tupStr);
  set('display-se-p',   seStr);
  set('display-dm-p',   dmStr);
  set('display-cm-p',   cmStr);
  set('display-level-p',lvStr);
  set('display-mult-p', multStr);
  set('display-tup-p',  tupStr);

  const zCap   = calcZombieCap();
  const gCap   = calcGhoulCap();
  const golCap = calcGolemCap();
  const wCap   = calcWraithCap();
  const binding = gs.tomes.tome1_binding;
  const sight   = gs.tomes.tome2_sight;

  set('display-zombies', `${gs.units.zombie}/${zCap}`);
  set('display-ghouls',  `${gs.units.ghoul}/${gCap}`);
  set('display-golems',  `${gs.units.golem}/${golCap}`);
  set('display-wraiths', `${gs.units.wraith}/${wCap}`);
  set('display-binding', `${binding}/${gs.tomeCaps.tome1_binding}`);
  set('display-sight',   `${sight}/${gs.tomeCaps.tome2_sight}`);

  // Ascension button text
  const cost = getAscensionCost();
  const canAscend = gs.soulEssence >= cost;
  const ascBtn = document.getElementById('btn-ascend');
  if (ascBtn) {
    ascBtn.disabled = !canAscend;
    const sub = ascBtn.querySelector('.btn-sub');
    if (sub) sub.textContent = `Cost: ${formatNum(cost)} SE (Lv ${gs.necromancyLevel} → ${gs.necromancyLevel + 1})`;
  }

  // Update buy-unit button states
  updateUnitButtons();
}

function updateUnitButtons() {
  const gs  = gameState;
  const sk  = gs.grimoireSkills;

  const unitDefs = [
    { id: 'btn-zombie',  type: 'zombie',  cap: calcZombieCap(), costSE: 10,   costDM: 0,   blocked: sk.sacrificeRavenous },
    { id: 'btn-ghoul',   type: 'ghoul',   cap: calcGhoulCap(),  costSE: 100,  costDM: 10,  blocked: sk.sacrificeEssence },
    { id: 'btn-golem',   type: 'golem',   cap: calcGolemCap(),  costSE: 1000, costDM: 50,  blocked: sk.sacrificeCritical },
    { id: 'btn-wraith',  type: 'wraith',  cap: calcWraithCap(), costSE: 5000, costDM: 100, blocked: !sk.armyDarkness },
  ];

  for (const ud of unitDefs) {
    const btn = document.getElementById(ud.id);
    if (!btn) continue;
    const sub = btn.querySelector('.btn-sub');
    if (ud.blocked) {
      btn.disabled = true;
      if (sub) sub.textContent = 'Sacrificed / Locked';
      continue;
    }
    const atCap = gs.units[ud.type] >= ud.cap;
    const canAfford = gs.soulEssence >= ud.costSE && gs.darkMana >= ud.costDM;
    btn.disabled = atCap || !canAfford;
    if (sub) {
      if (atCap) sub.textContent = 'CAP REACHED';
      else sub.textContent = `${formatNum(ud.costSE)} SE${ud.costDM > 0 ? ' + ' + ud.costDM + ' DM' : ''}`;
    }
  }

  // Tome buttons
  const tome1Btn = document.getElementById('btn-tome-binding');
  const tome2Btn = document.getElementById('btn-tome-sight');
  if (tome1Btn) {
    const atCap = gs.tomes.tome1_binding >= gs.tomeCaps.tome1_binding;
    tome1Btn.disabled = atCap || gs.darkMana < CONFIG.TOME_BINDING_COST_DM;
    const sub = tome1Btn.querySelector('.btn-sub');
    if (sub) sub.textContent = atCap ? 'CAP REACHED' : `${CONFIG.TOME_BINDING_COST_DM} DM`;
  }
  if (tome2Btn) {
    const atCap = gs.tomes.tome2_sight >= gs.tomeCaps.tome2_sight;
    tome2Btn.disabled = atCap || gs.darkMana < CONFIG.TOME_SIGHT_COST_DM;
    const sub = tome2Btn.querySelector('.btn-sub');
    if (sub) sub.textContent = atCap ? 'CAP REACHED' : `${CONFIG.TOME_SIGHT_COST_DM} DM`;
  }

  // Study button
  const studyBtn = document.getElementById('btn-study');
  if (studyBtn) studyBtn.disabled = gs.darkMana < CONFIG.STUDY_COST_DM;

  // Raise all button
  const raiseAllBtn = document.getElementById('btn-raise-all');
  if (raiseAllBtn) raiseAllBtn.disabled = gs.darkMana < 10 && gs.soulEssence < 10;

  // Curse buttons
  updateCurseButtons();
}

function updateCurseButtons() {
  const gs = gameState;
  const c  = gs.curses;

  // Curse button visibility + state
  const feastBtn = document.getElementById('btn-feast');
  if (feastBtn) {
    if (c.feastOfSoulsUnlocked) feastBtn.classList.add('curse-unlocked');
    feastBtn.disabled = !c.feastOfSoulsUnlocked || gs.darkMana < 100 || c.activeSpell === 'feastOfSouls';
  }

  const cgBtn = document.getElementById('btn-corpse-grat');
  if (cgBtn) {
    if (c.corpseGratificationUnlocked) cgBtn.classList.add('curse-unlocked');
    cgBtn.disabled = !c.corpseGratificationUnlocked || c.corpseGratificationCooldown > 0 || gs.soulEssence < 10000 || gs.darkMana < 750;
    const sub = cgBtn.querySelector('.btn-sub');
    if (sub) sub.textContent = c.corpseGratificationCooldown > 0 ? `Cooldown: ${formatTime(c.corpseGratificationCooldown)}` : '10k SE + 750 DM';
  }

  const ruinBtn = document.getElementById('btn-ruinous');
  if (ruinBtn) {
    if (c.ruinousAmbitionUnlocked) ruinBtn.classList.add('curse-unlocked');
    ruinBtn.disabled = !c.ruinousAmbitionUnlocked || c.ruinousAmbitionCooldown > 0 || gs.darkMana < 250 || c.activeSpell === 'ruinousAmbition';
    const sub = ruinBtn.querySelector('.btn-sub');
    if (sub) sub.textContent = c.ruinousAmbitionCooldown > 0 ? `Cooldown: ${formatTime(c.ruinousAmbitionCooldown)}` : '250 DM';
  }

  // Wraith button visibility
  if (gs.grimoireSkills.armyDarkness) {
    const wb = document.getElementById('btn-wraith');
    if (wb) wb.classList.remove('hidden');
    const wc = document.getElementById('display-wraiths-chip');
    if (wc) wc.classList.remove('hidden');
  }

  // Grimoire button visibility
  if (gs.grimoireUnlocked) {
    const gb = document.getElementById('btn-grimoire');
    if (gb) gb.classList.add('visible');
  }

  // Boss tab visibility
  if (gs.bossBattle.unlocked) {
    const bt = document.getElementById('tab-btn-boss');
    if (bt) bt.classList.remove('hidden');
  }
}

function updateUI() {
  updateResourceDisplay();
  if (currentTab === 'event-log')      renderEventLog();
  else if (currentTab === 'tower')     renderTowerTab();
  else if (currentTab === 'raid')      renderRaidTab();
  else if (currentTab === 'boss')      renderBossTab();
  else if (currentTab === 'quests')    renderQuestsTab();
  else if (currentTab === 'grimoire-codex') renderGrimoireCodexTab();
  else if (currentTab === 'stats')     renderStatsTab();
  else if (currentTab === 'info')      renderInfoTab();
}
