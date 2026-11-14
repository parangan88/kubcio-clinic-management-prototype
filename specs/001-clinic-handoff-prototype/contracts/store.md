# Contract: Store (`src/store/store.ts`)

The only module that touches localStorage. Screens import selector hooks and actions from here and
never read raw state (Constitution II, V). View types are listed in
[data-model.md](../data-model.md#role-view-types-what-each-selector-may-return).

## Lifecycle

| Function | Behaviour | AC / scenario |
| --- | --- | --- |
| `initStore(today?)` | Load saved state from `kubcio:state:v1` if valid, else load seed shifted to `today` (R-07, R-08) | S-13 |
| `resetDemo(today?)` | Remove saved state, reload seed. Confirmation happens in the UI before calling | AC-30.1, S-14 |
| `useStore(selector)` | React hook via `useSyncExternalStore` | — |

Every action validates input, applies the change, saves, and notifies. Invalid input or an illegal
status move throws a typed `StoreError` with a field-level message; the screen shows it beside the field.

## Actions

| Action | Effect | AC |
| --- | --- | --- |
| `checkIn(visitId, reason, now?)` | Requires non-empty reason; status → checked_in; sets confirmedReason, checkedInAt; bookedReason untouched | AC-02.1–02.3 |
| `searchPatients(query)` | Name search (reception-safe fields only) | AC-03.1 |
| `registerWalkIn({ patientId } \| { name, dateOfBirth, phone }, reason, now?)` | Creates patient if needed; visit walkIn=true, status checked_in | AC-03.1–03.2 |
| `saveIntake(visitId, input, now?)` | Parses vitals; non-numeric → field error, nothing saved; patientReport required; status → ready_for_physician; recordedAt | AC-06.1–06.3, S-04 |
| `openVisit(visitId)` | status → with_physician | AC-08.1 |
| `saveNote(visitId, text, today?)` → `EligibilityChange[]` | Physician note on the visit | AC-09.1–09.2 |
| `createOrder(visitId, test, reason)` | Both required; status pending | AC-10.1 |
| `createTask(input, today?)` | Timing: `{ date }`, `{ inDays }` → date, or `{ afterOrderId, offsetDays }` → waiting (or open, OQ-11) | AC-11.1–11.3, AC-17.2 |
| `finishVisit(visitId)` | status → checkout | AC-12.1 |
| `markTaskDone(taskId)` | open → done | AC-14.1 |
| `markLeft(visitId)` | status → done; waiting tasks untouched | AC-14.2 |
| `simulateResult(orderId, value, now?)` | pending → resulted, resultedAt = now | AC-29.1 |
| `reviewResult(orderId, note, now?)` → `EligibilityChange[]` | resulted → reviewed; writes physician Note (OQ-02); opens waiting tasks with due = review date + offset | AC-17.1, AC-18.1–18.2, AC-19.2 |
| `decideStudy(patientId, studyId, decision, now?)` | approve only if outcome is meets or needs_review and patient not opted out or declined | AC-21.2, AC-22.1–22.2 |
| `logCall(patientId, studyId, { reached, result }, now?)` | Appends attempt; declined/consented set outcome | AC-25.1–25.3 |
| `setOptOut(patientId, value)` | Reception or physician | AC-27.1 |

`EligibilityChange = { patientId, studyId, from: Outcome, to: Outcome }`; only returned, never stored
(R-10).

## Selectors

| Role | Selector | Returns | AC |
| --- | --- | --- | --- |
| Reception | `selectExpectedToday(today)` | `ReceptionVisitRow[]` sorted by time | AC-01.1–01.3, AC-04.1 |
| Reception | `selectCheckoutList()` / `selectCheckoutCard(visitId)` | name, phone, open + waiting tasks (waiting labelled "after result, date to be set") | AC-12.1, AC-13.1–13.3 |
| Reception | `selectReceptionTasks(today)` | open by due date, then waiting; `overdue` flag | AC-15.1–15.2, AC-18.3 |
| Reception | `selectOutreachList(today)` | approved, outcome none, not opted out, not declined, current outcome ≠ does_not_meet (OQ-10) | AC-22.3, AC-24.1–24.2, AC-26.2, AC-27.2 |
| Nurse | `selectNurseQueue()` | checked_in by checkedInAt, with confirmedReason | AC-05.1–05.2 |
| Nurse | `selectNurseIntake(visitId)` | history read-only, no physician notes (OQ-01) | AC-06.4 |
| Physician | `selectReadyForPhysician(now)` | ready_for_physician, reason, minutes waiting | AC-07.1 |
| Physician | `selectVisitSummary(visitId, today)` | reason, today's observation, active diagnoses, 3 most recent notes, results awaiting review, eligibility per study, decline/opt-out flags | AC-08.2–08.3, AC-26.1 |
| Physician | `selectResultsInbox(today)` | resulted orders oldest first, with `studyNeedsReview` flag | AC-16.1, AC-19.2 |
| Physician | `selectResultsCount()` | number for the nav badge | AC-16.2 |
| Physician | `selectCandidates(studyId, today)` | meets + needs_review (needs_review first), excluding not_eligible decisions; flags for opt-out/declined, `canApprove` | AC-21.1–21.2, AC-22.2 |
| Physician | `selectEligibility(patientId, today)` | `EligibilityResult[]` | AC-20.1–20.3 |
| Physician | `selectPendingOrders()` | for the "simulate result" control (OQ-09) | AC-29.1 |

## Guarantees (each is a test in `store.test.ts`)

- Recursive key scan of every reception selector's output finds none of: `observation(s)`, `bp*`,
  `weightKg`, `tempC`, `patientReport`, `notes`, `text`, `diagnos*`, `orders`, `test`, `value`,
  `reasonOrdered`, `reviewNote`, `eligibility`, `outcome` (study outcome), `evidence` (S-05).
- Nurse selectors contain no physician-authored note text, orders or eligibility.
- S-06, S-08, S-11, S-12 as unit tests.
- Saving then re-initialising from the same localStorage returns equal state (S-13, automated half).
