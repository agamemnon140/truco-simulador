/**
 * "Maco/Trapaceiro": a dupla NASCE como m6 (decisoes inalteradas) e ganha, por
 * cima, as tecnicas de trapaca exercidas na DISTRIBUICAO:
 *   - maco       : enviesa as manilhas (parceiro > pe > adversario), com backfire;
 *   - 4 cartas   : o parceiro do pe fica com as 3 melhores de 4;
 *   - melar      : pede redistribuicao ao ver uma mao fraca (orcamento por partida).
 *
 * Maco e "4 cartas" sao aplicados pelo MOTOR (le `cheat` do pe). "Melar" e o
 * `wantsRedeal` (o motor limita o nº de redeals por mao). As decisoes de jogo sao
 * 100% delegadas ao m6 interno.
 */

import { Rng } from "../core/deck.js";
import { cardStrength } from "../core/ranking.js";
import { RuleSet } from "../core/rules.js";
import { Card, Seat } from "../core/types.js";
import { EvolvedBotPlayer } from "./evolvedBot.js";
import { DecisionInfo } from "./explain.js";
import { Genome } from "./genome.js";
import {
  Action,
  CheatProfile,
  GameEvent,
  MaoDeOnzeContext,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  Proposal,
  RaiseResponse,
} from "./player.js";

/** Forca default do maco (calibravel) — ver calibrate-maco.ts. */
export const DEFAULT_MACO_STRENGTH = 0.6;

/** Monta um perfil de maco a partir da forca [0,1] (s escala maco E 4-cartas; s=0 = honesto). */
export function macoCheat(macoStrength: number): CheatProfile {
  return {
    macoStrength,
    macoAttempts: 4,
    macoBackfire: 0.2,
    macoWeights: { partner: 3, dealer: 2, opp: 1 },
    extraCardProb: 0.3 * macoStrength,
  };
}

/** Maco DINAMICO: forca `base` normalmente, sobe p/ `losing` se o time esta perdendo. */
export function macoCheatDynamic(base: number, losing: number): CheatProfile {
  return { ...macoCheat(base), macoStrengthLosing: losing };
}

export interface MacoOptions {
  cheat: CheatProfile;
  rules: RuleSet;
  /** "Mela" se a forca media (normalizada) da mao < isto. */
  melarBelow?: number;
  /** Orcamento de "melar" por partida. */
  melarBudget?: number;
}

export class MacoPlayer implements Player {
  readonly cheat: CheatProfile;
  private readonly inner: EvolvedBotPlayer;
  private readonly rules: RuleSet;
  private readonly melarBelow: number;
  private melarLeft: number;

  constructor(
    readonly name: string,
    genome: Genome,
    opts: MacoOptions,
    rng?: Rng,
    onDecision?: (info: DecisionInfo) => void,
  ) {
    this.inner = new EvolvedBotPlayer(name, genome, rng, onDecision);
    this.cheat = opts.cheat;
    this.rules = opts.rules;
    this.melarBelow = opts.melarBelow ?? 0.25;
    this.melarLeft = opts.melarBudget ?? 2;
  }

  chooseAction(view: PlayerView, canRaise: boolean): Promise<Action> {
    return this.inner.chooseAction(view, canRaise);
  }
  respondToRaise(view: PlayerView, p: Proposal, c: boolean): Promise<RaiseResponse> {
    return this.inner.respondToRaise(view, p, c);
  }
  decideMaoDeOnze(view: PlayerView, ctx: MaoDeOnzeContext): Promise<MaoDeOnzeDecision> {
    return this.inner.decideMaoDeOnze(view, ctx);
  }
  observe(ev: GameEvent, seat: Seat): void {
    this.inner.observe?.(ev, seat);
  }

  /** "Melar": com orcamento, pede redistribuicao quando a mao e fraca. */
  wantsRedeal(hand: readonly Card[], vira: Card): boolean {
    if (this.melarLeft <= 0 || hand.length === 0) return false;
    const max = this.rules.rankOrder.length + this.rules.manilhaSuitOrder.length - 1;
    let sum = 0;
    for (const c of hand) sum += cardStrength(c, vira, this.rules);
    const avg = sum / (max * hand.length);
    if (avg < this.melarBelow) {
      this.melarLeft--;
      return true;
    }
    return false;
  }
}
