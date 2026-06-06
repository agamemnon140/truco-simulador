/** RNG deterministico (LCG) compartilhado pelo treino, para reprodutibilidade. */

import { Rng } from "../core/deck.js";

export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9; // evita ficar preso no zero
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
