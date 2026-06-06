/**
 * Formatacao/render do estado do jogo para o terminal.
 */

import { PlayerView } from "../players/player.js";
import { Card, Suit, TeamId } from "../core/types.js";
import { Play } from "../core/vaza.js";

const SUIT_SYMBOL: Record<Suit, string> = {
  [Suit.Ouros]: "♦",
  [Suit.Espadas]: "♠",
  [Suit.Copas]: "♥",
  [Suit.Paus]: "♣",
};

/** Formata uma carta de forma curta, ex.: "3♣". */
export function fmtCard(card: Card): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

/** Nome de exibicao de uma equipe (1-based). */
export function teamName(team: TeamId): string {
  return `Equipe ${team + 1}`;
}

/** Lista a mao do jogador com indices para escolha: "[0] 3♣  [1] A♥". */
export function fmtHandWithIndices(hand: readonly Card[]): string {
  return hand.map((c, i) => `[${i}] ${fmtCard(c)}`).join("   ");
}

/** Formata as jogadas de uma vaza: "Ana: 3♣ | Bia: K♦". */
export function fmtPlays(plays: readonly Play[], names: readonly string[]): string {
  if (plays.length === 0) return "(ninguem jogou ainda)";
  return plays.map((p) => `${names[p.seat]}: ${fmtCard(p.card)}`).join(" | ");
}

/** Cabecalho com placar, vira/manilha e a vaza em andamento. */
export function renderTurnHeader(
  view: PlayerView,
  names: readonly string[],
): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("─".repeat(60));
  const scoreStr = view.scores
    .map((s, t) => `${teamName(t)}: ${s}`)
    .join("   |   ");
  lines.push(`Placar:  ${scoreStr}        Valor da mao: ${view.handValue}`);
  lines.push(
    `Vira: ${fmtCard(view.vira)}    Manilha: ${view.manilha}    ` +
      `(forca: ♦ < ♠ < ♥ < ♣)`,
  );

  // Vazas anteriores resumidas.
  view.completedVazaResults.forEach((r, i) => {
    const who =
      r.winningTeam === null ? "empate" : teamName(r.winningTeam);
    lines.push(`  Vaza ${i + 1}: ${who}`);
  });

  lines.push(`Vaza atual: ${fmtPlays(view.currentVazaPlays, names)}`);
  lines.push("─".repeat(60));
  return lines.join("\n");
}
