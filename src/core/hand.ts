/**
 * Orquestracao de uma MAO (3 vazas) de truco.
 *
 * Distribui as cartas, conduz cada vaza pedindo decisoes aos jogadores, trata a
 * negociacao do truco (pedir/aceitar/correr/aumentar) e resolve quem venceu a
 * mao (incluindo as regras de empate). Nao faz I/O: recebe os Players (que
 * podem ser humanos ou bots) e um observador opcional para a UI renderizar.
 */

import {
  BettingState,
  acceptRaise,
  canPropose,
  currentValue,
  forfeitValueOnRun,
  initBetting,
  isMaxed,
  nextLevel,
} from "./betting.js";
import { Deal, Rng, deal } from "./deck.js";
import { cardStrength, isManilha, manilhaRank } from "./ranking.js";
import { RuleSet } from "./rules.js";
import { Card, Seat, TeamId, cardsEqual } from "./types.js";
import { Play, VazaResult, resolveVaza } from "./vaza.js";
import { partnerSignalsOf } from "../players/consult.js";
import {
  GameEvent,
  MaoDeOnzeContext,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  Proposal,
  RaiseResponse,
} from "../players/player.js";

/** Observador opcional para a UI acompanhar o que acontece na mao. */
export interface HandObserver {
  onDeal?(info: {
    vira: Card;
    manilha: string;
    leader: Seat;
    /** Maos distribuidas por assento (copia; so para hosts/observadores). */
    hands: readonly (readonly Card[])[];
  }): void;
  onPlay?(info: { seat: Seat; card: Card; vazaIndex: number }): void;
  onRaiseProposed?(proposal: Proposal): void;
  onRaiseResponse?(info: {
    responder: Seat;
    response: RaiseResponse;
  }): void;
  onVazaResolved?(info: {
    vazaIndex: number;
    result: VazaResult;
    plays: readonly Play[];
  }): void;
  /** Disparado quando a mao e uma "mao de onze" (single ou both). */
  onMaoDeOnze?(info: {
    mode: "single" | "both";
    /** Equipe em pointsToWin-1 (apenas no modo single). */
    teamAt11?: TeamId;
    /** Valor da mao. */
    value: number;
  }): void;
  /** Decisao da equipe na mao de onze single (jogar ou correr). */
  onMaoDeOnzeDecision?(info: {
    team: TeamId;
    decision: MaoDeOnzeDecision;
  }): void;
  onHandEnd?(result: HandResult): void;
}

/** Resultado de uma mao. */
export interface HandResult {
  /** Equipe vencedora, ou null se a mao foi anulada (empate total). */
  winningTeam: TeamId | null;
  /** Pontos a creditar a equipe vencedora (0 se anulada). */
  points: number;
  /** Por que a mao terminou. */
  reason: "vazas" | "run" | "cancelled" | "fold" | "giveup";
}

export interface HandConfig {
  rules: RuleSet;
  /** Jogadores indexados por assento. */
  players: readonly Player[];
  /** Mapa assento -> equipe. */
  teamOfSeat: readonly TeamId[];
  /** Pontuacao atual por equipe (apenas para exibir na view). */
  scores: readonly number[];
  /** Assento que lidera a primeira vaza ("mao"). */
  firstSeat: Seat;
  /** Fonte de aleatoriedade para distribuir. */
  rng?: Rng;
  /** Observador opcional. */
  observer?: HandObserver;
}

/**
 * Decide o vencedor da mao a partir dos resultados das vazas conhecidos.
 * Retorna a equipe vencedora, "continue" (jogar mais vaza) ou "cancel".
 */
