'use strict';
// ============================================================
// UNITS — Purchasing and raising units. Writes state. No DOM.
// ============================================================

function buyUnit(type) {
  const gs = gameState;
  const skills = gs.grimoireSkills;

  if (type === 'zombie' && skills.sacrificeRavenous) { showStoryModal("Malakar Sneers", "I have SACRIFICED the zombie form. They are gone. Their essence fuels greater power now. I do not miss them."); return; }
  if (type === 'ghoul'  && skills.sacrificeEssence)  { showStoryModal("Malakar Sneers", "Ghouls? I surrendered them for a higher cause. The mana flows MORE freely without those whining specters."); return; }
  if (type === 'golem'  && skills.sacrificeCritical) { showStoryModal("Malakar Sneers", "The golems were sacrificed. Critical Dominion demanded it. The raids are MORE profitable."); return; }
  if (type === 'wraith' && !skills.armyDarkness)     { showStoryModal("Malakar Sneers", "Wraiths? You need the Army of Darkness grimoire skill to command wraiths, worm."); return; }

  let cap, costSE, costDM;
  switch (type) {
    case 'zombie': cap = calcZombieCap(); costSE = 10;   costDM = 0;   break;
    case 'ghoul':  cap = calcGhoulCap();  costSE = 100;  costDM = 10;  break;
    case 'golem':  cap = calcGolemCap();  costSE = 1000; costDM = 50;  break;
    case 'wraith': cap = calcWraithCap(); costSE = 5000; costDM = 100; break;
    default: return;
  }

  if (gs.units[type] >= cap)           { addLog('Unit cap reached, worm. Build more power first.', 'system'); return; }
  if (gs.soulEssence < costSE)         { addLog('Insufficient Soul Essence.', 'system'); return; }
  if (gs.darkMana    < costDM)         { addLog('Insufficient Dark Mana.', 'system'); return; }

  gs.soulEssence -= costSE;
  gs.darkMana    -= costDM;
  gs.units[type]++;

  const statKey = type + 'sRaised';
  gs.statistics.lifetime[statKey]++;
  gs.statistics.currentRun[statKey] = (gs.statistics.currentRun[statKey] || 0) + 1;

  addLog(`A ${CONFIG.UNITS[type].name} rises. The army grows.`, 'unit');
}

function raiseAllUndead() {
  const gs = gameState;
  const skills = gs.grimoireSkills;

  const types = [
    { type: 'zombie', cap: calcZombieCap(), costSE: 10,   costDM: 0,   blocked: skills.sacrificeRavenous },
    { type: 'ghoul',  cap: calcGhoulCap(),  costSE: 100,  costDM: 10,  blocked: skills.sacrificeEssence },
    { type: 'golem',  cap: calcGolemCap(),  costSE: 1000, costDM: 50,  blocked: skills.sacrificeCritical },
    { type: 'wraith', cap: calcWraithCap(), costSE: 5000, costDM: 100, blocked: !skills.armyDarkness },
  ];

  let raised = 0;
  for (const t of types) {
    if (t.blocked) continue;
    while (gs.units[t.type] < t.cap && gs.soulEssence >= t.costSE && gs.darkMana >= t.costDM) {
      gs.soulEssence -= t.costSE;
      gs.darkMana    -= t.costDM;
      gs.units[t.type]++;
      raised++;
      const statKey = t.type + 'sRaised';
      gs.statistics.lifetime[statKey]++;
      gs.statistics.currentRun[statKey] = (gs.statistics.currentRun[statKey] || 0) + 1;
    }
  }

  if (raised > 0) addLog(`Raised ${raised} undead. The army swells.`, 'unit');
  else            addLog('No units could be raised. Insufficient resources or all caps reached.', 'system');
}
