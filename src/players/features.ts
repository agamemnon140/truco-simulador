/**
 * Features contextuais para a inteligencia evoluida.
 *
 * Transforma a PlayerView (o que o jogador sabe) em vetores numericos:
 *  - features de CONTEXTO da partida/mao (compartilhadas por jogada e aposta);
 *  - features POR CARTA candidata (para o cardScore: qual carta jogar);
 *  - features de FORCA da mao (para as apostas).
 *
 * Tudo puro e sem I/O, reaproveitando core/ranking.ts. Os vetores tem tamanho
 * fixo (constantes abaixo) e cada posicao e ponderada por um peso do genoma.
 */

import { buildDeck } from "../core/deck.js";
import { cardStrength, compareCards, isManilha } from "../core/ranking.js";
import { Card, TeamId, cardsEqual } from "../core/types.js";
import { PlayerView } from "./player.js";

/** Quantidade de features em cada bloco (tamanho fixo dos vetores). */
export const CONTEXT_FEATURE_COUNT = 12;
export const CARD_OWN_FEATURE_COUNT = 8;
export const HAND_STRENGTH_FEATURE_COUNT = 6;
/** Features de intuicao GTO (apendice em betFeatures): bluffability + aFrenteTarde. */
export const GTO_FEATURE_COUNT = 2;
/** Features do MODELO DE OPONENTE (apendice em betFeatures): m7. */
export const OPP_FEATURE_COUNT = 4;
export const CARD_FEATURE_COUNT = CARD_OWN_FEATURE_COUNT + CONTEXT_FEATURE_COUNT; // 20
export const BET_FEATURE_COUNT =
  HAND_STRENGTH_FEATURE_COUNT + CONTEXT_FEATURE_COUNT + GTO_FEATURE_COUNT + OPP_FEATURE_COUNT; // 24

/** Nomes legiveis das features de contexto (mesma ordem de contextFeatures). */
export const CONTEXT_FEATURE_NAMES: readonly string[] = [
  "bias",
  "rodada",
  "minhasVazas",
  "vazasAdv",
  "ganhou1a",
  "lideraVaza",
  "parceiroLidera",
  "placarMeu",
  "placarAdv",
  "difPlacar",
  "proximidade",
  "valorEmJogo",
];

/** Nomes das features proprias da carta (mesma ordem de cardFeatures). */
export const CARD_OWN_FEATURE_NAMES: readonly string[] = [
  "forca",
  "manilha",
  "venceMesa",
  "pWin",
  "fracMaisFortes",
  "posicaoVaza",
  "forcaRelativa",
  "cobreParceiro",
];

/** Nomes das features de forca da mao (mesma ordem de betFeatures). */
export const HAND_STRENGTH_FEATURE_NAMES: readonly string[] = [
  "bias",
  "forcaMedia",
  "melhorCarta",
  "manilhas",
  "cartasFortes",
  "cartasRestantes",
];

/** Nomes do vetor completo de cardFeatures (carta + contexto). */
export const CARD_FEATURE_NAMES: readonly string[] = [
  ...CARD_OWN_FEATURE_NAMES,
  ...CONTEXT_FEATURE_NAMES,
];

/** Nomes das features de intuicao GTO (apendice). */
export const GTO_FEATURE_NAMES: readonly string[] = ["bluffability", "aFrenteTarde"];

/** Nomes das features do modelo de oponente (apendice; m7). */
export const OPP_FEATURE_NAMES: readonly string[] = ["oppFold", "oppTruco", "oppBluff", "oppAggr"];
/** Vetor neutro (priors 0.5) — usado quando nao ha modelo de oponente. */
export const NEUTRAL_OPP_FEATURES: readonly number[] = new Array(OPP_FEATURE_COUNT).fill(0.5);

/** Nomes do vetor completo de betFeatures (forca + contexto + GTO + oponente). */
export const BET_FEATURE_NAMES: readonly string[] = [
  ...HAND_STRENGTH_FEATURE_NAMES,
  ...CONTEXT_FEATURE_NAMES,
  ...GTO_FEATURE_NAMES,
  ...OPP_FEATURE_NAMES,
];

/** Forca maxima possivel de uma carta nesta variante (manilha mais forte). */
function maxStrength(view: PlayerView): number {
  return view.rules.rankOrder.length + view.rules.manilhaSuitOrder.length - 1;
}

function str(view: PlayerView, card: Card): number {
  return cardStrength(card, view.vira, view.rules);
}

/** Equipe adversaria (assume 2 equipes; usa a de maior pontuacao se houver +). */
function opponentTeam(view: PlayerView): TeamId {
  let opp: TeamId = view.team === 0 ? 1 : 0;
  // Para >2 equipes, pega a adversaria de maior pontuacao.
  for (let t = 0; t < view.scores.length; t++) {
    if (t !== view.team && view.scores[t]! >= view.scores[opp]!) opp = t;
  }
  return opp;
}

