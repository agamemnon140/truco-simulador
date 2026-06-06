/**
 * "Round-robin SIMPLES": varre a FORCA do maco (`macoStrength` 0..1) e mede a
 * taxa de vitoria media da dupla maco vs o pool {inocente, m1..m6}. Objetivo:
 * escolher uma forca FORTE MAS BATIVEL (nao ~100%).
 *
 * Env: GAMES (por confronto), SEED.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Rng } from "../core/deck.js";
import { TRUCO_PAULISTA } from "../core/rules.js";
import { BotPlayer } from "../players/bot.js";
import { EvolvedBotPlayer } from "../players/evolvedBot.js";
import { Genome, parseGenome } from "../players/genome.js";
import { MacoPlayer, macoCheat } from "../players/macoPlayer.js";
import { Contender, evaluateContender } from "./arena.js";
import { seededRng } from "./rng.js";

const rules = TRUCO_PAULISTA;
const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../genomes");
const load = (f: string): Genome => parseGenome(JSON.parse(readFileSync(resolve(dir, f), "utf8")));
const num = (n: string, d: number) => (Number(process.env[n]) > 0 ? Number(process.env[n]) : d);

const GAMES = num("GAMES", 150);
const master = seededRng(num("SEED", 909));
const seeds = Array.from({ length: GAMES }, () => Math.floor(master() * 1e9));

const g: Record<string, Genome> = {};
for (const i of [1, 2, 3, 4, 5, 6]) g[`m${i}`] = load(`melhorada_${i}.json`);

const evo = (name: string, gen: Genome): Contender => ({
  name,
  makePlayer: (seat: number, rng: Rng) => new EvolvedBotPlayer(`${name}#${seat}`, gen, rng),
});
const inocente: Contender = { name: "inocente", makePlayer: (seat) => new BotPlayer(`inocente#${seat}`) };
const pool: Contender[] = [inocente, ...[1, 2, 3, 4, 5, 6].map((i) => evo(`m${i}`, g[`m${i}`]!))];

const maco = (s: number): Contender => ({
  name: `maco@${s}`,
  makePlayer: (seat: number, rng: Rng) =>
    new MacoPlayer(`maco#${seat}`, g.m6!, { cheat: macoCheat(s), rules }, rng),
});

console.log(`Calibracao do maco — GAMES=${GAMES}/confronto, vitoria media vs pool:\n`);
for (const s of [0, 0.2, 0.4, 0.6, 0.8, 1.0]) {
  let sum = 0;
  let worst = 1;
  for (const opp of pool) {
    const r = await evaluateContender(maco(s), [opp], seeds, rules);
    sum += r.winRate;
    worst = Math.min(worst, r.winRate);
  }
  const mean = sum / pool.length;
  console.log(
    `  macoStrength=${s.toFixed(1)}  media=${(mean * 100).toFixed(1)}%  pior=${(worst * 100).toFixed(1)}%`,
  );
}
console.log("\nEscolha a forca na banda FORTE MAS BATIVEL (ex.: media ~55-65%).");
