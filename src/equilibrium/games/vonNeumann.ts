/**
 * Modelo basico de von Neumann (Secao 1 do paper), DISCRETIZADO, para VALIDAR o
 * CFR contra a forma fechada conhecida:
 *   - Jogador I (0) recebe mao x, II (1) recebe mao y, uniformes e independentes.
 *   - I aposta B ou da check. Se check -> showdown valendo 1 (a ante).
 *     Se aposta -> II paga (showdown valendo 1+B) ou corre (I leva 1).
 *   - Valor ao jogador I = B/((1+B)(4+B)); em B=2 -> 1/9. Limiares: I aposta com
 *     x<a=1/9 (blefe) ou x>b=7/9 (valor); II paga com y>c=5/9.
 *
 * Discretizamos as maos em N niveis equiprovaveis (0..N-1); empate (mesmo nivel)
 * vale 0. Com N grande, recuperamos os valores do paper.
 */

import { Game } from "../game.js";

export interface VNState {
  i: number; // nivel da mao do jogador 0 (I)
  j: number; // nivel da mao do jogador 1 (II)
  h: string; // historico: "", "bet", "check", "bet:fold", "bet:call"
}

export class VonNeumannGame implements Game<VNState> {
  constructor(
    private readonly N = 60,
    private readonly B = 2,
  ) {}

  chanceOutcomes() {
    const out: { prob: number; state: VNState }[] = [];
    const p = 1 / (this.N * this.N);
    for (let i = 0; i < this.N; i++) {
      for (let j = 0; j < this.N; j++) {
        out.push({ prob: p, state: { i, j, h: "" } });
      }
    }
    return out;
  }

  isTerminal(s: VNState): boolean {
    return s.h === "check" || s.h === "bet:fold" || s.h === "bet:call";
  }

  private show(i: number, j: number, stake: number): number {
    return i > j ? stake : i < j ? -stake : 0;
  }

  payoff0(s: VNState): number {
    if (s.h === "check") return this.show(s.i, s.j, 1);
    if (s.h === "bet:fold") return 1; // II corre -> I leva a ante
    if (s.h === "bet:call") return this.show(s.i, s.j, 1 + this.B);
    throw new Error(`Estado nao terminal: ${s.h}`);
  }

  currentPlayer(s: VNState): 0 | 1 {
    return s.h === "" ? 0 : 1; // I age na raiz; II responde a aposta
  }

  infoSet(s: VNState): string {
    return s.h === "" ? `I${s.i}|${s.h}` : `II${s.j}|${s.h}`;
  }

  actions(s: VNState): string[] {
    if (s.h === "") return ["bet", "check"];
    if (s.h === "bet") return ["call", "fold"];
    throw new Error(`Sem acoes em ${s.h}`);
  }

  next(s: VNState, action: string): VNState {
    const h = s.h === "" ? action : `${s.h}:${action}`;
    return { ...s, h };
  }
}
