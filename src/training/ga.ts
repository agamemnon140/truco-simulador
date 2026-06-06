/**
 * Algoritmo genetico generico sobre vetores de numeros reais.
 *
 * Cada individuo e um vetor (o genoma achatado). A funcao `evaluate` mede o
 * fitness (assincrona, pois roda partidas). Usa selecao por torneio, crossover
 * uniforme, mutacao gaussiana com escala recozida e elitismo. As sementes de
 * avaliacao sao fixas durante o run (common random numbers), entao o fitness dos
 * elites e estavel e fica em cache.
 */

import { Rng } from "../core/deck.js";

export interface GAOptions {
  /** Populacao inicial (vetores). O tamanho define popSize. */
  initialPopulation: number[][];
  generations: number;
  /** Quantos melhores passam intactos para a proxima geracao. */
  eliteCount: number;
  /** Tamanho do torneio de selecao. */
  tournamentSize: number;
  /** Probabilidade de mutar cada gene. */
  mutationProb: number;
  /** Escala (desvio) inicial da mutacao gaussiana (recozida ate ~0). */
  mutationScale: number;
  /** Avalia um vetor e retorna o fitness (maior = melhor). */
  evaluate: (vector: number[]) => Promise<number>;
  rng: Rng;
  /** Callback por geracao (para log). */
  onGeneration?: (info: {
    generation: number;
    bestFitness: number;
    meanFitness: number;
    bestVector: number[];
  }) => void;
}

export interface GAResult {
  bestVector: number[];
  bestFitness: number;
  history: { generation: number; bestFitness: number; meanFitness: number }[];
}

interface Individual {
  vector: number[];
  fitness: number | null;
}

/** Amostra gaussiana (Box-Muller) com o RNG dado. */
function gaussian(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export async function runGA(opts: GAOptions): Promise<GAResult> {
  const { rng } = opts;
  const len = opts.initialPopulation[0]!.length;
  let pop: Individual[] = opts.initialPopulation.map((vector) => ({
    vector: vector.slice(),
    fitness: null,
  }));

  const history: GAResult["history"] = [];

  const evalAll = async (individuals: Individual[]) => {
    for (const ind of individuals) {
      if (ind.fitness === null) ind.fitness = await opts.evaluate(ind.vector);
    }
  };

  const tournament = (): Individual => {
    let best: Individual | null = null;
    for (let i = 0; i < opts.tournamentSize; i++) {
      const cand = pop[Math.floor(rng() * pop.length)]!;
      if (best === null || (cand.fitness ?? -Infinity) > (best.fitness ?? -Infinity)) {
        best = cand;
      }
    }
    return best!;
  };

  let best: { vector: number[]; fitness: number } = {
    vector: pop[0]!.vector.slice(),
    fitness: -Infinity,
  };

  for (let gen = 0; gen < opts.generations; gen++) {
    await evalAll(pop);
    pop.sort((a, b) => (b.fitness ?? -Infinity) - (a.fitness ?? -Infinity));

    if ((pop[0]!.fitness ?? -Infinity) > best.fitness) {
      best = { vector: pop[0]!.vector.slice(), fitness: pop[0]!.fitness! };
    }
    const mean =
      pop.reduce((s, ind) => s + (ind.fitness ?? 0), 0) / pop.length;
    history.push({ generation: gen, bestFitness: pop[0]!.fitness!, meanFitness: mean });
    opts.onGeneration?.({
      generation: gen,
      bestFitness: pop[0]!.fitness!,
      meanFitness: mean,
      bestVector: pop[0]!.vector.slice(),
    });

    if (gen === opts.generations - 1) break;

    // Recozimento da mutacao (diminui ao longo das geracoes).
    const scale = opts.mutationScale * (1 - gen / opts.generations);

    // Proxima geracao: elites + filhos.
    const next: Individual[] = [];
    for (let e = 0; e < opts.eliteCount && e < pop.length; e++) {
      next.push({ vector: pop[e]!.vector.slice(), fitness: pop[e]!.fitness });
    }
    while (next.length < pop.length) {
      const a = tournament().vector;
      const b = tournament().vector;
      const child = new Array<number>(len);
      for (let i = 0; i < len; i++) {
        // Crossover uniforme.
        child[i] = rng() < 0.5 ? a[i]! : b[i]!;
        // Mutacao gaussiana.
        if (rng() < opts.mutationProb) child[i]! += gaussian(rng) * scale;
      }
      next.push({ vector: child, fitness: null });
    }
    pop = next;
  }

  return { bestVector: best.vector, bestFitness: best.fitness, history };
}
