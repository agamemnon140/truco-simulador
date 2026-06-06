import { describe, expect, it } from "vitest";
import { deal } from "../src/core/deck.js";
import {
  BET_FEATURE_NAMES,
  CARD_FEATURE_NAMES,
  BET_FEATURE_COUNT,
  CARD_FEATURE_COUNT,
} from "../src/players/features.js";
import {
  differentiatingContributions,
  explainBetting,
  explainCardChoice,
} from "../src/players/explain.js";
import { seedGenome } from "../src/players/genome.js";
import { makeView, seededRng } from "./helpers.js";

describe("explain — nomes das features", () => {
  it("os arrays de nomes tem o tamanho dos vetores", () => {
    expect(CARD_FEATURE_NAMES.length).toBe(CARD_FEATURE_COUNT);
    expect(BET_FEATURE_NAMES.length).toBe(BET_FEATURE_COUNT);
  });
});

describe("explain — contribuicoes somam o score", () => {
  const genome = seedGenome();

  it("cardScore = soma das contribuicoes, para cada carta", () => {
    for (let i = 0; i < 20; i++) {
      const d = deal(4, 3, seededRng(200 + i));
      const view = makeView({ hand: d.hands[0]!, vira: d.vira });
      const exp = explainCardChoice(genome, view);
      for (const card of exp.cards) {
        const sum = card.contributions.reduce((s, c) => s + c.contribution, 0);
        expect(sum).toBeCloseTo(card.score, 9);
      }
      // chosenIndex e mesmo o de maior score.
      const best = exp.cards.reduce((bi, c, idx, arr) => (c.score > arr[bi]!.score ? idx : bi), 0);
      expect(exp.chosenIndex).toBe(best);
    }
  });

  it("S = soma das contribuicoes de aposta", () => {
    const d = deal(4, 3, seededRng(999));
    const view = makeView({ hand: d.hands[0]!, vira: d.vira });
    const exp = explainBetting(genome, view);
    const sum = exp.contributions.reduce((s, c) => s + c.contribution, 0);
    expect(sum).toBeCloseTo(exp.s, 9);
  });
});

describe("explain — contribuicao diferencial", () => {
  it("features constantes entre as cartas nao aparecem como diferenciais", () => {
    const d = deal(4, 3, seededRng(7));
    const view = makeView({ hand: d.hands[0]!, vira: d.vira });
    const exp = explainCardChoice(genome0(), view);
    const diffs = differentiatingContributions(exp, exp.chosenIndex, 8);
    // 'bias' e features de contexto sao iguais para todas as cartas -> diff ~ 0.
    for (const d2 of diffs) {
      expect(["bias", "rodada", "valorEmJogo", "posicaoVaza"]).not.toContain(d2.name);
    }
  });
});

function genome0() {
  return seedGenome();
}
