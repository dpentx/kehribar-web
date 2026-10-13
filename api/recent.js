// /api/recent.js - son 30 günde en çok commit atılan ilk 4 proje (token gerektirmez)
// Parametreler: ?lang=en  ?theme=light|dark
import { buildPalettes, readParams } from "./_card-kit.js";
import { getActivity, renderError, renderRecent, stText, topRecent } from "./_stats-kit.js";

const USER = "dpentx";

export default async function handler(req, res) {
  const { lang, mode } = readParams(req);
  const palettes = buildPalettes(null);
  res.setHeader("Content-Type", "image/svg+xml");
  try {
    const { repos } = await getActivity(USER);
    const svg = renderRecent({ items: topRecent(repos, 4), lang, palettes, mode });
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(svg);
  } catch (_) {
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).send(renderError(lang, palettes, mode, stText(lang).recent[1]));
  }
}
