import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
export default {
  extensions: ['.svelte', '.svx'],
  preprocess: [vitePreprocess(), mdsvex({ extensions: ['.svx'], layout: { runbook: path.join(here, 'src/lib/layouts/runbook.svelte') } })],
  kit: {
    adapter: adapter({ pages: 'build', assets: 'build', fallback: undefined, precompress: false, strict: true }),
    alias: { '#lib': 'src/lib', '#lib/*': 'src/lib/*' },
    prerender: { entries: ['*', '/kb', '/kb/incidents/4471', '/kb/triage/dedupe', '/kb/decisions/0001-dedupe-by-subject'] }
  }
};
