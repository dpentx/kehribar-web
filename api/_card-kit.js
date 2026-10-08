// api/_card-kit.js
//
// lastfm.js ve card.js'in ortak One UI kart motoru. "_" ile başlayan dosyalar
// Vercel'de ayrı bir endpoint olmaz, sadece içe aktarılır.
//
// Mantık:
//  1) Albüm kapağından (varsa) bir renk tonu çıkar,
//  2) o tondan açık ve koyu tema için bir ton paleti türet (yüzey, yazı, vurgu),
//  3) 380x80 SVG kartı çiz. Tema "auto" ise SVG kendi içinde
//     prefers-color-scheme'e göre açık/koyu arasında geçer.

import { Vibrant } from "node-vibrant/node";

export const CARD_W = 380;
export const CARD_H = 80;

// ---------- renk yardımcıları ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const toHex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

function luminance([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// fg'nin parlaklığını (aynı ton/doygunlukla) bg'ye karşı en az `min` kontrasta ulaşana dek kaydır.
function ensureContrast(h, s, l, bg, min, direction) {
  let rgb = hslToRgb(h, s, l);
  let guard = 0;
  while (contrast(rgb, bg) < min && guard++ < 60) {
    l = clamp(l + (direction === "darker" ? -0.01 : 0.01), 0, 1);
    rgb = hslToRgb(h, s, l);
  }
  return rgb;
}

// ---------- palet ----------
const DEFAULT_HUE = 215; // One UI mavisi
const DEFAULT_SAT = 0.7;

export async function swatchFromImage(buf) {
  if (!buf) return null;
  try {
    const palette = await Vibrant.from(buf).getPalette();
    const order = ["Vibrant", "Muted", "DarkVibrant", "LightVibrant", "DarkMuted", "LightMuted"];
    const swatches = order.map((k) => palette[k]).filter(Boolean);
    if (swatches.length === 0) return null;
    // Önce canlı bir renk, yoksa en kalabalık olan.
    const vivid = palette.Vibrant || palette.Muted;
    const pick = vivid || swatches.sort((a, b) => b.population - a.population)[0];
    return pick.rgb.map(Math.round);
  } catch (_) {
    return null;
  }
}

export function buildPalettes(swatchRgb) {
  let h = DEFAULT_HUE, s = DEFAULT_SAT;
  if (swatchRgb) {
    const [sh, ss] = rgbToHsl(swatchRgb);
    h = sh;
    s = clamp(ss, 0.25, 0.85);
    // Neredeyse gri kapaklarda ton anlamsız: nötr mavi-gri'ye yaklaş.
    if (ss < 0.08) { h = DEFAULT_HUE; s = 0.25; }
  }

  // --- açık ---
  const lBg = hslToRgb(h, clamp(s * 0.55, 0.18, 0.5), 0.93);
  const light = { bg: lBg };
  light.ink = hslToRgb(h, 0.25, 0.11);
  light.sub = ensureContrast(h, 0.12, 0.4, lBg, 4.6, "darker");
  light.acc = ensureContrast(h, clamp(s, 0.45, 0.8), 0.46, lBg, 3.2, "darker");
  light.accText = ensureContrast(h, clamp(s, 0.45, 0.85), 0.4, lBg, 4.6, "darker");
  light.onAcc = [255, 255, 255];
  if (contrast(light.onAcc, light.acc) < 3.2) light.acc = ensureContrast(h, clamp(s, 0.45, 0.8), 0.4, [255, 255, 255], 3.2, "darker");
  light.tint = hslToRgb(h, clamp(s, 0.4, 0.8), 0.86);
  light.hair = hslToRgb(h, 0.2, 0.15);

  // --- koyu ---
  const dBg = hslToRgb(h, clamp(s * 0.5, 0.14, 0.42), 0.11);
  const dark = { bg: dBg };
  dark.ink = hslToRgb(h, 0.2, 0.94);
  dark.sub = ensureContrast(h, 0.1, 0.7, dBg, 4.6, "lighter");
  dark.acc = ensureContrast(h, clamp(s, 0.5, 0.9), 0.68, dBg, 3.2, "lighter");
  dark.accText = ensureContrast(h, clamp(s, 0.5, 0.95), 0.72, dBg, 4.6, "lighter");
  dark.onAcc = hslToRgb(h, 0.45, 0.1);
  if (contrast(dark.onAcc, dark.acc) < 3.2) dark.onAcc = [0, 0, 0];
  dark.tint = hslToRgb(h, clamp(s, 0.35, 0.8), 0.22);
  dark.hair = [255, 255, 255];

  return { light, dark };
}

// ---------- metin yardımcıları ----------
export function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Yaklaşık genişlik (em): geniş karakterler (CJK, tam genişlik) 1em, dar harfler daha az.
function charEm(ch) {
  const c = ch.codePointAt(0);
  if ((c >= 0x1100 && c <= 0x11ff) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef) || c >= 0x1f000) return 1;
  if ("iljtfI.,:;|!'` ".includes(ch)) return 0.3;
  if ("mwMW@%".includes(ch)) return 0.85;
  if (ch >= "A" && ch <= "Z") return 0.66;
  return 0.56;
}

export function truncate(text, maxPx, fontSize) {
  const chars = Array.from(String(text));
  let w = 0, out = "";
  for (let i = 0; i < chars.length; i++) {
    const cw = charEm(chars[i]) * fontSize;
    if (w + cw > maxPx) {
      // "…" için yer aç
      while (out && w + 0.9 * fontSize > maxPx) {
        const last = Array.from(out).pop();
        out = out.slice(0, out.length - last.length);
        w -= charEm(last) * fontSize;
      }
      return out + "…";
    }
    w += cw;
    out += chars[i];
  }
  return out;
}

// ---------- görsel indirme ----------
export async function fetchImage(url) {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!mime.startsWith("image/") || buf.length === 0) return null;
    return { buf, mime };
  } catch (_) {
    return null;
  }
}

