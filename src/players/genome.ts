/**
 * Genoma da inteligencia evoluida: os parametros que o algoritmo genetico
 * otimiza. E um vetor de numeros reais (serializavel em JSON):
 *  - pesos do cardScore (jogada de carta);
 *  - pesos da avaliacao de situacao (apostas), produzindo um score S;
 *  - limiares de aposta (pedir/aceitar/aumentar);
 *  - genes de blefe/exploracao (pBluff, playTemp).
 *
 * O GA opera sobre o vetor achatado (toVector/fromVector); o EvolvedBotPlayer
 * usa a forma estruturada.
 */

import { Rng } from "../core/deck.js";
import { BET_FEATURE_COUNT, CARD_FEATURE_COUNT } from "./features.js";

export interface Genome {
  /** Pesos do cardScore (length = CARD_FEATURE_COUNT). */
  cardWeights: number[];
  /** Pesos da avaliacao de aposta (length = BET_FEATURE_COUNT). */
  betWeights: number[];
  /** Limiar de S para PEDIR truco. */
  thrCall: number;
  /** Limiar de S para ACEITAR um truco. */
  thrAccept: number;
  /** Limiar de S para AUMENTAR (re-trucar) ao responder. */
  thrRaise: number;
  /** Gene cru de blefe (a probabilidade real e sigmoid(pBluff)). */
  pBluff: number;
  /** Gene cru de temperatura do softmax na escolha da carta (0 = argmax). */
  playTemp: number;
}

/** Quantidade de escalares (alem dos dois vetores de pesos). */
const SCALAR_COUNT = 5;

/** Tamanho do vetor achatado do genoma. */
export const GENOME_LENGTH =
  CARD_FEATURE_COUNT + BET_FEATURE_COUNT + SCALAR_COUNT;

/** Achata o genoma em um vetor (para o GA). */
export function toVector(g: Genome): number[] {
  return [
    ...g.cardWeights,
    ...g.betWeights,
    g.thrCall,
    g.thrAccept,
    g.thrRaise,
    g.pBluff,
    g.playTemp,
  ];
}

/** Reconstroi o genoma a partir do vetor achatado. */
export function fromVector(v: readonly number[]): Genome {
  if (v.length !== GENOME_LENGTH) {
    throw new Error(
      `Vetor de genoma com tamanho ${v.length}, esperado ${GENOME_LENGTH}.`,
    );
  }
  let i = 0;
  const cardWeights = v.slice(i, (i += CARD_FEATURE_COUNT)) as number[];
  const betWeights = v.slice(i, (i += BET_FEATURE_COUNT)) as number[];
  return {
    cardWeights,
    betWeights,
    thrCall: v[i++]!,
    thrAccept: v[i++]!,
    thrRaise: v[i++]!,
    pBluff: v[i++]!,
    playTemp: v[i++]!,
  };
}

/**
 * Genoma semente: pesos "a mao" que codificam boa intuicao de truco (vencer a
 * vaza com a carta mais barata, nao cobrir o parceiro, guardar manilhas). Serve
 * de ponto de partida para o GA nao comecar do zero.
 */
export function seedGenome(): Genome {
  const cardWeights = new Array<number>(CARD_FEATURE_COUNT).fill(0);
  // Indices (ver features.cardFeatures): 0 forca,1 manilha,2 venceMesa,3 pWin,
  // 4 fracMaisFortes,5 posicao,6 forcaRelativa,7 cobreParceiro, 8.. contexto.
  cardWeights[0] = -0.4; // prefira gastar a carta mais barata
  cardWeights[1] = -0.5; // guarde manilhas
  cardWeights[2] = 1.5; // bom vencer a mesa
  cardWeights[3] = 1.5; // bom ter alta prob. de vencer
  cardWeights[4] = -0.6; // ruim ter muitas cartas mais fortes por vir
  cardWeights[6] = -0.3; // prefira a carta mais fraca da mao
  cardWeights[7] = -2.0; // NAO cubra o parceiro que ja ganha

  const betWeights = new Array<number>(BET_FEATURE_COUNT).fill(0);
  // Indices (ver features.betFeatures): 0 bias,1 media,2 melhor,3 manilhas,
  // 4 fortes,5 restantes, 6.. contexto (6 bias,8 myWins,10 firstVaza,11 trickLead...).
  betWeights[1] = 2.0; // forca media
  betWeights[2] = 1.5; // melhor carta
  betWeights[3] = 2.0; // manilhas
  betWeights[4] = 1.0; // cartas fortes
  betWeights[8] = 1.0; // vazas ja vencidas
  betWeights[10] = 0.5; // ganhou a 1a vaza
  betWeights[11] = 0.5; // ganhando a vaza atual

  return {
    cardWeights,
    betWeights,
    thrCall: 1.6,
    thrAccept: 0.8,
    thrRaise: 2.0,
    pBluff: -2.2, // sigmoid(-2.2) ~ 0.10
    playTemp: 0, // argmax
  };
}

/**
 * Valida e normaliza um objeto (ex.: vindo de JSON) para um Genome.
 * Puro (sem I/O): serve tanto para o CLI quanto para o navegador.
 */
export function parseGenome(obj: unknown): Genome {
  const g = obj as Partial<Genome>;
  const okArr = (a: unknown, n: number): a is number[] =>
    Array.isArray(a) && a.length === n && a.every((x) => typeof x === "number");
  if (!okArr(g.cardWeights, CARD_FEATURE_COUNT)) {
    throw new Error(`cardWeights invalido (esperado ${CARD_FEATURE_COUNT} numeros).`);
  }
  if (!okArr(g.betWeights, BET_FEATURE_COUNT)) {
    throw new Error(`betWeights invalido (esperado ${BET_FEATURE_COUNT} numeros).`);
  }
  for (const k of ["thrCall", "thrAccept", "thrRaise", "pBluff", "playTemp"] as const) {
    if (typeof g[k] !== "number") throw new Error(`Campo ${k} ausente/invalido no genoma.`);
  }
  return {
    cardWeights: g.cardWeights,
    betWeights: g.betWeights,
    thrCall: g.thrCall!,
    thrAccept: g.thrAccept!,
    thrRaise: g.thrRaise!,
    pBluff: g.pBluff!,
    playTemp: g.playTemp!,
  };
}

/** Genoma aleatorio para popular a geracao inicial do GA. */
export function randomGenome(rng: Rng): Genome {
  const w = (scale: number) => (rng() * 2 - 1) * scale;
  return {
    cardWeights: Array.from({ length: CARD_FEATURE_COUNT }, () => w(1.5)),
    betWeights: Array.from({ length: BET_FEATURE_COUNT }, () => w(1.5)),
    thrCall: rng() * 2,
    thrAccept: rng() * 2,
    thrRaise: rng() * 2,
    pBluff: rng() * 3 - 3, // [-3, 0) -> sigmoid pequeno
    playTemp: rng() * 1.5,
  };
}
