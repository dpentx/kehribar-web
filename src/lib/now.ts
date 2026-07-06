import type { Lang } from './i18n';

export interface NowData {
  tr: string;
  en: string;
  updated: string;
}

export async function loadNow(): Promise<NowData> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const filePath = path.resolve('./currently.json');
  const text = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(text) as NowData;
}

export function nowText(data: NowData, lang: Lang): string {
  return data[lang];
}
