# Data Model: Kubcio Clinic Prototype

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-14

Types live in `src/domain/types.ts`. The ten entities come from the spec's Key Entities; additions are
marked **(added)** with the research item that justifies them. Dates are `YYYY-MM-DD` strings,
timestamps are full ISO strings (R-06). Units are metric: kg, °C, mmHg.

## Persisted state

```text
ClinicState
  schemaVersion: 1
  seedDate: date                     (added, R-07) date the seed was authored against
  patients, visits, observations, notes, diagnoses, orders, tasks,
  studies, studyDecisions, outreach: arrays of the entities below
```

`seed.json` has the same shape. Eligibility is never stored (Constitution III).

## Entities

### Patient

| Field | Type | Rules |
| --- | --- | --- |
| id | string | unique |
| name | string | required |
| dateOfBirth | date \| null | null allowed (M-19) |
| phone | string | required (AC-03.1) |
| studyCallOptOut | boolean | default false; blocks all outreach (AC-27) |

### Visit

| Field | Type | Rules |
| --- | --- | --- |
| id, patientId | string | patientId → Patient |
| date | date | |
| time | string `HH:MM` \| null | null for walk-ins |
| bookedReason | string \| null | kept unchanged after check-in (AC-02.3) |
| confirmedReason | string \| null | required to check in (AC-02.2, AC-03.2) |
| walkIn | boolean | |
| status | VisitStatus | see transitions |
| checkedInAt | timestamp \| null | **(added, OQ-08)** set on check-in; nurse queue order (AC-05.1) |

**VisitStatus transitions** (only these moves are allowed; anything else is rejected by the store):

```text
expected ──checkIn──▶ checked_in ──saveIntake──▶ ready_for_physician ──openVisit──▶ with_physician
                                                                                       │
done ◀──markLeft── checkout ◀──finishVisit─────────────────────────────────────────────┘
registerWalkIn creates a visit directly in checked_in (AC-03.2)
```

### Observation

| Field | Type | Rules |
| --- | --- | --- |
| visitId | string | one per visit |
| bpSystolic, bpDiastolic | number \| null | optional; non-numeric input rejected (AC-06.2) |
| weightKg, tempC | number \| null | optional; non-numeric input rejected |
| patientReport | string | required, non-empty (AC-06.1) |
| recordedAt | timestamp | set on save (AC-06.3); start of "time waiting" (OQ-08) |

### Note

| Field | Type | Rules |
| --- | --- | --- |
| id, patientId | string | |
| visitId | string \| null | null for historical seed notes |
| date | date | |
| authorRole | `'physician' \| 'nurse'` | the matcher reads `physician` only |
| text | string | required |

A result review also writes a physician Note (OQ-02).

### Diagnosis

| Field | Type | Rules |
| --- | --- | --- |
| id, patientId | string | |
| label | string | e.g. "Type 2 diabetes mellitus" |
| status | `'active' \| 'resolved'` | |
| recordedOn | date | shown as evidence date (AC-20.2) |

### Order

| Field | Type | Rules |
| --- | --- | --- |
| id, patientId, visitId | string | |
| test | string | required (AC-10.1) |
| reasonOrdered | string | required (AC-10.1) |
| status | `'pending' \| 'resulted' \| 'reviewed'` | pending → resulted (AC-29.1) → reviewed (AC-17.1) |
| value | string \| null | set when resulted |
| resultedAt, reviewedAt | timestamp \| null | |
| reviewNote | string \| null | required to review |

### Task

| Field | Type | Rules |
| --- | --- | --- |
| id, patientId | string | |
| visitId | string \| null | |
| assignee | `'reception'` | only reception tasks exist |
| action | string | required free text (AC-11.1) |
| dueType | `'date' \| 'after_result'` | "in N days" is stored as `date` = today + N (S-06) |
| dueDate | date \| null | null while waiting |
| waitsOnOrderId | string \| null | set when dueType is after_result |
| offsetDays | number \| null | N for after_result tasks |
| status | `'waiting' \| 'open' \| 'done'` | waiting → open on review (AC-18.1), open → done (AC-14.1) |

