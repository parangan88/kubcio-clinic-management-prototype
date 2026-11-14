---

description: "Task list for the Kubcio clinic prototype"
---

# Tasks: Kubcio Clinic Prototype

**Input**: Design documents from `specs/001-clinic-handoff-prototype/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Domain-logic tests are mandatory and written before the code they test (Constitution IV).
The eligibility tests are the first tasks in this file. UI tests exist only where the spec names them
(S-02, S-04).

**Organization**: Grouped by the plan's six delivery phases. Each task is tagged with the user
stories it serves (`[US-xx]`) and lists the acceptance criteria it covers. Setup-only tasks have no
story tag.

## Format: `- [ ] T### [P?] [US-xx] Description (AC IDs) in file`

- **[P]**: can run in parallel (different file, no dependency on an unfinished task)
- **[US-xx]**: user story IDs from spec.md, unchanged
- AC IDs are written out in full, never as ranges, so they can be searched

## Conventions for every task

- Test names start with their ID: `it('M-07 mother has type 2 diabetes → does_not_meet', ...)`,
  `it('S-05 ...')`, `it('AC-18.2 ...')`.
- Import `describe`, `it`, `expect` from `vitest` (no globals; research R-03).
- Domain functions and store actions take `today`/`now` as a parameter (R-06).
- Screens import only selectors, `useStore` and actions from `src/store/store.ts`; never localStorage.
- When a research.md OQ default is implemented, add one line to `DECISIONS.md`:
  `OQ-xx: <choice> — <reason>` (Constitution VI).
- Commit messages cite the US/AC IDs delivered, e.g. `US-18: waiting tasks open on review (AC-18.1, AC-18.2)`.

---

## Phase 1: Matcher + tests

**Purpose**: The eligibility matcher, test-first. Matcher tests are written and seen failing before
`eligibility.ts` exists.

**Rules to implement**: [research.md](./research.md) R-12 (sentence classes), R-13 (outcome order),
R-14 (criteria as data); interface in [contracts/eligibility.md](./contracts/eligibility.md).

### Eligibility tests (first, must fail)

- [X] T001 [US-20] Create `src/domain/eligibility.test.ts` with a `chart()` fixture builder (patient with dateOfBirth default 40 years before `TODAY = '2026-11-14'`, empty diagnoses/notes/orders, helper `note(text, date, authorRole = 'physician')`), the diabetes study fixture `{ id: 'diabetes', criteria: [{ kind: 'minAge', years: 18 }, { kind: 'diagnosis', condition: 'diabetes' }] }`, and tests M-01 to M-05 (meets): assert outcome `meets`, M-01 evidence is `{ type: 'diagnosis', label: 'Type 2 diabetes mellitus', status: 'active' }` with its date, M-02 to M-05 evidence quotes the exact sentence with the note date, M-05 evidence date in 2021 (AC-20.1, AC-20.2) in src/domain/eligibility.test.ts
- [X] T002 [US-20] Add tests M-06 to M-10 (does_not_meet: prediabetes, mother, family history, "No history of diabetes.", "Denies diabetes or hypertension.") asserting outcome `does_not_meet` for the diagnosis criterion and the study (AC-20.1) in src/domain/eligibility.test.ts
- [X] T003 [US-20] Add tests M-11 to M-17: M-11 needs_review with reason "conflicting chart"; M-12 gestational, M-13 "?diabetes, HbA1c ordered.", M-14 "Started metformin." each needs_review with a reason evidence item; M-15 pending HbA1c and M-16 resulted-not-reviewed HbA1c needs_review with `{ type: 'order' }` evidence; M-17 does_not_meet with `{ type: 'reason', text: 'no evidence found' }` (AC-20.1, AC-20.2) in src/domain/eligibility.test.ts
- [X] T004 [US-20] Add tests M-18 (age 16 + T2DM → does_not_meet on age), M-19 (dateOfBirth null + T2DM → needs_review, age evidence `years: null`, never does_not_meet), M-20 (18th birthday is TODAY → meets) (AC-20.1, AC-20.3) in src/domain/eligibility.test.ts
- [ ] T004a [US-20, US-23] Deferred from T004 (user scoped the Phase 1 run to M-01–M-20). Add contract guarantees: nurse-authored diabetes note is ignored; unknown condition `'asthma'` → needs_review "no rules defined for asthma"; every criterion result has non-empty evidence; OQ-03 "Diabetes not well controlled." → meets; OQ-04 diagnosis-list T2DM plus "?diabetes" note → meets; OQ-06 resolved "Type 2 diabetes mellitus" only → needs_review; demo sentence "HbA1c confirms type 2 diabetes." → meets (AC-20.1, AC-20.2, AC-20.3, AC-23.1) in src/domain/eligibility.test.ts

