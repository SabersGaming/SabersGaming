'use strict';
// ============================================================
// RESOURCES — Cap calculations and per-tick production rates.
// Reads state. No DOM. No state writes.
// ============================================================

function calcZombieCap() {
  const gs = gameState;
  const lv = gs.necromancyLevel;
  const binding = gs.tomes.tome1_binding;
  let cap = Math.floor(25 * Math.pow(lv, 1.3)) + binding * 15;
  if (gs.grimoireSkills.relentlessHorde)       cap = Math.floor(cap * 1.25);
  if (gs.grimoireSkills.transcendentCommand)   cap = Math.floor(cap * 1.50);
  return Math.max(cap, 1);
}

function calcGhoulCap() {
  const gs = gameState;
  const lv = gs.necromancyLevel;
  const binding = gs.tomes.tome1_binding;
  let cap = Math.floor(12 * Math.pow(lv, 1.3)) + binding * 8;
  if (gs.grimoireSkills.transcendentCommand)   cap = Math.floor(cap * 1.50);
  return Math.max(cap, 0);
}

function calcGolemCap() {
  const gs = gameState;
  const lv = gs.necromancyLevel;
  const sight = gs.tomes.tome2_sight;
  let cap = Math.floor(6 * Math.pow(lv, 1.3)) + sight * 4;
  if (gs.grimoireSkills.transcendentCommand)   cap = Math.floor(cap * 1.50);
  return Math.max(cap, 0);
}

function calcWraithCap() {
  const gs = gameState;
  const lv = gs.necromancyLevel;
  let cap = Math.floor(5 * Math.pow(lv, 1.2));
  if (gs.grimoireSkills.transcendentCommand)   cap = Math.floor(cap * 1.50);
  return Math.max(cap, 0);
}

function getAscensionCost() {
  return CONFIG.ASCEND_BASE_COST * Math.pow(2, gameState.necromancyLevel - 1);
}

// ---------- PRODUCTION RATES ----------

function calcSEPerTick() {
  const gs = gameState;
  const skills = gs.grimoireSkills;
  let se = 0;

  if (!skills.sacrificeRavenous) {
    const binding = gs.tomes.tome1_binding;
    let thrallProd = 1 + binding * 0.05;
    if (skills.relentlessHorde) thrallProd += 0.5;
    se += gs.units.zombie * thrallProd;
  }

  if (!skills.sacrificeEssence) {
    se += gs.units.ghoul * 5;
  }

  if (!skills.sacrificeCritical) {
    let golemProd = 20;
    if (skills.ironboundTitan && gs.soulEssence >= getAscensionCost() * 0.8) golemProd *= 1.5;
    se += gs.units.golem * golemProd;
  }

  if (skills.armyDarkness) {
    se += gs.units.wraith * 50;
    se += gs.units.wraith * 0.2;
  }

  se *= gs.permanentEssenceMultiplier;

  if (skills.sacrificeRavenous) se *= 1.10;

  if (skills.necroticSynergy) {
    let types = 0;
    if (!skills.sacrificeRavenous && gs.units.zombie > 0) types++;
    if (!skills.sacrificeEssence && gs.units.ghoul > 0)  types++;
    if (!skills.sacrificeCritical && gs.units.golem > 0) types++;
    if (skills.armyDarkness && gs.units.wraith > 0)      types++;
    se *= 1 + (types * 0.05);
  }

  if (skills.lordsPresence) {
    const zCap  = calcZombieCap();
    const gCap  = calcGhoulCap();
    const golCap = calcGolemCap();
    const wCap  = calcWraithCap();
    if (
      (gs.units.zombie >= zCap  * 0.9 && zCap  > 0) ||
      (gs.units.ghoul  >= gCap  * 0.9 && gCap  > 0 && !skills.sacrificeEssence) ||
      (gs.units.golem  >= golCap* 0.9 && golCap > 0 && !skills.sacrificeCritical) ||
      (gs.units.wraith >= wCap  * 0.9 && wCap  > 0 && skills.armyDarkness)
    ) {
      se *= 1.25;
    }
  }

  if (skills.deathsDominance) se *= 1 + (gs.necromancyLevel * 0.01);

  if (gs.tower.floorsBuilt >= 1) se *= 1.05;
  if (gs.tower.floorsBuilt >= 5) se *= 1.10;

  if (gs.curses.activeSpell === 'feastOfSouls')    se *= 2;
  if (gs.curses.activeSpell === 'ruinousAmbition') se *= 2;

  return se;
}

function calcDMPerTick() {
  const gs = gameState;
  const skills = gs.grimoireSkills;
  let dm = 0;

  dm += gs.tomes.tome2_sight;
  dm += gs.darkManaStudyBonus;

  if (skills.sacrificeEssence) dm *= 1.20;

  if (gs.tower.floorsBuilt >= 2) dm *= 1.10;
  if (gs.tower.floorsBuilt >= 5) dm *= 1.10;

  if (gs.curses.activeSpell === 'ruinousAmbition') dm *= 0.5;
  if (gs.premiumUnlocked) dm *= 1.25;

  return dm;
}

function calcCMPerTick() {
  const gs = gameState;
  const skills = gs.grimoireSkills;
  let cm = 0;

  cm += 0.02;

  if (skills.corpseReavers && !skills.sacrificeRavenous)   cm += 0.15;
  if (skills.boneFortress && !skills.sacrificeCritical)    cm += gs.units.golem;
  if (skills.titanicRegeneration && !skills.sacrificeCritical) cm += gs.units.golem * 2;
  if (skills.armyDarkness)                                 cm += gs.units.wraith * 0.02;

  if (gs.tower.floorsBuilt >= 3) cm += 0.05;
  if (gs.tower.floorsBuilt >= 5) cm *= 1.10;

  return cm;
}
