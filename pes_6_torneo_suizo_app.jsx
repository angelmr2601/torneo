import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Trophy, Swords, ListOrdered, RotateCcw, Save } from "lucide-react";

const STORAGE_KEY = "pes6-swiss-tournament-v1";
const DEFAULT_ROUNDS = 4; // buen número para 14 jugadores en suizo antes del top 8

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyStanding(player) {
  return {
    id: player.id,
    name: player.name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    buchholz: 0,
    opponents: [],
    hadBye: false,
  };
}

function getInitialState() {
  const players = Array.from({ length: 14 }).map((_, i) => ({
    id: uid(),
    name: `Jugador ${i + 1}`,
  }));

  return {
    config: {
      tournamentName: "Torneo PES6",
      swissRounds: DEFAULT_ROUNDS,
      knockoutSize: 8,
    },
    players,
    rounds: [],
    knockout: null,
  };
}

function sortStandings(standings) {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name, "es");
  });
}

function computeStandings(players, rounds) {
  const map = new Map(players.map((p) => [p.id, emptyStanding(p)]));

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (match.bye) {
        const st = map.get(match.player1Id);
        if (!st || !match.played) return;
        st.played += 1;
        st.wins += 1;
        st.points += 3;
        st.hadBye = true;
        return;
      }

      if (!match.played) return;
      const a = map.get(match.player1Id);
      const b = map.get(match.player2Id);
      if (!a || !b) return;

      a.played += 1;
      b.played += 1;
      a.gf += Number(match.score1 || 0);
      a.ga += Number(match.score2 || 0);
      b.gf += Number(match.score2 || 0);
      b.ga += Number(match.score1 || 0);
      a.gd = a.gf - a.ga;
      b.gd = b.gf - b.ga;
      a.opponents.push(match.player2Id);
      b.opponents.push(match.player1Id);

      const s1 = Number(match.score1 || 0);
      const s2 = Number(match.score2 || 0);
      if (s1 > s2) {
        a.wins += 1;
        b.losses += 1;
        a.points += 3;
      } else if (s2 > s1) {
        b.wins += 1;
        a.losses += 1;
        b.points += 3;
      } else {
        a.draws += 1;
        b.draws += 1;
        a.points += 1;
        b.points += 1;
      }
    });
  });

  // Buchholz = suma de puntos de los rivales jugados
  for (const st of map.values()) {
    st.buchholz = st.opponents.reduce((sum, oppId) => sum + (map.get(oppId)?.points || 0), 0);
    st.gd = st.gf - st.ga;
  }

  return sortStandings(Array.from(map.values()));
}

function havePlayedTogether(rounds, aId, bId) {
  return rounds.some((round) =>
    round.matches.some(
      (m) =>
        !m.bye &&
        ((m.player1Id === aId && m.player2Id === bId) || (m.player1Id === bId && m.player2Id === aId))
    )
  );
}

function generateSwissPairings(players, rounds) {
  const standings = computeStandings(players, rounds);
  const grouped = new Map();

  standings.forEach((p) => {
    const key = p.points;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(p);
  });

  const scoreGroups = [...grouped.keys()].sort((a, b) => b - a);
  let ordered = [];
  scoreGroups.forEach((score) => {
    ordered = ordered.concat(grouped.get(score));
  });

  const matches = [];
  let pool = [...ordered];

  // bye para el último clasificado sin bye si cantidad impar
  if (pool.length % 2 === 1) {
    let byeIndex = [...pool]
      .reverse()
      .findIndex((p) => !p.hadBye);
    if (byeIndex === -1) byeIndex = 0;
    byeIndex = pool.length - 1 - byeIndex;
    const byePlayer = pool.splice(byeIndex, 1)[0];
    matches.push({
      id: uid(),
      player1Id: byePlayer.id,
      player2Id: null,
      score1: 1,
      score2: 0,
      played: true,
      bye: true,
    });
  }

  const used = new Set();

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    if (used.has(a.id)) continue;

    let opponent = null;
    for (let j = i + 1; j < pool.length; j++) {
      const b = pool[j];
      if (used.has(b.id)) continue;
      if (!havePlayedTogether(rounds, a.id, b.id)) {
        opponent = b;
        break;
      }
    }

    if (!opponent) {
      for (let j = i + 1; j < pool.length; j++) {
        const b = pool[j];
        if (!used.has(b.id)) {
          opponent = b;
          break;
        }
      }
    }

    if (opponent) {
      used.add(a.id);
      used.add(opponent.id);
      matches.push({
        id: uid(),
        player1Id: a.id,
        player2Id: opponent.id,
        score1: "",
        score2: "",
        played: false,
        bye: false,
      });
    }
  }

  return {
    roundNumber: rounds.length + 1,
    matches,
  };
}

