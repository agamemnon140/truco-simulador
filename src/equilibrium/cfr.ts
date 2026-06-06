/**
 * CFR (Counterfactual Regret Minimization) com ACASO ENUMERADO (exato, sem
 * amostragem). Converge para um equilibrio de Nash de jogos 2p soma-zero.
 *
 * Mantem, por conjunto de informacao: soma de arrependimentos (regretSum) e soma
 * das estrategias (strategySum). A ESTRATEGIA MEDIA (averageStrategy) converge
 * para o equilibrio. A `exploitability` mede a distancia do Nash (0 no equilibrio)
 * via melhores respostas.
 */

import { Game } from "./game.js";

export class CFRSolver<S> {
  private regretSum = new Map<string, number[]>();
  private strategySum = new Map<string, number[]>();

  constructor(private readonly game: Game<S>) {}

  private getArr(map: Map<string, number[]>, key: string, n: number): number[] {
    let a = map.get(key);
    if (!a) {
      a = new Array<number>(n).fill(0);
      map.set(key, a);
    }
    return a;
  }

  /** Estrategia atual no infoset por regret matching. */
  private strategy(key: string, n: number): number[] {
    const r = this.getArr(this.regretSum, key, n);
    const pos = r.map((x) => (x > 0 ? x : 0));
    const sum = pos.reduce((a, b) => a + b, 0);
    if (sum > 0) return pos.map((x) => x / sum);
    return new Array<number>(n).fill(1 / n);
  }

  /** Estrategia media (a que converge para o equilibrio). */
  averageStrategy(key: string, n: number): number[] {
    const s = this.strategySum.get(key);
    if (!s) return new Array<number>(n).fill(1 / n);
    const sum = s.reduce((a, b) => a + b, 0);
    if (sum <= 0) return new Array<number>(n).fill(1 / n);
    return s.map((x) => x / sum);
  }

  /**
   * Uma passada CFR a partir de `s`. `pc` = alcance do acaso (prob. do deal);
   * `p0`,`p1` = alcances dos jogadores. Retorna a utilidade (ao jogador 0) do no.
   */
  private cfr(s: S, pc: number, p0: number, p1: number): number {
    const g = this.game;
    if (g.isTerminal(s)) return g.payoff0(s);

    const player = g.currentPlayer(s);
    const key = g.infoSet(s);
    const actions = g.actions(s);
    const n = actions.length;
    const strat = this.strategy(key, n);

    const util0 = new Array<number>(n);
    let nodeUtil0 = 0;
    for (let i = 0; i < n; i++) {
      const ns = g.next(s, actions[i]!);
      const np0 = player === 0 ? p0 * strat[i]! : p0;
      const np1 = player === 1 ? p1 * strat[i]! : p1;
      util0[i] = this.cfr(ns, pc, np0, np1);
      nodeUtil0 += strat[i]! * util0[i]!;
    }

    // Arrependimento contrafactual do jogador da vez.
    const cfReach = player === 0 ? p1 : p0;
    const sign = player === 0 ? 1 : -1; // jogador 1 minimiza a util. do jogador 0
    const r = this.getArr(this.regretSum, key, n);
    const selfReach = player === 0 ? p0 : p1;
    const ss = this.getArr(this.strategySum, key, n);
    for (let i = 0; i < n; i++) {
      r[i]! += pc * cfReach * sign * (util0[i]! - nodeUtil0);
      ss[i]! += pc * selfReach * strat[i]!;
    }
    return nodeUtil0;
  }

  /**
   * Valor (ao jogador 0) do perfil de ESTRATEGIAS MEDIAS — a quantidade que
   * converge para o valor do jogo (ao contrario do valor da estrategia corrente,
   * que oscila).
   */
  averageStrategyValue(): number {
    const g = this.game;
    const ev = (s: S): number => {
      if (g.isTerminal(s)) return g.payoff0(s);
      const A = g.actions(s);
      const sg = this.averageStrategy(g.infoSet(s), A.length);
      let acc = 0;
      for (let i = 0; i < A.length; i++) acc += sg[i]! * ev(g.next(s, A[i]!));
      return acc;
    };
    let v = 0;
    for (const d of g.chanceOutcomes()) v += d.prob * ev(d.state);
    return v;
  }

