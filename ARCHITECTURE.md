# Malakar's Descent — Modular Architecture

**Refactored per the Architect's Codex & Malakar Modular Incremental Engine Constitution**

---

## Directory Structure

```
/
├── index.html              Main entry point. HTML only — no logic.
├── styles.css              All CSS. No inline styles in JS.
├── ARCHITECTURE.md         This document.
│
├── data/
│   └── config.js           STATIC DATA ONLY. All game constants, unit definitions,
│                           boss stats, quest data, narrative content. No functions.
│                           No state references. If a value changes during play: state.js.
│
├── systems/
│   ├── state.js            CENTRALIZED STATE OWNER. gameState schema + runtime vars.
│   │                       No logic. No DOM. No formulas.
│   ├── helpers.js          Pure utilities: formatNum, roll, cap calculations.
│   │                       Read-only state access. No DOM. No writes.
│   ├── resources.js        Resource generation (SE, DM, CM). All production
│   │                       formulas live here in named helpers. Single multiplier pipeline.
│   ├── actions.js          Player actions: buyUnit, buyTome, ascension, curses, tower.
│   │                       Reads config + state. Writes only to its domain.
│   ├── progression.js      Unlock system, grimoire skills, quests.
│   │                       Single source of truth for what player has access to.
│   ├── combat.js           Raid logic + boss battle system.
│   │                       Reads boss data from config. Writes outcomes to state.
│   └── save.js             IndexedDB + Firebase persistence. Offline progress.
│                           Handles schema migration. Never modifies game logic.
│
└── ui/
    ├── display.js          updateUI() master render. Resource display. updateCurseButtons.
    │                       PURE RENDER — reads state, writes DOM. No logic. No formulas.
    ├── panels.js           Tab panel renderers (Tower, Raid, Boss, Quests, Grimoire, Stats).
    ├── modals.js           Shop modal, story modal, ticker rotation.
    └── init.js             wireEvents(), gameTick() loop, DOMContentLoaded bootstrap.
                            All addEventListener calls live here and nowhere else.
```

---

## The Five Laws (Prime Directive)

| Law | Implementation |
|-----|---------------|
| Scale infinitely | `formatNum()` handles 0 → billions. Extend with scientific notation as needed. |
| Govern growth | All cost curves in `helpers.js` named functions. All multipliers in single pipeline in `resources.js`. |
| Centralize state | `systems/state.js` owns `gameState`. No variable lives outside it. |
| Isolate logic | Each system file has a declared domain. Cross-module writes are forbidden. |
| Render passively | `ui/` files call `updateUI()` which reads state. UI never triggers mutations. |

---

## Tick Order — Deterministic and Inviolable

```
gameTick() in ui/init.js:
  1. GUARD     — if (gamePaused) return
  2. COMBAT    — tickBossBattle()
  3. RESOURCES — applyResourceTick()
  4. TOWER     — buildTimeRemaining countdown + resolveFloorBuild()
  5. RAID      — raidTimeRemaining countdown + resolveRaid()
  6. PROGRESSION — checkQuests(), showVariantMessage()
  7. SAVE      — saveGame() every AUTOSAVE_TICKS
  8. UI        — updateUI() — always last, always once
```

---

## Adding a New Feature — Checklist

Before implementation (solo or with AI collaborator):

- [ ] **Module assignment**: Which file owns this? Does it conflict with existing domains?
- [ ] **State declaration**: What new `gameState` fields are needed? Schema updated?
- [ ] **Formula isolation**: All scaling formulas in named helper functions?
- [ ] **Tick integrity**: No state mutation outside tick order? `updateUI()` called only once?
- [ ] **Dependency map**: No circular dependencies introduced?
- [ ] **Player feel**: Feedback proportional to significance? Next goal still visible?
- [ ] **Prestige safety**: If prestige-adjacent, does it call `resetRunState()`? Writes to `gameState.meta`?
- [ ] **Narrative fit**: Does the naming fit Malakar's fiction?

---

## Forbidden Practices

- ❌ Direct DOM manipulation in `systems/` files
- ❌ Logic or formulas inside `data/` files
- ❌ Prestige events without calling `resetRunState()`
- ❌ Cross-module state writes (resources.js does not write to combat state)
- ❌ Inline `onclick` attributes in HTML (all events wired in `ui/init.js`)
- ❌ Global variables outside `systems/state.js`
- ❌ Undocumented `gameState` schema changes
- ❌ UI files containing conditional game logic
- ❌ Multiple simultaneous system file modifications without a declared dependency map
