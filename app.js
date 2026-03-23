(() => {
  const STORAGE_KEY = 'pes6_swiss_tournament_v1';

  const state = loadState() || {
    name: '',
    playerCount: 14,
    roundCount: 4,
    players: [],
    rounds: [],
    currentRoundIndex: 0,
    started: false
  };

  const els = {
    tournamentName: document.getElementById('tournamentName'),
    playerCount: document.getElementById('playerCount'),
    roundCount: document.getElementById('roundCount'),
    playersList: document.getElementById('playersList'),
    roundNav: document.getElementById('roundNav'),
    roundStatus: document.getElementById('roundStatus'),
    matches: document.getElementById('matches'),
    standingsBody: document.querySelector('#standingsTable tbody'),
    startBtn: document.getElementById('startBtn'),
    fillNamesBtn: document.getElementById('fillNamesBtn'),
    resetPlayersBtn: document.getElementById('resetPlayersBtn'),
    saveResultsBtn: document.getElementById('saveResultsBtn'),
    nextRoundBtn: document.getElementById('nextRoundBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importInput: document.getElementById('importInput'),
    newTournamentBtn: document.getElementById('newTournamentBtn')
  };

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function ensurePlayers() {
    const count = clamp(parseInt(state.playerCount, 10) || 14, 2, 64);
    if (!Array.isArray(state.players)) state.players = [];
    if (state.players.length < count) {
      for (let i = state.players.length; i < count; i++) {
        state.players.push({ id: uid(), name: `Jugador ${i + 1}` });
      }
    } else if (state.players.length > count) {
      state.players = state.players.slice(0, count);
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getCompletedRounds() {
    return state.rounds.filter(round => round.matches.every(m => isMatchComplete(m)));
  }

  function isMatchComplete(match) {
    return Number.isFinite(match.score1) && Number.isFinite(match.score2);
  }

  function getPlayerById(id) {
    return state.players.find(p => p.id === id);
  }

  function getOpponentsMap() {
    const map = {};
    for (const p of state.players) map[p.id] = new Set();
    for (const round of state.rounds) {
      for (const m of round.matches) {
        map[m.p1]?.add(m.p2);
        map[m.p2]?.add(m.p1);
      }
    }
    return map;
  }

  function computeStandings() {
    const table = state.players.map(p => ({
      id: p.id,
      name: p.name,
      pts: 0,
      pj: 0,
      g: 0,
      e: 0,
      pe: 0,
      gf: 0,
      gc: 0,
      dg: 0,
      opponents: []
    }));

    const byId = Object.fromEntries(table.map(r => [r.id, r]));

    for (const round of state.rounds) {
      for (const m of round.matches) {
        const a = byId[m.p1];
        const b = byId[m.p2];
        if (!a || !b) continue;
        a.opponents.push(b.name);
        b.opponents.push(a.name);
        if (!isMatchComplete(m)) continue;

        a.pj++; b.pj++;
        a.gf += m.score1; a.gc += m.score2;
        b.gf += m.score2; b.gc += m.score1;

        if (m.score1 > m.score2) {
          a.g++; b.pe++;
          a.pts += 3;
        } else if (m.score1 < m.score2) {
          b.g++; a.pe++;
          b.pts += 3;
        } else {
          a.e++; b.e++;
          a.pts += 1; b.pts += 1;
        }
      }
    }

    for (const r of table) r.dg = r.gf - r.gc;

    table.sort((x, y) =>
      y.pts - x.pts ||
      y.dg - x.dg ||
      y.gf - x.gf ||
      x.gc - y.gc ||
      x.name.localeCompare(y.name, 'es')
    );

    return table;
  }

  function renderPlayers() {
    ensurePlayers();
    els.playersList.innerHTML = '';
    state.players.forEach((p, idx) => {
      const line = document.createElement('div');
      line.className = 'player-line';
      line.innerHTML = `
        <div class="pill">${idx + 1}</div>
        <input value="${escapeHtml(p.name)}" data-player-id="${p.id}" class="player-name-input" />
        <button class="mini danger remove-player-btn" data-player-id="${p.id}" ${state.players.length <= 2 ? 'disabled' : ''}>Quitar</button>
      `;
      els.playersList.appendChild(line);
    });

    [...document.querySelectorAll('.player-name-input')].forEach(inp => {
      inp.addEventListener('input', e => {
        const player = getPlayerById(e.target.dataset.playerId);
        if (player) {
          player.name = e.target.value.trim() || 'Sin nombre';
          saveState();
          renderStandings();
          renderRounds();
        }
      });
    });

    [...document.querySelectorAll('.remove-player-btn')].forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.target.dataset.playerId;
        if (state.started) {
          alert('No puedes quitar jugadores con el torneo ya empezado.');
          return;
        }
        state.players = state.players.filter(p => p.id !== id);
        state.playerCount = state.players.length;
        syncConfigInputs();
        saveState();
        renderAll();
      });
    });
  }

  function renderStandings() {
    const rows = computeStandings();
    els.standingsBody.innerHTML = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="namecell">${escapeHtml(r.name)}</td>
        <td><strong>${r.pts}</strong></td>
        <td>${r.pj}</td>
        <td>${r.g}</td>
        <td>${r.e}</td>
        <td>${r.pe}</td>
        <td>${r.gf}</td>
        <td>${r.gc}</td>
        <td>${r.dg}</td>
        <td class="namecell muted">${escapeHtml(r.opponents.join(', '))}</td>
      </tr>
    `).join('');
  }

  function renderRounds() {
    els.roundNav.innerHTML = '';
    if (!state.rounds.length) {
      els.roundStatus.textContent = 'Todavía no hay rondas generadas.';
      els.matches.innerHTML = '';
      return;
    }

    state.rounds.forEach((round, idx) => {
      const btn = document.createElement('button');
      btn.className = 'mini ' + (idx === state.currentRoundIndex ? 'secondary' : 'ghost');
      btn.textContent = `Ronda ${idx + 1}`;
      btn.addEventListener('click', () => {
        state.currentRoundIndex = idx;
        saveState();
        renderRounds();
      });
      els.roundNav.appendChild(btn);
    });

    const current = state.rounds[state.currentRoundIndex];
    const completed = current.matches.filter(isMatchComplete).length;
    els.roundStatus.textContent = `Viendo ronda ${state.currentRoundIndex + 1}. Partidos completos: ${completed}/${current.matches.length}`;

    els.matches.innerHTML = current.matches.map((m, i) => {
      const p1 = getPlayerById(m.p1)?.name || 'Jugador';
      const p2 = getPlayerById(m.p2)?.name || 'Jugador';
      return `
        <div class="match">
          <div class="match-header">
            <strong>Partido ${i + 1}</strong>
            <span>${isMatchComplete(m) ? 'Resultado guardado' : 'Pendiente'}</span>
          </div>
          <div class="vs">
            <div class="name">${escapeHtml(p1)}</div>
            <input type="number" min="0" inputmode="numeric" data-match-id="${m.id}" data-side="1" value="${Number.isFinite(m.score1) ? m.score1 : ''}" />
            <div class="small">vs</div>
            <input type="number" min="0" inputmode="numeric" data-match-id="${m.id}" data-side="2" value="${Number.isFinite(m.score2) ? m.score2 : ''}" />
            <div class="name">${escapeHtml(p2)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function currentRoundComplete() {
    if (!state.rounds.length) return false;
    return state.rounds[state.currentRoundIndex].matches.every(isMatchComplete);
  }

  function updateCurrentRoundScoresFromUI() {
    const current = state.rounds[state.currentRoundIndex];
    if (!current) return;
    const inputs = [...els.matches.querySelectorAll('input[type="number"]')];
    const map = new Map(current.matches.map(m => [m.id, m]));
    for (const inp of inputs) {
      const match = map.get(inp.dataset.matchId);
      if (!match) continue;
      const val = inp.value.trim();
      const parsed = val === '' ? null : parseInt(val, 10);
      if (inp.dataset.side === '1') {
        match.score1 = Number.isFinite(parsed) ? parsed : null;
      } else {
        match.score2 = Number.isFinite(parsed) ? parsed : null;
      }
    }
  }

  function createRoundOne() {
    const shuffled = shuffle(state.players.map(p => p.id));
    const matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      matches.push({ id: uid(), p1: shuffled[i], p2: shuffled[i + 1], score1: null, score2: null });
    }
    return { id: uid(), matches };
  }

  function swissPairNextRound() {
    const standings = computeStandings();
    const opponentsMap = getOpponentsMap();
    const ids = standings.map(s => s.id);

    const pointsById = Object.fromEntries(standings.map(s => [s.id, s.pts]));

    function sortCandidates(remaining, anchorId) {
      return [...remaining].sort((a, b) => {
        const rematchA = opponentsMap[anchorId].has(a) ? 1 : 0;
        const rematchB = opponentsMap[anchorId].has(b) ? 1 : 0;
        const pointDiffA = Math.abs(pointsById[anchorId] - pointsById[a]);
        const pointDiffB = Math.abs(pointsById[anchorId] - pointsById[b]);
        return rematchA - rematchB || pointDiffA - pointDiffB;
      });
    }

    function backtrack(remaining) {
      if (!remaining.length) return [];
      const a = remaining[0];
      const rest = remaining.slice(1);
      const candidates = sortCandidates(rest, a);
      for (const b of candidates) {
        const newRemaining = rest.filter(id => id !== b);
        const sub = backtrack(newRemaining);
        if (sub) return [[a, b], ...sub];
      }
      return null;
    }

    let pairings = backtrack(ids);

    if (!pairings) {
      const rem = [...ids];
      pairings = [];
      while (rem.length) {
        const a = rem.shift();
        let bestIndex = 0;
        let bestScore = Infinity;
        for (let i = 0; i < rem.length; i++) {
          const b = rem[i];
          const score = (opponentsMap[a].has(b) ? 1000 : 0) + Math.abs(pointsById[a] - pointsById[b]);
          if (score < bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }
        const [b] = rem.splice(bestIndex, 1);
        pairings.push([a, b]);
      }
    }

    return {
      id: uid(),
      matches: pairings.map(([p1, p2]) => ({ id: uid(), p1, p2, score1: null, score2: null }))
    };
  }

  function canGenerateNextRound() {
    if (!state.started) return false;
    if (!state.rounds.length) return false;
    if (!currentRoundComplete()) return false;
    return state.rounds.length < state.roundCount;
  }

  function generateNextRound() {
    if (!canGenerateNextRound()) {
      if (state.rounds.length >= state.roundCount) {
        alert('Ya se han generado todas las rondas configuradas.');
      } else {
        alert('Completa todos los resultados de la ronda actual antes de generar la siguiente.');
      }
      return;
    }
    const next = swissPairNextRound();
    state.rounds.push(next);
    state.currentRoundIndex = state.rounds.length - 1;
    saveState();
    renderAll();
  }

  function startTournament() {
    updateConfigFromInputs();
    ensurePlayers();
    if (state.players.some(p => !p.name.trim())) {
      alert('Todos los jugadores deben tener nombre.');
      return;
    }
    if (state.players.length % 2 !== 0) {
      alert('Para esta versión hacen falta jugadores pares.');
      return;
    }
    state.started = true;
    state.rounds = [createRoundOne()];
    state.currentRoundIndex = 0;
    saveState();
    renderAll();
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const safeName = (state.name || 'torneo-pes6').toLowerCase().replace(/[^a-z0-9áéíóúüñ_-]+/gi, '-');
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported || !Array.isArray(imported.players)) throw new Error();
        Object.assign(state, imported);
        saveState();
        renderAll();
      } catch {
        alert('El archivo no parece un torneo válido.');
      }
    };
    reader.readAsText(file);
  }

  function resetTournament(confirmFull = true) {
    if (confirmFull && !confirm('Se borrará todo el torneo actual.')) return;
    state.name = '';
    state.playerCount = 14;
    state.roundCount = 4;
    state.players = [];
    state.rounds = [];
    state.currentRoundIndex = 0;
    state.started = false;
    ensurePlayers();
    saveState();
    renderAll();
  }

  function updateConfigFromInputs() {
    state.name = els.tournamentName.value.trim();
    state.playerCount = clamp(parseInt(els.playerCount.value, 10) || 14, 2, 64);
    state.roundCount = clamp(parseInt(els.roundCount.value, 10) || 4, 1, 12);
    ensurePlayers();
    saveState();
  }

  function syncConfigInputs() {
    els.tournamentName.value = state.name || '';
    els.playerCount.value = state.playerCount;
    els.roundCount.value = state.roundCount;
  }

  function fillQuickNames() {
    const base = ['Alex','Beni','Carlos','Dani','Eloy','Fede','Guille','Hugo','Iván','Javi','Kike','Luis','Mario','Nico'];
    state.playerCount = 14;
    state.players = base.map(n => ({ id: uid(), name: n }));
    syncConfigInputs();
    saveState();
    renderPlayers();
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderAll() {
    syncConfigInputs();
    ensurePlayers();
    renderPlayers();
    renderRounds();
    renderStandings();
    els.nextRoundBtn.disabled = !canGenerateNextRound();
    saveState();
  }

  els.tournamentName.addEventListener('input', updateConfigFromInputs);
  els.playerCount.addEventListener('change', () => {
    if (state.started) {
      syncConfigInputs();
      alert('No cambies el número de jugadores con el torneo empezado.');
      return;
    }
    updateConfigFromInputs();
    renderPlayers();
  });
  els.roundCount.addEventListener('change', () => {
    updateConfigFromInputs();
    renderAll();
  });

  els.fillNamesBtn.addEventListener('click', fillQuickNames);
  els.resetPlayersBtn.addEventListener('click', () => {
    if (state.started) {
      alert('No puedes regenerar jugadores con el torneo empezado.');
      return;
    }
    updateConfigFromInputs();
    state.players = [];
    ensurePlayers();
    saveState();
    renderPlayers();
  });
  els.startBtn.addEventListener('click', () => {
    if (state.started && !confirm('Ya hay un torneo iniciado. ¿Empezar de nuevo desde ronda 1?')) return;
    startTournament();
  });
  els.saveResultsBtn.addEventListener('click', () => {
    if (!state.rounds.length) {
      alert('Primero crea el torneo.');
      return;
    }
    updateCurrentRoundScoresFromUI();
    saveState();
    renderAll();
    alert('Resultados guardados.');
  });
  els.nextRoundBtn.addEventListener('click', () => {
    updateCurrentRoundScoresFromUI();
    generateNextRound();
  });
  els.exportBtn.addEventListener('click', exportJSON);
  els.importBtn.addEventListener('click', () => els.importInput.click());
  els.importInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) importJSON(file);
    e.target.value = '';
  });
  els.newTournamentBtn.addEventListener('click', () => resetTournament(true));

  ensurePlayers();
  renderAll();
})();