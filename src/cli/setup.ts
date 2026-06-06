/**
 * Configuracao pre-partida: escolhe a variante, os nomes e quais assentos sao
 * humanos ou bots. No MVP o padrao e Truco Paulista (duplas) com todos humanos.
 */

import { RuleSet, TRUCO_PAULISTA, makeManoAMano, makeTrios } from "../core/rules.js";
import { assignTeams } from "../core/match.js";
import { Player } from "../players/player.js";
import { PERSONALITIES, getPersonality } from "../players/personalities.js";
import { HumanCliPlayer } from "../players/humanCli.js";
import { teamName } from "./render.js";
import { ask, print } from "./io.js";

export interface SetupResult {
  rules: RuleSet;
  players: Player[];
  names: string[];
}

/** Pergunta a variante/formato (duplas, mano a mano, trios). */
async function chooseRules(): Promise<RuleSet> {
  print("\nFormato da partida:");
  print("  [1] Duplas 2v2 (padrao)");
  print("  [2] Mano a mano 1v1");
  print("  [3] Trios 3v3");
  const input = (await ask("Escolha [1]: ")) || "1";
  if (input === "2") return makeManoAMano();
  if (input === "3") return makeTrios();
  return TRUCO_PAULISTA;
}

/** Configura todos os jogadores interativamente. */
export async function runSetup(): Promise<SetupResult> {
  print("=".repeat(60));
  print("           SIMULADOR DE TRUCO");
  print("=".repeat(60));

  const rules = await chooseRules();
  const teamOfSeat = assignTeams(rules);

  print(`\nVariante: ${rules.name} — ate ${rules.pointsToWin} pontos.`);
  print(
    "Para cada assento, escolha o tipo (h = humano, b = bot) e um nome.\n" +
      "Pressione Enter para aceitar os padroes (todos humanos).",
  );

  const names: string[] = [];
  const players: Player[] = [];

  for (let seat = 0; seat < rules.numPlayers; seat++) {
    const team = teamName(teamOfSeat[seat]!);
    const typeIn = (
      await ask(`Assento ${seat} (${team}) — tipo [h]: `)
    ).toLowerCase();
    const isBot = typeIn === "b" || typeIn === "bot";

    let personality = null as ReturnType<typeof getPersonality> | null;
    if (isBot) {
      print("  Inteligencia do bot:");
      PERSONALITIES.forEach((p, i) =>
        print(`    [${i}] ${p.label} — ${p.description}`),
      );
      const pickIn = await ask(`  Escolha [1 = ${PERSONALITIES[1]!.label}]: `);
      const idx = Number.parseInt(pickIn, 10);
      personality = PERSONALITIES[Number.isInteger(idx) ? idx : 1] ?? PERSONALITIES[1]!;
    }

    const defaultName = isBot ? `${personality!.label} ${seat}` : `Jogador ${seat}`;
    const nameIn = await ask(`Assento ${seat} — nome [${defaultName}]: `);
    const name = nameIn || defaultName;
    names.push(name);
    players.push(
      isBot ? personality!.create(name) : new HumanCliPlayer(name, names),
    );
  }

  // Os HumanCliPlayer compartilham o mesmo array `names` (preenchido acima).
  return { rules, players, names };
}
