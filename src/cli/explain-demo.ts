/**
 * Demo "explicar jogada": a Melhorada (equipe 1) joga contra o Inocente e, a
 * cada decisao dela, imprime as principais razoes (features que pesaram).
 *
 * Uso: npm run demo:explica
 */

import melhorada1 from "../genomes/melhorada_1.json";
import { MatchObserver, playMatch } from "../core/match.js";
import { TRUCO_PAULISTA } from "../core/rules.js";
import { BotPlayer } from "../players/bot.js";
import { EvolvedBotPlayer } from "../players/evolvedBot.js";
import {
  DecisionInfo,
  formatBetting,
  formatCardChoice,
} from "../players/explain.js";
import { parseGenome } from "../players/genome.js";
import { Player } from "../players/player.js";
import { seededRng } from "../training/rng.js";
import { print } from "./io.js";
import { fmtCard, teamName } from "./render.js";

const genome = parseGenome(melhorada1);
// Partida curta (ate 4 pontos) para a saida caber.
const rules = { ...TRUCO_PAULISTA, pointsToWin: 4 };
const names = ["Melhorada A1", "Inocente B1", "Melhorada A2", "Inocente B2"];

const onDecision = (info: DecisionInfo) => {
  if (info.raised) print(formatBetting(info.betting, info.name));
  else if (info.cardChoice) print(formatCardChoice(info.cardChoice, info.name));
};

const players: Player[] = names.map((n, seat) =>
  seat % 2 === 0
    ? new EvolvedBotPlayer(n, genome, seededRng(seat + 1), onDecision)
    : new BotPlayer(n),
);

const observer: MatchObserver = {
  onMatchStart() {
    print("=".repeat(64));
    print("  EXPLICAR JOGADA — Melhorada (Equipe 1) x Inocente (Equipe 2)");
    print("  Linhas [explica] mostram as 3 features que mais pesaram.");
    print("=".repeat(64));
  },
  onHandStart({ handNumber, firstSeat }) {
    print(`\n#### MAO ${handNumber} — comeca ${names[firstSeat]} ####`);
  },
  onDeal({ vira, manilha, hands }) {
    print(`Vira: ${fmtCard(vira)}  →  manilha: ${manilha}`);
    hands.forEach((h, seat) =>
      print(`   ${names[seat]!.padEnd(12)} ${h.map(fmtCard).join("  ")}`),
    );
  },
  onPlay({ seat, card }) {
    print(`   ${names[seat]!.padEnd(12)} joga ${fmtCard(card)}`);
  },
  onRaiseProposed(p) {
    print(`>> ${names[p.proposer]} pediu ${p.name.toUpperCase()} (vale ${p.value})`);
  },
  onRaiseResponse({ responder, response }) {
    const label = response === "accept" ? "aceitou" : response === "run" ? "correu" : "aumentou";
    print(`>> ${names[responder]} ${label}`);
  },
  onVazaResolved({ vazaIndex, result }) {
    const who = result.winningTeam === null ? "empate" : teamName(result.winningTeam);
    print(`   = Vaza ${vazaIndex + 1}: ${who}`);
  },
  onScoreUpdate({ result, scores }) {
    if (result.winningTeam !== null) {
      print(`== ${teamName(result.winningTeam)} +${result.points} ==`);
    }
    print(`   Placar: ${scores.map((s, t) => `${teamName(t)} ${s}`).join("  |  ")}`);
  },
  onMatchEnd({ winningTeam, scores }) {
    print(`\n🏆 ${teamName(winningTeam)} venceu (${scores.map((s, t) => `${teamName(t)} ${s}`).join("  |  ")})`);
  },
};

await playMatch({ rules, players, observer, rng: seededRng(2027) });
