/**
 * Testes da API da calculadora (src/analysis/calcApi.ts).
 *
 * Cobre: derivacao de assentos/resultados a partir das cartas por vaza, a guarda de
 * vez do heroi (double/single-dummy) e um cenario forcado de vitoria garantida.
 */

import { describe, expect, it } from "vitest";
import { Rank, Suit, Card } from "../src/core/types.js";
import { calcScenario, CALC_POLICIES, CalcScenario } from "../src/analysis/calcApi.js";

const C = (rank: Rank, suit: Suit): Card => ({ rank, suit });

describe("calcScenario", () => {
  // Cenario 2v2: vira 4 de ouros => manilha = 5. Heroi (assento 0) e a mao.
  // Vaza 1: equipe 1 vence (3 de copas do assento 1).
  // Vaza 2: heroi (assento 0) vence com o 2 de paus e passa a liderar a vaza 3.
  // Placar de vazas 1x1 -> a 3a decide. Na 3a o heroi tem a ZAP (5 de paus) e abre:
  // vence a vaza e a mao com certeza, qualquer que seja a politica.
  const forcedWin: CalcScenario = {
    seat: 0,
    maoSeat: 0,
    vira: C(Rank.Quatro, Suit.Ouros),
    hand: [C(Rank.Cinco, Suit.Paus)], // zap
    completedVazas: [
      // vaza 1, ordem de jogo a partir do lider (assento 0): 0,1,2,3
      [
        C(Rank.Quatro, Suit.Paus), // 0 (heroi)
        C(Rank.Tres, Suit.Copas), // 1 (vence)
        C(Rank.Quatro, Suit.Copas), // 2
        C(Rank.Quatro, Suit.Espadas), // 3
      ],
      // vaza 2, lider = assento 1 (venceu a 1a): ordem 1,2,3,0
      [
        C(Rank.Seis, Suit.Copas), // 1
        C(Rank.Seis, Suit.Espadas), // 2
        C(Rank.Sete, Suit.Ouros), // 3
        C(Rank.Dois, Suit.Paus), // 0 (heroi vence)
      ],
    ],
    currentVaza: [],
  };

  it("deriva manilha, assento a jogar e resultados das vazas", async () => {
    const res = await calcScenario(forcedWin, { samples: 200, seed: 1 });
    expect(res.manilha).toBe(Rank.Cinco);
    // Vaza 1 -> equipe 1; vaza 2 -> equipe 0.
    expect(res.completedResults[0]!.winningTeam).toBe(1);
    expect(res.completedResults[1]!.winningTeam).toBe(0);
    // Heroi venceu a vaza 2, logo lidera a 3a: e a vez dele.
    expect(res.acting).toBe(0);
    expect(res.heroToPlay).toBe(true);
  });

  it("mao forcada: vitoria 100% em todas as politicas e no double-dummy", async () => {
    const res = await calcScenario(forcedWin, { samples: 200, seed: 1 });
    for (const policy of CALC_POLICIES) {
      expect(res.policies[policy]!.winProb).toBe(1);
      expect(res.policies[policy]!.lossProb).toBe(0);
    }
    expect(res.doubleDummy).not.toBeNull();
    expect(res.doubleDummy!.winProb).toBe(1);
    expect(res.singleDummy).not.toBeNull();
    expect(res.singleDummy!.bestCard).toEqual(C(Rank.Cinco, Suit.Paus));
    expect(res.singleDummy!.winProb).toBe(1);
  });

  it("quando nao e a vez do heroi, omite double/single-dummy mas roda as politicas", async () => {
    // Inicio da mao, heroi e a mao (assento 0) e ainda nao jogou -> e a vez dele.
    // Para forcar "nao e a vez", colocamos o heroi como assento 2 com a vaza atual
    // ja tendo 1 jogada (do assento 0) e o heroi com 3 cartas.
    const scenario: CalcScenario = {
      seat: 2,
      maoSeat: 0,
      vira: C(Rank.Sete, Suit.Ouros), // manilha = Q
      hand: [
        C(Rank.As, Suit.Copas),
        C(Rank.Rei, Suit.Ouros),
        C(Rank.Dama, Suit.Espadas),
      ],
      completedVazas: [],
      currentVaza: [C(Rank.Quatro, Suit.Paus)], // so o assento 0 jogou
    };
    const res = await calcScenario(scenario, { samples: 200, seed: 7 });
    expect(res.acting).toBe(1); // proximo a jogar e o assento 1, nao o heroi (2)
    expect(res.heroToPlay).toBe(false);
    expect(res.doubleDummy).toBeNull();
    expect(res.singleDummy).toBeNull();
    // As politicas continuam rodando e somam ~1.
    const e = res.policies["inocente"]!;
    expect(e.winProb + e.tieProb + e.lossProb).toBeCloseTo(1, 6);
  });

  it("rejeita carta repetida com mensagem clara", async () => {
    const bad: CalcScenario = {
      seat: 0,
      maoSeat: 0,
      vira: C(Rank.Quatro, Suit.Ouros),
      hand: [C(Rank.Quatro, Suit.Ouros)], // igual a vira
      completedVazas: [],
      currentVaza: [],
    };
    await expect(calcScenario(bad)).rejects.toThrow(/repetida/);
  });
});
