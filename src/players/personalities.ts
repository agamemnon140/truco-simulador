/**
 * Registro de "personalidades" de bot, para escolher no CLI e no HTML.
 *
 * Browser-safe: importa o genoma treinado estaticamente (sem fs), entao funciona
 * tanto no Node quanto empacotado pelo esbuild.
 */

import melhorada1Json from "../genomes/melhorada_1.json";
import melhorada2Json from "../genomes/melhorada_2.json";
import melhorada3Json from "../genomes/melhorada_3.json";
import melhorada4Json from "../genomes/melhorada_4.json";
import melhorada5Json from "../genomes/melhorada_5.json";
import melhorada6Json from "../genomes/melhorada_6.json";
import melhorada7Json from "../genomes/melhorada_7.json";
import { Rng } from "../core/deck.js";
import { TRUCO_PAULISTA } from "../core/rules.js";
import { BotPlayer } from "./bot.js";
import { EvolvedBotPlayer } from "./evolvedBot.js";
import { DecisionInfo } from "./explain.js";
import { parseGenome } from "./genome.js";
import { OpponentModel } from "./opponentModel.js";
import { DEFAULT_MACO_STRENGTH, MacoPlayer, macoCheat } from "./macoPlayer.js";
import { Player } from "./player.js";

export type PersonalityId =
  | "inocente"
  | "melhorada_1"
  | "melhorada_2"
  | "melhorada_3"
  | "melhorada_4"
  | "melhorada_5"
  | "melhorada_6"
  | "melhorada_7"
  | "maco";

export interface Personality {
  id: PersonalityId;
  label: string;
  description: string;
  /** Cria o jogador. `onDecision` (opcional) ativa o modo "explicar jogada". */
  create(name: string, rng?: Rng, onDecision?: (info: DecisionInfo) => void): Player;
}

const melhorada1Genome = parseGenome(melhorada1Json);
const melhorada2Genome = parseGenome(melhorada2Json);
const melhorada3Genome = parseGenome(melhorada3Json);
const melhorada4Genome = parseGenome(melhorada4Json);
const melhorada5Genome = parseGenome(melhorada5Json);
const melhorada6Genome = parseGenome(melhorada6Json);
const melhorada7Genome = parseGenome(melhorada7Json);

export const PERSONALITIES: Personality[] = [
  {
    id: "inocente",
    label: "Inocente",
    description: "Heuristica simples (baseline).",
    create: (name) => new BotPlayer(name),
  },
  {
    id: "melhorada_1",
    label: "Melhorada 1",
    description: "Evoluida vs inocente. Forte no geral (~79% vs inocente).",
    create: (name, rng, onDecision) =>
      new EvolvedBotPlayer(name, melhorada1Genome, rng, onDecision),
  },
  {
    id: "melhorada_2",
    label: "Melhorada 2",
    description: "Evoluida vs inocente+melhorada_1. Bate a melhorada_1 (~80%), mas fraca vs inocente.",
    create: (name, rng, onDecision) =>
      new EvolvedBotPlayer(name, melhorada2Genome, rng, onDecision),
  },
  {
    id: "melhorada_3",
    label: "Melhorada 3",
    description: "Round-robin (pior caso) vs o pool. Ganha de inocente/m1/m2 (pior matchup ~68%).",
    create: (name, rng, onDecision) =>
      new EvolvedBotPlayer(name, melhorada3Genome, rng, onDecision),
  },
  {
    id: "melhorada_4",
    label: "Melhorada 4",
    description: "Nao-linear (features em faixas) round-robin. Bate a m3 (~63%).",
    create: (name, rng, onDecision) =>
      new EvolvedBotPlayer(name, melhorada4Genome, rng, onDecision),
  },
  {
    id: "melhorada_5",
    label: "Melhorada 5",
    description: "Fitness ponderado (ultima domina) + piso 50%. Ganha de TODAS, inclusive m4 (~52%).",
    create: (name, rng, onDecision) =>
      new EvolvedBotPlayer(name, melhorada5Genome, rng, onDecision),
  },
  {
    id: "melhorada_6",
    label: "Melhorada 6",
    description: "Comunicacao minima (sinais do parceiro quando incerta) + intuicoes GTO de blefe.",
    create: (name, rng, onDecision) =>
      new EvolvedBotPlayer(name, melhorada6Genome, rng, onDecision),
  },
  {
    id: "melhorada_7",
    label: "Melhorada 7",
    description: "Modela os adversarios (quem truca/corre/blefa) e adapta para explora-los.",
    create: (name, rng, onDecision) =>
      new EvolvedBotPlayer(
        name,
        melhorada7Genome,
        rng,
        onDecision,
        false,
        new OpponentModel(TRUCO_PAULISTA),
      ),
  },
  {
    id: "maco",
    label: "Maço (trapaceiro)",
    description: "Joga como a m6, mas TRAPACEIA: dá 'maço' no baralho, 4 cartas ao parceiro e 'mela' mãos ruins.",
    create: (name, rng, onDecision) =>
      new MacoPlayer(
        name,
        melhorada6Genome,
        { cheat: macoCheat(DEFAULT_MACO_STRENGTH), rules: TRUCO_PAULISTA },
        rng,
        onDecision,
      ),
  },
];

/** Busca uma personalidade pelo id (cai no inocente se nao encontrar). */
export function getPersonality(id: string): Personality {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0]!;
}
