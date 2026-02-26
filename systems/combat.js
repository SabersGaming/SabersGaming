// ============================================================
// systems/combat.js — COMBAT SYSTEM (Pillar III)
// Owns: all raid logic, all boss battle logic.
// Reads boss data from data/config.js.
// Reads player stats from state. Writes combat outcomes to state.
// NEVER generates passive resources. NEVER checks unlock conditions.
// ============================================================
'use strict';

function openRaidModal() {
  const gs = gameState;
  if (gs.necromancyLevel < 10) { showStoryModal("Not Yet", "Terror Raids require Level 10, worm. Keep ascending."); return; }
  if (gs.raidActive) { switchTab('raid'); return; }
  if (gs.raidCooldown > 0) { showStoryModal("Patience", `The army recovers. ${formatTime(gs.raidCooldown)} remaining.`); return; }

  // 20% chance for narrative raid if eligible
  const eligibleNarrative = CONFIG.NARRATIVE_RAIDS.filter(nr =>
    gs.necromancyLevel >= nr.minLevel &&
    gs.soulEssence >= nr.minSE &&
    (gs.units.zombie + gs.units.ghoul * 4 + gs.units.golem * 10) >= nr.minUnits
  );
  if (eligibleNarrative.length > 0 && roll(0.20)) {
    showNarrativeRaidModal(randFrom(eligibleNarrative));
    return;
  }

  showStandardRaidModal();
}

function showStandardRaidModal() {
  const modal = document.getElementById('modal-raid');
  const title = document.getElementById('modal-raid-title');
  const body = document.getElementById('modal-raid-body');
  const choices = document.getElementById('modal-raid-choices');
  const footer = document.getElementById('modal-raid-footer');

  title.textContent = 'Choose Your Target, Worm';
  body.innerHTML = `<p>The army awaits your command. Choose a target and strategy wisely.</p>
    <p style="font-size:12px;color:var(--text-dim);">Army strength: ${formatNum(calcArmyStrength())} | Your forces: ${gs('units.zombie')}Z ${gs('units.ghoul')}G ${gs('units.golem')}Gol</p>`;

  function gs(path) {
    const parts = path.split('.');
    let obj = gameState;
    for (const p of parts) obj = obj[p];
    return obj;
  }

  // Strategy selector
  let strategyHtml = '<div class="strategy-selector" id="raid-strategy-selector">';
  for (const [sid, strat] of Object.entries(CONFIG.RAID_STRATEGIES)) {
    const sel = sid === 'standard' ? 'selected' : '';
    strategyHtml += `<button class="strategy-btn ${sel}" data-strategy="${sid}" onclick="selectStrategy('${sid}')">${strat.name}</button>`;
  }
  strategyHtml += '</div>';

  let targetsHtml = '';
  for (const target of CONFIG.RAID_TARGETS) {
    targetsHtml += `<button class="raid-choice-btn" onclick="launchStandardRaid('${target.id}')">
      <span class="raid-choice-name">${target.name}</span>
      <span class="raid-choice-details">${target.description}</span>
      <span class="raid-choice-details" style="color:var(--text-warning);">Retaliation: ${Math.round(target.baseRetaliation * 100)}% | Duration: ${target.baseDuration}s</span>
    </button>`;
  }

  choices.innerHTML = strategyHtml + targetsHtml;
  footer.innerHTML = '<button class="btn" onclick="closeRaidModal()">Retreat</button>';
  modal.classList.add('visible');
}

function showNarrativeRaidModal(nr) {
  const modal = document.getElementById('modal-raid');
  document.getElementById('modal-raid-title').textContent = nr.title;
  document.getElementById('modal-raid-body').innerHTML = `<p>${nr.description}</p>`;

  let choicesHtml = '';
  for (const choice of nr.choices) {
    choicesHtml += `<button class="raid-choice-btn" onclick="launchNarrativeRaid('${nr.id}', '${choice.id}')">
      <span class="raid-choice-name">${choice.name}</span>
      <span class="raid-choice-details">${choice.description}</span>
    </button>`;
  }
  document.getElementById('modal-raid-choices').innerHTML = choicesHtml;
  document.getElementById('modal-raid-footer').innerHTML = '<button class="btn" onclick="closeRaidModal()">Decline</button>';
  modal.classList.add('visible');
}

var selectedStrategy = 'standard';
function selectStrategy(id) {
  selectedStrategy = id;
  document.querySelectorAll('.strategy-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.strategy === id);
  });
}

function closeRaidModal() {
  document.getElementById('modal-raid').classList.remove('visible');
}

