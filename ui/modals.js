'use strict';
// ============================================================
// MODALS — Story modal, grimoire skill rendering for modal.
// ============================================================

let storyCallback = null;

function showStoryModal(title, body, callback) {
  document.getElementById('modal-story-title').textContent = title;
  document.getElementById('modal-story-body').innerHTML = (body || '').replace(/\n/g, '<br>');
  storyCallback = callback || null;
  document.getElementById('modal-story').classList.add('visible');
}

function closeStoryModal() {
  document.getElementById('modal-story').classList.remove('visible');
  if (storyCallback) {
    const cb = storyCallback;
    storyCallback = null;
    cb();
  }
}

function renderGrimoireSkills() {
  const gs        = gameState;
  const container = document.getElementById('grimoire-skill-tiers');
  if (!container) return;
  let html = '';

  for (let tier = 1; tier <= 5; tier++) {
    const skills = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === tier);
    let tierLocked = false;
    if (tier > 1) {
      const prevOwned = Object.values(CONFIG.GRIMOIRE_SKILLS)
        .filter(s => s.tier === tier - 1 && gs.grimoireSkills[s.id]).length;
      if (prevOwned < 4) tierLocked = true;
    }

    html += `<div class="grimoire-tier-label">Tier ${tier}${tierLocked ? ` — (Need 4 Tier ${tier - 1} skills)` : ''}</div>
      <div class="grimoire-skill-grid">`;

    for (const sk of skills) {
      const owned      = gs.grimoireSkills[sk.id];
      const conflict   = !owned && !tierLocked && sk.conflictsWith.some(c => gs.grimoireSkills[c]);
      const finalLocked = sk.id === 'finalAscension' && !owned &&
        (!gs.grimoireSkills.deathsDominance || !gs.grimoireSkills.undyingWill || !gs.grimoireSkills.transcendentCommand);
      const canAfford  = gs.darkMana >= sk.costDM && gs.corpseMatter >= sk.costCM;
      const isLocked   = tierLocked || finalLocked;
      const cls = 'grimoire-skill-buy-card' +
        (owned      ? ' owned'    : '') +
        (isLocked   ? ' locked'   : '') +
        (conflict   ? ' conflict' : '') +
        (!owned && !isLocked && !conflict && !canAfford ? ' disabled' : '');

      const costColor = canAfford ? 'var(--text-mana)' : 'var(--text-crimson)';
      const clickable = !owned && !isLocked && !conflict;
      html += `<div class="${cls}" ${clickable ? `data-buy="${sk.id}"` : ''}>
        ${owned ? '<span class="skill-buy-owned-badge">OWNED</span>' : ''}
        <div class="skill-buy-name">${sk.name}</div>
        <div class="skill-buy-cost" style="color:${costColor}">${sk.costDM} DM + ${sk.costCM} CM</div>
        <div class="skill-buy-desc">${sk.description}</div>
        ${conflict ? '<div style="font-size:10px;color:var(--text-crimson);">⚔ Conflict</div>' : ''}
      </div>`;
    }
    html += '</div>';
  }

  container.innerHTML = html;

  // Wire purchase clicks (event-driven, no inline onclick)
  container.querySelectorAll('[data-buy]').forEach(card => {
    card.addEventListener('click', () => {
      buyGrimoireSkill(card.dataset.buy);
      // Refresh modal display and resource counters after purchase
      const gs = gameState;
      const dmEl = document.getElementById('grimoire-dm');
      const cmEl = document.getElementById('grimoire-cm');
      if (dmEl) dmEl.textContent = formatNum(gs.darkMana);
      if (cmEl) cmEl.textContent = formatNum(gs.corpseMatter);
      renderGrimoireSkills();
    });
  });
}
