---
id: SCHED-4515
title: Ack leaves the row — a row opens its incident panel, Ack lives there
status: ready
plan: R2, R7
---

Product's decision after the step-1 report (ack race at 00:09: a click meant for INC-1831 acked INC-1254 when
INC-5435 landed at the top): "New incidents stay live at the top. Ack leaves the row: a row opens its incident
panel, and Ack lives there."

- Clicking a row (or Enter on it) opens the incident panel (`data-testid="incident-panel"`), which names the
  incident id and its details. The row has no Ack button any more.
- The panel's **Ack** (`data-testid="panel-ack"`) acks the panel's incident, never the row under the pointer,
  and marks that row acked (`data-testid="acked"`).
- Rows update in place: a new incident is inserted at the top, existing rows keep their nodes and never leave
  the board while it is open (R7).

Acceptance: a new incident landing while a person clicks cannot change which incident gets acked; the panel
always names the incident the person picked; acking from the panel marks exactly that row.
