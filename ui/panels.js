// ============================================================
// ui/panels.js — TAB PANEL RENDERERS
// Renders: Tower, Raid, Boss, Quests, Grimoire Codex, Stats tabs.
// PURE RENDER: reads state + config, writes innerHTML only.
// NO game logic. NO state writes. NO formula calculations.
// ============================================================
"use strict";

function renderTowerTab() {
  const gs = gameState;
  const floorsDisplay = document.getElementById('tower-floors-display');
  let html = '';
  for (let i = 0; i < CONFIG.TOWER_FLOORS.length; i++) {
    const fl = CONFIG.TOWER_FLOORS[i];
    const built = gs.tower.floorsBuilt > i;
    const isCurrent = gs.tower.isBuilding && gs.tower.buildFloor === i + 1;
    const classes = ['tower-floor', built ? 'built' : '', isCurrent ? 'current' : ''].filter(Boolean).join(' ');
    const status = built ? '✓ Built' : (isCurrent ? 'Building...' : 'Not built');
    html += `<div class="${classes}">
      <span class="tower-floor-num">F${i + 1}</span>
      <span class="tower-floor-name">${fl.name}</span>
      <span class="tower-floor-status">${status}</span>
    </div>`;
  }
  floorsDisplay.innerHTML = html;

  const buildSection = document.getElementById('tower-build-section');
  if (gs.tower.floorsBuilt >= CONFIG.TOWER_FLOORS.length) {
    buildSection.innerHTML = '<p class="text-gold text-center" style="font-family:var(--font-display);font-size:14px;">✦ The Black Tower Stands Complete ✦</p>';
    return;
  }

  if (gs.tower.isBuilding) {
    const pct = 1 - (gs.tower.buildTimeRemaining / gs.tower.buildTimeFull);
    const fl = CONFIG.TOWER_FLOORS[gs.tower.buildFloor - 1];
    buildSection.innerHTML = `
      <p style="text-align:center;color:var(--text-warning);font-size:13px;">Building Floor ${gs.tower.buildFloor}: ${fl.name}</p>
      <div class="tower-progress-bar"><div class="tower-progress-fill" style="width:${Math.round(pct * 100)}%"></div></div>
      <p style="text-align:center;font-size:12px;color:var(--text-dim);">${formatTime(gs.tower.buildTimeRemaining)} remaining</p>`;
  } else {
    const nextFloorIdx = gs.tower.floorsBuilt;
    const fl = CONFIG.TOWER_FLOORS[nextFloorIdx];
    buildSection.innerHTML = `
      <div class="raid-status-card">
        <div class="raid-target-name">Next: Floor ${nextFloorIdx + 1} — ${fl.name}</div>
        <p style="font-size:12px;color:var(--text-secondary);">Cost: ${formatNum(fl.costSE)} SE, ${fl.costDM} DM, ${fl.costCM} CM</p>
        <p style="font-size:12px;color:var(--text-secondary);">Requires: ${fl.requireZombie}Z, ${fl.requireGhoul}G, ${fl.requireGolem} Golems</p>
        <p style="font-size:12px;color:var(--text-secondary);">Build time: ${fl.buildTime}s | Failure chance: ${Math.round(fl.failureChance * 100)}%</p>
        <p style="font-size:12px;color:var(--text-necrotic);margin-top:4px;">Bonus: ${fl.bonus}</p>
        <button class="btn" style="margin-top:8px;" onclick="startFloorBuild()">Begin Construction</button>
      </div>`;
  }
}

