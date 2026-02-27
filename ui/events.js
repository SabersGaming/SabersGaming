'use strict';
// ============================================================
// EVENTS — wireEvents, ticker, intro modal, DOMContentLoaded bootstrap.
// No game logic. No state writes (except gamePaused on intro close).
// ============================================================

function wireEvents() {
  // Age gate
  document.getElementById('btn-age-gate-continue').addEventListener('click', () => {
    document.getElementById('modal-age-gate').classList.remove('visible');
    const isNewGame = gameState.statistics.lifetime.totalPlayTime < 5;
    if (isNewGame) {
      document.getElementById('modal-lore-background').classList.add('visible');
    } else {
      // Returning player bypasses lore
    }
  });

  // Lore background close
  document.getElementById('btn-lore-background-close').addEventListener('click', () => {
    document.getElementById('modal-lore-background').classList.remove('visible');
    showIntroModal();
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Left panel — unit buttons
  document.getElementById('btn-zombie').addEventListener('click',    () => buyUnit('zombie'));
  document.getElementById('btn-ghoul').addEventListener('click',     () => buyUnit('ghoul'));
  document.getElementById('btn-golem').addEventListener('click',     () => buyUnit('golem'));
  document.getElementById('btn-wraith').addEventListener('click',    () => buyUnit('wraith'));
  document.getElementById('btn-raise-all').addEventListener('click', raiseAllUndead);

  // Left panel — tomes
  document.getElementById('btn-binding').addEventListener('click',      () => buyTome('tome1_binding'));
  document.getElementById('btn-sight').addEventListener('click',        () => buyTome('tome2_sight'));
  document.getElementById('btn-study').addEventListener('click',        doStudy);
  document.getElementById('btn-dark-library').addEventListener('click', openDarkLibrary);

  // Left panel — ascension & grimoire
  document.getElementById('btn-ascend').addEventListener('click',   performAscension);
  document.getElementById('btn-grimoire').addEventListener('click',  openGrimoireModal);

  // Left panel — raid, shop, save
  document.getElementById('btn-raid').addEventListener('click',  openRaidModal);
  document.getElementById('btn-shop').addEventListener('click',  openShopModal);
  document.getElementById('btn-save').addEventListener('click',  manualSave);
  document.getElementById('btn-load').addEventListener('click',  manualLoad);

  // Left panel — offline time
  document.getElementById('btn-offline-time').addEventListener('click', () => {
    if (gameState.offlineTime > 0) showOfflineModal(gameState.offlineTime, 'Allocate your banked offline time:');
    else showStoryModal('No Offline Time', 'No banked offline progress available, worm. Play more.');
  });

  // Curse buttons
  document.getElementById('btn-feast').addEventListener('click',      () => castCurse('feastOfSouls'));
  document.getElementById('btn-corpse-grat').addEventListener('click',() => castCurse('corpseGratification'));
  document.getElementById('btn-ruinous').addEventListener('click',    () => castCurse('ruinousAmbition'));

  // Auth — Firebase removed; show info modal
  document.getElementById('btn-google-signin').addEventListener('click', () => {
    showStoryModal('Cloud Save', 'Cloud save has been removed from this build. Your data is saved locally.');
  });
  document.getElementById('btn-email-login').addEventListener('click', () => {
    showStoryModal('Cloud Save', 'Cloud save has been removed from this build. Your data is saved locally.');
  });
  document.getElementById('btn-sign-out').addEventListener('click', () => {});

  // Story modal
  document.getElementById('modal-story-close').addEventListener('click', closeStoryModal);
  document.getElementById('modal-story').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-story')) closeStoryModal();
  });

  // Grimoire modal
  document.getElementById('modal-grimoire-confirm').addEventListener('click', () => closeGrimoireModal(true));
  document.getElementById('modal-grimoire-cancel').addEventListener('click',  () => closeGrimoireModal(false));

  // Dark Library close
  document.getElementById('modal-library-close').addEventListener('click', () => {
    document.getElementById('modal-library').classList.remove('visible');
  });

  // Offline modal
  document.getElementById('modal-offline-apply').addEventListener('click', applyOfflineProgress);
  document.getElementById('modal-offline-skip').addEventListener('click', () => {
    gameState.offlineTime = 0;
    document.getElementById('modal-offline').classList.remove('visible');
  });

  // Shop close
  document.getElementById('modal-shop-close').addEventListener('click', () => {
    document.getElementById('modal-shop').classList.remove('visible');
  });
}

function setupTicker() {
  const el = document.getElementById('ticker-text');
  if (el) el.textContent = CONFIG.TICKER_MESSAGES.join('   ·   ');
}

function rotateTicker() {
  const el   = document.getElementById('ticker-text');
  const msgs = CONFIG.TICKER_MESSAGES;
  tickerIndex = (tickerIndex + 1) % msgs.length;
  if (el) {
    el.textContent = msgs.join('   ·   ');
    el.style.animation = 'none';
    el.offsetHeight; // force reflow
    el.style.animation = '';
  }
}

function showIntroModal() {
  showStoryModal(
    'THE DESCENT BEGINS',
    CONFIG.INTRO_DIALOGUE,
    () => {
      gamePaused = false;
      addLog('Malakar stirs. The first zombie shambles to its feet. The conquest has begun.', 'story');
    }
  );
}

// ---------- BOOTSTRAP ----------
document.addEventListener('DOMContentLoaded', function () {
  wireEvents();
  setupTicker();
  setInterval(rotateTicker, CONFIG.TICKER_INTERVAL_MS);

  initDB().then(() => {
    loadGame().then(raw => {
      const loaded = applyLoadedState(raw);

      if (loaded) {
        handleOfflineProgress();
      }

      // Restore UI-visible state flags
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
        // If offline raid was left running, resolve it cleanly
        if (gameState.raidActive) {
          gameState.raidActive  = false;
          gameState.raidCooldown = 30;
          addLog('Raid resolved during absence.', 'raid');
        }
        // Dismiss age gate immediately for returning players
        document.getElementById('modal-age-gate').classList.remove('visible');
      }
      // New game: age gate stays visible; lore → intro chain handles unpausing

      tickInterval = setInterval(gameTick, CONFIG.TICK_MS);
      updateUI();
      addLog(`Necromancy Level: ${gameState.necromancyLevel} | Multiplier: ×${gameState.permanentEssenceMultiplier}`, 'system');
    });
  });
});