function calcArmyStrength() {
  const gs = gameState;
  return gs.units.zombie + gs.units.ghoul * 4 + gs.units.golem * 20 + gs.units.wraith * 100;
}

function launchStandardRaid(targetId) {
  closeRaidModal();
  const gs = gameState;
  const target = CONFIG.RAID_TARGETS.find(t => t.id === targetId);
  const strat = CONFIG.RAID_STRATEGIES[selectedStrategy];

  const armyStrength = calcArmyStrength();
  const duration = Math.ceil(target.baseDuration * strat.durationMult);
  let retaliation = target.baseRetaliation * strat.retaliationMult + (gs.raidLevel * 0.05);

  // Skill reductions
  const skills = gs.grimoireSkills;
  if (skills.unyieldingHorde) retaliation -= gs.units.zombie * 0.01;
  if (skills.chillingGrip) retaliation -= Math.min(gs.units.ghoul * 0.02, 0.20);
  if (skills.boneFortress) retaliation -= gs.units.golem * 0.05;
  if (gs.tower.floorsBuilt >= 4) retaliation -= 0.10; // Tower Floor 4
  retaliation = Math.max(0, Math.min(1, retaliation));

  let rewardMult = strat.rewardMult;
  if (skills.tauntDamned) rewardMult *= 1.25;
  if (skills.sacrificeCritical) rewardMult *= 1.35;

  gs.raidActive = true;
  gs.raidTimeRemaining = duration;
  gs.raidTimeFull = duration;
  gs.raidSimulated = false;
  gs.raidSimulatedOutcome = null;
  gs.raidSimLog = [];
  gs.raidArmySnapshot = { ...gs.units };
  gs.raidDetails = { type: 'standard', targetId, strategyId: selectedStrategy, retaliation, rewardMult, armyStrength, target };

  addLog(`RAID LAUNCHED: ${target.name} — ${selectedStrategy} strategy. ${duration}s.`, 'raid');
  switchTab('raid');
}

function launchNarrativeRaid(narrativeId, choiceId) {
  closeRaidModal();
  const gs = gameState;
  const nr = CONFIG.NARRATIVE_RAIDS.find(n => n.id === narrativeId);
  const choice = nr.choices.find(c => c.id === choiceId);

  gs.raidActive = true;
  gs.raidTimeRemaining = choice.duration;
  gs.raidTimeFull = choice.duration;
  gs.raidSimulated = false;
  gs.raidSimulatedOutcome = null;
  gs.raidSimLog = [];
  gs.raidArmySnapshot = { ...gs.units };
  gs.raidDetails = { type: 'narrative', narrativeId, choiceId, choice, nr };

  addLog(`NARRATIVE RAID: ${nr.title} — ${choice.name}`, 'raid');
  switchTab('raid');
}

function preRollRaidOutcome() {
  const gs = gameState;
  const rd = gs.raidDetails;
  let success = true;
  let retaliation = rd.retaliation || 0;

  // Roll retaliation (success if rand > retaliation)
  if (rd.type === 'narrative') {
    retaliation = rd.choice.retaliation;
  }
  success = !roll(retaliation);

  gs.raidSimulatedOutcome = { success, retaliation };

  // Seed dramatic messages
  const msgs = [];
  msgs.push('Your vanguard engages the defenders...');
  if (!success) {
    msgs.push('Resistance is fiercer than expected!');
    if (gs.units.golem > 0) msgs.push(`A golem falls under the onslaught! ${randInt(1,3)} golems lost!`);
    msgs.push(`Defenders counterattack — ${randInt(3,10)} zombies lost!`);
    msgs.push('Your forces take heavy casualties...');
  } else {
    msgs.push('The defenders crumble before your darkness!');
    msgs.push('Victory is close...');
    if (gs.raidDetails.targetId === 'graveyard') msgs.push('Fresh bodies rise to join your ranks!');
  }
  gs.raidSimLog = msgs;
}

var raidSimMsgIndex = 0;
function dripRaidSimMessage() {
  const gs = gameState;
  if (!gs.raidSimLog || gs.raidSimLog.length === 0) return;
  // Every ~4 ticks, show next message
  const idx = Math.floor((gs.raidTimeFull * 0.25 - gs.raidTimeRemaining) / 4);
  if (idx < gs.raidSimLog.length && idx !== raidSimMsgIndex) {
    raidSimMsgIndex = idx;
    // UI will render from raidSimLog
  }
}

