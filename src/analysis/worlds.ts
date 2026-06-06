/**
 * Enumeracao/amostragem dos "mundos" possiveis para a analise da mao.
 *
 * Um "mundo" e uma atribuicao concreta de cartas as maos dos OUTROS jogadores,
 * consistente com o que o heroi viu (sua mao, vira e cartas ja jogadas). As cartas
 * desconhecidas que sobram ficam no monte (nao distribuidas).
 *
 * Sob oponente aleatorio, todos os mundos consistentes sao igualmente provaveis
 * (amostragem uniforme). Pesar os mundos pela verossimilhanca das jogadas
 * observadas (likelihood-weighting) seria a extensao bayesiana — ainda nao feita.
 */

import { buildDeck, shuffle } from "../core/deck.js";
import { Card, Seat, cardsEqual } from "../core/types.js";
import { PlayerView } from "../players/player.js";
import { seededRng } from "../training/rng.js";

export interface WorldOptions {
  /** "auto" usa exato se o nº de mundos <= exactCap; default "montecarlo". */
  mode?: "auto" | "montecarlo" | "exact";
  /** Amostras no Monte Carlo. Default 2000. */
  samples?: number;
  /** Semente. Default 1. */
  seed?: number;
  /** Limite de mundos para enumeracao exata. Default 20000. */
  exactCap?: number;
}

/** Cartas que o heroi ja viu (vira + todas as jogadas + sua mao). */
export function seenCards(view: PlayerView): Card[] {
  const seen: Card[] = [view.vira, ...view.hand];
  for (const vaza of view.completedVazaPlays) {
    for (const p of vaza) seen.push(p.card);
  }
  for (const p of view.currentVazaPlays) seen.push(p.card);
  return seen;
}

/** Cartas do baralho que o heroi NAO viu. */
export function unknownCards(view: PlayerView): Card[] {
  const seen = seenCards(view);
  return buildDeck().filter((c) => !seen.some((s) => cardsEqual(s, c)));
}

/** Quantas cartas cada assento ja jogou (vazas completas + vaza corrente). */
export function playedCountBySeat(view: PlayerView, n: number): number[] {
  const counts = new Array<number>(n).fill(0);
  for (const vaza of view.completedVazaPlays) {
    for (const p of vaza) counts[p.seat]! += 1;
  }
  for (const p of view.currentVazaPlays) counts[p.seat]! += 1;
  return counts;
}

/** Cartas restantes na mao de cada assento (heroi conhecido; demais por contagem). */
export function remainingBySeat(view: PlayerView): number[] {
  const n = view.rules.numPlayers;
  const played = playedCountBySeat(view, n);
  const remaining = new Array<number>(n);
  for (let s = 0; s < n; s++) remaining[s] = view.rules.cardsPerPlayer - played[s]!;
  return remaining;
}

/** Distribui `unknown` (em ordem) aos assentos != heroi conforme `remaining`. */
export function dealUnknown(
  view: PlayerView,
  remaining: number[],
  unknown: Card[],
): Card[][] {
  const n = view.rules.numPlayers;
  const dealt: Card[][] = Array.from({ length: n }, () => []);
  let idx = 0;
  for (let s = 0; s < n; s++) {
    if (s === view.seat) continue;
    for (let c = 0; c < remaining[s]!; c++) dealt[s]!.push(unknown[idx++]!);
  }
  return dealt;
}

/** Monta as maos completas de um mundo: heroi conhecido; demais com `dealt`. */
export function buildWorldHands(
  view: PlayerView,
  dealt: Card[][],
): Card[][] {
  const n = view.rules.numPlayers;
  const hands: Card[][] = new Array(n);
  for (let s = 0; s < n; s++) {
    hands[s] = s === view.seat ? view.hand.slice() : dealt[s]!.slice();
  }
  return hands;
}

export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

/** Numero de mundos distintos (multinomial) ao distribuir `u` cartas. */
export function countWorlds(
  remaining: number[],
  heroSeat: Seat,
  u: number,
): number {
  let pool = u;
  let total = 1;
  for (let s = 0; s < remaining.length; s++) {
    if (s === heroSeat) continue;
    total *= choose(pool, remaining[s]!);
    pool -= remaining[s]!;
    if (!Number.isFinite(total)) return Infinity;
  }
  return total;
}

