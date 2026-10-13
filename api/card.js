// /api/card.js
//
// "Hayatım bir şarkı olsaydı" kartı. Şarkı aşağıdaki sabitlerden gelir; kapak olarak
// YouTube küçük resmi kullanılır ve kartın renkleri o kapaktan türetilir.
// Karta tıklayınca şarkı YouTube Music'te açılır (README'deki <a> bağlantısı ile).
//
// Kullanım: <img src="https://kehribar.vercel.app/api/card" alt="..." />
// İsteğe bağlı parametreler: ?lang=en  ?theme=light|dark  (bkz. lastfm.js)

import { buildPalettes, fetchImage, readParams, renderCard, swatchFromImage } from "./_card-kit.js";

const VIDEO_ID = "EzeJVk0gDZ4";
const TRACK = "\u30B9\u30D7\u30FC\u30C8\u30CB\u30AF";
const ARTIST = "LOLUET";
const THUMB = `https://img.youtube.com/vi/${VIDEO_ID}/mqdefault.jpg`;

const LABEL = {
  tr: "YouTube Music'te dinle",
  en: "Play on YouTube Music",
};

export default async function handler(req, res) {
  const { lang, mode } = readParams(req);

  const art = await fetchImage(THUMB);
  const swatch = await swatchFromImage(art?.buf);
  const palettes = buildPalettes(swatch);

  const svg = renderCard({
    label: LABEL[lang],
    title: TRACK,
    artist: ARTIST,
    art,
    palettes,
    mode,
    button: "play",
  });

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(svg);
}
