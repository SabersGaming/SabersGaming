'use strict';
// ============================================================
// GRIMOIRE — Prestige system. Writes state. Minimal DOM for modal open/close.
// ============================================================

function openGrimoireModal() {
  gamePaused = true;
  const gs = gameState;
  gs.grimoirePrestigePendingSkills = [];

  document.getElementById('grimoire-dm').textContent = formatNum(gs.darkMana);
  document.getElementById('grimoire-cm').textContent = formatNum(gs.corpseMatter);

  renderGrimoireSkills();
  document.getElementById('modal-grimoire').classList.add('visible');
}

function closeGrimoireModal(confirmed) {
  if (confirmed) {
    performGrimoirePrestige();
  } else {
    // Refund skills bought during pause
    const gs = gameState;
    for (const skId of gs.grimoirePrestigePendingSkills) {
      const sk = CONFIG.GRIMOIRE_SKILLS[skId];
      gs.darkMana     += sk.costDM;
      gs.corpseMatter += sk.costCM;
      gs.grimoireSkills[skId] = false;
    }
    gs.grimoirePrestigePendingSkills = [];
    gamePaused = false;
  }
  document.getElementById('modal-grimoire').classList.remove('visible');
}

function buyGrimoireSkill(skillId) {
  const gs = gameState;
  const sk = CONFIG.GRIMOIRE_SKILLS[skillId];
  if (!sk) return;
  if (gs.grimoireSkills[skillId]) { addLog('Already mastered, worm.', 'system'); return; }

  // Tier gate: need 4 skills from previous tier
  if (sk.tier > 1) {
    const prevTierSkills = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === sk.tier - 1);
    const prevOwned = prevTierSkills.filter(s => gs.grimoireSkills[s.id]).length;
    if (prevOwned < 4) {
      showStoryModal("Forbidden", `You need 4 skills from Tier ${sk.tier - 1} before unlocking Tier ${sk.tier} skills. You have ${prevOwned}.`);
      return;
    }
  }

  // finalAscension special requirement
  if (skillId === 'finalAscension') {
    if (!gs.grimoireSkills.deathsDominance || !gs.grimoireSkills.undyingWill || !gs.grimoireSkills.transcendentCommand) {
      showStoryModal("Not Yet", "The Final Ascension demands mastery of Death's Dominance, Undying Will, AND Transcendent Command first.");
      return;
    }
  }

  // Conflict check
  for (const conflict of sk.conflictsWith) {
    if (gs.grimoireSkills[conflict]) {
      showStoryModal("Malakar RECOILS", `This skill conflicts with ${CONFIG.GRIMOIRE_SKILLS[conflict].name}. Some dark powers cannot coexist.`);
      return;
    }
  }

  if (gs.darkMana     < sk.costDM) { addLog('Insufficient Dark Mana.', 'system'); return; }
  if (gs.corpseMatter < sk.costCM) { addLog('Insufficient Corpse Matter.', 'system'); return; }

  gs.darkMana     -= sk.costDM;
  gs.corpseMatter -= sk.costCM;
  gs.grimoireSkills[skillId] = true;
  gs.grimoirePrestigePendingSkills.push(skillId);

  // Sacrifice effects
  if (sk.sacrificesUnit === 'zombie') { gs.units.zombie = 0; addLog('Zombies sacrificed for Ravenous Spirit!', 'curse'); }
  if (sk.sacrificesUnit === 'ghoul')  { gs.units.ghoul  = 0; addLog('Ghouls sacrificed for Essence Channeling!', 'curse'); }
  if (sk.sacrificesUnit === 'golem')  { gs.units.golem  = 0; addLog('Golems sacrificed for Critical Dominion!', 'curse'); }

  // Wraith unlock — DOM update handled by updateCurseButtons
  if (skillId === 'armyDarkness') {
    addLog('Wraiths unlocked! The void answers your call.', 'grimoire');
  }

  addLog(`SKILL MASTERED: ${sk.name}!`, 'grimoire');
  // Grimoire modal DM/CM display is refreshed by updateUI / openGrimoireModal
}

function performGrimoirePrestige() {
  const gs = gameState;
  gs.hasEverPrestiged = true;
  gs.grimoirePrestigeCount++;
  gs.statistics.lifetime.grimoirePrestigeCount++;

  // Tomes and caps persist — reset everything else
  gs.soulEssence  = 0;
  gs.darkMana     = 0;
  gs.corpseMatter = 0;
  gs.units        = { zombie: 1, ghoul: 0, golem: 0, wraith: 0 };
  gs.necromancyLevel = 1;
  gs.permanentEssenceMultiplier = 1;
  gs.darkManaStudyBonus = 0;

  gs.curses.activeSpell  = null;
  gs.curses.spellDuration = 0;

  gs.raidActive       = false;
  gs.raidCooldown     = 0;
  gs.raidLevel        = 0;
  gs.pendingRaid      = null;
  gs.pendingRaidChoice = null;

  gs.tower = {
    floorsBuilt: 0, maxFloorEver: gs.tower.maxFloorEver,
    isBuilding: false, buildFloor: 0, buildTimeRemaining: 0, buildTimeFull: 0,
  };

  gs.bossBattle.currentBoss      = 0;
  gs.bossBattle.inBattle         = false;
  gs.bossBattle.bossCurrentHP    = 0;
  gs.bossBattle.bossMaxHP        = 0;
  gs.bossBattle.playerCurrentHP  = 0;
  gs.bossBattle.playerMaxHP      = 0;
  gs.bossBattle.defeatedBosses   = [];
  gs.bossBattle.countdownTicks   = 0;
  gs.bossBattle.retryTicks       = 0;
  gs.bossBattle.skillCooldowns   = {};
  gs.bossBattle.isFinalBoss      = false;
  gs.bossBattle.unlocked         = false;
  gs.bossBattle.attackAccumulator = 0;
  gs.bossBattle.maxBossUnlocked  = Math.min(gs.grimoirePrestigeCount, CONFIG.BOSSES.length);

  gs.statistics.currentRun = {
    soulEssenceEarned: 0, darkManaEarned: 0, corpseMatterEarned: 0,
    unitsLost: 0, zombiesRaised: 0, ghoulsRaised: 0, golemsRaised: 0,
  };

  gs.grimoirePrestigePendingSkills = [];
  gamePaused = false;

  addLog(`GRIMOIRE PRESTIGE! Your power is remade. Prestige #${gs.grimoirePrestigeCount}.`, 'grimoire');
  addLog('Your tomes remain. Your skills persist. Begin anew with greater darkness.', 'grimoire');
  saveGame();
  updateUI();
  updateCurseButtons();
}
