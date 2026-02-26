// ============================================================
// systems/save.js — PERSISTENCE SYSTEM
// Owns: serialization, deserialization, offline progress,
//       IndexedDB, Firebase cloud save, manualSave/Load.
// Handles version migration. Validates schema on load.
// NEVER modifies game logic. Gracefully repairs corrupted state.
// ============================================================
"use strict";

// handleOfflineProgress — called ONCE on game load
function handleOfflineProgress() {
  const gs = gameState;
  const now = Date.now();
  const elapsed = Math.floor((now - gs.lastSaveTimestamp) / 1000);
  if (elapsed > 30) {
    const offline = Math.min(elapsed, CONFIG.OFFLINE_CAP_SECONDS);
    gs.offlineTime += offline;
    if (gs.offlineTime > CONFIG.OFFLINE_CAP_SECONDS) gs.offlineTime = CONFIG.OFFLINE_CAP_SECONDS;
    if (offline > 60) {
      showOfflineModal(offline, getOfflineBark(offline));
    }
  }
  gs.lastSaveTimestamp = now;
}

function getOfflineBark(seconds) {
  const barks = CONFIG.OFFLINE_BARKS;
  if (seconds >= 14400) return barks['14400'];
  if (seconds >= 7200)  return barks['7200'].replace('[time]', formatTime(seconds));
  if (seconds >= 3600)  return barks['3600'].replace('[time]', formatTime(seconds));
  if (seconds >= 1800)  return barks['1800'];
  return barks['300'];
}

function showOfflineModal(seconds, bark) {
  const gs = gameState;
  const body = document.getElementById('offline-modal-body');
  body.innerHTML = `<p>${bark}</p><hr class="section-divider"><p>You were away for <strong>${formatTime(seconds)}</strong>. Allocate your offline production across resources:</p>`;

  const seEst = formatNum(Math.floor(calcSEPerTick() * seconds));
  const dmEst = formatNum(Math.floor(calcDMPerTick() * seconds));
  const cmEst = formatNum(Math.floor(calcCMPerTick() * seconds));

  const controls = document.getElementById('offline-controls');
  controls.innerHTML = `
    <div class="offline-slider-row">
      <label style="color:var(--text-necrotic);">Soul Essence — <span id="offline-se-time">${formatTime(seconds)}</span></label>
      <input type="range" class="offline-slider" id="offline-se-slider" min="0" max="${seconds}" value="${seconds}"
        oninput="updateOfflineSlider('se', ${seconds})">
      <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">
        Estimated: <span id="offline-se-yield" class="text-necrotic">${seEst}</span> SE
      </div>
    </div>
    <div class="offline-slider-row" style="margin-top:10px;">
      <label style="color:var(--text-mana);">Dark Mana — <span id="offline-dm-time">${formatTime(0)}</span></label>
      <input type="range" class="offline-slider" id="offline-dm-slider" min="0" max="${seconds}" value="0"
        oninput="updateOfflineSlider('dm', ${seconds})">
      <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">
        Estimated: <span id="offline-dm-yield" class="text-mana">0</span> DM
      </div>
    </div>
    <div class="offline-slider-row" style="margin-top:10px;">
      <label style="color:var(--text-shadow);">Corpse Matter — <span id="offline-cm-time">${formatTime(0)}</span></label>
      <input type="range" class="offline-slider" id="offline-cm-slider" min="0" max="${seconds}" value="0"
        oninput="updateOfflineSlider('cm', ${seconds})">
      <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">
        Estimated: <span id="offline-cm-yield" class="text-shadow">0</span> CM
      </div>
    </div>
    <div style="font-size:11px;color:var(--text-dim);margin-top:8px;text-align:center;">
      Unallocated time is lost. Total: <span id="offline-total-time">${formatTime(seconds)}</span> / ${formatTime(seconds)}
    </div>`;

  document.getElementById('modal-offline').classList.add('visible');
}

