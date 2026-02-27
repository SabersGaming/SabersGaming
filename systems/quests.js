'use strict';
// ============================================================
// QUESTS — Quest checking and claiming. Writes state. No DOM.
// ============================================================

function checkQuests() {
  const gs    = gameState;
  const stats = gs.statistics.lifetime;

  for (const quest of CONFIG.QUESTS) {
    if (!gs[quest.id + '_completed'] && !gs[quest.id + '_claimable']) {
      const val = stats[quest.targetStat] || 0;
      if (val >= quest.target) {
        gs[quest.id + '_claimable'] = true;
        addLog(`Quest ready to claim: "${quest.name}" — click Quests tab!`, 'system');
      }
    }
  }
}

function claimQuest(questId) {
  const gs    = gameState;
  const quest = CONFIG.QUESTS.find(q => q.id === questId);
  if (!quest || !gs[questId + '_claimable']) return;

  gs[questId + '_claimable'] = false;
  gs[questId + '_completed'] = true;
  gs.tomeUpgradePoints += quest.reward;

  addLog(`Quest claimed: "${quest.name}" — +${quest.reward} Tome Upgrade Point(s)!`, 'system');
  renderQuestsTab();
  updateResourceDisplay();
}
