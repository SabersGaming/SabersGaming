'use strict';
// ============================================================
// TICK — Single legal game loop. Systems first, UI after.
// ============================================================

function gameTick() {
  if (gamePaused) return;

  const gs = gameState;
  gs._tick++;

  // 1. Resource production
  const seGain = calcSEPerTick();
  const dmGain = calcDMPerTick();
  const cmGain = calcCMPerTick();

  // Phantom Strike: 10% chance ghouls triple SE
  let extraSE = 0;
  if (gs.grimoireSkills.phantomStrike && gs.units.ghoul > 0 && roll(0.10)) {
    extraSE = gs.units.ghoul * 5 * 2; // double the ghoul contribution
  }

  // Frenzied Swarm: 3% chance zombies produce double
  let frenziedSE = 0;
  if (gs.grimoireSkills.frenziedSwarm && gs.units.zombie > 0 && roll(0.03)) {
    frenziedSE = gs.units.zombie;
  }

  // Shadow Barrage: every 5th tick ghouls double
  let shadowSE = 0;
  if (gs.grimoireSkills.shadowBarrage && gs._tick % 5 === 0 && gs.units.ghoul > 0) {
    shadowSE = gs.units.ghoul * 5;
  }

  // Bone Shredders: 5% chance ghouls generate DM
  let boneShreddersGain = 0;
  if (gs.grimoireSkills.boneShredders && gs.units.ghoul > 0 && roll(0.05)) {
    boneShreddersGain = 5;
  }

  // Corpse Reavers: 15% chance zombies generate CM
  let corpseReaversCM = 0;
  if (gs.grimoireSkills.corpseReavers && !gs.grimoireSkills.sacrificeRavenous && gs.units.zombie > 0 && roll(0.15)) {
    corpseReaversCM = 1;
  }

  // Titanic Regeneration: restore 1% of army per tick
  if (gs.grimoireSkills.titanicRegeneration && !gs.grimoireSkills.sacrificeCritical) {
    const restoreZ = Math.max(0, Math.floor(gs.units.zombie * 0.01));
    const restoreG = Math.max(0, Math.floor(gs.units.ghoul  * 0.01));
    const restoreGol = Math.max(0, Math.floor(gs.units.golem * 0.01));
    gs.units.zombie = Math.min(gs.units.zombie + restoreZ, calcZombieCap());
    gs.units.ghoul  = Math.min(gs.units.ghoul  + restoreG, calcGhoulCap());
    gs.units.golem  = Math.min(gs.units.golem  + restoreGol, calcGolemCap());
  }

  gs.soulEssence  += seGain + extraSE + frenziedSE + shadowSE;
  gs.darkMana     += dmGain + boneShreddersGain;
  gs.corpseMatter += cmGain + corpseReaversCM;

  gs.statistics.lifetime.soulEssenceEarned    += seGain;
  gs.statistics.lifetime.darkManaEarned       += dmGain;
  gs.statistics.lifetime.corpseMatterEarned   += cmGain;
  gs.statistics.currentRun.soulEssenceEarned  += seGain;
  gs.statistics.currentRun.darkManaEarned     += dmGain;
  gs.statistics.currentRun.corpseMatterEarned += cmGain;

  gs.statistics.lifetime.totalPlayTime++;

  // 2. Curse timers
  if (gs.curses.activeSpell && gs.curses.spellDuration > 0) {
    gs.curses.spellDuration--;
    if (gs.curses.spellDuration <= 0) {
      gs.curses.activeSpell = null;
      addLog('The curse fades. Production returns to normal.', 'curse');
    }
  }
  if (gs.curses.corpseGratificationCooldown > 0) gs.curses.corpseGratificationCooldown--;
  if (gs.curses.ruinousAmbitionCooldown     > 0) gs.curses.ruinousAmbitionCooldown--;

  // 3. Skill cooldowns (boss)
  for (const sid of Object.keys(gs.bossBattle.skillCooldowns)) {
    if (gs.bossBattle.skillCooldowns[sid] > 0) gs.bossBattle.skillCooldowns[sid]--;
  }

  // 4. Boss battle tick
  if (gs.bossBattle.inBattle) {
    tickBossBattle();
  }

  // 5. Boss unlock countdown
  if (gs.bossBattle.unlocked && gs.bossBattle.countdownTicks > 0) {
    gs.bossBattle.countdownTicks--;
    if (gs.bossBattle.countdownTicks <= 0 && !gs.bossBattle.inBattle) {
      gs.bossBattle.maxBossUnlocked = Math.min(
        gs.bossBattle.currentBoss + 1,
        gs.grimoireSkills.finalAscension ? CONFIG.BOSSES.length + 1 : CONFIG.BOSSES.length
      );
    }
  }

  // Boss retry countdown
  if (gs.bossBattle.retryTicks > 0) gs.bossBattle.retryTicks--;

  // 6. Raid timer
  if (gs.raidActive && gs.raidTimeRemaining > 0) {
    gs.raidTimeRemaining--;

    if (!gs.raidSimulated && gs.raidTimeRemaining <= Math.floor(gs.raidTimeFull * 0.25)) {
      gs.raidSimulated = true;
      preRollRaidOutcome();
    }

    dripRaidSimMessage();

    if (gs.raidTimeRemaining <= 0) {
      resolveRaid();
    }
  }

  // 7. Raid cooldown
  if (!gs.raidActive && gs.raidCooldown > 0) gs.raidCooldown--;

  // 8. Tower build
  if (gs.tower.isBuilding && gs.tower.buildTimeRemaining > 0) {
    gs.tower.buildTimeRemaining--;
    if (gs.tower.buildTimeRemaining <= 0) resolveFloorBuild();
  }

  // 9. Quest check every N ticks
  if (gs._tick % CONFIG.QUEST_CHECK_TICKS === 0) checkQuests();

  // 10. Boss unlock check
  checkBossUnlock();

  // 11. Autosave
  if (gs._tick % CONFIG.AUTOSAVE_TICKS === 0) saveGame();

  // 12. Render UI (last)
  updateUI();
}