function seedKnockout(standings, size) {
  const qualified = standings.slice(0, size);
  const pairings = [];
  for (let i = 0; i < size / 2; i++) {
    pairings.push({
      id: uid(),
      player1Id: qualified[i]?.id || null,
      player2Id: qualified[size - 1 - i]?.id || null,
      score1: "",
      score2: "",
      played: false,
    });
  }

  return {
    qualified,
    rounds: [
      { name: size === 8 ? "Cuartos" : "Eliminatoria", matches: pairings },
      { name: "Semifinales", matches: [] },
      { name: "Final", matches: [] },
      { name: "3º puesto", matches: [] },
    ],
  };
}

function getMatchWinner(match) {
  if (!match.played) return null;
  const s1 = Number(match.score1);
  const s2 = Number(match.score2);
  if (s1 === s2) return null;
  return s1 > s2 ? match.player1Id : match.player2Id;
}

function getMatchLoser(match) {
  if (!match.played) return null;
  const s1 = Number(match.score1);
  const s2 = Number(match.score2);
  if (s1 === s2) return null;
  return s1 > s2 ? match.player2Id : match.player1Id;
}

function advanceKnockout(knockout) {
  const next = JSON.parse(JSON.stringify(knockout));
  const [qf, sf, finalRound, thirdPlace] = next.rounds;

  if (qf.matches.length && qf.matches.every((m) => getMatchWinner(m))) {
    const winners = qf.matches.map(getMatchWinner);
    const losers = qf.matches.map(getMatchLoser);
    if (sf.matches.length === 0) {
      sf.matches = [
        { id: uid(), player1Id: winners[0], player2Id: winners[3], score1: "", score2: "", played: false },
        { id: uid(), player1Id: winners[1], player2Id: winners[2], score1: "", score2: "", played: false },
      ];
    }
    if (!thirdPlace.sourceQFLosers) thirdPlace.sourceQFLosers = losers;
  }

  if (sf.matches.length && sf.matches.every((m) => getMatchWinner(m))) {
    const winners = sf.matches.map(getMatchWinner);
    const losers = sf.matches.map(getMatchLoser);
    finalRound.matches = [
      { id: uid(), player1Id: winners[0], player2Id: winners[1], score1: "", score2: "", played: false },
    ];
    thirdPlace.matches = [
      { id: uid(), player1Id: losers[0], player2Id: losers[1], score1: "", score2: "", played: false },
    ];
  }

  return next;
}

function PlayerName({ id, playersMap }) {
  return <span>{playersMap.get(id)?.name || "—"}</span>;
}

function MatchEditor({ match, playersMap, onChange, forceWinner = false }) {
  const p1 = playersMap.get(match.player1Id)?.name || "—";
  const p2 = playersMap.get(match.player2Id)?.name || "—";

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 items-center rounded-2xl border p-3">
      <div className="font-medium">{p1}</div>
      <Input
        type="number"
        min="0"
        className="w-20"
        value={match.score1}
        onChange={(e) => onChange({ ...match, score1: e.target.value })}
      />
      <div className="text-center text-sm text-slate-500">vs</div>
      <Input
        type="number"
        min="0"
        className="w-20"
        value={match.score2}
        onChange={(e) => onChange({ ...match, score2: e.target.value })}
      />
      <div className="font-medium md:text-right">{p2}</div>

      <div className="md:col-span-5 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={match.played}
            onChange={(e) => onChange({ ...match, played: e.target.checked })}
          />
          Partido jugado
        </label>
        {forceWinner && match.played && Number(match.score1) === Number(match.score2) && (
          <Badge variant="destructive">En eliminatorias no puede haber empate</Badge>
        )}
      </div>
    </div>
  );
}