// ---------- RAID TAB ----------
function renderRaidTab() {
  const gs = gameState;
  const el = document.getElementById('raid-content');

  if (gs.necromancyLevel < 10) {
    el.innerHTML = '<p class="text-dim text-italic" style="padding:20px;text-align:center;">Terror Raids unlock at Level 10. Keep ascending, worm.</p>';
    return;
  }

  if (!gs.raidActive && gs.raidCooldown <= 0) {
    const armyTotal = gs.units.zombie + gs.units.ghoul + gs.units.golem + gs.units.wraith;
    el.innerHTML = `<div class="raid-status-card">
      <div class="raid-target-name" style="color:var(--necrotic-bright);">Armies Ready</div>
      <p style="font-size:13px;color:var(--text-secondary);">Total forces: ${formatNum(armyTotal)} units | Army strength: ${formatNum(calcArmyStrength())}</p>
      <button class="btn btn-raid" style="margin-top:8px;" onclick="openRaidModal()">Launch Terror Raid</button>
    </div>`;
    return;
  }

  if (!gs.raidActive && gs.raidCooldown > 0) {
    el.innerHTML = `<div class="raid-status-card">
      <div class="raid-target-name" style="color:var(--text-secondary);">Recovering</div>
      <div class="raid-timer">${formatTime(gs.raidCooldown)}</div>
      <p style="font-size:12px;color:var(--text-dim);">The army recovers from the last raid...</p>
    </div>`;
    return;
  }

  // Active raid
  const rd = gs.raidDetails;
  const pct = gs.raidTimeRemaining / gs.raidTimeFull;
  const targetName = rd.type === 'standard'
    ? (CONFIG.RAID_TARGETS.find(t => t.id === rd.targetId) || {}).name || 'Unknown'
    : rd.nr.title;

  let simHtml = '';
  if (gs.raidSimLog && gs.raidSimLog.length > 0) {
    const visibleMsgs = gs.raidSimLog.slice(0, raidSimMsgIndex + 1);
    simHtml = `<div class="raid-sim-log">${visibleMsgs.map(m => `<div class="raid-sim-entry">⚔ ${m}</div>`).join('')}</div>`;
  }

  el.innerHTML = `<div class="raid-status-card raid-active-card">
    <div class="raid-target-name">Raiding: ${targetName}</div>
    <div class="raid-timer">${formatTime(gs.raidTimeRemaining)}</div>
    <div class="tower-progress-bar"><div class="tower-progress-fill" style="width:${Math.round((1 - pct) * 100)}%;background:linear-gradient(90deg,#cc8822,#ffaa44)"></div></div>
    <p style="font-size:12px;color:var(--text-dim);">
      Strategy: ${rd.strategyId || 'Special'} | 
      Retaliation: ${rd.retaliation !== undefined ? Math.round(rd.retaliation * 100) : '?'}%
    </p>
    ${simHtml}
  </div>`;
}

// ---------- BOSS TAB ----------
function renderBossTab() {
  const gs = gameState;
  const el = document.getElementById('boss-content');

  if (!gs.bossBattle.unlocked) {
    el.innerHTML = '<p class="text-dim text-italic" style="padding:20px;text-align:center;">Boss battles unlock after mastering a Tier 2 Grimoire skill.</p>';
    return;
  }

  if (gs.bossBattle.inBattle) {
    const bossIdx = gs.bossBattle.currentBoss;
    const isFinal = gs.bossBattle.isFinalBoss;
    const bossDef = isFinal ? CONFIG.FINAL_BOSS : CONFIG.BOSSES[bossIdx];

    const bossHPPct = gs.bossBattle.bossCurrentHP / gs.bossBattle.bossMaxHP;
    const playerHPPct = gs.bossBattle.playerCurrentHP / gs.bossBattle.playerMaxHP;

    // Combat skills available
    const availSkills = CONFIG.BOSS_COMBAT_SKILL_IDS.filter(sid => gs.grimoireSkills[sid]);
    const skillsHtml = availSkills.length === 0
      ? '<p class="text-dim text-italic">No combat skills mastered. Master Grimoire skills to fight.</p>'
      : availSkills.map(sid => {
          const sk = CONFIG.GRIMOIRE_SKILLS[sid];
          const cd = gs.bossBattle.skillCooldowns[sid] || 0;
          const disabled = cd > 0 ? 'disabled' : '';
          const cdText = cd > 0 ? ` (${cd}s)` : '';
          return `<button class="combat-skill-btn ${cd > 0 ? 'on-cooldown' : ''}" ${disabled} onclick="useBossSkill('${sid}')">
            ${sk.name}${cdText}
          </button>`;
        }).join('');

    el.innerHTML = `<div class="boss-card">
      <div class="boss-name">${bossDef.name}</div>
      <div class="boss-title">"${bossDef.title}"</div>
      <div class="boss-faction">${bossDef.faction}</div>

      <p style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">Boss HP:</p>
      <div class="boss-hp-bar"><div class="boss-hp-fill" style="width:${Math.round(bossHPPct * 100)}%"></div></div>
      <div class="boss-hp-text">${formatNum(gs.bossBattle.bossCurrentHP)} / ${formatNum(gs.bossBattle.bossMaxHP)}</div>

      <p style="font-size:12px;color:var(--text-dim);margin:8px 0 4px;">Your Army HP:</p>
      <div class="player-hp-bar"><div class="player-hp-fill" style="width:${Math.round(playerHPPct * 100)}%"></div></div>
      <div class="boss-hp-text" style="color:var(--necrotic-bright);">${formatNum(gs.bossBattle.playerCurrentHP)} / ${formatNum(gs.bossBattle.playerMaxHP)}</div>

      <div class="boss-combat-skills" style="margin-top:12px;">${skillsHtml}</div>
    </div>`;
    return;
  }

  // Not in battle
  const defeated = gs.bossBattle.defeatedBosses.length;
  const maxUnlocked = gs.bossBattle.maxBossUnlocked;

  let html = `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Champions defeated: ${defeated} / ${CONFIG.BOSSES.length + 1}</p>`;

  for (let i = 0; i < Math.min(maxUnlocked, CONFIG.BOSSES.length); i++) {
    const boss = CONFIG.BOSSES[i];
    const isDefeated = gs.bossBattle.defeatedBosses.includes(boss.id);
    const isCurrent = !isDefeated && i === gs.bossBattle.currentBoss;
    html += `<div class="boss-card" style="opacity:${isDefeated ? 0.5 : 1}">
      <div class="boss-name" style="font-size:13px;">${isDefeated ? '✓ ' : ''}${boss.name}</div>
      <div class="boss-title">"${boss.title}"</div>
      <div class="boss-faction">${boss.faction}</div>
      ${isCurrent && gs.bossBattle.retryTicks > 0 ? `<p style="font-size:12px;color:var(--text-warning);">Retry in: ${formatTime(gs.bossBattle.retryTicks)}</p>` : ''}
      ${isCurrent && gs.bossBattle.countdownTicks > 0 ? `<p style="font-size:12px;color:var(--text-gold);">Challenge begins in: ${formatTime(gs.bossBattle.countdownTicks)}</p>` : ''}
    </div>`;
  }

  // Final boss
  if (gs.grimoireSkills.finalAscension) {
    const isFinalDefeated = gs.bossBattle.defeatedBosses.includes('hope');
    html += `<div class="boss-card" style="border-color:var(--text-gold);${isFinalDefeated ? 'opacity:0.5' : ''}">
      <div class="boss-name" style="color:var(--text-gold);">${isFinalDefeated ? '✓ ' : '⚡ '}Hope, the Eternal Flame</div>
      <div class="boss-title">"The Final Reckoning"</div>
      <div class="boss-faction">Heaven</div>
    </div>`;
  }

  el.innerHTML = html;
}

