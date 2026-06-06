/**
 * Gera o ícone do app (fundo verde de mesa + naipe de paus branco), em PNG, e o
 * injeta como data-URI nos <link rel="apple-touch-icon"/"icon"> de web/index.html
 * (entre os marcadores <!--ICONS_START--> e <!--ICONS_END-->). Assim o jogo pode
 * ser salvo na tela inicial do iOS/Android com um ícone próprio, e o index.html
 * gerado pelo build continua autossuficiente (sem arquivos externos).
 *
 * Uso: node scripts/make-icon.mjs   (chamado também pelo build:web)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- CRC32 (tabela) ---
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  const W = size, H = size, cx = W / 2;
  // desenha o naipe de paus: 3 círculos + caule
  const inCircle = (x, y, ox, oy, r) => (x - ox) ** 2 + (y - oy) ** 2 <= r * r;
  const r = size * 0.145;
  const club = (x, y) => {
    if (inCircle(x, y, cx, size * 0.33, r)) return true;
    if (inCircle(x, y, cx - r * 0.92, size * 0.52, r)) return true;
    if (inCircle(x, y, cx + r * 0.92, size * 0.52, r)) return true;
    const y0 = size * 0.5, y1 = size * 0.84;
    if (y >= y0 && y <= y1) { const t = (y - y0) / (y1 - y0); const hw = size * 0.04 + t * size * 0.12; if (Math.abs(x - cx) <= hw) return true; }
    return false;
  };
  // linha de varredura: 1 byte de filtro (0) + W*4 RGBA
  const raw = Buffer.alloc(H * (1 + W * 4));
  const maxd = Math.sqrt(2) * (size / 2);
  for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 4); raw[rowStart] = 0;
    for (let x = 0; x < W; x++) {
      const o = rowStart + 1 + x * 4;
      let R, G, B;
      if (club(x, y)) { R = 247; G = 242; B = 232; } // paus branco-creme
      else {
        const d = Math.hypot(x - W / 2, y - H / 2) / maxd; // 0 centro -> 1 borda
        const m = 1 - d;
        R = Math.round(15 + m * 14); G = Math.round(70 + m * 55); B = Math.round(45 + m * 32); // verde mesa, centro mais claro
      }
      raw[o] = R; raw[o + 1] = G; raw[o + 2] = B; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  return png;
}

const b64 = makePng(180).toString("base64");
const dataUri = "data:image/png;base64," + b64;
const links =
  `<!--ICONS_START--><link rel="apple-touch-icon" href="${dataUri}" />` +
  `<link rel="icon" type="image/png" href="${dataUri}" /><!--ICONS_END-->`;

const file = resolve(root, "web/index.html");
let html = readFileSync(file, "utf8");
const re = /<!--ICONS_START-->[\s\S]*?<!--ICONS_END-->/;
if (!re.test(html)) throw new Error("Marcadores <!--ICONS_START/END--> não encontrados em web/index.html");
html = html.replace(re, links);

// Versão (do package.json) + data do build, na margem inferior.
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const date = new Date().toISOString().slice(0, 10);
const verText = "Truco v" + (pkg.version || "0") + " · " + date;
const vre = /<!--VERSION_START-->[\s\S]*?<!--VERSION_END-->/;
if (vre.test(html)) html = html.replace(vre, "<!--VERSION_START-->" + verText + "<!--VERSION_END-->");

writeFileSync(file, html);
console.log("Ícone (PNG 180, " + b64.length + " b64) e versão (" + verText + ") injetados em web/index.html.");