function resolveRaid() {
  const gs = gameState;
  gs.raidActive = false;
  const rd = gs.raidDetails;
  const outcome = gs.raidSimulatedOutcome || { success: true, retaliation: 0 };
  const snap = gs.raidArmySnapshot;
  raidSimMsgIndex = 0;

  if (rd.type === 'standard') {
    const target = CONFIG.RAID_TARGETS.find(t => t.id === rd.targetId);
    const armyPow = rd.armyStrength;

    if (outcome.success) {
      // Reward
      let reward = Math.floor(target.baseRewardMult * armyPow * rd.rewardMult);
      if (target.baseRewardType === 'se') { gs.soulEssence += reward; gs.statistics.lifetime.soulEssenceEarned += reward; }
      else if (target.baseRewardType === 'dm') { gs.darkMana += reward; gs.statistics.lifetime.darkManaEarned += reward; }
      else if (target.baseRewardType === 'cm') { gs.corpseMatter += reward; gs.statistics.lifetime.corpseMatterEarned += reward; }

      // Graveyard bonus units
      if (target.bonusUnits) {
        const extra = randInt(target.bonusUnits.min, target.bonusUnits.max);
        const zCap = calcZombieCap();
        const added = Math.min(extra, zCap - gs.units.zombie);
        if (added > 0) { gs.units.zombie += added; addLog(`+${added} zombies rose from the graveyard!`, 'unit'); }
      }

      gs.statistics.lifetime.raidsCompleted++; // BUG FIX
      gs.raidCooldown = 60;
      addLog(`RAID SUCCESS: ${target.name}! Gained ${formatNum(reward)} ${target.baseRewardType.toUpperCase()}!`, 'raid');
      showStoryModal('Raid Victorious!', `The ${target.name} has been pillaged! ${formatNum(reward)} ${target.baseRewardType.toUpperCase()} added to your treasury. MAGNIFICENT.`);
    } else {
      // Failed — retaliation
      gs.soulEssence = 0;
      gs.darkMana = 0;
      // Unit loss
      const keepFraction = gs.grimoireSkills.undyingWill ? 0.5 : (gs.grimoireSkills.tauntDamned ? 0.75 : 0);
      applyUnitLosses(snap, keepFraction);
      gs.raidCooldown = 120;
      addLog('RAID FAILED! Forces routed. Resources lost.', 'raid');
      showStoryModal('Raid Failed', 'The defenders repelled my forces! SE and DM lost. The shame. THE SHAME. We will return stronger.');
    }
  } else if (rd.type === 'narrative') {
    const nr = rd.nr;
    const choice = rd.choice;

    if (outcome.success) {
      if (choice.rewardType === 'se') {
        const reward = Math.floor(choice.rewardMult * calcArmyStrength());
        gs.soulEssence += reward;
        gs.statistics.lifetime.soulEssenceEarned += reward;
        addLog(`NARRATIVE RAID SUCCESS: ${nr.title}! +${formatNum(reward)} SE!`, 'raid');
      } else if (choice.rewardType === 'dm') {
        const reward = Math.floor(choice.rewardMult * calcArmyStrength());
        gs.darkMana += reward;
        gs.statistics.lifetime.darkManaEarned += reward;
        addLog(`NARRATIVE RAID SUCCESS: ${nr.title}! +${formatNum(reward)} DM!`, 'raid');
      } else if (choice.bonusTome) {
        if (gs.tomes.tome2_sight < gs.tomeCaps.tome2_sight) gs.tomes.tome2_sight++;
        gs.statistics.lifetime.tomeSightPurchased++;
        addLog(`NARRATIVE RAID: The rival's soul absorbed! +1 Tome of Sight!`, 'raid');
      }
      gs.statistics.lifetime.raidsCompleted++; // BUG FIX
      gs.raidCooldown = 90;
      showStoryModal(nr.title + ' — Victory!', 'The dark deed is done. Power flows to THE MIGHTY MALAKAR.');
    } else {
      // 50% army loss on narrative fail
      applyUnitLosses(snap, 0.5);
      gs.soulEssence = Math.floor(gs.soulEssence * 0.5);
      gs.darkMana = Math.floor(gs.darkMana * 0.5);
      gs.raidCooldown = 120;
      addLog(`NARRATIVE RAID FAILED: ${nr.title}. Army losses sustained.`, 'raid');
      showStoryModal(nr.title + ' — Defeat', 'We were repelled. Half the army lost. Half our resources halved. I am displeased. EXTREMELY displeased.');
    }
  }

  gs.raidDetails = null;
  gs.raidSimLog = [];
  gs.raidSimulated = false;
  gs.raidSimulatedOutcome = null;
  gs.pendingRaid = null;
  gs.pendingRaidChoice = null;
}

