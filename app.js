let jugadores = [];
let puntos = {};
let goles = {};
let contra = {};
let enfrentamientos = {};
let ronda = 0;
let partidosActuales = [];

function crearTorneo() {
  jugadores = document.getElementById("playersInput").value
    .split("\n")
    .map(j => j.trim())
    .filter(j => j);

  if (jugadores.length % 2 !== 0) {
    alert("Debe haber número par de jugadores");
    return;
  }

  jugadores.forEach(j => {
    puntos[j] = 0;
    goles[j] = 0;
    contra[j] = 0;
    enfrentamientos[j] = [];
  });

  ronda = 0;
  generarRonda();
}

function generarRonda() {
  ronda++;

  document.getElementById("roundTitle").innerText = "Ronda " + ronda;

  let disponibles = [...jugadores].sort((a, b) => puntos[b] - puntos[a]);
  partidosActuales = [];

  while (disponibles.length > 1) {
    let j1 = disponibles.shift();
    let rivalIndex = disponibles.findIndex(j => !enfrentamientos[j1].includes(j));

    if (rivalIndex === -1) rivalIndex = 0;

    let j2 = disponibles.splice(rivalIndex, 1)[0];
    partidosActuales.push([j1, j2]);
  }

  mostrarPartidos();
}

function mostrarPartidos() {
  let cont = document.getElementById("matches");
  cont.innerHTML = "";

  partidosActuales.forEach((p, i) => {
    cont.innerHTML += `
      <div class="match">
        <span>${p[0]}</span>
        <input id="g1_${i}" type="number">
        <span>-</span>
        <input id="g2_${i}" type="number">
        <span>${p[1]}</span>
        <button onclick="guardarResultado(${i})">OK</button>
      </div>
    `;
  });
}

function guardarResultado(i) {
  let j1 = partidosActuales[i][0];
  let j2 = partidosActuales[i][1];

  let g1 = parseInt(document.getElementById(`g1_${i}`).value);
  let g2 = parseInt(document.getElementById(`g2_${i}`).value);

  if (isNaN(g1) || isNaN(g2)) return;

  goles[j1] += g1;
  goles[j2] += g2;
  contra[j1] += g2;
  contra[j2] += g1;

  if (g1 > g2) puntos[j1] += 3;
  else if (g2 > g1) puntos[j2] += 3;
  else {
    puntos[j1] += 1;
    puntos[j2] += 1;
  }

  enfrentamientos[j1].push(j2);
  enfrentamientos[j2].push(j1);

  actualizarTabla();
}

function actualizarTabla() {
  let tabla = jugadores.map(j => ({
    nombre: j,
    pts: puntos[j],
    dg: goles[j] - contra[j],
    gf: goles[j]
  }));

  tabla.sort((a, b) =>
    b.pts - a.pts ||
    b.dg - a.dg ||
    b.gf - a.gf
  );

  let cont = document.getElementById("standings");
  cont.innerHTML = "";

  tabla.forEach((j, i) => {
    cont.innerHTML += `
      <div class="standing">
        ${i + 1}. ${j.nombre} — ${j.pts} pts (DG: ${j.dg})
      </div>
    `;
  });
}