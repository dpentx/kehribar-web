#!/usr/bin/env node
// Katkılar botu
// ------------------------------------------------------------------
// GitHub'da başkalarının projelerine yaptığın MERGE edilmiş PR'ları ve
// default branch'e giren commit'leri tarar. contributions.nix'te henüz
// olmayan projeleri bulur, her biri için:
//   • açıklamayı repo'dan alır,
//   • proje ikonunu repo içinden bulup public/icons/ altına indirir
//     (bulamazsa sahibinin avatarını kullanır),
//   • contributions.nix'e yeni bir blok ekler.
// Hiçbir bağımlılığı yok (Node 20+). Kullanım:
//   node scripts/update-contributions.mjs [--dry-run] [--summary dosya.md]
// Ortam değişkenleri: GITHUB_TOKEN, CONTRIB_USER (varsayılan dpentx),
// MAX_NEW (bir seferde en fazla kaç proje, varsayılan 8).

import fs from 'node:fs/promises';
import path from 'node:path';

const USER = process.env.CONTRIB_USER || 'dpentx';
const TOKEN = process.env.GITHUB_TOKEN || '';
const MAX_NEW = Number(process.env.MAX_NEW || 8);
const DRY = process.argv.includes('--dry-run');
const summaryArg = process.argv.indexOf('--summary');
const SUMMARY_FILE = summaryArg !== -1 ? process.argv[summaryArg + 1] : null;

const NIX_FILE = 'contributions.nix';
const IGNORE_FILE = 'scripts/contributions-ignore.txt';
const ICON_DIR = 'public/icons';
const MAX_ICON_BYTES = 600 * 1024;

// ---------- GitHub API ----------
async function gh(apiPath, { raw = false } = {}) {
  const res = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kehribar-contributions-bot',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (res.status === 404 || res.status === 409) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status} ${apiPath}: ${body.slice(0, 200)}`);
  }
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}

