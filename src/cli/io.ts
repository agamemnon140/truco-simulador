/**
 * I/O de terminal compartilhado: uma unica interface readline para todo o app.
 */

import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

let rl: readline.Interface | null = null;

function getRl(): readline.Interface {
  if (!rl) rl = readline.createInterface({ input: stdin, output: stdout });
  return rl;
}

/** Faz uma pergunta e retorna a resposta (sem espacos nas pontas). */
export async function ask(question: string): Promise<string> {
  const answer = await getRl().question(question);
  return answer.trim();
}

/** Imprime uma linha (atalho sem depender de Write/console em outros modulos). */
export function print(line = ""): void {
  stdout.write(line + "\n");
}

/** Fecha a interface de terminal (chamar ao fim do programa). */
export function closeIo(): void {
  rl?.close();
  rl = null;
}
