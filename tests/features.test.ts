import { describe, expect, it } from "vitest";
import {
  BET_FEATURE_COUNT,
  CARD_FEATURE_COUNT,
  CONTEXT_FEATURE_COUNT,
  betFeatures,
  cardFeatures,
  precompute,
} from "../src/players/features.js";
import { Card, Rank, Suit } from "../src/core/types.js";
import { makeView } from "./helpers.js";

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });
const vira = card(Rank.Quatro, Suit.Paus); // manilha = 5

describe("features — tamanhos dos vetores", () => {
  it("cardFeatures e betFeatures tem o tamanho fixo esperado", () => {
    const view = makeView({ hand: [card(Rank.Tres, Suit.Ouros)], vira });
    const pre = precompute(view);
    expect(cardFeatures(view, view.hand[0]!, pre).length).toBe(CARD_FEATURE_COUNT);
    expect(betFeatures(view, pre).length).toBe(BET_FEATURE_COUNT);
    expect(CARD_FEATURE_COUNT).toBe(8 + CONTEXT_FEATURE_COUNT);
  });
});

describe("features — consciencia do parceiro", () => {
  it("cobrir o parceiro que ja ganha a vaza marca 'wastesOnPartner'", () => {
    // Eu sou o assento 2 (equipe 0). Parceiro (assento 0) jogou 3♥ e lidera.
    const view = makeView({
      seat: 2,
      vira,
      hand: [card(Rank.Cinco, Suit.Ouros), card(Rank.Sete, Suit.Espadas)],
      currentVazaPlays: [
        { seat: 0, card: card(Rank.Tres, Suit.Copas) }, // parceiro, lidera
        { seat: 1, card: card(Rank.Sete, Suit.Ouros) }, // adversario
      ],
    });
    const pre = precompute(view);
    // 5♦ e manilha: cobre o 3 do parceiro -> desperdicio (indice 7 = 1).
    const fManilha = cardFeatures(view, card(Rank.Cinco, Suit.Ouros), pre);
    expect(fManilha[7]).toBe(1);
    // 7♠ nao vence o 3 do parceiro -> nao desperdicia (indice 7 = 0).
    const fFraca = cardFeatures(view, card(Rank.Sete, Suit.Espadas), pre);
    expect(fFraca[7]).toBe(0);
  });
});

describe("features — pWin", () => {
  it("a manilha mais forte liderando tem pWin alto; carta fraca, baixo", () => {
    const view = makeView({
      seat: 0,
      vira,
      hand: [card(Rank.Cinco, Suit.Paus), card(Rank.Quatro, Suit.Ouros)],
    });
    const pre = precompute(view);
    const zap = cardFeatures(view, card(Rank.Cinco, Suit.Paus), pre); // manilha de paus
    const fraca = cardFeatures(view, card(Rank.Quatro, Suit.Ouros), pre);
    // indice 3 = pWin
    expect(zap[3]!).toBeGreaterThan(0.9);
    expect(fraca[3]!).toBeLessThan(zap[3]!);
  });
});
