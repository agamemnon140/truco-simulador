/**
 * Ponto de entrada da CLI: configura a partida, conecta um observador que
 * renderiza os eventos no terminal e roda o jogo ate alguem fazer 12 pontos.
 */

import { MatchObserver, playMatch } from "../core/match.js";
import { closeIo, print } from "./io.js";
import { fmtCard, teamName } from "./render.js";
import { runSetup } from "./setup.js";

async function main(): Promise<void> {
  const { rules, players, names } = await runSetup();

  const observer: MatchObserver = {
    onHandStart({ handNumber, firstSeat }) {
      print(`\n\n######## MAO ${handNumber} — comeca ${names[firstSeat]} ########`);
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
        response === "accept"
          ? "aceitou"
          : response === "run"
            ? "correu"
            : "aumentou";
      print(`>> ${names[responder]} ${label}.`);
    },
    onVazaResolved({ vazaIndex, result }) {
      const who =
        result.winningTeam === null
          ? "empate"
          : teamName(result.winningTeam);
      print(`-- Vaza ${vazaIndex + 1}: ${who}`);
    },
    onScoreUpdate({ result, scores }) {
      if (result.winningTeam === null) {
        print(`== Mao anulada (empate total). ==`);
      } else {
        print(
          `== ${teamName(result.winningTeam)} venceu a mao (+${result.points}). ==`,
        );
      }
      print(
        `   Placar: ${scores.map((s, t) => `${teamName(t)} ${s}`).join("  |  ")}`,
      );
    },
    onMatchEnd({ winningTeam, scores }) {
      print("\n" + "=".repeat(60));
      print(`  🏆  ${teamName(winningTeam)} VENCEU A PARTIDA!`);
      print(`  Placar final: ${scores.map((s, t) => `${teamName(t)} ${s}`).join("  |  ")}`);
      print("=".repeat(60));
    },
  };

  try {
    await playMatch({ rules, players, observer });
  } finally {
    closeIo();
  }
}

main().catch((err) => {
  print(`Erro: ${err instanceof Error ? err.message : String(err)}`);
  closeIo();
  process.exitCode = 1;
});
