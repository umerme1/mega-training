## Problem

Three tenants run the **booking-v3** form: alder.physio, copper.studio, pale.harbour. That form prints **`MM/DD/YYYY`** under its date field, so their people type the month first, as told. The form then reads the value the tenant's way, **day first**. The result is the same flipped month as the parser bug, but the cause is the form hint, and the parser fix queued for #4471 does not touch it.

## Reports it covers: **33**

Every report that came in by `form` from a booking-v3 tenant (`causeOf()` in `src/lib/kb/causes.ts` returns `hint`). None of these are in the desk's one-day-move notes.

| tenant | reports |
|---|---|
| alder.physio | 12 |
| copper.studio | 11 |
| pale.harbour | 10 |

Channel: form x33. First seen 2026-04-17, last seen 2026-09-22. Intake tag: hint x18, parser x15 — 15 were tagged `parser` by browser locale and would have been missed by the tag.

## How to tell it from the others

Tenant form is `booking-v3` **and** channel is `form`. Reports from the same tenants through app or email are the parser problem, not this one.

## Evidence

- R-41230 copper.studio, form: "My client came on 1 June instead of 6 January."
- R-41241 alder.physio, form: "We had two people show up on 8 June. They were booked for 6 August."
- R-41251 pale.harbour, form: "Wednesday 7 January showed as Wednesday 1 July."

Source: `kb-export` (support repo, exported 2026-10-04), `src/lib/data/reports-4471.json`, `src/lib/data/tenants/*.json`, `src/lib/kb/causes.ts`. The kb page: `src/routes/kb/incidents/4471-what-it-shows/+page.svx`.
