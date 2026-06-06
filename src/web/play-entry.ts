/**
 * Entrada para o navegador no modo INTERATIVO: um jogador humano (assento 0)
 * joga contra/com bots, usando o mesmo motor (core).
 *
 * Diferente de `simulate()` (que roda a partida inteira e devolve o transcript
 * no fim), aqui a partida e conduzida ao vivo: o humano e um Player cujos metodos
 * so resolvem quando a UI sinaliza o clique (ver HumanWebPlayer), e o observador
 * EMITE eventos estruturados (PlayEvent) para a UI desenhar a mesa / o terminal
 * em tempo real, em vez de bufferizar texto.
 *
 * Empacotamento (npm run build:web) expoe no global `Truco`:
 *   Truco.playInteractive(options, ui) -> Promise<MatchResult>
 */

import { MatchObserver, MatchResult, playMatch } from "../core/match.js";
import { HandResult } from "../core/hand.js";
import { TRUCO_PAULISTA } from "../core/rules.js";
import { Card, Seat, TeamId } from "../core/types.js";
import { Play, VazaResult } from "../core/vaza.js";
import { getPersonality } from "../players/personalities.js";
import { Player, Proposal, RaiseResponse, MaoDeOnzeDecision } from "../players/player.js";
import { HumanWebHooks, HumanWebPlayer } from "../players/humanWeb.js";

/** Assento ocupado pelo humano. Fixo no 0 (time 0, junto do parceiro no assento 2). */
export const HUMAN_SEAT: Seat = 0;

/** RNG deterministico (LCG) para partidas reproduziveis por semente. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export interface PlayOptions {
  /** Personalidade do PARCEIRO (assento 2, mesmo time do humano). */
  partnerBot: string;
  /** Personalidade do ADVERSARIO 1 (assento 1). */
  opp1Bot: string;
  /** Personalidade do ADVERSARIO 2 (assento 3). */
  opp2Bot: string;
  /** Nome exibido do humano. Default "Voce". */
  humanName?: string;
  /** Semente para reproduzir a mesma partida. Omitido = aleatorio. */
  seed?: number;
  /** Placar inicial por equipe (ex.: [9,9] para chegar logo na mao de onze). */
  initialScores?: number[];
  /**
   * Pausa (ms) antes de CADA decisao de bot, para que as jogadas dos bots fiquem
   * visiveis e ritmadas na UI. Sem isso a engine resolve todos os turnos de bot
   * em microtasks (sem ceder ao navegador para pintar), e a mesa "pula" direto
   * para a proxima vez do humano. Default 0 (sem pausa).
   */
  stepDelayMs?: number;
}

/** Envolve um bot para esperar `ms` reais antes de cada decisao (cede ao event loop). */
function withDelay(inner: Player, ms: number): Player {
  const wait = () => new Promise<void>((r) => setTimeout(r, ms));
  return {
    name: inner.name,
    async chooseAction(view, canRaise) {
      await wait();
      return inner.chooseAction(view, canRaise);
    },
    async respondToRaise(view, proposal, canCounter) {
      await wait();
      return inner.respondToRaise(view, proposal, canCounter);
    },
    async decideMaoDeOnze(view, ctx) {
      await wait();
      return inner.decideMaoDeOnze(view, ctx);
    },
  };
}

/**
 * Eventos estruturados emitidos ao vivo para a UI. Uniao discriminada por `kind`.
 * NOTA: nunca expomos as cartas dos adversarios — `deal` so traz a mao do humano.
 */
