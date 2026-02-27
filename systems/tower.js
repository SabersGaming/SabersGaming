'use strict';
// ============================================================
// TOWER — Construction logic. Writes state. No DOM.
// ============================================================

function startFloorBuild() {
  const gs = gameState;
  const nextFloor = gs.tower.floorsBuilt;
  if (nextFloor >= CONFIG.TOWER_FLOORS.length) { addLog('The Black Tower is COMPLETE.', 'tower'); return; }
  if (gs.tower.isBuilding)                     { addLog('Construction already in progress.', 'system'); return; }

  const floorDef = CONFIG.TOWER_FLOORS[nextFloor];
  const wEq = CONFIG.WRAITH_EQUIV;
  const effectiveZ   = gs.units.zombie + (gs.grimoireSkills.armyDarkness ? gs.units.wraith * wEq.zombie : 0);
  const effectiveG   = gs.units.ghoul  + (gs.grimoireSkills.armyDarkness ? gs.units.wraith * wEq.ghoul  : 0);
  const effectiveGol = gs.units.golem  + (gs.grimoireSkills.armyDarkness ? gs.units.wraith * wEq.golem  : 0);

  if (effectiveZ < floorDef.requireZombie || effectiveG < floorDef.requireGhoul || effectiveGol < floorDef.requireGolem) {
    const msgs = CONFIG.TOWER_FAIL_MESSAGES;
    let msg;
    if (gs.units.zombie < 1) msg = randFrom(msgs.noZombies);
    else if (gs.units.ghoul < 1) msg = randFrom(msgs.noGhouls);
    else if (gs.units.golem < 1) msg = randFrom(msgs.noGolems);
    else msg = randFrom(msgs.random);
    addLog('Construction failed: ' + msg, 'tower');
    return;
  }

  if (gs.soulEssence < floorDef.costSE || gs.darkMana < floorDef.costDM || gs.corpseMatter < floorDef.costCM) {
    addLog('Insufficient resources for construction.', 'system');
    return;
  }

  gs.soulEssence  -= floorDef.costSE;
  gs.darkMana     -= floorDef.costDM;
  gs.corpseMatter -= floorDef.costCM;

  gs.tower.isBuilding         = true;
  gs.tower.buildFloor         = nextFloor + 1;
  gs.tower.buildTimeRemaining = floorDef.buildTime;
  gs.tower.buildTimeFull      = floorDef.buildTime;

  addLog(`Construction of Floor ${nextFloor + 1}: ${floorDef.name} has begun!`, 'tower');
}

function resolveFloorBuild() {
  const gs = gameState;
  const floorDef = CONFIG.TOWER_FLOORS[gs.tower.buildFloor - 1];
  gs.tower.isBuilding = false;

  if (roll(floorDef.failureChance)) {
    const failMsg = randFrom(CONFIG.TOWER_FAIL_MESSAGES.random);
    addLog(`Construction FAILED! ${failMsg}`, 'tower');
    showStoryModal("Construction Disaster", `Floor ${gs.tower.buildFloor}: ${floorDef.name} collapsed. Resources lost. ${failMsg}`);
  } else {
    gs.tower.floorsBuilt = gs.tower.buildFloor;
    if (gs.tower.floorsBuilt > gs.tower.maxFloorEver)            gs.tower.maxFloorEver = gs.tower.floorsBuilt;
    if (gs.tower.floorsBuilt > gs.statistics.lifetime.towerMaxFloor) gs.statistics.lifetime.towerMaxFloor = gs.tower.floorsBuilt;
    addLog(`Floor ${gs.tower.floorsBuilt}: ${floorDef.name} COMPLETE! ${floorDef.bonus}`, 'tower');
    showStoryModal(floorDef.name + ' — Constructed', floorDef.story);
  }
}
