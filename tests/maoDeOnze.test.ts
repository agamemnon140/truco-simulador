import { describe, expect, it } from "vitest";
import { playHand } from "../src/core/hand.js";
import { assignTeams } from "../src/core/match.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import {
  Action,
  MaoDeOnzeContext,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  Proposal,
  RaiseResponse,
} from "../src/players/player.js";
import { seededRng } from "./helpers.js";

const R = TRUCO_PAULISTA;

/** Player de teste: registra se foi convidado a trucar e se jogou as cegas. */
class SpyPlayer implements Player {
  raiseOffered = false;
  sawBlind = false;
  constructor(
    readonly name: string,
    private readonly onze: MaoDeOnzeDecision = "play",
    private readonly alwaysRaise = false,
  ) {}
  async chooseAction(view: PlayerView, canRaise: boolean): Promise<Action> {
    if (canRaise) this.raiseOffered = true;
    if (view.blind) this.sawBlind = true;
    if (this.alwaysRaise && canRaise) return { type: "raise" };
    return { type: "play", card: view.hand[0]! };
  }
  async respondToRaise(
    _v: PlayerView,
    _p: Proposal,
    _c: boolean,
  ): Promise<RaiseResponse> {
    return "accept";
  }
  async decideMaoDeOnze(
    _v: PlayerView,
    _ctx: MaoDeOnzeContext,
  ): Promise<MaoDeOnzeDecision> {
    return this.onze;
  }
}

function makePlayers(onze: MaoDeOnzeDecision = "play", alwaysRaise = false) {
  return [0, 1, 2, 3].map((i) => new SpyPlayer(`P${i}`, onze, alwaysRaise));
}

describe("mao de onze — uma equipe com 11", () => {
  it("equipe de 11 que JOGA: mao vale 3 e ninguem pode trucar", async () => {
    const players = makePlayers("play", /* alwaysRaise */ true);
    const result = await playHand({
      rules: R,
      players,
      teamOfSeat: assignTeams(R),
      scores: [11, 5], // equipe 0 na mao de onze
      firstSeat: 0,
      rng: seededRng(1),
    });
    // Ninguem conseguiu trucar (canRaise sempre false), apesar de alwaysRaise.
    expect(players.some((p) => p.raiseOffered)).toBe(false);
    // A mao vale 3 (nao 1).
    expect(result.points).toBe(3);
    expect(result.reason).toBe("vazas");
  });

  it("equipe de 11 que CORRE: adversario leva apenas 1, sem jogar vazas", async () => {
    const players = makePlayers("fold");
    const result = await playHand({
      rules: R,
      players,
      teamOfSeat: assignTeams(R),
      scores: [11, 7],
      firstSeat: 0,
      rng: seededRng(2),
    });
    expect(result.reason).toBe("fold");
    expect(result.winningTeam).toBe(1); // adversario
    expect(result.points).toBe(1);
  });

  it("a decisao recebe as cartas do parceiro (consulta em dupla)", async () => {
    let seenPartners = -1;
    const decider = new (class extends SpyPlayer {
      async decideMaoDeOnze(
        _v: PlayerView,
        ctx: MaoDeOnzeContext,
      ): Promise<MaoDeOnzeDecision> {
        seenPartners = ctx.partnerHands.length;
        return "play";
      }
    })("D");
    const players: Player[] = [decider, ...makePlayers().slice(1)];
    await playHand({
      rules: R,
      players,
      teamOfSeat: assignTeams(R),
      scores: [11, 4],
      firstSeat: 0,
      rng: seededRng(3),
    });
    // Equipe 0 = assentos 0 e 2 -> o decisor (0) ve 1 parceiro (assento 2).
    expect(seenPartners).toBe(1);
  });
});

describe("mao de onze — 11x11 (as cegas)", () => {
  it("os jogadores jogam as cegas e a mao vale 1", async () => {
    const players = makePlayers("play", /* alwaysRaise */ true);
    const result = await playHand({
      rules: R,
      players,
      teamOfSeat: assignTeams(R),
      scores: [11, 11],
      firstSeat: 0,
      rng: seededRng(4),
    });
    expect(players.every((p) => p.sawBlind)).toBe(true);
    expect(players.some((p) => p.raiseOffered)).toBe(false); // sem truco
    expect(result.points).toBe(1); // vale 1 (normal)
    expect([0, 1, null]).toContain(result.winningTeam);
  });
});

describe("sem mao de onze: comportamento normal", () => {
  it("abaixo de 11 o truco e permitido normalmente", async () => {
    const players = makePlayers("play", /* alwaysRaise */ true);
    const result = await playHand({
      rules: R,
      players,
      teamOfSeat: assignTeams(R),
      scores: [10, 8],
      firstSeat: 0,
      rng: seededRng(5),
    });
    // Com alwaysRaise, alguem foi convidado a trucar.
    expect(players.some((p) => p.raiseOffered)).toBe(true);
    expect(result.points).toBeGreaterThanOrEqual(1);
  });
});
