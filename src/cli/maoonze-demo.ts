/**
 * Demo da MAO DE ONZE: mostra os dois casos comecando o placar perto do fim.
 *  1) Uma equipe com 11 (sem truco, mao vale 3, equipe de 11 joga ou corre).
 *  2) Ambas com 11 (mao "fechada"/as cegas, vale 1).
 *
 * Uso: npm run demo:onze
 */

import { MatchObserver, playMatch } from "../core/match.js";
import { TRUCO_PAULISTA } from "../core/rules.js";
import { BotPlayer } from "../players/bot.js";
import { print } from "./io.js";
import { fmtCard, teamName } from "./render.js";
import { Card } from "../core/types.js";

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const names = ["Ana (E1)", "Bruno (E2)", "Carla (E1)", "Diego (E2)"];
const fmtHand = (h: readonly Card[]) => h.map(fmtCard).join("  ");

function makeObserver(): MatchObserver {
  return {
    onHandStart({ handNumber, firstSeat }) {
      print("\n" + "═".repeat(64));
      print(`MAO ${handNumber}  —  comeca ${names[firstSeat]}`);
    },
    onMaoDeOnze({ mode, teamAt11, value }) {
      if (mode === "single") {
        print(`*** MAO DE ONZE: ${teamName(teamAt11!)} esta com 11. ` +
          `Sem truco; a mao vale ${value}. A dupla decide jogar ou correr. ***`);
      } else {
        print(`*** MAO DE ONZE 11x11: jogada FECHADA (as cegas), vale ${value}. ` +
          `Sem truco. ***`);
      }
    },
    onMaoDeOnzeDecision({ team, decision }) {
      print(`>>> ${teamName(team)} decidiu: ${decision === "play" ? "JOGAR" : "CORRER"}.`);
    },
    onDeal({ vira, manilha, hands }) {
      print(`Vira: ${fmtCard(vira)}  →  manilha: ${manilha}`);
      hands.forEach((h, seat) => print(`   ${names[seat]!.padEnd(11)} ${fmtHand(h)}`));
    },
    onPlay({ seat, card }) {
      print(`   ${names[seat]!.padEnd(11)} joga ${fmtCard(card)}`);
    },
    onVazaResolved({ vazaIndex, result }) {
      const who = result.winningTeam === null ? "EMPATE" : teamName(result.winningTeam);
      print(`   = Vaza ${vazaIndex + 1}: ${who}`);
    },
    onScoreUpdate({ result, scores }) {
      const motivo =
        result.reason === "fold"
          ? "adversario correu na mao de onze"
          : result.reason === "run"
            ? "adversario correu o truco"
            : result.reason === "cancelled"
              ? "mao anulada"
              : "venceu as vazas";
      const ganho =
        result.winningTeam === null
          ? "ninguem pontua"
          : `${teamName(result.winningTeam)} +${result.points}`;
      print(`>> ${ganho} (${motivo}).`);
      print(`   PLACAR: ${scores.map((s, t) => `${teamName(t)} ${s}`).join("   |   ")}`);
    },
    onMatchEnd({ winningTeam, scores }) {
      print("\n" + "█".repeat(64));
      print(`  ${teamName(winningTeam)} VENCEU  ` +
        `(${scores.map((s, t) => `${teamName(t)} ${s}`).join("  |  ")})`);
      print("█".repeat(64));
    },
  };
}

const players = names.map((n) => new BotPlayer(n));

print("\n##################  CASO 1: UMA EQUIPE COM 11 (11 x 9)  ##################");
await playMatch({
  rules: TRUCO_PAULISTA,
  players,
  observer: makeObserver(),
  rng: seededRng(101),
  initialScores: [11, 9],
});

print("\n\n##################  CASO 2: AMBAS COM 11 (11 x 11)  ##################");
await playMatch({
  rules: TRUCO_PAULISTA,
  players,
  observer: makeObserver(),
  rng: seededRng(202),
  initialScores: [11, 11],
});