export default function Pes6SwissTournamentApp() {
  const [state, setState] = useState(getInitialState());
  const [newPlayer, setNewPlayer] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const playersMap = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players]);
  const standings = useMemo(() => computeStandings(state.players, state.rounds), [state.players, state.rounds]);
  const swissFinished = state.rounds.length >= state.config.swissRounds && state.rounds.every((r) => r.matches.every((m) => m.played));

  const currentRound = state.rounds[state.rounds.length - 1] || null;
  const nextPendingRoundAvailable = currentRound ? currentRound.matches.every((m) => m.played) : true;

  function updateConfig(key, value) {
    setState((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  }

  function updatePlayer(id, name) {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  }

  function addPlayer() {
    if (!newPlayer.trim()) return;
    setState((prev) => ({
      ...prev,
      players: [...prev.players, { id: uid(), name: newPlayer.trim() }],
    }));
    setNewPlayer("");
  }

  function removePlayer(id) {
    if (state.rounds.length > 0) return;
    setState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== id),
    }));
  }

  function createNextSwissRound() {
    if (state.players.length < 4) return;
    if (!nextPendingRoundAvailable) return;
    if (state.rounds.length >= state.config.swissRounds) return;

    const newRound = generateSwissPairings(state.players, state.rounds);
    setState((prev) => ({
      ...prev,
      rounds: [...prev.rounds, newRound],
    }));
  }

  function updateSwissMatch(roundIndex, updatedMatch) {
    setState((prev) => ({
      ...prev,
      rounds: prev.rounds.map((round, i) =>
        i === roundIndex
          ? {
              ...round,
              matches: round.matches.map((m) => (m.id === updatedMatch.id ? updatedMatch : m)),
            }
          : round
      ),
    }));
  }

  function createKnockout() {
    if (!swissFinished) return;
    const ko = seedKnockout(standings, state.config.knockoutSize);
    setState((prev) => ({ ...prev, knockout: ko }));
  }

  function updateKnockoutMatch(roundIndex, updatedMatch) {
    setState((prev) => {
      const updated = {
        ...prev.knockout,
        rounds: prev.knockout.rounds.map((round, i) =>
          i === roundIndex
            ? { ...round, matches: round.matches.map((m) => (m.id === updatedMatch.id ? updatedMatch : m)) }
            : round
        ),
      };
      return { ...prev, knockout: advanceKnockout(updated) };
    });
  }

  function resetAll() {
    const fresh = getInitialState();
    fresh.players = state.players.map((p) => ({ ...p }));
    setState(fresh);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.config.tournamentName.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result);
        setState(parsed);
      } catch {
        alert("Archivo no válido");
      }
    };
    reader.readAsText(file);
  }

  const podium = useMemo(() => {
    if (!state.knockout?.rounds?.[2]?.matches?.[0]?.played) return null;
    const finalMatch = state.knockout.rounds[2].matches[0];
    const thirdMatch = state.knockout.rounds[3]?.matches?.[0];
    return {
      champion: getMatchWinner(finalMatch),
      runnerUp: getMatchLoser(finalMatch),
      third: thirdMatch?.played ? getMatchWinner(thirdMatch) : null,
    };
  }, [state.knockout]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{state.config.tournamentName}</h1>
            <p className="text-slate-600">Gestor de torneo suizo para PES6 con clasificación y eliminatorias.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}><Save className="mr-2 h-4 w-4" />Exportar</Button>
            <label className="inline-flex cursor-pointer items-center rounded-2xl border bg-white px-4 py-2 text-sm font-medium shadow-sm">
              Importar
              <input type="file" accept="application/json" className="hidden" onChange={importData} />
            </label>
            <Button variant="destructive" onClick={resetAll}><RotateCcw className="mr-2 h-4 w-4" />Reiniciar torneo</Button>
          </div>
        </div>

        <Tabs defaultValue="config" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="config">Configuración</TabsTrigger>
            <TabsTrigger value="suizo">Rondas suizas</TabsTrigger>
            <TabsTrigger value="clasificacion">Clasificación</TabsTrigger>
            <TabsTrigger value="eliminatorias">Eliminatorias</TabsTrigger>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Configuración del torneo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nombre del torneo</Label>
                  <Input value={state.config.tournamentName} onChange={(e) => updateConfig("tournamentName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Rondas suizas</Label>
                  <Select value={String(state.config.swissRounds)} onValueChange={(v) => updateConfig("swissRounds", Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n} rondas</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tamaño eliminatorias</Label>
                  <Select value={String(state.config.knockoutSize)} onValueChange={(v) => updateConfig("knockoutSize", Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">Top 4</SelectItem>
                      <SelectItem value="8">Top 8</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Jugadores ({state.players.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input placeholder="Añadir jugador" value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} />
                  <Button onClick={addPlayer}>Añadir</Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {state.players.map((player) => (
                    <div key={player.id} className="flex items-center gap-2 rounded-2xl border bg-white p-3">
                      <Input value={player.name} onChange={(e) => updatePlayer(player.id, e.target.value)} />
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={state.rounds.length > 0}
                        onClick={() => removePlayer(player.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {state.rounds.length > 0 && (
                  <p className="text-sm text-amber-600">No se pueden borrar jugadores una vez empezado el torneo.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suizo" className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Gestión de rondas suizas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={createNextSwissRound} disabled={!nextPendingRoundAvailable || state.rounds.length >= state.config.swissRounds}>
                    <Swords className="mr-2 h-4 w-4" />
                    Generar siguiente ronda
                  </Button>
                  <Badge variant="secondary">Rondas creadas: {state.rounds.length} / {state.config.swissRounds}</Badge>
                </div>
                {!nextPendingRoundAvailable && <p className="text-sm text-slate-600">Termina la ronda actual para generar la siguiente.</p>}
                {state.rounds.length === 0 && <p className="text-sm text-slate-600">Todavía no hay rondas creadas.</p>}
              </CardContent>
            </Card>

            {state.rounds.map((round, roundIndex) => (
              <Card key={round.roundNumber} className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Ronda {round.roundNumber}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {round.matches.map((match) =>
                    match.bye ? (
                      <div key={match.id} className="rounded-2xl border border-dashed p-3 text-sm">
                        <span className="font-medium"><PlayerName id={match.player1Id} playersMap={playersMap} /></span> descansa y recibe victoria automática.
                      </div>
                    ) : (
                      <MatchEditor
                        key={match.id}
                        match={match}
                        playersMap={playersMap}
                        onChange={(updated) => updateSwissMatch(roundIndex, updated)}
                      />
                    )
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="clasificacion">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Clasificación general</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="p-2">#</th>
                        <th className="p-2">Jugador</th>
                        <th className="p-2">Pts</th>
                        <th className="p-2">PJ</th>
                        <th className="p-2">G</th>
                        <th className="p-2">E</th>
                        <th className="p-2">P</th>
                        <th className="p-2">GF</th>
                        <th className="p-2">GC</th>
                        <th className="p-2">DG</th>
                        <th className="p-2">Buchholz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, index) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="p-2 font-medium">{index + 1}</td>
                          <td className="p-2">{s.name}</td>
                          <td className="p-2 font-semibold">{s.points}</td>
                          <td className="p-2">{s.played}</td>
                          <td className="p-2">{s.wins}</td>
                          <td className="p-2">{s.draws}</td>
                          <td className="p-2">{s.losses}</td>
                          <td className="p-2">{s.gf}</td>
                          <td className="p-2">{s.ga}</td>
                          <td className="p-2">{s.gd}</td>
                          <td className="p-2">{s.buchholz}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="eliminatorias" className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Fase eliminatoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={createKnockout} disabled={!swissFinished || !!state.knockout}>
                    <Trophy className="mr-2 h-4 w-4" />
                    Generar eliminatorias
                  </Button>
                  {!swissFinished && <p className="text-sm text-slate-600">Las eliminatorias se desbloquean al terminar todas las rondas suizas.</p>}
                </div>

                {state.knockout && (
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-slate-100 p-4">
                      <div className="mb-2 font-semibold">Clasificados</div>
                      <div className="flex flex-wrap gap-2">
                        {state.knockout.qualified.map((p, i) => (
                          <Badge key={p.id} variant="secondary">#{i + 1} {p.name}</Badge>
                        ))}
                      </div>
                    </div>

                    {state.knockout.rounds.map((round, roundIndex) => (
                      <div key={round.name} className="space-y-3">
                        <h3 className="text-lg font-semibold">{round.name}</h3>
                        {round.matches.length === 0 ? (
                          <p className="text-sm text-slate-500">Pendiente de resultados previos.</p>
                        ) : (
                          round.matches.map((match) => (
                            <MatchEditor
                              key={match.id}
                              match={match}
                              playersMap={playersMap}
                              forceWinner
                              onChange={(updated) => updateKnockoutMatch(roundIndex, updated)}
                            />
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resumen" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="rounded-2xl shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle>Siguientes partidos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentRound?.matches?.some((m) => !m.played && !m.bye) ? (
                    currentRound.matches
                      .filter((m) => !m.played && !m.bye)
                      .map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-2xl border p-3">
                          <span><PlayerName id={m.player1Id} playersMap={playersMap} /></span>
                          <span className="text-slate-500">vs</span>
                          <span><PlayerName id={m.player2Id} playersMap={playersMap} /></span>
                        </div>
                      ))
                  ) : state.knockout ? (
                    state.knockout.rounds.flatMap((round) => round.matches.filter((m) => !m.played).map((m) => ({ ...m, roundName: round.name }))).length > 0 ? (
                      state.knockout.rounds.flatMap((round) => round.matches.filter((m) => !m.played).map((m) => ({ ...m, roundName: round.name }))).map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-2xl border p-3">
                          <div>
                            <div className="text-xs text-slate-500">{m.roundName}</div>
                            <div className="font-medium"><PlayerName id={m.player1Id} playersMap={playersMap} /> vs <PlayerName id={m.player2Id} playersMap={playersMap} /></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No hay partidos pendientes.</p>
                    )
                  ) : (
                    <p className="text-sm text-slate-500">No hay partidos pendientes.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Top actual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {standings.slice(0, Math.min(5, standings.length)).map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between rounded-2xl border p-3">
                      <div>
                        <div className="text-xs text-slate-500">#{i + 1}</div>
                        <div className="font-medium">{s.name}</div>
                      </div>
                      <Badge>{s.points} pts</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {podium && (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>Podio final</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-slate-500">Campeón</div>
                    <div className="text-lg font-bold"><PlayerName id={podium.champion} playersMap={playersMap} /></div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-slate-500">Subcampeón</div>
                    <div className="text-lg font-bold"><PlayerName id={podium.runnerUp} playersMap={playersMap} /></div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-slate-500">Tercero</div>
                    <div className="text-lg font-bold"><PlayerName id={podium.third} playersMap={playersMap} /></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Card className="rounded-2xl border-dashed bg-white/70 shadow-sm">
          <CardContent className="pt-6 text-sm text-slate-600">
            <div className="flex items-start gap-3">
              <ListOrdered className="mt-0.5 h-4 w-4" />
              <div className="space-y-1">
                <p>El sistema suizo empareja por puntos y evita repeticiones siempre que puede.</p>
                <p>La clasificación usa: puntos, Buchholz, diferencia de goles y goles a favor.</p>
                <p>Con 14 jugadores, 4 rondas suizas + Top 8 suele funcionar muy bien.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