export function decideHand(
  results: readonly VazaResult[],
  rules: RuleSet,
): TeamId | "continue" | "cancel" {
  const r1 = results[0];
  const r2 = results[1];
  const r3 = results[2];

  // Precisa de pelo menos 2 vazas para decidir.
  if (!r2) return "continue";

  const t1 = r1!.winningTeam;
  const t2 = r2.winningTeam;

  if (t1 !== null && t2 !== null) {
    if (t1 === t2) return t1; // venceu as duas primeiras
    // Split 1-1: a terceira decide.
    if (!r3) return "continue";
    if (r3.winningTeam !== null) return r3.winningTeam;
    // Terceira empatou: vence quem fez a primeira vaza.
    return t1;
  }

  if (t1 === null && t2 !== null) return t2; // empatou 1a, venceu 2a
  if (t1 !== null && t2 === null) return t1; // venceu 1a, empatou 2a

  // Ambas empataram (t1 === null && t2 === null): a terceira decide.
  if (!r3) return "continue";
  if (r3.winningTeam !== null) return r3.winningTeam;
  // Empate nas tres: mao anulada (ou regra da casa).
  return rules.cancelOnFullTie ? "cancel" : "cancel";
}

/** Primeiro assento (em ordem de jogo) apos `seat` cuja equipe difere. */
function firstOpponentAfter(
  seat: Seat,
  team: TeamId,
  teamOfSeat: readonly TeamId[],
): Seat {
  const n = teamOfSeat.length;
  for (let k = 1; k < n; k++) {
    const s = (seat + k) % n;
    if (teamOfSeat[s] !== team) return s;
  }
  throw new Error("Nenhum adversario encontrado (mesa de uma equipe so?).");
}

