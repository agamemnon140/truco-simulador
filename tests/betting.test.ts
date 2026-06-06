import { describe, expect, it } from "vitest";
import {
  acceptRaise,
  canPropose,
  currentValue,
  forfeitValueOnRun,
  initBetting,
  isMaxed,
  nextLevel,
} from "../src/core/betting.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";

const R = TRUCO_PAULISTA;

describe("betting", () => {
  it("comeca valendo 1, sem truco", () => {
    const s = initBetting();
    expect(currentValue(s, R)).toBe(1);
    expect(isMaxed(s, R)).toBe(false);
    expect(nextLevel(s, R)?.value).toBe(3);
  });

  it("escalada de valores: 1 -> 3 -> 6 -> 9 -> 12", () => {
    let s = initBetting();
    expect(currentValue(s, R)).toBe(1);
    s = acceptRaise(s, 0, R);
    expect(currentValue(s, R)).toBe(3);
    s = acceptRaise(s, 1, R);
    expect(currentValue(s, R)).toBe(6);
    s = acceptRaise(s, 0, R);
    expect(currentValue(s, R)).toBe(9);
    s = acceptRaise(s, 1, R);
    expect(currentValue(s, R)).toBe(12);
    expect(isMaxed(s, R)).toBe(true);
    expect(nextLevel(s, R)).toBe(null);
  });

  it("correr concede o valor estabelecido antes do aumento", () => {
    let s = initBetting();
    // Antes de qualquer truco, correr de uma proposta de truco concede 1.
    expect(forfeitValueOnRun(s, R)).toBe(1);
    s = acceptRaise(s, 0, R); // truco aceito (3)
    // Agora uma proposta de seis: correr concederia 3.
    expect(forfeitValueOnRun(s, R)).toBe(3);
  });

  it("quem fez o ultimo aumento nao pode aumentar de novo", () => {
    let s = initBetting();
    expect(canPropose(s, 0, R)).toBe(true);
    expect(canPropose(s, 1, R)).toBe(true);
    s = acceptRaise(s, 0, R); // equipe 0 trucou e foi aceito
    expect(canPropose(s, 0, R)).toBe(false); // equipe 0 nao reaumenta
    expect(canPropose(s, 1, R)).toBe(true); // equipe 1 pode pedir seis
  });

  it("nao deixa aceitar alem do maximo", () => {
    let s = initBetting();
    s = acceptRaise(s, 0, R);
    s = acceptRaise(s, 1, R);
    s = acceptRaise(s, 0, R);
    s = acceptRaise(s, 1, R); // doze
    expect(() => acceptRaise(s, 0, R)).toThrow();
  });
});
