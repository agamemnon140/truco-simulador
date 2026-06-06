/**
 * Utilidades para testes: RNG deterministico e um jogador "scriptado" que
 * sempre joga a carta de menor indice e responde de forma fixa ao truco.
 */

import { Rng } from "../src/core/deck.js";
import {
  Action,
  MaoDeOnzeContext,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  Proposal,
  RaiseResponse,
} from "../src/players/player.js";

/** RNG deterministico simples (LCG) para embaralhar de forma reproduzivel. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    // LCG (Numerical Recipes)
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Jogador automatico simples para testes: nunca pede truco e, ao ser trucado,
 * responde sempre com `defaultResponse` (default "accept"). Joga a primeira
 * carta da mao.
 */
export class ScriptedPlayer implements Player {
  constructor(
    readonly name: string,
    private readonly defaultResponse: RaiseResponse = "accept",
    private readonly onzeDecision: MaoDeOnzeDecision = "play",
  ) {}

  async chooseAction(view: PlayerView): Promise<Action> {
    return { type: "play", card: view.hand[0]! };
  }

  async respondToRaise(
    _view: PlayerView,
    _proposal: Proposal,
    canCounter: boolean,
  ): Promise<RaiseResponse> {
    if (this.defaultResponse === "raise" && !canCounter) return "accept";
    return this.defaultResponse;
  }

  async decideMaoDeOnze(
    _view: PlayerView,
    _ctx: MaoDeOnzeContext,
  ): Promise<MaoDeOnzeDecision> {
    return this.onzeDecision;
  }
}
