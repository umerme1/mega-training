## Problem

These reports are **not a month flip**. The date moved by **one day**, an invite arrived before its booking, or two people in two time zones got two different days for one meeting. The desk read them as a one-day move and listed them in `src/lib/data/desk-notes.json` (`oneDayMove`), then counted them under `parser` anyway with a footnote. They point at a day-boundary or time-zone problem, and the parser fix will not change them.

## Reports it covers: **5**

| tenant | reports |
|---|---|
| kettle.books | 1 |
| alder.physio | 1 |
| nine.lanterns | 1 |
| pale.harbour | 1 |
| lantern.row | 1 |

Channels: email x3, app x2. First seen 2026-04-02, last seen 2026-10-04. All five were merged into #4471 on subject line alone.

## The reports

- R-41202 kettle.books, email, 2026-04-02: "Invite says Tuesday 12 May. Calendar says Monday 11 May. My client turned up on the Monday. We had coffee."
- R-41209 alder.physio, app, 2026-04-06: "Every booking in June is one day off. Only June. Why only June."
- R-41236 nine.lanterns, app, 2026-04-20: "The invite arrived before I made the booking. I would like to know how."
- R-41344 pale.harbour, email, 2026-06-12: "Client in Lisbon got Tuesday. Client in Toronto got Monday. Same meeting. We held it twice."
- R-41620 lantern.row, email, 2026-10-04: "Tuesday 6 October showed as Monday. I moved it myself. I have stopped reporting these but my colleague says it helps you."

## How to tell it from the others

The two dates differ by one day (or one is missing), not by swapping day and month. Every other report in #4471 with two dates is an exact day/month swap; these are the only ones that are not.

Source: `kb-export` (support repo, exported 2026-10-04), `src/lib/data/reports-4471.json`, `src/lib/data/desk-notes.json`. The kb page: `src/routes/kb/incidents/4471-what-it-shows/+page.svx`.
