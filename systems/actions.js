// ============================================================
// systems/actions.js — PLAYER ACTION SYSTEM
// Owns: buyUnit, buyTome, doStudy, raiseAllUndead, performAscension,
//       castCurse, tower construction, Dark Library.
// Reads config + state. Writes only to its domain in state.
// NEVER touches DOM directly. Calls addLog() for feedback.
// ============================================================
'use strict';

function buyUnit(type) {
  const gs = gameState;
  const skills = gs.grimoireSkills;

  // Sacrifice gate checks
  if (type === 'zombie' && skills.sacrificeRavenous) {
    showStoryModal("Malakar Sneers", "I have SACRIFICED the zombie form. They are gone. Their essence fuels greater power now. I do not miss them."); return;
  }
  if (type === 'ghoul' && skills.sacrificeEssence) {
    showStoryModal("Malakar Sneers", "Ghouls? I surrendered them for a higher cause. The mana flows MORE freely without those whining specters."); return;
  }
  if (type === 'golem' && skills.sacrificeCritical) {
    showStoryModal("Malakar Sneers", "The golems were sacrificed. Critical Dominion demanded it. The raids are MORE profitable."); return;
  }
  if (type === 'wraith' && !skills.armyDarkness) {
    showStoryModal("Malakar Sneers", "Wraiths? You need the Army of Darkness grimoire skill to command wraiths, worm."); return;
  }

  let cap, costSE, costDM;
  switch (type) {
    case 'zombie': cap = calcZombieCap(); costSE = 10;   costDM = 0;   break;
    case 'ghoul':  cap = calcGhoulCap();  costSE = 100;  costDM = 10;  break;
    case 'golem':  cap = calcGolemCap();  costSE = 1000; costDM = 50;  break;
    case 'wraith': cap = calcWraithCap(); costSE = 5000; costDM = 100; break;
  }

  if (gs.units[type] >= cap)      { addLog('Unit cap reached, worm. Build more power first.', 'system'); return; }
  if (gs.soulEssence < costSE)    { addLog('Insufficient Soul Essence.', 'system'); return; }
  if (gs.darkMana < costDM)       { addLog('Insufficient Dark Mana.', 'system'); return; }

  gs.soulEssence -= costSE;
  gs.darkMana    -= costDM;
  gs.units[type]++;
  const statKey = type + 'sRaised';
  gs.statistics.lifetime[statKey]++;
  gs.statistics.currentRun[statKey] = (gs.statistics.currentRun[statKey] || 0) + 1;
  addLog(`Raised a ${CONFIG.UNITS[type].name}. (${gs.units[type]}/${cap})`, 'unit');
}

function raiseAllUndead() {
  const gs = gameState;
  const skills = gs.grimoireSkills;
  let raised = 0;
  const order = ['wraith', 'golem', 'ghoul', 'zombie'];
  for (const type of order) {
    if (type === 'zombie' && skills.sacrificeRavenous) continue;
    if (type === 'ghoul'  && skills.sacrificeEssence)  continue;
    if (type === 'golem'  && skills.sacrificeCritical)  continue;
    if (type === 'wraith' && !skills.armyDarkness)      continue;
    let cap, costSE, costDM;
    switch (type) {
      case 'zombie': cap = calcZombieCap(); costSE = 10;   costDM = 0;   break;
      case 'ghoul':  cap = calcGhoulCap();  costSE = 100;  costDM = 10;  break;
      case 'golem':  cap = calcGolemCap();  costSE = 1000; costDM = 50;  break;
      case 'wraith': cap = calcWraithCap(); costSE = 5000; costDM = 100; break;
    }
    while (gs.units[type] < cap && gs.soulEssence >= costSE && gs.darkMana >= costDM) {
      gs.soulEssence -= costSE;
      gs.darkMana    -= costDM;
      gs.units[type]++;
      const statKey = type + 'sRaised';
      gs.statistics.lifetime[statKey]++;
      gs.statistics.currentRun[statKey] = (gs.statistics.currentRun[statKey] || 0) + 1;
      raised++;
    }
  }
  if (raised > 0) addLog(`Raised ${raised} units.`, 'unit');
  else addLog('No units could be raised. Check caps and resources.', 'system');
}

