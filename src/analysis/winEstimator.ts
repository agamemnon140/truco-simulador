/**
 * Estimador de vitoria da MAO atual (3 vazas), do ponto de vista de um jogador,
 * supondo que a mao seja jogada ate o fim SEM truco/aumentos, sob uma POLITICA DE
 * ROLLOUT fixa (uma das inteligencias ja construidas, ou o baseline aleatorio).
 *
 * O jogador ("heroi") so conhece a propria mao, as cartas ja jogadas por todos e
 * quem venceu cada vaza. A chance de vitoria e uma esperanca sobre os "mundos"
 * possiveis das cartas desconhecidas (ver ./worlds.ts). Respeita a informacao
 * imperfeita: cada jogador decide so pela sua propria visao (ver ./rollout.ts).
 *
 * DEPENDE da inteligencia assumida: a politica define COMO as cartas restantes
 * sao jogadas (por todos, inclusive o parceiro). Para escolher a MELHOR carta sem
 * clarividencia, ver ./singleDummy.ts; para o jogo otimo com cartas a vista (com
 * vies de clarividencia), ./doubleDummy.ts.
 *
 * O condicionamento das jogadas observadas e UNIFORME (correto sob oponente
 * aleatorio); likelihood-weighting fica como extensao futura.
 */

import { TeamId } from "../core/types.js";
import { PlayerView } from "../players/player.js";
import { seededRng } from "../training/rng.js";
import { PolicyId, makePolicyPlayer, playoutWorld } from "./rollout.js";
import { WorldOptions, iterWorlds, planWorlds } from "./worlds.js";

export type { PolicyId } from "./rollout.js";

export interface EstimateOptions extends WorldOptions {
  /** Inteligencia usada por TODOS os assentos no rollout. Default "inocente". */
  policy?: PolicyId;
}

export interface WinEstimate {
  winProb: number;
  tieProb: number;
  lossProb: number;
  samples: number;
  method: "montecarlo" | "exact";
  policy: PolicyId;
}

/**
 * Estima a chance de a equipe do heroi vencer a MAO atual, jogada ate o fim sem
 * truco, sob a politica de rollout dada.
 */
export async function estimateWin(
  view: PlayerView,
  opts: EstimateOptions = {},
): Promise<WinEstimate> {
  const policy = opts.policy ?? "inocente";
  const { method } = planWorlds(view, opts);
  const heroTeam: TeamId = view.team;
  const playerRng = seededRng((opts.seed ?? 1) + 7);
  const player = makePolicyPlayer(policy, playerRng);

  let win = 0;
  let tie = 0;
  let loss = 0;
  let n = 0;
  for (const hands of iterWorlds(view, opts)) {
    const winner = await playoutWorld(view, hands, player);
    if (winner === null) tie++;
    else if (winner === heroTeam) win++;
    else loss++;
    n++;
  }
  const denom = n || 1;
  return {
    winProb: win / denom,
    tieProb: tie / denom,
    lossProb: loss / denom,
    samples: n,
    method,
    policy,
  };
}

/** Roda varias politicas sobre a mesma view (conveniencia para estudos). */
export async function comparePolicies(
  view: PlayerView,
  policies: PolicyId[],
  opts: Omit<EstimateOptions, "policy"> = {},
): Promise<Record<string, WinEstimate>> {
  const out: Record<string, WinEstimate> = {};
  for (const policy of policies) {
    out[policy] = await estimateWin(view, { ...opts, policy });
  }
  return out;
}
