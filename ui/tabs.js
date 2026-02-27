'use strict';
// ============================================================
// TABS — Tab switching, event log, all tab render functions.
// Reads state. Writes DOM only. No formulas.
// ============================================================

const MAX_LOG_ENTRIES = 100;
let logEntries = [];

function addLog(msg, type) {
  const now  = new Date();
  const ts   = now.getHours().toString().padStart(2,'0') + ':' +
               now.getMinutes().toString().padStart(2,'0') + ':' +
               now.getSeconds().toString().padStart(2,'0');
  logEntries.unshift({ msg, type, ts, id: Date.now() + Math.random() });
  if (logEntries.length > MAX_LOG_ENTRIES) logEntries.pop();
}

function renderEventLog() {
  const el = document.getElementById('tab-event-log');
  if (!el) return;
  el.innerHTML = logEntries.slice(0, 50).map(e =>
    `<div class="log-entry log-entry-${e.type}">
      <span class="log-timestamp">${e.ts}</span>${e.msg}
    </div>`
  ).join('');
}

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('hidden', p.id !== 'tab-' + tabId);
  });
  updateUI();
}

// ---------- TOWER TAB ----------
function renderTowerTab() {
  const gs = gameState;
  const floorsDisplay = document.getElementById('tower-floors-display');
  let html = '';

  for (let i = 0; i < CONFIG.TOWER_FLOORS.length; i++) {
    const fl     = CONFIG.TOWER_FLOORS[i];
    const built  = gs.tower.floorsBuilt > i;
    const isCurr = gs.tower.isBuilding && gs.tower.buildFloor === i + 1;
    const cls    = 'tower-floor-card' + (built ? ' built' : '') + (isCurr ? ' building' : '');
    const status = built ? '✓ Built' : (isCurr ? 'Building...' : 'Not built');
    html += `<div class="${cls}">
      <span class="tower-floor-num">F${i+1}</span>
      <span class="tower-floor-name">${fl.name}</span>
      <span class="tower-floor-bonus" style="flex:1;font-size:11px;color:var(--text-necrotic);">${fl.bonus}</span>
      <span class="tower-floor-status">${status}</span>
    </div>`;
  }
  if (floorsDisplay) floorsDisplay.innerHTML = html;

  const buildSection = document.getElementById('tower-build-section');
  if (!buildSection) return;

  if (gs.tower.floorsBuilt >= CONFIG.TOWER_FLOORS.length) {
    buildSection.innerHTML = '<p class="text-gold text-center" style="font-family:var(--font-display);font-size:14px;">✦ The Black Tower Stands Complete ✦</p>';
    return;
  }

  if (gs.tower.isBuilding) {
    const pct = 1 - (gs.tower.buildTimeRemaining / gs.tower.buildTimeFull);
    const fl  = CONFIG.TOWER_FLOORS[gs.tower.buildFloor - 1];
    buildSection.innerHTML = `
      <p style="text-align:center;color:var(--text-warning);font-size:13px;">Building Floor ${gs.tower.buildFloor}: ${fl.name}</p>
      <div class="tower-progress-bar"><div class="tower-progress-fill" style="width:${Math.round(pct*100)}%"></div></div>
      <p style="text-align:center;font-size:12px;color:var(--text-dim);">${formatTime(gs.tower.buildTimeRemaining)} remaining</p>`;
  } else {
    const nextIdx = gs.tower.floorsBuilt;
    const fl      = CONFIG.TOWER_FLOORS[nextIdx];
    buildSection.innerHTML = `
      <div class="raid-status-card">
        <div class="raid-target-name">Next: Floor ${nextIdx+1} — ${fl.name}</div>
        <p style="font-size:12px;color:var(--text-secondary);">Cost: ${formatNum(fl.costSE)} SE, ${fl.costDM} DM, ${fl.costCM} CM</p>
        <p style="font-size:12px;color:var(--text-secondary);">Requires: ${fl.requireZombie}Z, ${fl.requireGhoul}G, ${fl.requireGolem} Golems</p>
        <p style="font-size:12px;color:var(--text-secondary);">Build time: ${fl.buildTime}s | Failure: ${Math.round(fl.failureChance*100)}%</p>
        <p style="font-size:12px;color:var(--text-necrotic);margin-top:4px;">Bonus: ${fl.bonus}</p>
        <button class="btn" id="btn-start-tower" style="margin-top:8px;">Begin Construction</button>
      </div>`;
    const btn = document.getElementById('btn-start-tower');
    if (btn) btn.addEventListener('click', startFloorBuild);
  }
}