// ---------- yardımcılar ----------
export function sanitizeText(s, max = 140) {
  // contributions.nix ayrıştırıcısı: " { } # karakterlerini ve satır sonlarını sevmiyor.
  return String(s || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, "'")
    .replace(/[{}#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function entryName(repoName, taken) {
  let name = repoName.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim() || 'project';
  if (taken.has(name.toLowerCase())) name = `${name} 2`;
  return name;
}

export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

const TRANSLATION_PATH = /(^|\/)(values-[a-z]{2,3}(-r[a-z]{2})?|locales?|lang(uages?)?|i18n|l10n|translations?|intl)(\/|$)|\.(po|pot|xlf|xliff|arb)$|(^|\/)strings(_[a-z]{2})?\.(xml|json|properties)$|(^|\/)tr([-_]tr)?\.(json|ya?ml|po|ts|js|properties|arb|toml)$/i;
const TRANSLATION_TITLE = /translat|çeviri|turkish|türkçe|\btr\b|i18n|l10n|locali[sz]/i;

export function normalizeRepoUrl(u) {
  return String(u || '').toLowerCase().replace(/\/+$/, '').replace(/\.git$/, '');
}

// ---------- ikon bulma ----------
const IMG = /\.(png|webp|svg|jpe?g)$/i;
const BAD = /(foreground|background|round|monochrome|banner|screenshot|screen[-_]?shot|preview|badge|sponsor|promo|feature[-_]?graphic|splash|notification|favicon|wallpaper|cover|node_modules|\/tests?\/|\/test\/|\.github\/(workflows|ISSUE))/i;

export function scoreIconPath(p) {
  if (!IMG.test(p) || BAD.test(p)) return -1;
  const lower = p.toLowerCase();
  const base = lower.split('/').pop();
  const depth = lower.split('/').length;
  let s = -1;
  if (/^fastlane\/metadata\/android\/[^/]+\/images\/icon\.(png|webp|jpe?g)$/.test(lower)) s = 100;
  else if (/(^|\/)ic_launcher-playstore\.(png|webp)$/.test(lower)) s = 95;
  else if (depth <= 3 && /^(app[-_]?)?(icon|logo)\.(png|svg|webp)$/.test(base)) s = 90;
  else if (/mipmap-xxxhdpi\/ic_launcher\.(png|webp)$/.test(lower)) s = 80;
  else if (/mipmap-xxhdpi\/ic_launcher\.(png|webp)$/.test(lower)) s = 75;
  else if (/mipmap-xhdpi\/ic_launcher\.(png|webp)$/.test(lower)) s = 70;
  else if (/mipmap-[a-z]*dpi\/ic_launcher\.(png|webp)$/.test(lower)) s = 60;
  else if (depth <= 4 && /(^|[-_])(icon|logo)([-_.]|$)/.test(base)) s = 55;
  if (s < 0) return -1;
  return s * 10 - depth; // eşit puanda daha sığ yol kazansın
}

function detectExt(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  const head = buf.toString('utf8', 0, 512).trimStart();
  if (head.startsWith('<') && /<svg[\s>]/i.test(buf.toString('utf8', 0, 2048))) return 'svg';
  return null;
}

async function findIcon(repo) {
  const full = repo.full_name;
  const tree = await gh(`/repos/${full}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`);
  const candidates = (tree?.tree || [])
    .filter((n) => n.type === 'blob' && (n.size ?? 0) > 0 && n.size <= MAX_ICON_BYTES)
    .map((n) => ({ path: n.path, score: scoreIconPath(n.path) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  for (const c of candidates) {
    const buf = await gh(`/repos/${full}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(repo.default_branch)}`, { raw: true });
    const ext = buf && detectExt(buf);
    if (buf && ext && buf.length <= MAX_ICON_BYTES) return { buf, ext, source: `${full}/${c.path}` };
  }

  // Yedek: sahibinin avatarı
  const avatarUrl = `${repo.owner.avatar_url}${repo.owner.avatar_url.includes('?') ? '&' : '?'}s=128`;
  const res = await fetch(avatarUrl, { headers: { 'User-Agent': 'kehribar-contributions-bot' } });
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = detectExt(buf);
    if (ext) return { buf, ext, source: `${repo.owner.login} avatarı (repo içinde ikon bulunamadı)` };
  }
  return null;
}

// ---------- katkı verilen repoları bul ----------
async function findContributedRepos() {
  const found = new Map(); // full_name(lower) -> { fullName, prs: Set, commits: number, last }
  const touch = (fullName, patch) => {
    const key = fullName.toLowerCase();
    const cur = found.get(key) || { fullName, prs: new Set(), commits: 0, last: '' };
    if (patch.pr) cur.prs.add(patch.pr);
    if (patch.commit) cur.commits += 1;
    if (patch.at && patch.at > cur.last) cur.last = patch.at;
    found.set(key, cur);
  };

  // 1) Merge edilmiş PR'lar ("onaylanırsa" = merge)
  const prQuery = encodeURIComponent(`author:${USER} type:pr is:merged -user:${USER}`);
  const prs = await gh(`/search/issues?q=${prQuery}&sort=updated&order=desc&per_page=100`);
  for (const it of prs?.items || []) {
    const fullName = it.repository_url.split('/repos/')[1];
    if (fullName) touch(fullName, { pr: it.number, at: it.closed_at || it.updated_at });
  }

  // 2) Default branch'e giren commit'ler (doğrudan commit veya squash/rebase merge)
  const cQuery = encodeURIComponent(`author:${USER}`);
  const commits = await gh(`/search/commits?q=${cQuery}&sort=author-date&order=desc&per_page=100`);
  for (const it of commits?.items || []) {
    const fullName = it.repository?.full_name;
    if (fullName && it.repository.owner?.login?.toLowerCase() !== USER.toLowerCase()) {
      touch(fullName, { commit: true, at: it.commit?.author?.date });
    }
  }
  return [...found.values()].sort((a, b) => b.last.localeCompare(a.last));
}

// ---------- ana akış ----------
async function main() {
  const nixText = await fs.readFile(NIX_FILE, 'utf8');
  const existingUrls = new Set([...nixText.matchAll(/url\s*=\s*"([^"]+)"/g)].map((m) => normalizeRepoUrl(m[1])));
  const takenNames = new Set([...nixText.replace(/#[^\n]*/g, '').matchAll(/([\w][\w\s-]*?)\s*=\s*\{/g)].map((m) => m[1].trim().toLowerCase()));

  let ignore = new Set();
  try {
    ignore = new Set((await fs.readFile(IGNORE_FILE, 'utf8')).split('\n').map((l) => l.replace(/#.*/, '').trim().toLowerCase()).filter(Boolean));
  } catch {}

  const contributed = await findContributedRepos();
  console.log(`Taranan: ${contributed.length} proje (merge edilmiş PR / commit).`);

  const fresh = contributed.filter((c) => {
    const [owner] = c.fullName.split('/');
    if (owner.toLowerCase() === USER.toLowerCase()) return false;
    if (ignore.has(c.fullName.toLowerCase())) return false;
    return !existingUrls.has(normalizeRepoUrl(`https://github.com/${c.fullName}`));
  });
  console.log(`Listede olmayan: ${fresh.length}`);

  const batch = fresh.slice(0, MAX_NEW);
  const added = [];
  let append = '';

  for (const c of batch) {
   try {
    const repo = await gh(`/repos/${c.fullName}`);
    if (!repo) { console.log(`- ${c.fullName}: erişilemedi, atlandı`); continue; }

    // Çeviri mi, genel katkı mı?
    let type = 'contribution';
    for (const n of [...c.prs].slice(0, 3)) {
      const pr = await gh(`/repos/${c.fullName}/pulls/${n}`);
      const files = (await gh(`/repos/${c.fullName}/pulls/${n}/files?per_page=100`)) || [];
      if (TRANSLATION_TITLE.test(pr?.title || '') || files.some((f) => TRANSLATION_PATH.test(f.filename))) { type = 'translation'; break; }
    }

    const name = entryName(repo.name, takenNames);
    takenNames.add(name.toLowerCase());

    const icon = await findIcon(repo);
    let iconRel = '';
    if (icon) {
      let slug = slugify(repo.name);
      let file = `${slug}.${icon.ext}`;
      try { await fs.access(path.join(ICON_DIR, file)); slug = `${slugify(repo.owner.login)}-${slug}`; file = `${slug}.${icon.ext}`; } catch {}
      iconRel = `icons/${file}`;
      if (!DRY) {
        await fs.mkdir(ICON_DIR, { recursive: true });
        await fs.writeFile(path.join(ICON_DIR, file), icon.buf);
      }
    }

    const desc = sanitizeText(repo.description);
    const prList = [...c.prs].slice(0, 3).map((n) => `#${n}`).join(', ');
    const why = prList ? `merge edilen PR ${prList}` : 'default branch\'e giren commit';
    append += `\n# bot: ${repo.full_name} — ${why}\n${name} = {\n  url = "${repo.html_url}";\n${iconRel ? `  icon = "${iconRel}";\n` : ''}${desc ? `  desc_en = "${desc}";\n` : ''}  type = "${type}";\n};\n`;
    added.push({ name, full: repo.full_name, url: repo.html_url, type, why, iconRel, iconSource: icon?.source || 'yok', desc });
    console.log(`+ ${name} (${repo.full_name}) [${type}] ikon: ${icon?.source || 'yok'}`);
   } catch (err) {
    // Tek bir projedeki hata (rate limit, silinmiş repo...) diğerlerini engellemesin.
    console.warn(`- ${c.fullName}: atlandı (${err.message})`);
   }
  }

  if (added.length === 0) {
    console.log('Yeni proje yok.');
    if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, 'changed=false\n');
    return;
  }

  if (!DRY) {
    await fs.writeFile(NIX_FILE, nixText.replace(/\s*$/, '\n') + append);
  } else {
    console.log('--- dry run, yazılacak içerik ---' + append);
  }

  const lines = [
    `Bot, ${added.length} yeni katkı projesi buldu. Birleştirmeden önce ikonlara ve açıklamalara göz at.`,
    '',
    '| Proje | Tür | Neden | İkon |',
    '|---|---|---|---|',
    ...added.map((a) => `| [${a.name}](${a.url}) | ${a.type} | ${a.why} | ${a.iconSource} |`),
    '',
    `Listede olmasını istemediğin bir proje varsa \`${IGNORE_FILE}\` dosyasına \`owner/repo\` olarak ekle, bot bir daha eklemez.`,
    fresh.length > batch.length ? `\nNot: ${fresh.length - batch.length} proje daha var, sonraki taramada eklenecek.` : '',
  ];
  if (SUMMARY_FILE) await fs.writeFile(SUMMARY_FILE, lines.join('\n') + '\n');
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `changed=${DRY ? 'false' : 'true'}\ncount=${added.length}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
