/**
 * Treino da melhorada_4: round-robin de PIOR CASO contra o pool fixo
 * {inocente, m1, m2, m3}, agora com FAIXAS (limiares evolutivos) e PENALIDADE
 * DE PARCIMONIA (variacao total dos pesos de faixa). Assim a granularidade
 * (quantas faixas por variavel) emerge: faixas inuteis se fundem.
 *
 *   fitness = worstWinRate + 0.01*meanWinRate - LAMBDA * TV(bucketWeights)
 *
 * Checkpoint a cada geracao. Ao final, reporta a granularidade efetiva.
 *
 * Env (defaults pesados): POP, GENS, GAMES (por oponente), SEED, LAMBDA.
 * Ex.: POP=80 GENS=50 GAMES=150 LAMBDA=0.01 npm run train:rr4
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
import { Contender, evaluateVsPool } from "./arena.js";
import { runGA } from "./ga.js";
import { seededRng } from "./rng.js";

function envNum(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

const POP = envNum("POP", 80);
const GENS = envNum("GENS", 50);
const GAMES = envNum("GAMES", 150);
const SEED = envNum("SEED", 4040);
const LAMBDA = Number(process.env.LAMBDA);
const lambda = Number.isFinite(LAMBDA) && LAMBDA >= 0 ? LAMBDA : 0.01;

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

const pool: Contender[] = [
  { name: "inocente", makePlayer: (seat) => new BotPlayer(`inocente#${seat}`) },
  evoContender("m1", loadGenome("melhorada_1.json")),
  evoContender("m2", loadGenome("melhorada_2.json")),
  evoContender("m3", loadGenome("melhorada_3.json")),
];

const seeds = Array.from({ length: GAMES }, () => Math.floor(master() * 1e9));
const outPath = resolve(dir, "melhorada_4.json");

console.log(
  `RR4 (faixas+parcimonia) — POP=${POP} GENS=${GENS} GAMES=${GAMES}/op ` +
    `LAMBDA=${lambda} pool=[${pool.map((p) => p.name).join(", ")}] len=${GENOME_LENGTH}`,
);

const initial = [
  toVector(seedGenome()),
  ...Array.from({ length: POP - 1 }, () => toVector(randomGenome(master))),
];

const evaluate = async (vector: number[]): Promise<number> => {
  const g = fromVector(vector);
  const stats = await evaluateVsPool(evoContender("cand", g), pool, seeds, rules);
  const tv = bucketTotalVariation(g);
  return stats.worstWinRate + 0.01 * stats.meanWinRate - lambda * tv;
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
  evoContender("melhorada_4", champion),
  pool,
  seeds,
  rules,
);
console.log("\nCampeao (melhorada_4) — taxas por oponente (sementes de treino):");
for (const o of finalStats.perOpponent) {
  console.log(`   vs ${o.name.padEnd(9)} ${(o.winRate * 100).toFixed(1)}%`);
}
console.log(`   PIOR CASO: ${(finalStats.worstWinRate * 100).toFixed(1)}%`);
console.log(`   TV(faixas)=${bucketTotalVariation(champion).toFixed(2)}`);
console.log("\nGranularidade efetiva por variavel (nº de faixas usadas):");
for (const e of effectiveBucketCounts(champion)) {
  console.log(`   ${e.name.padEnd(14)} ${e.buckets}`);
}
console.log("\nSalvo em src/genomes/melhorada_4.json");