// ---------- RAID TAB ----------
function renderRaidTab() {
  const gs = gameState;
  const el = document.getElementById('raid-content');
  if (!el) return;

  if (gs.necromancyLevel < 10) {
    el.innerHTML = '<p class="text-dim text-italic" style="padding:20px;text-align:center;">Terror Raids unlock at Level 10. Keep ascending, worm.</p>';
    return;
  }

  if (!gs.raidActive && gs.raidCooldown <= 0) {
    const armyTotal = gs.units.zombie + gs.units.ghoul + gs.units.golem + gs.units.wraith;
    el.innerHTML = `<div class="raid-status-card">
      <div class="raid-target-name" style="color:var(--necrotic-bright);">Armies Ready</div>
      <p style="font-size:13px;color:var(--text-secondary);">Total forces: ${formatNum(armyTotal)} | Strength: ${formatNum(calcArmyStrength())}</p>
      <button class="btn btn-raid" id="btn-launch-raid" style="margin-top:8px;">Launch Terror Raid</button>
    </div>`;
    const btn = document.getElementById('btn-launch-raid');
    if (btn) btn.addEventListener('click', openRaidModal);
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
  const rd      = gs.raidDetails;
  const pct     = gs.raidTimeRemaining / gs.raidTimeFull;
  const targetName = rd.type === 'standard'
    ? (CONFIG.RAID_TARGETS.find(t => t.id === rd.targetId) || {}).name || 'Unknown'
    : (rd.nr ? rd.nr.title : 'Narrative');

  const simLog = gs.raidSimLog || [];
  const visibleMsgs = simLog.slice(0, raidSimMsgIndex + 1);
  const simHtml = visibleMsgs.length > 0
    ? `<div class="raid-sim-log">${visibleMsgs.map(m => `<div class="raid-sim-entry">⚔ ${m}</div>`).join('')}</div>`
    : '';

  el.innerHTML = `<div class="raid-status-card raid-active-card">
    <div class="raid-target-name">Raiding: ${targetName}</div>
    <div class="raid-timer">${formatTime(gs.raidTimeRemaining)}</div>
    <div class="tower-progress-bar"><div class="tower-progress-fill" style="width:${Math.round((1-pct)*100)}%;background:linear-gradient(90deg,#cc8822,#ffaa44)"></div></div>
    <p style="font-size:12px;color:var(--text-dim);">Strategy: ${rd.strategyId || 'Special'} | Retaliation: ${rd.retaliation !== undefined ? Math.round(rd.retaliation*100) : '?'}%</p>
    ${simHtml}
  </div>`;
}

// ---------- BOSS TAB ----------
function renderBossTab() {
  const gs = gameState;
  const el = document.getElementById('boss-content');
  if (!el) return;

  if (!gs.bossBattle.unlocked) {
    el.innerHTML = '<p class="text-dim text-italic" style="padding:20px;text-align:center;">Boss battles unlock after mastering a Tier 2 Grimoire skill.</p>';
    return;
  }

  if (gs.bossBattle.inBattle) {
    const isFinal = gs.bossBattle.isFinalBoss;
    const bossDef = isFinal ? CONFIG.FINAL_BOSS : CONFIG.BOSSES[gs.bossBattle.currentBoss];
    const bossHPPct   = gs.bossBattle.bossCurrentHP   / gs.bossBattle.bossMaxHP;
    const playerHPPct = gs.bossBattle.playerCurrentHP / gs.bossBattle.playerMaxHP;

    const availSkills = CONFIG.BOSS_COMBAT_SKILL_IDS.filter(sid => gs.grimoireSkills[sid]);
    const skillsHtml  = availSkills.length === 0
      ? '<p class="text-dim text-italic">No combat skills mastered.</p>'
      : availSkills.map(sid => {
          const sk  = CONFIG.GRIMOIRE_SKILLS[sid];
          const cd  = gs.bossBattle.skillCooldowns[sid] || 0;
          return `<button class="combat-skill-btn${cd > 0 ? ' on-cooldown' : ''}" ${cd > 0 ? 'disabled' : ''} data-skill="${sid}">
            ${sk.name}${cd > 0 ? ` (${cd}s)` : ''}
          </button>`;
        }).join('');

    el.innerHTML = `<div class="boss-card">
      <div class="boss-name">${bossDef.name}</div>
      <div class="boss-title">"${bossDef.title}"</div>
      <div class="boss-faction">${bossDef.faction}</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:4px;">Boss HP:</p>
      <div class="boss-hp-bar"><div class="boss-hp-fill" style="width:${Math.round(bossHPPct*100)}%"></div></div>
      <div class="boss-hp-text">${formatNum(gs.bossBattle.bossCurrentHP)} / ${formatNum(gs.bossBattle.bossMaxHP)}</div>
      <p style="font-size:12px;color:var(--text-dim);margin:8px 0 4px;">Your Army HP:</p>
      <div class="player-hp-bar"><div class="player-hp-fill" style="width:${Math.round(playerHPPct*100)}%"></div></div>
      <div class="boss-hp-text" style="color:var(--necrotic-bright);">${formatNum(gs.bossBattle.playerCurrentHP)} / ${formatNum(gs.bossBattle.playerMaxHP)}</div>
      <div class="boss-combat-skills" style="margin-top:12px;">${skillsHtml}</div>
    </div>`;

    // Wire combat skill buttons (event-driven, no inline onclick)
    el.querySelectorAll('.combat-skill-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => useBossSkill(btn.dataset.skill));
    });
    return;
  }

  // Not in battle — boss list
  const defeated   = gs.bossBattle.defeatedBosses.length;
  const maxUnlocked = gs.bossBattle.maxBossUnlocked;
  let html = `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">Champions defeated: ${defeated} / ${CONFIG.BOSSES.length + 1}</p>`;

  for (let i = 0; i < Math.min(maxUnlocked, CONFIG.BOSSES.length); i++) {
    const boss      = CONFIG.BOSSES[i];
    const isDefeated = gs.bossBattle.defeatedBosses.includes(boss.id);
    const isCurrent = !isDefeated && i === gs.bossBattle.currentBoss;
    html += `<div class="boss-card" style="opacity:${isDefeated ? 0.5 : 1}">
      <div class="boss-name" style="font-size:13px;">${isDefeated ? '✓ ' : ''}${boss.name}</div>
      <div class="boss-title">"${boss.title}"</div>
      <div class="boss-faction">${boss.faction}</div>
      ${isCurrent && gs.bossBattle.retryTicks > 0   ? `<p style="font-size:12px;color:var(--text-warning);">Retry in: ${formatTime(gs.bossBattle.retryTicks)}</p>` : ''}
      ${isCurrent && gs.bossBattle.countdownTicks > 0 ? `<p style="font-size:12px;color:var(--text-gold);">Challenge begins in: ${formatTime(gs.bossBattle.countdownTicks)}</p>` : ''}
      ${isCurrent && !gs.bossBattle.retryTicks && !gs.bossBattle.countdownTicks ? `<button class="btn" style="margin-top:8px;" data-challenge="${i}">Challenge!</button>` : ''}
    </div>`;
  }

  if (gs.grimoireSkills.finalAscension) {
    const isFinalDefeated = gs.bossBattle.defeatedBosses.includes('hope');
    html += `<div class="boss-card" style="border-color:var(--text-gold);${isFinalDefeated ? 'opacity:0.5' : ''}">
      <div class="boss-name" style="color:var(--text-gold);">${isFinalDefeated ? '✓ ' : '⚡ '}Hope, the Eternal Flame</div>
      <div class="boss-title">"The Final Reckoning"</div>
      <div class="boss-faction">Heaven</div>
    </div>`;
  }

  el.innerHTML = html;

  // Wire challenge buttons
  el.querySelectorAll('[data-challenge]').forEach(btn => {
    btn.addEventListener('click', initiateBossChallenge);
  });
}

