/**
 * Testes do HumanWebPlayer (jogador humano da web).
 *
 * Garantem que (1) cada decisao fica PENDENTE ate a UI chamar o resolver, e
 * (2) o padrao "deferred" nao trava a engine: uma mao completa roda ate o fim
 * com um HumanWebPlayer no assento 0 cujos hooks resolvem automaticamente.
 */

import { describe, expect, it } from "vitest";
import { playHand } from "../src/core/hand.js";
import { assignTeams } from "../src/core/match.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import { Rank, Suit } from "../src/core/types.js";
import {
  ActionPrompt,
  HumanWebHooks,
  HumanWebPlayer,
  MaoOnzePrompt,
  RaisePrompt,
} from "../src/players/humanWeb.js";
import { Player, Proposal } from "../src/players/player.js";
import { ScriptedPlayer, makeView, seededRng } from "./helpers.js";

const R = TRUCO_PAULISTA;
const C = (rank: Rank, suit: Suit) => ({ rank, suit });

/** Coletor de hooks que apenas guarda o ultimo prompt recebido. */
function makeCollector() {
  const box: {
    action?: ActionPrompt;
    raise?: RaisePrompt;
    onze?: MaoOnzePrompt;
  } = {};
  const hooks: HumanWebHooks = {
    onActionPrompt: (p) => (box.action = p),
    onRaisePrompt: (p) => (box.raise = p),
    onMaoOnzePrompt: (p) => (box.onze = p),
  };
  return { box, hooks };
}

