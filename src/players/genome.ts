/**
 * Genoma da inteligencia evoluida: os parametros que o algoritmo genetico
 * otimiza. E um vetor de numeros reais (serializavel em JSON):
 *  - pesos lineares do cardScore (carta) e da avaliacao de aposta (S);
 *  - limiares de aposta (pedir/aceitar/aumentar) e genes de blefe/exploracao;
 *  - SECOES DE FAIXA (buckets): por variavel selecionada, limiares evolutivos
 *    (N-1) + um peso por faixa (N), permitindo efeito nao-linear por faixa
 *    (baixo/medio/alto), com a granularidade decidida pelo GA.
 *
 * O GA opera sobre o vetor achatado (toVector/fromVector); o scorer/EvolvedBot
 * usa a forma estruturada.
 */

import { Rng } from "../core/deck.js";
import {
  BET_BUCKET_VARS,
  BET_BUCKET_W_COUNT,
  BET_THRESH_COUNT,
  CARD_BUCKET_VARS,
  CARD_BUCKET_W_COUNT,
  CARD_THRESH_COUNT,
  N_BUCKETS,
  THRESH_PER_VAR,
} from "./buckets.js";
import { BET_FEATURE_COUNT, CARD_FEATURE_COUNT } from "./features.js";

export interface Genome {
  /** Pesos lineares do cardScore (length = CARD_FEATURE_COUNT). */
  cardWeights: number[];
  /** Pesos lineares da avaliacao de aposta (length = BET_FEATURE_COUNT). */
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
  /** Limiares das faixas das variaveis de CARTA (CARD_THRESH_COUNT, em [0,1]). */
  cardBucketThresholds: number[];
  /** Pesos das faixas das variaveis de CARTA (CARD_BUCKET_W_COUNT). */
  cardBucketWeights: number[];
  /** Limiares das faixas das variaveis de APOSTA (BET_THRESH_COUNT). */
  betBucketThresholds: number[];
  /** Pesos das faixas das variaveis de APOSTA (BET_BUCKET_W_COUNT). */
  betBucketWeights: number[];
}

/** Quantidade de escalares (alem dos vetores). */
const SCALAR_COUNT = 5;

/** Tamanho do vetor achatado do genoma. */
export const GENOME_LENGTH =
  CARD_FEATURE_COUNT +
  BET_FEATURE_COUNT +
  SCALAR_COUNT +
  CARD_THRESH_COUNT +
  CARD_BUCKET_W_COUNT +
  BET_THRESH_COUNT +
  BET_BUCKET_W_COUNT;

/** Limiares "espalhados" (k/N) por variavel — ponto de partida neutro. */
function spreadThresholds(numVars: number): number[] {
  const out: number[] = [];
  for (let v = 0; v < numVars; v++) {
    for (let k = 1; k < N_BUCKETS; k++) out.push(k / N_BUCKETS);
  }
  return out;
}

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
    ...g.cardBucketThresholds,
    ...g.cardBucketWeights,
    ...g.betBucketThresholds,
    ...g.betBucketWeights,
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
  const take = (n: number) => v.slice(i, (i += n)) as number[];
  const cardWeights = take(CARD_FEATURE_COUNT);
  const betWeights = take(BET_FEATURE_COUNT);
  const thrCall = v[i++]!;
  const thrAccept = v[i++]!;
  const thrRaise = v[i++]!;
  const pBluff = v[i++]!;
  const playTemp = v[i++]!;
  const cardBucketThresholds = take(CARD_THRESH_COUNT);
  const cardBucketWeights = take(CARD_BUCKET_W_COUNT);
  const betBucketThresholds = take(BET_THRESH_COUNT);
  const betBucketWeights = take(BET_BUCKET_W_COUNT);
  return {
    cardWeights,
    betWeights,
    thrCall,
    thrAccept,
    thrRaise,
    pBluff,
    playTemp,
    cardBucketThresholds,
    cardBucketWeights,
    betBucketThresholds,
    betBucketWeights,
  };
}

