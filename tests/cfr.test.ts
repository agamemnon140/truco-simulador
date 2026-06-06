import { describe, expect, it } from "vitest";
import { Game } from "../src/equilibrium/game.js";
import { CFRSolver } from "../src/equilibrium/cfr.js";
import { VonNeumannGame } from "../src/equilibrium/games/vonNeumann.js";

/** Matching pennies em forma extensiva (info imperfeita): equilibrio 50/50, v=0. */
class MatchingPennies implements Game<{ h: string }> {
  chanceOutcomes() {
    return [{ prob: 1, state: { h: "" } }];
  }
  isTerminal(s: { h: string }) {
    return s.h.length === 2;
  }
  payoff0(s: { h: string }) {
    return s.h[0] === s.h[1] ? 1 : -1; // jogador 0 ganha se casar
  }
  currentPlayer(s: { h: string }): 0 | 1 {
    return s.h.length === 0 ? 0 : 1;
  }
  infoSet(s: { h: string }) {
    return s.h.length === 0 ? "P0" : "P1"; // P1 nao ve a jogada de P0
  }
  actions() {
    return ["H", "T"];
  }
  next(s: { h: string }, a: string) {
    return { h: s.h + a };
  }
}

describe("CFR — jogo conhecido (matching pennies)", () => {
  it("converge para 50/50 e exploitability ~ 0", () => {
    const solver = new CFRSolver(new MatchingPennies());
    solver.train(3000);
    const s0 = solver.averageStrategy("P0", 2);
    const s1 = solver.averageStrategy("P1", 2);
    expect(s0[0]!).toBeCloseTo(0.5, 1);
    expect(s1[0]!).toBeCloseTo(0.5, 1);
    expect(Math.abs(solver.exploitability())).toBeLessThan(0.05);
  });
});

describe("CFR — validacao vs paper (von Neumann basico, B=2)", () => {
  it("recupera o valor do jogo ~ 1/9 a favor do jogador I", () => {
    const solver = new CFRSolver(new VonNeumannGame(40, 2));
    const value = solver.train(1500);
    expect(value).toBeGreaterThan(0.08); // favorece o jogador I (~0.111)
    expect(value).toBeLessThan(0.14);
    expect(solver.exploitability()).toBeLessThan(0.03);
  });

  it("jogador I aposta com a PIOR mao (blefe) e paga/value com a melhor", () => {
    const g = new VonNeumannGame(40, 2);
    const solver = new CFRSolver(g);
    solver.train(1500);
    // P(bet) na mao mais fraca (i=0) deve ser alta (blefe); na mediana, baixa.
    const pBetWorst = solver.averageStrategy("I0|", 2)[0]!;
    const pBetMid = solver.averageStrategy("I20|", 2)[0]!;
    const pBetBest = solver.averageStrategy("I39|", 2)[0]!;
    expect(pBetWorst).toBeGreaterThan(0.5);
    expect(pBetBest).toBeGreaterThan(0.5);
    expect(pBetMid).toBeLessThan(0.3);
  });
});