describe("HumanWebPlayer", () => {
  it("chooseAction fica pendente ate a UI resolver (jogar carta)", async () => {
    const { box, hooks } = makeCollector();
    const player = new HumanWebPlayer("Voce", hooks);
    const view = makeView({
      hand: [C(Rank.As, Suit.Espadas), C(Rank.Sete, Suit.Copas)],
      vira: C(Rank.Quatro, Suit.Ouros),
    });

    let resolved = false;
    const promise = player.chooseAction(view, true).then((a) => {
      resolved = true;
      return a;
    });

    // O hook foi chamado com canRaise=true; nada resolveu ainda.
    expect(box.action).toBeDefined();
    expect(box.action!.canRaise).toBe(true);
    expect(resolved).toBe(false);

    box.action!.resolve({ type: "play", card: view.hand[0]! });
    const action = await promise;
    expect(resolved).toBe(true);
    expect(action).toEqual({ type: "play", card: view.hand[0] });
  });

  it("chooseAction resolve com raise quando o usuario pede truco", async () => {
    const { box, hooks } = makeCollector();
    const player = new HumanWebPlayer("Voce", hooks);
    const view = makeView({ hand: [C(Rank.Tres, Suit.Paus)], vira: C(Rank.Quatro, Suit.Ouros) });

    const promise = player.chooseAction(view, true);
    box.action!.resolve({ type: "raise" });
    expect(await promise).toEqual({ type: "raise" });
  });

  it("respondToRaise propaga canCounter e resolve a resposta", async () => {
    const { box, hooks } = makeCollector();
    const player = new HumanWebPlayer("Voce", hooks);
    const view = makeView({ hand: [C(Rank.Dois, Suit.Copas)], vira: C(Rank.Quatro, Suit.Ouros) });
    const proposal: Proposal = {
      proposer: 1,
      proposingTeam: 1,
      level: 0,
      name: "Truco",
      value: 3,
      forfeitValue: 1,
    };

    const promise = player.respondToRaise(view, proposal, false);
    expect(box.raise!.canCounter).toBe(false);
    expect(box.raise!.proposal).toBe(proposal);
    box.raise!.resolve("run");
    expect(await promise).toBe("run");
  });

  it("decideMaoDeOnze entrega o contexto e resolve a decisao", async () => {
    const { box, hooks } = makeCollector();
    const player = new HumanWebPlayer("Voce", hooks);
    const view = makeView({ hand: [C(Rank.As, Suit.Paus)], vira: C(Rank.Quatro, Suit.Ouros) });
    const ctx = { partnerHands: [[C(Rank.Tres, Suit.Espadas)]], value: 3, foldValue: 1 };

    const promise = player.decideMaoDeOnze(view, ctx);
    expect(box.onze!.ctx).toBe(ctx);
    box.onze!.resolve("fold");
    expect(await promise).toBe("fold");
  });

  it("nao trava a engine: uma mao completa com HumanWebPlayer no assento 0", async () => {
    // Hooks que resolvem automaticamente: sempre joga a 1a carta e aceita truco.
    const autoHooks: HumanWebHooks = {
      onActionPrompt: (p) => p.resolve({ type: "play", card: p.view.hand[0]! }),
      onRaisePrompt: (p) => p.resolve("accept"),
      onMaoOnzePrompt: (p) => p.resolve("play"),
    };
    const players: Player[] = [
      new HumanWebPlayer("Voce", autoHooks), // assento 0 (time 0)
      new ScriptedPlayer("Adv 1"),           // assento 1 (time 1)
      new ScriptedPlayer("Parceiro"),        // assento 2 (time 0)
      new ScriptedPlayer("Adv 2"),           // assento 3 (time 1)
    ];

    const teamOfSeat = assignTeams(R);
    expect(teamOfSeat).toEqual([0, 1, 0, 1]); // humano + parceiro = time 0

    const result = await playHand({
      rules: R,
      players,
      teamOfSeat,
      scores: [0, 0],
      firstSeat: 0,
      rng: seededRng(7),
    });

    expect([0, 1, null]).toContain(result.winningTeam);
    if (result.winningTeam !== null) {
      expect(result.points).toBeGreaterThanOrEqual(1);
    }
  });

  it("multi-humano: 2 humanos (assentos 0 e 1) e cada um so recebe seus prompts", async () => {
    const seatsPrompted: number[] = [];
    const mkAuto = (): HumanWebHooks => ({
      onActionPrompt: (p) => {
        seatsPrompted.push(p.view.seat);
        p.resolve({ type: "play", card: p.view.hand[0]! });
      },
      onRaisePrompt: (p) => {
        seatsPrompted.push(p.view.seat);
        p.resolve("accept");
      },
      onMaoOnzePrompt: (p) => p.resolve("play"),
    });

    const players: Player[] = [
      new HumanWebPlayer("H0", mkAuto()), // assento 0 (time 0)
      new HumanWebPlayer("H1", mkAuto()), // assento 1 (time 1)
      new ScriptedPlayer("Bot 2"),
      new ScriptedPlayer("Bot 3"),
    ];

    const result = await playHand({
      rules: R,
      players,
      teamOfSeat: assignTeams(R),
      scores: [0, 0],
      firstSeat: 0,
      rng: seededRng(11),
    });

    expect([0, 1, null]).toContain(result.winningTeam);
    // Cada HumanWebPlayer so foi consultado sobre o proprio assento.
    expect(seatsPrompted.length).toBeGreaterThan(0);
    expect(seatsPrompted.every((s) => s === 0 || s === 1)).toBe(true);
  });

  it("decorator 'parceiro IA nao pede truco' forca jogar carta (canRaise=false)", async () => {
    // Bot stub que SEMPRE pediria truco quando canRaise=true; ao ser embrulhado,
    // o wrapper o chama com canRaise=false, entao ele joga a 1a carta.
    let lastCanRaise: boolean | undefined;
    const greedy: Player = {
      name: "Guloso",
      async chooseAction(view, canRaise) {
        lastCanRaise = canRaise;
        return canRaise ? { type: "raise" } : { type: "play", card: view.hand[0]! };
      },
      async respondToRaise() {
        return "accept";
      },
      async decideMaoDeOnze() {
        return "play";
      },
    };
    // Reproduz o wrapper de play-entry (chooseAction sempre com canRaise=false).
    const noInitiate: Player = {
      name: greedy.name,
      chooseAction: (view) => greedy.chooseAction(view, false),
      respondToRaise: (view, proposal) => greedy.respondToRaise(view, proposal, false),
      decideMaoDeOnze: (view, ctx) => greedy.decideMaoDeOnze(view, ctx),
    };

    const view = makeView({
      hand: [C(Rank.Tres, Suit.Paus), C(Rank.As, Suit.Copas)],
      vira: C(Rank.Quatro, Suit.Ouros),
    });
    const action = await noInitiate.chooseAction(view, true);
    expect(lastCanRaise).toBe(false); // foi chamado com canRaise=false
    expect(action).toEqual({ type: "play", card: view.hand[0] });
  });
});
