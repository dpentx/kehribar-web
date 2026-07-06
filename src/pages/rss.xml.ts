import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', (p) => p.id.startsWith('tr/'));
  return rss({
    title: 'Kehribar — Blog',
    description: 'Kehribar (dpentx) blog yazıları',
    site: context.site ?? 'https://kehribar.vercel.app',
    items: posts.map((post) => ({
      title: post.data.title ?? post.id.split('/').pop()?.replace(/\.md$/, '') ?? post.id,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.id.slice('tr/'.length).replace(/\.md$/, '')}`,
    })),
  });
}
