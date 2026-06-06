/**
 * Registro de "personalidades" de bot, para escolher no CLI e no HTML.
 *
 * Browser-safe: importa o genoma treinado estaticamente (sem fs), entao funciona
 * tanto no Node quanto empacotado pelo esbuild.
 */

import melhorada1Json from "../genomes/melhorada_1.json";
import melhorada2Json from "../genomes/melhorada_2.json";
import { Rng } from "../core/deck.js";
import { BotPlayer } from "./bot.js";
import { EvolvedBotPlayer } from "./evolvedBot.js";
import { DecisionInfo } from "./explain.js";
import { parseGenome } from "./genome.js";
import { Player } from "./player.js";

export type PersonalityId = "inocente" | "melhorada_1" | "melhorada_2";

export interface Personality {
  id: PersonalityId;
  label: string;
  description: string;
  /** Cria o jogador. `onDecision` (opcional) ativa o modo "explicar jogada". */
  create(name: string, rng?: Rng, onDecision?: (info: DecisionInfo) => void): Player;
}

const melhorada1Genome = parseGenome(melhorada1Json);
const melhorada2Genome = parseGenome(melhorada2Json);

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
];

/** Busca uma personalidade pelo id (cai no inocente se nao encontrar). */
export function getPersonality(id: string): Personality {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0]!;
}
