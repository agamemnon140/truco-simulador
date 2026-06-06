import { describe, expect, it } from "vitest";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import { BotPlayer } from "../src/players/bot.js";
import { EvolvedBotPlayer } from "../src/players/evolvedBot.js";
import { seedGenome } from "../src/players/genome.js";
import { fromVector, randomGenome, seedGenome, toVector } from "../src/players/genome.js";
import { Contender, evaluateContender } from "../src/training/arena.js";
import { runGA } from "../src/training/ga.js";
import { seededRng } from "./helpers.js";

describe("GA — otimizacao de um alvo simples", () => {
  it("aproxima o vetor de um alvo (fitness melhora)", async () => {
    const target = [1, -2, 0.5, 3, -1];
    const rng = seededRng(123);
    const fitness = (v: number[]) =>
      -v.reduce((s, x, i) => s + (x - target[i]!) ** 2, 0);
    const initial = Array.from({ length: 24 }, () =>
      Array.from({ length: target.length }, () => rng() * 6 - 3),
    );
    const res = await runGA({
      initialPopulation: initial,
      generations: 40,
      eliteCount: 3,
      tournamentSize: 3,
      mutationProb: 0.3,
      mutationScale: 0.5,
      evaluate: async (v) => fitness(v),
      rng,
    });
    // Deve chegar perto do alvo (fitness ~ 0).
    expect(res.bestFitness).toBeGreaterThan(-0.5);
    expect(res.history[0]!.bestFitness).toBeLessThan(res.bestFitness);
  });
});

describe("arena — determinismo e sanidade", () => {
  const rules = TRUCO_PAULISTA;
  const inocente: Contender = {
    name: "inocente",
    makePlayer: (seat) => new BotPlayer(`in#${seat}`),
  };
  const evo: Contender = {
    name: "evo",
    makePlayer: (seat, rng) => new EvolvedBotPlayer(`evo#${seat}`, seedGenome(), rng),
  };
  const seeds = Array.from({ length: 20 }, (_, i) => 1000 + i);

  it("evaluateContender e deterministico", async () => {
    const a = await evaluateContender(evo, [inocente], seeds, rules);
    const b = await evaluateContender(evo, [inocente], seeds, rules);
    expect(a.fitness).toBe(b.fitness);
    expect(a.matches).toBe(seeds.length * 2);
  });

  it("um GA curto evolui um bot que supera o inocente", async () => {
    const rng = seededRng(7);
    const trainSeeds = Array.from({ length: 16 }, (_, i) => 5000 + i);
    const initial = [
      toVector(seedGenome()),
      ...Array.from({ length: 9 }, () => toVector(randomGenome(rng))),
    ];
    const evoContender = (vec: number[]): Contender => ({
      name: "cand",
      makePlayer: (seat, r) => new EvolvedBotPlayer(`c#${seat}`, fromVector(vec), r),
    });
    const res = await runGA({
      initialPopulation: initial,
      generations: 4,
      eliteCount: 2,
      tournamentSize: 3,
      mutationProb: 0.2,
      mutationScale: 0.3,
      evaluate: async (v) =>
        (await evaluateContender(evoContender(v), [inocente], trainSeeds, rules)).fitness,
      rng,
    });
    const stats = await evaluateContender(evoContender(res.bestVector), [inocente], trainSeeds, rules);
    expect(stats.winRate).toBeGreaterThan(0.5);
  });
});
