/**
 * Rollout de uma mao ate o fim (sem truco) sob uma POLITICA, respeitando a
 * informacao imperfeita: cada jogador decide SO pela sua propria PlayerView
 * (sua mao + cartas na mesa), nunca vendo a mao dos outros.
 *
 * Compartilhado pelo estimador por politica (./winEstimator.ts) e pela analise
 * single-dummy (./singleDummy.ts).
 */

import { Rng } from "../core/deck.js";
import { decideHand } from "../core/hand.js";
import { manilhaRank } from "../core/ranking.js";
import { Card, Seat, TeamId, cardsEqual } from "../core/types.js";
import { Play, VazaResult, resolveVaza } from "../core/vaza.js";
import {
  Action,
  MaoDeOnzeContext,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  RaiseResponse,
} from "../players/player.js";
import { PersonalityId, getPersonality } from "../players/personalities.js";

/** Politica de rollout: uma personalidade construida ou o baseline aleatorio. */
export type PolicyId = PersonalityId | "random";

/** Jogador aleatorio: joga uma carta legal qualquer. Baseline "sem inteligencia". */
export class RandomPlayer implements Player {
  readonly name = "Random";
  constructor(private readonly rng: Rng) {}
  async chooseAction(view: PlayerView): Promise<Action> {
    const hand = view.hand;
    const idx = Math.floor(this.rng() * hand.length);
    return { type: "play", card: hand[Math.min(idx, hand.length - 1)]! };
  }
  async respondToRaise(): Promise<RaiseResponse> {
    return "accept";
  }
  async decideMaoDeOnze(): Promise<MaoDeOnzeDecision> {
    return "play";
  }
}

/** Cria o jogador (uma instancia serve a todos os assentos; seat vem da view). */
export function makePolicyPlayer(policy: PolicyId, rng: Rng): Player {
  if (policy === "random") return new RandomPlayer(rng);
  return getPersonality(policy).create(policy, rng);
}

/**
 * Joga a mao ate o fim a partir do estado parcial em `view`, com `hands` completas
 * (mundo sorteado), usando `player` para TODAS as decisoes — cada uma tomada
 * apenas com a PlayerView do assento da vez. Retorna a equipe vencedora ou null.
 */
export async function playoutWorld(
  view: PlayerView,
  hands: Card[][],
  player: Player,
): Promise<TeamId | null> {
  const rules = view.rules;
  const n = rules.numPlayers;
  const vira = view.vira;
  const manilha = manilhaRank(vira, rules);
  const teamOfSeat = view.teamOfSeat;

  const completedPlays: Play[][] = view.completedVazaPlays.map((v) => v.slice());
  const completedResults: VazaResult[] = view.completedVazaResults.slice();
  const startVaza = completedPlays.length;

  let leader: Seat =
    view.currentVazaPlays.length > 0 ? view.currentVazaPlays[0]!.seat : view.seat;

  for (let v = startVaza; v < rules.cardsPerPlayer; v++) {
    const plays: Play[] =
      v === startVaza ? view.currentVazaPlays.map((p) => ({ ...p })) : [];

    for (let k = plays.length; k < n; k++) {
      const seat = (leader + k) % n;
      const hand = hands[seat]!;
      const subView: PlayerView = {
        seat,
        team: teamOfSeat[seat]!,
        hand,
        vira,
        manilha,
        rules,
        scores: view.scores,
        teamOfSeat,
        completedVazaPlays: completedPlays,
        completedVazaResults: completedResults,
        currentVazaPlays: plays,
        handValue: rules.baseValue,
        blind: false,
      };
      const action = await player.chooseAction(subView, false);
      let idx = -1;
      if (action.type === "play") {
        idx = hand.findIndex((c) => cardsEqual(c, action.card));
      }
      if (idx < 0) idx = 0; // defensivo: joga a 1a carta se a escolha for invalida
      const card = hand[idx]!;
      hand.splice(idx, 1);
      plays.push({ seat, card });
    }

    const result = resolveVaza(plays, vira, teamOfSeat, rules);
    completedResults.push(result);
    completedPlays.push(plays);

    const decision = decideHand(completedResults, rules);
    if (decision === "cancel") return null;
    if (decision !== "continue") return decision; // TeamId
    if (result.winningSeat !== null) leader = result.winningSeat;
  }

  return null;
}