/** Gera todas as combinacoes de tamanho k de `arr`, com o resto complementar. */
export function* combinations(
  arr: Card[],
  k: number,
): Generator<{ subset: Card[]; rest: Card[] }> {
  if (k === 0) {
    yield { subset: [], rest: arr.slice() };
    return;
  }
  if (k > arr.length) return;
  const idxs = Array.from({ length: k }, (_, i) => i);
  for (;;) {
    const subset = idxs.map((i) => arr[i]!);
    const chosen = new Set(idxs);
    const rest = arr.filter((_, i) => !chosen.has(i));
    yield { subset, rest };
    let p = k - 1;
    while (p >= 0 && idxs[p] === arr.length - k + p) p--;
    if (p < 0) break;
    idxs[p]!++;
    for (let q = p + 1; q < k; q++) idxs[q] = idxs[q - 1]! + 1;
  }
}

/** Valida consistencia da view e devolve {remaining, unknown}. */
export function worldSetup(view: PlayerView): {
  remaining: number[];
  unknown: Card[];
} {
  const remaining = remainingBySeat(view);
  const unknown = unknownCards(view);
  if (view.hand.length !== remaining[view.seat]) {
    throw new Error(
      `Mao do heroi (${view.hand.length}) inconsistente com a contagem de jogadas (${remaining[view.seat]}).`,
    );
  }
  const need = remaining.reduce(
    (sum, r, s) => sum + (s === view.seat ? 0 : r),
    0,
  );
  if (need > unknown.length) {
    throw new Error(
      `Cartas desconhecidas insuficientes: precisa de ${need}, ha ${unknown.length}.`,
    );
  }
  return { remaining, unknown };
}

/** Decide o metodo (exato/MC) e o total teorico de mundos. */
export function planWorlds(
  view: PlayerView,
  opts: WorldOptions = {},
): { method: "exact" | "montecarlo"; total: number } {
  const mode = opts.mode ?? "montecarlo";
  const exactCap = opts.exactCap ?? 20000;
  const { remaining, unknown } = worldSetup(view);
  const total = countWorlds(remaining, view.seat, unknown.length);
  if (mode === "exact") {
    if (total > exactCap) {
      throw new Error(
        `Enumeracao exata excede o limite (${total} > ${exactCap}). Aumente exactCap ou use Monte Carlo.`,
      );
    }
    return { method: "exact", total };
  }
  if (mode === "auto" && total <= exactCap) return { method: "exact", total };
  return { method: "montecarlo", total };
}

/**
 * Itera os mundos, entregando as maos COMPLETAS de cada um (heroi incluso).
 * - exato: cada atribuicao distinta uma vez (peso uniforme).
 * - monte carlo: `samples` mundos sorteados (uniforme).
 */
export function* iterWorlds(
  view: PlayerView,
  opts: WorldOptions = {},
): Generator<Card[][]> {
  const { remaining, unknown } = worldSetup(view);
  const { method } = planWorlds(view, opts);
  const seed = opts.seed ?? 1;

  if (method === "exact") {
    const seats: Seat[] = [];
    for (let s = 0; s < view.rules.numPlayers; s++) {
      if (s !== view.seat) seats.push(s);
    }
    const dealt: Card[][] = Array.from(
      { length: view.rules.numPlayers },
      () => [],
    );
    yield* enumerate(view, seats, 0, unknown, remaining, dealt);
    return;
  }

  const samples = opts.samples ?? 2000;
  for (let i = 0; i < samples; i++) {
    const rng = seededRng(seed + i);
    const shuffled = shuffle(unknown, rng);
    const dealt = dealUnknown(view, remaining, shuffled);
    yield buildWorldHands(view, dealt);
  }
}

function* enumerate(
  view: PlayerView,
  seats: Seat[],
  si: number,
  pool: Card[],
  remaining: number[],
  dealt: Card[][],
): Generator<Card[][]> {
  if (si === seats.length) {
    yield buildWorldHands(view, dealt);
    return;
  }
  const seat = seats[si]!;
  for (const combo of combinations(pool, remaining[seat]!)) {
    dealt[seat] = combo.subset;
    yield* enumerate(view, seats, si + 1, combo.rest, remaining, dealt);
  }
}
