/**
 * Entrada para o navegador no modo INTERATIVO: um ou mais jogadores HUMANOS
 * (em qualquer assento) jogam contra/com bots, usando o mesmo motor (core).
 *
 * Diferente de `simulate()` (que roda a partida inteira e devolve o transcript
 * no fim), aqui a partida e conduzida ao vivo: cada humano e um Player cujos
 * metodos so resolvem quando a UI sinaliza o clique (ver HumanWebPlayer), e o
 * observador EMITE eventos estruturados (PlayEvent) para a UI desenhar a mesa /
 * o terminal em tempo real, em vez de bufferizar texto.
 *
 * Empacotamento (npm run build:web) expoe no global `Truco`:
 *   Truco.playInteractive(options, ui) -> Promise<MatchResult>
 */

import { MatchObserver, MatchResult, assignTeams, playMatch } from "../core/match.js";
import { HandResult } from "../core/hand.js";
import { TRUCO_PAULISTA } from "../core/rules.js";
import { Card, Seat, TeamId } from "../core/types.js";
import { Play, VazaResult } from "../core/vaza.js";
import { cardStrength, isManilha } from "../core/ranking.js";
import { getPersonality } from "../players/personalities.js";
import { DecisionInfo, formatBetting, formatCardChoice } from "../players/explain.js";
import { Player, Proposal, RaiseResponse, MaoDeOnzeDecision } from "../players/player.js";
import { ConsultApi, ConsultResult, HumanWebHooks, HumanWebPlayer } from "../players/humanWeb.js";
import { canWinLevel, signalLevel, trucoAdviceLevel } from "../players/consult.js";

/** RNG deterministico (LCG) para partidas reproduziveis por semente. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Configuracao de um assento: humano (joga pela UI) ou IA (personalidade). */
export type SeatConfig =
  | { kind: "human"; name: string }
  | { kind: "ai"; botId: string; name?: string };

