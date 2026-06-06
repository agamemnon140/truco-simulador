/**
 * Jogador humano via terminal. Renderiza o estado visivel e le a decisao.
 */

import { ask, print } from "../cli/io.js";
import {
  fmtCard,
  fmtHandWithIndices,
  renderTurnHeader,
  teamName,
} from "../cli/render.js";
import {
  Action,
  Player,
  PlayerView,
  Proposal,
  RaiseResponse,
} from "./player.js";

export class HumanCliPlayer implements Player {
  /**
   * @param name nome exibido
   * @param names nomes de todos os assentos (para render)
   */
  constructor(
    readonly name: string,
    private readonly names: readonly string[],
  ) {}

  async chooseAction(view: PlayerView, canRaise: boolean): Promise<Action> {
    // Pequena barreira para hotseat: passar o teclado ao jogador da vez.
    await ask(`\n>>> Vez de ${this.name}. Pressione Enter para ver suas cartas...`);
    print(renderTurnHeader(view, this.names));
    print(`Sua mao: ${fmtHandWithIndices(view.hand)}`);

    const hint = canRaise
      ? "Escolha a carta pelo numero, ou 't' para pedir truco/aumentar: "
      : "Escolha a carta pelo numero: ";

    for (;;) {
      const input = (await ask(hint)).toLowerCase();
      if (canRaise && (input === "t" || input === "truco")) {
        return { type: "raise" };
      }
      const idx = Number.parseInt(input, 10);
      if (Number.isInteger(idx) && idx >= 0 && idx < view.hand.length) {
        return { type: "play", card: view.hand[idx]! };
      }
      print("Entrada invalida. Tente de novo.");
    }
  }

  async respondToRaise(
    view: PlayerView,
    proposal: Proposal,
    canCounter: boolean,
  ): Promise<RaiseResponse> {
    await ask(`\n>>> ${this.name}, sua equipe precisa responder. Enter para ver...`);
    print(renderTurnHeader(view, this.names));
    print(
      `${this.names[proposal.proposer]} (${teamName(proposal.proposingTeam)}) ` +
        `pediu ${proposal.name.toUpperCase()} (vale ${proposal.value}).`,
    );
    print(`Sua mao: ${view.hand.map(fmtCard).join("  ")}`);

    const opts = canCounter
      ? "[a] aceitar   [c] correr   [r] aumentar: "
      : "[a] aceitar   [c] correr: ";

    for (;;) {
      const input = (await ask(opts)).toLowerCase();
      if (input === "a" || input === "aceitar") return "accept";
      if (input === "c" || input === "correr") return "run";
      if (canCounter && (input === "r" || input === "aumentar")) return "raise";
      print("Entrada invalida. Tente de novo.");
    }
  }
}