On `reviewResult(order)`: every task with `waitsOnOrderId = order.id` and status `waiting` becomes
`open` with `dueDate = reviewDate + offsetDays` (AC-18.2). A task created during review that waits on
the order being reviewed is created `open` directly (OQ-11).

### Study

| Field | Type | Rules |
| --- | --- | --- |
| id, name | string | seeded: "Adults with documented diabetes" (AC-23.2) |
| criteria | Criterion[] | `{ kind: 'minAge', years: 18 }`, `{ kind: 'diagnosis', condition: 'diabetes' }` (R-14) |

### StudyDecision

| Field | Type | Rules |
| --- | --- | --- |
| patientId, studyId | string | at most one current decision per pair |
| decision | `'approve_contact' \| 'not_eligible'` | approve only for meets or needs review (AC-22.1) |
| decidedBy | `'physician'` | role name; there is no login |
| decidedAt | timestamp | |

### Outreach

| Field | Type | Rules |
| --- | --- | --- |
| patientId, studyId | string | |
| attempts | `{ at: timestamp, reached: boolean, result: 'declined' \| 'consented' \| 'call_back_later' \| null }[]` | result only when reached (AC-25.2) |
| outcome | `'none' \| 'declined' \| 'consented'` | set from the latest reached attempt; declined is permanent (AC-26.2) |

## Derived values (computed on demand, never stored)

| Value | Computed by | Used by |
| --- | --- | --- |
| `EligibilityResult` per patient × study | `evaluateStudy` in `src/domain/eligibility.ts` | physician badge, study panel, candidates, outreach filter (OQ-10), inbox flag |
| Age | `ageOn(dateOfBirth, today)` in `src/domain/dates.ts` | age criterion |
| Overdue | `task.status === 'open' && dueDate < today` | AC-15.2 |
| Time waiting | `now − observation.recordedAt` | AC-07.1 |

## Role view types (what each selector may return)

Defined in `src/store/store.ts` next to the selectors. Reception and nurse types are built by explicit
field picking (R-05).

| View | Fields | Forbidden (tested by S-05 and the nurse equivalent) |
| --- | --- | --- |
| `ReceptionVisitRow` | visitId, patientId, name, phone, time, bookedReason, confirmedReason, status, walkIn | observations, notes, diagnoses, orders, results, eligibility |
| `ReceptionTask` | id, patientId, name, phone, action, status, dueDate, overdue, label ("after result, date to be set") | order test, value, reason, review note |
| `ReceptionOutreachRow` | patientId, name, phone, studyId, studyName, attempts (at, reached, result) | eligibility outcome, evidence, any clinical field |
| `ReceptionStudyFlags` | patientId, optOut, declinedStudyIds | outcome, evidence |
| `NurseQueueItem` / `NurseIntakeView` | visit, patient contact, reason, prior observations, diagnoses, nurse-authored notes | physician notes (OQ-01), orders, results, eligibility |
| `PhysicianVisitView` etc. | everything in the visibility table's physician column | — |

## Seed contents (Phase 2)

Generated with AI at build time, then reviewed before commit (Constitution I). Must contain:

- Meera Sen with today's expected visit (booked reason "Tiredness, thirst") and an older physician note
  containing "?diabetes" (demo steps 1–3).
- One patient per matcher case M-01 to M-20, ids `m-01` … `m-20`, chart data exactly as in the spec
  table (AC-30.2). A test checks each seeded patient's outcome against the table (SC-005).
- 3–5 more expected visits today, one with no booked reason (S-02).
- An opted-out patient and a patient who declined the study, both meeting it (demo step 10).
- At least one open overdue reception task and one waiting task from an earlier visit (AC-15).
- The single study from AC-23.2.
- `seedDate` set to the authoring date (R-07); the M-05 note dated mid-2021.