### Test runner setup (so the tests run red)

- [X] T005 Configure Vitest in `vite.config.ts` (add `/// <reference types="vitest/config" />`, `test: { environment: 'jsdom', setupFiles: ['src/test/setup.ts'] }`), create `src/test/setup.ts` importing `@testing-library/jest-dom/vitest`, add `"test": "vitest run"` and `"test:watch": "vitest"` to package.json; run `npm test` and confirm T001–T004 fail (module not found) in vite.config.ts
- [X] T006 Create `DECISIONS.md` with a one-line header and the first entries: "React 19 from current Vite template instead of React 18 (plan Complexity Tracking)", "Matcher is rule-based, not AI: static app, must be explainable", "Unclear diabetes mention → needs review (R-12 class 7)", "Unknown study condition → needs review (R-14)" in DECISIONS.md

### Matcher implementation (make the tests pass)

- [X] T007 [P] Create entity and enum types from data-model.md (Patient, Visit with VisitStatus and checkedInAt, Observation, Note, Diagnosis, Order, Task, Study with Criterion union, StudyDecision, Outreach with attempts, ClinicState with schemaVersion and seedDate) and eligibility types from contracts/eligibility.md (Outcome, EligibilityResult, CriterionResult, Evidence, PatientChart) in src/domain/types.ts
- [X] T008 [P] Create pure date helpers `ageOn(dob, today): number | null`, `addDays(date, n)`, `daysBetween(a, b)`, `isBefore(a, b)`, `todayIso(now)` using UTC date arithmetic on `YYYY-MM-DD` strings in src/domain/dates.ts
- [X] T009 [US-20, US-23] Implement `splitSentences`, `classifySentence` (R-12 classes in order: family, prediabetes, denial-before-term or "ruled out", gestational, uncertain, positive, unclear; mention regex `(pre-?)?diabet\w*|T1DM|T2DM|IDDM|NIDDM`), diabetes-medication detection (OQ-05 list), diagnosis-label classification, and the diabetes criterion per R-13 order, filtering notes to `authorRole === 'physician'` (AC-20.1, AC-20.2, AC-20.3) in src/domain/eligibility.ts
- [X] T010 [US-20, US-23] Implement the age criterion (`ageOn`, null → needs_review with `{ type: 'age', years: null }`), criterion dispatch by `kind` with a condition vocabulary table (only `diabetes`; unknown → needs_review "no rules defined for <condition>"), outcome combination (any does_not_meet → does_not_meet, else any needs_review → needs_review, else meets), and exported `evaluateStudy` / `evaluateAllStudies`; run `npm test` until T001–T004 are green (AC-20.1, AC-20.3, AC-23.1) in src/domain/eligibility.ts
- [X] T011 Add OQ-03, OQ-04, OQ-05, OQ-06 lines to DECISIONS.md, matching research.md in DECISIONS.md

### Styling setup (not blocking the matcher)

- [X] T012 [P] (done in Phase 3) Add `tailwindcss()` from `@tailwindcss/vite` to plugins in `vite.config.ts`, replace `src/index.css` contents with `@import "tailwindcss";`, delete `src/App.css` and `src/assets/`, reduce `src/App.tsx` to a placeholder heading, and confirm `npm run build` passes in vite.config.ts