/**
 * Genoma semente: pesos lineares "a mao" (boa intuicao de truco) e faixas
 * NEUTRAS (pesos 0 -> comporta-se como o linear puro; o GA ativa as faixas).
 */
export function seedGenome(): Genome {
  const cardWeights = new Array<number>(CARD_FEATURE_COUNT).fill(0);
  cardWeights[0] = -0.4; // prefira gastar a carta mais barata
  cardWeights[1] = -0.5; // guarde manilhas
  cardWeights[2] = 1.5; // bom vencer a mesa
  cardWeights[3] = 1.5; // bom ter alta prob. de vencer
  cardWeights[4] = -0.6; // ruim ter muitas cartas mais fortes por vir
  cardWeights[6] = -0.3; // prefira a carta mais fraca da mao
  cardWeights[7] = -2.0; // NAO cubra o parceiro que ja ganha

  const betWeights = new Array<number>(BET_FEATURE_COUNT).fill(0);
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
    pBluff: -2.2,
    playTemp: 0,
    cardBucketThresholds: spreadThresholds(CARD_BUCKET_VARS.length),
    cardBucketWeights: new Array<number>(CARD_BUCKET_W_COUNT).fill(0),
    betBucketThresholds: spreadThresholds(BET_BUCKET_VARS.length),
    betBucketWeights: new Array<number>(BET_BUCKET_W_COUNT).fill(0),
  };
}

/**
 * Valida/normaliza um objeto (ex.: JSON) para um Genome. MIGRACAO: genomas
 * antigos (sem secoes de faixa) recebem faixas NEUTRAS (pesos 0) -> comportamento
 * identico. Puro (sem I/O): serve ao CLI e ao navegador.
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
  // Secoes de faixa: usar se presentes/validas; senao, NEUTRAS (migracao).
  const bucket = (a: unknown, n: number, fill: number[]): number[] =>
    okArr(a, n) ? a : fill;
  return {
    cardWeights: g.cardWeights,
    betWeights: g.betWeights,
    thrCall: g.thrCall!,
    thrAccept: g.thrAccept!,
    thrRaise: g.thrRaise!,
    pBluff: g.pBluff!,
    playTemp: g.playTemp!,
    cardBucketThresholds: bucket(
      g.cardBucketThresholds,
      CARD_THRESH_COUNT,
      spreadThresholds(CARD_BUCKET_VARS.length),
    ),
    cardBucketWeights: bucket(
      g.cardBucketWeights,
      CARD_BUCKET_W_COUNT,
      new Array<number>(CARD_BUCKET_W_COUNT).fill(0),
    ),
    betBucketThresholds: bucket(
      g.betBucketThresholds,
      BET_THRESH_COUNT,
      spreadThresholds(BET_BUCKET_VARS.length),
    ),
    betBucketWeights: bucket(
      g.betBucketWeights,
      BET_BUCKET_W_COUNT,
      new Array<number>(BET_BUCKET_W_COUNT).fill(0),
    ),
  };
}

/** Genoma aleatorio para popular a geracao inicial do GA. */
export function randomGenome(rng: Rng): Genome {
  const w = (scale: number) => (rng() * 2 - 1) * scale;
  const thresholds = (numVars: number) =>
    Array.from({ length: numVars * THRESH_PER_VAR }, () => rng()); // [0,1)
  return {
    cardWeights: Array.from({ length: CARD_FEATURE_COUNT }, () => w(1.5)),
    betWeights: Array.from({ length: BET_FEATURE_COUNT }, () => w(1.5)),
    thrCall: rng() * 2,
    thrAccept: rng() * 2,
    thrRaise: rng() * 2,
    pBluff: rng() * 3 - 3,
    playTemp: rng() * 1.5,
    cardBucketThresholds: thresholds(CARD_BUCKET_VARS.length),
    cardBucketWeights: Array.from({ length: CARD_BUCKET_W_COUNT }, () => w(0.6)),
    betBucketThresholds: thresholds(BET_BUCKET_VARS.length),
    betBucketWeights: Array.from({ length: BET_BUCKET_W_COUNT }, () => w(0.6)),
  };
}
