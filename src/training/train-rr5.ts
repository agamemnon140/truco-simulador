/**
 * Treino da melhorada_5: mesma arquitetura da m4 (faixas + parcimonia), mas com
 * fitness PONDERADO POR GERACAO + PISO de 50%. Valoriza muito mais a ultima
 * geracao (m4), sem deixar nenhum confronto cair abaixo de 50%.
 *
 *   weighted     = media ponderada das taxas (pesos exponenciais, m4 domina)
 *   floorPenalty = soma dos deficits abaixo de 0.5
 *   fitness      = weighted - LAMBDA_FLOOR*floorPenalty - LAMBDA*TV(faixas)
 *
 * Pool: [inocente, m1, m2, m3, m4]. Checkpoint por geracao.
 *
 * Env: POP, GENS, GAMES (por oponente), SEED, WEIGHTS (csv), LAMBDA_FLOOR, LAMBDA.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TRUCO_PAULISTA } from "../core/rules.js";
import { BotPlayer } from "../players/bot.js";
import { EvolvedBotPlayer } from "../players/evolvedBot.js";
import {
  Genome,
  GENOME_LENGTH,
  fromVector,
  parseGenome,
  randomGenome,
  seedGenome,
  toVector,
} from "../players/genome.js";
import { bucketTotalVariation, effectiveBucketCounts } from "../players/score.js";
import { Contender, evaluateVsPool, weightedFloorFitness } from "./arena.js";
import { runGA } from "./ga.js";
import { seededRng } from "./rng.js";

function envNum(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

const POP = envNum("POP", 70);
const GENS = envNum("GENS", 45);
const GAMES = envNum("GAMES", 100);
const SEED = envNum("SEED", 5050);
const lambdaTV = Number.isFinite(Number(process.env.LAMBDA)) ? Number(process.env.LAMBDA) : 0.01;
const lambdaFloor = Number.isFinite(Number(process.env.LAMBDA_FLOOR))
  ? Number(process.env.LAMBDA_FLOOR)
  : 5.0;

const rules = TRUCO_PAULISTA;
const master = seededRng(SEED);

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../genomes");
mkdirSync(dir, { recursive: true });
const loadGenome = (file: string) =>
  parseGenome(JSON.parse(readFileSync(resolve(dir, file), "utf8")));

const evoContender = (name: string, g: Genome): Contender => ({
  name,
  makePlayer: (seat, rng) => new EvolvedBotPlayer(`${name}#${seat}`, g, rng),
});

// Pool em ordem cronologica (peso cresce com a geracao).
const pool: Contender[] = [
  { name: "inocente", makePlayer: (seat) => new BotPlayer(`inocente#${seat}`) },
  evoContender("m1", loadGenome("melhorada_1.json")),
  evoContender("m2", loadGenome("melhorada_2.json")),
  evoContender("m3", loadGenome("melhorada_3.json")),
  evoContender("m4", loadGenome("melhorada_4.json")),
];

// Pesos exponenciais fortes (ultima domina). Override por env WEIGHTS=1,1,2,4,16
const defaultWeights = [1, 1, 2, 4, 16];
const weights = (process.env.WEIGHTS?.split(",").map(Number).filter((x) => Number.isFinite(x)) ?? [])
  .length === pool.length
  ? process.env.WEIGHTS!.split(",").map(Number)
  : defaultWeights;

const seeds = Array.from({ length: GAMES }, () => Math.floor(master() * 1e9));
const outPath = resolve(dir, "melhorada_5.json");

console.log(
  `RR5 (ponderado+piso) — POP=${POP} GENS=${GENS} GAMES=${GAMES}/op ` +
    `pesos=[${weights.join(",")}] LAMBDA_FLOOR=${lambdaFloor} LAMBDA=${lambdaTV} ` +
    `pool=[${pool.map((p) => p.name).join(", ")}] len=${GENOME_LENGTH}`,
);

const initial = [
  toVector(seedGenome()),
  ...Array.from({ length: POP - 1 }, () => toVector(randomGenome(master))),
];

const evaluate = async (vector: number[]): Promise<number> => {
  const g = fromVector(vector);
  const stats = await evaluateVsPool(evoContender("cand", g), pool, seeds, rules);
  const f = weightedFloorFitness(
    stats.perOpponent.map((o) => o.winRate),
    weights,
    lambdaFloor,
  );
  return f.score - lambdaTV * bucketTotalVariation(g);
};

const result = await runGA({
  initialPopulation: initial,
  generations: GENS,
  eliteCount: Math.max(1, Math.round(POP * 0.15)),
  tournamentSize: 3,
  mutationProb: 0.2,
  mutationScale: 0.3,
  evaluate,
  rng: master,
  onGeneration: ({ generation, bestFitness, meanFitness, bestVector }) => {
    writeFileSync(outPath, JSON.stringify(fromVector(bestVector), null, 2));
    console.log(
      `  gen ${String(generation).padStart(2)}: fit=${bestFitness.toFixed(3)} ` +
        `mean=${meanFitness.toFixed(3)} (checkpoint)`,
    );
  },
});

const champion = fromVector(result.bestVector);
writeFileSync(outPath, JSON.stringify(champion, null, 2));

const finalStats = await evaluateVsPool(
  evoContender("melhorada_5", champion),
  pool,
  seeds,
  rules,
);
console.log("\nCampeao (melhorada_5) — taxas por oponente (sementes de treino):");
for (const o of finalStats.perOpponent) {
  const flag = o.winRate < 0.5 ? "  <-- ABAIXO DO PISO" : "";
  console.log(`   vs ${o.name.padEnd(9)} ${(o.winRate * 100).toFixed(1)}%${flag}`);
}
console.log(`   TV(faixas)=${bucketTotalVariation(champion).toFixed(2)}`);
console.log("\nGranularidade efetiva por variavel:");
for (const e of effectiveBucketCounts(champion)) {
  console.log(`   ${e.name.padEnd(14)} ${e.buckets}`);
}
console.log("\nSalvo em src/genomes/melhorada_5.json");