function buyTome(tomeKey) {
  const gs = gameState;
  const isSight = tomeKey === 'tome2_sight';
  const costDM  = isSight ? CONFIG.TOME_SIGHT_COST_DM : CONFIG.TOME_BINDING_COST_DM;
  const cap     = gs.tomeCaps[tomeKey];
  if (gs.tomes[tomeKey] >= cap) { addLog('Tome cap reached. Expand the Dark Library.', 'system'); return; }
  if (gs.darkMana < costDM)     { addLog('Insufficient Dark Mana.', 'system'); return; }
  gs.darkMana -= costDM;
  gs.tomes[tomeKey]++;
  const statKey = isSight ? 'tomeSightPurchased' : 'tomeBindingPurchased';
  gs.statistics.lifetime[statKey]++;
  addLog(`Acquired ${isSight ? 'Tome of Sight' : 'Tome of Binding'}. (${gs.tomes[tomeKey]}/${cap})`, 'upgrade');
}

function doStudy() {
  const gs = gameState;
  if (gs.darkMana < CONFIG.STUDY_COST_DM) { addLog('Not enough Dark Mana to study, worm.', 'system'); return; }
  gs.darkMana -= CONFIG.STUDY_COST_DM;
  gs.darkManaStudyBonus += CONFIG.STUDY_BONUS_DM;
  addLog(`Study complete. Dark Mana base generation now +${(gs.darkManaStudyBonus).toFixed(2)}/tick.`, 'upgrade');
}

// ── Dark Ascension (Prestige — Pillar IV) ─────────────────────
// Must call resetRunState(). Writes to permanentEssenceMultiplier only.
function performAscension() {
  const gs = gameState;
  const cost = getAscensionCost();
  if (gs.soulEssence < cost) {
    addLog(`Need ${formatNum(cost)} Soul Essence to ascend.`, 'system'); return;
  }

  const oldLevel = gs.necromancyLevel;
  gs.soulEssence -= cost;
  gs.necromancyLevel++;
  gs.permanentEssenceMultiplier += 0.1;
  gs.tomeUpgradePoints += 1;
  gs.statistics.lifetime.ascensionsPerformed++;

  const isLevel20First = (gs.necromancyLevel === 20 && !gs.hasEverPrestiged);
  gs.hasEverPrestiged = true;

  // Unlock boss system on first ascension past L1
  if (!gs.bossBattle.unlocked && gs.necromancyLevel >= 2) {
    gs.bossBattle.unlocked = true;
    gs.bossBattle.maxBossUnlocked = 0;
    gs.bossBattle.countdownTicks = CONFIG.BOSS_UNLOCK_COUNTDOWN_TICKS;
    document.getElementById('tab-btn-boss').classList.remove('hidden');
    addLog('BOSS SYSTEM UNLOCKED. A champion rises to challenge you.', 'boss');
  }

  // Boss unlock expansion
  if (gs.bossBattle.unlocked) {
    gs.bossBattle.maxBossUnlocked = Math.min(
      CONFIG.BOSSES.length - 1,
      gs.bossBattle.maxBossUnlocked + 1
    );
  }

  // resetRunState — Pillar IV: Ascension must call this
  resetRunState(gs, isLevel20First);

  // Curse unlocks
  if (gs.necromancyLevel >= 2  && !gs.curses.feastOfSoulsUnlocked)         { gs.curses.feastOfSoulsUnlocked = true; document.getElementById('btn-feast').classList.add('curse-unlocked'); }
  if (gs.necromancyLevel >= 5  && !gs.curses.corpseGratificationUnlocked)  { gs.curses.corpseGratificationUnlocked = true; document.getElementById('btn-corpse-grat').classList.add('curse-unlocked'); }
  if (gs.necromancyLevel >= 10 && !gs.curses.ruinousAmbitionUnlocked)      { gs.curses.ruinousAmbitionUnlocked = true; document.getElementById('btn-ruinous').classList.add('curse-unlocked'); }
  if (gs.grimoireUnlocked) document.getElementById('btn-grimoire').classList.add('visible');

  addLog(`DARK ASCENSION! Now Level ${gs.necromancyLevel}. Multiplier: ×${gs.permanentEssenceMultiplier.toFixed(1)}`, 'prestige');

  // Story reveal
  const storyText = CONFIG.NECROMANCY_STORY[gs.necromancyLevel];
  if (storyText && !gs.storyShown[gs.necromancyLevel]) {
    gs.storyShown[gs.necromancyLevel] = true;
    showStoryModal(`Level ${gs.necromancyLevel} — Malakar Speaks`, storyText);
  }
}

