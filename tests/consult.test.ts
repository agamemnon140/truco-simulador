import { describe, expect, it } from "vitest";
import { deal } from "../src/core/deck.js";
import { cardStrength } from "../src/core/ranking.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import { Card, Rank, Suit } from "../src/core/types.js";
import { canWinLevel, signalLevel, trucoAdviceLevel } from "../src/players/consult.js";
import { EvolvedBotPlayer } from "../src/players/evolvedBot.js";
import { parseGenome, seedGenome } from "../src/players/genome.js";
import { makeView, seededRng } from "./helpers.js";

const rules = TRUCO_PAULISTA;
const vira: Card = { rank: Rank.Quatro, suit: Suit.Paus }; // manilha = 5
const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });

describe("consult — niveis dos sinais do parceiro", () => {
  it("signal: manilha=2, 3=1, nada=0", () => {
    expect(signalLevel([card(Rank.Cinco, Suit.Ouros)], vira, rules)).toBe(2);
    expect(signalLevel([card(Rank.Tres, Suit.Ouros)], vira, rules)).toBe(1);
    expect(signalLevel([card(Rank.Sete, Suit.Ouros)], vira, rules)).toBe(0);
  });

  it("trucoAdvice: manilha/2-grandes=2, 1-grande=1, senao 0", () => {
    expect(trucoAdviceLevel([card(Rank.Cinco, Suit.Ouros)], vira, rules)).toBe(2);
    expect(
      trucoAdviceLevel([card(Rank.Tres, Suit.Ouros), card(Rank.Dois, Suit.Copas)], vira, rules),
    ).toBe(2);
    expect(
      trucoAdviceLevel([card(Rank.Tres, Suit.Ouros), card(Rank.Sete, Suit.Copas)], vira, rules),
    ).toBe(1);
    expect(trucoAdviceLevel([card(Rank.Sete, Suit.Ouros)], vira, rules)).toBe(0);
  });

  it("canWin: manilha+frente=2, frente=1, atras=0", () => {
    expect(canWinLevel([card(Rank.Cinco, Suit.Ouros)], vira, rules, 0)).toBe(2);
    expect(canWinLevel([card(Rank.Tres, Suit.Ouros)], vira, rules, 0)).toBe(1);
    const topOpp = cardStrength(card(Rank.Cinco, Suit.Paus), vira, rules); // manilha mais forte
    expect(canWinLevel([card(Rank.Tres, Suit.Ouros)], vira, rules, topOpp)).toBe(0);
  });
});

describe("comunicacao minima — protocolo fixo no EvolvedBot", () => {
  it("parceiro FORTE faz trucar mais que parceiro FRACO (mesmas maos)", async () => {
    const genome = seedGenome();
    const deals = Array.from({ length: 150 }, (_, i) => deal(4, 3, seededRng(1000 + i)));
    const countRaises = async (lvl: 0 | 1 | 2): Promise<number> => {
      const bot = new EvolvedBotPlayer("b", genome, seededRng(99)); // mesma semente -> blefes alinhados
      let raises = 0;
      for (const d of deals) {
        const view = makeView({
          hand: d.hands[0]!,
          vira: d.vira,
          partnerSignals: { signal: lvl, canWin: lvl, trucoAdvice: lvl },
        });
        const a = await bot.chooseAction(view, true);
        if (a.type === "raise") raises++;
      }
      return raises;
    };
    const strong = await countRaises(2);
    const weak = await countRaises(0);
    expect(strong).toBeGreaterThan(weak); // o sinal so move spots incertos
  });

  it("sem partnerSignals (1v1) nao consulta -> decisao puramente do genoma", async () => {
    const genome = seedGenome();
    const d = deal(4, 3, seededRng(7));
    const bot = new EvolvedBotPlayer("b", genome, seededRng(1));
    const a = await bot.chooseAction(makeView({ hand: d.hands[0]!, vira: d.vira }), true);
    expect(["play", "raise"]).toContain(a.type); // roda sem sinal, sem quebrar
  });
});

describe("migracao do genoma — features GTO em apendice", () => {
  it("betWeights antigo (sem GTO) -> completado com ZEROS", () => {
    const g = seedGenome();
    const old = { ...g, betWeights: g.betWeights.slice(0, g.betWeights.length - 2) };
    const parsed = parseGenome(JSON.parse(JSON.stringify(old)));
    expect(parsed.betWeights.length).toBe(g.betWeights.length);
    expect(parsed.betWeights.at(-1)).toBe(0);
    expect(parsed.betWeights.at(-2)).toBe(0);
  });

  it("rejeita betWeights de tamanho intermediario invalido", () => {
    const g = seedGenome();
    expect(() =>
      parseGenome({ ...g, betWeights: g.betWeights.slice(0, g.betWeights.length - 1) }),
    ).toThrow();
  });
});
