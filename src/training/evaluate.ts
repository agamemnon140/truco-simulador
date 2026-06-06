/**
 * Avaliacao de um genoma treinado contra o inocente, em sementes NOVAS (fora do
 * treino), para medir forca real (sem overfitting de baralho).
 *
 * Uso:  npm run evaluate            (avalia src/genomes/melhorada_1.json)
 *       node ... evaluate.ts <path> (avalia outro genoma)
 *       GAMES=800 SEED=1 npm run evaluate
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TRUCO_PAULISTA } from "../core/rules.js";
import { BotPlayer } from "../players/bot.js";
import { EvolvedBotPlayer } from "../players/evolvedBot.js";
import { parseGenome } from "../players/genome.js";
import { Contender, evaluateContender } from "./arena.js";
import { seededRng } from "./rng.js";

const here = dirname(fileURLToPath(import.meta.url));
const genomePath = process.argv[2] ?? resolve(here, "../genomes/melhorada_1.json");
const GAMES = Number(process.env.GAMES) || 400;
const SEED = Number(process.env.SEED) || 987654; // diferente do treino

const genome = parseGenome(JSON.parse(readFileSync(genomePath, "utf8")));
const rules = TRUCO_PAULISTA;

const inocente: Contender = {
  name: "inocente",
  makePlayer: (seat) => new BotPlayer(`in#${seat}`),
};
const cand: Contender = {
  name: "melhorada",
  makePlayer: (seat, rng) => new EvolvedBotPlayer(`evo#${seat}`, genome, rng),
};

const m = seededRng(SEED);
const seeds = Array.from({ length: GAMES }, () => Math.floor(m() * 1e9));

const stats = await evaluateContender(cand, [inocente], seeds, rules);
console.log(`Genoma: ${genomePath}`);
console.log(`Partidas (sementes novas, espelhadas): ${stats.matches}`);
console.log(`Vitorias da melhorada vs inocente: ${(stats.winRate * 100).toFixed(1)}%`);
console.log(`Saldo medio de pontos (normalizado): ${stats.avgPointDiff.toFixed(3)}`);
console.log(stats.winRate > 0.5 ? "=> Mais forte que o inocente. ✓" : "=> Nao superou o inocente.");
