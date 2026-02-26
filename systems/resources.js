// ============================================================
// systems/resources.js — RESOURCE SYSTEM (Pillar I & II)
// Owns all resource generation logic.
// Reads state + config. Writes resource totals to state.
// NEVER touches DOM. NEVER calls progression.js directly.
// All production rate calculations live here.
// ============================================================
'use strict';

// ── Production Rate Calculations ─────────────────────────────
// All multipliers applied in a single pipeline per resource.
// Multiplier categories: base → prestige → synergy → conditional → spell

function calcSEPerTick() {
  const gs = gameState;
  const skills = gs.grimoireSkills;
  let se = 0;

  // BASE: unit production
  if (!skills.sacrificeRavenous) {
    const binding = gs.tomes.tome1_binding;
    let thrallProd = 1 + binding * 0.05;
    if (skills.relentlessHorde) thrallProd += 0.5;         // synergy multiplier
    se += gs.units.zombie * thrallProd;
  }
  if (!skills.sacrificeEssence) {
    let ghoulProd = 5;
    se += gs.units.ghoul * ghoulProd;
  }
  if (!skills.sacrificeCritical) {
    let golemProd = 20;
    if (skills.ironboundTitan && gs.soulEssence >= getAscensionCost() * 0.8) {
      golemProd *= 1.5;                                     // conditional multiplier
    }
    se += gs.units.golem * golemProd;
  }
  if (skills.armyDarkness) {
    se += gs.units.wraith * 50;
    se += gs.units.wraith * 0.2;
  }

  // PRESTIGE multiplier (permanent)
  se *= gs.permanentEssenceMultiplier;

  // SYNERGY multipliers (grimoire skills)
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
    const zCap   = calcZombieCap();
    const gCap   = calcGhoulCap();
    const golCap = calcGolemCap();
    const wCap   = calcWraithCap();
    if (
      (gs.units.zombie >= zCap   * 0.9 && zCap   > 0) ||
      (gs.units.ghoul  >= gCap   * 0.9 && gCap   > 0 && !skills.sacrificeEssence) ||
      (gs.units.golem  >= golCap * 0.9 && golCap > 0 && !skills.sacrificeCritical) ||
      (gs.units.wraith >= wCap   * 0.9 && wCap   > 0 && skills.armyDarkness)
    ) {
      se *= 1.25;
    }
  }
  if (skills.deathsDominance) se *= 1 + (gs.necromancyLevel * 0.01);

  // Tower bonuses (prestige layer)
  if (gs.tower.floorsBuilt >= 1) se *= 1.05;
  if (gs.tower.floorsBuilt >= 5) se *= 1.10;

  // CONDITIONAL spell multipliers (last in pipeline)
  if (gs.curses.activeSpell === 'feastOfSouls')    se *= 2;
  if (gs.curses.activeSpell === 'ruinousAmbition') se *= 2;

  return se;
}

function calcDMPerTick() {
  const gs = gameState;
  const skills = gs.grimoireSkills;
  let dm = 0;

  // BASE
  dm += gs.tomes.tome2_sight;
  dm += gs.darkManaStudyBonus;

  // SYNERGY
  if (skills.sacrificeEssence) dm *= 1.20;

  // Tower bonuses
  if (gs.tower.floorsBuilt >= 2) dm *= 1.10;
  if (gs.tower.floorsBuilt >= 5) dm *= 1.10;

  // CONDITIONAL spell penalty
  if (gs.curses.activeSpell === 'ruinousAmbition') dm *= 0.5;

  // Premium bonus
  if (gs.premiumUnlocked) dm *= 1.25;

  return dm;
}

function calcCMPerTick() {
  const gs = gameState;
  const skills = gs.grimoireSkills;
  let cm = 0;

  // BASE
  cm += 0.02;

  // SYNERGY
  if (skills.corpseReavers && !skills.sacrificeRavenous) cm += 0.15;
  if (skills.boneFortress && !skills.sacrificeCritical)  cm += gs.units.golem;
  if (skills.titanicRegeneration && !skills.sacrificeCritical) cm += gs.units.golem * 2;
  if (skills.armyDarkness) cm += gs.units.wraith * 0.02;

  // Tower bonuses
  if (gs.tower.floorsBuilt >= 3) cm += 0.05;
  if (gs.tower.floorsBuilt >= 5) cm *= 1.10;

  return cm;
}