// ---------- QUESTS TAB ----------
function renderQuestsTab() {
  const gs = gameState;
  const el = document.getElementById('quests-content');
  const categories = ['army', 'resource', 'progress', 'combat', 'tomes'];
  const catLabels = { army: 'Army', resource: 'Resources', progress: 'Progression', combat: 'Combat', tomes: 'Tomes' };
  const stats = gs.statistics.lifetime;

  let html = '';
  for (const cat of categories) {
    const quests = CONFIG.QUESTS.filter(q => q.category === cat);
    html += `<div class="quest-category-header">${catLabels[cat]}</div>`;
    for (const q of quests) {
      const completed = gs[q.id + '_completed'];
      const claimable = gs[q.id + '_claimable'];
      const val = Math.min(stats[q.targetStat] || 0, q.target);
      const classes = ['quest-item', completed ? 'completed' : '', claimable ? 'claimable' : ''].filter(Boolean).join(' ');
      html += `<div class="${classes}">
        <span class="quest-name">${q.name}</span>
        <span class="quest-progress">${formatNum(val)}/${formatNum(q.target)}</span>
        <span class="quest-reward">${q.reward} TUP</span>
        ${claimable ? `<button class="quest-claim-btn" onclick="claimQuest('${q.id}')">Claim!</button>` : ''}
        ${completed ? '<span style="color:var(--necrotic-bright);font-size:11px;">✓</span>' : ''}
      </div>`;
    }
  }

  el.innerHTML = html;
}

// ---------- GRIMOIRE CODEX TAB ----------
function renderGrimoireCodexTab() {
  const gs = gameState;
  const el = document.getElementById('grimoire-codex-content');
  const tiers = [1, 2, 3, 4, 5];
  let html = '';

  for (const tier of tiers) {
    const skills = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === tier);
    html += `<div class="grimoire-tier-label">Tier ${tier}</div>`;
    for (const sk of skills) {
      const owned = gs.grimoireSkills[sk.id];
      html += `<div class="skill-card ${owned ? 'unlocked' : 'locked'}">
        <div class="skill-name">${sk.name} ${owned ? '✓' : ''}</div>
        <div class="skill-effect">${sk.description}</div>
        <div class="skill-cost">${sk.costDM} DM + ${sk.costCM} CM</div>
        ${sk.conflictsWith.length > 0 ? `<div class="skill-conflict">Conflicts: ${sk.conflictsWith.join(', ')}</div>` : ''}
      </div>`;
    }
  }

  el.innerHTML = html;
}

