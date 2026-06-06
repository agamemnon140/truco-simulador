/**
 * Resolucao de uma vaza (rodada): quem jogou a carta mais forte vence.
 *
 * Empate ("canga"): ocorre quando as cartas mais fortes da rodada tem a mesma
 * forca mas pertencem a equipes diferentes. Se as cartas empatadas no topo
 * forem todas da MESMA equipe, essa equipe vence a vaza (sem empate).
 */

import { cardStrength } from "./ranking.js";
import { RuleSet } from "./rules.js";
import { Card, Seat, TeamId } from "./types.js";

/** Uma jogada: qual assento jogou qual carta. */
export interface Play {
  seat: Seat;
  card: Card;
}

/** Resultado de uma vaza. */
export interface VazaResult {
  /** Equipe vencedora, ou null se empatou. */
  winningTeam: TeamId | null;
  /** Assento da carta mais forte (lider da proxima vaza). null se empate. */
  winningSeat: Seat | null;
  /** True se a vaza empatou entre equipes diferentes. */
  tied: boolean;
}

/**
 * Resolve a vaza a partir das jogadas (uma por assento, em ordem de jogo).
 *
 * @param plays cartas jogadas nesta vaza
 * @param vira carta que define a manilha
 * @param teamOfSeat mapeia assento -> equipe (teamOfSeat[seat])
 * @param rules configuracao da variante
 */
export function resolveVaza(
  plays: readonly Play[],
  vira: Card,
  teamOfSeat: readonly TeamId[],
  rules: RuleSet,
): VazaResult {
  if (plays.length === 0) {
    throw new Error("Vaza sem jogadas.");
  }

  let maxStrength = -Infinity;
  for (const p of plays) {
    const s = cardStrength(p.card, vira, rules);
    if (s > maxStrength) maxStrength = s;
  }

  // Assentos que empataram na carta mais forte.
  const topSeats = plays
    .filter((p) => cardStrength(p.card, vira, rules) === maxStrength)
    .map((p) => p.seat);

  // Equipes representadas no topo.
  const topTeams = new Set(topSeats.map((seat) => teamOfSeat[seat]!));

  if (topTeams.size === 1) {
    // Todas as cartas mais fortes sao da mesma equipe: ela vence.
    // O lider e o primeiro (na ordem de jogo) entre os assentos do topo.
    const leaderSeat = topSeats[0]!;
    return {
      winningTeam: teamOfSeat[leaderSeat]!,
      winningSeat: leaderSeat,
      tied: false,
    };
  }

  // Topo dividido entre equipes diferentes: empate.
  return { winningTeam: null, winningSeat: null, tied: true };
}
