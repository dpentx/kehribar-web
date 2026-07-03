// Parses the custom .nix-like contributions.nix format at BUILD time.
// Ported 1:1 from the original client-side parser, so the file format
// stays exactly the same and doesn't need to change.
export interface ContributionEntry {
  _name: string;
  url?: string;
  icon?: string;
  desc?: string;
  desc_en?: string;
  type?: string;
}

export function parseNixLike(text: string): Record<string, ContributionEntry> {
  const result: Record<string, ContributionEntry> = {};
  const cleaned = text.replace(/#[^\n]*/g, '');
  const blockRegex = /([\w][\w\s-]*?)\s*=\s*\{([^}]+)\}/g;
  const fieldRegex = /(\w+)\s*=\s*"([^"]*)";/g;

  let block: RegExpExecArray | null;
  while ((block = blockRegex.exec(cleaned)) !== null) {
    const name = block[1].trim();
    const body = block[2];
    const entry: ContributionEntry = { _name: name };

    fieldRegex.lastIndex = 0;
    let field: RegExpExecArray | null;
    while ((field = fieldRegex.exec(body)) !== null) {
      (entry as Record<string, string>)[field[1]] = field[2];
    }
    result[name] = entry;
  }
  return result;
}

export async function loadContributions(): Promise<ContributionEntry[]> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const filePath = path.resolve('./contributions.nix');
  const text = await fs.readFile(filePath, 'utf-8');
  return Object.values(parseNixLike(text));
}
