/**
 * Estudo executavel do estimador de vitoria da mao.
 *
 *   npm run estimate
 *
 * Mostra, em cenarios concretos, como a chance de vitoria estimada DEPENDE da
 * inteligencia assumida para os demais jogadores (random, inocente, melhorada_1..5)
 * e valida que, na ultima vaza, a enumeracao exata bate o Monte Carlo.
 */

import { manilhaRank } from "../core/ranking.js";
import { RuleSet, TRUCO_PAULISTA, makeManoAMano } from "../core/rules.js";
import { Card, Rank, Seat, Suit, TeamId, cardToString } from "../core/types.js";
import { Play, VazaResult } from "../core/vaza.js";
import { PlayerView } from "../players/player.js";
import { analyzeDoubleDummy } from "./doubleDummy.js";
import { analyzeSingleDummy } from "./singleDummy.js";
import { PolicyId, comparePolicies, estimateWin } from "./winEstimator.js";

const ALL_POLICIES: PolicyId[] = [
  "random",
  "inocente",
  "melhorada_1",
  "melhorada_2",
  "melhorada_3",
  "melhorada_4",
  "melhorada_5",
];

/** Atalho para criar uma carta. */
const C = (rank: Rank, suit: Suit): Card => ({ rank, suit });

/** Mapa assento -> equipe alternando (0,1,0,1,...). */
function alternatingTeams(n: number): TeamId[] {
  return Array.from({ length: n }, (_, s) => s % 2);
}

function buildView(opts: {
  rules: RuleSet;
  seat: Seat;
  hand: Card[];
  vira: Card;
  completedVazaPlays?: Play[][];
  completedVazaResults?: VazaResult[];
  currentVazaPlays?: Play[];
}): PlayerView {
  const teamOfSeat = alternatingTeams(opts.rules.numPlayers);
  return {
    seat: opts.seat,
    team: teamOfSeat[opts.seat]!,
    hand: opts.hand,
    vira: opts.vira,
    manilha: manilhaRank(opts.vira, opts.rules),
    rules: opts.rules,
    scores: new Array(opts.rules.numTeams).fill(0),
    teamOfSeat,
    completedVazaPlays: opts.completedVazaPlays ?? [],
    completedVazaResults: opts.completedVazaResults ?? [],
    currentVazaPlays: opts.currentVazaPlays ?? [],
    handValue: opts.rules.baseValue,
    blind: false,
  };
}

function pct(x: number): string {
  return (100 * x).toFixed(1).padStart(5) + "%";
}

async function printPolicyTable(view: PlayerView, samples: number): Promise<void> {
  const res = await comparePolicies(view, ALL_POLICIES, { samples, seed: 42 });
  console.log("  politica        vitoria   empate    derrota");
  console.log("  " + "-".repeat(46));
  for (const policy of ALL_POLICIES) {
    const e = res[policy]!;
    console.log(
      `  ${policy.padEnd(14)} ${pct(e.winProb)}   ${pct(e.tieProb)}   ${pct(e.lossProb)}`,
    );
  }
}

/** Imprime a analise double-dummy: chance por carta e a recomendacao. */
function printDoubleDummy(view: PlayerView, samples: number): void {
  const dd = analyzeDoubleDummy(view, { samples, seed: 42, mode: "auto" });
  console.log(
    `  double-dummy (jogo otimo, ${dd.method}, ${dd.samples} mundos):`,
  );
  console.log("  carta jogada agora     vitoria   empate    derrota");
  console.log("  " + "-".repeat(52));
  for (const c of dd.cards) {
    console.log(
      `  ${cardToString(c.card).padEnd(20)} ${pct(c.winProb)}   ${pct(c.tieProb)}   ${pct(c.lossProb)}`,
    );
  }
  console.log(
    `  => melhor carta: ${cardToString(dd.bestCard)} (vitoria ${pct(dd.winProb)})`,
  );
}

/** Imprime a analise single-dummy (sem clarividencia) para uma politica. */
async function printSingleDummy(
  view: PlayerView,
  policy: PolicyId,
  samples: number,
): Promise<void> {
  const sd = await analyzeSingleDummy(view, { samples, seed: 42, policy });
  console.log(
    `  single-dummy (sem clarividencia, oponentes='${policy}', ${sd.method}, ${sd.samples} mundos):`,
  );
  console.log("  carta jogada agora     vitoria   empate    derrota");
  console.log("  " + "-".repeat(52));
  for (const c of sd.cards) {
    console.log(
      `  ${cardToString(c.card).padEnd(20)} ${pct(c.winProb)}   ${pct(c.tieProb)}   ${pct(c.lossProb)}`,
    );
  }
  console.log(
    `  => melhor carta: ${cardToString(sd.bestCard)} (vitoria ${pct(sd.winProb)})`,
  );
}