function applyUnitLosses(snapshot, keepFraction) {
  const gs = gameState;
  for (const type of ['zombie', 'ghoul', 'golem', 'wraith']) {
    const lost = snapshot[type] - Math.floor(snapshot[type] * keepFraction);
    gs.units[type] = Math.max(0, gs.units[type] - lost);
    if (type === 'zombie') gs.units.zombie = Math.max(1, gs.units.zombie); // always keep 1
    gs.statistics.currentRun.unitsLost = (gs.statistics.currentRun.unitsLost || 0) + lost;
  }
}

// ---------- BOSS BATTLES ----------
function checkBossUnlock() {
  const gs = gameState;
  if (gs.bossBattle.unlocked) return;

  // Unlock condition: any Tier 2 Grimoire skill mastered
  const tier2Skills = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === 2);
  const hasTier2 = tier2Skills.some(s => gs.grimoireSkills[s.id]);
  if (hasTier2 && !gs.bossBattle.unlocked) {
    gs.bossBattle.unlocked = true;
    gs.bossBattle.maxBossUnlocked = Math.max(gs.bossBattle.maxBossUnlocked, 1);
    gs.bossBattle.countdownTicks = CONFIG.BOSS_UNLOCK_COUNTDOWN_TICKS;
    document.getElementById('tab-btn-boss').classList.remove('hidden');
    addLog('BOSS BATTLES UNLOCKED! The champions of Brooklynia prepare to face you. A challenge begins in 5 minutes...', 'boss');
  }
}

function initiateBossChallenge() {
  const gs = gameState;
  const bossIdx = gs.bossBattle.currentBoss;
  if (bossIdx >= gs.bossBattle.maxBossUnlocked) return;
  if (bossIdx >= CONFIG.BOSSES.length && !gs.grimoireSkills.finalAscension) return;

  const isFinalBoss = bossIdx >= CONFIG.BOSSES.length;
  const bossDef = isFinalBoss ? CONFIG.FINAL_BOSS : CONFIG.BOSSES[bossIdx];

  const scaledHP = calcScaledBossHP(isFinalBoss ? 999 : bossIdx);
  gs.bossBattle.inBattle = true;
  gs.bossBattle.isFinalBoss = isFinalBoss;
  gs.bossBattle.bossMaxHP = scaledHP;
  gs.bossBattle.bossCurrentHP = scaledHP;
  gs.bossBattle.attackAccumulator = 0;
  gs.bossBattle.skillCooldowns = {};

  // Player HP = sum of unit * unitHP
  const units = gs.units;
  const hp = units.zombie * 50 + units.ghoul * 200 + units.golem * 500 + units.wraith * 1000;
  gs.bossBattle.playerMaxHP = Math.max(hp, 1000);
  gs.bossBattle.playerCurrentHP = gs.bossBattle.playerMaxHP;

  addLog(`BOSS CHALLENGE: ${bossDef.name} — "${bossDef.title}" approaches!`, 'boss');
  showStoryModal(`Champion Approaches`, `${bossDef.name}, ${bossDef.title}, stands before you! Prepare your dark arts, worm. This will not be pleasant — for THEM.`);
  switchTab('boss');
}

function calcScaledBossHP(bossIndex) {
  const gs = gameState;
  const baseDef = bossIndex === 999 ? CONFIG.FINAL_BOSS : (CONFIG.BOSSES[bossIndex] || CONFIG.BOSSES[CONFIG.BOSSES.length - 1]);
  const base = baseDef.baseHP;
  const prestigeMult = gs.grimoirePrestigeCount * 0.1 + 1;
  const indexMult = bossIndex === 999 ? 2.0 : 1 + (bossIndex * 0.15);
  return Math.floor(base * indexMult * prestigeMult);
}