// ── Resource Tick Application ─────────────────────────────────
// Called by the game loop ONLY. Applies computed gains to state.
function applyResourceTick() {
  const gs = gameState;
  const skills = gs.grimoireSkills;

  // ── Soul Essence ──
  let seGain = calcSEPerTick();

  // Proc-based additions (conditional, tick-level)
  if (skills.frenziedSwarm && !skills.sacrificeRavenous && roll(0.03)) {
    const binding = gs.tomes.tome1_binding;
    const thrallProd = (1 + binding * 0.05) + (skills.relentlessHorde ? 0.5 : 0);
    seGain += gs.units.zombie * thrallProd * gs.permanentEssenceMultiplier;
  }
  if (skills.shadowBarrage && !skills.sacrificeEssence && gs._tick % 5 === 0) {
    seGain += gs.units.ghoul * 5 * gs.permanentEssenceMultiplier;
  }
  if (skills.phantomStrike && !skills.sacrificeEssence && roll(0.10)) {
    seGain += gs.units.ghoul * 5 * 2 * gs.permanentEssenceMultiplier;
  }

  if (seGain > 0) {
    gs.soulEssence += seGain;
    gs.statistics.lifetime.soulEssenceEarned += seGain;
    gs.statistics.currentRun.soulEssenceEarned += seGain;
  }

  // ── Dark Mana ──
  let dmGain = calcDMPerTick();
  if (roll(0.1)) dmGain += 1;
  if (skills.armyDarkness && gs.units.wraith > 0 && roll(0.1 * gs.units.wraith)) dmGain += 1;
  if (skills.boneShredders && !skills.sacrificeEssence && roll(0.05)) dmGain += 5;

  if (dmGain > 0) {
    gs.darkMana += dmGain;
    gs.statistics.lifetime.darkManaEarned += dmGain;
    gs.statistics.currentRun.darkManaEarned += dmGain;
  }

  // ── Corpse Matter ──
  let cmGain = calcCMPerTick();
  if (roll(cmGain)) {
    const actual = Math.floor(cmGain) + (roll(cmGain % 1) ? 1 : 0);
    gs.corpseMatter += actual || 1;
    gs.statistics.lifetime.corpseMatterEarned += actual || 1;
    gs.statistics.currentRun.corpseMatterEarned += actual || 1;
  }

  // ── Titanic Regeneration — army restore ──
  if (skills.titanicRegeneration && !skills.sacrificeCritical) {
    if (gs.units.golem > 0) {
      const types = ['zombie', 'ghoul', 'wraith'];
      types.forEach(t => {
        const cap = t === 'zombie' ? calcZombieCap()
                  : t === 'ghoul'  ? calcGhoulCap()
                  : calcWraithCap();
        if (gs.units[t] < cap) {
          gs.units[t] = Math.min(cap, gs.units[t] + Math.ceil(cap * 0.01));
        }
      });
    }
  }

  // ── Spell Duration Countdown ──
  if (gs.curses.activeSpell && gs.curses.spellDuration > 0) {
    gs.curses.spellDuration--;
    if (gs.curses.spellDuration <= 0) gs.curses.activeSpell = null;
  }
  if (gs.curses.corpseGratificationCooldown > 0) gs.curses.corpseGratificationCooldown--;
  if (gs.curses.ruinousAmbitionCooldown > 0)     gs.curses.ruinousAmbitionCooldown--;

  // ── Offline time accumulation (1 sec/tick, capped) ──
  if (gs.offlineTime < CONFIG.OFFLINE_CAP_SECONDS) {
    gs.offlineTime = Math.min(CONFIG.OFFLINE_CAP_SECONDS, gs.offlineTime + 1);
  }

  // ── Play time ──
  gs.statistics.lifetime.totalPlayTime++;
}
