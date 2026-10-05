import type { Lang } from './i18n';

// "28 Eyl 2026" / "Sep 28, 2026". Front-matter dates are parsed as UTC, so we
// format in UTC to avoid the day shifting for visitors in other time zones.
export function fmtDate(date: Date | undefined, lang: Lang): string {
  if (!date) return '—';
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Small dot next to a repo's language. Colours are picked to keep ≥3:1
// contrast on both the light and the true-black surfaces.
const LANG_COLORS: Record<string, string> = {
  Kotlin: '#8A5CF5',
  Java: '#4A78B8',
  QML: '#3F8F1F',
  Nix: '#5277C3',
  Astro: '#B4467A',
  JavaScript: '#B38F00',
  TypeScript: '#3178C6',
  Python: '#3572A5',
  Shell: '#6E7681',
  Lua: '#5C6BC0',
  C: '#6E6E6E',
  'C++': '#D6336C',
  Rust: '#B7410E',
  HTML: '#E34C26',
  CSS: '#7B4DB5',
  Go: '#00849C',
};

export function langColor(name: string | null | undefined): string {
  return (name && LANG_COLORS[name]) || '#8F8F98';
}
