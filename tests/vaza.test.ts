import { describe, expect, it } from "vitest";
import { resolveVaza } from "../src/core/vaza.js";
import { TRUCO_PAULISTA } from "../src/core/rules.js";
import { Card, Rank, Suit, TeamId } from "../src/core/types.js";

const R = TRUCO_PAULISTA;
const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });
// Duplas: assentos 0,2 = equipe 0; 1,3 = equipe 1.
const teams: TeamId[] = [0, 1, 0, 1];
const vira = card(Rank.Quatro, Suit.Paus); // manilha = 5

describe("resolveVaza", () => {
  it("a carta mais forte vence", () => {
    const r = resolveVaza(
      [
        { seat: 0, card: card(Rank.As, Suit.Ouros) },
        { seat: 1, card: card(Rank.Tres, Suit.Espadas) },
        { seat: 2, card: card(Rank.Sete, Suit.Copas) },
        { seat: 3, card: card(Rank.Cinco, Suit.Paus) }, // manilha (zap)
      ],
      vira,
      teams,
      R,
    );
    expect(r.winningSeat).toBe(3);
    expect(r.winningTeam).toBe(1);
    expect(r.tied).toBe(false);
  });

  it("empata quando o topo e dividido entre equipes diferentes", () => {
    const r = resolveVaza(
      [
        { seat: 0, card: card(Rank.Tres, Suit.Ouros) },
        { seat: 1, card: card(Rank.Tres, Suit.Paus) }, // mesmo rank comum
        { seat: 2, card: card(Rank.Quatro, Suit.Copas) },
        { seat: 3, card: card(Rank.Cinco, Suit.Espadas) }, // manilha vence as comuns
      ],
      vira,
      teams,
      R,
    );
    // Manilha do assento 3 e o topo unico -> vence equipe 1, sem empate.
    expect(r.winningSeat).toBe(3);
    expect(r.tied).toBe(false);
  });

  it("empate real: maiores cartas iguais em equipes diferentes", () => {
    const r = resolveVaza(
      [
        { seat: 0, card: card(Rank.Tres, Suit.Ouros) },
        { seat: 1, card: card(Rank.Tres, Suit.Paus) },
        { seat: 2, card: card(Rank.Sete, Suit.Copas) },
        { seat: 3, card: card(Rank.Seis, Suit.Espadas) },
      ],
      vira,
      teams,
      R,
    );
    // Dois '3' comuns no topo, equipes 0 e 1 -> empate.
    expect(r.tied).toBe(true);
    expect(r.winningTeam).toBe(null);
    expect(r.winningSeat).toBe(null);
  });

  it("topo empatado na MESMA equipe nao e empate", () => {
    const r = resolveVaza(
      [
        { seat: 0, card: card(Rank.Tres, Suit.Ouros) },
        { seat: 1, card: card(Rank.Sete, Suit.Paus) },
        { seat: 2, card: card(Rank.Tres, Suit.Copas) }, // mesmo rank do assento 0
        { seat: 3, card: card(Rank.Sete, Suit.Espadas) },
      ],
      vira,
      teams,
      R,
    );
    // Dois '3' no topo, ambos da equipe 0 -> equipe 0 vence.
    expect(r.tied).toBe(false);
    expect(r.winningTeam).toBe(0);
  });
});
