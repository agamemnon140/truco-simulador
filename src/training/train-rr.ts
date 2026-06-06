/**
 * Treino ROUND-ROBIN: evolui a melhorada_3 contra um pool FIXO e diverso
 * {inocente, melhorada_1, melhorada_2}, usando fitness de PIOR CASO (a menor
 * taxa de vitoria entre os oponentes). Isso forca o candidato a ser bom contra
 * TODOS os perfis — corrige a nao-transitividade vista na melhorada_2.
 *
 * Grava um CHECKPOINT (src/genomes/melhorada_3.json) a cada geracao: se o run
 * for cortado (limite de tempo), fica a melhor versao ate ali.
 *
 * Parametros por env (defaults muito pesados):
 *   POP, GENS, GAMES (por oponente), SEED
 * Ex.: POP=80 GENS=50 GAMES=150 npm run train:rr
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
import { Contender, evaluateVsPool } from "./arena.js";
import { runGA } from "./ga.js";
import { seededRng } from "./rng.js";

function envNum(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

const POP = envNum("POP", 80);
const GENS = envNum("GENS", 50);
const GAMES = envNum("GAMES", 150); // por oponente
const SEED = envNum("SEED", 777);

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

// Pool fixo e diverso (congelado).
const pool: Contender[] = [
  { name: "inocente", makePlayer: (seat) => new BotPlayer(`inocente#${seat}`) },
  evoContender("m1", loadGenome("melhorada_1.json")),
  evoContender("m2", loadGenome("melhorada_2.json")),
];

// Sementes comuns, fixas no run inteiro (CRN -> cache de elite valido).
const seeds = Array.from({ length: GAMES }, () => Math.floor(master() * 1e9));

const outPath = resolve(dir, "melhorada_3.json");

console.log(
  `Round-robin — POP=${POP} GENS=${GENS} GAMES=${GAMES}/oponente ` +
    `pool=[${pool.map((p) => p.name).join(", ")}] SEED=${SEED} len=${GENOME_LENGTH}`,
);

const initial = [
  toVector(seedGenome()),
  ...Array.from({ length: POP - 1 }, () => toVector(randomGenome(master))),
];

const evaluate = async (vector: number[]): Promise<number> => {
  const stats = await evaluateVsPool(evoContender("cand", fromVector(vector)), pool, seeds, rules);
  // Pior caso + desempate suave pela media.
  return stats.worstWinRate + 0.01 * stats.meanWinRate;
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
    // Checkpoint a cada geracao (robustez contra corte de tempo).
    writeFileSync(outPath, JSON.stringify(fromVector(bestVector), null, 2));
    console.log(
      `  gen ${String(generation).padStart(2)}: pior=${bestFitness.toFixed(3)} ` +
        `mean=${meanFitness.toFixed(3)} (checkpoint salvo)`,
    );
  },
});

// Grava o campeao final e imprime o breakdown por oponente.
const champion = fromVector(result.bestVector);
writeFileSync(outPath, JSON.stringify(champion, null, 2));
const finalStats = await evaluateVsPool(
  evoContender("melhorada_3", champion),
  pool,
  seeds,
  rules,
);
console.log("\nCampeao (melhorada_3) — taxas por oponente (sementes de treino):");
for (const o of finalStats.perOpponent) {
  console.log(`   vs ${o.name.padEnd(9)} ${(o.winRate * 100).toFixed(1)}%`);
}
console.log(`   PIOR CASO: ${(finalStats.worstWinRate * 100).toFixed(1)}%`);
console.log(`Salvo em src/genomes/melhorada_3.json`);
