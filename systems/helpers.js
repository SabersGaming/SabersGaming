// ============================================================
// systems/helpers.js — PURE UTILITY FUNCTIONS
// No DOM manipulation. No state writes. Read-only state access.
// Display formatting and calculation helpers only.
// ============================================================
'use strict';

// ── Number Formatting ─────────────────────────────────────────
function formatNum(n) {
  if (n === undefined || n === null) return '0';
  n = Math.floor(n);
  if (n < 1000)       return String(n);
  if (n < 1000000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1000000000) return (n / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  return (n / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
}

function formatTime(seconds) {
  seconds = Math.ceil(seconds);
  if (seconds < 60) return seconds + 's';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + 'm ' + (s > 0 ? s + 's' : '');
}

// ── RNG Helpers ───────────────────────────────────────────────
function roll(chance)         { return Math.random() < chance; }
function randInt(min, max)    { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFrom(arr)        { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Unit Cap Calculations (Pillar I — Scaling Formulas) ───────
// All cap formulas live here as named helpers. Never inline.
function calcZombieCap() {
  const gs = gameState;
  const lv = gs.necromancyLevel;
  const binding = gs.tomes.tome1_binding;
  let cap = Math.floor(25 * Math.pow(lv, 1.3)) + binding * 15;
  if (gs.grimoireSkills.relentlessHorde)      cap = Math.floor(cap * 1.25);
  if (gs.grimoireSkills.transcendentCommand)  cap = Math.floor(cap * 1.50);
  return Math.max(cap, 1);
}

function calcGhoulCap() {
  const gs = gameState;
  const lv = gs.necromancyLevel;
  const binding = gs.tomes.tome1_binding;
  let cap = Math.floor(12 * Math.pow(lv, 1.3)) + binding * 8;
  if (gs.grimoireSkills.transcendentCommand) cap = Math.floor(cap * 1.50);
  return Math.max(cap, 0);
}

function calcGolemCap() {
  const gs = gameState;
  const lv = gs.necromancyLevel;
  const sight = gs.tomes.tome2_sight;
  let cap = Math.floor(6 * Math.pow(lv, 1.3)) + sight * 4;
  if (gs.grimoireSkills.transcendentCommand) cap = Math.floor(cap * 1.50);
  return Math.max(cap, 0);
}

function calcWraithCap() {
  const gs = gameState;
  const lv = gs.necromancyLevel;
  let cap = Math.floor(5 * Math.pow(lv, 1.2));
  if (gs.grimoireSkills.transcendentCommand) cap = Math.floor(cap * 1.50);
  return Math.max(cap, 0);
}

// ── Ascension Cost (Prestige Pillar — Logarithmic Scaling) ────
function getAscensionCost() {
  return CONFIG.ASCEND_BASE_COST * Math.pow(2, gameState.necromancyLevel - 1);
}

// ── Army Strength (used by Raids) ────────────────────────────
function calcArmyStrength() {
  const gs = gameState;
  return gs.units.zombie * CONFIG.UNITS.zombie.hpBoss
       + gs.units.ghoul  * CONFIG.UNITS.ghoul.hpBoss
       + gs.units.golem  * CONFIG.UNITS.golem.hpBoss
       + gs.units.wraith * CONFIG.UNITS.wraith.hpBoss;
}
