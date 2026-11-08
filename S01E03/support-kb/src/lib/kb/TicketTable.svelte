<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import type { Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  import { mistagged, splitTicket, type Problem } from '#lib/kb/tickets';

  // `issues`: the GitHub issue filed for each problem, problem → link.
  let { ticket, issues = {} }: { ticket: number; issues?: Partial<Record<Problem, string>> } = $props();

  const rows = $derived(splitTicket(reports as Report[], ticket, notes.oneDayMove, tenantOf));
  const total = $derived(rows.reduce((n, r) => n + r.reports.length, 0));
  const wrongTags = $derived(mistagged(rows));
  const list = (m: Record<string, number>) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ×${n}`)
      .join(' · ');
  const WHAT: Record<Problem, string> = {
    parser: 'month and day flipped: the shared parser reads month first',
    hint: 'month and day flipped: booking-v3 hint says MM/DD, form reads DD/MM',
    'one-day-move': 'date moved by one day, no month flipped',
    unplaced: 'no tenant on file',
  };
</script>

<p class="sum">
  <strong>{total}</strong> reports in #{ticket} · <strong>{rows.length}</strong>
  {rows.length === 1 ? 'problem' : 'problems'} · intake tagged <strong>{wrongTags}</strong> of them as the other cause
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>what people saw</th><th>came in by</th><th>tenants</th><th>seen</th><th>ticket</th></tr>
  </thead>
  <tbody>
    {#each rows as r (r.problem)}
      <tr>
        <td><code>{r.problem}</code></td>
        <td><strong>{r.reports.length}</strong></td>
        <td>{WHAT[r.problem]}</td>
        <td class="tags">{list(r.channels)}</td>
        <td>{r.tenants}</td>
        <td>{r.firstSeen} → {r.lastSeen}</td>
        <td>{#if issues[r.problem]}<a href={issues[r.problem]}>filed</a>{:else}not filed{/if}</td>
      </tr>
    {/each}
  </tbody>
</table>

{#each rows as r (r.problem)}
  {#if r.problem === 'one-day-move'}
    <p class="note">one-day-move: {r.reports.map((x) => x.id).join(', ')} — the desk's own notes name them.</p>
  {/if}
{/each}

<style>
  .sum { font-size: 1.1rem; }
  .tags, .note { color: var(--muted); font-size: 0.85em; }
</style>
