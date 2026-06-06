/**
 * Jogador com inteligencia EVOLUIDA: decide a partir de um genoma de pesos.
 *
 *  - Jogar carta: escolhe a de maior cardScore (soma ponderada das features da
 *    carta + contexto); com playTemp > 0, amostra via softmax (exploracao).
 *  - Apostar: calcula S (features de aposta) e compara com os limiares do genoma;
 *    com probabilidade pBluff, pede/aumenta truco mesmo com mao fraca (blefe).
 *  - Mao de onze: fora do escopo do genoma; usa a regra simples (forca da dupla).
 *
 * Recebe um RNG injetavel para o blefe/softmax ser reproduzivel no treino.
 */

import { Rng } from "../core/deck.js";
import { cardStrength } from "../core/ranking.js";
import { Card, cardsEqual } from "../core/types.js";
import {
  DecisionInfo,
  explainBetting,
  explainCardChoice,
} from "./explain.js";
import {
  betFeatures,
  cardFeatures,
  precompute,
} from "./features.js";
import { Genome } from "./genome.js";
import {
  Action,
  MaoDeOnzeContext,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  Proposal,
  RaiseResponse,
} from "./player.js";

function dot(weights: readonly number[], features: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < weights.length; i++) s += weights[i]! * features[i]!;
  return s;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export class EvolvedBotPlayer implements Player {
  constructor(
    readonly name: string,
    private readonly genome: Genome,
    private readonly rng: Rng = Math.random,
    /** Opcional: recebe a explicacao de cada decisao (para o modo "explicar"). */
    private readonly onDecision?: (info: DecisionInfo) => void,
  ) {}

  /** Score S da situacao para decisoes de aposta. */
  private situationScore(view: PlayerView): number {
    const pre = precompute(view);
    return dot(this.genome.betWeights, betFeatures(view, pre));
  }

  async chooseAction(view: PlayerView, canRaise: boolean): Promise<Action> {
    // Decisao de pedir truco (nunca em mao fechada/as cegas).
    if (canRaise && !view.blind) {
      const s = this.situationScore(view);
      const bluff = this.rng() < sigmoid(this.genome.pBluff);
      if (s > this.genome.thrCall || bluff) {
        this.onDecision?.({
          seat: view.seat,
          name: this.name,
          raised: true,
          betting: explainBetting(this.genome, view),
        });
        return { type: "raise" };
      }
    }
    const card = this.pickCard(view);
    if (this.onDecision) {
      const cardChoice = explainCardChoice(this.genome, view);
      // Marca a carta REALMENTE jogada como escolhida (fiel ao softmax/blefe).
      cardChoice.cards.forEach((c, i) => {
        c.chosen = cardsEqual(c.card, card);
        if (c.chosen) cardChoice.chosenIndex = i;
      });
      this.onDecision({
        seat: view.seat,
        name: this.name,
        raised: false,
        betting: explainBetting(this.genome, view),
        cardChoice,
      });
    }
    return { type: "play", card };
  }

  /** Escolhe a carta: argmax do cardScore, ou softmax se playTemp > 0. */
  private pickCard(view: PlayerView): Card {
    const hand = view.hand;
    // Mao fechada (11x11): sem informacao -> joga sem estrategia.
    if (view.blind || hand.length === 1) return hand[0]!;

    const pre = precompute(view);
    const scores = hand.map((c) => dot(this.genome.cardWeights, cardFeatures(view, c, pre)));

    const temp = Math.max(0, this.genome.playTemp);
    if (temp <= 1e-6) {
      // Argmax deterministico.
      let best = 0;
      for (let i = 1; i < scores.length; i++) if (scores[i]! > scores[best]!) best = i;
      return hand[best]!;
    }

    // Softmax com temperatura (exploracao/variacao).
    const maxS = Math.max(...scores);
    const exps = scores.map((s) => Math.exp((s - maxS) / temp));
    const total = exps.reduce((a, b) => a + b, 0);
    let r = this.rng() * total;
    for (let i = 0; i < exps.length; i++) {
      r -= exps[i]!;
      if (r <= 0) return hand[i]!;
    }
    return hand[hand.length - 1]!;
  }

  async respondToRaise(
    view: PlayerView,
    _proposal: Proposal,
    canCounter: boolean,
  ): Promise<RaiseResponse> {
    const s = this.situationScore(view);
    const bluff = this.rng() < sigmoid(this.genome.pBluff) * 0.5;
    if (canCounter && (s > this.genome.thrRaise || bluff)) return "raise";
    if (s > this.genome.thrAccept) return "accept";
    return "run";
  }

  async decideMaoDeOnze(
    view: PlayerView,
    ctx: MaoDeOnzeContext,
  ): Promise<MaoDeOnzeDecision> {
    // Fora do escopo do genoma: regra simples pela forca combinada da dupla.
    const all = [...view.hand, ...ctx.partnerHands.flat()];
    const max = view.rules.rankOrder.length + view.rules.manilhaSuitOrder.length - 1;
    let sum = 0;
    for (const c of all) sum += cardStrength(c, view.vira, view.rules);
    const score = all.length > 0 ? sum / (max * all.length) : 0;
    return score > 0.45 ? "play" : "fold";
  }
}
