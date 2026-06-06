/**
 * Baralho de 40 cartas e embaralhamento.
 *
 * O embaralhamento recebe um RNG injetavel (funcao que retorna [0,1)) para
 * permitir testes deterministicos. Em producao usamos Math.random.
 */

import { Card, Rank, Suit } from "./types.js";

/** Fonte de aleatoriedade: retorna um numero em [0, 1). */
export type Rng = () => number;

/** Todos os naipes, em ordem fixa de geracao. */
export const ALL_SUITS: readonly Suit[] = [
  Suit.Ouros,
  Suit.Espadas,
  Suit.Copas,
  Suit.Paus,
];

/** Todos os ranks do baralho de 40 cartas. */
export const ALL_RANKS: readonly Rank[] = [
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
];

/** Constroi um baralho ordenado de 40 cartas. */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Embaralha uma copia do baralho usando Fisher-Yates com RNG injetavel.
 * Nao muta o array de entrada.
 */
export function shuffle(cards: readonly Card[], rng: Rng = Math.random): Card[] {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Resultado da distribuicao de uma mao. */
export interface Deal {
  /** Maos por assento: hands[seat] = 3 cartas. */
  hands: Card[][];
  /** A carta "vira" que define a manilha. */
  vira: Card;
  /** Cartas restantes no monte (nao usadas na mao). */
  rest: Card[];
}

/**
 * Distribui `cardsPerPlayer` cartas para cada um dos `numPlayers` assentos e
 * vira a proxima carta (a "vira"). Embaralha internamente com o RNG dado.
 */
export function deal(
  numPlayers: number,
  cardsPerPlayer: number,
  rng: Rng = Math.random,
): Deal {
  const needed = numPlayers * cardsPerPlayer + 1;
  const deck = shuffle(buildDeck(), rng);
  if (deck.length < needed) {
    throw new Error(
      `Baralho insuficiente: precisa de ${needed} cartas, tem ${deck.length}.`,
    );
  }

  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  let idx = 0;
  // Distribui carta a carta, dando uma volta na mesa por vez (como na vida real).
  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let seat = 0; seat < numPlayers; seat++) {
      hands[seat]!.push(deck[idx++]!);
    }
  }
  const vira = deck[idx++]!;
  const rest = deck.slice(idx);
  return { hands, vira, rest };
}
