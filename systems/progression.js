'use strict';
// ============================================================
// PROGRESSION — Ascension, curse unlocks, boss unlock checks.
// Writes state. Minimal DOM (only UI flag toggles on ascension).
// ============================================================

function performAscension() {
  const gs = gameState;
  const cost = getAscensionCost();

  if (gs.soulEssence < cost) { addLog('Insufficient Soul Essence to ascend, worm.', 'system'); return; }
  if (gs.raidActive)          { addLog('Cannot ascend during an active raid.', 'system'); return; }

  gs.soulEssence -= cost;
  gs.necromancyLevel++;
  gs.permanentEssenceMultiplier = parseFloat((gs.permanentEssenceMultiplier + 0.1).toFixed(1));
  gs.statistics.lifetime.ascensionsPerformed++;

  // eternalLegion: units survive ascension
  if (!gs.grimoireSkills.eternalLegion) {
    gs.units = { zombie: 1, ghoul: 0, golem: 0, wraith: 0 };
  }

  gs.darkMana    = 0;
  gs.corpseMatter= 0;
  gs.darkManaStudyBonus = 0;
  gs.curses.activeSpell  = null;
  gs.curses.spellDuration = 0;

  // Grimoire unlocks at level 20
  if (gs.necromancyLevel >= 20 && !gs.grimoireUnlocked) {
    gs.grimoireUnlocked = true;
    // DOM update handled by updateCurseButtons in display.js
  }

  checkCurseUnlocks();

  // Story or variant message
  if (!gs.hasEverPrestiged && !gs.storyShown[gs.necromancyLevel]) {
    gs.storyShown[gs.necromancyLevel] = true;
    const storyText = CONFIG.NECROMANCY_STORY[gs.necromancyLevel];
    if (storyText) {
      const title = `Chapter ${gs.necromancyLevel}: The Descent Continues`;
      if (gs.necromancyLevel === 20) {
        showStoryModal(title, storyText, () => { if (!gs.hasEverPrestiged) openGrimoireModal(); });
      } else {
        showStoryModal(title, storyText);
      }
    }
  } else if (gs.hasEverPrestiged) {
    showVariantMessage();
    if (gs.necromancyLevel >= 20) setTimeout(() => openGrimoireModal(), 1500);
  }

  addLog(`DARK ASCENSION! Level ${gs.necromancyLevel} achieved. Multiplier: ×${gs.permanentEssenceMultiplier}`, 'ascend');
  updateUI();
}

function checkCurseUnlocks() {
  const gs = gameState;
  const lv = gs.necromancyLevel;

  if (lv >= 2 && !gs.curses.feastOfSoulsUnlocked) {
    gs.curses.feastOfSoulsUnlocked = true;
    addLog('CURSE UNLOCKED: Feast of Souls!', 'curse');
  }
  if (lv >= 5 && !gs.curses.corpseGratificationUnlocked) {
    gs.curses.corpseGratificationUnlocked = true;
    if (!gs.curses.corpseGratificationDiscovered) {
      gs.curses.corpseGratificationDiscovered = true;
      showStoryModal('NEW CURSE: Corpse Gratification', CONFIG.CURSES.corpseGratification.discoveryDialogue);
    }
  }
  if (lv >= 10 && !gs.curses.ruinousAmbitionUnlocked) {
    gs.curses.ruinousAmbitionUnlocked = true;
    if (!gs.curses.ruinousAmbitionDiscovered) {
      gs.curses.ruinousAmbitionDiscovered = true;
      showStoryModal('NEW CURSE: Ruinous Ambition', CONFIG.CURSES.ruinousAmbition.discoveryDialogue);
    }
  }
}

function checkBossUnlock() {
  const gs = gameState;
  const skills = gs.grimoireSkills;

  // Boss battles unlock when any Tier 2 grimoire skill is owned
  if (!gs.bossBattle.unlocked) {
    const tier2Skills = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === 2);
    if (tier2Skills.some(s => skills[s.id])) {
      gs.bossBattle.unlocked = true;
      gs.bossBattle.maxBossUnlocked = Math.max(gs.bossBattle.maxBossUnlocked, 1);
      addLog('BOSS BATTLES UNLOCKED! Champions of Brooklynia await your challenge.', 'boss');
      // DOM update happens in updateCurseButtons / updateUI — not here
    }
  }
}

function showVariantMessage() {
  const gs = gameState;
  const tier = getVariantTier();
  const msgs = CONFIG.VARIANT_MESSAGES[tier];
  if (!msgs) return;

  if (gs.variantTier !== tier) {
    gs.variantTier = tier;
    gs.variantMessageIndex = 0;
  }

  const msg = msgs[gs.variantMessageIndex % msgs.length];
  gs.variantMessageIndex = (gs.variantMessageIndex + 1) % msgs.length;

  showStoryModal(`Cycle ${gs.grimoirePrestigeCount} — Tier ${tier} Mastery`, msg);
}

function getVariantTier() {
  const gs = gameState;
  const skills = gs.grimoireSkills;
  if (skills.deathsDominance && skills.undyingWill && skills.transcendentCommand) return 5;
  const tier4 = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === 4);
  if (tier4.some(s => skills[s.id])) return 4;
  const tier3 = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === 3);
  if (tier3.some(s => skills[s.id])) return 3;
  return 2;
}
