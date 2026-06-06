/**
 * Subjogo "ultima vaza 1v1" do truco como jogo 2p soma-zero (cartas reais).
 *
 * Vira fixa (define a manilha). Cada jogador recebe 1 carta; a vaza decide.
 *   - Jogador I (0): check (showdown valendo 1) ou truco (valendo 3).
 *   - Se truco, II (1): corre (I leva 1) / aceita (showdown 3) / aumenta p/ seis
 *     (valendo 6 -> I corre [II leva 3] ou aceita [showdown 6]).
 *   - Showdown: carta mais forte vence o valor em jogo; empate vale 0.
 *
 * Conjunto de informacao = FORCA da propria carta + historico (abstracao natural:
 * o que importa no showdown e a forca; cartas comuns de mesmo rank tem forca
 * igual). Acaso = todas as duplas ordenadas distintas do baralho - vira.
 */

import { buildDeck } from "../../core/deck.js";
import { cardStrength } from "../../core/ranking.js";
import { TRUCO_PAULISTA } from "../../core/rules.js";
import { Card, cardsEqual } from "../../core/types.js";
import { Game } from "../game.js";

export interface TLTState {
  ci: Card; // carta do jogador 0 (I)
  cj: Card; // carta do jogador 1 (II)
  h: string;
}

const RULES = TRUCO_PAULISTA;

export class TrucoLastTrickGame implements Game<TLTState> {
  private readonly deck: Card[];
  constructor(private readonly vira: Card) {
    this.deck = buildDeck().filter((c) => !cardsEqual(c, vira));
  }

  /** Forca de uma carta dada a vira (chave de abstracao). */
  strength(c: Card): number {
    return cardStrength(c, this.vira, RULES);
  }

  chanceOutcomes() {
    const out: { prob: number; state: TLTState }[] = [];
    const d = this.deck;
    const p = 1 / (d.length * (d.length - 1));
    for (const ci of d) {
      for (const cj of d) {
        if (cardsEqual(ci, cj)) continue;
        out.push({ prob: p, state: { ci, cj, h: "" } });
      }
    }
    return out;
  }

  isTerminal(s: TLTState): boolean {
    return (
      s.h === "check" ||
      s.h === "truco:fold" ||
      s.h === "truco:accept" ||
      s.h === "truco:seis:fold" ||
      s.h === "truco:seis:accept"
    );
  }

  private show(s: TLTState, stake: number): number {
    const si = this.strength(s.ci);
    const sj = this.strength(s.cj);
    return si > sj ? stake : si < sj ? -stake : 0;
  }

  payoff0(s: TLTState): number {
    switch (s.h) {
      case "check":
        return this.show(s, 1);
      case "truco:fold":
        return 1; // II corre -> I leva o valor anterior (1)
      case "truco:accept":
        return this.show(s, 3);
      case "truco:seis:fold":
        return -3; // I corre o seis -> II leva 3
      case "truco:seis:accept":
        return this.show(s, 6);
      default:
        throw new Error(`Estado nao terminal: ${s.h}`);
    }
  }

  currentPlayer(s: TLTState): 0 | 1 {
    if (s.h === "") return 0;
    if (s.h === "truco") return 1;
    if (s.h === "truco:seis") return 0;
    throw new Error(`Sem jogador em ${s.h}`);
  }

  infoSet(s: TLTState): string {
    const own = s.h === "truco" ? this.strength(s.cj) : this.strength(s.ci);
    const who = s.h === "truco" ? "II" : "I";
    return `${who}s${own}|${s.h}`;
  }

  actions(s: TLTState): string[] {
    if (s.h === "") return ["truco", "check"];
    if (s.h === "truco") return ["fold", "accept", "seis"];
    if (s.h === "truco:seis") return ["fold", "accept"];
    throw new Error(`Sem acoes em ${s.h}`);
  }

  next(s: TLTState, action: string): TLTState {
    const h = s.h === "" ? action : `${s.h}:${action}`;
    return { ...s, h };
  }
}