export interface PlayOptions {
  /** Config dos assentos 0..3, na ordem do motor (parceiros cruzados: 0+2, 1+3). */
  seats: readonly SeatConfig[];
  /** Semente para reproduzir a mesma partida. Omitido = aleatorio. */
  seed?: number;
  /** Placar inicial por equipe (ex.: [9,9] para chegar logo na mao de onze). */
  initialScores?: number[];
  /**
   * Pausa (ms) antes de CADA decisao de bot, para que as jogadas dos bots fiquem
   * visiveis e ritmadas na UI. Default 0 (sem pausa).
   */
  stepDelayMs?: number;
  /**
   * Se false, um bot que e PARCEIRO de um humano nao inicia/aumenta truco (so o
   * humano controla os pedidos de truco da dupla). Default true.
   */
  aiPartnerCanRaise?: boolean;
  /** Liga as explicacoes das IAs evoluidas (evento `explain`). */
  explain?: boolean;
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
 * Envolve um bot para que ele NUNCA inicie/aumente truco: chama o bot sempre com
 * `canRaise=false`/`canCounter=false`, entao ele joga uma carta / aceita ou corre,
 * mas nao propoe aumento. Usado no parceiro-IA de um humano quando a opcao pede.
 */
function noInitiateRaise(inner: Player): Player {
  return {
    name: inner.name,
    chooseAction(view, _canRaise) {
      return inner.chooseAction(view, false);
    },
    respondToRaise(view, proposal, _canCounter) {
      return inner.respondToRaise(view, proposal, false);
    },
    decideMaoDeOnze(view, ctx) {
      return inner.decideMaoDeOnze(view, ctx);
    },
  };
}

/**
 * Eventos estruturados emitidos ao vivo para a UI. Uniao discriminada por `kind`.
 * NOTA: as cartas dos BOTS nunca saem do motor; `deal` so traz as maos dos humanos.
 */
export type PlayEvent =
  | { kind: "matchStart"; teamOfSeat: readonly TeamId[]; names: readonly string[]; humanSeats: readonly Seat[] }
  | { kind: "handStart"; handNumber: number; firstSeat: Seat }
  | {
      kind: "deal";
      vira: Card;
      manilha: string;
      /** Maos dos assentos HUMANOS (seat -> cartas). Bots nao incluidos. */
      humanHands: Record<number, readonly Card[]>;
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
  | { kind: "explain"; seat: Seat; text: string }
  | { kind: "matchEnd"; winningTeam: TeamId; scores: readonly number[] };

/** A UI implementa os hooks de decisao do humano + o recebedor de eventos. */
export interface PlayUiHooks extends HumanWebHooks {
  onEvent(ev: PlayEvent): void;
}

/**
 * Conduz uma partida interativa ate alguem chegar a 12. Resolve com o resultado
 * final. A partida pausa naturalmente em cada decisao humana (Promise pendente no
 * HumanWebPlayer) e so avanca quando a UI chama o `resolve` correspondente.
 */
export async function playInteractive(
  opts: PlayOptions,
  ui: PlayUiHooks,
): Promise<MatchResult> {
  const rules = TRUCO_PAULISTA;
  const teamOfSeat = assignTeams(rules);
  const seats = opts.seats;

  const humanSeats: Seat[] = [];
  seats.forEach((s, i) => {
    if (s.kind === "human") humanSeats.push(i);
  });
  const partnerIsHuman = (seat: Seat) =>
    teamOfSeat.some(
      (t, other) => other !== seat && t === teamOfSeat[seat] && humanSeats.includes(other),
    );

  const mkRng = (offset: number) =>
    opts.seed === undefined ? undefined : seededRng(opts.seed * 100 + offset);
  const delay = opts.stepDelayMs ?? 0;
  const allowPartnerRaise = opts.aiPartnerCanRaise !== false;

  // --- Estado "ao vivo" para a coordenacao com o parceiro (sinais/opinioes). ---
  // Acompanhamos as maos reais e a vaza atual a partir do observador, para que um
  // humano possa, na sua vez, consultar o parceiro (que esta congelado na sua
  // decisao). Tudo roda local; as respostas sao computadas, nao a mao crua.
  let liveHands: Card[][] = [];
  let liveVira: Card | null = null;
  let liveVaza = -1;
  let liveCurrentPlays: Play[] = [];
  const partnerOf = (seat: Seat): Seat => {
    const idx = teamOfSeat.findIndex(
      (t, other) => other !== seat && t === teamOfSeat[seat],
    );
    return idx >= 0 ? idx : seat;
  };
  const consultProvider = (seat: Seat): ConsultApi | undefined => {
    if (!liveVira) return undefined;
    const pSeat = partnerOf(seat);
    const team = teamOfSeat[seat]!;
    const vira = liveVira;
    const hand = () => liveHands[pSeat] ?? [];
    const str = (c: Card) => cardStrength(c, vira, rules);
    return {
      partnerName: players[pSeat]?.name ?? "Parceiro",
      signal(): ConsultResult {
        const h = hand();
        const lvl = signalLevel(h, vira, rules);
        const man = h.filter((c) => isManilha(c, vira, rules)).length;
        const three = h.filter((c) => c.rank === "3").length;
        if (lvl === 2) return { kind: "signal", level: 2, text: man > 1 ? `tenho ${man} manilhas! 💪` : "tenho manilha! 💪" };
        if (lvl === 1) return { kind: "signal", level: 1, text: three > 1 ? `tenho ${three} cartas 3 👌` : "tenho um 3 👌" };
        return { kind: "signal", level: 0, text: "não tenho nada de especial 😬" };
      },
      canWin(): ConsultResult {
        const h = hand();
        if (!h.length) return { kind: "canWin", level: 0, text: "já joguei minhas cartas" };
        const oppBest = liveCurrentPlays
          .filter((p) => teamOfSeat[p.seat] !== team)
          .reduce((m, p) => Math.max(m, str(p.card)), -1);
        const lvl = canWinLevel(h, vira, rules, oppBest);
        if (lvl === 2) return { kind: "canWin", level: 2, text: "faço essa, pode deixar! 💪" };
        if (lvl === 1) return { kind: "canWin", level: 1, text: "tenho chance, vou tentar 🤞" };
        return { kind: "canWin", level: 0, text: "tá difícil, não conta comigo 😬" };
      },
      trucoAdvice(): ConsultResult {
        const h = hand();
        const lvl = trucoAdviceLevel(h, vira, rules);
        if (lvl === 2) return { kind: "truco", level: 2, text: "tô forte, pode pedir/aceitar! 🔥" };
        if (lvl === 1) return { kind: "truco", level: 1, text: "dá pra encarar, mas com cuidado 🤔" };
        return { kind: "truco", level: 0, text: "tô fraco, melhor não 🙅" };
      },
    };
  };

  const players: Player[] = seats.map((cfg, seat) => {
    if (cfg.kind === "human") {
      return new HumanWebPlayer(cfg.name, ui, consultProvider);
    }
    const pers = getPersonality(cfg.botId);
    const onDecision: ((info: DecisionInfo) => void) | undefined = opts.explain
      ? (info) => {
          const text = info.raised
            ? formatBetting(info.betting, info.name)
            : info.cardChoice
              ? formatCardChoice(info.cardChoice, info.name)
              : "";
          if (text) ui.onEvent({ kind: "explain", seat, text });
        }
      : undefined;
    let p = pers.create(cfg.name ?? pers.label, mkRng(seat + 1), onDecision);
    if (!allowPartnerRaise && partnerIsHuman(seat)) p = noInitiateRaise(p);
    if (delay > 0) p = withDelay(p, delay);
    return p;
  });
  const names = players.map((p) => p.name);

  const observer: MatchObserver = {
    onMatchStart({ teamOfSeat: tos }) {
      ui.onEvent({ kind: "matchStart", teamOfSeat: tos, names, humanSeats });
    },
    onHandStart({ handNumber, firstSeat }) {
      ui.onEvent({ kind: "handStart", handNumber, firstSeat });
    },
    onDeal({ vira, manilha, hands }) {
      // Estado ao vivo (para consulta ao parceiro): copia das maos reais.
      liveHands = hands.map((h) => h.slice());
      liveVira = vira;
      liveVaza = -1;
      liveCurrentPlays = [];
      const humanHands: Record<number, readonly Card[]> = {};
      for (const s of humanSeats) humanHands[s] = hands[s]!.slice();
      ui.onEvent({
        kind: "deal",
        vira,
        manilha,
        humanHands,
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
      // Atualiza estado ao vivo: remove a carta jogada da mao real do assento.
      if (vazaIndex !== liveVaza) { liveVaza = vazaIndex; liveCurrentPlays = []; }
      liveCurrentPlays.push({ seat, card });
      const h = liveHands[seat];
      if (h) {
        const i = h.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
        if (i >= 0) h.splice(i, 1);
      }
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
    rules,
    players,
    observer,
    rng: opts.seed === undefined ? undefined : seededRng(opts.seed),
    initialScores: opts.initialScores,
  });
}
