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
import { TrucoLastTrick2v2 } from "./games/trucoLastTrick2v2.js";

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

// ---------- 3) Subjogo do truco 2v2 (jogo de TIME / coordenadores) ----------
function shortLabel(strength: number): string {
  const common = TRUCO_PAULISTA.rankOrder.length;
  if (strength < common) return `${TRUCO_PAULISTA.rankOrder[strength]}`;
  return `m${TRUCO_PAULISTA.manilhaSuitOrder[strength - common]![0]!.toUpperCase()}`;
}

function solveTruco2v2(vira: Card): void {
  console.log(
    `\n══════ Equilibrio (GTO) 2v2: ultima vaza — vira ${cardToString(vira)} ══════`,
  );
  console.log(
    "  (jogo de TIME modelado como 2 COORDENADORES: cada dupla sabe suas 2 cartas.",
  );
  console.log(
    "   E um TETO — duplas reais nao se comunicam. Time A = assentos 0,2; B = 1,3.)",
  );
  const g = new TrucoLastTrick2v2(vira);
  const solver = new CFRSolver(g);
  const step = Math.max(1, Math.floor(ITERS / 5));
  for (let done = 0; done < ITERS; done += step) {
    solver.train(Math.min(step, ITERS - done));
    console.log(
      `  iter ${String(done + step).padStart(5)}: valor(media)=${solver
        .averageStrategyValue()
        .toFixed(4)}  exploitability=${solver.exploitability().toFixed(4)}`,
    );
  }
  console.log(`valor ao Time A (lider) = ${solver.averageStrategyValue().toFixed(4)}`);

  const S = [...new Set(g.chanceOutcomes().map((d) => d.state.s[0]))].sort((a, b) => a - b);
  const hdr = "          outra-> " + S.map((s) => shortLabel(s).padStart(4)).join("");
  // Matriz: P(truco) do Time A por (melhor carta = linha, outra carta = coluna).
  console.log("\nTime A — P(pedir truco) por par de cartas [melhor x outra]:");
  console.log(hdr);
  for (let hi = S.length - 1; hi >= 0; hi--) {
    const best = S[hi]!;
    let row = `  melhor ${shortLabel(best).padEnd(3)} | `;
    for (let lo = 0; lo < S.length; lo++) {
      if (lo > hi) {
        row += "    ";
        continue;
      }
      const a = Math.min(best, S[lo]!);
      const b = Math.max(best, S[lo]!);
      const p = solver.averageStrategy(`A${a},${b}|`, 2)[0]!;
      row += `${Math.round(p * 100)}`.padStart(4);
    }
    console.log(row);
  }
  console.log(
    "\nTime B — P(defender = aceitar+seis | A trucou) por par [melhor x outra]:",
  );
  console.log(hdr);
  for (let hi = S.length - 1; hi >= 0; hi--) {
    const best = S[hi]!;
    let row = `  melhor ${shortLabel(best).padEnd(3)} | `;
    for (let lo = 0; lo < S.length; lo++) {
      if (lo > hi) {
        row += "    ";
        continue;
      }
      const a = Math.min(best, S[lo]!);
      const b = Math.max(best, S[lo]!);
      const r = solver.averageStrategy(`B${a},${b}|truco`, 3); // [fold, accept, seis]
      const defend = r[1]! + r[2]!;
      row += `${Math.round(defend * 100)}`.padStart(4);
    }
    console.log(row);
  }
  console.log(
    "\nLeitura: P(truco) alta com a melhor carta forte (valor); o par 'fraco+fraco'\n" +
      "vira blefe. Com o ZAP garantido, a 2a carta libera mais agressao.",
  );
}

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });
validateVonNeumann();
// vira 4 de paus -> manilha = 5
solveTruco(card(Rank.Quatro, Suit.Paus));
solveTruco2v2(card(Rank.Quatro, Suit.Paus));
