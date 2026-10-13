// /api/heatmap.js - son 12 haftanın commit ısı grafiği (token gerektirmez)
// Parametreler: ?lang=en  ?theme=light|dark  ?tz=Europe/Istanbul
import { buildPalettes, readParams } from "./_card-kit.js";
import { buildGrid, getActivity, renderError, renderHeatmap, stText } from "./_stats-kit.js";

const USER = "dpentx";

export default async function handler(req, res) {
  const { lang, mode } = readParams(req);
  const tz = typeof req.query?.tz === "string" ? req.query.tz : "Europe/Istanbul";
  const palettes = buildPalettes(null);
  res.setHeader("Content-Type", "image/svg+xml");
  try {
    const { daily } = await getActivity(USER, tz);
    const svg = renderHeatmap({ grid: buildGrid(daily, tz, 12), lang, palettes, mode });
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(svg);
  } catch (_) {
    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).send(renderError(lang, palettes, mode, stText(lang).heat[1]));
  }
}
