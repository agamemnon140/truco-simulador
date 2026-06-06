/**
 * Treino genetico: evolui a inteligencia em ESCADA (hall of fame).
 *   melhorada_1 treina vs {inocente}
 *   melhorada_2 treina vs {inocente, melhorada_1}
 *   ...
 * Grava cada vencedor em src/genomes/melhorada_N.json.
 *
 * Parametros por variavel de ambiente (com defaults modestos):
 *   POP, GENS, GAMES, RUNGS, SEED
 * Ex.: GENS=30 GAMES=120 RUNGS=2 npm run train
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TRUCO_PAULISTA } from "../core/rules.js";
import { BotPlayer } from "../players/bot.js";
import { EvolvedBotPlayer } from "../players/evolvedBot.js";
import {
  Genome,
  GENOME_LENGTH,
  fromVector,
  randomGenome,
  seedGenome,
  toVector,
} from "../players/genome.js";
import { Contender, evaluateContender } from "./arena.js";
import { runGA } from "./ga.js";
import { seededRng } from "./rng.js";

function envNum(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

const POP = envNum("POP", 30);
const GENS = envNum("GENS", 20);
const GAMES = envNum("GAMES", 60);
const RUNGS = envNum("RUNGS", 1);
const SEED = envNum("SEED", 12345);

const rules = TRUCO_PAULISTA;
const master = seededRng(SEED);

const inocente: Contender = {
  name: "inocente",
  makePlayer: (seat) => new BotPlayer(`inocente#${seat}`),
};
const evoContender = (name: string, g: Genome): Contender => ({
  name,
  makePlayer: (seat, rng) => new EvolvedBotPlayer(`${name}#${seat}`, g, rng),
});

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../genomes");
mkdirSync(outDir, { recursive: true });

const opponents: Contender[] = [inocente];

console.log(
  `Treino genetico — POP=${POP} GENS=${GENS} GAMES=${GAMES}(x2) RUNGS=${RUNGS} ` +
    `SEED=${SEED} genomeLen=${GENOME_LENGTH}`,
);

for (let rung = 1; rung <= RUNGS; rung++) {
  // Sementes fixas deste degrau (common random numbers).
  const seeds = Array.from({ length: GAMES }, () => Math.floor(master() * 1e9));

  // Populacao inicial: 1 semente "a mao" + aleatorios.
  const initial = [
    toVector(seedGenome()),
    ...Array.from({ length: POP - 1 }, () => toVector(randomGenome(master))),
  ];

  console.log(
    `\n=== Degrau ${rung}: treinando vs [${opponents.map((o) => o.name).join(", ")}] ===`,
  );

  const evaluate = async (vector: number[]): Promise<number> => {
    const stats = await evaluateContender(
      evoContender("cand", fromVector(vector)),
      opponents,
      seeds,
      rules,
    );
    return stats.fitness;
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
    onGeneration: ({ generation, bestFitness, meanFitness }) =>
      console.log(
        `  gen ${String(generation).padStart(2)}: ` +
          `best=${bestFitness.toFixed(3)} mean=${meanFitness.toFixed(3)}`,
      ),
  });

  const best = fromVector(result.bestVector);
  const name = `melhorada_${rung}`;
  writeFileSync(resolve(outDir, `${name}.json`), JSON.stringify(best, null, 2));
  console.log(
    `  -> ${name}: fitness ${result.bestFitness.toFixed(3)} ` +
      `(salvo em src/genomes/${name}.json)`,
  );

  // Entra no hall of fame para o proximo degrau.
  opponents.push(evoContender(name, best));
}

console.log("\nTreino concluido.");
