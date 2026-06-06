/**
 * RuleSet: configuracao das regras de uma variante de truco.
 *
 * Toda a variabilidade entre variantes (Paulista, Mineiro, manilha fixa, etc.)
 * deve viver aqui, de modo que o motor (ranking/vaza/hand/match) nunca precise
 * mudar para suportar uma nova variante: basta um novo RuleSet.
 */

import { Rank, Suit } from "./types.js";

/** Valores possiveis de uma mao conforme a escalada do truco. */
export interface BettingLevel {
  /** Nome exibido, ex.: "Truco", "Seis". */
  name: string;
  /** Quanto a mao vale se a aposta deste nivel for aceita. */
  value: number;
}

export interface RuleSet {
  /** Nome da variante. */
  name: string;

  /** Numero de jogadores na mesa (4 = duplas). */
  numPlayers: number;

  /** Numero de equipes (2 no truco classico). */
  numTeams: number;

  /** Cartas distribuidas por jogador. */
  cardsPerPlayer: number;

  /** Pontuacao alvo para vencer a partida. */
  pointsToWin: number;

  /**
   * Ordem dos ranks do mais FRACO para o mais FORTE (cartas comuns, sem manilha).
   * Tambem usada para calcular a manilha a partir da vira (rank seguinte ciclico).
   */
  rankOrder: readonly Rank[];

  /**
   * Ordem dos naipes do mais FRACO para o mais FORTE, usada APENAS para
   * desempatar entre manilhas. No Paulista: ouros < espadas < copas < paus.
   */
  manilhaSuitOrder: readonly Suit[];

  /** Valor de uma mao nao trucada. */
  baseValue: number;

  /**
   * Niveis da escalada do truco, em ordem. O primeiro pedido leva ao indice 0.
   * Paulista: Truco(3) -> Seis(6) -> Nove(9) -> Doze(12).
   */
  bettingLevels: readonly BettingLevel[];

  /**
   * Se true, quando todas as 3 vazas empatam (ou conforme regra de empate),
   * a mao e anulada (ninguem pontua). Se false, usa criterio de primeira vaza.
   */
  cancelOnFullTie: boolean;

  /** Regra "mao de 11" ativada (desligada por padrao no MVP). */
  maoDeOnze: boolean;
}

/** RuleSet padrao: Truco Paulista, duplas (2v2), ate 12 pontos. */
export const TRUCO_PAULISTA: RuleSet = {
  name: "Truco Paulista",
  numPlayers: 4,
  numTeams: 2,
  cardsPerPlayer: 3,
  pointsToWin: 12,
  rankOrder: [
    Rank.Quatro,
    Rank.Cinco,
    Rank.Seis,
    Rank.Sete,
    Rank.Dama,
    Rank.Valete,
    Rank.Rei,
    Rank.As,
    Rank.Dois,
    Rank.Tres,
  ],
  manilhaSuitOrder: [Suit.Ouros, Suit.Espadas, Suit.Copas, Suit.Paus],
  baseValue: 1,
  bettingLevels: [
    { name: "Truco", value: 3 },
    { name: "Seis", value: 6 },
    { name: "Nove", value: 9 },
    { name: "Doze", value: 12 },
  ],
  cancelOnFullTie: true,
  maoDeOnze: false,
};

/**
 * Cria uma variante 1v1 (mano a mano) a partir do Paulista.
 * Util para o suporte futuro a 2 jogadores.
 */
export function makeManoAMano(base: RuleSet = TRUCO_PAULISTA): RuleSet {
  return { ...base, name: `${base.name} (1v1)`, numPlayers: 2, numTeams: 2 };
}

/**
 * Cria uma variante de trios (3v3) a partir do Paulista.
 * Util para o suporte futuro a 6 jogadores em 2 equipes de 3.
 */
export function makeTrios(base: RuleSet = TRUCO_PAULISTA): RuleSet {
  return { ...base, name: `${base.name} (trios)`, numPlayers: 6, numTeams: 2 };
}