// ---------- SVG ----------
const FONT = "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function palCss(p) {
  const h = toHex;
  return {
    bg: h(p.bg), ink: h(p.ink), sub: h(p.sub), acc: h(p.acc), accText: h(p.accText),
    onAcc: h(p.onAcc), tint: h(p.tint), hair: h(p.hair),
  };
}

function styleBlock(palettes, mode) {
  const names = ["bg", "ink", "sub", "acc", "accText", "onAcc", "tint", "hair"];
  const classRules = (get) => `
    .bg{fill:${get("bg")}} .ink{fill:${get("ink")}} .sub{fill:${get("sub")}}
    .acc{fill:${get("acc")}} .accText{fill:${get("accText")}} .onAcc{fill:${get("onAcc")}}
    .tint{fill:${get("tint")}} .hair{stroke:${get("hair")}}
    .accStroke{stroke:${get("accText")}} .onAccStroke{stroke:${get("onAcc")}}
    .accBarIdle{fill:${get("accText")}}`;
  if (mode === "light" || mode === "dark") {
    const c = palCss(palettes[mode]);
    return classRules((n) => c[n]);
  }
  const L = palCss(palettes.light), D = palCss(palettes.dark);
  const vars = (c) => names.map((n) => `--${n}:${c[n]}`).join(";");
  return `
    :root{${vars(L)}}
    @media (prefers-color-scheme: dark){:root{${vars(D)}}}
    ${classRules((n) => `var(--${n})`)}`;
}

function equalizer(cx, cy, cls, playing) {
  const w = 3.6, gap = 3.2, n = 4;
  const total = n * w + (n - 1) * gap;
  const x0 = cx - total / 2;
  if (!playing) {
    const hs = [8, 13, 6, 10];
    return hs.map((hgt, i) =>
      `<rect class="${cls}" x="${(x0 + i * (w + gap)).toFixed(1)}" y="${(cy - hgt / 2).toFixed(1)}" width="${w}" height="${hgt}" rx="1.8"/>`
    ).join("");
  }
  const heights = ["5;17;8;15;5", "8;5;17;9;8", "6;15;5;17;6", "10;6;16;5;10"];
  const durs = [0.82, 0.95, 0.74, 1.05];
  return heights.map((vals, i) => {
    const hs = vals.split(";").map(Number);
    const ys = hs.map((hv) => (cy - hv / 2).toFixed(1)).join(";");
    return `<rect class="${cls}" x="${(x0 + i * (w + gap)).toFixed(1)}" y="${(cy - hs[0] / 2).toFixed(1)}" width="${w}" height="${hs[0]}" rx="1.8">
      <animate attributeName="height" values="${vals}" dur="${durs[i]}s" repeatCount="indefinite"/>
      <animate attributeName="y" values="${ys}" dur="${durs[i]}s" repeatCount="indefinite"/>
    </rect>`;
  }).join("");
}

