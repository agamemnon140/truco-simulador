import { describe, expect, it } from "vitest";
import { deal } from "../src/core/deck.js";
import { playHand } from "../src/core/hand.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import { Action, GameEvent, MaoDeOnzeDecision, Player, PlayerView, RaiseResponse } from "../src/players/player.js";
import { Card, Rank, Suit } from "../src/core/types.js";
import { EvolvedBotPlayer } from "../src/players/evolvedBot.js";
import { seedGenome } from "../src/players/genome.js";
import { OpponentModel } from "../src/players/opponentModel.js";
import { makeView, seededRng } from "./helpers.js";

const rules = TRUCO_PAULISTA;
const teamOfSeat = [0, 1, 0, 1] as const;

/** Joga a 1a carta, corre de truco e registra todos os eventos observados. */
class Spy implements Player {
  events: GameEvent[] = [];
  constructor(readonly name: string) {}
  async chooseAction(view: PlayerView): Promise<Action> {
    return { type: "play", card: view.hand[0]! };
  }
  async respondToRaise(): Promise<RaiseResponse> {
    return "run";
  }
  async decideMaoDeOnze(): Promise<MaoDeOnzeDecision> {
    return "fold";
  }
  observe(ev: GameEvent): void {
    this.events.push(ev);
  }
}

describe("canal de observacao (Player.observe)", () => {
  it("os jogadores recebem handStart, plays e handEnd", async () => {
    const spies = [0, 1, 2, 3].map((i) => new Spy(`s${i}`));
    await playHand({
      rules,
      players: spies,
      teamOfSeat: [...teamOfSeat],
      scores: [0, 0],
      firstSeat: 0,
      rng: seededRng(123),
    });
    const ev = spies[0]!.events;
    expect(ev[0]!.type).toBe("handStart");
    expect(ev.filter((e) => e.type === "play").length).toBe(12); // 4 assentos x 3 vazas
    expect(ev.at(-1)!.type).toBe("handEnd");
  });
});

describe("OpponentModel — estatisticas", () => {
  it("oppFold alto quando o oponente corre dos nossos trucos; oppTruco baixo", () => {
    const m = new OpponentModel(rules);
    const vira: Card = { rank: Rank.Quatro, suit: Suit.Paus };
    for (let h = 0; h < 6; h++) {
      m.observe({ type: "handStart", teamOfSeat: [...teamOfSeat], vira }, 0); // selfSeat 0 -> myTeam 0
      m.observe({ type: "raiseProposed", seat: 0, team: 0, level: 0, value: 3 }, 0); // NOSSO truco
      m.observe({ type: "raiseResponse", seat: 1, team: 1, response: "run", proposingTeam: 0 }, 0); // opp corre
      m.observe({ type: "handEnd", winningTeam: 0, points: 1 }, 0);
    }
    const [oppFold, oppTruco] = m.features();
    expect(oppFold).toBeGreaterThan(0.7); // corre sempre
    expect(oppTruco).toBeLessThan(0.4); // nunca inicia truco
  });

  it("sem dados -> priors neutros (0.5)", () => {
    const m = new OpponentModel(rules);
    expect(m.features().every((x) => Math.abs(x - 0.5) < 1e-9)).toBe(true);
  });
});

describe("adaptacao — o modelo move a decisao de aposta", () => {
  it("com oppFold alto + peso positivo, o bot truca MAIS", async () => {
    const idxOppFold = 20; // HAND_STRENGTH(6)+CONTEXT(12)+GTO(2) -> 1a feature de oponente
    const genome = seedGenome();
    genome.betWeights[idxOppFold] = 4; // explora o foldToTruco

    const vira: Card = { rank: Rank.Quatro, suit: Suit.Paus };
    // Dois modelos: oponente que SEMPRE corre vs oponente que SEMPRE aceita.
    const mk = (resp: RaiseResponse): OpponentModel => {
      const m = new OpponentModel(rules);
      for (let k = 0; k < 10; k++) {
        m.observe({ type: "handStart", teamOfSeat: [...teamOfSeat], vira }, 0);
        m.observe({ type: "raiseProposed", seat: 0, team: 0, level: 0, value: 3 }, 0);
        m.observe({ type: "raiseResponse", seat: 1, team: 1, response: resp, proposingTeam: 0 }, 0);
      }
      return m;
    };

    const deals = Array.from({ length: 120 }, (_, i) => deal(4, 3, seededRng(2000 + i)));
    const countRaises = async (model: OpponentModel): Promise<number> => {
      const bot = new EvolvedBotPlayer("b", genome, seededRng(1), undefined, false, model);
      let raises = 0;
      for (const d of deals) {
        const a = await bot.chooseAction(makeView({ hand: d.hands[0]!, vira: d.vira }), true);
        if (a.type === "raise") raises++;
      }
      return raises;
    };
    const vsFolder = await countRaises(mk("run")); // oppFold alto
    const vsCaller = await countRaises(mk("accept")); // oppFold baixo
    expect(vsFolder).toBeGreaterThan(vsCaller); // contra quem corre, truca mais
  });
});