// ---------- QUESTS TAB ----------
function renderQuestsTab() {
  const gs      = gameState;
  const el      = document.getElementById('quests-content');
  if (!el) return;
  const stats   = gs.statistics.lifetime;
  const catLabels = { army: 'Army', resource: 'Resources', progress: 'Progression', combat: 'Combat', tomes: 'Tomes' };
  let html = '';

  for (const cat of Object.keys(catLabels)) {
    const quests = CONFIG.QUESTS.filter(q => q.category === cat);
    html += `<div class="quest-category-header">${catLabels[cat]}</div>`;
    for (const q of quests) {
      const completed = gs[q.id + '_completed'];
      const claimable = gs[q.id + '_claimable'];
      const val       = Math.min(stats[q.targetStat] || 0, q.target);
      const cls       = 'quest-item' + (completed ? ' completed' : '') + (claimable ? ' claimable' : '');
      html += `<div class="${cls}">
        <span class="quest-name">${q.name}</span>
        <span class="quest-progress">${formatNum(val)}/${formatNum(q.target)}</span>
        <span class="quest-reward">${q.reward} TUP</span>
        ${claimable ? `<button class="quest-claim-btn" data-quest="${q.id}">Claim!</button>` : ''}
        ${completed ? '<span style="color:var(--necrotic-bright);font-size:11px;">✓</span>' : ''}
      </div>`;
    }
  }

  el.innerHTML = html;

  el.querySelectorAll('.quest-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => claimQuest(btn.dataset.quest));
  });
}

