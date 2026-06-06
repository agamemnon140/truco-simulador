/**
 * Contrato de um jogador (humano, bot ou futura UI web).
 *
 * O orquestrador (hand/match) chama estes metodos para obter decisoes. A
 * implementacao e assincrona (Promise) para acomodar input humano no terminal,
 * calculo de bot ou interacao com uma UI — todos com a mesma interface.
 *
 * Cada decisao recebe uma PlayerView: uma visao FILTRADA do estado, contendo
 * apenas o que aquele jogador pode ver (sua mao, cartas ja jogadas, placar),
 * nunca o baralho inteiro nem a mao dos outros.
 */

import { RuleSet } from "../core/rules.js";
import { Play, VazaResult } from "../core/vaza.js";
import { Card, Rank, Seat, TeamId } from "../core/types.js";
import { PartnerSignals } from "./consult.js";

/**
 * Evento observavel da partida, despachado a TODOS os jogadores via `observe`.
 * Permite a um bot construir um MODELO dos adversarios (quem truca/corre/aceita,
 * quais cartas joga). Os eventos sao verdadeiros (refletem o que aconteceu).
 */
export type GameEvent =
  | { type: "handStart"; teamOfSeat: readonly TeamId[]; vira: Card }
  | { type: "play"; seat: Seat; team: TeamId; card: Card; vazaIndex: number }
  | { type: "raiseProposed"; seat: Seat; team: TeamId; level: number; value: number }
  | {
      type: "raiseResponse";
      seat: Seat;
      team: TeamId;
      response: RaiseResponse;
      proposingTeam: TeamId;
    }
  | { type: "handEnd"; winningTeam: TeamId | null; points: number };

/** Visao do estado que um jogador recebe para decidir. */
export interface PlayerView {
  /** Assento deste jogador. */
  seat: Seat;
  /** Equipe deste jogador. */
  team: TeamId;
  /** Cartas que este jogador ainda tem na mao. */
  hand: readonly Card[];
  /** Carta virada que define a manilha. */
  vira: Card;
  /** Rank que e manilha nesta mao. */
  manilha: Rank;
  /** Configuracao da variante. */
  rules: RuleSet;
  /** Pontuacao acumulada por equipe (scores[teamId]). */
  scores: readonly number[];
  /** Mapa assento -> equipe. */
  teamOfSeat: readonly TeamId[];
  /** Jogadas das vazas ja completas (vazaPlays[i] = jogadas da vaza i). */
  completedVazaPlays: readonly Play[][];
  /** Resultados das vazas ja completas. */
  completedVazaResults: readonly VazaResult[];
  /** Jogadas da vaza em andamento (antes deste jogador). */
  currentVazaPlays: readonly Play[];
  /** Valor atual da mao (1, 3, 6, 9 ou 12). */
  handValue: number;
  /**
   * Mao "fechada" (mao de onze 11x11): o jogador NAO conhece as proprias
   * cartas. Quando true, `hand` ainda traz as cartas (a UI deve esconde-las) e
   * o jogador escolhe "as cegas". Truco fica indisponivel.
   */
  blind: boolean;
  /**
   * "Comunicacao minima": sinais VERDADEIROS do parceiro (calculados da mao real
   * dele). Presente so quando ha parceiro (2v2) e nao e mao fechada. Os bots so
   * devem usar quando estao incertos da decisao.
   */
  partnerSignals?: PartnerSignals;
}

/** Decisao da equipe na "mao de onze" (uma equipe com pointsToWin-1). */
export type MaoDeOnzeDecision = "play" | "fold";

/** Contexto passado a quem decide a mao de onze. */
export interface MaoDeOnzeContext {
  /** Cartas dos PARCEIROS de equipe (consulta em dupla); a propria mao vem na view. */
  partnerHands: readonly (readonly Card[])[];
  /** Valor da mao se decidir jogar. */
  value: number;
  /** Valor que o adversario leva se esta equipe correr. */
  foldValue: number;
}

/** Acao de um jogador na sua vez: jogar uma carta ou pedir/aumentar o truco. */
export type Action =
  | { type: "play"; card: Card }
  | { type: "raise" }
  | { type: "fold" };

/** Resposta a um pedido de truco/aumento. */
export type RaiseResponse = "accept" | "run" | "raise";

/** Descreve um aumento proposto, mostrado a quem vai responder. */
export interface Proposal {
  proposer: Seat;
  proposingTeam: TeamId;
  /** Indice do nivel proposto em rules.bettingLevels. */
  level: number;
  /** Nome do nivel, ex.: "Truco", "Seis". */
  name: string;
  /** Valor da mao se o aumento for aceito. */
  value: number;
  /** Valor que a equipe proponente leva se a adversaria correr. */
  forfeitValue: number;
}

/**
 * Perfil de TRAPACA do "pe" (quem distribui), aplicado pelo MOTOR na distribuicao.
 * Tudo opcional e default-ausente -> jogo honesto inalterado.
 */
export interface CheatProfile {
  /** Prob. [0,1] de o "maco" engatar em cada mao em que este jogador e o pe. */
  macoStrength?: number;
  /** Nº de distribuicoes candidatas avaliadas quando o maco engata. */
  macoAttempts?: number;
  /** Prob. [0,1] de BACKFIRE (escolhe a distribuicao PIOR para o time). */
  macoBackfire?: number;
  /** Pesos do objetivo de manilha por papel (parceiro > pe > adversario > 0). */
  macoWeights?: { partner: number; dealer: number; opp: number };
  /** Prob. [0,1] de dar 4 cartas ao parceiro (ele fica com as 3 melhores). */
  extraCardProb?: number;
}

/** Interface implementada por humano, bot e futura UI. */
export interface Player {
  /** Nome exibido. */
  readonly name: string;

  /**
   * Na vez deste jogador: decidir entre jogar uma carta ou propor um aumento.
   * Se `canRaise` for false, o jogador NAO pode propor (deve jogar uma carta).
   */
  chooseAction(view: PlayerView, canRaise: boolean): Promise<Action>;

  /** Responder a um aumento proposto pela equipe adversaria. */
  respondToRaise(
    view: PlayerView,
    proposal: Proposal,
    canCounter: boolean,
  ): Promise<RaiseResponse>;

  /**
   * "Mao de onze": chamado UMA vez, antes da 1a carta, apenas para um
   * representante da equipe que esta com pointsToWin-1, para decidir entre
   * jogar (valendo `ctx.value`) ou correr (adversario leva `ctx.foldValue`).
   */
  decideMaoDeOnze(
    view: PlayerView,
    ctx: MaoDeOnzeContext,
  ): Promise<MaoDeOnzeDecision>;

  /**
   * Opcional: recebe TODOS os eventos da partida (proprios e dos outros), para
   * bots que modelam os adversarios. `selfSeat` e o assento deste jogador.
   */
  observe?(event: GameEvent, selfSeat: Seat): void;

  /** Opcional: perfil de trapaca exercido pelo MOTOR quando este jogador e o pe. */
  cheat?: CheatProfile;

  /**
   * Opcional ("melar"): ao ver a propria mao, pede REDISTRIBUICAO (anula a mao).
   * O proprio jogador controla seu orcamento por partida. O motor limita o nº de
   * redeals por mao para evitar loop.
   */
  wantsRedeal?(hand: readonly Card[], vira: Card): boolean;
}
