/**
 * Testes da analise double-dummy (src/analysis/doubleDummy.ts).
 */

import { describe, expect, it } from "vitest";
import { manilhaRank } from "../src/core/ranking.js";
import { RuleSet, TRUCO_PAULISTA, makeManoAMano } from "../src/core/rules.js";
import { Card, Rank, Seat, Suit, TeamId, cardsEqual } from "../src/core/types.js";
import { Play, VazaResult } from "../src/core/vaza.js";
import { PlayerView } from "../src/players/player.js";
import { analyzeDoubleDummy } from "../src/analysis/doubleDummy.js";
import { estimateWin } from "../src/analysis/winEstimator.js";

const C = (rank: Rank, suit: Suit): Card => ({ rank, suit });

function buildView(opts: {
  rules: RuleSet;
  seat: Seat;
  hand: Card[];
  vira: Card;
  completedVazaPlays?: Play[][];
  completedVazaResults?: VazaResult[];
  currentVazaPlays?: Play[];
}): PlayerView {
  const teamOfSeat: TeamId[] = Array.from(
    { length: opts.rules.numPlayers },
    (_, s) => s % 2,
  );
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

/** Cenario 1v1 da ultima vaza: heroi com K de paus (vence se forca oponente <= 6). */
function lastTrickView(): PlayerView {
  const rules = makeManoAMano();
  const vira = C(Rank.Quatro, Suit.Ouros); // manilha = 5
  const v1: Play[] = [
    { seat: 0, card: C(Rank.Tres, Suit.Paus) },
    { seat: 1, card: C(Rank.Dois, Suit.Ouros) },
  ];
  const v2: Play[] = [
    { seat: 1, card: C(Rank.Cinco, Suit.Paus) },
    { seat: 0, card: C(Rank.Sete, Suit.Copas) },
  ];
  return buildView({
    rules,
    seat: 0,
    hand: [C(Rank.Rei, Suit.Paus)],
    vira,
    completedVazaPlays: [v1, v2],
    completedVazaResults: [
      { winningTeam: 0, winningSeat: 0, tied: false },
      { winningTeam: 1, winningSeat: 1, tied: false },
    ],
  });
}

describe("analyzeDoubleDummy", () => {
  it("ultima vaza: bate o calculo a mao (21/34) e e exato", () => {
    const res = analyzeDoubleDummy(lastTrickView(), { mode: "exact" });
    expect(res.method).toBe("exact");
    expect(res.samples).toBe(34);
    expect(res.winProb).toBeCloseTo(21 / 34, 10);
    expect(res.lossProb).toBeCloseTo(13 / 34, 10);
    expect(res.cards).toHaveLength(1);
    expect(cardsEqual(res.bestCard, C(Rank.Rei, Suit.Paus))).toBe(true);
  });

  it("e livre de politica: igual ao estimador na ultima vaza", async () => {
    const view = lastTrickView();
    const dd = analyzeDoubleDummy(view, { mode: "exact" });
    const est = await estimateWin(view, { mode: "exact", policy: "melhorada_5" });
    expect(dd.winProb).toBeCloseTo(est.winProb, 10);
  });

  it("mao dominada: heroi com a zap na ultima vaza vence sempre", () => {
    const rules = makeManoAMano();
    const vira = C(Rank.Quatro, Suit.Ouros); // manilha = 5
    const v1: Play[] = [
      { seat: 0, card: C(Rank.Tres, Suit.Copas) },
      { seat: 1, card: C(Rank.Dois, Suit.Copas) },
    ];
    const v2: Play[] = [
      { seat: 1, card: C(Rank.As, Suit.Ouros) },
      { seat: 0, card: C(Rank.Quatro, Suit.Paus) },
    ];
    const view = buildView({
      rules,
      seat: 0,
      hand: [C(Rank.Cinco, Suit.Paus)], // zap
      vira,
      completedVazaPlays: [v1, v2],
      completedVazaResults: [
        { winningTeam: 0, winningSeat: 0, tied: false },
        { winningTeam: 1, winningSeat: 1, tied: false },
      ],
    });
    const res = analyzeDoubleDummy(view, { mode: "exact" });
    expect(res.winProb).toBe(1);
    expect(res.lossProb).toBe(0);
    expect(cardsEqual(res.bestCard, C(Rank.Cinco, Suit.Paus))).toBe(true);
  });

  it("heroi ja venceu a 1a e tem a zap: posicao vale 1 com qualquer carta", () => {
    const rules = makeManoAMano();
    const vira = C(Rank.Quatro, Suit.Ouros); // manilha = 5
    // Vaza 1 vencida pelo heroi (3 de copas > 2 de copas).
    const v1: Play[] = [
      { seat: 0, card: C(Rank.Tres, Suit.Copas) },
      { seat: 1, card: C(Rank.Dois, Suit.Copas) },
    ];
    const view = buildView({
      rules,
      seat: 0,
      hand: [C(Rank.Cinco, Suit.Paus), C(Rank.Quatro, Suit.Ouros)], // zap + carta fraca
      vira,
      completedVazaPlays: [v1],
      completedVazaResults: [{ winningTeam: 0, winningSeat: 0, tied: false }],
    });
    const res = analyzeDoubleDummy(view, { mode: "exact" });
    // Venceu a 1a vaza e tem a zap -> garante a 2a vaza que jogar -> vence a mao.
    expect(res.winProb).toBe(1);
    expect(res.cards).toHaveLength(2);
    expect(res.cards.every((c) => c.winProb === 1)).toBe(true);
  });

  it("probabilidades somam ~1 e a melhor carta esta na mao (2v2)", () => {
    const rules = TRUCO_PAULISTA;
    const vira = C(Rank.Sete, Suit.Ouros);
    const hand = [
      C(Rank.Dama, Suit.Espadas),
      C(Rank.As, Suit.Copas),
      C(Rank.Rei, Suit.Ouros),
    ];
    const view = buildView({ rules, seat: 0, hand, vira });
    const res = analyzeDoubleDummy(view, { samples: 800, seed: 5 });
    expect(res.method).toBe("montecarlo");
    expect(res.winProb + res.tieProb + res.lossProb).toBeCloseTo(1, 9);
    expect(res.cards).toHaveLength(3);
    expect(hand.some((c) => cardsEqual(c, res.bestCard))).toBe(true);
    // EV ordenado de forma decrescente.
    for (let i = 1; i < res.cards.length; i++) {
      expect(res.cards[i - 1]!.ev).toBeGreaterThanOrEqual(res.cards[i]!.ev);
    }
  });

  it("e deterministico para a mesma semente", () => {
    const rules = TRUCO_PAULISTA;
    const vira = C(Rank.Sete, Suit.Ouros);
    const view = buildView({
      rules,
      seat: 0,
      hand: [
        C(Rank.Dama, Suit.Espadas),
        C(Rank.As, Suit.Copas),
        C(Rank.Rei, Suit.Ouros),
      ],
      vira,
    });
    const a = analyzeDoubleDummy(view, { samples: 400, seed: 3 });
    const b = analyzeDoubleDummy(view, { samples: 400, seed: 3 });
    expect(a.winProb).toBe(b.winProb);
    expect(cardsEqual(a.bestCard, b.bestCard)).toBe(true);
  });

  it("lanca erro se nao for a vez do heroi", () => {
    const rules = makeManoAMano();
    const vira = C(Rank.Quatro, Suit.Ouros);
    // Heroi (assento 0) ja jogou nesta vaza -> quem joga agora e o assento 1.
    const view = buildView({
      rules,
      seat: 0,
      hand: [C(Rank.Tres, Suit.Paus), C(Rank.Quatro, Suit.Copas)],
      vira,
      currentVazaPlays: [{ seat: 0, card: C(Rank.Dois, Suit.Espadas) }],
    });
    expect(() => analyzeDoubleDummy(view, { mode: "exact" })).toThrow();
  });
});
