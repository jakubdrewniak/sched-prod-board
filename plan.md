# sched-prod incident board — plan

The on-call board for sched-prod. One page, one list: tonight's incidents, newest first, so on-call sees
what just broke and takes it.

## Flows

| flow | who | what happens |
|------|-----|--------------|
| `open-board` | on-call | opens the board; sees tonight's incidents |
| `ack-incident` | on-call | picks an incident on the board, which opens its panel, and acks it there — "I've got this one" |
| `watch-board` | on-call | keeps the board open; it stays current without a reload |

## Requirements

- **R1** New incidents appear live at the top of the list, newest first.
- **R2** Clicking an incident row (or Enter on it) opens that incident's **panel**, which names the incident id. The
  panel's **Ack** sends the ack for the incident the panel names (`api.ack(id)`) and marks the panel and the row acked.
  Rows have no Ack button. *(Changed by product after the step-one recording, 00:10: with Ack on the row, a new
  incident landing at the top moved another row under the pointer and the click acked INC-2784 instead of
  INC-8367. Product's decision: "New incidents stay live at the top. Ack leaves the row: a row opens its incident
  panel, and Ack lives there.")*
- **R3** Show a loader until incidents load.
- **R4** The board refreshes itself every 2 seconds while open.
- **R5** Times show in the viewer's local time; day before month for EU locales (dd/mm).
- **R6** The page names its build: `<meta name="build" content="<git sha>">` in the head and the same sha in the footer.

## Hooks (pinned — tests and the replay rely on them)

| `data-testid` | element |
|---------------|---------|
| `board` | the board's main area |
| `loader` | the loader (gone once incidents load) |
| `empty` | what shows when there are no incidents |
| `incident-list` | the list |
| `incident-row` | one incident row, with `data-id="<incident id>"`; click or Enter opens its panel |
| `incident-panel` | the incident panel, naming the incident id (`data-id` too) |
| `panel-ack` | the Ack button in the panel |
| `acked` | the acked mark, in a row and in the panel |

`ack` (the Ack button in a row) is retired with R2's change.
| `build-sha` | the sha in the footer |

## Done

Every issue in `issues/` delivered, deployed to a public https address, and shown working.