function updateOfflineSlider(changed, max) {
  const seSlider = document.getElementById('offline-se-slider');
  const dmSlider = document.getElementById('offline-dm-slider');
  const cmSlider = document.getElementById('offline-cm-slider');
  if (!seSlider || !dmSlider || !cmSlider) return;

  let seVal = parseInt(seSlider.value);
  let dmVal = parseInt(dmSlider.value);
  let cmVal = parseInt(cmSlider.value);

  // Clamp so the total never exceeds max
  if (changed === 'se') {
    const remaining = max - seVal;
    if (dmVal + cmVal > remaining) {
      const ratio = remaining / (dmVal + cmVal);
      dmVal = Math.floor(dmVal * ratio);
      cmVal = remaining - dmVal;
    }
  } else if (changed === 'dm') {
    const remaining = max - dmVal;
    if (seVal + cmVal > remaining) {
      const ratio = remaining / (seVal + cmVal);
      seVal = Math.floor(seVal * ratio);
      cmVal = remaining - seVal;
    }
  } else if (changed === 'cm') {
    const remaining = max - cmVal;
    if (seVal + dmVal > remaining) {
      const ratio = remaining / (seVal + dmVal);
      seVal = Math.floor(seVal * ratio);
      dmVal = remaining - seVal;
    }
  }

  // Clamp to valid range
  seVal = Math.max(0, Math.min(max, seVal));
  dmVal = Math.max(0, Math.min(max, dmVal));
  cmVal = Math.max(0, Math.min(max, cmVal));

  seSlider.value = seVal;
  dmSlider.value = dmVal;
  cmSlider.value = cmVal;

  document.getElementById('offline-se-time').textContent = formatTime(seVal);
  document.getElementById('offline-dm-time').textContent = formatTime(dmVal);
  document.getElementById('offline-cm-time').textContent = formatTime(cmVal);

  document.getElementById('offline-se-yield').textContent = formatNum(Math.floor(calcSEPerTick() * seVal));
  document.getElementById('offline-dm-yield').textContent = formatNum(Math.floor(calcDMPerTick() * dmVal));
  document.getElementById('offline-cm-yield').textContent = formatNum(Math.floor(calcCMPerTick() * cmVal));

  document.getElementById('offline-total-time').textContent = formatTime(seVal + dmVal + cmVal);
}

function applyOfflineProgress() {
  const gs = gameState;
  const seSlider = document.getElementById('offline-se-slider');
  const dmSlider = document.getElementById('offline-dm-slider');
  const cmSlider = document.getElementById('offline-cm-slider');

  const seSecs = seSlider ? parseInt(seSlider.value) : gs.offlineTime;
  const dmSecs = dmSlider ? parseInt(dmSlider.value) : 0;
  const cmSecs = cmSlider ? parseInt(cmSlider.value) : 0;

  const seGain = Math.floor(calcSEPerTick() * seSecs);
  const dmGain = Math.floor(calcDMPerTick() * dmSecs);
  const cmGain = Math.floor(calcCMPerTick() * cmSecs);

  gs.soulEssence += seGain;
  gs.darkMana += dmGain;
  gs.corpseMatter += cmGain;
  gs.statistics.lifetime.soulEssenceEarned += seGain;
  gs.statistics.lifetime.darkManaEarned += dmGain;
  gs.statistics.lifetime.corpseMatterEarned += cmGain;
  gs.statistics.currentRun.soulEssenceEarned += seGain;
  gs.statistics.currentRun.darkManaEarned += dmGain;
  gs.statistics.currentRun.corpseMatterEarned += cmGain;
  gs.offlineTime = 0;

  document.getElementById('modal-offline').classList.remove('visible');

  const parts = [];
  if (seGain > 0) parts.push(`+${formatNum(seGain)} SE`);
  if (dmGain > 0) parts.push(`+${formatNum(dmGain)} DM`);
  if (cmGain > 0) parts.push(`+${formatNum(cmGain)} CM`);
  addLog(`Offline progress applied: ${parts.length ? parts.join(', ') : 'nothing allocated'}.`, 'system');
  updateUI();
}

