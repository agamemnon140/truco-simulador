/**
 * Testes do estimador de vitoria da mao (src/analysis/winEstimator.ts).
 */

import { describe, expect, it } from "vitest";
import { manilhaRank } from "../src/core/ranking.js";
import { RuleSet, TRUCO_PAULISTA, makeManoAMano } from "../src/core/rules.js";
import { Card, Rank, Seat, Suit, TeamId } from "../src/core/types.js";
import { Play, VazaResult } from "../src/core/vaza.js";
import { PlayerView } from "../src/players/player.js";
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

describe("estimateWin", () => {
  it("mao dominada: heroi com a zap na ultima vaza vence sempre", async () => {
    const rules = makeManoAMano();
    const vira = C(Rank.Quatro, Suit.Ouros); // manilha = 5
    // Heroi (assento 0) venceu a vaza 1, perdeu a 2; na 3a tem a zap (5 de paus).
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
    const est = await estimateWin(view, { mode: "exact" });
    expect(est.method).toBe("exact");
    expect(est.winProb).toBe(1);
    expect(est.lossProb).toBe(0);
  });

  it("ultima vaza: enumeracao exata bate o calculo a mao (21/34)", async () => {
    const rules = makeManoAMano();
    const vira = C(Rank.Quatro, Suit.Ouros); // manilha = 5
    // Heroi venceu a 1a, perdeu a 2a; na 3a tem K de paus (forca 6, carta comum).
    // Em empate na 3a, vence quem fez a 1a (o heroi), logo vence se forca >= 6.
    const v1: Play[] = [
      { seat: 0, card: C(Rank.Tres, Suit.Paus) },
      { seat: 1, card: C(Rank.Dois, Suit.Ouros) },
    ];
    const v2: Play[] = [
      { seat: 1, card: C(Rank.Cinco, Suit.Paus) }, // zap do oponente
      { seat: 0, card: C(Rank.Sete, Suit.Copas) },
    ];
    const view = buildView({
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
    const est = await estimateWin(view, { mode: "exact" });
    expect(est.method).toBe("exact");
    expect(est.samples).toBe(34); // 40 cartas - 6 vistas
    expect(est.winProb).toBeCloseTo(21 / 34, 10);
    expect(est.tieProb).toBe(0);
    expect(est.lossProb).toBeCloseTo(13 / 34, 10);
  });

  it("Monte Carlo aproxima o exato na ultima vaza", async () => {
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
    const view = buildView({
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
    const mc = await estimateWin(view, { mode: "montecarlo", samples: 20000 });
    expect(mc.winProb).toBeCloseTo(21 / 34, 1); // ~0.62 com tolerancia
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
    const a = await estimateWin(view, { policy: "inocente", samples: 500, seed: 9 });
    const b = await estimateWin(view, { policy: "inocente", samples: 500, seed: 9 });
    expect(a.winProb).toBe(b.winProb);
    expect(a.lossProb).toBe(b.lossProb);
  });

  it("as probabilidades somam ~1", async () => {
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
    const est = await estimateWin(view, { policy: "melhorada_5", samples: 500 });
    expect(est.winProb + est.tieProb + est.lossProb).toBeCloseTo(1, 9);
  });

  it("a estimativa DEPENDE da inteligencia assumida (politicas diferem)", async () => {
    const rules = TRUCO_PAULISTA;
    const vira = C(Rank.Sete, Suit.Ouros); // manilha = Dama
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
    const opts = { samples: 2000, seed: 123 } as const;
    const random = await estimateWin(view, { ...opts, policy: "random" });
    const inocente = await estimateWin(view, { ...opts, policy: "inocente" });
    const m5 = await estimateWin(view, { ...opts, policy: "melhorada_5" });
    const probs = [random.winProb, inocente.winProb, m5.winProb];
    const allEqual = probs.every((p) => p === probs[0]);
    expect(allEqual).toBe(false);
  });
});