// resetRunState — PILLAR IV: must isolate run state from meta state
function resetRunState(gs, isLevel20First) {
  // Preserved across ascension (via eternalLegion or intent)
  const keepUnits = gs.grimoireSkills.eternalLegion;

  if (!keepUnits) {
    gs.units = { zombie: 1, ghoul: 0, golem: 0, wraith: 0 };
  }
  gs.darkManaStudyBonus = 0;
  gs.tomes.tome1_binding = 0;
  gs.tomes.tome2_sight   = 0;
  gs.statistics.currentRun = {
    soulEssenceEarned: 0, darkManaEarned: 0, corpseMatterEarned: 0,
    unitsLost: 0, zombiesRaised: 0, ghoulsRaised: 0, golemsRaised: 0,
  };
  // Curses active spell clears
  gs.curses.activeSpell   = null;
  gs.curses.spellDuration = 0;

  // If special level 20 first — unlock grimoire
  if (isLevel20First) {
    gs.grimoireUnlocked = true;
  }
}

// ── Curses ────────────────────────────────────────────────────
function castCurse(id) {
  const gs = gameState;
  const curse = CONFIG.CURSES[id];
  if (!curse) return;

  // Discovery dialogues (first cast)
  if (id === 'corpseGratification' && !gs.curses.corpseGratificationDiscovered) {
    gs.curses.corpseGratificationDiscovered = true;
    showStoryModal('Corpse Gratification Discovered', curse.discoveryDialogue, () => { _applyCurse(id); });
    return;
  }
  if (id === 'ruinousAmbition' && !gs.curses.ruinousAmbitionDiscovered) {
    gs.curses.ruinousAmbitionDiscovered = true;
    showStoryModal('Ruinous Ambition Discovered', curse.discoveryDialogue, () => { _applyCurse(id); });
    return;
  }
  _applyCurse(id);
}

function _applyCurse(id) {
  const gs = gameState;
  const curse = CONFIG.CURSES[id];

  // Cooldown check
  if (id === 'corpseGratification' && gs.curses.corpseGratificationCooldown > 0) {
    addLog(`Corpse Gratification on cooldown: ${formatTime(gs.curses.corpseGratificationCooldown)}`, 'system'); return;
  }
  if (id === 'ruinousAmbition' && gs.curses.ruinousAmbitionCooldown > 0) {
    addLog(`Ruinous Ambition on cooldown: ${formatTime(gs.curses.ruinousAmbitionCooldown)}`, 'system'); return;
  }
  if (gs.curses.activeSpell && (id === 'feastOfSouls' || id === 'ruinousAmbition')) {
    addLog('A spell is already active, worm.', 'system'); return;
  }

  // Cost
  if (gs.soulEssence < (curse.costSE || 0)) { addLog('Not enough Soul Essence.', 'system'); return; }
  if (gs.darkMana    < (curse.costDM || 0)) { addLog('Not enough Dark Mana.', 'system'); return; }
  gs.soulEssence -= (curse.costSE || 0);
  gs.darkMana    -= (curse.costDM || 0);

  // Apply
  if (id === 'feastOfSouls') {
    gs.curses.activeSpell   = 'feastOfSouls';
    gs.curses.spellDuration = curse.effectDuration;
    gs.statistics.lifetime.cursescast_feast++;
    addLog('FEAST OF SOULS! Soul Essence production doubled for 60 seconds!', 'curse');
  } else if (id === 'corpseGratification') {
    gs.corpseMatter += curse.effectValue;
    gs.curses.corpseGratificationCooldown = curse.cooldown;
    gs.statistics.lifetime.cursescast_corpse++;
    addLog(`CORPSE GRATIFICATION! Gained ${curse.effectValue} Corpse Matter!`, 'curse');
  } else if (id === 'ruinousAmbition') {
    gs.curses.activeSpell          = 'ruinousAmbition';
    gs.curses.spellDuration        = curse.effectDuration;
    gs.curses.ruinousAmbitionCooldown = curse.cooldown;
    gs.statistics.lifetime.cursescast_ruinous++;
    addLog('RUINOUS AMBITION! SE doubled, DM halved for 5 minutes!', 'curse');
  }
}

