# Research: Kubcio Clinic Prototype

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-14

Two kinds of decision live here: technical choices (R-xx) and provisional answers to the spec's open
questions (OQ-xx). Every OQ answer is a **provisional default** chosen so the build is not blocked. Each
one is overridable, and each MUST get one line in `DECISIONS.md` when it is implemented (Constitution VI).

## Technical decisions

### R-01 · React version

- **Decision**: React 19, as shipped by the current Vite template (`react@^19.3.1` already in
  package.json).
- **Rationale**: The user asked for the current template. Nothing in the spec needs a React 18–only API.
- **Alternatives**: Downgrade to React 18 to match the source doc and the constitution's Technical
  Constraints. Rejected: costs setup time for no behaviour difference. Logged as a deviation in the
  plan's Complexity Tracking; a PATCH amendment to the constitution is recommended.

### R-02 · Tailwind CSS v4

- **Decision**: `@tailwindcss/vite` plugin in `vite.config.ts`; `@import "tailwindcss";` at the top of
  `src/index.css`. No `tailwind.config.js` and no PostCSS config.
- **Rationale**: v4's Vite plugin is zero-config; both packages are already installed.
- **Alternatives**: PostCSS setup. Rejected: more files, no benefit.

### R-03 · Test setup

- **Decision**: Vitest configured inside `vite.config.ts` (`test.environment: 'jsdom'`,
  `test.setupFiles: ['src/test/setup.ts']`), with `/// <reference types="vitest/config" />`. Setup file
  imports `@testing-library/jest-dom/vitest`. Tests import `describe/it/expect` from `vitest` explicitly
  (no globals, so no tsconfig type changes). Add scripts `"test": "vitest run"` and
  `"test:watch": "vitest"`.
- **Rationale**: One config file; explicit imports keep `tsc -b` clean.
- **Alternatives**: Separate `vitest.config.ts`. Rejected: duplicate plugin config.

### R-04 · Store shape and React binding

- **Decision**: `src/store/store.ts` holds one in-memory `ClinicState`, exposes typed action functions
  and per-role selector functions, saves to localStorage after every action, and notifies subscribers.
  React reads it through `useSyncExternalStore` via a small `useStore(selector)` hook exported from the
  same module. Screens receive only role-selector output; the raw state is not exported.
- **Rationale**: No library needed; the store is plain functions, so it is unit-testable without React.
  It is the single place that touches storage (Constitution V).
- **Alternatives**: Zustand, Redux, React context. Rejected: extra dependency or extra layer, with no AC
  requiring it.

### R-05 · Role visibility enforcement

- **Decision**: Each role selector builds its output by **explicitly picking** allowed fields into
  role-specific view types (`ReceptionVisitRow`, `NurseQueueItem`, `PhysicianVisitView`, ...). Selectors
  never spread entity objects (`{...visit}`). A test walks every reception and nurse selector output
  recursively and fails if any forbidden key appears (S-05).
- **Rationale**: Picking makes leaks impossible by construction, and the type system documents what
  each role receives (Constitution II).
- **Alternatives**: One generic selector plus field filtering by role. Rejected: easy to leak a new
  field by default.

### R-06 · Clock and dates

- **Decision**: All domain functions and store actions take `today`/`now` as a parameter (default
  `new Date()` at the store boundary only). Dates are stored as ISO strings: `YYYY-MM-DD` for dates,
  full ISO for timestamps. Date helpers go in `src/domain/dates.ts` (age in whole years, add days,
  compare).
- **Rationale**: Deterministic tests (M-20 "exactly 18 today", S-06 "today + 14").

### R-07 · Seed dates relative to the demo day (answers OQ-07, provisional)

- **Decision**: `seed.json` carries `"seedDate"` (the date it was authored against). When the seed is
  loaded (first load or reset), every date and timestamp field is shifted by
  `today − seedDate` in whole days. Saved state in localStorage keeps absolute dates.
- **Rationale**: "Today's expected list", "exactly 18 today" and overdue tasks stay correct on any demo
  day without editing the seed. M-05's 2021 note is dated mid-2021 so a shift of a few months keeps it
  in 2021.
- **Alternatives**: Relative tokens in the seed ("today-3"). Rejected: needs a custom parser, and the
  seed is harder for a reviewer to read.

### R-08 · Persistence and reset

- **Decision**: localStorage key `kubcio:state:v1`. On start: if the key holds parseable state with the
  same `schemaVersion`, use it; otherwise load the seed (R-07). Reset (AC-30.1): the screen asks for
  confirmation with `window.confirm`, then the store removes the key and reloads the seed.
- **Rationale**: Each reviewer gets a private, clean demo; corrupted or old state falls back safely.

### R-09 · No router

- **Decision**: `App.tsx` holds `role` and `tab` in React state. A header `RoleSwitcher` sets the role
  and resets the tab to that role's first tab. Each role screen renders its own tab bar.
- **Tabs**: Reception: Today, Checkout, Tasks, Outreach. Nurse: Queue. Physician: Ready, Visit,
  Results (count badge, AC-16.2), Studies.
- **Rationale**: User instruction; nothing needs deep links.

### R-10 · Eligibility change display (AC-09.2, AC-19.2)

- **Decision**: Eligibility is never stored. Actions that can change it (`saveNote`, `reviewResult`)
  compute the patient's outcomes before and after the change and **return** an `EligibilityChange[]`
  (`studyId`, `from`, `to`). The screen shows the change; nothing about outcomes is persisted.
- **Rationale**: Satisfies "show old and new outcome" while keeping eligibility computed on demand
  (Constitution III).

