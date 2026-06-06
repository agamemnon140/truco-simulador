/**
 * Modelo dos ADVERSARIOS construido online a partir dos eventos da partida
 * (`Player.observe`). Acumula tendencias do time adversario e expoe um vetor de
 * features normalizadas [0,1] que o genoma (m7) usa para EXPLORAR o oponente.
 *
 * Sem dados -> priors NEUTROS (0.5), para nao perturbar quem nao usa o modelo.
 * Memoria por PARTIDA (a instancia vive enquanto a partida dura).
 *
 *   oppFold  : com que frequencia o oponente CORRE quando NOS trucamos (alto -> blefar mais)
 *   oppTruco : com que frequencia o oponente INICIA truco (alto -> postura defensiva)
 *   oppBluff : com que frequencia ele truca e mostra cartas fracas (alto -> pagar mais)
 *   oppAggr  : forca media das cartas que ele joga (alto -> mao forte)
 */

import { cardStrength } from "../core/ranking.js";
import { RuleSet } from "../core/rules.js";
import { Card, Seat, TeamId } from "../core/types.js";
import { GameEvent } from "./player.js";

// Os nomes/contagem das features vivem em features.ts (OPP_FEATURE_NAMES) — a
// ordem de `features()` abaixo deve casar com elas: [oppFold, oppTruco, oppBluff, oppAggr].

export class OpponentModel {
  private myTeam = -1;
  private teamOfSeat: readonly TeamId[] = [];
  private vira: Card | null = null;

  // Respostas do oponente aos NOSSOS trucos (foldToTruco).
  private ourAnswered = 0;
  private oppRuns = 0;
  // Iniciativa de truco do oponente.
  private hands = 0;
  private oppProposals = 0;
  // Blefe: maos em que o oponente trucou e a melhor carta dele foi fraca.
  private oppProposalHands = 0;
  private oppBluffHands = 0;
  // Agressao: forca media (normalizada) das cartas jogadas pelo oponente.
  private playSum = 0;
  private playCount = 0;

  // Estado temporario da mao corrente.
  private handOppProposed = false;
  private handOppMaxStrNorm = -1;

  constructor(private readonly rules: RuleSet) {}

  private isOpp(team: TeamId): boolean {
    return this.myTeam >= 0 && team !== this.myTeam;
  }

  observe(ev: GameEvent, selfSeat: Seat): void {
    switch (ev.type) {
      case "handStart": {
        this.teamOfSeat = ev.teamOfSeat;
        this.myTeam = ev.teamOfSeat[selfSeat]!;
        this.vira = ev.vira;
        this.hands++;
        this.handOppProposed = false;
        this.handOppMaxStrNorm = -1;
        break;
      }
      case "play": {
        if (this.isOpp(ev.team) && this.vira) {
          const max = this.rules.rankOrder.length + this.rules.manilhaSuitOrder.length - 1;
          const norm = cardStrength(ev.card, this.vira, this.rules) / max;
          this.playSum += norm;
          this.playCount++;
          if (norm > this.handOppMaxStrNorm) this.handOppMaxStrNorm = norm;
        }
        break;
      }
      case "raiseProposed": {
        if (this.isOpp(ev.team)) {
          this.oppProposals++;
          this.handOppProposed = true;
        }
        break;
      }
      case "raiseResponse": {
        // Oponente respondendo a um truco NOSSO.
        if (this.isOpp(ev.team) && ev.proposingTeam === this.myTeam) {
          this.ourAnswered++;
          if (ev.response === "run") this.oppRuns++;
        }
        break;
      }
      case "handEnd": {
        if (this.handOppProposed) {
          this.oppProposalHands++;
          // Melhor carta vista do oponente foi fraca -> conta como blefe.
          if (this.handOppMaxStrNorm >= 0 && this.handOppMaxStrNorm < 0.5) this.oppBluffHands++;
        }
        break;
      }
    }
  }

  /** Features [0,1] com suavizacao Beta(1,1) -> 0.5 sem dados. */
  features(): number[] {
    const beta = (a: number, n: number) => (a + 1) / (n + 2);
    const oppFold = beta(this.oppRuns, this.ourAnswered);
    const oppTruco = beta(this.oppProposals, this.hands);
    const oppBluff = beta(this.oppBluffHands, this.oppProposalHands);
    const oppAggr = this.playCount > 0 ? (this.playSum + 0.5) / (this.playCount + 1) : 0.5;
    return [oppFold, oppTruco, oppBluff, oppAggr];
  }
}