  /** Uma iteracao = uma passada por todos os deals. Retorna o valor do jogo. */
  train(iterations: number): number {
    const deals = this.game.chanceOutcomes();
    let value = 0;
    for (let it = 0; it < iterations; it++) {
      value = 0;
      for (const d of deals) {
        value += d.prob * this.cfr(d.state, d.prob, 1, 1);
      }
    }
    return value;
  }

  /**
   * Valor de MELHOR RESPOSTA para `brPlayer` contra a estrategia media atual.
   * Correto em info imperfeita: a acao e escolhida UMA vez por conjunto de
   * informacao (nao por estado), maximizando o valor contrafactual agregado.
   * Decide os infosets do mais PROFUNDO para o mais raso (os profundos primeiro),
   * pois decisoes rasas dependem das profundas.
   */
  private bestResponseValue(brPlayer: 0 | 1): number {
    const g = this.game;
    const utilBR = (s: S) => (brPlayer === 0 ? g.payoff0(s) : -g.payoff0(s));

    // 1) Coleta ocorrencias de cada infoset do brPlayer com seu alcance (acaso x oponente).
    const occ = new Map<string, { s: S; reach: number; actions: string[] }[]>();
    const collect = (s: S, reachOpp: number): void => {
      if (g.isTerminal(s)) return;
      const p = g.currentPlayer(s);
      const A = g.actions(s);
      if (p !== brPlayer) {
        const sg = this.averageStrategy(g.infoSet(s), A.length);
        for (let i = 0; i < A.length; i++) collect(g.next(s, A[i]!), reachOpp * sg[i]!);
      } else {
        const I = g.infoSet(s);
        let arr = occ.get(I);
        if (!arr) {
          arr = [];
          occ.set(I, arr);
        }
        arr.push({ s, reach: reachOpp, actions: A });
        for (const a of A) collect(g.next(s, a), reachOpp); // explora p/ alcancar infosets profundos
      }
    };
    for (const d of g.chanceOutcomes()) collect(d.state, d.prob);

    // 2) Avalia um estado com a politica BR ja decidida + oponente na media.
    const decided = new Map<string, string>();
    const evalState = (s: S): number => {
      if (g.isTerminal(s)) return utilBR(s);
      const p = g.currentPlayer(s);
      const A = g.actions(s);
      if (p !== brPlayer) {
        const sg = this.averageStrategy(g.infoSet(s), A.length);
        let acc = 0;
        for (let i = 0; i < A.length; i++) acc += sg[i]! * evalState(g.next(s, A[i]!));
        return acc;
      }
      const a = decided.get(g.infoSet(s));
      if (a === undefined) throw new Error(`Infoset nao decidido: ${g.infoSet(s)}`);
      return evalState(g.next(s, a));
    };

    // 3) Decide cada infoset, do mais profundo para o mais raso.
    const depth = (I: string) => (I.split("|")[1] ?? "").length;
    const infosets = [...occ.keys()].sort((x, y) => depth(y) - depth(x));
    for (const I of infosets) {
      const arr = occ.get(I)!;
      const A = arr[0]!.actions;
      let bestA = A[0]!;
      let bestV = -Infinity;
      for (const a of A) {
        let v = 0;
        for (const o of arr) v += o.reach * evalState(g.next(o.s, a));
        if (v > bestV) {
          bestV = v;
          bestA = a;
        }
      }
      decided.set(I, bestA);
    }

    // 4) Valor da melhor resposta (utilidade ao brPlayer).
    let total = 0;
    for (const d of g.chanceOutcomes()) total += d.prob * evalState(d.state);
    return total;
  }

  /**
   * Exploitability = ganho da melhor resposta do jogador 0 + ganho da do jogador
   * 1 (em utilidades proprias). 0 no equilibrio; positivo mede a distancia.
   */
  exploitability(): number {
    return this.bestResponseValue(0) + this.bestResponseValue(1);
  }
}