// ---------- VARIANT MESSAGES ----------
function showVariantMessage() {
  const gs = gameState;
  const tier = getVariantTier();
  const msgs = CONFIG.VARIANT_MESSAGES[tier];
  if (!msgs) return;

  // Reset index if tier changed
  if (gs.variantTier !== tier) {
    gs.variantTier = tier;
    gs.variantMessageIndex = 0;
  }

  const msg = msgs[gs.variantMessageIndex % msgs.length];
  gs.variantMessageIndex = (gs.variantMessageIndex + 1) % msgs.length;

  const chapterTitle = `Cycle ${gs.grimoirePrestigeCount} — Tier ${tier} Mastery`;
  showStoryModal(chapterTitle, msg);
}

function getVariantTier() {
  const gs = gameState;
  const skills = gs.grimoireSkills;

  // Tier 5: all 3 non-final Tier 5 skills
  if (skills.deathsDominance && skills.undyingWill && skills.transcendentCommand) return 5;

  // Tier 4: first Tier 4 skill
  const tier4 = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === 4);
  if (tier4.some(s => skills[s.id])) return 4;

  // Tier 3
  const tier3 = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === 3);
  if (tier3.some(s => skills[s.id])) return 3;

  return 2;
}

// ============================================================
// UI MODULE — Rendering and display
// ============================================================

var logEntries = [];
var MAX_LOG = 80;

function addLog(text, type) {
  type = type || 'system';
  const entry = { text, type, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) };
  logEntries.unshift(entry);
  if (logEntries.length > MAX_LOG) logEntries.pop();

  if (currentTab === 'event-log') {
    renderEventLog();
  }
}

function renderEventLog() {
  const el = document.getElementById('tab-event-log');
  const currentCount = el.children.length;
  const targetCount = logEntries.length;

  if (currentCount === 0 || targetCount === 0) {
    // First render — build everything at once, no animation
    el.innerHTML = logEntries.map(e =>
      `<div class="log-entry log-entry-${e.type}">
        <span class="log-timestamp">${e.time}</span>${e.text}
      </div>`
    ).join('');
    return;
  }

  const newEntries = targetCount - currentCount;
  if (newEntries <= 0) return; // nothing to add

  // Prepend only the new entries (logEntries is newest-first)
  for (let i = newEntries - 1; i >= 0; i--) {
    const e = logEntries[i];
    const div = document.createElement('div');
    div.className = 'log-entry log-entry-' + e.type + ' log-new';
    div.innerHTML = '<span class="log-timestamp">' + e.time + '</span>' + e.text;
    el.insertBefore(div, el.firstChild);
    // Remove animation class after it finishes so it doesn't replay
    setTimeout(() => div.classList.remove('log-new'), 400);
  }

  // Trim excess entries from the bottom
  while (el.children.length > MAX_LOG) {
    el.removeChild(el.lastChild);
  }
}

function updateResourceDisplay() {
  const gs = gameState;
  const req = indexedDB.open('MalakarSaveDB', 1);
  req.onupgradeneeded = function(e) {
    e.target.result.createObjectStore('saves');
  };
  req.onsuccess = function(e) {
    db = e.target.result;
    if (callback) callback();
  };
  req.onerror = function() {
    console.warn('[Malakar] IndexedDB unavailable, using localStorage fallback.');
    db = null;
    if (callback) callback();
  };
}

function saveGame() {
  const gs = gameState;
  gs.lastSaveTimestamp = Date.now();
  const data = JSON.stringify(gs);

  if (db) {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put(data, 'slot1');
  } else {
    try { localStorage.setItem('malakar_save', data); } catch(e) {}
  }

  // Firebase cloud save (if signed in)
  firebaseSave(data);
}

function loadGame(callback) {
  if (db) {
    const tx = db.transaction('saves', 'readonly');
    const req = tx.objectStore('saves').get('slot1');
    req.onsuccess = function(e) {
      if (e.target.result) {
        applyLoadedState(JSON.parse(e.target.result));
      }
      if (callback) callback();
    };
    req.onerror = function() { if (callback) callback(); };
  } else {
    const raw = localStorage.getItem('malakar_save');
    if (raw) applyLoadedState(JSON.parse(raw));
    if (callback) callback();
  }
}

