/**
 * Avaliacao de um genoma treinado contra o inocente, em sementes NOVAS (fora do
 * treino), para medir forca real (sem overfitting de baralho).
 *
 * Uso:  npm run evaluate                       (melhorada_1 vs inocente)
 *       npm run evaluate <genomaA>             (genomaA vs inocente)
 *       npm run evaluate <genomaA> <genomaB>   (genomaA vs genomaB)
 *       GAMES=800 SEED=1 npm run evaluate ...
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
const candPath = process.argv[2] ?? resolve(here, "../genomes/melhorada_1.json");
const oppPath = process.argv[3]; // opcional: genoma adversario (default inocente)
const GAMES = Number(process.env.GAMES) || 400;
const SEED = Number(process.env.SEED) || 987654; // diferente do treino

const rules = TRUCO_PAULISTA;
const loadGenome = (p: string) => parseGenome(JSON.parse(readFileSync(p, "utf8")));
const baseName = (p: string) => p.replace(/\\/g, "/").split("/").pop();

const candGenome = loadGenome(candPath);
const cand: Contender = {
  name: baseName(candPath) ?? "candidato",
  makePlayer: (seat, rng) => new EvolvedBotPlayer(`A#${seat}`, candGenome, rng),
};

let opponent: Contender;
if (oppPath) {
  const oppGenome = loadGenome(oppPath);
  opponent = {
    name: baseName(oppPath) ?? "adversario",
    makePlayer: (seat, rng) => new EvolvedBotPlayer(`B#${seat}`, oppGenome, rng),
  };
} else {
  opponent = { name: "inocente", makePlayer: (seat) => new BotPlayer(`B#${seat}`) };
}

const m = seededRng(SEED);
const seeds = Array.from({ length: GAMES }, () => Math.floor(m() * 1e9));

const stats = await evaluateContender(cand, [opponent], seeds, rules);
console.log(`Confronto: ${cand.name}  vs  ${opponent.name}`);
console.log(`Partidas (sementes novas, espelhadas): ${stats.matches}`);
console.log(`Vitorias de ${cand.name}: ${(stats.winRate * 100).toFixed(1)}%`);
console.log(`Saldo medio de pontos (normalizado): ${stats.avgPointDiff.toFixed(3)}`);
console.log(
  stats.winRate > 0.5
    ? `=> ${cand.name} e mais forte que ${opponent.name}. ✓`
    : `=> ${cand.name} nao superou ${opponent.name}.`,
);