// ---------- GRIMOIRE SELECTION MODAL ----------
function renderGrimoireSkills() {
  const gs = gameState;
  const container = document.getElementById('grimoire-skill-tiers');
  const tiers = [1, 2, 3, 4, 5];
  let html = '';

  for (const tier of tiers) {
    const skills = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === tier);

    // Check if tier is unlocked
    let tierLocked = false;
    if (tier > 1) {
      const prevTierOwned = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === tier - 1 && gs.grimoireSkills[s.id]).length;
      if (prevTierOwned < 4) tierLocked = true;
    }

    html += `<div class="grimoire-tier-label">Tier ${tier}${tierLocked ? ' — (Need 4 Tier ' + (tier-1) + ' skills)' : ''}</div>
      <div class="grimoire-skill-grid">`;

    for (const sk of skills) {
      const owned = gs.grimoireSkills[sk.id];
      const locked = tierLocked;
      const conflict = !owned && !locked && sk.conflictsWith.some(c => gs.grimoireSkills[c]);
      const canAfford = gs.darkMana >= sk.costDM && gs.corpseMatter >= sk.costCM;

      // finalAscension special requirement
      let finalLocked = false;
      if (sk.id === 'finalAscension' && !owned) {
        if (!gs.grimoireSkills.deathsDominance || !gs.grimoireSkills.undyingWill || !gs.grimoireSkills.transcendentCommand) {
          finalLocked = true;
        }
      }

      const classes = ['grimoire-skill-buy-card',
        owned ? 'owned' : '',
        (locked || finalLocked) ? 'locked' : '',
        conflict ? 'conflict' : '',
        (!owned && !locked && !conflict && !finalLocked && !canAfford) ? 'disabled' : ''
      ].filter(Boolean).join(' ');

      const costColor = canAfford ? 'var(--text-mana)' : 'var(--text-crimson)';
      html += `<div class="${classes}" ${!owned && !locked && !conflict && !finalLocked ? `onclick="buyGrimoireSkill('${sk.id}')"` : ''}>
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
}

// ---------- STATS TAB ----------
function renderStatsTab() {
  const gs = gameState;
  const lt = gs.statistics.lifetime;
  const cr = gs.statistics.currentRun;

  const statRow = (label, value) =>
    `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;

  const html = `
    <div class="stats-section-header">Current Run</div>
    ${statRow('SE Earned (run)', formatNum(cr.soulEssenceEarned))}
    ${statRow('DM Earned (run)', formatNum(cr.darkManaEarned))}
    ${statRow('CM Earned (run)', formatNum(cr.corpseMatterEarned))}
    ${statRow('Units Lost (run)', formatNum(cr.unitsLost || 0))}

    <div class="stats-section-header">Lifetime</div>
    ${statRow('Total Play Time', formatTime(lt.totalPlayTime))}
    ${statRow('SE Earned', formatNum(lt.soulEssenceEarned))}
    ${statRow('DM Earned', formatNum(lt.darkManaEarned))}
    ${statRow('CM Earned', formatNum(lt.corpseMatterEarned))}
    ${statRow('Zombies Raised', formatNum(lt.zombiesRaised))}
    ${statRow('Ghouls Raised', formatNum(lt.ghoulsRaised))}
    ${statRow('Golems Raised', formatNum(lt.golemsRaised))}
    ${statRow('Wraiths Raised', formatNum(lt.wraithsRaised))}
    ${statRow('Ascensions', lt.ascensionsPerformed)}
    ${statRow('Grimoire Prestiges', lt.grimoirePrestigeCount)}
    ${statRow('Raids Completed', lt.raidsCompleted)}
    ${statRow('Bosses Defeated', lt.bossesDefeated)}
    ${statRow('Tower Max Floor', lt.towerMaxFloor)}
    ${statRow('Binding Tomes', lt.tomeBindingPurchased)}
    ${statRow('Sight Tomes', lt.tomeSightPurchased)}
    ${statRow('Feast Cast', lt.cursescast_feast)}
    ${statRow('Corpse Grat Cast', lt.cursescast_corpse)}
    ${statRow('Ruinous Ambition Cast', lt.cursescast_ruinous)}
  `;

  document.getElementById('stats-content').innerHTML = html;
}
