import { describe, expect, it } from "vitest";
import { decideHand } from "../src/core/hand.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import { VazaResult } from "../src/core/vaza.js";
import { TeamId } from "../src/core/types.js";

const R = TRUCO_PAULISTA;
const win = (t: TeamId): VazaResult => ({
  winningTeam: t,
  winningSeat: 0,
  tied: false,
});
const tie = (): VazaResult => ({ winningTeam: null, winningSeat: null, tied: true });

describe("decideHand", () => {
  it("uma vaza apenas: indefinido", () => {
    expect(decideHand([win(0)], R)).toBe("continue");
  });

  it("vence as duas primeiras", () => {
    expect(decideHand([win(0), win(0)], R)).toBe(0);
  });

  it("split 1-1: precisa da terceira", () => {
    expect(decideHand([win(0), win(1)], R)).toBe("continue");
    expect(decideHand([win(0), win(1), win(1)], R)).toBe(1);
  });

  it("split 1-1 e terceira empata: vence quem fez a primeira", () => {
    expect(decideHand([win(0), win(1), tie()], R)).toBe(0);
  });

  it("empate na primeira: quem vence a segunda ganha", () => {
    expect(decideHand([tie(), win(1)], R)).toBe(1);
  });

  it("vence a primeira e empata a segunda: ganha quem fez a primeira", () => {
    expect(decideHand([win(0), tie()], R)).toBe(0);
  });

  it("empate nas duas primeiras: a terceira decide", () => {
    expect(decideHand([tie(), tie()], R)).toBe("continue");
    expect(decideHand([tie(), tie(), win(1)], R)).toBe(1);
  });

  it("empate nas tres: mao anulada", () => {
    expect(decideHand([tie(), tie(), tie()], R)).toBe("cancel");
  });
});

// Regras de empate conforme descritas pelo usuario (regressao explicita):
//  - empate na 1a vaza: o vencedor da 2a vaza leva a mao;
//  - empate na 2a OU 3a vaza: o time que ganhou a 1a vaza ganha a mao.
describe("regras de empate (fraseologia do usuario)", () => {
  it("empate na 1a vaza -> o vencedor da 2a vaza leva a mao", () => {
    expect(decideHand([tie(), win(1)], R)).toBe(1);
    expect(decideHand([tie(), win(0)], R)).toBe(0);
  });

  it("empate na 2a vaza -> quem ganhou a 1a vaza ganha a mao", () => {
    expect(decideHand([win(0), tie()], R)).toBe(0);
    expect(decideHand([win(1), tie()], R)).toBe(1);
  });

  it("empate na 3a vaza (apos 1-1) -> quem ganhou a 1a vaza ganha a mao", () => {
    expect(decideHand([win(0), win(1), tie()], R)).toBe(0);
    expect(decideHand([win(1), win(0), tie()], R)).toBe(1);
  });
});
