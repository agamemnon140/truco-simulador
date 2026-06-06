/**
 * Interface minima de um jogo em FORMA EXTENSIVA de dois jogadores soma-zero,
 * com nos de ACASO enumeraveis. E o dominio do CFR (counterfactual regret
 * minimization), que converge para um equilibrio de Nash (estrategia GTO,
 * inexploravel).
 *
 * Convencoes:
 *  - jogadores 0 e 1; payoff terminal e dado do ponto de vista do jogador 0
 *    (soma-zero: jogador 1 recebe o negativo);
 *  - `infoSet(s)` e a chave do conjunto de informacao VISIVEL ao jogador da vez
 *    (esconde a carta do oponente) — estados no mesmo infoset compartilham
 *    estrategia;
 *  - `chanceOutcomes()` enumera os resultados do acaso (o "deal") com
 *    probabilidades que somam 1.
 */

export interface ChanceOutcome<S> {
  prob: number;
  state: S;
}

export interface Game<S> {
  /** Resultados do acaso (deals) com suas probabilidades (somam 1). */
  chanceOutcomes(): ChanceOutcome<S>[];
  isTerminal(s: S): boolean;
  /** Utilidade do jogador 0 num estado terminal. */
  payoff0(s: S): number;
  /** Jogador da vez (0 ou 1) num estado de decisao. */
  currentPlayer(s: S): 0 | 1;
  /** Chave do conjunto de informacao visivel ao jogador da vez. */
  infoSet(s: S): string;
  /** Acoes disponiveis (ordem estavel). */
  actions(s: S): string[];
  /** Estado resultante de aplicar uma acao. */
  next(s: S, action: string): S;

  /**
   * Opcional: amostra UM resultado de acaso (deal) direto, para jogos grandes
   * demais para enumerar `chanceOutcomes()`. Habilita o MCCFR (chance sampling).
   */
  sampleChance?(rng: () => number): S;
}
