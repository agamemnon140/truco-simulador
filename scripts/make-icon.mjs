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

// Fonte bitmap 5x7 (só as letras de "TRUCO" + "A" do canto da carta).
const FONT = {
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
};
function makePng(size) {
  const W = size, H = size, s = size / 180;
  const px = new Float64Array(W * H * 3);
  const set = (x, y, r, g, b, a) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (a == null) a = 1; const o = (y * W + x) * 3, ib = 1 - a;
    px[o] = r * a + px[o] * ib; px[o + 1] = g * a + px[o + 1] * ib; px[o + 2] = b * a + px[o + 2] * ib;
  };
  const rect = (x0, y0, x1, y1, r, g, b, a) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, r, g, b, a); };
  const rrect = (x0, y0, x1, y1, rad, r, g, b, a) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const dx = Math.max(x0 + rad - x, x - (x1 - 1 - rad), 0);
      const dy = Math.max(y0 + rad - y, y - (y1 - 1 - rad), 0);
      if (dx * dx + dy * dy <= rad * rad) set(x, y, r, g, b, a);
    }
  };
  const disc = (cx, cy, rad, r, g, b, a) => { for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) set(x, y, r, g, b, a); };
  const text = (str, x, y, sc, col) => {
    let cx = x;
    for (const ch of str) {
      const g = FONT[ch];
      if (g) for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === "1") for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) set(cx + c * sc + xx, y + r * sc + yy, col[0], col[1], col[2], 1);
      cx += 5 * sc + 1.4 * sc;
    }
  };

  // fundo: feltro verde com leve vinheta
  const maxd = Math.SQRT2 * (W / 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const m = 1 - Math.hypot(x - W / 2, y - H / 2) / maxd; set(x, y, 15 + m * 16, 70 + m * 60, 45 + m * 34, 1); }

  // carta branca com coração vermelho + "A"
  rrect(20 * s, 24 * s, 104 * s, 126 * s, 12 * s, 28, 24, 20, 1);     // borda escura
  rrect(22 * s, 26 * s, 102 * s, 124 * s, 11 * s, 247, 244, 238, 1);  // carta
  const RED = [198, 40, 50];
  const hcx = 62 * s, hcy = 80 * s, hr = 19 * s;
  disc(hcx - hr * 0.52, hcy - hr * 0.45, hr * 0.6, RED[0], RED[1], RED[2], 1);
  disc(hcx + hr * 0.52, hcy - hr * 0.45, hr * 0.6, RED[0], RED[1], RED[2], 1);
  for (let y = 0; y <= hr * 1.3; y++) { const t = y / (hr * 1.3), half = hr * 1.02 * (1 - t); for (let x = -half; x <= half; x++) set(hcx + x, hcy - hr * 0.15 + y, RED[0], RED[1], RED[2], 1); }
  text("A", 28 * s, 32 * s, 2.0 * s, RED);

  // caneca de chope (direita), sobrepondo a carta
  rrect(99 * s, 54 * s, 151 * s, 125 * s, 8 * s, 250, 248, 240, 1);   // vidro
  rect(104 * s, 74 * s, 146 * s, 119 * s, 242, 172, 28, 1);           // cerveja
  rect(104 * s, 110 * s, 146 * s, 119 * s, 214, 140, 18, 1);          // base
  disc(113 * s, 60 * s, 11 * s, 255, 252, 246, 1);                    // espuma
  disc(126 * s, 56 * s, 12 * s, 255, 253, 249, 1);
  disc(139 * s, 61 * s, 10 * s, 255, 252, 246, 1);
  for (let y = -16 * s; y <= 16 * s; y++) for (let x = 0; x <= 22 * s; x++) { const rr = Math.hypot(x, y); if (rr >= 11 * s && rr <= 17 * s) set(149 * s + x, 90 * s + y, 245, 243, 235, 1); } // alça
  disc(116 * s, 96 * s, 2.2 * s, 255, 255, 255, 0.55); disc(132 * s, 104 * s, 2 * s, 255, 255, 255, 0.5); // bolhas

  // faixa + "TRUCO"
  rrect(6 * s, 131 * s, 174 * s, 172 * s, 10 * s, 18, 14, 9, 0.92);
  const sc = 4.4 * s, tw = 5 * (5 * sc) + 4 * (1.4 * sc);
  text("TRUCO", (W - tw) / 2, 138 * s, sc, [255, 211, 74]);

  // empacota PNG (scanlines com filtro 0)
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    const rs = y * (1 + W * 4); raw[rs] = 0;
    for (let x = 0; x < W; x++) { const o = rs + 1 + x * 4, p = (y * W + x) * 3; raw[o] = px[p]; raw[o + 1] = px[p + 1]; raw[o + 2] = px[p + 2]; raw[o + 3] = 255; }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
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
