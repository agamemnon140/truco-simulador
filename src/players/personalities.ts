/**
 * Registro de "personalidades" de bot, para escolher no CLI e no HTML.
 *
 * Browser-safe: importa o genoma treinado estaticamente (sem fs), entao funciona
 * tanto no Node quanto empacotado pelo esbuild.
 */

import melhorada1Json from "../genomes/melhorada_1.json";
import { Rng } from "../core/deck.js";
import { BotPlayer } from "./bot.js";
import { EvolvedBotPlayer } from "./evolvedBot.js";
import { parseGenome } from "./genome.js";
import { Player } from "./player.js";

export type PersonalityId = "inocente" | "melhorada_1";

export interface Personality {
  id: PersonalityId;
  label: string;
  description: string;
  create(name: string, rng?: Rng): Player;
}

const melhorada1Genome = parseGenome(melhorada1Json);

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
    description: "Evoluida por algoritmo genetico (mais forte).",
    create: (name, rng) => new EvolvedBotPlayer(name, melhorada1Genome, rng),
  },
];

/** Busca uma personalidade pelo id (cai no inocente se nao encontrar). */
export function getPersonality(id: string): Personality {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0]!;
}