/**
 * @param {object} o
 * @param {string} o.label        küçük üst satır (durum)
 * @param {string} o.title
 * @param {string} o.artist
 * @param {{buf:Buffer,mime:string}|null} o.art
 * @param {object} o.palettes     buildPalettes() çıktısı
 * @param {"auto"|"light"|"dark"} o.mode
 * @param {"playing"|"idle"|"play"} o.button
 */
export function renderCard({ label, title, artist, art, palettes, mode, button }) {
  const BTN_CX = 346, BTN_CY = 40, BTN_R = 20;
  const textMax = BTN_CX - BTN_R - 12 - 80;
  const t = escapeXml(truncate(title, textMax, 15));
  const a = escapeXml(truncate(artist, textMax, 12));
  const l = escapeXml(truncate(label, textMax, 10.5));

  const artEl = art
    ? `<image href="data:${art.mime};base64,${art.buf.toString("base64")}" x="12" y="12" width="56" height="56" clip-path="url(#art-clip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect class="tint" x="12" y="12" width="56" height="56" rx="14"/>
       <g transform="translate(25.2 25.2) scale(1.4)" fill="none" class="accStroke" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
         <path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>
       </g>`;

  let btn;
  if (button === "playing") {
    btn = `<circle class="acc" cx="${BTN_CX}" cy="${BTN_CY}" r="${BTN_R}"/>${equalizer(BTN_CX, BTN_CY, "onAcc", true)}`;
  } else if (button === "idle") {
    btn = `<circle class="tint" cx="${BTN_CX}" cy="${BTN_CY}" r="${BTN_R}"/>${equalizer(BTN_CX, BTN_CY, "accBarIdle", false)}`;
  } else {
    // Üçgen: dairenin merkezine göre optik olarak biraz sağa kaydırılmış, köşeleri yuvarlak.
    btn = `<circle class="acc" cx="${BTN_CX}" cy="${BTN_CY}" r="${BTN_R}"/>
      <polygon class="onAcc onAccStroke" points="${BTN_CX - 3.5},${BTN_CY - 6} ${BTN_CX - 3.5},${BTN_CY + 6} ${BTN_CX + 6.5},${BTN_CY}" stroke-width="3" stroke-linejoin="round"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" role="img" aria-label="${escapeXml(title)} — ${escapeXml(artist)}">
  <title>${escapeXml(title)} — ${escapeXml(artist)}</title>
  <style>${styleBlock(palettes, mode)}
    text{font-family:${FONT}}
  </style>
  <defs>
    <clipPath id="art-clip"><rect x="12" y="12" width="56" height="56" rx="14"/></clipPath>
  </defs>
  <rect class="bg hair" x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}" rx="24" stroke-opacity="0.1" stroke-width="1"/>
  ${artEl}
  <text class="accText" x="80" y="27" font-size="10.5" font-weight="600">${l}</text>
  <text class="ink" x="80" y="45" font-size="15" font-weight="700">${t}</text>
  <text class="sub" x="80" y="62" font-size="12" font-weight="500">${a}</text>
  ${btn}
</svg>`;
}

export function readParams(req) {
  const q = req.query || {};
  const lang = String(q.lang || "tr").toLowerCase() === "en" ? "en" : "tr";
  const m = String(q.theme || "auto").toLowerCase();
  const mode = m === "light" || m === "dark" ? m : "auto";
  return { lang, mode };
}