**Checkpoint**: M-01 to M-20 and the contract extras are green.

---

## Phase 2: Store + seed data

**Purpose**: Seed file, single store module with role selectors, and the tests that guard visibility.
Ends at **Gate 1**: no screen work before this phase is green.

**Interface**: [contracts/store.md](./contracts/store.md). **Seed contents**: data-model.md "Seed contents".

- [X] T013 [P] [US-23, US-30] Generate synthetic `seed.json` (`schemaVersion: 1`, `seedDate: '2026-11-14'`) with: Meera Sen (expected today 09:30, booked reason "Tiredness, thirst", phone, an older physician note containing "?diabetes"); patients `m-01`…`m-20` with chart data exactly as the spec's M table (M-05 note dated 2021-06-15; M-15 pending HbA1c; M-16 resulted unreviewed HbA1c; M-19 dateOfBirth null; M-20 18th birthday on seedDate; M-18 aged 16); 3–5 more visits today, one with `bookedReason: null`; one opted-out patient and one patient with a declined outreach, both meeting the study; one open overdue reception task and one waiting task from an earlier visit; the single study "Adults with documented diabetes" with minAge 18 and diagnosis diabetes only; review every name and phone is fictional (AC-23.1, AC-23.2, AC-30.2) in src/data/seed.json

### Store tests (first, must fail)

- [X] T014 [US-01, US-06, US-13, US-24] (reception part done; nurse-selector scan moved to T019a) Create `src/store/store.test.ts` with a fresh-store helper (in-memory localStorage stub, fixed `now`) and test S-05: recursively scan the output of every reception selector (`selectExpectedToday`, `selectCheckoutList`, `selectCheckoutCard`, `selectReceptionTasks`, `selectOutreachList`, `searchPatients`) for the forbidden keys listed in contracts/store.md; scan nurse selectors for physician-note text, orders and eligibility (OQ-01) (AC-01.3, AC-06.4, AC-13.3, AC-24.2) in src/store/store.test.ts
- [X] T015 [US-30, US-20] (seed-consistency part done; date-shift test moved to T019a) Add a seed-consistency test (SC-005): for each `m-xx` patient in seed.json, `selectEligibility` returns the outcome in the spec's M table; and a date-shift test: loading the seed with `today = seedDate + 10` shifts visit dates by 10 days and keeps M-20 exactly 18 (AC-30.2) in src/store/store.test.ts
- [X] T016 (done in Phase 6) [US-02, US-03, US-05, US-06, US-08, US-12, US-14] Add visit-flow tests: checkIn with empty reason throws and changes nothing; checkIn keeps bookedReason and sets confirmedReason, checkedInAt, status checked_in; registerWalkIn creates patient + visit walkIn=true checked_in; saveIntake with weight "abc" throws a field error and saves nothing; patientReport required; saveIntake → ready_for_physician with recordedAt; nurse queue ordered by checkedInAt and drops the patient after intake; illegal status moves throw; markLeft → done and waiting tasks remain (AC-02.1, AC-02.2, AC-02.3, AC-03.1, AC-03.2, AC-05.1, AC-05.2, AC-06.1, AC-06.2, AC-06.3, AC-08.1, AC-12.1, AC-14.1, AC-14.2) in src/store/store.test.ts
- [X] T017 [US-09, US-10, US-11, US-15, US-17, US-18, US-19] (S-06, S-08/AC-18, AC-15 done; OQ-02, OQ-11, createOrder validation, EligibilityChange and inbox tests moved to T019a) Add tasks/results tests: S-06 `createTask({ inDays: 14 })` → open task due today+14, listed by `selectReceptionTasks`; after-result task → waiting, labelled "after result, date to be set" with no result fields; overdue flag; S-08 simulateResult then reviewResult on day D opens the waiting task with due D+7 and reception output has no result details; reviewResult writes a physician note (OQ-02); OQ-11 task created during review on the same order is open; createOrder requires test and reason; saveNote/reviewResult return `EligibilityChange[]` (M-15-style patient: needs_review → meets after "HbA1c confirms type 2 diabetes"); inbox oldest first with `studyNeedsReview` (AC-09.1, AC-09.2, AC-10.1, AC-11.1, AC-11.2, AC-11.3, AC-15.1, AC-15.2, AC-16.1, AC-16.2, AC-17.1, AC-17.2, AC-18.1, AC-18.2, AC-18.3, AC-19.1, AC-19.2) in src/store/store.test.ts
- [X] T018 (done in Phase 5) [US-21, US-22, US-24, US-25, US-26, US-27] Add studies/outreach tests: candidates = meets + needs_review, needs_review first, not_eligible removed; opted-out/declined flagged with `canApprove: false`; decideStudy approve rejected for does_not_meet; no outreach row without approval (AC-22.3); S-11 not reached keeps row, reached+declined removes it and sets the decline flag, patient never returns even if eligibility changes; S-12 opt-out removes from all outreach and outcome still returned by `selectEligibility`; OQ-10 approved patient whose outcome becomes does_not_meet leaves outreach (AC-21.1, AC-21.2, AC-22.1, AC-22.2, AC-22.3, AC-24.1, AC-25.1, AC-25.2, AC-25.3, AC-26.1, AC-26.2, AC-27.1, AC-27.2) in src/store/store.test.ts
- [X] T019 [US-30] Add persistence tests: after an action, re-init from the same storage stub returns equal state (S-13); corrupted JSON or wrong schemaVersion falls back to seed; `resetDemo` removes the key and restores seed (S-14) (AC-30.1) in src/store/store.test.ts