/** Estado da vaza atual sob o ponto de vista deste jogador. */
interface TrickCtx {
  hasPlays: boolean;
  bestCard: Card | null;
  bestTeam: TeamId | null;
  /** Minha equipe esta ganhando a vaza agora. */
  teamWinning: boolean;
  /** Quem lidera a vaza e meu PARCEIRO (mesma equipe, nao eu). */
  partnerWinning: boolean;
  /** Quantos ADVERSARIOS ainda jogam depois de mim nesta vaza. */
  opponentsAfter: number;
}

function trickContext(view: PlayerView): TrickCtx {
  const plays = view.currentVazaPlays;
  let bestCard: Card | null = null;
  let bestSeat = -1;
  for (const p of plays) {
    if (bestCard === null || compareCards(p.card, bestCard, view.vira, view.rules) > 0) {
      bestCard = p.card;
      bestSeat = p.seat;
    }
  }
  const n = view.rules.numPlayers;
  const myPos = plays.length; // indice onde vou jogar (0 = liderando)
  let opponentsAfter = 0;
  for (let k = 1; k <= n - 1 - myPos; k++) {
    const s = (view.seat + k) % n;
    if (view.teamOfSeat[s] !== view.team) opponentsAfter++;
  }
  const bestTeam = bestSeat >= 0 ? view.teamOfSeat[bestSeat]! : null;
  const teamWinning = bestTeam !== null && bestTeam === view.team;
  const partnerWinning = teamWinning && bestSeat >= 0 && bestSeat !== view.seat;
  return {
    hasPlays: plays.length > 0,
    bestCard,
    bestTeam,
    teamWinning,
    partnerWinning,
    opponentsAfter,
  };
}

/** Conjunto de cartas ainda nao vistas por este jogador (baralho - vistas). */
function unseenCards(view: PlayerView): Card[] {
  const seen: Card[] = [
    ...view.hand,
    view.vira,
    ...view.completedVazaPlays.flat().map((p) => p.card),
    ...view.currentVazaPlays.map((p) => p.card),
  ];
  return buildDeck().filter((c) => !seen.some((s) => cardsEqual(s, c)));
}

/** Dados pre-computados uma vez por decisao (evita recomputar por carta). */
export interface Precomputed {
  trick: TrickCtx;
  unseen: Card[];
  context: number[];
}

/** Vetor de features de CONTEXTO da partida/mao (tamanho CONTEXT_FEATURE_COUNT). */
export function contextFeatures(view: PlayerView, trick: TrickCtx): number[] {
  const myTeam = view.team;
  const opp = opponentTeam(view);
  const results = view.completedVazaResults;

  let myWins = 0;
  let oppWins = 0;
  for (const r of results) {
    if (r.winningTeam === myTeam) myWins++;
    else if (r.winningTeam !== null) oppWins++;
  }

  // Primeira vaza: 1 ganhei, 0 perdi, 0.5 empate/indefinido.
  let firstVaza = 0.5;
  const r0 = results[0];
  if (r0) firstVaza = r0.winningTeam === myTeam ? 1 : r0.winningTeam === null ? 0.5 : 0;

  // Quem ganha a vaza atual: 1 minha equipe, 0 adversaria, 0.5 sem jogadas.
  const trickLead = !trick.hasPlays ? 0.5 : trick.teamWinning ? 1 : 0;

  const P = view.rules.pointsToWin;
  const scoreMy = view.scores[myTeam] ?? 0;
  const scoreOpp = view.scores[opp] ?? 0;
  const maxStake = view.rules.bettingLevels.at(-1)?.value ?? P;

  return [
    1, // 0: bias (intercepto)
    results.length / 2, // 1: qual e a rodada (0/0.5/1)
    myWins / 2, // 2: vazas que minha dupla ganhou
    oppWins / 2, // 3: vazas que a adversaria ganhou
    firstVaza, // 4: ganhei a 1a vaza?
    trickLead, // 5: quem ganha a vaza atual
    trick.partnerWinning ? 1 : 0, // 6: meu parceiro esta ganhando a vaza
    scoreMy / P, // 7: meu placar (proximidade de vencer)
    scoreOpp / P, // 8: placar do adversario
    (scoreMy - scoreOpp) / P, // 9: diferenca de placar (quem ganha a partida)
    Math.max(scoreMy, scoreOpp) / P, // 10: proximidade do fim
    view.handValue / maxStake, // 11: valor em jogo nesta mao
  ];
}

