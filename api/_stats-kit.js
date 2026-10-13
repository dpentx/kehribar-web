// api/_stats-kit.js
//
// Token GEREKTİRMEYEN GitHub etkinlik kartlarının veri + çizim katmanı.
// Kaynak: herkese açık Events API (son 90 gün, en fazla ~300 olay) ve repo listesi.
// Özel repolar bu API'de zaten görünmez, yani kartlara sızamaz.
//
// Not: Anonim GitHub API limiti IP başına saatte 60 istektir. Bu yüzden uç noktalar
// CDN önbelleği (s-maxage) ile servis edilir ve veri bellekte 10 dk saklanır.
// Opsiyonel: GH_STATS_TOKEN tanımlanırsa limit yükselir, ama zorunlu değildir.

import { CARD_W, FONT, escapeXml, styleBlock, truncate } from "./_card-kit.js";

const API = "https://api.github.com";
const DAY = 86400000;
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

// ---------- veri ----------
async function gh(path) {
  const token = process.env.GH_STATS_TOKEN;
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kehribar-stats-cards",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${path}`);
  return res.json();
}

export function dayKey(date, tz) {
  // "2026-10-10" biçiminde, verilen saat diliminde gün anahtarı
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function getActivity(user, tz = "Europe/Istanbul", now = new Date()) {
  const key = `${user}|${tz}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  // Önce kendi repo listesi: dil bilgisi ve (varsa) özel repoların elenmesi için.
  const langOf = new Map();
  const privateNames = new Set(); // yalnızca token kullanılırsa dolabilir; yine de kartlardan elenir
  try {
    const own = await gh(`/users/${user}/repos?per_page=100&sort=pushed`);
    for (const r of own) {
      if (r.private) privateNames.add(r.full_name.toLowerCase());
      else langOf.set(r.full_name.toLowerCase(), r.language || null);
    }
  } catch (_) {}

  const events = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await gh(`/users/${user}/events/public?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    events.push(...batch);
    if (new Date(batch[batch.length - 1].created_at).getTime() < now.getTime() - 90 * DAY) break;
  }

  const daily = new Map(); // gün -> commit
  const repoAgg = new Map(); // owner/repo -> { c30, c90, last }
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    // Savunma amaçlı: herkese açık olmayan hiçbir olay kartlara girmez.
    if (e.public === false || privateNames.has(e.repo.name.toLowerCase())) continue;
    const at = new Date(e.created_at);
    const age = now.getTime() - at.getTime();
    if (age > 90 * DAY) continue;
    // GitHub payload'tan commit sayısını kaldırırsa her push 1 birim sayılır.
    const n = e.payload?.distinct_size ?? e.payload?.size ?? e.payload?.commits?.length ?? 1;
    const dk = dayKey(at, tz);
    daily.set(dk, (daily.get(dk) || 0) + n);
    const r = repoAgg.get(e.repo.name) || { c30: 0, c90: 0, last: 0 };
    r.c90 += n;
    if (age <= 30 * DAY) r.c30 += n;
    r.last = Math.max(r.last, at.getTime());
    repoAgg.set(e.repo.name, r);
  }

  const unknown = [...repoAgg.entries()]
    .filter(([full]) => !langOf.has(full.toLowerCase()))
    .sort((a, b) => b[1].c90 - a[1].c90)
    .slice(0, 5);
  await Promise.all(unknown.map(async ([full]) => {
    try { langOf.set(full.toLowerCase(), (await gh(`/repos/${full}`)).language || null); } catch (_) {}
  }));

  const repos = [...repoAgg.entries()].filter(([full]) => !privateNames.has(full.toLowerCase())).map(([full, r]) => ({
    full,
    name: full.toLowerCase().startsWith(`${user.toLowerCase()}/`) ? full.split("/")[1] : full,
    language: langOf.get(full.toLowerCase()) || null,
    ...r,
  }));

  const data = { daily, repos };
  cache.set(key, { at: Date.now(), data });
  return data;
}

// ---------- hesaplar ----------
// Pazartesi başlangıçlı, son `weeks` hafta; son sütun içinde bulunulan hafta.
export function buildGrid(daily, tz, weeks = 12, now = new Date()) {
  const todayKey = dayKey(now, tz);
  const todayDate = new Date(todayKey + "T00:00:00Z");
  const dow = (todayDate.getUTCDay() + 6) % 7; // Pzt=0
  const start = new Date(todayDate.getTime() - (dow + (weeks - 1) * 7) * DAY);
  const cols = [];
  let total = 0, max = 0;
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY);
      const key = date.toISOString().slice(0, 10);
      if (key > todayKey) { col.push(null); continue; }
      const count = daily.get(key) || 0;
      total += count;
      max = Math.max(max, count);
      col.push({ key, count });
    }
    cols.push(col);
  }
  // en uzun seri
  let streak = 0, best = 0;
  for (const col of cols) for (const cell of col) {
    if (!cell) continue;
    streak = cell.count > 0 ? streak + 1 : 0;
    best = Math.max(best, streak);
  }
  return { cols, total, max, best };
}

