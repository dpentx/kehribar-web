// /api/lastfm.js
//
// Vercel serverless function - kehribar_tr için last.fm "şu an çalıyor / son dinlenen" kartı.
// One UI tarzı, albüm kapağının renklerinden türetilen açık/koyu palet kullanır.
//
// Gereken env var: LASTFM_API_KEY (last.fm/api/account/create ile alınan key)
// Gereken paket: node-vibrant
//
// Kullanım:
//   <img src="https://kehribar.vercel.app/api/lastfm" alt="last.fm" />
// İsteğe bağlı parametreler:
//   ?lang=en            etiketler İngilizce olur (varsayılan tr)
//   ?theme=light|dark   temayı zorlar (varsayılan: tarayıcının temasını izler)

import { buildPalettes, fetchImage, readParams, renderCard, swatchFromImage } from "./_card-kit.js";

const LASTFM_USER = "kehribar_tr";
const API_KEY = process.env.LASTFM_API_KEY;

const TEXT = {
  tr: { playing: "Şu an çalıyor", idle: "Son dinlenen", none: "Bir şey çalmıyor" },
  en: { playing: "Now playing", idle: "Last played", none: "Nothing playing" },
};

async function getRecentTrack() {
  const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USER}&api_key=${API_KEY}&format=json&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  const track = data?.recenttracks?.track?.[0];
  if (!track) return null;

  const image =
    track.image?.find((i) => i.size === "extralarge")?.["#text"] ||
    track.image?.find((i) => i.size === "large")?.["#text"] ||
    "";

  return {
    name: track.name || "",
    artist: track.artist?.["#text"] || "",
    image,
    nowPlaying: track["@attr"]?.nowplaying === "true",
  };
}

export default async function handler(req, res) {
  const { lang, mode } = readParams(req);
  const t = TEXT[lang];

  let track = null;
  try {
    track = await getRecentTrack();
  } catch (_) {}

  const nowPlaying = track?.nowPlaying || false;
  // Last.fm'in "yer tutucu" yıldız görseli gerçek bir kapak değildir; renk çıkarmaya değmez.
  const hasRealArt = track?.image && !/2a96cbd8b46e442fc41c2b86b821562f/.test(track.image);
  const art = hasRealArt ? await fetchImage(track.image) : null;
  const swatch = await swatchFromImage(art?.buf);
  const palettes = buildPalettes(swatch);

  const svg = renderCard({
    label: track ? (nowPlaying ? t.playing : t.idle) : t.idle,
    title: track?.name || t.none,
    artist: track?.artist || "",
    art,
    palettes,
    mode,
    button: nowPlaying ? "playing" : "idle",
  });

  res.setHeader("Content-Type", "image/svg+xml");
  // çalarken kısa cache, aksi halde biraz daha uzun
  res.setHeader("Cache-Control", nowPlaying ? "public, max-age=60" : "public, max-age=600");
  res.status(200).send(svg);
}
