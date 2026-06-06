import { describe, expect, it } from "vitest";
import { playHand } from "../src/core/hand.js";
import { cardStrength, isManilha } from "../src/core/ranking.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import { Card } from "../src/core/types.js";
import { seedGenome } from "../src/players/genome.js";
import { MacoPlayer, macoCheat } from "../src/players/macoPlayer.js";
import {
  Action,
  CheatProfile,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  RaiseResponse,
} from "../src/players/player.js";
import { seededRng } from "./helpers.js";

const rules = TRUCO_PAULISTA;
const MAXS = rules.rankOrder.length + rules.manilhaSuitOrder.length - 1;

interface DealInfo {
  hands: Card[][];
  vira: Card;
}

/** Jogador simples: joga a 1a carta, corre de truco; pode trazer cheat/redeal. */
class Stub implements Player {
  constructor(
    readonly name: string,
    public cheat?: CheatProfile,
    private readonly redeal?: (h: readonly Card[], v: Card) => boolean,
  ) {}
  async chooseAction(v: PlayerView): Promise<Action> {
    return { type: "play", card: v.hand[0]! };
  }
  async respondToRaise(): Promise<RaiseResponse> {
    return "run";
  }
  async decideMaoDeOnze(): Promise<MaoDeOnzeDecision> {
    return "fold";
  }
  wantsRedeal(h: readonly Card[], v: Card): boolean {
    return this.redeal?.(h, v) ?? false;
  }
}

/** Roda N maos com o dealer (pe) no assento 0 e captura as maos + vira. */
async function dealMany(n: number, dealer: Player): Promise<DealInfo[]> {
  const players = [dealer, new Stub("p1"), new Stub("p2"), new Stub("p3")];
  const deals: DealInfo[] = [];
  for (let i = 0; i < n; i++) {
    await playHand({
      rules,
      players,
      teamOfSeat: [0, 1, 0, 1],
      scores: [0, 0],
      firstSeat: 1, // dealer = (1-1+4)%4 = 0
      rng: seededRng(7000 + i),
      observer: { onDeal: (info) => deals.push({ hands: info.hands.map((h) => h.slice()), vira: info.vira }) },
    });
  }
  return deals;
}

const manilhaRate = (deals: DealInfo[], seat: number) =>
  deals.filter((d) => d.hands[seat]!.some((c) => isManilha(c, d.vira, rules))).length / deals.length;
const avgStrAt = (deals: DealInfo[], seat: number) => {
  let s = 0;
  for (const d of deals) {
    const h = d.hands[seat]!;
    s += h.reduce((a, c) => a + cardStrength(c, d.vira, rules), 0) / (MAXS * h.length);
  }
  return s / deals.length;
};

describe("maco — distribuicao enviesada", () => {
  it("manilha em escada: parceiro(2) > pe(0) > adversario; e > honesto", async () => {
    const cheat: CheatProfile = {
      macoStrength: 1,
      macoAttempts: 8,
      macoBackfire: 0,
      macoWeights: { partner: 3, dealer: 2, opp: 1 },
      extraCardProb: 0, // isola o maco (sem 4 cartas)
    };
    const N = 500;
    const rigged = await dealMany(N, new Stub("d", cheat));
    const honest = await dealMany(N, new Stub("d"));

    const partner = manilhaRate(rigged, 2);
    const dealer = manilhaRate(rigged, 0);
    const opp = (manilhaRate(rigged, 1) + manilhaRate(rigged, 3)) / 2;
    const baselinePartner = manilhaRate(honest, 2);

    expect(partner).toBeGreaterThan(dealer); // parceiro pega mais que o pe
    expect(dealer).toBeGreaterThan(opp); // pe pega mais que o adversario
    expect(partner).toBeGreaterThan(baselinePartner + 0.05); // bem acima do honesto
  });

  it("4 cartas ao parceiro: mao do parceiro fica mais forte (e continua com 3)", async () => {
    const cheat: CheatProfile = { macoStrength: 0, extraCardProb: 1 }; // isola as 4 cartas
    const N = 400;
    const rigged = await dealMany(N, new Stub("d", cheat));
    const honest = await dealMany(N, new Stub("d"));
    expect(avgStrAt(rigged, 2)).toBeGreaterThan(avgStrAt(honest, 2));
    expect(rigged.every((d) => d.hands[2]!.length === 3)).toBe(true);
  });
});

describe("maco — melar", () => {
  it("wantsRedeal: mao fraca + orcamento -> true (consome); esgota e para", () => {
    const weak = [
      { rank: rules.rankOrder[0]!, suit: rules.manilhaSuitOrder[0]! },
      { rank: rules.rankOrder[0]!, suit: rules.manilhaSuitOrder[1]! },
      { rank: rules.rankOrder[0]!, suit: rules.manilhaSuitOrder[2]! },
    ] as Card[];
    const vira: Card = { rank: rules.rankOrder[5]!, suit: rules.manilhaSuitOrder[0]! };
    const p = new MacoPlayer("m", seedGenome(), {
      cheat: macoCheat(0),
      rules,
      melarBelow: 0.9, // quase tudo e "fraco"
      melarBudget: 1,
    });
    expect(p.wantsRedeal(weak, vira)).toBe(true); // mela
    expect(p.wantsRedeal(weak, vira)).toBe(false); // orcamento esgotado
  });

  it("no motor, melar redistribui mãos fracas -> pe acaba mais forte", async () => {
    // dealer "mela" se a media da propria mao < 0.35 (sem orcamento: motor limita os redeals).
    const melador = new Stub("d", undefined, (h, v) => {
      const avg = h.reduce((a, c) => a + cardStrength(c, v, rules), 0) / (MAXS * h.length);
      return avg < 0.35;
    });
    const N = 400;
    const melado = await dealMany(N, melador);
    const honest = await dealMany(N, new Stub("d"));
    expect(avgStrAt(melado, 0)).toBeGreaterThan(avgStrAt(honest, 0)); // evita as piores maos
  });
});
