import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { NAV_ITEMS, translations, langPath } from '../../lib/i18n';

export const GET: APIRoute = async () => {
  const lang = 'en' as const;
  const dict = translations[lang];

  const navEntries = NAV_ITEMS.map((item) => ({
    title: dict[item.key],
    url: langPath(lang, item.href),
  }));

  const [blogPosts, nixPosts] = await Promise.all([
    getCollection('blog', (p) => p.id.startsWith('en/')),
    getCollection('nixzone', (p) => p.id.startsWith('en/')),
  ]);

  const blogEntries = blogPosts.map((p) => ({
    title: p.data.title ?? p.id.split('/').pop()?.replace(/\.md$/, '') ?? p.id,
    url: langPath(lang, `/blog/${p.id.slice('en/'.length).replace(/\.md$/, '')}`),
  }));

  const nixEntries = nixPosts.map((p) => ({
    title: p.data.title ?? p.id.split('/').pop()?.replace(/\.md$/, '') ?? p.id,
    url: langPath(lang, `/nixzone/${p.id.slice('en/'.length).replace(/\.md$/, '')}`),
  }));

  const body = JSON.stringify([...navEntries, ...blogEntries, ...nixEntries]);
  return new Response(body, {
    headers: { 'Content-Type': 'application/json' },
  });
};
