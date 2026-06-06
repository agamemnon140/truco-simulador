import { describe, expect, it } from "vitest";
import { deal } from "../src/core/deck.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import { EvolvedBotPlayer } from "../src/players/evolvedBot.js";
import { randomGenome, seedGenome } from "../src/players/genome.js";
import { cardsEqual } from "../src/core/types.js";
import { makeView, seededRng } from "./helpers.js";

describe("EvolvedBotPlayer", () => {
  it("sempre joga uma carta que possui (em varias maos aleatorias)", async () => {
    const rng = seededRng(42);
    const bot = new EvolvedBotPlayer("evo", seedGenome(), rng);
    for (let i = 0; i < 50; i++) {
      const d = deal(4, 3, seededRng(100 + i));
      const view = makeView({ hand: d.hands[0]!, vira: d.vira });
      const action = await bot.chooseAction(view, false);
      expect(action.type).toBe("play");
      if (action.type === "play") {
        expect(view.hand.some((c) => cardsEqual(c, action.card))).toBe(true);
      }
    }
  });

  it("respondToRaise retorna accept/run/raise validos", async () => {
    const bot = new EvolvedBotPlayer("evo", randomGenome(seededRng(7)), seededRng(8));
    const d = deal(4, 3, seededRng(5));
    const view = makeView({ hand: d.hands[0]!, vira: d.vira });
    const r1 = await bot.respondToRaise(view, {} as never, true);
    const r2 = await bot.respondToRaise(view, {} as never, false);
    expect(["accept", "run", "raise"]).toContain(r1);
    expect(["accept", "run"]).toContain(r2); // sem canCounter nao pode 'raise'?
  });

  it("em mao fechada (blind) joga sem quebrar", async () => {
    const bot = new EvolvedBotPlayer("evo", seedGenome(), seededRng(1));
    const d = deal(4, 3, seededRng(9));
    const view = makeView({ hand: d.hands[0]!, vira: d.vira, blind: true });
    const action = await bot.chooseAction(view, false);
    expect(action.type).toBe("play");
  });

  it("decideMaoDeOnze retorna play/fold", async () => {
    const bot = new EvolvedBotPlayer("evo", seedGenome(), seededRng(2));
    const d = deal(4, 3, seededRng(11));
    const view = makeView({ hand: d.hands[0]!, vira: d.vira });
    const dec = await bot.decideMaoDeOnze(view, {
      partnerHands: [d.hands[2]!],
      value: 3,
      foldValue: 1,
    });
    expect(["play", "fold"]).toContain(dec);
  });
});
