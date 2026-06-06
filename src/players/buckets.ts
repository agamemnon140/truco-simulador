/**
 * Configuracao das features "em faixas" (estilo GTO): cada variavel continua
 * selecionada e dividida em ate N_BUCKETS faixas, com LIMIARES evolutivos e um
 * peso por faixa (ambos no genoma). Aqui ficam: quantas faixas, quais variaveis
 * (e o indice delas no vetor de features) e a funcao que mapeia valor -> faixa.
 */

export const N_BUCKETS = 4;

export interface BucketVar {
  /** Nome legivel (para explicabilidade/relatorio). */
  name: string;
  /** Indice da variavel no vetor de features (cardFeatures ou betFeatures). */
  index: number;
  /** Dominio para normalizar o valor a [0,1] antes de comparar com limiares. */
  min: number;
  max: number;
}

/** Variaveis bucketizadas do lado CARTA (indices em cardFeatures). */
export const CARD_BUCKET_VARS: readonly BucketVar[] = [
  { name: "pWin", index: 3, min: 0, max: 1 },
  { name: "fracMaisFortes", index: 4, min: 0, max: 1 },
  { name: "forcaRelativa", index: 6, min: 0, max: 1 },
];

/** Variaveis bucketizadas do lado APOSTA (indices em betFeatures). */
export const BET_BUCKET_VARS: readonly BucketVar[] = [
  { name: "forcaMedia", index: 1, min: 0, max: 1 },
  { name: "difPlacar", index: 15, min: -1, max: 1 },
  { name: "valorEmJogo", index: 17, min: 0, max: 1 },
];

/** Nº de limiares (N-1) e de pesos (N) por variavel. */
export const THRESH_PER_VAR = N_BUCKETS - 1;
export const WEIGHTS_PER_VAR = N_BUCKETS;

export const CARD_THRESH_COUNT = CARD_BUCKET_VARS.length * THRESH_PER_VAR;
export const CARD_BUCKET_W_COUNT = CARD_BUCKET_VARS.length * WEIGHTS_PER_VAR;
export const BET_THRESH_COUNT = BET_BUCKET_VARS.length * THRESH_PER_VAR;
export const BET_BUCKET_W_COUNT = BET_BUCKET_VARS.length * WEIGHTS_PER_VAR;

/**
 * Faixa (0..N-1) de um valor cru, dado o dominio [min,max] e os limiares (em
 * [0,1], serao ORDENADOS aqui). Limiares fora do alcance dos dados => faixas
 * nunca usadas (= menos faixas efetivas).
 */
export function bucketIndex(
  raw: number,
  min: number,
  max: number,
  thresholds: readonly number[],
): number {
  const span = max - min || 1;
  const x = Math.min(1, Math.max(0, (raw - min) / span));
  const sorted = [...thresholds].sort((a, b) => a - b);
  let i = 0;
  for (const t of sorted) {
    if (x >= t) i++;
    else break;
  }
  return i; // 0..N-1
}
