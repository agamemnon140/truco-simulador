/**
 * Avalia a dupla "maco" numa forca escolhida (env MACO, default DEFAULT_MACO_STRENGTH):
 *  (1) maco COM trapaca vs cada {inocente, m1..m6};
 *  (2) ablacao: maco SEM trapaca (macoStrength=0) vs o pool — quanto a trapaca agrega;
 *  (3) roubo: vs um bot que sempre corre.
 *
 * Env: GAMES, SEED, MACO (forca).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Rng } from "../core/deck.js";
import { TRUCO_PAULISTA } from "../core/rules.js";
import { BotPlayer } from "../players/bot.js";
import { EvolvedBotPlayer } from "../players/evolvedBot.js";
import { Genome, parseGenome } from "../players/genome.js";
import { DEFAULT_MACO_STRENGTH, MacoPlayer, macoCheat } from "../players/macoPlayer.js";
import { Action, MaoDeOnzeDecision, Player, PlayerView, RaiseResponse } from "../players/player.js";
import { Contender, evaluateContender } from "./arena.js";
import { seededRng } from "./rng.js";

const rules = TRUCO_PAULISTA;
const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../genomes");
const load = (f: string): Genome => parseGenome(JSON.parse(readFileSync(resolve(dir, f), "utf8")));
const num = (n: string, d: number) => (Number(process.env[n]) > 0 ? Number(process.env[n]) : d);

const GAMES = num("GAMES", 250);
const STRENGTH = Number(process.env.MACO) >= 0 ? Number(process.env.MACO) : DEFAULT_MACO_STRENGTH;
const master = seededRng(num("SEED", 313));
const seeds = Array.from({ length: GAMES }, () => Math.floor(master() * 1e9));
const pct = (w: number) => `${(w * 100).toFixed(1)}%`;

const g: Record<string, Genome> = {};
for (const i of [1, 2, 3, 4, 5, 6]) g[`m${i}`] = load(`melhorada_${i}.json`);

class FolderBot implements Player {
  constructor(readonly name: string) {}
  async chooseAction(v: PlayerView): Promise<Action> {
    return { type: "play", card: v.hand[0]! };
  }
  async respondToRaise(): Promise<RaiseResponse> {
    return "run";
  }
  async decideMaoDeOnze(): Promise<MaoDeOnzeDecision> {
    return "fold";
  }
}

const evo = (name: string, gen: Genome): Contender => ({
  name,
  makePlayer: (seat: number, rng: Rng) => new EvolvedBotPlayer(`${name}#${seat}`, gen, rng),
});
const inocente: Contender = { name: "inocente", makePlayer: (seat) => new BotPlayer(`inocente#${seat}`) };
const folder: Contender = { name: "folder", makePlayer: (seat) => new FolderBot(`folder#${seat}`) };
const maco = (s: number): Contender => ({
  name: `maco@${s}`,
  makePlayer: (seat: number, rng: Rng) =>
    new MacoPlayer(`maco#${seat}`, g.m6!, { cheat: macoCheat(s), rules }, rng),
});

const pool: Contender[] = [inocente, ...[1, 2, 3, 4, 5, 6].map((i) => evo(`m${i}`, g[`m${i}`]!))];

console.log(`Avaliacao do maco — forca=${STRENGTH}, GAMES=${GAMES}/confronto\n`);
console.log("maco COM trapaca vs pool   |   m6 HONESTO (sem trapaca):");
let mWorst = 1;
for (const opp of pool) {
  const on = await evaluateContender(maco(STRENGTH), [opp], seeds, rules);
  const off = await evaluateContender(evo("m6", g.m6!), [opp], seeds, rules);
  mWorst = Math.min(mWorst, on.winRate);
  const d = (on.winRate - off.winRate) * 100;
  console.log(
    `   vs ${opp.name.padEnd(9)} ${pct(on.winRate)}   |   ${pct(off.winRate)}   (trapaca ${d >= 0 ? "+" : ""}${d.toFixed(1)}pp)`,
  );
}
console.log(`   pior caso (com trapaca) = ${pct(mWorst)}`);

const vsFolder = await evaluateContender(maco(STRENGTH), [folder], seeds, rules);
console.log(`\nRoubo — vs um bot que SEMPRE corre: ${pct(vsFolder.winRate)}`);
