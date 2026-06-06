/**
 * Testes da analise single-dummy (src/analysis/singleDummy.ts).
 *
 * Single-dummy NAO tem clarividencia: o resto da mao e jogado por uma politica,
 * cada jogador decidindo so pela propria visao.
 */

import { describe, expect, it } from "vitest";
import { manilhaRank } from "../src/core/ranking.js";
import { RuleSet, TRUCO_PAULISTA, makeManoAMano } from "../src/core/rules.js";
import { Card, Rank, Seat, Suit, TeamId, cardsEqual } from "../src/core/types.js";
import { Play, VazaResult } from "../src/core/vaza.js";
import { PlayerView } from "../src/players/player.js";
import { analyzeSingleDummy } from "../src/analysis/singleDummy.js";

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

/** Ultima vaza 1v1: heroi com K de paus (vence se forca oponente <= 6) -> 21/34. */
function lastTrickView(): PlayerView {
  const rules = makeManoAMano();
  const vira = C(Rank.Quatro, Suit.Ouros);
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

describe("analyzeSingleDummy", () => {
  it("ultima vaza: politica e irrelevante, bate 21/34 (exato)", async () => {
    const res = await analyzeSingleDummy(lastTrickView(), { mode: "exact" });
    expect(res.method).toBe("exact");
    expect(res.samples).toBe(34);
    expect(res.winProb).toBeCloseTo(21 / 34, 10);
    expect(res.cards).toHaveLength(1);
    expect(cardsEqual(res.bestCard, C(Rank.Rei, Suit.Paus))).toBe(true);
  });

  it("nao tem clarividencia: mesmo resultado para qualquer politica na ultima vaza", async () => {
    const view = lastTrickView();
    const a = await analyzeSingleDummy(view, { mode: "exact", policy: "inocente" });
    const b = await analyzeSingleDummy(view, {
      mode: "exact",
      policy: "melhorada_5",
    });
    expect(a.winProb).toBeCloseTo(b.winProb, 10);
  });

  it("mao dominada: heroi com a zap na ultima vaza vence sempre", async () => {
    const rules = makeManoAMano();
    const vira = C(Rank.Quatro, Suit.Ouros);
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
    const res = await analyzeSingleDummy(view, { mode: "exact" });
    expect(res.winProb).toBe(1);
    expect(res.lossProb).toBe(0);
  });

  it("probabilidades somam ~1, EV ordenado, melhor carta na mao (2v2)", async () => {
    const rules = TRUCO_PAULISTA;
    const vira = C(Rank.Sete, Suit.Ouros);
    const hand = [
      C(Rank.Dama, Suit.Espadas),
      C(Rank.As, Suit.Copas),
      C(Rank.Rei, Suit.Ouros),
    ];
    const view = buildView({ rules, seat: 0, hand, vira });
    const res = await analyzeSingleDummy(view, {
      samples: 800,
      seed: 5,
      policy: "melhorada_5",
    });
    expect(res.method).toBe("montecarlo");
    expect(res.policy).toBe("melhorada_5");
    expect(res.winProb + res.tieProb + res.lossProb).toBeCloseTo(1, 9);
    expect(res.cards).toHaveLength(3);
    expect(hand.some((c) => cardsEqual(c, res.bestCard))).toBe(true);
    for (let i = 1; i < res.cards.length; i++) {
      expect(res.cards[i - 1]!.ev).toBeGreaterThanOrEqual(res.cards[i]!.ev);
    }
  });

  it("e deterministico para a mesma semente", async () => {
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
    const a = await analyzeSingleDummy(view, { samples: 400, seed: 3 });
    const b = await analyzeSingleDummy(view, { samples: 400, seed: 3 });
    expect(a.winProb).toBe(b.winProb);
    expect(cardsEqual(a.bestCard, b.bestCard)).toBe(true);
  });

  it("lanca erro se nao for a vez do heroi", async () => {
    const rules = makeManoAMano();
    const vira = C(Rank.Quatro, Suit.Ouros);
    const view = buildView({
      rules,
      seat: 0,
      hand: [C(Rank.Tres, Suit.Paus), C(Rank.Quatro, Suit.Copas)],
      vira,
      currentVazaPlays: [{ seat: 0, card: C(Rank.Dois, Suit.Espadas) }],
    });
    await expect(analyzeSingleDummy(view, { mode: "exact" })).rejects.toThrow();
  });
});
