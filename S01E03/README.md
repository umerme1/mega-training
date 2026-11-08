# S01E03 — what it shows

The support desk merged 412 reports about dates into ticket #4471 and marked it known. The kb export shows three problems inside it. Each has an issue in this repo with the number of reports it covers.

- `support-kb/` — the desk's kb export with the added page `src/routes/kb/incidents/4471-what-it-shows/+page.svx`, its logic `src/lib/kb/tickets.ts` and component `src/lib/kb/TicketTable.svelte`, plus the SvelteKit + mdsvex scaffold that renders it (`pnpm install && pnpm build`).
- `rendered/4471-what-it-shows.html` — the page as the desk will see it, from `pnpm build` (static, with its `_app/` assets).
- `issues/` — the issue bodies as filed.
