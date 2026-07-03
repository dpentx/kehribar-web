import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog posts live at src/content/blog/{tr,en}/**/*.md
// NixZONE posts live at src/content/nixzone/{tr,en}/*.md
// Front-matter is optional: title falls back to the first markdown heading,
// date falls back to file mtime, so writers can just drop a .md file in and go.
const postSchema = z.object({
  title: z.string().optional(),
  date: z.coerce.date().optional(),
  description: z.string().optional(),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: postSchema,
});

const nixzone = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/nixzone' }),
  schema: postSchema,
});

export const collections = { blog, nixzone };
