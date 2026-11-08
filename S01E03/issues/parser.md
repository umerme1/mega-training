## Problem

The shared date parser reads every date **month first**. Every tenant on file writes the **day first** (`dayFirst()` in `src/lib/kb/causes.ts` asks the platform per locale: en-GB, en-IE, de-DE, fr-FR, nl-NL, it-IT, es-ES, pt-PT, pl-PL, cs-CZ, da-DK). So a date typed in the app, sent by email, or entered in the **booking-v2** form as `07/04` means 7 April to the tenant and 4 July to the parser. Day and month swap whenever the day is 12 or less.

## Reports it covers: **379**

Of the 412 unique reports merged into #4471 (427 rows in the export, 15 duplicated by overlapping export pages; deduplicated by id as `uniqueById` does), 379 are this problem as the desk counts it: every report **not** from a booking-v3 tenant's form. Five of them (R-41202, R-41209, R-41236, R-41344, R-41620) the desk's notes read as a one-day move; they stay counted here, where the desk filed them, and have their own ticket for that distinct problem.

| channel | reports |
|---|---|
| app | 204 |
| email | 150 |
| form | 25 |

| tenant | reports |
|---|---|
| harbour.dental | 52 |
| kettle.books | 47 |
| nine.lanterns | 44 |
| morrow.tax | 40 |
| long.table | 39 |
| ridge.clinic | 36 |
| stone.and.sons | 30 |
| lantern.row | 28 |
| alder.physio | 23 |
| pale.harbour | 21 |
| copper.studio | 19 |

First seen 2026-04-01, last seen 2026-10-04. Intake tag: parser x356, hint x23 — 23 were tagged `hint` by the reporter's browser locale, which is a guess, not the cause.

## How to tell it from the others

`causeOf(report, tenant)` returns `parser` for a day-first tenant unless the report came in by `form` from a `booking-v3` tenant. The symptom (a flipped month) is identical to #{hint}; the place to fix is different.

## Evidence

- R-41200 harbour.dental, app: "Our 7 April reminder went out on 4 July."
- R-41203 lantern.row, app: "Booked for 2 December. The invite says 12 February."
- R-41290 long.table, app: "Is there a setting for \"my country writes the day first\"."

Source: `kb-export` (support repo, exported 2026-10-04), `src/lib/data/reports-4471.json`, tenant files, `src/lib/kb/causes.ts`. The kb page: `src/routes/kb/incidents/4471-what-it-shows/+page.svx`.