function applyLoadedState(saved) {
  // Deep merge — apply saved values over defaults to handle new fields
  const defaults = createDefaultState();

  // Migration: ensure all new fields exist
  const migrate = (def, src) => {
    const result = Object.assign({}, def);
    for (const key in src) {
      if (src[key] !== null && typeof src[key] === 'object' && !Array.isArray(src[key]) && typeof def[key] === 'object' && def[key] !== null && !Array.isArray(def[key])) {
        result[key] = migrate(def[key], src[key]);
      } else {
        result[key] = src[key];
      }
    }
    return result;
  };

  gameState = migrate(defaults, saved);

  // Ensure required new fields have defaults
  if (!gameState.pendingRaid) gameState.pendingRaid = null;
  if (!gameState.pendingRaidChoice) gameState.pendingRaidChoice = null;
  if (!gameState.raidArmySnapshot) gameState.raidArmySnapshot = null;
  if (!gameState.bossBattle.maxBossUnlocked) gameState.bossBattle.maxBossUnlocked = 0;
  if (!gameState.curses.corpseGratificationDiscovered) gameState.curses.corpseGratificationDiscovered = false;
  if (!gameState.curses.ruinousAmbitionDiscovered) gameState.curses.ruinousAmbitionDiscovered = false;
  if (!gameState.purchaseHistory) gameState.purchaseHistory = [];
  if (!gameState.raidSimLog) gameState.raidSimLog = [];
  if (!gameState.grimoirePrestigePendingSkills) gameState.grimoirePrestigePendingSkills = [];
  if (!gameState.raidDetails) gameState.raidDetails = null;

  // BUG FIX: Ensure tomeCaps exist (old saves won't have them)
  if (!gameState.tomeCaps) {
    gameState.tomeCaps = { tome1_binding: CONFIG.TOME_STARTING_CAP, tome2_sight: CONFIG.TOME_STARTING_CAP };
  }
}

function manualSave() {
  saveGame();
  addLog('Game saved. Your conquest is preserved.', 'system');
}

function manualLoad() {
  loadGame(() => {
    updateUI();
    updateCurseButtons();
    addLog('Game loaded.', 'system');
    if (gameState.grimoireUnlocked) {
      document.getElementById('btn-grimoire').classList.add('visible');
    }
    if (gameState.bossBattle.unlocked) {
      document.getElementById('tab-btn-boss').classList.remove('hidden');
    }
  });
}

// ---------- FIREBASE (Lazy-loaded) ----------
var firebaseApp = null;
var firebaseUser = null;

function initFirebase() {
  // Firebase is loaded lazily when sign-in is requested
  if (typeof firebase === 'undefined') {
    console.log('[Malakar] Firebase not loaded — cloud save disabled.');
    return;
  }
  try {
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp({
        apiKey: "PLACEHOLDER",
        authDomain: "PLACEHOLDER",
        projectId: "PLACEHOLDER",
      });
    }
    firebase.auth().onAuthStateChanged(user => {
      firebaseUser = user;
      const dot = document.getElementById('auth-dot');
      const signoutBtn = document.getElementById('btn-sign-out');
      const googleBtn = document.getElementById('btn-google-signin');
      if (user) {
        dot.classList.add('signed-in');
        signoutBtn.classList.remove('hidden');
        googleBtn.classList.add('hidden');
        addLog('Signed in: ' + user.email, 'system');
      } else {
        dot.classList.remove('signed-in');
        signoutBtn.classList.add('hidden');
        googleBtn.classList.remove('hidden');
      }
    });
  } catch(e) {
    console.warn('[Malakar] Firebase init error:', e);
  }
}

function firebaseSave(data) {
  if (!firebaseUser || typeof firebase === 'undefined') return;
  try {
    firebase.firestore().collection('saves').doc(firebaseUser.uid).set({ data, timestamp: Date.now() });
  } catch(e) {}
}

function googleSignIn() {
  if (typeof firebase === 'undefined') {
    showStoryModal('Cloud Save', 'Firebase not configured. Local save only. Your conquest remains local, worm.');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(e => console.warn(e));
}

function signOut() {
  if (typeof firebase !== 'undefined') firebase.auth().signOut();
}

// ============================================================
// EVENTS MODULE — Bootstrap + event wiring
// ============================================================

function wireEvents() {
