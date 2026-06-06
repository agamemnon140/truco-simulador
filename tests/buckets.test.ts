import { describe, expect, it } from "vitest";
import { deal } from "../src/core/deck.js";
import { bucketIndex } from "../src/players/buckets.js";
import { precompute } from "../src/players/features.js";
import { parseGenome, seedGenome } from "../src/players/genome.js";
import {
  bucketTotalVariation,
  cardScoreParts,
  effectiveBucketCounts,
} from "../src/players/score.js";
import { makeView, seededRng } from "./helpers.js";

describe("buckets — bucketIndex", () => {
  it("mapeia o valor para a faixa certa (N=4, limiares 0.25/0.5/0.75)", () => {
    const thr = [0.25, 0.5, 0.75];
    expect(bucketIndex(0.1, 0, 1, thr)).toBe(0);
    expect(bucketIndex(0.3, 0, 1, thr)).toBe(1);
    expect(bucketIndex(0.6, 0, 1, thr)).toBe(2);
    expect(bucketIndex(0.9, 0, 1, thr)).toBe(3);
    // normaliza pelo dominio [-1,1]: 0 -> 0.5 -> faixa 2
    expect(bucketIndex(0, -1, 1, thr)).toBe(2);
  });

  it("limiares fora do alcance reduzem faixas efetivas", () => {
    expect(bucketIndex(0.4, 0, 1, [0.9, 0.95, 0.99])).toBe(0); // tudo na faixa 0
  });
});

describe("buckets — migracao e neutralidade", () => {
  it("genoma antigo (sem faixas) recebe faixas neutras (pesos 0)", () => {
    const old: Record<string, unknown> = { ...seedGenome() };
    delete old.cardBucketWeights;
    delete old.cardBucketThresholds;
    delete old.betBucketWeights;
    delete old.betBucketThresholds;
    const g = parseGenome(JSON.parse(JSON.stringify(old)));
    expect(g.cardBucketWeights.every((w) => w === 0)).toBe(true);
    expect(g.betBucketWeights.every((w) => w === 0)).toBe(true);
  });

  it("com pesos de faixa 0, score = parte linear (comportamento preservado)", () => {
    const g = seedGenome();
    const d = deal(4, 3, seededRng(3));
    const view = makeView({ hand: d.hands[0]!, vira: d.vira });
    const pre = precompute(view);
    const parts = cardScoreParts(g, view, view.hand[0]!, pre);
    expect(parts.score).toBeCloseTo(parts.linear, 12);
  });
});

describe("buckets — parcimonia (TV e granularidade)", () => {
  it("pesos iguais -> TV 0 e 1 faixa efetiva", () => {
    const g = seedGenome(); // pesos de faixa todos 0 (iguais)
    expect(bucketTotalVariation(g)).toBe(0);
    for (const e of effectiveBucketCounts(g)) expect(e.buckets).toBe(1);
  });

  it("escada -> TV>0 e 4 faixas efetivas naquela variavel", () => {
    const g = seedGenome();
    g.cardBucketWeights[0] = 0;
    g.cardBucketWeights[1] = 1;
    g.cardBucketWeights[2] = 2;
    g.cardBucketWeights[3] = 3;
    expect(bucketTotalVariation(g)).toBeCloseTo(3, 9);
    expect(effectiveBucketCounts(g)[0]!.buckets).toBe(4);
  });
});