export function relTime(ms, lang, now = Date.now()) {
  const days = Math.floor((now - ms) / DAY);
  if (lang === "en") return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`;
  return days <= 0 ? "bugün" : days === 1 ? "dün" : `${days} gün önce`;
}

export function topRecent(repos, n = 4) {
  return repos.filter((r) => r.c30 > 0).sort((a, b) => b.c30 - a.c30 || b.last - a.last).slice(0, n);
}

export function langShares(repos, n = 5) {
  const sums = new Map();
  for (const r of repos) {
    if (!r.language) continue;
    sums.set(r.language, (sums.get(r.language) || 0) + r.c90);
  }
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  const sorted = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n).reduce((a, [, v]) => a + v, 0);
  if (rest > 0) top.push([null, rest]);
  return top.map(([name, v]) => ({ name, pct: (v / total) * 100 }));
}

const LANG_COLORS = {
  Kotlin: "#8A5CF5", Java: "#4A78B8", QML: "#3F8F1F", Nix: "#5277C3", Astro: "#B4467A",
  JavaScript: "#B38F00", TypeScript: "#3178C6", Python: "#3572A5", Shell: "#6E7681", Lua: "#5C6BC0",
  C: "#6E6E6E", "C++": "#D6336C", Rust: "#B7410E", HTML: "#E34C26", CSS: "#7B4DB5", Go: "#00849C",
};
export const langColor = (n) => (n && LANG_COLORS[n]) || "#8F8F98";

// ---------- çizim ----------
const TEXT = {
  tr: {
    heat: ["Son 12 hafta", "Commit etkinliği", "commit", "gün seri"],
    recent: ["Son 30 gün", "Son uğraşılanlar", (n, rel) => `${n} commit · ${rel}`, "Son 30 günde commit yok"],
    langs: ["Son 90 gün", "Şu dillerle uğraşıyor", "Diğer", "Dil verisi yok"],
    error: "GitHub verisi alınamadı",
  },
  en: {
    heat: ["Last 12 weeks", "Commit activity", "commits", "day streak"],
    recent: ["Last 30 days", "Recently worked on", (n, rel) => `${n} commit${n === 1 ? "" : "s"} · ${rel}`, "No commits in the last 30 days"],
    langs: ["Last 90 days", "Working with", "Other", "No language data"],
    error: "Couldn't load GitHub data",
  },
};
export const stText = (lang) => TEXT[lang];

const extraCss = (get) => `
    .h0{fill:${get("ink")};fill-opacity:.08} .h1{fill:${get("acc")};fill-opacity:.3}
    .h2{fill:${get("acc")};fill-opacity:.55} .h3{fill:${get("acc")};fill-opacity:.8} .h4{fill:${get("acc")}}
    .track{fill:${get("ink")};fill-opacity:.09} .line{stroke:${get("ink")};stroke-opacity:.09}
    .barfill{fill:${get("acc")}}`;

function frame({ width = CARD_W, height, palettes, mode, label, title, body, aria }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(aria)}">
  <title>${escapeXml(aria)}</title>
  <style>${styleBlock(palettes, mode, extraCss)}
    text{font-family:${FONT}}
    .num{font-variant-numeric:tabular-nums}
  </style>
  <rect class="bg hair" x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="24" stroke-opacity="0.1" stroke-width="1"/>
  <text class="accText" x="22" y="30" font-size="10.5" font-weight="600">${escapeXml(label)}</text>
  <text class="ink" x="22" y="50" font-size="15" font-weight="700">${escapeXml(title)}</text>
  ${body}
</svg>`;
}

