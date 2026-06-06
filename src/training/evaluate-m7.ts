/**
 * Avalia a melhorada_7 em sementes NOVAS e ISOLA a contribuicao da INFERENCIA:
 *  (1) m7 (com modelo) vs cada {inocente, m1..m6};
 *  (2) ablacao: m7-com-modelo vs m7-SEM-modelo (mesmo genoma) — pior caso e
 *      duelo direto;
 *  (3) prova de adaptacao: vs um bot que SEMPRE corre, o quanto o modelo
 *      aumenta a vitoria (deve explorar o foldToTruco).
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
import { OpponentModel } from "../players/opponentModel.js";
import { Genome, parseGenome } from "../players/genome.js";
import {
  Action,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  RaiseResponse,
} from "../players/player.js";
import { Contender, evaluateContender } from "./arena.js";
import { seededRng } from "./rng.js";

const rules = TRUCO_PAULISTA;
const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../genomes");
const load = (file: string): Genome => parseGenome(JSON.parse(readFileSync(resolve(dir, file), "utf8")));
const num = (n: string, d: number) => (Number(process.env[n]) > 0 ? Number(process.env[n]) : d);

const GAMES = num("GAMES", 300);
const master = seededRng(num("SEED", 5151));
const seeds = Array.from({ length: GAMES }, () => Math.floor(master() * 1e9));
const pct = (w: number) => `${(w * 100).toFixed(1)}%`;

const g: Record<string, Genome> = {};
for (const i of [1, 2, 3, 4, 5, 6, 7]) g[`m${i}`] = load(`melhorada_${i}.json`);

/** Bot que NUNCA truca e SEMPRE corre quando trucado (puro "folder"). */
class FolderBot implements Player {
  constructor(readonly name: string) {}
  async chooseAction(view: PlayerView): Promise<Action> {
    return { type: "play", card: view.hand[0]! };
  }
  async respondToRaise(): Promise<RaiseResponse> {
    return "run";
  }
  async decideMaoDeOnze(): Promise<MaoDeOnzeDecision> {
    return "fold";
  }
}

const evo = (name: string, genome: Genome): Contender => ({
  name,
  makePlayer: (seat: number, rng: Rng) => new EvolvedBotPlayer(`${name}#${seat}`, genome, rng),
});
const m7model = (name: string, genome: Genome): Contender => ({
  name,
  makePlayer: (seat: number, rng: Rng) =>
    new EvolvedBotPlayer(`${name}#${seat}`, genome, rng, undefined, false, new OpponentModel(rules)),
});
const inocente: Contender = { name: "inocente", makePlayer: (seat) => new BotPlayer(`inocente#${seat}`) };
const folder: Contender = { name: "folder", makePlayer: (seat) => new FolderBot(`folder#${seat}`) };

console.log(`Avaliacao da m7 — GAMES=${GAMES}/confronto, sementes novas\n`);

// (1) m7 (com modelo) vs pool.
console.log("m7 (com modelo de oponente) vs pool:");
const pool: Contender[] = [inocente, ...[1, 2, 3, 4, 5, 6].map((i) => evo(`m${i}`, g[`m${i}`]!))];
let worst = 1;
for (const opp of pool) {
  const s = await evaluateContender(m7model("m7", g.m7!), [opp], seeds, rules);
  worst = Math.min(worst, s.winRate);
  console.log(`   vs ${opp.name.padEnd(9)} ${pct(s.winRate)}`);
}
console.log(`   pior caso = ${pct(worst)}`);

// (2) Ablacao: m7 SEM modelo (mesmo genoma) vs pool.
console.log("\nAblacao (a) — m7 SEM modelo (estatico) vs pool:");
let worstStatic = 1;
for (const opp of pool) {
  const s = await evaluateContender(evo("m7s", g.m7!), [opp], seeds, rules);
  worstStatic = Math.min(worstStatic, s.winRate);
  console.log(`   vs ${opp.name.padEnd(9)} ${pct(s.winRate)}`);
}
console.log(`   pior caso (estatico) = ${pct(worstStatic)}`);
const h2h = await evaluateContender(m7model("m7", g.m7!), [evo("m7s", g.m7!)], seeds, rules);
console.log(`Ablacao (b) — m7-com-modelo vs m7-sem-modelo (duelo): ${pct(h2h.winRate)} (>50% = inferencia agrega)`);

// (3) Prova de adaptacao: vs um "folder", o modelo deve explorar e ganhar mais.
const vsFolderModel = await evaluateContender(m7model("m7", g.m7!), [folder], seeds, rules);
const vsFolderStatic = await evaluateContender(evo("m7s", g.m7!), [folder], seeds, rules);
console.log(
  `\nAdaptacao — vs um bot que SEMPRE corre: com modelo=${pct(vsFolderModel.winRate)} ` +
    `sem modelo=${pct(vsFolderStatic.winRate)} ` +
    `(delta ${((vsFolderModel.winRate - vsFolderStatic.winRate) * 100).toFixed(1)}pp)`,
);