/** Conduz uma mao completa e retorna seu resultado. */
export async function playHand(cfg: HandConfig): Promise<HandResult> {
  const { rules, players, teamOfSeat, scores, firstSeat, observer } = cfg;
  const n = rules.numPlayers;
  const rng: Rng = cfg.rng ?? Math.random;

  // --- Distribuicao, com possivel TRAPACA do "pe" (quem da as cartas) ---
  const dealerSeat = ((firstSeat - 1 + n) % n) as Seat;
  const dealerTeam = teamOfSeat[dealerSeat]!;
  let partnerOfDealer = -1;
  for (let k = 1; k < n; k++) {
    const s = (dealerSeat + k) % n;
    if (teamOfSeat[s] === dealerTeam) {
      partnerOfDealer = s;
      break;
    }
  }
  const cheat = players[dealerSeat]?.cheat;

  // Forca efetiva do maco: sobe se o time do pe esta PERDENDO no placar.
  const macoEngage = (() => {
    if (!cheat) return 0;
    let maxOther = -Infinity;
    for (let t = 0; t < scores.length; t++) if (t !== dealerTeam) maxOther = Math.max(maxOther, scores[t]!);
    const losing = maxOther > (scores[dealerTeam] ?? 0);
    return losing && cheat.macoStrengthLosing !== undefined
      ? cheat.macoStrengthLosing
      : cheat.macoStrength ?? 0;
  })();

  // "Maco": objetivo de MANILHA ponderado por papel (parceiro > pe > adversario).
  const macoScore = (d: Deal): number => {
    const w = cheat?.macoWeights ?? { partner: 3, dealer: 2, opp: 1 };
    let sc = 0;
    for (let seat = 0; seat < n; seat++) {
      const m = d.hands[seat]!.filter((c) => isManilha(c, d.vira, rules)).length;
      const weight =
        seat === partnerOfDealer ? w.partner : teamOfSeat[seat] === dealerTeam ? w.dealer : w.opp;
      sc += weight * m;
    }
    return sc;
  };

  const dealOnce = (): Deal => {
    let d = deal(n, rules.cardsPerPlayer, cfg.rng);
    // Maco: com prob. efetiva (sobe se perdendo), escolhe entre K candidatos.
    if (cheat && macoEngage && rng() < macoEngage) {
      const K = Math.max(2, cheat.macoAttempts ?? 4);
      const cands: Deal[] = [d];
      for (let k = 1; k < K; k++) cands.push(deal(n, rules.cardsPerPlayer, cfg.rng));
      const backfire = rng() < (cheat.macoBackfire ?? 0.2);
      d = cands.reduce((best, c) => {
        const cmp = macoScore(c) - macoScore(best);
        return (backfire ? cmp < 0 : cmp > 0) ? c : best;
      });
    }
    // 4 cartas ao parceiro: ele fica com as 3 MELHORES de 4.
    if (
      cheat?.extraCardProb &&
      partnerOfDealer >= 0 &&
      d.rest.length > 0 &&
      rng() < cheat.extraCardProb
    ) {
      const four = [...d.hands[partnerOfDealer]!, d.rest[0]!];
      four.sort((a, b) => cardStrength(a, d.vira, rules) - cardStrength(b, d.vira, rules));
      d.hands[partnerOfDealer] = four.slice(1); // descarta a mais fraca
    }
    return d;
  };

  let dealt = dealOnce();
  // "Melar": se algum jogador reclama da propria mao, redistribui (com teto rigido).
  const MAX_REDEALS = 2;
  for (let r = 0; r < MAX_REDEALS; r++) {
    const wants = players.some((p, seat) => p.wantsRedeal?.(dealt.hands[seat]!, dealt.vira) ?? false);
    if (!wants) break;
    dealt = dealOnce();
  }
  const vira = dealt.vira;
  const manilha = manilhaRank(vira, rules);
  // Copia mutavel das maos por assento (cartas vao sendo removidas).
  const hands: Card[][] = dealt.hands.map((h) => h.slice());

  let betting: BettingState = initBetting();
  const vazaResults: VazaResult[] = [];
  const allVazaPlays: Play[][] = [];
  let leader: Seat = firstSeat;

  // --- Mao de onze: detectar o modo a partir do placar ---
  const threshold = rules.pointsToWin - 1;
  const teamsAtThreshold: TeamId[] = [];
  for (let t = 0; t < rules.numTeams; t++) {
    if (scores[t] === threshold) teamsAtThreshold.push(t);
  }
  const onzeActive = rules.maoDeOnze && teamsAtThreshold.length > 0;
  const onzeBoth = onzeActive && teamsAtThreshold.length >= 2;
  const onzeSingle = onzeActive && teamsAtThreshold.length === 1;
  const noTruco = onzeActive; // sem truco em qualquer mao de onze
  const blind = onzeBoth; // 11x11 e jogada "fechada"
  // Valor base efetivo desta mao (3 na mao de onze single; senao baseValue).
  const effectiveBase = onzeSingle ? rules.maoDeOnzeValue : rules.baseValue;

  /** Valor da mao agora: base efetiva se sem aumento, senao o nivel aceito. */
  const valueNow = (): number =>
    betting.level < 0 ? effectiveBase : currentValue(betting, rules);

  observer?.onDeal?.({
    vira,
    manilha,
    leader,
    hands: hands.map((h) => h.slice()),
  });

  /** Despacha um evento a TODOS os jogadores (cada um filtra o que e do oponente). */
  const broadcast = (ev: GameEvent): void => {
    for (let i = 0; i < n; i++) players[i]!.observe?.(ev, i as Seat);
  };
  /** Encerra a mao: notifica o observador (UI) e os jogadores (modelagem). */
  const emitHandEnd = (r: HandResult): void => {
    observer?.onHandEnd?.(r);
    broadcast({ type: "handEnd", winningTeam: r.winningTeam, points: r.points });
  };
  broadcast({ type: "handStart", teamOfSeat, vira });

  /** Parceiro de equipe (primeiro assento do mesmo time != seat); -1 se nenhum. */
  const partnerSeat = (seat: Seat): Seat => {
    for (let k = 1; k < n; k++) {
      const s = (seat + k) % n;
      if (teamOfSeat[s] === teamOfSeat[seat]) return s;
    }
    return -1;
  };

  const buildView = (seat: Seat, currentVazaPlays: Play[]): PlayerView => {
    // Sinais do parceiro ("comunicacao minima") — so em 2v2 e fora de mao fechada.
    let partnerSignals: PlayerView["partnerSignals"];
    const pSeat = partnerSeat(seat);
    if (!blind && pSeat >= 0) {
      let oppBest = -1;
      for (const p of currentVazaPlays) {
        if (teamOfSeat[p.seat] !== teamOfSeat[seat]) {
          const s = cardStrength(p.card, vira, rules);
          if (s > oppBest) oppBest = s;
        }
      }
      partnerSignals = partnerSignalsOf(hands[pSeat]!, vira, rules, oppBest);
    }
    return {
      seat,
      team: teamOfSeat[seat]!,
      hand: hands[seat]!,
      vira,
      manilha,
      rules,
      scores,
      teamOfSeat,
      completedVazaPlays: allVazaPlays,
      completedVazaResults: vazaResults,
      currentVazaPlays,
      handValue: valueNow(),
      blind,
      partnerSignals,
    };
  };

  // --- Mao de onze single: a equipe de 11 decide jogar ou correr ---
  if (onzeSingle) {
    const teamAt11 = teamsAtThreshold[0]!;
    observer?.onMaoDeOnze?.({ mode: "single", teamAt11, value: effectiveBase });

    // Representante: primeiro assento da equipe de 11 na ordem de jogo.
    let deciderSeat = firstSeat;
    for (let k = 0; k < n; k++) {
      const s = (firstSeat + k) % n;
      if (teamOfSeat[s] === teamAt11) {
        deciderSeat = s;
        break;
      }
    }
    // Consulta em dupla: ve as cartas dos parceiros (alem da propria, na view).
    const partnerHands: Card[][] = [];
    for (let s = 0; s < n; s++) {
      if (s !== deciderSeat && teamOfSeat[s] === teamAt11) {
        partnerHands.push(hands[s]!.slice());
      }
    }
    const oppSeat = firstOpponentAfter(deciderSeat, teamAt11, teamOfSeat);
    const opponentTeam = teamOfSeat[oppSeat]!;

    const ctx: MaoDeOnzeContext = {
      partnerHands,
      value: effectiveBase,
      foldValue: rules.baseValue,
    };
    const decision = await players[deciderSeat]!.decideMaoDeOnze(
      buildView(deciderSeat, []),
      ctx,
    );
    observer?.onMaoDeOnzeDecision?.({ team: teamAt11, decision });

    if (decision === "fold") {
      const result: HandResult = {
        winningTeam: opponentTeam,
        points: rules.baseValue,
        reason: "fold",
      };
      emitHandEnd(result);
      return result;
    }
  } else if (onzeBoth) {
    observer?.onMaoDeOnze?.({ mode: "both", value: effectiveBase });
  }

  /**
   * Conduz a negociacao iniciada por `starter` que pediu aumento.
   * Retorna o vencedor por desistencia (e seus pontos) ou null se aceito/seguir.
   */
  const negotiate = async (
    starter: Seat,
    currentVazaPlays: Play[],
  ): Promise<{ winner: TeamId; points: number } | null> => {
    let proposer: Seat = starter;
    // Laco de propostas/contrapropostas.
    for (;;) {
      const lvl = nextLevel(betting, rules);
      if (!lvl) return null; // ja no maximo: nada a propor
      const proposingTeam = teamOfSeat[proposer]!;
      const proposal: Proposal = {
        proposer,
        proposingTeam,
        level: lvl.index,
        name: lvl.name,
        value: lvl.value,
        forfeitValue: forfeitValueOnRun(betting, rules),
      };
      observer?.onRaiseProposed?.(proposal);
      broadcast({
        type: "raiseProposed",
        seat: proposer,
        team: proposingTeam,
        level: lvl.index,
        value: lvl.value,
      });

      const responderSeat = firstOpponentAfter(
        proposer,
        proposingTeam,
        teamOfSeat,
      );
      const canCounter = lvl.index < rules.bettingLevels.length - 1;
      const response: RaiseResponse = await players[responderSeat]!
        .respondToRaise(
          buildView(responderSeat, currentVazaPlays),
          proposal,
          canCounter,
        );
      observer?.onRaiseResponse?.({ responder: responderSeat, response });
      broadcast({
        type: "raiseResponse",
        seat: responderSeat,
        team: teamOfSeat[responderSeat]!,
        response,
        proposingTeam,
      });

      if (response === "run") {
        // Quem propos leva o valor estabelecido antes do aumento.
        return { winner: proposingTeam, points: proposal.forfeitValue };
      }

      // Tanto aceitar quanto aumentar fixam o nivel proposto como aceito.
      betting = acceptRaise(betting, proposingTeam, rules);

      if (response === "accept" || isMaxed(betting, rules) || !canCounter) {
        return null;
      }

      // Contraproposta: o respondedor passa a ser o proponente.
      proposer = responderSeat;
    }
  };

  // Laco das vazas.
  for (let v = 0; v < rules.cardsPerPlayer; v++) {
    const plays: Play[] = [];
    for (let k = 0; k < n; k++) {
      const seat: Seat = (leader + k) % n;
      const team = teamOfSeat[seat]!;

      // O jogador pode propor aumento antes de jogar (talvez varias vezes ate
      // decidir jogar), desde que sua equipe possa propor.
      for (;;) {
        const allowRaise = !noTruco && canPropose(betting, team, rules);
        const action = await players[seat]!.chooseAction(
          buildView(seat, plays),
          allowRaise,
        );

        if (action.type === "raise") {
          if (!allowRaise) {
            // Ignora pedido invalido: trata como se nada tivesse sido pedido.
            continue;
          }
          const outcome = await negotiate(seat, plays);
          if (outcome) {
            const result: HandResult = {
              winningTeam: outcome.winner,
              points: outcome.points,
              reason: "run",
            };
            emitHandEnd(result);
            return result;
          }
          // Aumento aceito: o mesmo jogador agora deve jogar uma carta.
          continue;
        }

        if (action.type === "fold") {
          // Desistir da mao: o adversario leva a mao pelo valor corrente.
          const oppSeat = firstOpponentAfter(seat, team, teamOfSeat);
          const result: HandResult = {
            winningTeam: teamOfSeat[oppSeat]!,
            points: valueNow(),
            reason: "giveup",
          };
          emitHandEnd(result);
          return result;
        }

        // Jogar uma carta: validar que esta na mao.
        const hand = hands[seat]!;
        const idx = hand.findIndex((c) => cardsEqual(c, action.card));
        if (idx < 0) {
          throw new Error(
            `Jogador ${seat} tentou jogar carta que nao possui.`,
          );
        }
        hand.splice(idx, 1);
        plays.push({ seat, card: action.card });
        observer?.onPlay?.({ seat, card: action.card, vazaIndex: v });
        broadcast({ type: "play", seat, team, card: action.card, vazaIndex: v });
        break;
      }
    }

    const result = resolveVaza(plays, vira, teamOfSeat, rules);
    vazaResults.push(result);
    allVazaPlays.push(plays);
    observer?.onVazaResolved?.({ vazaIndex: v, result, plays });

    const decision = decideHand(vazaResults, rules);
    if (decision === "cancel") {
      const handResult: HandResult = {
        winningTeam: null,
        points: 0,
        reason: "cancelled",
      };
      emitHandEnd(handResult);
      return handResult;
    }
    if (decision !== "continue") {
      const handResult: HandResult = {
        winningTeam: decision,
        points: valueNow(),
        reason: "vazas",
      };
      emitHandEnd(handResult);
      return handResult;
    }

    // Proxima vaza: lidera quem venceu; em empate, mantem o lider.
    if (result.winningSeat !== null) leader = result.winningSeat;
  }

  // Esgotaram as vazas sem decisao explicita: anula (caso raro de empates).
  const fallback: HandResult = {
    winningTeam: null,
    points: 0,
    reason: "cancelled",
  };
  emitHandEnd(fallback);
  return fallback;
}
