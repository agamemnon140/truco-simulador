/**
 * Demo VERBOSA para teste/inspecao: mostra as cartas distribuidas a cada
 * jogador, a sequencia exata de jogadas, as apostas e o resultado de cada vaza.
 *
 * Usa um RNG deterministico (semente fixa) para ser reproduzivel.
 *
 * Uso: npm run demo:verbose
 */

import { MatchObserver, playMatch } from "../core/match.js";
import { TRUCO_PAULISTA, RuleSet } from "../core/rules.js";
import { assignTeams } from "../core/match.js";
import { BotPlayer } from "../players/bot.js";
import { print } from "./io.js";
import { fmtCard, teamName } from "./render.js";
import { Card } from "../core/types.js";

// RNG deterministico (LCG) para reproduzir sempre a mesma partida.
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Partida curta (ate 6 pontos) para a saida caber e ser facil de ler.
const rules: RuleSet = { ...TRUCO_PAULISTA, pointsToWin: 6 };
const names = ["Ana (E1)", "Bruno (E2)", "Carla (E1)", "Diego (E2)"];
const players = names.map((n) => new BotPlayer(n));
const teamOfSeat = assignTeams(rules);

let playSeq = 0; // numero sequencial da jogada dentro da vaza

const fmtHand = (h: readonly Card[]) => h.map(fmtCard).join("  ");

const observer: MatchObserver = {
  onHandStart({ handNumber, firstSeat }) {
    playSeq = 0; // zera a numeracao de jogadas no inicio de cada mao
    print("\n" + "═".repeat(64));
    print(`MAO ${handNumber}  —  quem comeca: ${names[firstSeat]}`);
    print("═".repeat(64));
  },
  onDeal({ vira, manilha, hands }) {
    print(`Vira: ${fmtCard(vira)}  →  a MANILHA desta mao e o "${manilha}".`);
    print("Cartas distribuidas:");
    hands.forEach((h, seat) => {
      print(`   ${names[seat]!.padEnd(11)} ${fmtHand(h)}`);
    });
    print("-".repeat(64));
  },
  onPlay({ seat, card, vazaIndex }) {
    if (playSeq === 0) print(`Vaza ${vazaIndex + 1}:`);
    playSeq++;
    print(`   (${playSeq}o) ${names[seat]!.padEnd(11)} joga  ${fmtCard(card)}`);
  },
  onRaiseProposed(p) {
    print(`   >>> ${names[p.proposer]} PEDE ${p.name.toUpperCase()} ` +
      `(mao passa a valer ${p.value}; se correrem, leva ${p.forfeitValue})`);
  },
  onRaiseResponse({ responder, response }) {
    const label =
      response === "accept" ? "ACEITA" : response === "run" ? "CORRE" : "AUMENTA";
    print(`   <<< ${names[responder]} ${label}`);
  },
  onVazaResolved({ vazaIndex, result }) {
    const who = result.winningTeam === null ? "EMPATE" : teamName(result.winningTeam);
    const lead = result.winningSeat === null ? "" : ` (lider: ${names[result.winningSeat]})`;
    print(`   = Resultado da vaza ${vazaIndex + 1}: ${who}${lead}`);
    playSeq = 0; // reseta a numeracao para a proxima vaza
  },
  onScoreUpdate({ result, scores }) {
    if (result.winningTeam === null) {
      print(`\n>> Mao ANULADA (empate total). Ninguem pontua.`);
    } else {
      const motivo = result.reason === "run" ? "adversario correu" : "venceu as vazas";
      print(`\n>> ${teamName(result.winningTeam)} ganha a mao (+${result.points}) — ${motivo}.`);
    }
    print(`   PLACAR: ${scores.map((s, t) => `${teamName(t)} ${s}`).join("   |   ")}`);
  },
  onMatchEnd({ winningTeam, scores }) {
    print("\n" + "█".repeat(64));
    print(`  ${teamName(winningTeam)} VENCEU A PARTIDA  ` +
      `(${scores.map((s, t) => `${teamName(t)} ${s}`).join("  |  ")})`);
    print("█".repeat(64));
  },
};

print("Jogadores e equipes:");
names.forEach((n, seat) => print(`   assento ${seat}: ${n} → ${teamName(teamOfSeat[seat]!)}`));
print(`Variante: ${rules.name} (ate ${rules.pointsToWin} pontos nesta demo)`);

await playMatch({ rules, players, observer, rng: seededRng(20260606) });
