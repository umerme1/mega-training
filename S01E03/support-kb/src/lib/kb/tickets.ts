// How #4471 splits into tickets. Pages explain it; this file is what runs.
//
// The desk's view, as exported: causes.ts tells `parser` from `hint` by tenant and channel, and
// every report is counted under its cause. The desk's notes (desk-notes.json) name the reports it
// read as a one-day move: the date moved by a day, not a month flipped. CauseTable counts them
// where they are filed and footnotes them. This file keeps that count and gives the one-day move
// a row of its own as well, so it can have a ticket: its reports are a subset of their cause row.
import { groupByCause, readAs, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'one-day-move' | 'unplaced';

export type TicketRow = {
  problem: Problem;
  reports: Report[];
  // For one-day-move: the cause rows its reports are also counted under.
  within: Problem[];
  tenants: number;
  channels: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
  // How intake tagged them (meta.intakeTag): tag → count. Shows how often the guess was wrong.
  taggedAs: Record<string, number>;
};

function row(problem: Problem, reports: Report[], within: Problem[] = []): TicketRow {
  const days = reports.map((r) => r.receivedAt.slice(0, 10)).sort();
  const count = (key: (r: Report) => string) =>
    reports.reduce<Record<string, number>>((n, r) => ({ ...n, [key(r)]: (n[key(r)] ?? 0) + 1 }), {});
  return {
    problem,
    reports,
    within,
    tenants: new Set(reports.map((r) => r.tenant)).size,
    channels: count((r) => r.channel),
    firstSeen: days[0],
    lastSeen: days[days.length - 1],
    taggedAs: count((r) => r.meta.intakeTag),
  };
}

// One row per cause, counted as the desk counts, then one row for the one-day move.
export function splitTicket(
  reports: Report[],
  ticket: number,
  oneDayMove: readonly string[],
  tenantOf: (r: Report) => Tenant | undefined,
): TicketRow[] {
  const merged = uniqueById(reports).filter((r) => r.mergedInto === ticket);
  const groups = groupByCause(merged, tenantOf);
  const rows = groups.map((g) => row(g.cause, g.reports));
  const moved = merged.filter((r) => oneDayMove.includes(r.id));
  if (moved.length) rows.push(row('one-day-move', moved, groups.filter((g) => readAs(g, oneDayMove) > 0).map((g) => g.cause)));
  return rows;
}

// Reports whose intake tag names a different cause than the tenant and channel do.
export function mistagged(rows: TicketRow[]): number {
  return rows
    .filter((r) => r.problem === 'parser' || r.problem === 'hint')
    .reduce((n, r) => n + r.reports.filter((x) => x.meta.intakeTag !== r.problem).length, 0);
}