export function renderHeatmap({ grid, lang, palettes, mode }) {
  const t = TEXT[lang].heat;
  const size = 14, gap = 3, x0 = 22, y0 = 68;
  const level = (c) => (c === 0 ? 0 : Math.max(1, Math.ceil((4 * c) / Math.max(grid.max, 4))));
  let cells = "";
  grid.cols.forEach((col, i) => col.forEach((cell, j) => {
    if (!cell) return;
    cells += `<rect class="h${level(cell.count)}" x="${x0 + i * (size + gap)}" y="${y0 + j * (size + gap)}" width="${size}" height="${size}" rx="4"/>`;
  }));
  const gridW = 12 * size + 11 * gap; // 213
  const sx = x0 + gridW + 28;
  const body = `${cells}
  <text class="ink num" x="${sx}" y="102" font-size="30" font-weight="700">${grid.total}</text>
  <text class="sub" x="${sx}" y="120" font-size="12" font-weight="500">${escapeXml(t[2])}</text>
  <text class="ink num" x="${sx}" y="160" font-size="22" font-weight="700">${grid.best}</text>
  <text class="sub" x="${sx}" y="178" font-size="12" font-weight="500">${escapeXml(t[3])}</text>`;
  return frame({ height: 204, palettes, mode, label: t[0], title: t[1], body, aria: `${t[1]}: ${grid.total} ${t[2]}` });
}

export function renderRecent({ items, lang, palettes, mode, now = Date.now() }) {
  const t = TEXT[lang].recent;
  const rowH = 48, y0 = 66;
  const rows = items.length || 1;
  const height = y0 + rows * rowH + 14;
  const max = Math.max(1, ...items.map((i) => i.c30));
  let body = "";
  if (items.length === 0) {
    body = `<text class="sub" x="22" y="${y0 + 28}" font-size="13">${escapeXml(t[3])}</text>`;
  }
  items.forEach((it, i) => {
    const y = y0 + i * rowH;
    if (i > 0) body += `<line class="line" x1="22" x2="358" y1="${y}" y2="${y}" stroke-width="1"/>`;
    const w = Math.max(6, Math.round((it.c30 / max) * 84));
    body += `<circle cx="28" cy="${y + 24}" r="5" fill="${langColor(it.language)}"/>
  <text class="ink" x="44" y="${y + 22}" font-size="14" font-weight="600">${escapeXml(truncate(it.name, 190, 14))}</text>
  <text class="sub num" x="44" y="${y + 38}" font-size="11.5" font-weight="500">${escapeXml(t[2](it.c30, relTime(it.last, lang, now)))}</text>
  <rect class="track" x="274" y="${y + 21}" width="84" height="6" rx="3"/>
  <rect class="barfill" x="274" y="${y + 21}" width="${w}" height="6" rx="3"/>`;
  });
  return frame({ height, palettes, mode, label: t[0] === undefined ? "" : t[0], title: t[1], body, aria: `${t[1]}: ${items.map((i) => i.name).join(", ")}` });
}

export function renderLangs({ shares, lang, palettes, mode }) {
  const t = TEXT[lang].langs;
  const list = shares;
  const rowH = 26, y0 = 96;
  const height = list.length ? y0 + list.length * rowH + 14 : 120;
  let body = "";
  if (!list.length) {
    body = `<text class="sub" x="22" y="86" font-size="13">${escapeXml(t[3])}</text>`;
  } else {
    // yığılmış çubuk: parçalar arası boşluk dahil toplam genişlik tam barW olur
    const barX = 22, barW = 336, barY = 64, barH = 10, gapPx = 2;
    const avail = barW - gapPx * (list.length - 1);
    let widths = list.map((s) => Math.max(4, (s.pct / 100) * avail));
    const sum = widths.reduce((a, b) => a + b, 0);
    widths = widths.map((w) => (w * avail) / sum);
    let x = barX;
    let segs = "";
    list.forEach((s, i) => {
      segs += `<rect x="${x.toFixed(1)}" y="${barY}" width="${widths[i].toFixed(1)}" height="${barH}" fill="${langColor(s.name)}"/>`;
      x += widths[i] + gapPx;
    });
    body += `<clipPath id="bar-clip"><rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="5"/></clipPath>
  <g clip-path="url(#bar-clip)">${segs}</g>`;
    list.forEach((s, i) => {
      const y = y0 + i * rowH;
      body += `<circle cx="28" cy="${y + 8}" r="5" fill="${langColor(s.name)}"/>
  <text class="ink" x="44" y="${y + 13}" font-size="13.5" font-weight="600">${escapeXml(s.name || t[2])}</text>
  <text class="sub num" x="358" y="${y + 13}" font-size="13" font-weight="600" text-anchor="end">${s.pct >= 10 ? Math.round(s.pct) : s.pct.toFixed(1)}%</text>`;
    });
  }
  return frame({ height, palettes, mode, label: t[0], title: t[1], body, aria: `${t[1]}: ${list.map((s) => s.name || t[2]).join(", ")}` });
}

export function renderError(lang, palettes, mode, title) {
  const t = TEXT[lang];
  return frame({ height: 110, palettes, mode, label: "GitHub", title, body: `<text class="sub" x="22" y="80" font-size="13">${escapeXml(t.error)}</text>`, aria: t.error });
}
