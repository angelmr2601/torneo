let players = [];
let scores = {};
let goals = {};
let conceded = {};
let matchesPlayed = {};
let round = 0;
let currentMatches = [];

function initTournament() {
  players = document.getElementById("players").value
    .split("\n")
    .map(p => p.trim())
    .filter(p => p);

  players.forEach(p => {
    scores[p] = 0;
    goals[p] = 0;
    conceded[p] = 0;
    matchesPlayed[p] = [];
  });

  round = 0;
  nextRound();
}

function nextRound() {
  round++;
  document.getElementById("roundTitle").innerText = "Ronda " + round;

  let available = [...players].sort((a, b) => scores[b] - scores[a]);
  currentMatches = [];

  while (available.length > 1) {
    let p1 = available.shift();
    let idx = available.findIndex(p => !matchesPlayed[p1].includes(p));

    if (idx === -1) idx = 0;

    let p2 = available.splice(idx, 1)[0];
    currentMatches.push([p1, p2]);
  }

  renderMatches();
}

function renderMatches() {
  let container = document.getElementById("matches");
  container.innerHTML = "";

  currentMatches.forEach((m, i) => {
    container.innerHTML += `
      <div class="match">
        ${m[0]} <input id="a${i}" type="number"> -
        <input id="b${i}" type="number"> ${m[1]}
        <button onclick="saveResult(${i})">OK</button>
      </div>
    `;
  });
}

function saveResult(i) {
  let p1 = currentMatches[i][0];
  let p2 = currentMatches[i][1];

  let g1 = parseInt(document.getElementById("a" + i).value);
  let g2 = parseInt(document.getElementById("b" + i).value);

  if (isNaN(g1) || isNaN(g2)) return;

  goals[p1] += g1;
  goals[p2] += g2;
  conceded[p1] += g2;
  conceded[p2] += g1;

  if (g1 > g2) scores[p1] += 3;
  else if (g2 > g1) scores[p2] += 3;
  else {
    scores[p1] += 1;
    scores[p2] += 1;
  }

  matchesPlayed[p1].push(p2);
  matchesPlayed[p2].push(p1);

  updateTable();
}

function updateTable() {
  let table = players.map(p => ({
    name: p,
    pts: scores[p],
    diff: goals[p] - conceded[p],
    gf: goals[p]
  }));

  table.sort((a, b) =>
    b.pts - a.pts ||
    b.diff - a.diff ||
    b.gf - a.gf
  );

  let container = document.getElementById("table");
  container.innerHTML = table.map(p =>
    `${p.name} - ${p.pts} pts (DG: ${p.diff})`
  ).join("<br>");
}