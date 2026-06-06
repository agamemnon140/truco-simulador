/**
 * Subjogo "duas ultimas vazas 2v2" como jogo de TIME (coordenadores), assumindo
 * que o TIME A venceu a 1a vaza. Agora cada jogador tem 2 cartas -> alem da
 * aposta, ha a decisao de QUAL CARTA jogar na vaza 2 (com info sequencial: cada
 * assento ve as cartas jogadas antes da sua).
 *
 * Premissas: assento 0 (Time A) lidera a vaza 2; aposta = uma rodada de
 * truco->seis no inicio da vaza 2 (so A inicia); vaza 3 forcada. A vence a mao a
 * menos que B vença a 2a E a 3a vaza (empate favorece A, que fez a 1a).
 *
 * O deal (8 cartas) e grande demais para enumerar -> usa MCCFR via sampleChance.
 */

import { buildDeck } from "../../core/deck.js";
import { cardStrength } from "../../core/ranking.js";
import { TRUCO_PAULISTA } from "../../core/rules.js";
import { Card, cardsEqual } from "../../core/types.js";
import { Game } from "../game.js";

const RULES = TRUCO_PAULISTA;
const TEAM = [0, 1, 0, 1] as const; // assento -> time
const ORDER = [0, 1, 2, 3] as const; // ordem de jogo na vaza 2 (assento 0 lidera)

export interface TT2State {
  hands: number[][]; // forcas restantes por assento (0..3)
  bet: string; // "", "truco", "truco:seis", ou marcador resolvido
  resolved: boolean; // aposta concluida -> fase de jogar carta
  stake: number; // 1/3/6
  term: number | null; // payoff terminal por desistencia (ou null)
  v2: [number, number][]; // jogadas da vaza 2: (assento, forca)
}

/** Time vencedor de um conjunto de jogadas; null = empate no topo entre times. */
function winnerTeam(plays: readonly [number, number][]): number | null {
  let max = -Infinity;
  for (const [, st] of plays) if (st > max) max = st;
  const teams = new Set<number>();
  for (const [seat, st] of plays) if (st === max) teams.add(TEAM[seat]!);
  return teams.size > 1 ? null : [...teams][0]!;
}

export class TrucoTwoTricks2v2 implements Game<TT2State> {
  private readonly deckStrengths: number[];

  constructor(vira: Card) {
    this.deckStrengths = buildDeck()
      .filter((c) => !cardsEqual(c, vira))
      .map((c) => cardStrength(c, vira, RULES));
  }

  sampleChance(rng: () => number): TT2State {
    // Sorteia 8 cartas distintas (Fisher-Yates parcial) e distribui 2 por assento.
    const idx = this.deckStrengths.map((_, i) => i);
    for (let i = 0; i < 8; i++) {
      const j = i + Math.floor(rng() * (idx.length - i));
      const t = idx[i]!;
      idx[i] = idx[j]!;
      idx[j] = t;
    }
    const hands: number[][] = [];
    for (let seat = 0; seat < 4; seat++) {
      const a = this.deckStrengths[idx[seat * 2]!]!;
      const b = this.deckStrengths[idx[seat * 2 + 1]!]!;
      hands.push([Math.min(a, b), Math.max(a, b)]);
    }
    return { hands, bet: "", resolved: false, stake: 0, term: null, v2: [] };
  }

  chanceOutcomes() {
    return []; // grande demais para enumerar; use trainSampled (MCCFR)
  }

  isTerminal(s: TT2State): boolean {
    return s.term !== null || (s.resolved && s.v2.length === 4);
  }

  payoff0(s: TT2State): number {
    if (s.term !== null) return s.term;
    // Vaza 2 completa -> resolve a mao (A fez a 1a vaza).
    const v2w = winnerTeam(s.v2);
    const v3: [number, number][] = s.hands.map((h, seat) => [seat, h[0]!]);
    const v3w = winnerTeam(v3);
    const bWinsHand = v2w === 1 && v3w === 1; // B precisa vencer 2a E 3a
    return bWinsHand ? -s.stake : s.stake;
  }

  currentPlayer(s: TT2State): 0 | 1 {
    if (!s.resolved) {
      if (s.bet === "") return 0; // A: truco/check
      if (s.bet === "truco") return 1; // B responde
      return 0; // "truco:seis" -> A responde
    }
    return TEAM[ORDER[s.v2.length]!]!;
  }

  infoSet(s: TT2State): string {
    const team = this.currentPlayer(s);
    const seats = team === 0 ? [0, 2] : [1, 3];
    const me = seats.map((x) => s.hands[x]!.join(".")).join("|");
    if (!s.resolved) return `${team}|BET:${s.bet}|${me}`;
    const seat = ORDER[s.v2.length]!;
    const pub = s.v2.map(([se, st]) => `${se}:${st}`).join(",");
    return `${team}|V2 a${seat} stk${s.stake} pub[${pub}]|${me}`;
  }

  actions(s: TT2State): string[] {
    if (!s.resolved) {
      if (s.bet === "") return ["truco", "check"];
      if (s.bet === "truco") return ["fold", "accept", "seis"];
      return ["fold", "accept"];
    }
    const seat = ORDER[s.v2.length]!;
    return [...new Set(s.hands[seat]!)].map((st) => String(st));
  }

  next(s: TT2State, action: string): TT2State {
    if (!s.resolved) {
      if (s.bet === "") {
        if (action === "check")
          return { ...s, resolved: true, stake: 1, bet: "checked" };
        return { ...s, bet: "truco" };
      }
      if (s.bet === "truco") {
        if (action === "fold") return { ...s, term: 1 }; // B corre -> A leva 1
        if (action === "accept")
          return { ...s, resolved: true, stake: 3, bet: "truco:accept" };
        return { ...s, bet: "truco:seis" };
      }
      // bet === "truco:seis"
      if (action === "fold") return { ...s, term: -3 }; // A corre -> B leva 3
      return { ...s, resolved: true, stake: 6, bet: "truco:seis:accept" };
    }
    // Fase de jogar carta na vaza 2.
    const seat = ORDER[s.v2.length]!;
    const strength = Number(action);
    const hand = s.hands[seat]!.slice();
    hand.splice(hand.indexOf(strength), 1);
    const hands = s.hands.map((h, i) => (i === seat ? hand : h));
    return { ...s, hands, v2: [...s.v2, [seat, strength]] };
  }
}