// ── Tower System ──────────────────────────────────────────────
function startFloorBuild() {
  const gs = gameState;
  if (gs.tower.isBuilding) { addLog('Construction already underway.', 'system'); return; }
  if (gs.raidActive) { addLog('Cannot build while raid is active.', 'system'); return; }

  const nextFloor = gs.tower.floorsBuilt + 1;
  if (nextFloor > CONFIG.TOWER_FLOORS.length) { addLog('The Black Tower stands complete.', 'system'); return; }

  const floor = CONFIG.TOWER_FLOORS[nextFloor - 1];
  if (gs.soulEssence < floor.costSE) { addLog(`Need ${formatNum(floor.costSE)} SE.`, 'system'); return; }
  if (gs.darkMana    < floor.costDM) { addLog(`Need ${formatNum(floor.costDM)} DM.`, 'system'); return; }
  if (gs.corpseMatter < floor.costCM){ addLog(`Need ${floor.costCM} CM.`, 'system'); return; }

  // Unit requirements
  const wr = gs.units.wraith;
  const wEquiv = CONFIG.WRAITH_EQUIV;
  const effZ = gs.units.zombie + wr * wEquiv.zombie;
  const effG = gs.units.ghoul  + wr * wEquiv.ghoul;
  const effGol = gs.units.golem + wr * wEquiv.golem;
  if (effZ < floor.requireZombie) { addLog(randFrom(CONFIG.TOWER_FAIL_MESSAGES.noZombies), 'tower'); return; }
  if (effG < floor.requireGhoul)  { addLog(randFrom(CONFIG.TOWER_FAIL_MESSAGES.noGhouls), 'tower'); return; }
  if (effGol < floor.requireGolem){ addLog(randFrom(CONFIG.TOWER_FAIL_MESSAGES.noGolems), 'tower'); return; }

  gs.soulEssence  -= floor.costSE;
  gs.darkMana     -= floor.costDM;
  gs.corpseMatter -= floor.costCM;
  gs.tower.isBuilding        = true;
  gs.tower.buildFloor        = nextFloor;
  gs.tower.buildTimeRemaining = floor.buildTime;
  gs.tower.buildTimeFull      = floor.buildTime;
  addLog(`Construction begun: ${floor.name}. Estimated time: ${formatTime(floor.buildTime)}.`, 'tower');
}

function resolveFloorBuild() {
  const gs = gameState;
  const floor = CONFIG.TOWER_FLOORS[gs.tower.buildFloor - 1];
  gs.tower.isBuilding = false;

  if (roll(floor.failureChance)) {
    const msg = (gs.units.zombie < floor.requireZombie) ? randFrom(CONFIG.TOWER_FAIL_MESSAGES.noZombies)
              : (gs.units.ghoul  < floor.requireGhoul)  ? randFrom(CONFIG.TOWER_FAIL_MESSAGES.noGhouls)
              : (gs.units.golem  < floor.requireGolem)  ? randFrom(CONFIG.TOWER_FAIL_MESSAGES.noGolems)
              : randFrom(CONFIG.TOWER_FAIL_MESSAGES.random);
    addLog(`CONSTRUCTION FAILED: ${msg}`, 'tower');
    return;
  }

  gs.tower.floorsBuilt = gs.tower.buildFloor;
  gs.tower.maxFloorEver = Math.max(gs.tower.maxFloorEver, gs.tower.floorsBuilt);
  gs.statistics.lifetime.towerMaxFloor = Math.max(gs.statistics.lifetime.towerMaxFloor, gs.tower.floorsBuilt);
  addLog(`FLOOR COMPLETE: ${floor.name}! ${floor.bonus}`, 'tower');
  if (floor.story) showStoryModal(`Floor ${gs.tower.floorsBuilt} — ${floor.name}`, floor.story);
}

// ── Dark Library ──────────────────────────────────────────────
function openDarkLibrary() {
  const gs = gameState;
  const costTUP = CONFIG.TOME_LIBRARY_COST_TUP;
  const el = document.getElementById('modal-library');
  const bindingCap = gs.tomeCaps.tome1_binding;
  const sightCap   = gs.tomeCaps.tome2_sight;
  const canAfford  = gs.tomeUpgradePoints >= costTUP;

  document.getElementById('modal-library-tup').textContent = gs.tomeUpgradePoints;
  document.getElementById('modal-library-binding-cap').textContent = bindingCap;
  document.getElementById('modal-library-sight-cap').textContent   = sightCap;
  document.getElementById('modal-library-cost').textContent = costTUP;
  document.getElementById('btn-upgrade-binding').disabled = !canAfford;
  document.getElementById('btn-upgrade-sight').disabled   = !canAfford;
  el.classList.add('visible');
}

function upgradeLibrary(which) {
  const gs = gameState;
  const costTUP = CONFIG.TOME_LIBRARY_COST_TUP;
  if (gs.tomeUpgradePoints < costTUP) { addLog('Not enough Tome Upgrade Points.', 'system'); return; }
  gs.tomeUpgradePoints -= costTUP;
  if (which === 'binding') {
    gs.tomeCaps.tome1_binding += 25;
    addLog(`Tome of Binding cap expanded to ${gs.tomeCaps.tome1_binding}.`, 'upgrade');
  } else {
    gs.tomeCaps.tome2_sight += 25;
    addLog(`Tome of Sight cap expanded to ${gs.tomeCaps.tome2_sight}.`, 'upgrade');
  }
  openDarkLibrary(); // refresh display
}
