'use strict';
// ============================================================
// COMBAT — Boss battle logic. Writes state. No DOM.
// ============================================================

function initiateBossChallenge() {
  const gs     = gameState;
  const bossIdx = gs.bossBattle.currentBoss;
  if (bossIdx >= gs.bossBattle.maxBossUnlocked) return;
  if (bossIdx >= CONFIG.BOSSES.length && !gs.grimoireSkills.finalAscension) return;

  const isFinalBoss = bossIdx >= CONFIG.BOSSES.length;
  const bossDef     = isFinalBoss ? CONFIG.FINAL_BOSS : CONFIG.BOSSES[bossIdx];
  const scaledHP    = calcScaledBossHP(isFinalBoss ? 999 : bossIdx);

  gs.bossBattle.inBattle          = true;
  gs.bossBattle.isFinalBoss       = isFinalBoss;
  gs.bossBattle.bossMaxHP         = scaledHP;
  gs.bossBattle.bossCurrentHP     = scaledHP;
  gs.bossBattle.attackAccumulator = 0;
  gs.bossBattle.skillCooldowns    = {};

  const units = gs.units;
  const hp = units.zombie * 50 + units.ghoul * 200 + units.golem * 500 + units.wraith * 1000;
  gs.bossBattle.playerMaxHP     = Math.max(hp, 1000);
  gs.bossBattle.playerCurrentHP = gs.bossBattle.playerMaxHP;

  addLog(`BOSS CHALLENGE: ${bossDef.name} — "${bossDef.title}" approaches!`, 'boss');
  showStoryModal('Champion Approaches', `${bossDef.name}, ${bossDef.title}, stands before you! Prepare your dark arts, worm.`);
  switchTab('boss');
}

function calcScaledBossHP(bossIndex) {
  const gs      = gameState;
  const baseDef = bossIndex === 999
    ? CONFIG.FINAL_BOSS
    : (CONFIG.BOSSES[bossIndex] || CONFIG.BOSSES[CONFIG.BOSSES.length - 1]);
  const base         = baseDef.baseHP;
  const prestigeMult = gs.grimoirePrestigeCount * 0.1 + 1;
  const indexMult    = bossIndex === 999 ? 2.0 : 1 + (bossIndex * 0.15);
  return Math.floor(base * indexMult * prestigeMult);
}

function tickBossBattle() {
  const gs = gameState;
  gs.bossBattle.attackAccumulator++;

  if (gs.bossBattle.attackAccumulator >= CONFIG.BOSS_ATTACK_INTERVAL_TICKS) {
    gs.bossBattle.attackAccumulator = 0;
    const attackDmg = Math.floor(gs.bossBattle.bossMaxHP * 0.02);
    gs.bossBattle.playerCurrentHP  -= attackDmg;

    if (gs.bossBattle.playerCurrentHP <= 0) {
      gs.bossBattle.playerCurrentHP = 0;
      resolveBossDefeat();
    }
  }
}

function useBossSkill(skillId) {
  const gs = gameState;
  if (!gs.bossBattle.inBattle) return;
  if (!gs.grimoireSkills[skillId]) return;
  if ((gs.bossBattle.skillCooldowns[skillId] || 0) > 0) {
    addLog(`${skillId} still cooling down.`, 'system');
    return;
  }

  const skDmg = CONFIG.SKILL_COMBAT_DAMAGE[skillId];
  if (!skDmg) return;

  let dmg = skDmg.damage + Math.floor(calcArmyStrength() * 0.1);
  gs.bossBattle.bossCurrentHP  -= dmg;
  gs.bossBattle.skillCooldowns[skillId] = skDmg.cooldown;

  const bossDef = gs.bossBattle.isFinalBoss ? CONFIG.FINAL_BOSS : CONFIG.BOSSES[gs.bossBattle.currentBoss];
  const bossId  = bossDef.id;
  if (!gs.statistics.bossRecord[bossId]) gs.statistics.bossRecord[bossId] = { wins: 0, losses: 0, damageDealt: 0, damageTaken: 0 };
  gs.statistics.bossRecord[bossId].damageDealt += dmg;

  addLog(`${CONFIG.GRIMOIRE_SKILLS[skillId].name} deals ${formatNum(dmg)} damage!`, 'boss');

  if (gs.bossBattle.bossCurrentHP <= 0) {
    gs.bossBattle.bossCurrentHP = 0;
    resolveBossVictory();
  }
}

function resolveBossVictory() {
  const gs      = gameState;
  const bossDef = gs.bossBattle.isFinalBoss ? CONFIG.FINAL_BOSS : CONFIG.BOSSES[gs.bossBattle.currentBoss];

  gs.bossBattle.inBattle = false;
  gs.bossBattle.defeatedBosses.push(bossDef.id);
  gs.bossBattle.currentBoss++;
  gs.statistics.lifetime.bossesDefeated++;

  if (!gs.statistics.bossRecord[bossDef.id]) gs.statistics.bossRecord[bossDef.id] = { wins: 0, losses: 0, damageDealt: 0, damageTaken: 0 };
  gs.statistics.bossRecord[bossDef.id].wins++;

  const seR = Math.floor(bossDef.baseHP * 2);
  const dmR = Math.floor(bossDef.baseHP * 0.5);
  const cmR = Math.floor(bossDef.baseHP * 0.1);
  gs.soulEssence  += seR;
  gs.darkMana     += dmR;
  gs.corpseMatter += cmR;

  addLog(`BOSS DEFEATED: ${bossDef.name}! +${formatNum(seR)} SE, +${formatNum(dmR)} DM, +${cmR} CM!`, 'boss');

  if (gs.bossBattle.isFinalBoss) {
    showStoryModal('VICTORY OVER HOPE!', `The Eternal Flame is EXTINGUISHED! Brooklynia falls. THE MIGHTY MALAKAR REIGNS SUPREME! But the cycle continues, worm.`);
  } else {
    showStoryModal(`${bossDef.name} Defeated!`, `${bossDef.title} lies broken before you. ${bossDef.faction} mourns their fallen champion. GOOD.`);
    gs.bossBattle.countdownTicks = CONFIG.BOSS_UNLOCK_COUNTDOWN_TICKS;
  }
}

function resolveBossDefeat() {
  const gs      = gameState;
  const bossDef = gs.bossBattle.isFinalBoss ? CONFIG.FINAL_BOSS : CONFIG.BOSSES[gs.bossBattle.currentBoss];

  gs.bossBattle.inBattle     = false;
  gs.bossBattle.retryTicks   = CONFIG.BOSS_RETRY_COOLDOWN_TICKS;

  if (!gs.statistics.bossRecord[bossDef.id]) gs.statistics.bossRecord[bossDef.id] = { wins: 0, losses: 0, damageDealt: 0, damageTaken: 0 };
  gs.statistics.bossRecord[bossDef.id].losses++;

  for (const type of ['zombie', 'ghoul', 'golem', 'wraith']) {
    const lost = Math.floor(gs.units[type] * 0.25);
    gs.units[type] = Math.max(type === 'zombie' ? 1 : 0, gs.units[type] - lost);
  }

  addLog(`BOSS BATTLE LOST: ${bossDef.name} repelled our forces! 25% army lost. Retry in 5 minutes.`, 'boss');
  showStoryModal('Defeated', `${bossDef.name} stands triumphant. This is TEMPORARY. I will return. I always return.`);
}
