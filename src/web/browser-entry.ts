/**
 * Entrada para o navegador: roda uma simulacao de partida entre BOTS usando o
 * mesmo motor (core) e devolve o "transcript" como uma lista de linhas de texto
 * (estilo terminal). Nao usa nenhuma API do Node — pode ser empacotado para o
 * browser com esbuild.
 *
 * Empacotamento (npm run build:web) expoe o objeto global `Truco`, com:
 *   Truco.simulate(options) -> Promise<string[]>
 */

import { MatchObserver, playMatch } from "../core/match.js";
import { TRUCO_PAULISTA } from "../core/rules.js";
import { getPersonality } from "../players/personalities.js";
import { Player } from "../players/player.js";
import { fmtCard, teamName } from "../cli/render.js";
import { Card } from "../core/types.js";

/** RNG deterministico (LCG) para simulacoes reproduziveis por semente. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export interface SimulateOptions {
  /** Nomes dos 4 jogadores (assentos 0..3). */
  names?: string[];
  /** Semente para reproduzir a mesma partida. Omitido = aleatorio. */
  seed?: number;
  /** Placar inicial por equipe (ex.: [9,9] para chegar logo na mao de onze). */
  initialScores?: number[];
  /** Personalidade do bot da Equipe 1 (assentos pares). Default melhorada_1. */
  teamABot?: string;
  /** Personalidade do bot da Equipe 2 (assentos impares). Default inocente. */
  teamBBot?: string;
}

/**
 * Roda uma partida completa entre bots e retorna o transcript (uma string por
 * linha), pronto para ser exibido num "terminal" HTML.
 */
export async function simulate(options: SimulateOptions = {}): Promise<string[]> {
  const names =
    options.names ?? ["Bot A1", "Bot B1", "Bot A2", "Bot B2"];
  const out: string[] = [];
  const line = (s = "") => out.push(s);

  const fmtHand = (h: readonly Card[]) => h.map(fmtCard).join("  ");
  let playSeq = 0;

  // Assentos pares = Equipe 1 (teamABot); impares = Equipe 2 (teamBBot).
  const persA = getPersonality(options.teamABot ?? "melhorada_1");
  const persB = getPersonality(options.teamBBot ?? "inocente");

  const observer: MatchObserver = {
    onMatchStart({ teamOfSeat }) {
      line("════════════════════════════════════════════════════════");
      line("            SIMULADOR DE TRUCO — bots vs bots");
      line("════════════════════════════════════════════════════════");
      names.forEach((n, seat) =>
        line(`   assento ${seat}: ${n}  →  ${teamName(teamOfSeat[seat]!)}`),
      );
      line(`Inteligencia → ${teamName(0)}: ${persA.label}   ×   ${teamName(1)}: ${persB.label}`);
      line(`Variante: ${TRUCO_PAULISTA.name} — ate ${TRUCO_PAULISTA.pointsToWin} pontos.`);
    },
    onHandStart({ handNumber, firstSeat }) {
      playSeq = 0;
      line("");
      line("──────────────────────────────────────────────────────");
      line(`MAO ${handNumber}  —  comeca ${names[firstSeat]}`);
    },
    onDeal({ vira, manilha, hands }) {
      line(`Vira: ${fmtCard(vira)}  →  manilha desta mao: ${manilha}`);
      hands.forEach((h, seat) =>
        line(`   ${names[seat]!.padEnd(8)} ${fmtHand(h)}`),
      );
    },
    onMaoDeOnze({ mode, teamAt11, value }) {
      if (mode === "single") {
        line(`*** MAO DE ONZE: ${teamName(teamAt11!)} esta com 11 — sem truco, vale ${value}. A dupla decide jogar ou correr. ***`);
      } else {
        line(`*** MAO DE ONZE 11x11: jogada FECHADA (as cegas), vale ${value}, sem truco. ***`);
      }
    },
    onMaoDeOnzeDecision({ team, decision }) {
      line(`   >>> ${teamName(team)} decidiu: ${decision === "play" ? "JOGAR" : "CORRER"}.`);
    },
    onPlay({ seat, card }) {
      playSeq++;
      line(`   (${playSeq}o) ${names[seat]!.padEnd(8)} joga ${fmtCard(card)}`);
    },
    onRaiseProposed(p) {
      line(`   >>> ${names[p.proposer]} PEDE ${p.name.toUpperCase()} (vale ${p.value}; se correrem, leva ${p.forfeitValue})`);
    },
    onRaiseResponse({ responder, response }) {
      const label =
        response === "accept" ? "ACEITA" : response === "run" ? "CORRE" : "AUMENTA";
      line(`   <<< ${names[responder]} ${label}`);
    },
    onVazaResolved({ vazaIndex, result }) {
      const who =
        result.winningTeam === null ? "EMPATE" : teamName(result.winningTeam);
      line(`   = Vaza ${vazaIndex + 1}: ${who}`);
      playSeq = 0;
    },
    onScoreUpdate({ result, scores }) {
      const motivo =
        result.reason === "fold"
          ? "adversario correu (mao de onze)"
          : result.reason === "run"
            ? "adversario correu o truco"
            : result.reason === "cancelled"
              ? "mao anulada"
              : "venceu as vazas";
      const ganho =
        result.winningTeam === null
          ? "ninguem pontua"
          : `${teamName(result.winningTeam)} +${result.points}`;
      line(`>> ${ganho} (${motivo}).`);
      line(`   PLACAR: ${scores.map((s, t) => `${teamName(t)} ${s}`).join("   |   ")}`);
    },
    onMatchEnd({ winningTeam, scores }) {
      line("");
      line("████████████████████████████████████████████████████████");
      line(`  ${teamName(winningTeam)} VENCEU A PARTIDA  (${scores
        .map((s, t) => `${teamName(t)} ${s}`)
        .join("  |  ")})`);
      line("████████████████████████████████████████████████████████");
    },
  };

  const players: Player[] = names.map((n, seat) => {
    const pers = seat % 2 === 0 ? persA : persB;
    const rng =
      options.seed === undefined ? undefined : seededRng(options.seed * 100 + seat + 1);
    return pers.create(n, rng);
  });

  await playMatch({
    rules: TRUCO_PAULISTA,
    players,
    observer,
    rng: options.seed === undefined ? undefined : seededRng(options.seed),
    initialScores: options.initialScores,
  });

  return out;
}
