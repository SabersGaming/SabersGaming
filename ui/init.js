// ============================================================
// ui/init.js — BOOTSTRAP & EVENT WIRING
// Owns: wireEvents(), setupTicker(), showIntroModal(),
//       DOMContentLoaded bootstrap sequence.
// Event listeners dispatch to systems — they NEVER execute logic.
// All addEventListener calls live here and nowhere else.
// ============================================================
'use strict';

function wireEvents() {
  // Age gate
  document.getElementById('btn-age-gate-continue').addEventListener('click', () => {
    document.getElementById('modal-age-gate').classList.remove('visible');
    const isNewGame = gameState.statistics.lifetime.totalPlayTime < 5;
    if (isNewGame) document.getElementById('modal-lore-background').classList.add('visible');
  });

  // Lore background
  document.getElementById('btn-lore-background-close').addEventListener('click', () => {
    document.getElementById('modal-lore-background').classList.remove('visible');
    showIntroModal();
  });

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Unit buttons
  document.getElementById('btn-zombie').addEventListener('click', () => buyUnit('zombie'));
  document.getElementById('btn-ghoul').addEventListener('click',  () => buyUnit('ghoul'));
  document.getElementById('btn-golem').addEventListener('click',  () => buyUnit('golem'));
  document.getElementById('btn-wraith').addEventListener('click', () => buyUnit('wraith'));
  document.getElementById('btn-raise-all').addEventListener('click', raiseAllUndead);

  // Tome buttons
  document.getElementById('btn-binding').addEventListener('click', () => buyTome('tome1_binding'));
  document.getElementById('btn-sight').addEventListener('click',   () => buyTome('tome2_sight'));

  // Action buttons
  document.getElementById('btn-study').addEventListener('click', doStudy);
  document.getElementById('btn-dark-library').addEventListener('click', openDarkLibrary);
  document.getElementById('btn-ascend').addEventListener('click', performAscension);
  document.getElementById('btn-grimoire').addEventListener('click', openGrimoireModal);
  document.getElementById('btn-raid').addEventListener('click', openRaidModal);
  document.getElementById('btn-shop').addEventListener('click', openShopModal);
  document.getElementById('btn-save').addEventListener('click', manualSave);
  document.getElementById('btn-load').addEventListener('click', manualLoad);

  // Offline time
  document.getElementById('btn-offline-time').addEventListener('click', () => {
    if (gameState.offlineTime > 0) showOfflineModal(gameState.offlineTime, "Allocate your banked offline time:");
    else showStoryModal("No Offline Time", "No banked offline progress available, worm. Play more.");
  });

  // Curse buttons
  document.getElementById('btn-feast').addEventListener('click',       () => castCurse('feastOfSouls'));
  document.getElementById('btn-corpse-grat').addEventListener('click', () => castCurse('corpseGratification'));
  document.getElementById('btn-ruinous').addEventListener('click',     () => castCurse('ruinousAmbition'));

  // Auth
  document.getElementById('btn-google-signin').addEventListener('click', googleSignIn);
  document.getElementById('btn-email-login').addEventListener('click', () =>
    showStoryModal('Email Login', 'Email/Password login requires Firebase configuration. Cloud save unavailable in demo mode.')
  );
  document.getElementById('btn-sign-out').addEventListener('click', signOut);

  // Story modal
  document.getElementById('modal-story-close').addEventListener('click', closeStoryModal);
  document.getElementById('modal-story').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-story')) closeStoryModal();
  });

  // Grimoire modal
  document.getElementById('modal-grimoire-confirm').addEventListener('click', () => closeGrimoireModal(true));
  document.getElementById('modal-grimoire-cancel').addEventListener('click',  () => closeGrimoireModal(false));

  // Library modal
  document.getElementById('modal-library-close').addEventListener('click', () => {
    document.getElementById('modal-library').classList.remove('visible');
  });

  // Offline modal
  document.getElementById('modal-offline-apply').addEventListener('click', applyOfflineProgress);
  document.getElementById('modal-offline-skip').addEventListener('click', () => {
    gameState.offlineTime = 0;
    document.getElementById('modal-offline').classList.remove('visible');
  });

  // Shop modal
  document.getElementById('modal-shop-close').addEventListener('click', () => {
    document.getElementById('modal-shop').classList.remove('visible');
  });

  // Info section toggles
  document.querySelectorAll('.info-section-header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('open');
      header.querySelector('.info-section-toggle').textContent =
        header.parentElement.classList.contains('open') ? '▲' : '▼';
    });
  });
}

