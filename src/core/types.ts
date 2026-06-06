/**
 * Tipos fundamentais do dominio do truco.
 *
 * Este modulo nao contem regras nem I/O: apenas as estruturas de dados
 * compartilhadas por todo o nucleo (core) e pelas interfaces (CLI/web).
 */

/** Naipes do baralho. Ordem de forca entre manilhas vive em RuleSet. */
export enum Suit {
  Ouros = "ouros", // diamante
  Espadas = "espadas",
  Copas = "copas",
  Paus = "paus",
}

/**
 * Ranks do baralho de 40 cartas (sem 8/9/10).
 * O valor numerico aqui NAO representa forca; a forca vem de RuleSet.rankOrder.
 * Usamos strings para facilitar leitura/render.
 */
export enum Rank {
  Quatro = "4",
  Cinco = "5",
  Seis = "6",
  Sete = "7",
  Dama = "Q",
  Valete = "J",
  Rei = "K",
  As = "A",
  Dois = "2",
  Tres = "3",
}

/** Uma carta concreta do baralho. */
export interface Card {
  rank: Rank;
  suit: Suit;
}

/** Identificador de um assento na mesa (0..n-1), em ordem horaria. */
export type Seat = number;

/** Identificador de uma equipe. */
export type TeamId = number;

/** Igualdade estrutural de cartas. */
export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** Representacao curta para logs/render, ex.: "3 de paus". */
export function cardToString(card: Card): string {
  return `${card.rank} de ${card.suit}`;
}
