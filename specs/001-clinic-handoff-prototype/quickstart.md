# Quickstart: Kubcio Clinic Prototype

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

How to run the app and prove it works. Behaviour details are in the
[store contract](./contracts/store.md) and [eligibility contract](./contracts/eligibility.md).

## Prerequisites

- Node.js 20.19+ or 22.12+ (Vite 8 requirement)
- npm

## Run

```bash
npm install
npm test          # Vitest, single run
npm run dev       # http://localhost:5173
npm run build     # type-check + production build to dist/
```

## Gate checks (Constitution, Development Workflow)

| Gate | Command | Expected |
| --- | --- | --- |
| 1 · before screens | `npx vitest run src/domain src/store` | M-01 to M-20, selector-visibility, S-06/08/11/12 all green |
| 2 · before deploy | `npm test && npm run build` | all green, build succeeds |
| 3 · done | Demo walkthrough below on the Vercel URL | every step behaves as written |

## Manual validation

1. **S-01 visit flow**: follow demo steps 1–5 in [spec.md](./spec.md#demo-walkthrough-reference-scenario).
   Status should read expected → checked in → ready for physician → with physician → checkout → done.
2. **S-03 walk-in**: Reception → Today → Walk-in → new patient; the visit appears checked in and marked
   walk-in.
3. **S-07 / S-08 / S-09 after-visit loop**: demo steps 4–7. As physician, use "Simulate result" for
   Meera's HbA1c; review with "HbA1c confirms type 2 diabetes"; the outcome change needs review → meets is
   shown; reception's task list shows "Book follow-up" due today + 7 with no result details.
4. **S-10 / S-11 outreach**: demo steps 8–9, then log "not reached" and "reached, declined" for another
   approved patient; the Declined flag shows on the physician's study panel.
5. **S-13 persistence**: make a change, reload the page; the change is still there.
6. **S-14 reset**: Reset demo → confirm; seed data returns.
7. **Visibility spot check (AC-28.1)**: switch to Reception and Nurse on Meera after step 4; no
   physician note, order or study outcome is visible.

## Deploy (Vercel)

Push to GitHub → import the repo in Vercel → accept Vite defaults (build `npm run build`, output
`dist`). Every push redeploys. Put the live link in the README.