function setupTicker() {
  const el = document.getElementById('ticker-text');
  if (el) el.textContent = CONFIG.TICKER_MESSAGES.join('   ·   ');
}

function showIntroModal() {
  showStoryModal('THE DESCENT BEGINS', CONFIG.INTRO_DIALOGUE, () => {
    gamePaused = false;
    addLog("Malakar stirs. The first zombie shambles to its feet. The conquest has begun.", 'story');
  });
}

// ── Single Legal Game Loop ─────────────────────────────────────
// Tick order is deterministic and must remain so.
// 1. Guard  2. Combat  3. Resources  4. Tower  5. Progression  6. Save  7. UI
function gameTick() {
  if (gamePaused) return;
  const gs = gameState;
  gs._tick++;

  // 1. COMBAT
  if (gs.bossBattle.inBattle) tickBossBattle();

  // 2. RESOURCES
  applyResourceTick();

  // 3. TOWER — check build progress
  if (gs.tower.isBuilding) {
    gs.tower.buildTimeRemaining--;
    if (gs.tower.buildTimeRemaining <= 0) resolveFloorBuild();
  }

  // 4. RAID — countdown and resolution
  if (gs.raidActive) {
    gs.raidTimeRemaining--;
    if (gs.raidTimeRemaining <= 0) resolveRaid();
    // Drip sim messages in last 25%
    if (!gs.raidSimulated) preRollRaidOutcome();
    if (gs.raidTimeRemaining <= gs.raidTimeFull * 0.25) dripRaidSimMessage();
  }
  if (gs.raidCooldown > 0) gs.raidCooldown--;
  if (gs.bossBattle.unlocked && !gs.bossBattle.inBattle) checkBossUnlock();

  // 5. PROGRESSION — quests, variant messages
  if (gs._tick % CONFIG.QUEST_CHECK_TICKS === 0) checkQuests();
  if (gs._tick % 30 === 0) showVariantMessage();

  // 6. SAVE
  if (gs._tick % CONFIG.AUTOSAVE_TICKS === 0) saveGame();

  // 7. UI — always last, always once
  updateUI();
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  wireEvents();
  setupTicker();
  setInterval(rotateTicker, CONFIG.TICKER_INTERVAL_MS);

  initDB(function () {
    loadGame(function () {
      handleOfflineProgress();
      updateCurseButtons();

      if (gameState.grimoireUnlocked) {
        document.getElementById('btn-grimoire').classList.add('visible');
      }
      if (gameState.bossBattle.unlocked) {
        document.getElementById('tab-btn-boss').classList.remove('hidden');
      }
      if (gameState.grimoireSkills.armyDarkness) {
        document.getElementById('btn-wraith').classList.remove('hidden');
        document.getElementById('display-wraiths-chip').classList.remove('hidden');
      }

      const isNewGame = gameState.statistics.lifetime.totalPlayTime < 5;
      if (!isNewGame) {
        gamePaused = false;
        addLog('Malakar returns. The conquest resumes.', 'story');
        if (gameState.raidActive) {
          addLog('Raid resolved during absence.', 'raid');
          gameState.raidActive = false;
          gameState.raidCooldown = 30;
        }
      }

      tickInterval = setInterval(gameTick, CONFIG.TICK_MS);
      updateUI();
      addLog(`Necromancy Level: ${gameState.necromancyLevel} | Multiplier: ×${gameState.permanentEssenceMultiplier}`, 'system');
    });
  });

  initFirebase();
});
