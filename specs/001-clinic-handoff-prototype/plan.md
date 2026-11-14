# Implementation Plan: Kubcio Clinic Prototype

**Branch**: `001-clinic-handoff-prototype` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-clinic-handoff-prototype/spec.md`

## Summary

A static, single-page clinic prototype covering the visit handoff (reception → nurse → physician →
checkout), the late-results loop, and diabetes-study eligibility with outreach. Roles are switched in
the header. All data starts from a synthetic seed file and every change is saved in the reviewer's
browser. Eligibility is a deterministic rule matcher with quoted evidence. One store module is the only
code that touches storage, and it hands each role only the fields that role may see.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19 (current Vite template, see R-01)

**Primary Dependencies**: Vite 8, React 19, Tailwind CSS v4 via `@tailwindcss/vite` (all installed)

**Storage**: `src/data/seed.json` as the starting state; changes persisted to browser localStorage under
`kubcio:state:v1`; reset restores the seed (R-07, R-08)

**Testing**: Vitest 5 + React Testing Library + jsdom + jest-dom (all installed; config to add, R-03)

**Target Platform**: Modern desktop browsers; static hosting on Vercel

**Project Type**: Single-page web app, frontend only, no backend

**Performance Goals**: None beyond normal interactivity; the full test suite runs in seconds

**Constraints**: No backend, no router, no runtime AI or network calls, no secrets in the bundle,
synthetic data only, two-hour build budget

**Scale/Scope**: One clinic day of roughly 10–20 patients, ~30 seeded patients in total, 3 roles,
30 user stories / 65 acceptance criteria

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How the plan complies | Pre | Post |
| --- | --- | --- | --- |
| I. Synthetic Data Only | Seed is AI-generated synthetic data, reviewed before commit; no imports of real data | ✅ | ✅ |
| II. Role Visibility in the Data Layer | Per-role selectors in `store.ts` build role view types by explicit picking (R-05); raw state not exported; recursive forbidden-key tests for reception and nurse (S-05); demo "simulate result" only in physician role (OQ-09); nurse never gets physician notes (OQ-01) | ✅ | ✅ |
| III. Deterministic, Evidence-Backed Eligibility | Pure functions in `src/domain/eligibility.ts`, `today` passed in; every criterion returns non-empty evidence; unsure → needs review incl. "unclear" mentions and unknown conditions (R-12–R-14); criteria in seed; outcomes returned, never stored (R-10); no runtime AI | ✅ | ✅ |
| IV. Domain Tests First, AC Traceability | Phase 1 (matcher tests red → green) and Phase 2 (store/selector tests) precede all screens; each test name and task cites its M-, S- or AC-ID | ✅ | ✅ |
| V. Simplicity over Completeness | Static Vite app, no router, no state library (`useSyncExternalStore`), only already-installed dependencies; cut from the end if late | ✅ | ✅ |
| VI. Explicit Scope Cuts | Every OQ default (research.md) and any cut gets one line in `DECISIONS.md` when implemented | ✅ | ✅ |
| Technical Constraints: "React 18" | Template ships React 19; user asked for the current template | ⚠ | ⚠ justified below |

Gate result: **PASS** with one justified deviation (Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/001-clinic-handoff-prototype/
├── plan.md              # This file
├── research.md          # Phase 0: technical decisions + provisional OQ answers
├── data-model.md        # Phase 1: entities, transitions, role view types, seed contents
├── quickstart.md        # Phase 1: run + validation guide
├── contracts/
│   ├── eligibility.md   # Matcher inputs, outputs, guarantees
│   └── store.md         # Actions, selectors, guarantees
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks; not created here)
```

### Source Code (repository root)

Follows the folder layout in `docs/kubcio-spec.md`; additions are marked.

```text
src/
  data/seed.json                synthetic patients, visits, notes, results, study
  domain/types.ts               entity types
  domain/dates.ts               (added) age, add days, comparisons — pure
  domain/eligibility.ts         matcher (pure functions)
  domain/eligibility.test.ts    M-01..M-20 + contract guarantees
  store/store.ts                load seed, persist to localStorage, actions, role selectors, useStore
  store/store.test.ts           (added) selector visibility (S-05), S-06/08/11/12, persistence, seed↔M table
  screens/Reception.tsx         tabs: Today (expected + check-in + walk-in), Checkout, Tasks; hosts Outreach tab
  screens/Reception.test.tsx    (added) S-02
  screens/Nurse.tsx             queue + intake form
  screens/Nurse.test.tsx        (added) S-04
  screens/Physician.tsx         tabs: Ready, Visit, Results (badge), Studies — visit view, results inbox, study panel
  screens/Outreach.tsx          reception outreach list + call log
  components/RoleSwitcher.tsx
  components/DemoControls.tsx   simulate result (physician only), reset demo
  test/setup.ts                 (added) jest-dom matchers
  App.tsx                       role + tab state, header
  main.tsx, index.css           (index.css: @import "tailwindcss")
vite.config.ts                  + tailwindcss() plugin, + test config (jsdom, setup file)
package.json                    + "test", "test:watch" scripts
```

**Structure Decision**: Single frontend project at the repo root, using the source spec's layout. The
template's `App.css` and `src/assets/*` are removed in Phase 1.

## Delivery Phases

Matches the user's six phases and the source's time budget. Gate numbers refer to the constitution's
Development Workflow.

| # | Phase | Scope | Done when | Budget |
| --- | --- | --- | --- | --- |
| 1 | Matcher + tests | Configure Tailwind plugin, Vitest, scripts; remove template demo files; `types.ts`, `dates.ts`; write M-01..M-20 tests first (red), then `eligibility.ts` (green) | 20 matcher tests + contract extras green | 0:20–0:55 (with phase 2 seed) |
| 2 | Store + seed data | `seed.json` (data-model "Seed contents"); `store.ts` lifecycle, actions, selectors, `useStore`; store tests | **Gate 1**: domain + store tests green, incl. S-05 and seed↔M check | |
| 3 | Visit flow E1–E4 | `App.tsx` header + `RoleSwitcher` (US-28); Reception Today/Checkout/Tasks; Nurse queue + intake; Physician Ready + Visit (note, order, task, finish); S-02, S-04 UI tests | S-01 passes by hand | 0:55–1:25 |
| 4 | Results E5 | Results tab + badge, review form with task creation, eligibility change display; "Simulate result" in DemoControls | S-07, S-08 pass | 1:25–1:40 |
| 5 | Studies + outreach E6–E7 | Study badge/panel with evidence, candidates, approve / not eligible, Outreach tab, call log, opt-out toggle, decline flags | S-10, S-11 pass | 1:40–1:50 |
| 6 | Demo controls + deploy | Reset with confirm; README (live link, run, walkthrough, built/cut, AI use, gaps, time log); deploy to Vercel | **Gate 2** then **Gate 3** on the live URL | 1:50–2:00 |

**Cut order if late** (per source: at 1:25, cut outreach to a plain list): first trim Phase 5 UI to plain
lists, then drop the walk-in search (keep create), never drop Phases 1–2 or the visibility tests. Each
cut is logged in `DECISIONS.md`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| React 19 instead of the constitution's "React 18" | User asked for the current Vite template, which ships React 19 and is already installed | Downgrading costs setup time and changes no behaviour. Recommend a PATCH amendment (1.0.1) to say "React (current Vite template)" |
