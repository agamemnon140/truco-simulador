/**
 * Subjogo "ultima vaza 2v2" como jogo de TIME, modelado como 2-JOGADORES
 * soma-zero entre dois COORDENADORES (cada dupla joga uma estrategia conjunta,
 * sabendo as 2 cartas do time). Isso da o team-maxmin COM correlacao (TMECor) —
 * um TETO do que duplas reais (sem comunicacao) alcancam. O caso sem comunicacao
 * (TME) e NP-dificil e fica fora.
 *
 * Ultima vaza: 1 carta por assento -> jogada FORCADA; so ha decisao de APOSTA
 * (truco -> seis). Assentos 0,2 = Time A (jogador 0); 1,3 = Time B (jogador 1).
 * Showdown: a maior das 4 cartas leva o valor ao seu time (empate no topo entre
 * times -> 0). Estado guarda apenas as FORCAS (o que importa); o acaso e
 * enumerado por tuplas de forca com pesos combinatorios exatos.
 */

import { buildDeck } from "../../core/deck.js";
import { cardStrength } from "../../core/ranking.js";
import { TRUCO_PAULISTA } from "../../core/rules.js";
import { Card, cardsEqual } from "../../core/types.js";
import { Game } from "../game.js";

const RULES = TRUCO_PAULISTA;
const TEAM_OF_SEAT = [0, 1, 0, 1] as const;

export interface TLT2State {
  s: [number, number, number, number]; // forcas nos assentos 0..3
  h: string;
}

export class TrucoLastTrick2v2 implements Game<TLT2State> {
  private readonly strengths: number[];
  private readonly mult = new Map<number, number>();
  private readonly N: number;

  constructor(vira: Card) {
    const deck = buildDeck().filter((c) => !cardsEqual(c, vira));
    this.N = deck.length; // 39
    for (const c of deck) {
      const st = cardStrength(c, vira, RULES);
      this.mult.set(st, (this.mult.get(st) ?? 0) + 1);
    }
    this.strengths = [...this.mult.keys()].sort((a, b) => a - b);
  }

  chanceOutcomes() {
    const out: { prob: number; state: TLT2State }[] = [];
    const denom = this.N * (this.N - 1) * (this.N - 2) * (this.N - 3);
    const S = this.strengths;
    for (const a of S)
      for (const b of S)
        for (const c of S)
          for (const d of S) {
            const tuple = [a, b, c, d];
            const counts = new Map<number, number>();
            for (const x of tuple) counts.set(x, (counts.get(x) ?? 0) + 1);
            let ways = 1;
            let ok = true;
            for (const [str, k] of counts) {
              const m = this.mult.get(str)!;
              let f = 1;
              for (let t = 0; t < k; t++) {
                if (m - t <= 0) {
                  ok = false;
                  break;
                }
                f *= m - t;
              }
              if (!ok) break;
              ways *= f;
            }
            if (!ok || ways === 0) continue;
            out.push({ prob: ways / denom, state: { s: [a, b, c, d], h: "" } });
          }
    return out;
  }

  isTerminal(s: TLT2State): boolean {
    return (
      s.h === "check" ||
      s.h === "truco:fold" ||
      s.h === "truco:accept" ||
      s.h === "truco:seis:fold" ||
      s.h === "truco:seis:accept"
    );
  }

  private show(s: TLT2State, stake: number): number {
    let max = -Infinity;
    for (const v of s.s) if (v > max) max = v;
    const teams = new Set<number>();
    for (let i = 0; i < 4; i++) if (s.s[i] === max) teams.add(TEAM_OF_SEAT[i]!);
    if (teams.size > 1) return 0; // empate no topo entre os dois times
    return teams.has(0) ? stake : -stake;
  }

  payoff0(s: TLT2State): number {
    switch (s.h) {
      case "check":
        return this.show(s, 1);
      case "truco:fold":
        return 1; // Time B corre -> Time A leva 1
      case "truco:accept":
        return this.show(s, 3);
      case "truco:seis:fold":
        return -3; // Time A corre o seis -> Time B leva 3
      case "truco:seis:accept":
        return this.show(s, 6);
      default:
        throw new Error(`Estado nao terminal: ${s.h}`);
    }
  }

  currentPlayer(s: TLT2State): 0 | 1 {
    if (s.h === "") return 0; // Time A (lider) age primeiro
    if (s.h === "truco") return 1; // Time B responde
    if (s.h === "truco:seis") return 0; // Time A responde ao seis
    throw new Error(`Sem jogador em ${s.h}`);
  }

  infoSet(s: TLT2State): string {
    const team = this.currentPlayer(s);
    const x = team === 0 ? s.s[0] : s.s[1];
    const y = team === 0 ? s.s[2] : s.s[3];
    const lo = Math.min(x, y);
    const hi = Math.max(x, y);
    return `${team === 0 ? "A" : "B"}${lo},${hi}|${s.h}`;
  }

  actions(s: TLT2State): string[] {
    if (s.h === "") return ["truco", "check"];
    if (s.h === "truco") return ["fold", "accept", "seis"];
    if (s.h === "truco:seis") return ["fold", "accept"];
    throw new Error(`Sem acoes em ${s.h}`);
  }

  next(s: TLT2State, action: string): TLT2State {
    const h = s.h === "" ? action : `${s.h}:${action}`;
    return { ...s, h };
  }
}
