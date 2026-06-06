import { describe, expect, it } from "vitest";
import { playHand } from "../src/core/hand.js";
import { playMatch, assignTeams } from "../src/core/match.js";
import { TRUCO_PAULISTA, makeManoAMano } from "../src/core/rules.js";
import {
  Action,
  Player,
  PlayerView,
  RaiseResponse,
} from "../src/players/player.js";
import { ScriptedPlayer, seededRng } from "./helpers.js";

const R = TRUCO_PAULISTA;

/** Jogador que pede truco na primeira acao possivel, depois joga normal. */
class RaiseOncePlayer implements Player {
  private raised = false;
  constructor(readonly name: string) {}
  async chooseAction(view: PlayerView, canRaise: boolean): Promise<Action> {
    if (canRaise && !this.raised) {
      this.raised = true;
      return { type: "raise" };
    }
    return { type: "play", card: view.hand[0]! };
  }
  async respondToRaise(): Promise<RaiseResponse> {
    return "accept";
  }
}

describe("playHand", () => {
  it("retorna um resultado valido para uma mao normal", async () => {
    const players = [0, 1, 2, 3].map((i) => new ScriptedPlayer(`P${i}`));
    const result = await playHand({
      rules: R,
      players,
      teamOfSeat: assignTeams(R),
      scores: [0, 0],
      firstSeat: 0,
      rng: seededRng(42),
    });
    expect([0, 1, null]).toContain(result.winningTeam);
    expect(result.points).toBeGreaterThanOrEqual(0);
    if (result.winningTeam !== null) {
      expect(result.points).toBeGreaterThanOrEqual(1);
    }
  });

  it("se o adversario corre o truco, quem pediu leva o valor base (1)", async () => {
    // Lider (assento 0, equipe 0) pede truco; equipe 1 corre.
    const players: Player[] = [
      new RaiseOncePlayer("P0"),
      new ScriptedPlayer("P1", "run"),
      new ScriptedPlayer("P2"),
      new ScriptedPlayer("P3", "run"),
    ];
    const result = await playHand({
      rules: R,
      players,
      teamOfSeat: assignTeams(R),
      scores: [0, 0],
      firstSeat: 0,
      rng: seededRng(7),
    });
    expect(result.reason).toBe("run");
    expect(result.winningTeam).toBe(0);
    expect(result.points).toBe(1);
  });
});

describe("playMatch", () => {
  it("acumula pontos e termina quando alguem chega a 12", async () => {
    const players = [0, 1, 2, 3].map((i) => new ScriptedPlayer(`P${i}`));
    const result = await playMatch({
      rules: R,
      players,
      rng: seededRng(123),
    });
    expect([0, 1]).toContain(result.winningTeam);
    expect(result.scores[result.winningTeam]).toBeGreaterThanOrEqual(
      R.pointsToWin,
    );
    expect(result.scores.length).toBe(2);
    expect(result.handsPlayed).toBeGreaterThan(0);
  });

  it("funciona no formato mano a mano (1v1)", async () => {
    const rules = makeManoAMano();
    const players = [new ScriptedPlayer("A"), new ScriptedPlayer("B")];
    const result = await playMatch({ rules, players, rng: seededRng(99) });
    expect(result.scores[result.winningTeam]).toBeGreaterThanOrEqual(
      rules.pointsToWin,
    );
  });
});
