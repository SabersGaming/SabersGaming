'use strict';
// ============================================================
// CURSES — Casting curses/spells. Writes state. No DOM.
// ============================================================

function castCurse(id) {
  const gs    = gameState;
  const curse = CONFIG.CURSES[id];

  if (id === 'feastOfSouls') {
    if (!gs.curses.feastOfSoulsUnlocked) return;
    if (gs.darkMana < curse.costDM) { addLog('Insufficient Dark Mana for Feast of Souls.', 'system'); return; }
    gs.darkMana -= curse.costDM;
    gs.curses.activeSpell  = 'feastOfSouls';
    gs.curses.spellDuration = curse.effectDuration;
    gs.statistics.lifetime.cursescast_feast++;
    addLog('FEAST OF SOULS! Soul Essence production DOUBLED for 60 seconds!', 'curse');
  }
  else if (id === 'corpseGratification') {
    if (!gs.curses.corpseGratificationUnlocked) return;
    if (gs.curses.corpseGratificationCooldown > 0) { addLog(`Corpse Gratification on cooldown: ${formatTime(gs.curses.corpseGratificationCooldown)}`, 'system'); return; }
    if (gs.soulEssence < curse.costSE) { addLog('Insufficient Soul Essence.', 'system'); return; }
    if (gs.darkMana    < curse.costDM) { addLog('Insufficient Dark Mana.', 'system'); return; }
    gs.soulEssence  -= curse.costSE;
    gs.darkMana     -= curse.costDM;
    gs.corpseMatter += curse.effectValue;
    gs.statistics.lifetime.cursescast_corpse++;
    gs.statistics.lifetime.corpseMatterEarned += curse.effectValue;
    gs.curses.corpseGratificationCooldown = curse.cooldown;
    addLog(`CORPSE GRATIFICATION! +${curse.effectValue} Corpse Matter ripped from the void!`, 'curse');
  }
  else if (id === 'ruinousAmbition') {
    if (!gs.curses.ruinousAmbitionUnlocked) return;
    if (gs.curses.ruinousAmbitionCooldown > 0) { addLog(`Ruinous Ambition on cooldown: ${formatTime(gs.curses.ruinousAmbitionCooldown)}`, 'system'); return; }
    if (gs.darkMana < curse.costDM) { addLog('Insufficient Dark Mana.', 'system'); return; }
    gs.darkMana -= curse.costDM;
    gs.curses.activeSpell  = 'ruinousAmbition';
    gs.curses.spellDuration = curse.effectDuration;
    gs.statistics.lifetime.cursescast_ruinous++;
    gs.curses.ruinousAmbitionCooldown = curse.cooldown;
    addLog('RUINOUS AMBITION! SE doubled, DM generation halved for 5 minutes!', 'curse');
  }
}