async function scenarioLastTrickManoAMano(): Promise<void> {
  console.log("\n=== Cenario 1: 1v1, ultima vaza (exato vs Monte Carlo) ===");
  const rules = makeManoAMano();
  const vira = C(Rank.Quatro, Suit.Ouros); // manilha = 5
  // Heroi (assento 0, equipe 0) venceu a vaza 1; perdeu a vaza 2 -> a 3a decide.
  // Em empate na 3a vaza, vence quem fez a 1a (o heroi), entao heroi ganha se sua
  // carta for >= a do oponente.
  const v1: Play[] = [
    { seat: 0, card: C(Rank.Tres, Suit.Paus) },
    { seat: 1, card: C(Rank.Dois, Suit.Paus) },
  ];
  const v2: Play[] = [
    { seat: 1, card: C(Rank.Tres, Suit.Copas) },
    { seat: 0, card: C(Rank.Quatro, Suit.Paus) },
  ];
  const r1: VazaResult = { winningTeam: 0, winningSeat: 0, tied: false };
  const r2: VazaResult = { winningTeam: 1, winningSeat: 1, tied: false };
  const view = buildView({
    rules,
    seat: 0,
    hand: [C(Rank.Rei, Suit.Paus)], // carta media na ultima vaza
    vira,
    completedVazaPlays: [v1, v2],
    completedVazaResults: [r1, r2],
    currentVazaPlays: [],
  });

  const exact = await estimateWin(view, { mode: "exact", policy: "inocente" });
  const mc = await estimateWin(view, {
    mode: "montecarlo",
    samples: 20000,
    policy: "inocente",
  });
  console.log(`  mao do heroi: ${view.hand.map(cardToString).join(", ")}`);
  console.log(
    `  exato       : vitoria ${pct(exact.winProb)}  empate ${pct(exact.tieProb)}  derrota ${pct(exact.lossProb)}  (${exact.samples} mundos)`,
  );
  console.log(
    `  monte carlo : vitoria ${pct(mc.winProb)}  empate ${pct(mc.tieProb)}  derrota ${pct(mc.lossProb)}  (${mc.samples} amostras)`,
  );
  console.log(
    "  (na ultima vaza nao ha escolha de jogada: a politica e irrelevante)",
  );
  console.log("");
  printDoubleDummy(view, 3000);
}

async function scenarioStartOfHand2v2(): Promise<void> {
  console.log("\n=== Cenario 2: 2v2, inicio da mao (heroi e a 'mao') ===");
  const rules = TRUCO_PAULISTA;
  const vira = C(Rank.Sete, Suit.Ouros); // manilha = Dama (Q)
  // Mao boa, nao imbativel: uma manilha + duas cartas medias.
  const view = buildView({
    rules,
    seat: 0,
    hand: [
      C(Rank.Dama, Suit.Espadas), // manilha
      C(Rank.As, Suit.Copas),
      C(Rank.Rei, Suit.Ouros),
    ],
    vira,
  });
  console.log(`  vira: ${cardToString(vira)} (manilha = ${view.manilha})`);
  console.log(`  mao do heroi: ${view.hand.map(cardToString).join(", ")}`);
  await printPolicyTable(view, 3000);
  console.log("");
  printDoubleDummy(view, 3000);
  console.log("");
  await printSingleDummy(view, "melhorada_5", 3000);
}

async function scenarioMidHand2v2(): Promise<void> {
  console.log("\n=== Cenario 3: 2v2, meio da mao (heroi venceu a 1a e lidera a 2a) ===");
  const rules = TRUCO_PAULISTA;
  const vira = C(Rank.Cinco, Suit.Ouros); // manilha = Seis (6)
  // Vaza 1: o heroi (assento 0) abriu com a manilha mais forte e levou a vaza.
  const v1: Play[] = [
    { seat: 0, card: C(Rank.Seis, Suit.Paus) }, // manilha de paus (a mais forte)
    { seat: 1, card: C(Rank.As, Suit.Espadas) },
    { seat: 2, card: C(Rank.Quatro, Suit.Copas) },
    { seat: 3, card: C(Rank.Rei, Suit.Ouros) },
  ];
  const r1: VazaResult = { winningTeam: 0, winningSeat: 0, tied: false };
  const view = buildView({
    rules,
    seat: 0,
    hand: [C(Rank.Dois, Suit.Espadas), C(Rank.Sete, Suit.Copas)],
    vira,
    completedVazaPlays: [v1],
    completedVazaResults: [r1],
    currentVazaPlays: [], // heroi venceu a 1a vaza, logo lidera a 2a
  });
  console.log(`  vira: ${cardToString(vira)} (manilha = ${view.manilha})`);
  console.log(`  mao do heroi: ${view.hand.map(cardToString).join(", ")}`);
  await printPolicyTable(view, 3000);
  console.log("");
  printDoubleDummy(view, 3000);
  console.log("");
  await printSingleDummy(view, "melhorada_5", 3000);
}

async function main(): Promise<void> {
  console.log("Estimador de vitoria da mao (sem truco)\n");
  console.log(
    "A chance de vitoria depende da inteligencia assumida para os demais\n" +
      "jogadores: a tabela abaixo varia a politica de rollout.",
  );
  await scenarioLastTrickManoAMano();
  await scenarioStartOfHand2v2();
  await scenarioMidHand2v2();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