export type PlayEvent =
  | { kind: "matchStart"; teamOfSeat: readonly TeamId[]; names: readonly string[] }
  | { kind: "handStart"; handNumber: number; firstSeat: Seat }
  | {
      kind: "deal";
      vira: Card;
      manilha: string;
      /** Mao do proprio humano (as demais ficam ocultas). */
      humanHand: readonly Card[];
      /** Quantidade de cartas de cada assento (para desenhar verso). */
      handSizes: readonly number[];
    }
  | { kind: "maoDeOnze"; mode: "single" | "both"; teamAt11?: TeamId; value: number }
  | { kind: "maoDeOnzeDecision"; team: TeamId; decision: MaoDeOnzeDecision }
  | { kind: "play"; seat: Seat; card: Card; vazaIndex: number }
  | { kind: "raiseProposed"; proposal: Proposal }
  | { kind: "raiseResponse"; responder: Seat; response: RaiseResponse }
  | { kind: "vazaResolved"; vazaIndex: number; result: VazaResult; plays: readonly Play[] }
  | { kind: "score"; result: HandResult; scores: readonly number[] }
  | { kind: "matchEnd"; winningTeam: TeamId; scores: readonly number[] };

/** A UI implementa os hooks de decisao do humano + o recebedor de eventos. */
export interface PlayUiHooks extends HumanWebHooks {
  onEvent(ev: PlayEvent): void;
}

/**
 * Conduz uma partida interativa ate alguem chegar a 12. Resolve com o resultado
 * final. A partida pausa naturalmente em cada decisao do humano (Promise pendente
 * no HumanWebPlayer) e so avanca quando a UI chama o `resolve` correspondente.
 */
export async function playInteractive(
  opts: PlayOptions,
  ui: PlayUiHooks,
): Promise<MatchResult> {
  const human = new HumanWebPlayer(opts.humanName ?? "Voce", ui);

  // Assentos: 0 humano (time 0) | 1 adv (time 1) | 2 parceiro (time 0) | 3 adv (time 1).
  const mkRng = (offset: number) =>
    opts.seed === undefined ? undefined : seededRng(opts.seed * 100 + offset);
  const delay = opts.stepDelayMs ?? 0;
  const bot = (id: string, name: string, offset: number): Player => {
    const b = getPersonality(id).create(name, mkRng(offset));
    return delay > 0 ? withDelay(b, delay) : b;
  };
  const players: Player[] = [
    human,
    bot(opts.opp1Bot, "Adv 1", 2),
    bot(opts.partnerBot, "Parceiro", 3),
    bot(opts.opp2Bot, "Adv 2", 4),
  ];
  const names = players.map((p) => p.name);

  const observer: MatchObserver = {
    onMatchStart({ teamOfSeat }) {
      ui.onEvent({ kind: "matchStart", teamOfSeat, names });
    },
    onHandStart({ handNumber, firstSeat }) {
      ui.onEvent({ kind: "handStart", handNumber, firstSeat });
    },
    onDeal({ vira, manilha, hands }) {
      ui.onEvent({
        kind: "deal",
        vira,
        manilha,
        humanHand: hands[HUMAN_SEAT] ?? [],
        handSizes: hands.map((h) => h.length),
      });
    },
    onMaoDeOnze({ mode, teamAt11, value }) {
      ui.onEvent({ kind: "maoDeOnze", mode, teamAt11, value });
    },
    onMaoDeOnzeDecision({ team, decision }) {
      ui.onEvent({ kind: "maoDeOnzeDecision", team, decision });
    },
    onPlay({ seat, card, vazaIndex }) {
      ui.onEvent({ kind: "play", seat, card, vazaIndex });
    },
    onRaiseProposed(proposal) {
      ui.onEvent({ kind: "raiseProposed", proposal });
    },
    onRaiseResponse({ responder, response }) {
      ui.onEvent({ kind: "raiseResponse", responder, response });
    },
    onVazaResolved({ vazaIndex, result, plays }) {
      ui.onEvent({ kind: "vazaResolved", vazaIndex, result, plays });
    },
    onScoreUpdate({ result, scores }) {
      ui.onEvent({ kind: "score", result, scores });
    },
    onMatchEnd({ winningTeam, scores }) {
      ui.onEvent({ kind: "matchEnd", winningTeam, scores });
    },
  };

  return playMatch({
    rules: TRUCO_PAULISTA,
    players,
    observer,
    rng: opts.seed === undefined ? undefined : seededRng(opts.seed),
    initialScores: opts.initialScores,
  });
}
