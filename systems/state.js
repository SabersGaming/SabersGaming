// ============================================================
// systems/state.js — CENTRALIZED STATE OWNER
// THE single source of truth for all mutable game data.
// All variables live here. No logic. No DOM. No formulas.
// Systems read from and write to this object only.
// ============================================================
'use strict';

function createDefaultState() {
  return {
    soulEssence: 0,
    darkMana: 0,
    corpseMatter: 0,
    tomeUpgradePoints: 0,
    units: { zombie: 1, ghoul: 0, golem: 0, wraith: 0 },
    tomes: { tome1_binding: 0, tome2_sight: 0 },
    tomeCaps: { tome1_binding: CONFIG.TOME_STARTING_CAP, tome2_sight: CONFIG.TOME_STARTING_CAP },
    necromancyLevel: 1,
    permanentEssenceMultiplier: 1,
    darkManaStudyBonus: 0,
    grimoireUnlocked: false,
    hasEverPrestiged: false,
    premiumUnlocked: false,
    purchaseHistory: [],
    grimoireSkills: Object.fromEntries(Object.keys(CONFIG.GRIMOIRE_SKILLS).map(k => [k, false])),
    grimoirePrestigeCount: 0,
    grimoirePrestigePendingSkills: [],
    curses: {
      feastOfSoulsUnlocked: false, corpseGratificationUnlocked: false, ruinousAmbitionUnlocked: false,
      corpseGratificationDiscovered: false, ruinousAmbitionDiscovered: false,
      activeSpell: null, spellDuration: 0, corpseGratificationCooldown: 0, ruinousAmbitionCooldown: 0,
    },
    tower: { floorsBuilt: 0, maxFloorEver: 0, isBuilding: false, buildFloor: 0, buildTimeRemaining: 0, buildTimeFull: 0 },
    raidLevel: 0, raidActive: false, raidCooldown: 0, raidTimeRemaining: 0, raidTimeFull: 0,
    pendingRaid: null, pendingRaidChoice: null, raidArmySnapshot: null, raidDetails: null,
    raidSimLog: [], raidSimulated: false, raidSimulatedOutcome: null,
    bossBattle: {
      unlocked: false, maxBossUnlocked: 0, currentBoss: 0, inBattle: false,
      bossCurrentHP: 0, bossMaxHP: 0, playerCurrentHP: 0, playerMaxHP: 0,
      defeatedBosses: [], countdownTicks: 0, retryTicks: 0, skillCooldowns: {},
      isFinalBoss: false, attackAccumulator: 0,
    },
    offlineTime: 0,
    lastSaveTimestamp: Date.now(),
    variantMessageIndex: 0,
    variantTier: 0,
    storyShown: {},
    statistics: {
      lifetime: {
        totalPlayTime: 0, soulEssenceEarned: 0, darkManaEarned: 0, corpseMatterEarned: 0,
        zombiesRaised: 0, ghoulsRaised: 0, golemsRaised: 0, wraithsRaised: 0,
        ascensionsPerformed: 0, grimoirePrestigeCount: 0, raidsCompleted: 0,
        bossesDefeated: 0, towerMaxFloor: 0, tomeBindingPurchased: 0, tomeSightPurchased: 0,
        cursescast_feast: 0, cursescast_corpse: 0, cursescast_ruinous: 0,
      },
      currentRun: {
        soulEssenceEarned: 0, darkManaEarned: 0, corpseMatterEarned: 0,
        unitsLost: 0, zombiesRaised: 0, ghoulsRaised: 0, golemsRaised: 0,
      },
      bossRecord: {},
    },
    _tick: 0,
  };
}

// Runtime-only control variables — intentionally outside gameState (not serialized)
var gameState    = createDefaultState();
var gamePaused   = true;
var tickInterval = null;
var currentTab   = 'event-log';
var tickerIndex  = 0;
