/**
 * Empacota o motor para o navegador e gera DOIS artefatos:
 *  1) web/truco.bundle.js  — bundle separado (para servir via http / GitHub Pages)
 *  2) index.html (na raiz)  — HTML AUTOSSUFICIENTE com o JS embutido, que funciona
 *     com duplo clique (file://) sem depender de nenhum outro arquivo.
 *
 * Uso: npm run build:web
 */

import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 1) Bundle (IIFE) expondo o global `Truco`.
const result = await esbuild.build({
  entryPoints: [resolve(root, "src/web/browser-entry.ts")],
  bundle: true,
  format: "iife",
  globalName: "Truco",
  write: false,
});
const bundleText = result.outputFiles[0].text;
writeFileSync(resolve(root, "web/truco.bundle.js"), bundleText);

// 2) HTML autossuficiente: substitui o <script src> pelo JS inline.
const template = readFileSync(resolve(root, "web/index.html"), "utf8");
const marker = '<script src="truco.bundle.js"></script>';
if (!template.includes(marker)) {
  throw new Error(`Marcador do bundle nao encontrado em web/index.html: ${marker}`);
}
const selfContained = template.replace(
  marker,
  `<script>\n${bundleText}\n</script>`,
);
writeFileSync(resolve(root, "index.html"), selfContained);

console.log("OK:");
console.log("  - web/truco.bundle.js (bundle separado)");
console.log("  - index.html (AUTOSSUFICIENTE, abrir com duplo clique)");