function tickBossBattle() {
  const gs = gameState;
  gs.bossBattle.attackAccumulator++;

  if (gs.bossBattle.attackAccumulator >= CONFIG.BOSS_ATTACK_INTERVAL_TICKS) {
    gs.bossBattle.attackAccumulator = 0;
    // Boss attacks player
    const bossIdx = gs.bossBattle.isFinalBoss ? 999 : gs.bossBattle.currentBoss;
    const attackDmg = Math.floor(gs.bossBattle.bossMaxHP * 0.02); // 2% of max HP per attack
    gs.bossBattle.playerCurrentHP -= attackDmg;

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
  if (gs.bossBattle.skillCooldowns[skillId] > 0) { addLog(`${skillId} still cooling down.`, 'system'); return; }

  const skDmg = CONFIG.SKILL_COMBAT_DAMAGE[skillId];
  if (!skDmg) return;

  let dmg = skDmg.damage;
  // Scale damage with army size
  dmg += Math.floor(calcArmyStrength() * 0.1);

  gs.bossBattle.bossCurrentHP -= dmg;
  gs.bossBattle.skillCooldowns[skillId] = skDmg.cooldown;

  // Track boss record
  const bossDef = gs.bossBattle.isFinalBoss ? CONFIG.FINAL_BOSS : CONFIG.BOSSES[gs.bossBattle.currentBoss];
  const bossId = bossDef.id;
  if (!gs.statistics.bossRecord[bossId]) gs.statistics.bossRecord[bossId] = { wins: 0, losses: 0, damageDealt: 0, damageTaken: 0 };
  gs.statistics.bossRecord[bossId].damageDealt += dmg;

  addLog(`${CONFIG.GRIMOIRE_SKILLS[skillId].name} deals ${formatNum(dmg)} damage!`, 'boss');

  if (gs.bossBattle.bossCurrentHP <= 0) {
    gs.bossBattle.bossCurrentHP = 0;
    resolveBossVictory();
  }
}

function resolveBossVictory() {
  const gs = gameState;
  const bossDef = gs.bossBattle.isFinalBoss ? CONFIG.FINAL_BOSS : CONFIG.BOSSES[gs.bossBattle.currentBoss];
  gs.bossBattle.inBattle = false;
  gs.bossBattle.defeatedBosses.push(bossDef.id);
  gs.bossBattle.currentBoss++;
  gs.statistics.lifetime.bossesDefeated++;

  if (!gs.statistics.bossRecord[bossDef.id]) gs.statistics.bossRecord[bossDef.id] = { wins: 0, losses: 0, damageDealt: 0, damageTaken: 0 };
  gs.statistics.bossRecord[bossDef.id].wins++;

  // Rewards
  const seR = Math.floor(bossDef.baseHP * 2);
  const dmR = Math.floor(bossDef.baseHP * 0.5);
  const cmR = Math.floor(bossDef.baseHP * 0.1);
  gs.soulEssence += seR;
  gs.darkMana += dmR;
  gs.corpseMatter += cmR;

  addLog(`BOSS DEFEATED: ${bossDef.name}! +${formatNum(seR)} SE, +${formatNum(dmR)} DM, +${cmR} CM!`, 'boss');

  if (gs.bossBattle.isFinalBoss) {
    showStoryModal('VICTORY OVER HOPE!', `The Eternal Flame is EXTINGUISHED! Brooklynia falls. THE MIGHTY MALAKAR REIGNS SUPREME! You have achieved true conquest. But... can it be sustained? The cycle continues, worm.`);
  } else {
    showStoryModal(`${bossDef.name} Defeated!`, `${bossDef.title} lies broken before you. ${bossDef.faction} mourns their fallen champion. GOOD. Let them mourn.`);
    // Schedule next boss
    gs.bossBattle.countdownTicks = CONFIG.BOSS_UNLOCK_COUNTDOWN_TICKS;
  }
}

function resolveBossDefeat() {
  const gs = gameState;
  const bossDef = gs.bossBattle.isFinalBoss ? CONFIG.FINAL_BOSS : CONFIG.BOSSES[gs.bossBattle.currentBoss];
  gs.bossBattle.inBattle = false;
  gs.bossBattle.retryTicks = CONFIG.BOSS_RETRY_COOLDOWN_TICKS;

  if (!gs.statistics.bossRecord[bossDef.id]) gs.statistics.bossRecord[bossDef.id] = { wins: 0, losses: 0, damageDealt: 0, damageTaken: 0 };
  gs.statistics.bossRecord[bossDef.id].losses++;

  // Lose 25% army
  for (const type of ['zombie', 'ghoul', 'golem', 'wraith']) {
    const lost = Math.floor(gs.units[type] * 0.25);
    gs.units[type] = Math.max(type === 'zombie' ? 1 : 0, gs.units[type] - lost);
  }

  addLog(`BOSS BATTLE LOST: ${bossDef.name} repelled our forces! 25% army lost. Retry in 5 minutes.`, 'boss');
  showStoryModal('Defeated', `${bossDef.name} stands triumphant over my broken forces. This is TEMPORARY. I will return. I always return.`);
}

// ---------- QUEST SYSTEM ----------
