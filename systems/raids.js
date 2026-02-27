'use strict';
// ============================================================
// RAIDS — Raid launch, simulation, and resolution. Writes state.
// ============================================================

let selectedStrategy = 'standard';
let raidSimMsgIndex  = 0;

function calcArmyStrength() {
  const gs = gameState;
  return gs.units.zombie + gs.units.ghoul * 4 + gs.units.golem * 20 + gs.units.wraith * 100;
}

function openRaidModal() {
  const gs = gameState;
  if (gs.necromancyLevel < 10) { showStoryModal("Not Yet", "Terror Raids require Level 10, worm. Keep ascending."); return; }
  if (gs.raidActive)           { switchTab('raid'); return; }
  if (gs.raidCooldown > 0)     { showStoryModal("Patience", `The army recovers. ${formatTime(gs.raidCooldown)} remaining.`); return; }

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
  const gs = gameState;
  const modal  = document.getElementById('modal-raid');
  const title  = document.getElementById('modal-raid-title');
  const body   = document.getElementById('modal-raid-body');
  const choices = document.getElementById('modal-raid-choices');
  const footer = document.getElementById('modal-raid-footer');

  title.textContent = 'Choose Your Target, Worm';
  body.innerHTML = `<p>The army awaits your command. Choose a target and strategy wisely.</p>
    <p style="font-size:12px;color:var(--text-dim);">Army strength: ${formatNum(calcArmyStrength())} | Forces: ${gs.units.zombie}Z ${gs.units.ghoul}G ${gs.units.golem}Gol</p>`;

  let strategyHtml = '<div class="strategy-selector" id="raid-strategy-selector">';
  for (const [sid, strat] of Object.entries(CONFIG.RAID_STRATEGIES)) {
    strategyHtml += `<button class="strategy-btn ${sid === selectedStrategy ? 'selected' : ''}" data-strategy="${sid}">${strat.name}</button>`;
  }
  strategyHtml += '</div>';

  let targetsHtml = '';
  for (const target of CONFIG.RAID_TARGETS) {
    targetsHtml += `<button class="raid-choice-btn" data-target="${target.id}">
      <span class="raid-choice-name">${target.name}</span>
      <span class="raid-choice-details">${target.description}</span>
      <span class="raid-choice-details" style="color:var(--text-warning);">Retaliation: ${Math.round(target.baseRetaliation * 100)}% | Duration: ${target.baseDuration}s</span>
    </button>`;
  }

  choices.innerHTML = strategyHtml + targetsHtml;
  footer.innerHTML  = '<button class="btn" id="modal-raid-cancel-inner">Retreat</button>';

  // Wire dynamic buttons
  choices.querySelectorAll('.strategy-btn').forEach(btn => {
    btn.addEventListener('click', () => selectStrategy(btn.dataset.strategy));
  });
  choices.querySelectorAll('.raid-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => launchStandardRaid(btn.dataset.target));
  });
  document.getElementById('modal-raid-cancel-inner').addEventListener('click', closeRaidModal);

  modal.classList.add('visible');
}

function showNarrativeRaidModal(nr) {
  const modal = document.getElementById('modal-raid');
  document.getElementById('modal-raid-title').textContent = nr.title;
  document.getElementById('modal-raid-body').innerHTML = `<p>${nr.description}</p>`;

  let choicesHtml = '';
  for (const choice of nr.choices) {
    choicesHtml += `<button class="raid-choice-btn" data-narrative="${nr.id}" data-choice="${choice.id}">
      <span class="raid-choice-name">${choice.name}</span>
      <span class="raid-choice-details">${choice.description}</span>
    </button>`;
  }
  const choicesEl = document.getElementById('modal-raid-choices');
  choicesEl.innerHTML = choicesHtml;
  document.getElementById('modal-raid-footer').innerHTML = '<button class="btn" id="modal-raid-cancel-inner">Decline</button>';

  choicesEl.querySelectorAll('.raid-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => launchNarrativeRaid(btn.dataset.narrative, btn.dataset.choice));
  });
  document.getElementById('modal-raid-cancel-inner').addEventListener('click', closeRaidModal);

  modal.classList.add('visible');
}

