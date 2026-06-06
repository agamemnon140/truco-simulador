/**
 * Demo nao-interativa: roda uma partida 2v2 so com bots e renderiza no
 * terminal. Util para ver o fluxo completo sem precisar digitar.
 *
 * Uso: npm run demo
 */

import { MatchObserver, playMatch } from "../core/match.js";
import { TRUCO_PAULISTA } from "../core/rules.js";
import { BotPlayer } from "../players/bot.js";
import { print } from "./io.js";
import { fmtCard, teamName } from "./render.js";

const names = ["Bot A1", "Bot B1", "Bot A2", "Bot B2"];
const players = names.map((n) => new BotPlayer(n));

const observer: MatchObserver = {
  onHandStart({ handNumber, firstSeat }) {
    print(`\n#### MAO ${handNumber} — comeca ${names[firstSeat]} ####`);
  },
  onDeal({ vira, manilha }) {
    print(`Vira: ${fmtCard(vira)}  →  manilha e o ${manilha}.`);
  },
  onPlay({ seat, card }) {
    print(`   ${names[seat]} jogou ${fmtCard(card)}.`);
  },
  onRaiseProposed(p) {
    print(`>> ${names[p.proposer]} pediu ${p.name.toUpperCase()}! (vale ${p.value})`);
  },
  onRaiseResponse({ responder, response }) {
    const label =
      response === "accept" ? "aceitou" : response === "run" ? "correu" : "aumentou";
    print(`>> ${names[responder]} ${label}.`);
  },
  onVazaResolved({ vazaIndex, result }) {
    const who = result.winningTeam === null ? "empate" : teamName(result.winningTeam);
    print(`-- Vaza ${vazaIndex + 1}: ${who}`);
  },
  onScoreUpdate({ result, scores }) {
    if (result.winningTeam === null) print(`== Mao anulada. ==`);
    else print(`== ${teamName(result.winningTeam)} +${result.points}. ==`);
    print(`   Placar: ${scores.map((s, t) => `${teamName(t)} ${s}`).join("  |  ")}`);
  },
  onMatchEnd({ winningTeam, scores }) {
    print(`\n🏆 ${teamName(winningTeam)} venceu! ` +
      `(${scores.map((s, t) => `${teamName(t)} ${s}`).join("  |  ")})`);
  },
};

await playMatch({ rules: TRUCO_PAULISTA, players, observer });