- [X] T019a (all parts done by Phase 6) [US-06, US-09, US-17, US-19, US-30] Deferred store tests from T014, T015, T017 (nurse-selector scan done in Phase 3; OQ-02, OQ-11, EligibilityChange and inbox tests done in Phase 4; remaining: date shift, createOrder validation): ~~nurse selectors contain no physician-note text, orders or eligibility (OQ-01);~~ seed date shift by +10 days keeps M-20 exactly 18; reviewResult writes a physician note (OQ-02); task on an already-reviewed order is open (OQ-11); createOrder requires test and reason; saveNote/reviewResult return the needs_review → meets change for an M-15-style patient; inbox oldest first with studiesNeedingReview (AC-06.4, AC-09.2, AC-10.1, AC-16.1, AC-17.2, AC-19.2, AC-30.2) in src/store/store.test.ts

### Store implementation (make the tests pass)

- [X] T020 [US-30] Implement lifecycle in `store.ts`: load seed with date shift (R-07), load/save `kubcio:state:v1` with schemaVersion check (R-08), `initStore`, `resetDemo`, subscribe/notify, `useStore(selector)` via `useSyncExternalStore`, `StoreError` with `field`, and a status-transition guard per data-model.md; do not export raw state (AC-30.1) in src/store/store.ts
- [X] T021 [US-02, US-03, US-06, US-08, US-09, US-10, US-11, US-12, US-14] Implement visit-flow actions: `checkIn`, `searchPatients`, `registerWalkIn`, `saveIntake` (numeric parsing, field errors), `openVisit`, `saveNote` (returns EligibilityChange[]), `createOrder`, `createTask` (date / inDays / afterOrderId+offsetDays, OQ-11), `finishVisit`, `markTaskDone`, `markLeft` (AC-02.1, AC-02.2, AC-02.3, AC-03.1, AC-03.2, AC-06.1, AC-06.2, AC-06.3, AC-08.1, AC-09.1, AC-09.2, AC-10.1, AC-11.1, AC-11.2, AC-11.3, AC-12.1, AC-14.1, AC-14.2) in src/store/store.ts
- [X] T022 [US-17, US-18, US-19, US-29] Implement `simulateResult` and `reviewResult` (sets reviewed + reviewedAt + reviewNote, writes physician Note per OQ-02, opens waiting tasks with due = review date + offsetDays, returns EligibilityChange[] computed before/after) (AC-17.1, AC-18.1, AC-18.2, AC-19.1, AC-19.2, AC-29.1) in src/store/store.ts
- [X] T023 [US-22, US-25, US-27] Implement `decideStudy` (approve only for meets/needs_review and not opted out/declined; records decidedBy 'physician' and decidedAt), `logCall` (attempt with at, reached, result; declined/consented set outcome), `setOptOut` (AC-22.1, AC-22.2, AC-25.1, AC-25.2, AC-25.3, AC-27.1) in src/store/store.ts
- [X] T024 [US-01, US-04, US-13, US-15, US-24, US-26, US-27] Implement reception selectors by explicit field picking (R-05): `selectExpectedToday`, `selectCheckoutList`, `selectCheckoutCard`, `selectReceptionTasks` (open by dueDate, then waiting; overdue flag; waiting label), `selectOutreachList` (approved, outcome none, not opted out, not declined, current outcome ≠ does_not_meet per OQ-10), `selectReceptionStudyFlags` (AC-01.1, AC-01.3, AC-04.1, AC-13.1, AC-13.2, AC-13.3, AC-15.1, AC-15.2, AC-18.3, AC-24.1, AC-24.2, AC-26.2, AC-27.2) in src/store/store.ts
- [X] T025 [US-05, US-06] Implement nurse selectors `selectNurseQueue` (checked_in by checkedInAt, confirmedReason) and `selectNurseIntake` (contact, reason, prior observations, diagnoses, nurse-authored notes only per OQ-01) (AC-05.1, AC-05.2, AC-06.4) in src/store/store.ts
- [X] T026 [US-07, US-08, US-16, US-19, US-20, US-21, US-26, US-29] Implement physician selectors: `selectReadyForPhysician` (minutes waiting from recordedAt), `selectVisitSummary` (reason, today's observation, active diagnoses, 3 most recent notes, results awaiting review, eligibility per study, decline/opt-out flags), `selectResultsInbox` (oldest first, `studyNeedsReview`), `selectResultsCount`, `selectCandidates`, `selectEligibility`, `selectPendingOrders`; run `npm test` until T014–T019 are green (AC-07.1, AC-08.2, AC-08.3, AC-16.1, AC-16.2, AC-19.2, AC-20.1, AC-21.1, AC-21.2, AC-26.1, AC-29.1) in src/store/store.ts
- [X] T027 Add OQ-01, OQ-02, OQ-07, OQ-08, OQ-10, OQ-11 lines to DECISIONS.md in DECISIONS.md
- [X] T028 (closed in Phase 6: all domain and store tests green) **Gate 1**: run `npx vitest run src/domain src/store`; all green before any screen task starts; record the result in the commit message (e.g. "Gate 1 green: M-01..M-20, S-05, S-06, S-08, S-11, S-12") in src/store/store.test.ts

**Checkpoint**: Gate 1 passed. Visibility is proven at the data layer.

---

## Phase 3: Visit flow E1–E4 (P1, MVP)

**Goal**: An expected patient goes from check-in through intake and the physician visit to checkout,
with reception seeing only contact details, reasons and tasks.

**Independent Test**: S-01 by hand: status moves expected → checked in → ready for physician → with
physician → checkout → done.

- [X] T029 [US-28] Create `RoleSwitcher` (receptionist / nurse / physician select in the header) and rewrite `App.tsx` to hold `role` and `tab` state, call `initStore()` once, reset the tab to the role's first tab on switch, and render `Reception`, `Nurse` or `Physician` (R-09) (AC-28.1) in src/components/RoleSwitcher.tsx and src/App.tsx

### UI tests named in the spec (first, must fail)

- [X] T030 [P] [US-02] Write S-02 test: render the Reception Today tab with a seeded visit that has no booked reason, open check-in, leave reason empty, submit; expect a message beside the field and status still "expected" (AC-02.2) in src/screens/Reception.test.tsx
- [X] T031 [P] [US-06] Write S-04 test: render the Nurse intake for a checked-in visit, type "abc" for weight, fill patient report, save; expect a field error beside weight and the patient still in the queue (AC-06.2) in src/screens/Nurse.test.tsx

### Screens

- [X] T032 [P] [US-01, US-02, US-03, US-04] Build `Reception.tsx` with a tab bar (Today, Checkout, Tasks, Outreach placeholder) and the Today tab: expected list from `selectExpectedToday` with time, name, phone, booked reason, status, checked-in rows styled distinctly; check-in form with reason pre-filled and editable, field error from StoreError; walk-in panel with name search (`searchPatients`) or create (name, date of birth, phone) plus required reason; make T030 pass (AC-01.1, AC-01.2, AC-01.3, AC-02.1, AC-02.2, AC-02.3, AC-03.1, AC-03.2, AC-04.1) in src/screens/Reception.tsx
- [X] T033 [P] [US-05, US-06] Build `Nurse.tsx`: queue from `selectNurseQueue` (arrival time, name, confirmed reason) and intake form (systolic, diastolic, weight kg, temp °C optional; patient report required) with field errors, read-only history from `selectNurseIntake`; save calls `saveIntake`; make T031 pass (AC-05.1, AC-05.2, AC-06.1, AC-06.2, AC-06.3, AC-06.4) in src/screens/Nurse.tsx
- [X] T034 [P] [US-07, US-08] Build `Physician.tsx` with a tab bar (Ready, Visit, Results placeholder, Studies placeholder); Ready tab from `selectReadyForPhysician` (name, reason, minutes waiting); opening a patient calls `openVisit` and shows the Visit tab with confirmed reason, today's observations, active diagnoses, three most recent notes, results awaiting review from `selectVisitSummary` (AC-07.1, AC-08.1, AC-08.2) in src/screens/Physician.tsx
- [X] T035 [US-09, US-10, US-11, US-12] Add to the Visit tab: note form (`saveNote`), order form with test + reason (`createOrder`), reception task form with action and timing (date / in N days / N days after result of a pending order of this patient) (`createTask`), and Finish visit (`finishVisit`) returning to Ready (AC-09.1, AC-10.1, AC-11.1, AC-11.2, AC-11.3, AC-12.1) in src/screens/Physician.tsx
- [X] T036 [US-04, US-12, US-13, US-14] Add the Reception Checkout tab: list from `selectCheckoutList`; card from `selectCheckoutCard` with name, phone, open tasks (action, due date) and waiting tasks shown as "after result, date to be set"; mark task done; "Patient left" calls `markLeft` (AC-04.1, AC-12.1, AC-13.1, AC-13.2, AC-13.3, AC-14.1, AC-14.2) in src/screens/Reception.tsx
- [X] T037 [US-04, US-15] Add the Reception Tasks tab from `selectReceptionTasks`: open tasks by due date, then waiting, across patients, with name and phone; overdue rows highlighted; mark done (AC-04.1, AC-15.1, AC-15.2) in src/screens/Reception.tsx
- [X] T038 (S-01 walked end to end in the browser; S-03 walk-in not yet walked by hand) Run `npm test`, then walk S-01 and S-03 by hand in `npm run dev` per quickstart.md steps 1–2; log any failure or cut in DECISIONS.md in DECISIONS.md

**Checkpoint**: S-01 passes by hand. This is the MVP: the owner's top problem is solved.

---

## Phase 4: Results E5 (P2)

**Goal**: Results that arrive after the visit reach the physician with the reason they were ordered;
reviewing one opens reception's waiting follow-up and re-checks studies.

**Independent Test**: S-07 and S-08 by hand: waiting task shows at checkout; after simulate + review, it
opens due review date + 7 on reception's list with no result details.

- [X] T039 [P] [US-29] Create `DemoControls.tsx` rendered in the App header; in the physician role only (OQ-09) show "Simulate result": pick from `selectPendingOrders`, enter a value, call `simulateResult` (AC-29.1) in src/components/DemoControls.tsx
- [X] T040 [US-16, US-19] Build the Physician Results tab from `selectResultsInbox`: patient, test, reason ordered, value, resulted date, oldest first, and a "study: needs review" flag; show the count from `selectResultsCount` as a badge on the Results tab (AC-16.1, AC-16.2, AC-19.1, AC-19.2) in src/screens/Physician.tsx
- [X] T041 [US-17, US-18, US-19] Add the review form: required short note → `reviewResult`; optional reception task with the same timing options as AC-11.2 (`createTask`); show the returned EligibilityChange list as "Study <name>: <old> → <new>"; show the study flag on the review screen too (AC-17.1, AC-17.2, AC-18.1, AC-18.2, AC-19.2) in src/screens/Physician.tsx
- [X] T042 [US-09] Show the EligibilityChange list returned by `saveNote` under the Visit tab note form (AC-09.2) in src/screens/Physician.tsx
- [X] T043 (S-07, S-08, S-09 walked in the browser on the demo patient) Add OQ-09 line to DECISIONS.md; walk S-07, S-08 and S-09 by hand per quickstart.md step 3 and confirm reception's Tasks tab shows no result details (AC-18.3) in DECISIONS.md

**Checkpoint**: S-07 and S-08 pass.

---

## Phase 5: Studies + outreach E6–E7 (P3, P4)

**Goal**: The physician sees each study outcome with evidence, decides on candidates, and reception
calls approved patients without seeing clinical detail.

**Independent Test**: S-10 and S-11 by hand: approved patient appears on outreach with name, phone and
study only; not reached keeps them; reached + declined removes them and shows the Declined flag.

- [X] T044 [P] [US-08, US-20, US-26, US-27] Add the study badge and panel to the Visit tab: one badge per study with the outcome; expandable panel with each criterion's outcome and evidence (diagnosis entry + date, quoted sentence + note date, order, age or "unknown", reason text); "Declined <study>" and "No study calls" flags; physician opt-out toggle (`setOptOut`) (AC-08.3, AC-20.1, AC-20.2, AC-20.3, AC-26.1, AC-27.1, AC-27.2) in src/screens/Physician.tsx
- [X] T045 [US-21, US-22, US-26, US-27] Build the Physician Studies tab from `selectCandidates`: needs_review first, then meets; opted-out and declined rows flagged with no Approve button; Approve and Not eligible call `decideStudy` and show who/when (AC-21.1, AC-21.2, AC-22.1, AC-22.2, AC-26.1, AC-27.2) in src/screens/Physician.tsx
- [X] T046 [P] [US-04, US-24, US-25] Build `Outreach.tsx` from `selectOutreachList`: name, phone, study name, attempts so far; log call form: reached / not reached, and if reached: declined, consented or call back later (`logCall`) (AC-04.1, AC-24.1, AC-24.2, AC-25.1, AC-25.2, AC-25.3) in src/screens/Outreach.tsx
- [X] T047 [US-22, US-24, US-27] Wire `Outreach` as the Reception Outreach tab; add a reception "No study calls" toggle on the checkout card using `setOptOut` (AC-22.3, AC-24.1, AC-27.1) in src/screens/Reception.tsx
- [X] T048 (S-10, S-11, S-12 walked in the browser) Walk S-10, S-11 and S-12 by hand per quickstart.md step 4; log any cut (if behind at 1:25, outreach may be a plain list per plan) in DECISIONS.md

**Checkpoint**: S-10 and S-11 pass.

---

## Phase 6: Demo controls + deploy (P5)

**Purpose**: Reset, documentation, traceability check, deploy, and the final walkthrough.

- [X] T049 [US-30] Add "Reset demo" to `DemoControls.tsx`, visible in every role: `window.confirm` prompt, then `resetDemo()`; App returns to the role's first tab (AC-30.1) in src/components/DemoControls.tsx
- [X] T050 (64/65 ACs in a test; AC-01.2 verified by eye) AC traceability check (Constitution IV): for each AC ID in spec.md, confirm it appears in a test name, a task-tagged code comment or commit, or DECISIONS.md as cut; list any gap in DECISIONS.md in DECISIONS.md
- [X] T051 [P] (time log left for the author, by request) Rewrite `README.md`: live link; run locally (`npm install`, `npm run dev`, `npm test`); demo walkthrough from spec.md; what's built and what's cut (must agree with DECISIONS.md); how AI was used and how its output was verified; known gaps; time log including spec preparation time in README.md
- [X] T052 **Gate 2**: run `npm test && npm run build`; both green before deploy in package.json
- [ ] T053 Push the branch to GitHub, import the repo in Vercel with Vite defaults (build `npm run build`, output `dist`), and put the live URL in README.md in README.md
- [ ] T054 **Gate 3**: run the full demo walkthrough, S-13 (reload persists) and S-14 (reset restores seed) on the live URL; list anything that fails under "Known gaps" in README.md in README.md

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 (matcher) ──▶ Phase 2 (store + seed, Gate 1) ──▶ Phase 3 (visit flow, MVP)
                                                           ├──▶ Phase 4 (results)
                                                           └──▶ Phase 5 (studies + outreach)
Phase 4 + Phase 5 ──▶ Phase 6 (reset, README, Gates 2–3, deploy)
```

- T001–T004 come before everything else and must be seen failing (T005) before T009–T010.
- T013 (seed) can be written alongside Phase 1; T015 needs both T013 and T010.
- T014–T019 (store tests) come before T020–T026 (store code). T028 (Gate 1) blocks all of Phases 3–6.
- Phase 4 and Phase 5 both build on Phase 3's `Physician.tsx` and `Reception.tsx`; run them in order
  (4 then 5) because they edit the same files.

### Within a phase

- Tests before the code that makes them pass.
- `types.ts` and `dates.ts` before `eligibility.ts`; lifecycle (T020) before actions and selectors.
- Tasks in the same file run in ID order.

## Parallel Opportunities

| When | In parallel |
| --- | --- |
| Phase 1, after T006 | T007 `types.ts`, T008 `dates.ts`, T012 Tailwind setup |
| Phase 1–2 | T013 `seed.json` alongside T007–T011 |
| Phase 3, after T029 | T030 + T031 (tests), then T032 `Reception.tsx`, T033 `Nurse.tsx`, T034 `Physician.tsx` |
| Phase 4 | T039 `DemoControls.tsx` alongside T040 `Physician.tsx` |
| Phase 5 | T044 `Physician.tsx` alongside T046 `Outreach.tsx` |
| Phase 6 | T051 README alongside T049 |

### Parallel example: Phase 3

```text
Task: "T030 S-02 test in src/screens/Reception.test.tsx"
Task: "T031 S-04 test in src/screens/Nurse.test.tsx"
then
Task: "T032 Reception Today tab in src/screens/Reception.tsx"
Task: "T033 Nurse queue + intake in src/screens/Nurse.tsx"
Task: "T034 Physician Ready + Visit summary in src/screens/Physician.tsx"
```

## Implementation Strategy

### MVP first

1. Phase 1 → matcher green.
2. Phase 2 → Gate 1 (visibility proven in tests).
3. Phase 3 → S-01 by hand. **Stop and validate**: this alone solves the owner's top problem.

### Incremental delivery

4. Phase 4 → results loop (S-07, S-08).
5. Phase 5 → studies and outreach (S-10, S-11).
6. Phase 6 → reset, README, deploy, Gate 3 on the live URL.

### Cut order if behind (plan.md)

At 1:25, reduce Phase 5 UI to plain lists (T044–T047 without styling or expanders). Next, drop walk-in
search from T032 (keep create). Never cut Phases 1–2, T014 (S-05) or T028 (Gate 1). Log each cut in
DECISIONS.md.

## Notes

- 54 tasks. Every AC from AC-01.1 to AC-30.2 appears in at least one task.
- Commit after each task or logical group, citing US/AC IDs.
- `[P]` = different files, no dependency on an unfinished task.