function selectStrategy(id) {
  selectedStrategy = id;
  document.querySelectorAll('.strategy-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.strategy === id);
  });
}

function closeRaidModal() {
  const el = document.getElementById('modal-raid');
  if (el) el.classList.remove('visible');
}

function launchStandardRaid(targetId) {
  closeRaidModal();
  const gs     = gameState;
  const target = CONFIG.RAID_TARGETS.find(t => t.id === targetId);
  const strat  = CONFIG.RAID_STRATEGIES[selectedStrategy];
  const skills = gs.grimoireSkills;

  const armyStrength = calcArmyStrength();
  const duration     = Math.ceil(target.baseDuration * strat.durationMult);
  let retaliation    = target.baseRetaliation * strat.retaliationMult + (gs.raidLevel * 0.05);

  if (skills.unyieldingHorde)  retaliation -= gs.units.zombie * 0.01;
  if (skills.chillingGrip)     retaliation -= Math.min(gs.units.ghoul * 0.02, 0.20);
  if (skills.boneFortress)     retaliation -= gs.units.golem * 0.05;
  if (gs.tower.floorsBuilt >= 4) retaliation -= 0.10;
  retaliation = Math.max(0, Math.min(1, retaliation));

  let rewardMult = strat.rewardMult;
  if (skills.tauntDamned)       rewardMult *= 1.25;
  if (skills.sacrificeCritical) rewardMult *= 1.35;

  gs.raidActive           = true;
  gs.raidTimeRemaining    = duration;
  gs.raidTimeFull         = duration;
  gs.raidSimulated        = false;
  gs.raidSimulatedOutcome = null;
  gs.raidSimLog           = [];
  gs.raidArmySnapshot     = { ...gs.units };
  gs.raidDetails          = { type: 'standard', targetId, strategyId: selectedStrategy, retaliation, rewardMult, armyStrength, target };

  addLog(`RAID LAUNCHED: ${target.name} — ${selectedStrategy} strategy. ${duration}s.`, 'raid');
  switchTab('raid');
}

function launchNarrativeRaid(narrativeId, choiceId) {
  closeRaidModal();
  const gs     = gameState;
  const nr     = CONFIG.NARRATIVE_RAIDS.find(n => n.id === narrativeId);
  const choice = nr.choices.find(c => c.id === choiceId);

  gs.raidActive           = true;
  gs.raidTimeRemaining    = choice.duration;
  gs.raidTimeFull         = choice.duration;
  gs.raidSimulated        = false;
  gs.raidSimulatedOutcome = null;
  gs.raidSimLog           = [];
  gs.raidArmySnapshot     = { ...gs.units };
  gs.raidDetails          = { type: 'narrative', narrativeId, choiceId, choice, nr };

  addLog(`NARRATIVE RAID: ${nr.title} — ${choice.name}`, 'raid');
  switchTab('raid');
}

