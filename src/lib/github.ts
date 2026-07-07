// Fetches GitHub profile + repo stats at BUILD time (not from the visitor's
// browser). This removes the old client-side rate-limit problem entirely:
// unauthenticated GitHub requests are capped at 60/hour per IP, which real
// visitor traffic could exhaust. A build only calls the API once, and a
// GITHUB_TOKEN (set as an env var in Vercel) bumps the cap to 5000/hour if
// you ever want to rebuild very frequently.

const GITHUB_USERNAME = 'dpentx';

export interface GithubProfile {
  login: string;
  avatar_url: string;
  name: string | null;
}

export interface GithubStats {
  profile: GithubProfile | null;
  repoCount: number;
  starCount: number;
  repos: Array<{
    name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    language: string | null;
    fork: boolean;
  }>;
}

function authHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Small fallback so a failed/blocked build-time fetch (e.g. offline dev
// environment) never breaks the whole site — it just shows zeros/placeholder.
const FALLBACK: GithubStats = {
  profile: { login: GITHUB_USERNAME, avatar_url: `https://github.com/${GITHUB_USERNAME}.png?size=200`, name: 'Kehribar' },
  repoCount: 0,
  starCount: 0,
  repos: [],
};

export interface ActiveRepo {
  name: string;
  url: string;
  commits: number;
}

// Finds the repo the user pushed the most commits to in the last 7 days,
// using the public events feed (build-time, same rate-limit friendliness as
// fetchGithubStats). Returns null if there was no push activity or the fetch
// failed, so the caller can fall back to the static "currently" text.
export async function fetchMostActiveRepo(): Promise<ActiveRepo | null> {
  try {
    const headers = { Accept: 'application/vnd.github+json', ...authHeaders() };
    const res = await fetch(
      `https://api.github.com/users/${GITHUB_USERNAME}/events/public?per_page=100`,
      { headers },
    );
    if (!res.ok) {
      console.warn(`[github] events fetch failed (${res.status}) — no active repo`);
      return null;
    }

    const events = (await res.json()) as Array<{
      type: string;
      created_at: string;
      repo?: { name: string };
      payload?: { commits?: unknown[]; size?: number };
    }>;

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const counts = new Map<string, number>();

    for (const ev of events) {
      if (ev.type !== 'PushEvent' || !ev.repo?.name) continue;
      if (new Date(ev.created_at).getTime() < weekAgo) continue;
      const size = ev.payload?.commits?.length ?? ev.payload?.size ?? 0;
      counts.set(ev.repo.name, (counts.get(ev.repo.name) ?? 0) + size);
    }

    let top: ActiveRepo | null = null;
    for (const [fullName, commits] of counts) {
      if (!top || commits > top.commits) {
        top = { name: fullName.split('/').pop() ?? fullName, url: `https://github.com/${fullName}`, commits };
      }
    }
    return top;
  } catch (err) {
    console.warn('[github] events fetch threw — no active repo:', err);
    return null;
  }
}

export async function fetchGithubStats(): Promise<GithubStats> {
  try {
    const headers = { Accept: 'application/vnd.github+json', ...authHeaders() };

    const [profileRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${GITHUB_USERNAME}`, { headers }),
      fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=updated`, { headers }),
    ]);

    if (!profileRes.ok || !reposRes.ok) {
      console.warn(`[github] build-time fetch failed (profile: ${profileRes.status}, repos: ${reposRes.status}) — using fallback`);
      return FALLBACK;
    }

    const profile = (await profileRes.json()) as GithubProfile;
    const repos = (await reposRes.json()) as GithubStats['repos'];

    const starCount = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

    return {
      profile,
      repoCount: repos.length,
      starCount,
      repos,
    };
  } catch (err) {
    console.warn('[github] build-time fetch threw — using fallback:', err);
    return FALLBACK;
  }
}
