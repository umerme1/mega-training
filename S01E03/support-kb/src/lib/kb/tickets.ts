// How #4471 splits into tickets. Pages explain it; this file is what runs.
//
// causes.ts tells `parser` from `hint` by tenant and channel. The desk's notes (desk-notes.json)
// name the reports it read as a one-day move: the date moved by a day, not a month flipped. Those
// are a third problem. CauseTable counts them under their cause and footnotes them; here they are
// taken out and given a row of their own, so every report is counted once, under one problem.
import { groupByCause, uniqueById, type CauseGroup, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'one-day-move' | 'unplaced';

export type TicketRow = {
  problem: Problem;
  reports: Report[];
  tenants: number;
  channels: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
  // How intake tagged them (meta.intakeTag): tag → count. Shows how often the guess was wrong.
  taggedAs: Record<string, number>;
};

function row(problem: Problem, reports: Report[]): TicketRow {
  const days = reports.map((r) => r.receivedAt.slice(0, 10)).sort();
  const count = (key: (r: Report) => string) =>
    reports.reduce<Record<string, number>>((n, r) => ({ ...n, [key(r)]: (n[key(r)] ?? 0) + 1 }), {});
  return {
    problem,
    reports,
    tenants: new Set(reports.map((r) => r.tenant)).size,
    channels: count((r) => r.channel),
    firstSeen: days[0],
    lastSeen: days[days.length - 1],
    taggedAs: count((r) => r.meta.intakeTag),
  };
}

// One row per problem found in the ticket. Reports named in `oneDayMove` leave their cause group.
export function splitTicket(
  reports: Report[],
  ticket: number,
  oneDayMove: readonly string[],
  tenantOf: (r: Report) => Tenant | undefined,
): TicketRow[] {
  const merged = uniqueById(reports).filter((r) => r.mergedInto === ticket);
  const moved = merged.filter((r) => oneDayMove.includes(r.id));
  const rest = merged.filter((r) => !oneDayMove.includes(r.id));
  const groups: CauseGroup[] = groupByCause(rest, tenantOf);
  const rows = groups.map((g) => row(g.cause, g.reports));
  if (moved.length) rows.push(row('one-day-move', moved));
  return rows.sort((a, b) => b.reports.length - a.reports.length);
}

// Reports whose intake tag names a different cause than the tenant and channel do.
export function mistagged(rows: TicketRow[]): number {
  return rows
    .filter((r) => r.problem === 'parser' || r.problem === 'hint')
    .reduce((n, r) => n + r.reports.filter((x) => x.meta.intakeTag !== r.problem).length, 0);
}