function preRollRaidOutcome() {
  const gs  = gameState;
  const rd  = gs.raidDetails;
  const retaliation = rd.type === 'narrative' ? rd.choice.retaliation : (rd.retaliation || 0);
  const success = !roll(retaliation);
  gs.raidSimulatedOutcome = { success, retaliation };

  const msgs = ['Your vanguard engages the defenders...'];
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

function dripRaidSimMessage() {
  const gs  = gameState;
  if (!gs.raidSimLog || gs.raidSimLog.length === 0) return;
  const idx = Math.floor((gs.raidTimeFull * 0.25 - gs.raidTimeRemaining) / 4);
  if (idx < gs.raidSimLog.length && idx !== raidSimMsgIndex) {
    raidSimMsgIndex = idx;
  }
}

function resolveRaid() {
  const gs      = gameState;
  gs.raidActive = false;
  const rd      = gs.raidDetails;
  const outcome = gs.raidSimulatedOutcome || { success: true, retaliation: 0 };
  const snap    = gs.raidArmySnapshot;
  raidSimMsgIndex = 0;

  if (rd.type === 'standard') {
    const target  = CONFIG.RAID_TARGETS.find(t => t.id === rd.targetId);
    const armyPow = rd.armyStrength;

    if (outcome.success) {
      let reward = Math.floor(target.baseRewardMult * armyPow * rd.rewardMult);
      if (target.baseRewardType === 'se') { gs.soulEssence += reward; gs.statistics.lifetime.soulEssenceEarned += reward; }
      else if (target.baseRewardType === 'dm') { gs.darkMana += reward; gs.statistics.lifetime.darkManaEarned += reward; }
      else if (target.baseRewardType === 'cm') { gs.corpseMatter += reward; gs.statistics.lifetime.corpseMatterEarned += reward; }

      if (target.bonusUnits) {
        const extra = randInt(target.bonusUnits.min, target.bonusUnits.max);
        const zCap  = calcZombieCap();
        const added = Math.min(extra, zCap - gs.units.zombie);
        if (added > 0) { gs.units.zombie += added; addLog(`+${added} zombies rose from the graveyard!`, 'unit'); }
      }

      gs.statistics.lifetime.raidsCompleted++;
      gs.raidCooldown = 60;
      gs.raidLevel++;
      addLog(`RAID SUCCESS: ${target.name}! Gained ${formatNum(reward)} ${target.baseRewardType.toUpperCase()}!`, 'raid');
      showStoryModal('Raid Victorious!', `The ${target.name} has been pillaged! ${formatNum(reward)} ${target.baseRewardType.toUpperCase()} added to your treasury. MAGNIFICENT.`);
    } else {
      gs.soulEssence = 0;
      gs.darkMana    = 0;
      const keepFraction = gs.grimoireSkills.undyingWill ? 0.5 : (gs.grimoireSkills.tauntDamned ? 0.75 : 0);
      applyUnitLosses(snap, keepFraction);
      gs.raidCooldown = 120;
      addLog('RAID FAILED! Forces routed. Resources lost.', 'raid');
      showStoryModal('Raid Failed', 'The defenders repelled my forces! SE and DM lost. The shame. THE SHAME. We will return stronger.');
    }
  } else if (rd.type === 'narrative') {
    const nr     = rd.nr;
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
      gs.statistics.lifetime.raidsCompleted++;
      gs.raidCooldown = 90;
      showStoryModal(nr.title + ' — Victory!', 'The dark deed is done. Power flows to THE MIGHTY MALAKAR.');
    } else {
      applyUnitLosses(snap, 0.5);
      gs.soulEssence = Math.floor(gs.soulEssence * 0.5);
      gs.darkMana    = Math.floor(gs.darkMana * 0.5);
      gs.raidCooldown = 120;
      addLog(`NARRATIVE RAID FAILED: ${nr.title}. Army losses sustained.`, 'raid');
      showStoryModal(nr.title + ' — Defeat', 'We were repelled. Half the army lost. Resources halved. I am displeased. EXTREMELY displeased.');
    }
  }

  gs.raidDetails          = null;
  gs.raidSimLog           = [];
  gs.raidSimulated        = false;
  gs.raidSimulatedOutcome = null;
  gs.pendingRaid          = null;
  gs.pendingRaidChoice    = null;
}

function applyUnitLosses(snapshot, keepFraction) {
  const gs = gameState;
  for (const type of ['zombie', 'ghoul', 'golem', 'wraith']) {
    const lost = snapshot[type] - Math.floor(snapshot[type] * keepFraction);
    gs.units[type] = Math.max(0, gs.units[type] - lost);
    if (type === 'zombie') gs.units.zombie = Math.max(1, gs.units.zombie);
    gs.statistics.currentRun.unitsLost = (gs.statistics.currentRun.unitsLost || 0) + lost;
  }
}
