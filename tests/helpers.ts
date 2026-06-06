/**
 * Utilidades para testes: RNG deterministico e um jogador "scriptado" que
 * sempre joga a carta de menor indice e responde de forma fixa ao truco.
 */

import { Rng } from "../src/core/deck.js";
import { manilhaRank } from "../src/core/ranking.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import { Card } from "../src/core/types.js";
import { Play } from "../src/core/vaza.js";
import {
  Action,
  MaoDeOnzeContext,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  Proposal,
  RaiseResponse,
} from "../src/players/player.js";

/** Constroi uma PlayerView para testes, com defaults razoaveis. */
export function makeView(opts: {
  hand: Card[];
  vira: Card;
  seat?: number;
  scores?: number[];
  currentVazaPlays?: Play[];
  completedVazaPlays?: Play[][];
  completedVazaResults?: PlayerView["completedVazaResults"];
  handValue?: number;
  blind?: boolean;
}): PlayerView {
  const seat = opts.seat ?? 0;
  const teamOfSeat = [0, 1, 0, 1];
  return {
    seat,
    team: teamOfSeat[seat]!,
    hand: opts.hand,
    vira: opts.vira,
    manilha: manilhaRank(opts.vira, TRUCO_PAULISTA),
    rules: TRUCO_PAULISTA,
    scores: opts.scores ?? [0, 0],
    teamOfSeat,
    completedVazaPlays: opts.completedVazaPlays ?? [],
    completedVazaResults: opts.completedVazaResults ?? [],
    currentVazaPlays: opts.currentVazaPlays ?? [],
    handValue: opts.handValue ?? 1,
    blind: opts.blind ?? false,
  };
}

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
