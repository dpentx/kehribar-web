// /api/lastfm.js
//
// Vercel serverless function - kehribar_tr için last.fm "now playing / recent track" kartı.
//
// Gereken env var: LASTFM_API_KEY (last.fm/api/account/create ile alınan key)
// Gereken paket: node-vibrant (albüm kapağından baskın renk çıkarmak için)
//   npm install node-vibrant
//
// Kullanım: <img src="https://kehribar.vercel.app/api/lastfm" alt="last.fm" />

import { Vibrant } from "node-vibrant/node";

const LASTFM_USER = "kehribar_tr";
const API_KEY = process.env.LASTFM_API_KEY;

// card.js ile aynı Everforest paleti - fallback / metin renkleri için
const PALETTE = {
  bg: "#2d353b",
  bgAlt: "#343f44",
  text: "#d3c6aa",
  subtext: "#859289",
  accent: "#a7c080",
};

async function getRecentTrack() {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USER}&api_key=${API_KEY}&format=json&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  const track = data?.recenttracks?.track?.[0];
  if (!track) return null;

  const isNowPlaying = track["@attr"]?.nowplaying === "true";
  const image =
    track.image?.find((i) => i.size === "extralarge")?.["#text"] ||
    track.image?.find((i) => i.size === "large")?.["#text"] ||
    "";

  return {
    name: track.name || "Bilinmiyor",
    artist: track.artist?.["#text"] || "",
    image,
    nowPlaying: isNowPlaying,
  };
}

// Albüm kapağından baskın rengi çıkar, arka plana hafifçe karıştır
// (tam saturasyon yerine bg tonuna yakın, gözü yormayan bir versiyon)
async function extractAccentColor(imageUrl) {
  if (!imageUrl) return PALETTE.accent;
  try {
    const palette = await Vibrant.from(imageUrl).getPalette();
    const swatch =
      palette.Vibrant || palette.Muted || palette.DarkVibrant || null;
    if (!swatch) return PALETTE.accent;
    const [r, g, b] = swatch.rgb;
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  } catch (_) {
    return PALETTE.accent;
  }
}

// Hex/rgb rengi bg tonuyla karıştırıp arka plan için koyu, kullanılabilir bir ton üretir
function blendWithBg(rgbString, ratio = 0.18) {
  const match = rgbString.match(/\d+/g);
  if (!match) return PALETTE.bg;
  const [r, g, b] = match.map(Number);
  const bg = { r: 0x2d, g: 0x35, b: 0x3b };
  const mix = (c1, c2) => Math.round(c1 * ratio + c2 * (1 - ratio));
  return `rgb(${mix(r, bg.r)}, ${mix(g, bg.g)}, ${mix(b, bg.b)})`;
}

async function toBase64(imageUrl) {
  if (!imageUrl) return "";
  try {
    const r = await fetch(imageUrl);
    const buf = await r.arrayBuffer();
    return Buffer.from(buf).toString("base64");
  } catch (_) {
    return "";
  }
}

// Hareketli equalizer çubukları - her biri farklı gecikme/süreyle yükselip alçalıyor
function equalizerBars(x, y, accent) {
  const bars = [0, 1, 2, 3].map((i) => {
    const bx = x + i * 7;
    const dur = (0.6 + i * 0.15).toFixed(2);
    const delay = (i * 0.12).toFixed(2);
    return `
      <rect x="${bx}" y="${y}" width="4" height="6" rx="2" fill="${accent}">
        <animate attributeName="height" values="4;16;6;14;4" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
        <animate attributeName="y" values="${y + 6};${y - 4};${y + 4};${y - 2};${y + 6}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
      </rect>`;
  });
  return bars.join("");
}

// Arka planda hafif, yavaş bir dalga çizgisi (dekoratif, çok belirgin değil)
function waveDecoration(accent) {
  return `
    <path d="M0,70 Q30,60 60,70 T120,70 T180,70 T240,70 T300,70 T380,70"
      fill="none" stroke="${accent}" stroke-opacity="0.15" stroke-width="2">
      <animate attributeName="d"
        values="M0,70 Q30,60 60,70 T120,70 T180,70 T240,70 T300,70 T380,70;
                M0,70 Q30,78 60,70 T120,70 T180,70 T240,70 T300,70 T380,70;
                M0,70 Q30,60 60,70 T120,70 T180,70 T240,70 T300,70 T380,70"
        dur="4s" repeatCount="indefinite"/>
    </path>`;
}

export default async function handler(req, res) {
  let track = null;
  try {
    track = await getRecentTrack();
  } catch (_) {}

  const trackName = track?.name || "Bir şey çalmıyor";
  const artist = track?.artist || "";
  const nowPlaying = track?.nowPlaying || false;

  const [accentRaw, imgBase64] = await Promise.all([
    extractAccentColor(track?.image),
    toBase64(track?.image),
  ]);
  const bgColor = blendWithBg(accentRaw);
  const accent = accentRaw;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="80" viewBox="0 0 380 80">
  <defs>
    <clipPath id="lastfm-thumb-clip">
      <rect x="12" y="10" width="60" height="60" rx="6"/>
    </clipPath>
    <linearGradient id="lastfm-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgColor}"/>
      <stop offset="100%" stop-color="${PALETTE.bg}"/>
    </linearGradient>
  </defs>

  <rect width="380" height="80" rx="12" fill="url(#lastfm-bg)"/>
  ${waveDecoration(accent)}

  ${
    imgBase64
      ? `<image href="data:image/jpeg;base64,${imgBase64}" x="12" y="10" width="60" height="60" clip-path="url(#lastfm-thumb-clip)" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect x="12" y="10" width="60" height="60" rx="6" fill="${PALETTE.bgAlt}"/>`
  }

  <text x="86" y="35" font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif" font-size="15" font-weight="600" fill="${PALETTE.text}">${escapeXml(trackName)}</text>
  <text x="86" y="54" font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif" font-size="12" fill="${PALETTE.subtext}">${escapeXml(artist)}${nowPlaying ? " · şu an çalıyor" : ""}</text>

  ${nowPlaying ? equalizerBars(320, 34, accent) : ""}
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  // now playing durumunda kısa cache, aksi halde biraz daha uzun
  res.setHeader(
    "Cache-Control",
    nowPlaying ? "public, max-age=60" : "public, max-age=600"
  );
  res.status(200).send(svg);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