### R-11 · Deploy

- **Decision**: Vercel with Vite defaults (build `npm run build`, output `dist`). No `vercel.json`.
- **Rationale**: Static build; no rewrites needed without a router.

## Matcher design (Constitution III)

### R-12 · Sentence classification

Notes from **physician** authors only are split into sentences on `.`, `;`, `!`, `?` followed by a space
or end of text, and on newlines. (A `?` directly before a word, as in "?diabetes", is not a split.)
A sentence **mentions diabetes** if it matches (case-insensitive, word-boundaried) `(pre-?)?diabet\w*`,
`T1DM`, `T2DM`, `IDDM` or `NIDDM`. (The optional prefix is needed so "Prediabetes" in M-06 is seen.) Each mentioning sentence gets one class, checked in this order:

1. **family**: mother, father, sibling, brother, sister, family history
2. **prediabetes**: prediabetes, pre-diabetes, borderline, impaired fasting glucose
3. **denial**: `no`, `denies`, `not`, `without` appearing **before** the diabetes term, or `ruled out`
   anywhere (see OQ-03)
4. **gestational**: gestational
5. **uncertain**: `?` directly before the term, possible, possibly, suspected, query, rule out, likely
6. **positive**: has/known/diagnosed with diabetes, diabetic, type 1 or type 2 diabetes, T1DM, T2DM,
   diabetes mellitus
7. **unclear**: a mention that matches none of the above → treated like uncertain (rule 5, reason
   "unclear note"), per Constitution III "when unsure, return needs review"

A **medication** sentence (rule 6) is any physician-note sentence naming a diabetes medication (OQ-05)
without a diabetes mention.

### R-13 · Diabetes criterion outcome

Evaluated in this order; the first matching step decides. All reasons that apply are listed as evidence.

1. (active diabetes on diagnosis list **or** positive sentence) **and** a denial sentence → needs review,
   "conflicting chart" (rule 3)
2. active diabetes entry on diagnosis list → meets, evidence = entry + date (rule 1)
3. positive sentence → meets, evidence = quoted sentence + note date (rule 2)
4. any of: gestational (sentence or list entry), uncertain/unclear sentence, medication-only sentence,
   resolved non-gestational diabetes list entry (OQ-06), or a pending/unreviewed glucose or HbA1c order →
   needs review, one reason per finding (rules 4–7)
5. prediabetes, family or denial only → doesn't meet (rule 8)
6. nothing → doesn't meet, "no evidence found" (rule 9)

Diagnosis-list labels are classified with the same vocabulary (a "Gestational diabetes" entry is
gestational, "Prediabetes" is prediabetes). Glucose/HbA1c orders match test names `HbA1c`, `A1c`,
`glucose` (case-insensitive) with status `pending` or `resulted`.

### R-14 · Criteria as data

`Study.criteria` is a list of `{ kind: 'minAge', years }` and `{ kind: 'diagnosis', condition }`. The
matcher has a vocabulary table keyed by condition; only `diabetes` exists. A `diagnosis` criterion for
an unknown condition returns needs review with reason "no rules defined for <condition>", so a new
study loads without code changes and fails safe (AC-23.1, Constitution III).

## Provisional answers to the spec's open questions

| OQ | Provisional default | Why |
| --- | --- | --- |
| OQ-01 Nurse and physician notes | Nurse selector returns diagnoses and **nurse-authored** notes only; physician-authored notes are withheld | Strictest reading of "Physician assessment: No" (Constitution II); US-09 saves the assessment as a physician note |
| OQ-02 Review note and eligibility | `reviewResult` also writes a physician Note (text = review note, date = review date, visitId = the order's visit). The matcher reads notes only, so the review note counts | Makes demo step 7 and S-09 work without a special case in the matcher; the note also appears in the chart |
| OQ-03 Negation placement | `no`/`denies`/`not`/`without` count as denial only before the diabetes term in the sentence; `ruled out` counts anywhere | "Diabetes not well controlled" stays positive; M-09, M-10 still deny |
| OQ-04 Mixed evidence | A positive finding (rule 1 or 2) beats uncertain, gestational, medication and pending-test findings; only a denial creates a conflict (rule 3) | Required by the demo: Meera's old "?diabetes" note must not block meets after the review note |
| OQ-05 Diabetes medications | metformin, insulin, gliclazide, glipizide, sitagliptin, empagliflozin, dapagliflozin, semaglutide, liraglutide, dulaglutide | Common agents; result is only ever needs review, so over-inclusion is safe |
| OQ-06 Resolved diabetes entry | Needs review, reason "resolved diabetes entry on list" | When unsure, needs review |
| OQ-07 Meaning of "today" | Seed dates shift to the demo day (R-07) | Keeps US-01, M-20 and due dates valid |
| OQ-08 Arrival time, time waiting | Add `Visit.checkedInAt` (set on check-in); nurse queue sorts by it; time waiting = now − `Observation.recordedAt` | Data-model addition only; no new behaviour |
| OQ-09 Demo controls | "Simulate result" appears only in the physician role (uses a physician selector for pending orders); "Reset demo" appears in every role | Reception never receives order details |
| OQ-10 Eligibility change after approval | Outreach list excludes approved patients whose current outcome is doesn't meet; the approval record is kept | Avoids calling someone who no longer qualifies; reversible if the outcome changes back |
| OQ-11 Result-tied task during review | Tied to the order being reviewed → created `open` with due = review date + N; tied to another order → `waiting` | The result is already reviewed, so waiting would never wake |
