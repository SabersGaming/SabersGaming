'use strict';
// ============================================================
// SAVE — IndexedDB primary, localStorage fallback.
// Firebase REMOVED entirely.
// ============================================================

const DB_NAME    = 'MalakarDB';
const DB_VERSION = 2;
const STORE_NAME = 'saves';
const SAVE_KEY   = 'malakar_save';

let db = null;

function initDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) { resolve(false); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(true); };
    req.onerror   = ()  => { resolve(false); };
  });
}

function saveGame() {
  const gs   = gameState;
  gs.lastSaveTimestamp = Date.now();
  const data = JSON.stringify(gs);

  if (db) {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: SAVE_KEY, data });
  }

  try { localStorage.setItem(SAVE_KEY, data); } catch (e) { /* quota exceeded */ }
}

function loadGame() {
  return new Promise((resolve) => {
    if (db) {
      const tx    = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.get(SAVE_KEY);
      req.onsuccess = (e) => {
        if (e.target.result && e.target.result.data) {
          resolve(e.target.result.data);
        } else {
          resolve(loadFromLocalStorage());
        }
      };
      req.onerror = () => resolve(loadFromLocalStorage());
    } else {
      resolve(loadFromLocalStorage());
    }
  });
}

function loadFromLocalStorage() {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return null;
  }
}

function applyLoadedState(raw) {
  if (!raw) return false;
  try {
    const saved   = JSON.parse(raw);
    const fresh   = createDefaultState();
    const merged  = Object.assign(fresh, saved);
    // Ensure new fields added after a save exist
    if (!merged.corpseMatter)       merged.corpseMatter = 0;
    if (!merged.statistics)         merged.statistics = fresh.statistics;
    if (!merged.statistics.lifetime)merged.statistics.lifetime = fresh.statistics.lifetime;
    if (!merged.tomeUpgradePoints)  merged.tomeUpgradePoints = 0;
    if (!merged.tomeCaps)           merged.tomeCaps = fresh.tomeCaps;
    if (!merged.bossBattle)         merged.bossBattle = fresh.bossBattle;
    if (!merged.purchaseHistory)    merged.purchaseHistory = [];

    // Ensure grimoireSkills covers all defined skills
    for (const id of Object.keys(CONFIG.GRIMOIRE_SKILLS)) {
      if (merged.grimoireSkills[id] === undefined) merged.grimoireSkills[id] = false;
    }

    Object.assign(gameState, merged);
    return true;
  } catch (e) {
    console.error('[Save] Failed to parse save:', e);
    return false;
  }
}

function manualSave() {
  saveGame();
  addLog('Game saved manually. Your dark legacy is preserved.', 'system');
}

function manualLoad() {
  loadGame().then(raw => {
    if (applyLoadedState(raw)) {
      addLog('Game loaded from save. Continue the descent.', 'system');
      updateUI();
      handleOfflineProgress();
    } else {
      addLog('No save found, worm.', 'system');
    }
  });
}
