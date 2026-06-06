/**
 * Resolve subjogos por CFR e imprime: a VALIDACAO contra a forma fechada do
 * paper (von Neumann), e o EQUILIBRIO (GTO) do subjogo "ultima vaza 1v1" do
 * truco — com a exploitability caindo e as frequencias GTO por forca de carta.
 *
 * Uso: npm run solve            (vira padrao 4 de paus -> manilha 5)
 *      ITERS=4000 npm run solve
 */

import { TRUCO_PAULISTA } from "../core/rules.js";
import { Card, Rank, Suit, cardToString } from "../core/types.js";
import { CFRSolver } from "./cfr.js";
import { VonNeumannGame } from "./games/vonNeumann.js";
import { TrucoLastTrickGame } from "./games/trucoLastTrick.js";

const ITERS = Number(process.env.ITERS) || 3000;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

// ---------- 1) Validacao vs paper ----------
function validateVonNeumann(): void {
  console.log("══════ Validacao: von Neumann basico (B=2) vs forma fechada ══════");
  const N = 80;
  const g = new VonNeumannGame(N, 2);
  const solver = new CFRSolver(g);
  solver.train(ITERS);
  console.log(
    `valor CFR = ${solver.averageStrategyValue().toFixed(4)}   ` +
      `(forma fechada: 1/9 = ${(1 / 9).toFixed(4)})`,
  );
  console.log(`exploitability = ${solver.exploitability().toFixed(4)}`);

  // Limiares a (I para de blefar), b (I volta a apostar por valor), c (II paga).
  let a = N, b = N, c = N;
  for (let i = 0; i < N; i++) {
    const pBet = solver.averageStrategy(`I${i}|`, 2)[0]!;
    if (a === N && pBet < 0.5) a = i; // primeira mao que NAO blefa
  }
  for (let i = N - 1; i >= 0; i--) {
    const pBet = solver.averageStrategy(`I${i}|`, 2)[0]!;
    if (pBet < 0.5) {
      b = i + 1;
      break;
    }
  }
  for (let j = 0; j < N; j++) {
    const pCall = solver.averageStrategy(`II${j}|bet`, 2)[0]!;
    if (pCall > 0.5) {
      c = j;
      break;
    }
  }
  console.log(
    `limiares CFR:  a=${(a / N).toFixed(2)} (paper 0.11)   ` +
      `b=${(b / N).toFixed(2)} (paper 0.78)   c=${(c / N).toFixed(2)} (paper 0.56)`,
  );
}

// ---------- 2) Subjogo do truco ----------
function strengthLabel(strength: number): string {
  const common = TRUCO_PAULISTA.rankOrder.length; // 10
  if (strength < common) return `${TRUCO_PAULISTA.rankOrder[strength]} (comum)`;
  const suit = TRUCO_PAULISTA.manilhaSuitOrder[strength - common]!;
  return `manilha ${suit}`;
}

function solveTruco(vira: Card): void {
  console.log(`\n══════ Equilibrio (GTO): ultima vaza 1v1 do truco — vira ${cardToString(vira)} ══════`);
  const g = new TrucoLastTrickGame(vira);
  const solver = new CFRSolver(g);

  // Convergencia (exploitability caindo).
  const step = Math.max(1, Math.floor(ITERS / 5));
  for (let done = 0; done < ITERS; done += step) {
    solver.train(Math.min(step, ITERS - done));
    console.log(
      `  iter ${String(done + step).padStart(5)}: ` +
        `valor(media)=${solver.averageStrategyValue().toFixed(4)}  ` +
        `exploitability=${solver.exploitability().toFixed(4)}`,
    );
  }
  console.log(
    `valor do subjogo ao Jogador I = ${solver.averageStrategyValue().toFixed(4)} ` +
      `(>0 favorece quem age primeiro)`,
  );

  // Forcas presentes (exceto a da vira), ordenadas.
  const strengths = [...new Set(g.chanceOutcomes().map((d) => g.strength(d.state.ci)))].sort(
    (x, y) => x - y,
  );

  console.log("\nFrequencias GTO por forca de carta:");
  console.log("  forca                | I: truco | II resp(corre/aceita/seis) | I vs seis(corre/aceita)");
  for (const s of strengths) {
    const iTruco = solver.averageStrategy(`Is${s}|`, 2)[0]!; // [truco, check]
    const iiResp = solver.averageStrategy(`IIs${s}|truco`, 3); // [fold, accept, seis]
    const iSeis = solver.averageStrategy(`Is${s}|truco:seis`, 2); // [fold, accept]
    console.log(
      `  ${strengthLabel(s).padEnd(20)} |  ${pct(iTruco).padStart(5)}  | ` +
        `${pct(iiResp[0]!)}/${pct(iiResp[1]!)}/${pct(iiResp[2]!)}`.padStart(18) +
        ` | ${pct(iSeis[0]!)}/${pct(iSeis[1]!)}`,
    );
  }
  console.log(
    "\nLeitura: espere TRUCO alto nas piores (blefe) e nas melhores (valor); II paga/aumenta so com as fortes.",
  );
}

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });
validateVonNeumann();
// vira 4 de paus -> manilha = 5
solveTruco(card(Rank.Quatro, Suit.Paus));