// ---------- GRIMOIRE CODEX TAB ----------
function renderGrimoireCodexTab() {
  const gs = gameState;
  const el = document.getElementById('grimoire-codex-content');
  if (!el) return;
  let html = '';

  for (let tier = 1; tier <= 5; tier++) {
    const skills = Object.values(CONFIG.GRIMOIRE_SKILLS).filter(s => s.tier === tier);
    html += `<div class="grimoire-tier-label">Tier ${tier}</div>`;
    for (const sk of skills) {
      const owned = gs.grimoireSkills[sk.id];
      html += `<div class="skill-card ${owned ? 'unlocked' : 'locked'}">
        <div class="skill-name">${sk.name}${owned ? ' ✓' : ''}</div>
        <div class="skill-effect">${sk.description}</div>
        <div class="skill-cost">${sk.costDM} DM + ${sk.costCM} CM</div>
        ${sk.conflictsWith.length > 0 ? `<div class="skill-conflict">Conflicts: ${sk.conflictsWith.join(', ')}</div>` : ''}
      </div>`;
    }
  }

  el.innerHTML = html;
}

// ---------- STATS TAB ----------
function renderStatsTab() {
  const gs = gameState;
  const lt = gs.statistics.lifetime;
  const cr = gs.statistics.currentRun;
  const el = document.getElementById('stats-content');
  if (!el) return;

  const row = (label, value) =>
    `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div>`;

  el.innerHTML = `
    <div class="stats-section-header">Current Run</div>
    ${row('SE Earned (run)', formatNum(cr.soulEssenceEarned))}
    ${row('DM Earned (run)', formatNum(cr.darkManaEarned))}
    ${row('CM Earned (run)', formatNum(cr.corpseMatterEarned))}
    ${row('Units Lost (run)', formatNum(cr.unitsLost || 0))}
    <div class="stats-section-header">Lifetime</div>
    ${row('Total Play Time', formatTime(lt.totalPlayTime))}
    ${row('SE Earned', formatNum(lt.soulEssenceEarned))}
    ${row('DM Earned', formatNum(lt.darkManaEarned))}
    ${row('CM Earned', formatNum(lt.corpseMatterEarned))}
    ${row('Zombies Raised', formatNum(lt.zombiesRaised))}
    ${row('Ghouls Raised', formatNum(lt.ghoulsRaised))}
    ${row('Golems Raised', formatNum(lt.golemsRaised))}
    ${row('Wraiths Raised', formatNum(lt.wraithsRaised))}
    ${row('Ascensions', lt.ascensionsPerformed)}
    ${row('Grimoire Prestiges', lt.grimoirePrestigeCount)}
    ${row('Raids Completed', lt.raidsCompleted)}
    ${row('Bosses Defeated', lt.bossesDefeated)}
    ${row('Tower Max Floor', lt.towerMaxFloor)}
    ${row('Binding Tomes', lt.tomeBindingPurchased)}
    ${row('Sight Tomes', lt.tomeSightPurchased)}
  `;
}

// ---------- INFO TAB ----------
function renderInfoTab() {
  const el = document.getElementById('info-content');
  if (!el || el.childElementCount > 0) return; // Only render once

  const sections = [
    {
      title: 'Soul Essence',
      body: 'Your primary currency. Generated by your undead army each tick. Used to buy units, ascend, and launch raids.'
    },
    {
      title: 'Dark Mana',
      body: 'Generated by Tomes of Sight and Study actions. Used to buy units, tomes, and grimoire skills.'
    },
    {
      title: 'Corpse Matter',
      body: 'Generated slowly over time and via certain grimoire skills. Used in grimoire prestige. Rare and precious.'
    },
    {
      title: 'Dark Ascension',
      body: 'Spend a large amount of Soul Essence to level up. Each level increases your permanent production multiplier by 10%. Units reset (unless you have Eternal Legion).'
    },
    {
      title: 'Grimoire Prestige',
      body: 'Available at Level 20+. Spend Dark Mana and Corpse Matter on powerful permanent skills. Resets your run but keeps skills and tomes.'
    },
    {
      title: 'The Tower',
      body: 'Build floors of your Black Tower to gain permanent production bonuses. Each floor requires armies and resources, and has a chance of failure.'
    },
    {
      title: 'Raids',
      body: 'Unlock at Level 10. Send your army on raids for massive resource gains. Choose targets and strategies carefully — failure means losses.'
    },
    {
      title: 'Boss Battles',
      body: 'Unlock after mastering Tier 2 Grimoire skills. Use your combat skills to defeat the 15 champions of Brooklynia, then face Hope herself.'
    },
  ];

  let html = '';
  for (const s of sections) {
    html += `<div class="info-section">
      <div class="info-section-header" data-info="${s.title}">
        <span>${s.title}</span>
        <span class="info-section-toggle">+</span>
      </div>
      <div class="info-section-body">${s.body}</div>
    </div>`;
  }

  el.innerHTML = html;

  el.querySelectorAll('.info-section-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      hdr.parentElement.classList.toggle('open');
      hdr.querySelector('.info-section-toggle').textContent =
        hdr.parentElement.classList.contains('open') ? '−' : '+';
    });
  });
}
