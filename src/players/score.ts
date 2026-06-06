/**
 * Scorer da inteligencia evoluida: combina a parte LINEAR (dot(pesos, features))
 * com as contribuicoes de FAIXA (bucket ativo de cada variavel, via limiares do
 * genoma). Fonte unica usada pelo EvolvedBotPlayer e pela explicabilidade.
 *
 * Tambem oferece utilitarios de parcimonia: variacao total (fused-lasso) dos
 * pesos de faixa e a granularidade efetiva por variavel.
 */

import { Card } from "../core/types.js";
import {
  BET_BUCKET_VARS,
  BucketVar,
  CARD_BUCKET_VARS,
  N_BUCKETS,
  bucketIndex,
  THRESH_PER_VAR,
} from "./buckets.js";
import { betFeatures, cardFeatures, Precomputed } from "./features.js";
import { Genome } from "./genome.js";
import { PlayerView } from "./player.js";

function dot(weights: readonly number[], features: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < weights.length; i++) s += weights[i]! * features[i]!;
  return s;
}

/** Contribuicao de faixa de uma variavel: faixa ativa e seu peso. */
export interface BucketContribution {
  name: string;
  bucket: number;
  value: number;
  weight: number;
}

function bucketContribs(
  featureValues: readonly number[],
  vars: readonly BucketVar[],
  thresholds: readonly number[],
  weights: readonly number[],
): BucketContribution[] {
  const out: BucketContribution[] = [];
  for (let v = 0; v < vars.length; v++) {
    const cfg = vars[v]!;
    const raw = featureValues[cfg.index]!;
    const thr = thresholds.slice(v * THRESH_PER_VAR, (v + 1) * THRESH_PER_VAR);
    const b = bucketIndex(raw, cfg.min, cfg.max, thr);
    out.push({ name: cfg.name, bucket: b, value: raw, weight: weights[v * N_BUCKETS + b]! });
  }
  return out;
}

export interface ScoreParts {
  score: number;
  linear: number;
  buckets: BucketContribution[];
}

/** Score de uma carta candidata (linear + faixas). */
export function cardScoreParts(
  genome: Genome,
  view: PlayerView,
  card: Card,
  pre: Precomputed,
): ScoreParts {
  const feats = cardFeatures(view, card, pre);
  const linear = dot(genome.cardWeights, feats);
  const buckets = bucketContribs(
    feats,
    CARD_BUCKET_VARS,
    genome.cardBucketThresholds,
    genome.cardBucketWeights,
  );
  const bucketSum = buckets.reduce((s, b) => s + b.weight, 0);
  return { score: linear + bucketSum, linear, buckets };
}

/** Score de situacao S para apostas (linear + faixas). */
export function situationScoreParts(
  genome: Genome,
  view: PlayerView,
  pre: Precomputed,
  oppFeatures?: readonly number[],
): ScoreParts {
  const feats = betFeatures(view, pre, oppFeatures);
  const linear = dot(genome.betWeights, feats);
  const buckets = bucketContribs(
    feats,
    BET_BUCKET_VARS,
    genome.betBucketThresholds,
    genome.betBucketWeights,
  );
  const bucketSum = buckets.reduce((s, b) => s + b.weight, 0);
  return { score: linear + bucketSum, linear, buckets };
}

export function cardScore(genome: Genome, view: PlayerView, card: Card, pre: Precomputed): number {
  return cardScoreParts(genome, view, card, pre).score;
}

export function situationScore(
  genome: Genome,
  view: PlayerView,
  pre: Precomputed,
  oppFeatures?: readonly number[],
): number {
  return situationScoreParts(genome, view, pre, oppFeatures).score;
}

/**
 * Variacao total (fused-lasso) dos pesos de faixa: soma de |w[i+1]-w[i]| entre
 * faixas adjacentes de cada variavel. Penaliza degraus -> funde faixas inuteis.
 */
export function bucketTotalVariation(genome: Genome): number {
  let tv = 0;
  const add = (weights: readonly number[], numVars: number) => {
    for (let v = 0; v < numVars; v++) {
      for (let i = 0; i < N_BUCKETS - 1; i++) {
        tv += Math.abs(weights[v * N_BUCKETS + i + 1]! - weights[v * N_BUCKETS + i]!);
      }
    }
  };
  add(genome.cardBucketWeights, CARD_BUCKET_VARS.length);
  add(genome.betBucketWeights, BET_BUCKET_VARS.length);
  return tv;
}

/** Granularidade efetiva por variavel: nº de faixas distintas (degraus+1). */
export function effectiveBucketCounts(
  genome: Genome,
  eps = 0.05,
): { name: string; buckets: number }[] {
  const out: { name: string; buckets: number }[] = [];
  const scan = (weights: readonly number[], vars: readonly BucketVar[]) => {
    for (let v = 0; v < vars.length; v++) {
      let steps = 0;
      for (let i = 0; i < N_BUCKETS - 1; i++) {
        if (Math.abs(weights[v * N_BUCKETS + i + 1]! - weights[v * N_BUCKETS + i]!) > eps) steps++;
      }
      out.push({ name: vars[v]!.name, buckets: steps + 1 });
    }
  };
  scan(genome.cardBucketWeights, CARD_BUCKET_VARS);
  scan(genome.betBucketWeights, BET_BUCKET_VARS);
  return out;
}