/** Pre-computa contexto/unseen/featuresContext uma vez por decisao. */
export function precompute(view: PlayerView): Precomputed {
  const trick = trickContext(view);
  return {
    trick,
    unseen: unseenCards(view),
    context: contextFeatures(view, trick),
  };
}

/**
 * Features de uma CARTA candidata + contexto (tamanho CARD_FEATURE_COUNT).
 * Combina avaliacao da carta dada a informacao da vaza com o contexto da mao.
 */
export function cardFeatures(
  view: PlayerView,
  card: Card,
  pre: Precomputed,
): number[] {
  const max = maxStrength(view);
  const s = str(view, card);
  const { trick, unseen, context } = pre;

  // Vence a mesa agora? (0.5 se estou liderando, sem cartas na mesa)
  const beatsTable = !trick.hasPlays
    ? 0.5
    : trick.bestCard && compareCards(card, trick.bestCard, view.vira, view.rules) > 0
      ? 1
      : 0;

  // Cartas nao vistas mais fortes que esta (fracao): quanto menor, melhor.
  let stronger = 0;
  for (const c of unseen) if (str(view, c) > s) stronger++;
  const strongerFrac = unseen.length > 0 ? stronger / unseen.length : 0;

  // pWin aproximado: vence a mesa E nenhum adversario seguinte tem carta melhor.
  const canBeat = !trick.hasPlays || beatsTable === 1;
  const pWin = canBeat ? Math.pow(1 - strongerFrac, trick.opponentsAfter) : 0;

  // Posicao na vaza (0 = liderando, 1 = ultimo a jogar).
  const n = view.rules.numPlayers;
  const position = n > 1 ? view.currentVazaPlays.length / (n - 1) : 0;

  // Posicao relativa da carta na propria mao (0 = mais fraca, 1 = mais forte).
  const sorted = [...view.hand].sort((a, b) => str(view, a) - str(view, b));
  const idx = sorted.findIndex((c) => cardsEqual(c, card));
  const relRank = view.hand.length > 1 ? idx / (view.hand.length - 1) : 0.5;

  // Desperdicio: cobrir o PARCEIRO que ja esta ganhando a vaza (penalizar).
  const wastesOnPartner =
    trick.partnerWinning &&
    trick.bestCard &&
    compareCards(card, trick.bestCard, view.vira, view.rules) > 0
      ? 1
      : 0;

  const own = [
    s / max, // 0: forca absoluta normalizada
    isManilha(card, view.vira, view.rules) ? 1 : 0, // 1: e manilha
    beatsTable, // 2: vence a mesa agora
    pWin, // 3: prob. estimada de vencer a vaza
    strongerFrac, // 4: fracao de cartas nao vistas mais fortes
    position, // 5: posicao na vaza
    relRank, // 6: forca relativa dentro da mao
    wastesOnPartner, // 7: cobriria o parceiro (desperdicio)
  ];
  return [...own, ...context];
}

/** Features de FORCA da mao + contexto (tamanho BET_FEATURE_COUNT). */
export function betFeatures(
  view: PlayerView,
  pre: Precomputed,
  oppFeatures: readonly number[] = NEUTRAL_OPP_FEATURES,
): number[] {
  const max = maxStrength(view);
  const hand = view.hand;
  const cpp = view.rules.cardsPerPlayer || 1;

  let sum = 0;
  let maxCard = 0;
  let manilhas = 0;
  let strong = 0;
  for (const c of hand) {
    const v = str(view, c);
    sum += v;
    if (v > maxCard) maxCard = v;
    if (isManilha(c, view.vira, view.rules)) manilhas++;
    if (v / max > 0.7) strong++;
  }
  const avg = hand.length > 0 ? sum / (max * hand.length) : 0;

  const strength = [
    1, // 0: bias
    avg, // 1: forca media (handScore atual)
    maxCard / max, // 2: forca da melhor carta
    manilhas / cpp, // 3: nº de manilhas
    strong / cpp, // 4: nº de cartas fortes
    hand.length / cpp, // 5: cartas restantes
  ];

  // Features de intuicao GTO (apendice): habilitam o blefe polarizado.
  const results = view.completedVazaResults;
  // bluffability: alto quando a mao e fraca (avg < 0.5) -> blefe.
  const bluffability = Math.max(0, 0.5 - avg) * 2;
  // aFrenteTarde: ganhou a 1a vaza E ja avancou -> semi-blefe quando a frente.
  const wonFirst = results.length >= 1 && results[0]!.winningTeam === view.team ? 1 : 0;
  const vazaNorm = cpp > 1 ? results.length / (cpp - 1) : 0;
  const aFrenteTarde = wonFirst * Math.min(1, vazaNorm);

  return [...strength, ...pre.context, bluffability, aFrenteTarde, ...oppFeatures];
}
