import { describe, expect, it } from "vitest";
import {
  cardStrength,
  compareCards,
  isManilha,
  manilhaRank,
} from "../src/core/ranking.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import { Card, Rank, Suit } from "../src/core/types.js";

const R = TRUCO_PAULISTA;
const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });

describe("manilhaRank", () => {
  it("manilha e o rank imediatamente acima da vira", () => {
    expect(manilhaRank(card(Rank.Quatro, Suit.Paus), R)).toBe(Rank.Cinco);
    expect(manilhaRank(card(Rank.Sete, Suit.Ouros), R)).toBe(Rank.Dama);
    expect(manilhaRank(card(Rank.Rei, Suit.Copas), R)).toBe(Rank.As);
  });

  it("faz o ciclo: vira 3 -> manilha 4", () => {
    expect(manilhaRank(card(Rank.Tres, Suit.Espadas), R)).toBe(Rank.Quatro);
  });
});

describe("isManilha / cardStrength", () => {
  it("manilhas sao mais fortes que qualquer carta comum", () => {
    const vira = card(Rank.Quatro, Suit.Paus); // manilha = 5
    const manilha = card(Rank.Cinco, Suit.Ouros);
    const tresComum = card(Rank.Tres, Suit.Paus); // 3 e a carta comum mais alta
    expect(isManilha(manilha, vira, R)).toBe(true);
    expect(isManilha(tresComum, vira, R)).toBe(false);
    expect(cardStrength(manilha, vira, R)).toBeGreaterThan(
      cardStrength(tresComum, vira, R),
    );
  });

  it("ordem entre manilhas: ouros < espadas < copas < paus", () => {
    const vira = card(Rank.Quatro, Suit.Paus); // manilha = 5
    const ouros = cardStrength(card(Rank.Cinco, Suit.Ouros), vira, R);
    const espadas = cardStrength(card(Rank.Cinco, Suit.Espadas), vira, R);
    const copas = cardStrength(card(Rank.Cinco, Suit.Copas), vira, R);
    const paus = cardStrength(card(Rank.Cinco, Suit.Paus), vira, R);
    expect(ouros).toBeLessThan(espadas);
    expect(espadas).toBeLessThan(copas);
    expect(copas).toBeLessThan(paus);
  });

  it("ordem das cartas comuns: 4 < 5 < ... < 2 < 3", () => {
    const vira = card(Rank.As, Suit.Ouros); // manilha = 2, nao interfere abaixo
    expect(compareCards(card(Rank.Tres, Suit.Ouros), card(Rank.As, Suit.Paus), vira, R)).toBeGreaterThan(0);
    expect(compareCards(card(Rank.Quatro, Suit.Paus), card(Rank.Cinco, Suit.Ouros), vira, R)).toBeLessThan(0);
  });

  it("duas cartas comuns de mesmo rank empatam (forca igual)", () => {
    const vira = card(Rank.Quatro, Suit.Paus);
    expect(
      compareCards(
        card(Rank.Sete, Suit.Ouros),
        card(Rank.Sete, Suit.Paus),
        vira,
        R,
      ),
    ).toBe(0);
  });
});
