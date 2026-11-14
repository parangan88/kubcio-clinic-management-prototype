# Kubcio Clinic Prototype

A clickable prototype for a small outpatient clinic. It covers the hand-off during an ordinary visit
(reception → nurse → physician → checkout), results that arrive after the patient has left, and
finding patients for a diabetes study, with the evidence shown for every match.

All data is synthetic. Nothing leaves your browser.

**Live demo:** _link to be added after deploy_

---

## Run it locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 105 tests, a few seconds
npm run build    # type-check and production build to dist/
```

The app starts from `src/data/seed.json`. Every change you make is saved in your own browser, so a
reload keeps your progress. **Reset demo** in the header restores the starting data (after a confirm
prompt). Seed dates move to the day you run the demo, so "today's list" is always today.

Switch roles with **Receptionist / Nurse / Physician** in the header. This stands in for a login; it
is a prototype boundary, not real security.

---

## Demo walkthrough (about five minutes)

One synthetic patient, Meera Sen, goes through every part of the app.

1. **Reception.** On **Today**, Meera is expected at 09:30 with "Tiredness, thirst". Click **Check in**,
   keep the reason, **Confirm check-in**. Her phone is on the row.
2. **Nurse.** Pick Meera in *Ready for nurse*. Enter BP 138 / 88, weight 82, temperature 36.8 and the
   report "Thirsty for a month, waking at night to pass urine". **Save intake**.
3. **Physician.** On **Ready**, **Open visit** for Meera. Reason and nurse observations are on one
   screen. The study badge says **needs review**: an old note reads "?diabetes" (see the Studies panel).
4. **Physician.** Write a note. Order **HbA1c** with reason "Possible diabetes". Add a reception task
   "Book follow-up" with timing **N days after a result → HbA1c → 7**. **Finish visit**.
5. **Reception.** On **Checkout**, Meera's card shows her phone and "Book follow-up · after result, date
   to be set". No clinical details. **Patient has left**.
6. **Simulate the result.** As Physician, open **Demo · simulate result** in the header, pick
   *Meera Sen · HbA1c*, enter `7.4%`, **Mark resulted now**.
7. **Physician.** **Results** shows the HbA1c with "Possible diabetes" as the reason and a
   **Study: needs review** flag. **Review** it with the note "HbA1c confirms type 2 diabetes". The
   confirmation shows **needs review → meets**, with that sentence now the evidence.
8. **Physician.** On **Studies**, **Approve contact** for Meera.
9. **Reception.** **Tasks** now shows "Book follow-up" due 7 days from today. **Study outreach** shows
   Meera, her phone and the study name only. Log **Reached → Consented**.
10. **Edge cases (Physician → Studies).** Conflicting chart (Marek Novak) and gestational diabetes
    (Aisha Rahman) show **needs review** with the reason. The opted-out patient (Ivo Marsh) and the one
    who declined (Rosa Lindqvist) are flagged, with no Approve button. Patients who *don't meet* are not
    on the candidate list by design; to see one, open their visit: Ines Varga (prediabetes) is already
    checked in, so do her intake as Nurse, then open her visit as Physician and read the Studies panel.
11. **Reset demo** in the header to start again.

---

## What's built

All 30 user stories in the spec (US-01 to US-30) are implemented.

| Area | What you can do |
| --- | --- |
| Reception: arrival | Today's list sorted by time with status badges; check-in with the booked reason pre-filled (an empty reason is blocked); walk-ins for new or existing patients; phone on every row and card |
| Nurse: intake | Queue by arrival time; BP, weight (kg), temperature (°C) and patient report, with a message beside any non-numeric field; read-only history without the physician's notes |
| Physician: visit | Ready list with time waiting; one-screen summary (reason, today's observations, active diagnoses, last three notes, results and pending orders); note, order with reason, reception task (on a date, in N days, or N days after a result); finish visit |
| Reception: checkout and tasks | Checkout card with phone and tasks; waiting tasks read "after result, date to be set"; one task list across all patients, overdue highlighted |
| Physician: results | Inbox oldest first with a count badge; review with a note and optional reception task; tasks waiting on the result open with due date = review date + offset; study outcome change shown old → new |
| Studies | Per-study outcome on the visit with each criterion's result and evidence (diagnosis entry, quoted note sentence with its date, or the reason it needs review); candidate list, needs review first; approve contact or not eligible, recording who and when |
| Reception: outreach | Approved patients only, with name, phone, study and attempts; call log (not reached / reached: declined, consented, call back later); a decline is permanent for that study; "No study calls" for reception and physician |
| Demo support | Role switcher, simulate a result, reset demo |

**Two rules the design is built around**

- **Reception never receives clinical data.** Each role reads through its own selectors in
  `src/store/store.ts`, which copy only the fields that role may see. A reception screen cannot show a
  diagnosis or a result even by accident, because it is never given one.
- **Study eligibility is deterministic and explains itself.** `src/domain/eligibility.ts` is a set of
  pure rules (no AI at runtime). Every outcome carries its evidence, and anything uncertain comes back
  as **needs review** for the physician to read. A missing value is "unknown", never "doesn't meet".

The study is defined as data in the seed (minimum age 18, documented diabetes), so a second study
can be added without code changes.

---

## What's deliberately cut

From the spec's out-of-scope list:

- Real login, passwords, audit trail and security hardening. A role switcher stands in.
- Booking and calendar management. Appointments come from seed data.
- Billing, prescriptions, referral letters and lab integrations. Orders are records only.
- Sponsor workflows after consent.
- Any real patient data. All data is synthetic.
- AI at runtime. The app is static, so no API keys ship to the browser.

Also out, as a consequence of being a static prototype: no shared data between reviewers or devices,
and no backend.

---

## How AI was used, and how its output was verified

**How it was used**

- The clinic owner's requirements were turned into a written spec with Claude before the build.
- The build followed GitHub Spec Kit: a constitution (`.specify/memory/constitution.md`), the spec,
  a plan and a task list in `specs/001-clinic-handoff-prototype/`.
- Claude Code then implemented the task list phase by phase: matcher, data layer, visit flow,
  results, studies and outreach, then this finish.
- The seed data was generated by AI and reviewed: invented names, and phone numbers from the UK
  07700 900xxx range reserved for fiction.
- Every choice the spec left open, and every cut, is logged in `DECISIONS.md`.

**How the output was verified**

- **Matcher tests first.** The 20 cases in the spec's matcher table (M-01 to M-20) were written as
  tests before the matcher existed and run against a stub so all 20 failed. The matcher was then
  written until all 20 passed. No test was changed to make it pass. (`src/domain/eligibility.test.ts`)
- **Seed versus matcher.** Every seeded matcher patient is run through the app's own selector and must
  give the outcome in the spec's table, with evidence on every criterion. What a reviewer sees in the
  app is therefore the same thing the unit tests check. (`src/store/store.test.ts`, "(a)")
- **S-05 visibility test.** Every reception selector's output is scanned for clinical field names and
  for clinical text from the seed, both at the start and after Meera's full visit and result review.
  To prove the test can fail, a result field was deliberately leaked into a reception selector: the
  test failed and named each leaking path, then the leak was reverted. A matching test covers the nurse
  view (no physician notes, orders or eligibility).
- **The rest of the suite** (105 tests) covers the visit flow and status order, task due dates, waiting
  tasks opening on review, outcome changes after a review, decisions, the call log, the decline and
  opt-out rules, persistence and reset, plus UI tests for the blocked check-in (S-02), the rejected
  weight (S-04), the results review and the reset prompt.
- **Manual walkthroughs** in a real browser, during the build: S-01 (full visit), S-07 to S-09 (late
  result, waiting task, study change), S-10 to S-12 (approval, decline, opt-out) and the demo path
  above.

**What verification caught** (each fixed and logged in `DECISIONS.md`)

- The diabetes pattern missed "Prediabetes" (M-06), found while checking the rules against the table.
- Seed times were stored as UTC, so 09:38 showed as 03:08 PM in some timezones (browser walkthrough).
- Times were sorted as text across two formats, which could misorder the nurse queue (a new test).
- A review with a bad follow-up task could save the review without the task; now both are checked
  before anything is saved.

---

## Known gaps

- **Not deployed yet.** The live link above is a placeholder, and the final walkthrough on the live URL
  has not been done.
- **No patient lookup for the physician.** A physician opens a chart through a visit (Ready or "With you
  now"). Patients who don't meet a study are not on the candidate list, so seeing their evidence
  needs a visit (see walkthrough step 10).
- **Open questions answered provisionally.** The spec lists eleven ambiguities. Each has a working
  answer in `DECISIONS.md` (for example: the nurse does not see physician notes; a result's review
  note counts as a physician note for eligibility; "Simulate result" is physician-only). None has
  been confirmed with the clinic owner.
- **The matcher is keyword rules.** It reads physician notes sentence by sentence. Wording it does not
  recognise comes back as needs review, which is the safe direction, but it will ask the physician
  more often than a person would. The diabetes-medication list is a short fixed list.
- **A few matcher rules are implemented but not unit-tested on their own:** nurse notes being ignored,
  an unknown study condition, where a negation word sits in the sentence, and a resolved diagnosis-list
  entry (task T004a). M-01 to M-20 all pass.
- **"Checked in" rows look different (AC-01.2)** is checked by eye, not by a test.
- **Marking a task done** applies to open tasks only; a task waiting on a result cannot be marked done
  until the result is reviewed.
- **Saved state is per browser and per day.** Progress saved on an earlier day keeps that day's dates;
  use Reset demo.
- **Checked in Chrome on desktop only.** The layout works at narrow widths but has not been tuned for
  phones or checked with a screen reader.
- The constitution names React 18; the app uses React 19 from the current Vite template (logged).

---

## Where things are

```text
src/domain/eligibility.ts   the study matcher (pure rules) and its tests
src/store/store.ts          the only code that touches storage; per-role selectors; all actions
src/data/seed.json          synthetic clinic day, one patient per matcher case, the demo patient
src/screens/                Reception, Nurse, Physician, Outreach
src/components/             header controls, study views, shared UI
specs/001-clinic-handoff-prototype/   spec, plan, research, data model, contracts, tasks
DECISIONS.md                every decision, open-question answer and cut, in order
```

---

## Time log

_To be written by the author._
