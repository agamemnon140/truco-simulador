/**
 * Avalia a melhorada_6 em sementes NOVAS (fora do treino) e ISOLA os dois efeitos:
 *  (a) quanto a COMUNICACAO agrega (m5/m6 vs inocente, com vs sem o canal);
 *  (b) quanto as features de intuicao GTO agregam (m6 vs m6-sem-GTO, ambos comunicando).
 *
 * Env: GAMES (por confronto), SEED.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TRUCO_PAULISTA } from "../core/rules.js";
import { Rng } from "../core/deck.js";
import { BotPlayer } from "../players/bot.js";
import { EvolvedBotPlayer } from "../players/evolvedBot.js";
import { Genome, parseGenome } from "../players/genome.js";
import { Contender, evaluateContender } from "./arena.js";
import { seededRng } from "./rng.js";

const rules = TRUCO_PAULISTA;
const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../genomes");
const load = (file: string): Genome =>
  parseGenome(JSON.parse(readFileSync(resolve(dir, file), "utf8")));
const num = (n: string, d: number) => (Number(process.env[n]) > 0 ? Number(process.env[n]) : d);

const GAMES = num("GAMES", 300);
const master = seededRng(num("SEED", 4242)); // sementes NOVAS (diferentes do treino)
const seeds = Array.from({ length: GAMES }, () => Math.floor(master() * 1e9));
const pct = (w: number) => `${(w * 100).toFixed(1)}%`;

const g: Record<string, Genome> = {};
for (const i of [1, 2, 3, 4, 5, 6]) g[`m${i}`] = load(`melhorada_${i}.json`);

const evo = (name: string, genome: Genome, ignoreSignals = false): Contender => ({
  name,
  makePlayer: (seat: number, rng: Rng) =>
    new EvolvedBotPlayer(`${name}#${seat}`, genome, rng, undefined, ignoreSignals),
});
const inocente: Contender = { name: "inocente", makePlayer: (seat) => new BotPlayer(`inocente#${seat}`) };

console.log(`Avaliacao da m6 — GAMES=${GAMES}/confronto, sementes novas\n`);

// (1) m6 vs cada oponente (todos comunicando).
console.log("m6 vs pool (todos comunicando):");
const pool: Contender[] = [inocente, ...[1, 2, 3, 4, 5].map((i) => evo(`m${i}`, g[`m${i}`]!))];
let worst = 1;
for (const opp of pool) {
  const s = await evaluateContender(evo("m6", g.m6!), [opp], seeds, rules);
  worst = Math.min(worst, s.winRate);
  console.log(`   vs ${opp.name.padEnd(9)} ${pct(s.winRate)}`);
}
console.log(`   pior caso = ${pct(worst)}`);

// (2) Isolar a COMUNICACAO: vs inocente (que NAO comunica), com vs sem o canal.
console.log("\nIsolamento (a) — quanto a COMUNICACAO agrega (vs inocente):");
for (const name of ["m5", "m6"]) {
  const on = await evaluateContender(evo(name, g[name]!, false), [inocente], seeds, rules);
  const off = await evaluateContender(evo(name, g[name]!, true), [inocente], seeds, rules);
  const d = (on.winRate - off.winRate) * 100;
  console.log(
    `   ${name}: com=${pct(on.winRate)}  sem=${pct(off.winRate)}  (delta ${d >= 0 ? "+" : ""}${d.toFixed(1)}pp)`,
  );
}

// (3) Isolar as features GTO: m6 vs m6-sem-GTO (zera os 2 pesos GTO), ambos comunicando.
const g6noGTO: Genome = { ...g.m6!, betWeights: [...g.m6!.betWeights] };
g6noGTO.betWeights[g6noGTO.betWeights.length - 1] = 0;
g6noGTO.betWeights[g6noGTO.betWeights.length - 2] = 0;
const h2h = await evaluateContender(evo("m6", g.m6!), [evo("m6noGTO", g6noGTO)], seeds, rules);
console.log(
  `\nIsolamento (b) — m6 vs m6-SEM-features-GTO (ambos comunicam): ${pct(h2h.winRate)} ` +
    `(>50% = a intuicao GTO agrega)`,
);
