/**
 * Treino da melhorada_7: o candidato carrega um MODELO DE OPONENTE (atualizado
 * online via observe) e o GA evolui os pesos das features de oponente para
 * EXPLORAR cada adversario. Pool: {inocente, m1..m6} (estaticos). Seed m6.
 *
 *   fitness = PIOR CASO (min das taxas vs pool) - LAMBDA*TV(faixas)
 *
 * Env: POP, GENS, GAMES (por oponente), SEED, LAMBDA.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Rng } from "../core/deck.js";
import { TRUCO_PAULISTA } from "../core/rules.js";
import { BotPlayer } from "../players/bot.js";
import { EvolvedBotPlayer } from "../players/evolvedBot.js";
import { OpponentModel } from "../players/opponentModel.js";
import {
  Genome,
  GENOME_LENGTH,
  fromVector,
  parseGenome,
  randomGenome,
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

const POP = envNum("POP", 60);
const GENS = envNum("GENS", 35);
const GAMES = envNum("GAMES", 80);
const SEED = envNum("SEED", 7070);
const lambdaTV = Number.isFinite(Number(process.env.LAMBDA)) ? Number(process.env.LAMBDA) : 0.01;

const rules = TRUCO_PAULISTA;
const master = seededRng(SEED);

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../genomes");
mkdirSync(dir, { recursive: true });
const loadGenome = (file: string) =>
  parseGenome(JSON.parse(readFileSync(resolve(dir, file), "utf8")));

// Pool estatico (sem modelo de oponente).
const evoContender = (name: string, g: Genome): Contender => ({
  name,
  makePlayer: (seat: number, rng: Rng) => new EvolvedBotPlayer(`${name}#${seat}`, g, rng),
});
// Candidato m7: COM modelo de oponente (fresco por partida).
const m7Contender = (name: string, g: Genome): Contender => ({
  name,
  makePlayer: (seat: number, rng: Rng) =>
    new EvolvedBotPlayer(`${name}#${seat}`, g, rng, undefined, false, new OpponentModel(rules)),
});

const m6 = loadGenome("melhorada_6.json");
const pool: Contender[] = [
  { name: "inocente", makePlayer: (seat) => new BotPlayer(`inocente#${seat}`) },
  evoContender("m1", loadGenome("melhorada_1.json")),
  evoContender("m2", loadGenome("melhorada_2.json")),
  evoContender("m3", loadGenome("melhorada_3.json")),
  evoContender("m4", loadGenome("melhorada_4.json")),
  evoContender("m5", loadGenome("melhorada_5.json")),
  evoContender("m6", m6),
];

const seeds = Array.from({ length: GAMES }, () => Math.floor(master() * 1e9));
const outPath = resolve(dir, "melhorada_7.json");

console.log(
  `RR7 (pior caso + modelo de oponente) — POP=${POP} GENS=${GENS} GAMES=${GAMES}/op ` +
    `LAMBDA=${lambdaTV} pool=[${pool.map((p) => p.name).join(", ")}] len=${GENOME_LENGTH}`,
);

const initial = [
  toVector(m6),
  ...Array.from({ length: Math.max(0, POP - 1) }, () => toVector(randomGenome(master))),
];

const evaluate = async (vector: number[]): Promise<number> => {
  const g = fromVector(vector);
  const stats = await evaluateVsPool(m7Contender("cand", g), pool, seeds, rules);
  return stats.worstWinRate - lambdaTV * bucketTotalVariation(g);
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

const finalStats = await evaluateVsPool(m7Contender("melhorada_7", champion), pool, seeds, rules);
console.log("\nCampeao (melhorada_7) — taxas por oponente (sementes de treino):");
for (const o of finalStats.perOpponent) {
  const flag = o.winRate < 0.5 ? "  <-- ABAIXO DE 50%" : "";
  console.log(`   vs ${o.name.padEnd(9)} ${(o.winRate * 100).toFixed(1)}%${flag}`);
}
console.log(`   pior caso=${(finalStats.worstWinRate * 100).toFixed(1)}%  TV(faixas)=${bucketTotalVariation(champion).toFixed(2)}`);
console.log("\nGranularidade efetiva por variavel:");
for (const e of effectiveBucketCounts(champion)) {
  console.log(`   ${e.name.padEnd(14)} ${e.buckets}`);
}
console.log("\nSalvo em src/genomes/melhorada_7.json");
