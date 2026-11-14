# Kubcio Clinic Prototype — Spec

Nov 14, 2026 · @Parangan Bagchi

## Context and goal

The prototype fixes the handoff during an ordinary visit and catches study candidates at the moments information arrives. The clinic owner named the handoff as the one thing to get right on day one.

**What breaks today, in the owner's words:**

- Reception hunts for phone numbers and has to ask the physician what follow-up was wanted.
- Results come back after the patient has left, and it is easy to lose track of what still needs review.
- A diabetes diagnosis can sit in an older note, so the patient is never considered for a study.
- A result that arrives after the visit never triggers a second look for studies.

**Core idea:** handoffs, lost results and missed study candidates are one problem. Information arrives at the wrong time and nobody is told. The prototype passes each piece of information to the person who acts on it, and re-checks study eligibility whenever new clinical information lands.

**Users:** a small outpatient clinic with physicians, nurses and a receptionist. Headcount and daily volume are unknown, so the design targets one clinic day of roughly 10 to 20 patients.

&#91;embedded content: visit handoff and after-visit loop · 10 steps\]

Reviewing a late result is the moment that matters: it opens reception's waiting follow-up and re-runs the study check in the same step.

## Roles and visibility

Each role sees only what its job needs. Reception never sees clinical assessments, nurse notes or the chart, as the owner asked.

| Information | Receptionist | Nurse | Physician |
| --- | --- | --- | --- |
| Schedule and check-in status | Yes | Yes | Yes |
| Contact details | Yes | Yes | Yes |
| Reason for visit | Yes | Yes | Yes |
| Nurse observations (BP, weight, temp, patient report) | No | Yes | Yes |
| History, notes, diagnoses | No | Read only | Yes |
| Physician assessment | No | No | Yes |
| Results awaiting review | No | No | Yes |
| Tasks assigned to reception | Yes | No | Yes |
| Study eligibility and evidence | No | No | Yes |
| Study outreach calls (which study, outcome) | Yes | No | Yes |
| Study opt-out and per-study decline | Yes | No | Yes |

Roles are chosen with a role switcher, not a login. Visibility is enforced in the data layer, so a reception screen cannot load clinical fields even by accident. This is a prototype boundary, not real security.

## Scope

Build the visit handoff first, then results review, then studies. If time runs out, cutting from the end still solves the owner's top problem.

**In scope, in priority order**

1. Visit flow: expected list, check-in with reason, nurse intake, physician visit screen, checkout tasks.
2. Results inbox with "why ordered" and follow-up tasks that wait on a result.
3. Study eligibility with three outcomes and evidence, re-checked when a new result arrives.
4. Study outreach: physician approval, call log, per-study decline, global opt-out.
5. Demo controls: simulate a result arriving, reset demo data.

**Out of scope, on purpose**

- Real login, passwords, audit trail and security hardening. A role switcher stands in.
- Booking and calendar management. Appointments come from seed data.
- Billing, prescriptions, referral letters and lab integrations. Orders are records only.
- Sponsor workflows after consent.
- Any real patient data. All data is synthetic.
- AI at runtime. The app is static, so no API keys ship to the browser.

**Assumptions to state in the README**

- The only study is the owner's example: adults with documented diabetes. No lab cutoffs or exclusions are invented.
- "Adult" means age 18 or over.
- Study criteria are data, so a second study can be added without code changes.

## Tech stack and architecture

A static React app with a seed JSON file, browser storage for changes, and a one-click deploy to Vercel. A static host cannot write back to a JSON file, so the JSON is the starting state and every change is saved in the reviewer's own browser.

| Layer | Choice | Why |
| --- | --- | --- |
| Build | Vite + React 18 + TypeScript | Fast setup; types catch AI-generated mistakes early |
| Styling | Tailwind CSS | Quick, consistent UI without a design system |
| Data | `src/data/seed.json` loaded at start, changes saved to localStorage | Works on any static host; each reviewer gets a clean, private demo |
| Data access | One `store.ts` module with typed functions | The only place that touches storage; swap for an API later without touching screens |
| Role filtering | Per-role selectors in `store.ts` | Reception screens never receive clinical fields |
| Eligibility | Pure functions in `src/domain/eligibility.ts` | Deterministic, explainable, unit-testable |
| Tests | Vitest + React Testing Library | Runs in seconds; matcher tests double as the spec's test table |
| Hosting | GitHub repo + Vercel (or Netlify) | Push to deploy; a public link for reviewers |

**Why no AI at runtime:** a static page cannot hide an API key, and a clinic needs to see *why* a patient matched. Rules with quoted evidence are testable. AI is used to build the app, generate synthetic data and write tests, not to make eligibility calls.

**Folder layout**

```
src/
  data/seed.json          synthetic patients, visits, notes, results, study
  domain/types.ts         entity types
  domain/eligibility.ts   matcher (pure functions)
  domain/eligibility.test.ts
  store/store.ts          load seed, persist to localStorage, role selectors
  screens/Reception.tsx
  screens/Nurse.tsx
  screens/Physician.tsx   visit view, results inbox, study panel
  screens/Outreach.tsx
  components/RoleSwitcher.tsx
  components/DemoControls.tsx   simulate result, reset demo
```

**Deploy steps:** push to GitHub, import the repo in Vercel, accept the Vite defaults (build `npm run build`, output `dist`). Every push redeploys. Add the live link and `npm install && npm run dev` to the README.

## Data model

Ten entities in one JSON file. Eligibility is computed on demand, never stored, so it always reflects the latest notes and results.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Patient | id, name, dateOfBirth, phone, studyCallOptOut | Opt-out blocks all study outreach |
| Visit | id, patientId, date, time, bookedReason, confirmedReason, walkIn, status | Status: expected → checked in → ready for physician → with physician → checkout → done |
| Observation | visitId, bpSystolic, bpDiastolic, weightKg, tempC, patientReport, recordedAt | One per visit, entered by the nurse |
| Note | id, patientId, visitId, date, authorRole, text | Free text; the matcher reads physician notes |
| Diagnosis | id, patientId, label, status, recordedOn | The formal diagnosis list; status active or resolved |
| Order | id, patientId, visitId, test, reasonOrdered, status, value, resultedAt, reviewedAt, reviewNote | Status: pending → resulted → reviewed |
| Task | id, patientId, visitId, assignee, action, dueType, dueDate, waitsOnOrderId, offsetDays, status | dueType "date" or "after result"; status waiting → open → done |
| Study | id, name, criteria\[\] | Criteria are data, for example min age 18 and diagnosis "diabetes" |
| StudyDecision | patientId, studyId, decision, decidedBy, decidedAt | Physician's call: approve contact or not eligible |
| Outreach | patientId, studyId, attempts\[\] (at, reached), outcome | Outcome: none, declined or consented |

Units are metric: weight in kg, temperature in °C, blood pressure in mmHg.

## User stories and acceptance criteria

30 stories in 8 epics, in build order. Each criterion has an ID so tests and commits can refer to it.

### E1 · Reception: arrival

**US-01 · Today's expected list.** As a receptionist, I want to see who is expected today, so I can greet and check them in.

- AC-01.1 The list shows time, patient name, booked reason and status, sorted by time.
- AC-01.2 Checked-in patients are visually distinct from those still expected.
- AC-01.3 No clinical fields (observations, notes, diagnoses, results) appear on this screen.

**US-02 · Check in and confirm reason.** As a receptionist, I want to confirm or update why the patient came, so the nurse knows from the start.

- AC-02.1 Given a booked reason, when I check the patient in, the reason is pre-filled and editable.
- AC-02.2 Given no booked reason, check-in cannot complete until a reason is entered.
- AC-02.3 On check-in, status becomes "checked in", the confirmed reason is saved and the booked reason is kept.

**US-03 · Walk-in.** As a receptionist, I want to register a walk-in, so they join the same flow.

- AC-03.1 I can search existing patients by name or create one with name, date of birth and phone.
- AC-03.2 The new visit is created as checked in with a required reason and marked as a walk-in.

**US-04 · Contact details at hand.** As a receptionist, I want the phone number on every row and card, so I never have to hunt for it.

- AC-04.1 Phone is shown on the expected list, the checkout card, the task list and the outreach list.

### E2 · Nurse: intake

**US-05 · Ready-for-nurse queue.** As a nurse, I want to see checked-in patients and why they came, so I take them in order.

- AC-05.1 The queue lists checked-in patients by arrival time with their confirmed reason.
- AC-05.2 A patient leaves the queue once intake is saved.

**US-06 · Record observations.** As a nurse, I want to record vitals and what the patient reports, so the physician doesn't make them repeat it.

- AC-06.1 Fields: blood pressure (systolic and diastolic, mmHg), weight (kg), temperature (°C), patient report (free text). All are optional except patient report.
- AC-06.2 Non-numeric vitals are rejected with a message beside the field.
- AC-06.3 Saving sets status to "ready for physician" and records the time.
- AC-06.4 The nurse can see the patient's history read-only but not the physician's assessment.

### E3 · Physician: the visit

**US-07 · Ready-for-physician list.** As a physician, I want to see who is ready, so I can pick the next patient.

- AC-07.1 The list shows patients with status "ready for physician", their reason and time waiting.

**US-08 · One-screen visit summary.** As a physician, I want reason, observations and history together, so I'm prepared before I speak.

- AC-08.1 Opening a visit sets status to "with physician".
- AC-08.2 The screen shows confirmed reason, today's observations, active diagnoses, the three most recent notes and any results waiting for review for this patient.
- AC-08.3 A study badge shows the patient's eligibility outcome for each study (see E6).

**US-09 · Write the visit note.** As a physician, I want to record my assessment, so the chart stays complete.

- AC-09.1 The note is saved against the visit with the date and author role "physician".
- AC-09.2 Saving a note re-runs study eligibility for that patient.

**US-10 · Order a test.** As a physician, I want to order a test with a reason, so I remember why when the result returns.

- AC-10.1 An order needs a test name and a reason; it is saved as "pending".

**US-11 · Create a reception task.** As a physician, I want to tell reception what to arrange and when, so nothing is lost at checkout.

- AC-11.1 A task has an action (free text, e.g. "Book follow-up") and a timing.
- AC-11.2 Timing is either a date, "in N days", or "N days after result of \[order\]".
- AC-11.3 A task tied to a result is saved as "waiting"; other tasks are "open".

**US-12 · Finish the visit.** As a physician, I want to send the patient to checkout, so reception knows they're done with me.

- AC-12.1 Finishing sets status to "checkout" and moves the patient to reception's checkout list.

### E4 · Reception: checkout and tasks

**US-13 · Checkout card.** As a receptionist, I want to see what I must arrange for this patient, so I can do it before they leave.

- AC-13.1 The card shows name, phone and open tasks with action and due date.
- AC-13.2 Waiting tasks show as "after result, date to be set" with no result details.
- AC-13.3 The card shows no physician assessment, nurse notes or chart.

**US-14 · Complete checkout.** As a receptionist, I want to mark tasks done and close the visit.

- AC-14.1 Each task can be marked done.
- AC-14.2 Marking the patient as left sets the visit to "done"; waiting tasks stay on the task list.

**US-15 · Reception task list.** As a receptionist, I want one list of everything I owe, so tasks from earlier visits don't vanish.

- AC-15.1 Lists open tasks by due date, then waiting tasks, across all patients.
- AC-15.2 Overdue tasks are highlighted.

### E5 · Physician: results

**US-16 · Results inbox.** As a physician, I want one list of results waiting for me, so none get lost after the patient leaves.

- AC-16.1 Lists orders with status "resulted": patient, test, reason ordered, value and date, oldest first.
- AC-16.2 A count badge shows on the physician's navigation.

**US-17 · Review a result.** As a physician, I want to review a result and decide what happens next.

- AC-17.1 Reviewing records a short note and sets the order to "reviewed" with the time.
- AC-17.2 From the review I can create a reception task (same options as AC-11.2).

**US-18 · Waiting tasks wake up.** As a receptionist, I want follow-ups that depended on a result to appear when the result is reviewed.

- AC-18.1 When an order is reviewed, every task waiting on it becomes "open".
- AC-18.2 Its due date is the review date plus the task's offset in days.
- AC-18.3 It appears on reception's task list without any result details.

**US-19 · Study impact on review.** As a physician, I want to know if a new result changes a patient's study eligibility.

- AC-19.1 When a result arrives, eligibility is re-run for that patient.
- AC-19.2 If the patient's outcome for any study is needs review, the inbox row and review screen show it, so the physician checks the study while reviewing the result. After the review note is saved, eligibility re-runs and any change of outcome is shown with the old and new outcome.

### E6 · Studies: eligibility

**US-20 · Eligibility with evidence.** As a physician, I want to see each study's outcome and why, so I can trust it or overrule it.

- AC-20.1 Each study shows one outcome: meets, doesn't meet or needs review (rules in the next section).
- AC-20.2 Each criterion shows its own result and the evidence: the diagnosis list entry or the quoted note sentence with its date.
- AC-20.3 A missing value is shown as unknown, never as doesn't meet.

**US-21 · Candidate list.** As a physician, I want all patients who meet or need review for a study, so I can work through them.

- AC-21.1 Lists patients with outcome meets or needs review, needs review first.
- AC-21.2 Patients who opted out or declined this study stay visible, flagged, with no approve button.

**US-22 · Physician decision.** As a physician, I want to approve contact or mark not eligible, so a human always decides.

- AC-22.1 Approve is available for meets and needs review; it records who and when.
- AC-22.2 Not eligible removes the patient from this study's candidate list and records who and when.
- AC-22.3 No patient reaches reception's outreach list without an approval.

**US-23 · Criteria as data.** As the clinic, we want studies defined in data, so a new study needs no code change.

- AC-23.1 The study's criteria live in seed.json (min age, diagnosis).
- AC-23.2 The seeded study is "Adults with documented diabetes" with no other criteria.

### E7 · Reception: study outreach

**US-24 · Outreach list.** As a receptionist, I want to see who to call and about which study, without clinical detail.

- AC-24.1 Lists approved patients with no outcome yet, excluding opted-out and declined: name, phone, study name, attempts so far.
- AC-24.2 No eligibility evidence or clinical data is shown.

**US-25 · Log a call.** As a receptionist, I want to record each attempt and its result.

- AC-25.1 Each attempt records time and reached or not reached.
- AC-25.2 If reached, I record declined, consented or call back later.
- AC-25.3 Declined or consented removes the patient from the outreach list for that study.

**US-26 · Remember a decline.** As clinic staff, we want a declined study to stay visible, so nobody calls again.

- AC-26.1 A "Declined \[study\]" flag shows on the physician's study panel and the candidate list.
- AC-26.2 The patient never reappears on outreach for that study, even if eligibility changes.

**US-27 · Opt out of all study calls.** As clinic staff, we want to respect a patient who asks to be left out.

- AC-27.1 Reception or physician can set "No study calls" on a patient.
- AC-27.2 The patient is excluded from every outreach list and flagged everywhere studies appear.

### E8 · Demo support

**US-28 · Role switcher.** As a reviewer, I want to switch between receptionist, nurse and physician.

- AC-28.1 A switcher in the header changes the screens and data shown, per the visibility table.

**US-29 · Simulate a result arriving.** As a reviewer, I want to make a pending result arrive, so I can see the after-visit flow.

- AC-29.1 Pick a pending order, enter a value, and it becomes "resulted" now.

**US-30 · Reset demo.** As a reviewer, I want to start over cleanly.

- AC-30.1 Reset clears saved changes and reloads seed.json, after a confirm prompt.
- AC-30.2 The seed contains every matcher test case and the demo patient.

## Study eligibility rules

The matcher returns meets, doesn't meet or needs review, and every outcome carries its evidence. When the rules can't be sure, the answer is needs review, because the owner reads unclear notes personally.

**Combining criteria:** any criterion that doesn't meet makes the study doesn't meet. Otherwise any needs review makes it needs review. Otherwise it meets.

**Age (min 18)**

| Data | Result |
| --- | --- |
| Age 18 or over on today's date | Meets |
| Under 18 | Doesn't meet |
| Date of birth missing | Needs review |

**Documented diabetes, checked in this order**

| # | What the matcher finds | Result | Reason |
| --- | --- | --- | --- |
| 1 | Active diabetes entry on the diagnosis list (type 1, type 2, diabetes mellitus) | Meets | Formally documented |
| 2 | A physician note sentence clearly stating the patient has diabetes ("has type 2 diabetes", "known T2DM", "diabetic") | Meets | A clear clinician statement counts even if not on the list |
| 3 | A positive finding from 1 or 2 *and* a sentence denying diabetes ("no history of diabetes") | Needs review | Conflicting chart; physician reads it |
| 4 | Only gestational diabetes, current or past | Needs review | The study criteria don't say whether it counts |
| 5 | Only uncertain wording ("?diabetes", "possible", "suspected", "rule out") | Needs review | Unclear note; physician reads it |
| 6 | Only indirect evidence (a diabetes medication, no statement) | Needs review | Not a documented diagnosis |
| 7 | No positive evidence, but a glucose or HbA1c order is pending or its result is not yet reviewed | Needs review | Leave it open until the physician has seen the result |
| 8 | Only prediabetes, family history, or a denial | Doesn't meet | Not evidence the patient has diabetes |
| 9 | No mention at all | Doesn't meet, labelled "no evidence found" | Nothing to review |

**Sentence handling:** notes are split into sentences. A sentence that mentions diabetes is first checked for family words (mother, father, sibling, family history), prediabetes words (prediabetes, pre-diabetes, borderline, impaired fasting glucose) and negation (no, denies, not, ruled out). Only what is left can count as a positive statement.

**Evidence shown:** the diagnosis list entry with its date, or the matching sentence quoted with the note date. For needs review, the reason from the table above.

**What does not change eligibility:** opt-out and a per-study decline affect outreach only. The outcome still shows so the physician has the full picture.

## Test scenarios

20 matcher cases run as Vitest unit tests, and 14 flow scenarios are checked by tests or a scripted walkthrough. Every matcher case is also a seeded patient, so the reviewer can see the same result in the app.

### Matcher unit tests (Vitest, `eligibility.test.ts`)

| ID | Chart data | Expected | Rule |
| --- | --- | --- | --- |
| M-01 | Diagnosis list: "Type 2 diabetes mellitus", active | Meets, evidence = list entry | 1 |
| M-02 | Note: "Known T2DM, on metformin." | Meets, sentence quoted | 2 |
| M-03 | Note: "Patient has type 1 diabetes since childhood." | Meets | 2 |
| M-04 | Note: "Diabetic, foot check done today." | Meets | 2 |
| M-05 | Only a 2021 note says "Has type 2 diabetes"; recent notes silent | Meets, evidence dated 2021 | 2 |
| M-06 | Note: "Prediabetes, recheck HbA1c in 6 months." | Doesn't meet | 8 |
| M-07 | Note: "Mother has type 2 diabetes." | Doesn't meet | 8 |
| M-08 | Note: "Family history of diabetes; own glucose normal." | Doesn't meet | 8 |
| M-09 | Note: "No history of diabetes." | Doesn't meet | 8 |
| M-10 | Note: "Denies diabetes or hypertension." | Doesn't meet | 8 |
| M-11 | Diagnosis list T2DM *and* note "No history of diabetes." | Needs review, reason "conflicting chart" | 3 |
| M-12 | Only "Gestational diabetes in 2019, resolved after delivery." | Needs review | 4 |
| M-13 | Note: "?diabetes, HbA1c ordered." | Needs review | 5 |
| M-14 | Note: "Started metformin." and nothing else | Needs review | 6 |
| M-15 | No mention; HbA1c order pending | Needs review | 7 |
| M-16 | No mention; HbA1c resulted, not yet reviewed | Needs review | 7 |
| M-17 | No mention; nothing pending | Doesn't meet, "no evidence found" | 9 |
| M-18 | Age 16, diagnosis list T2DM | Doesn't meet (age) | Age |
| M-19 | Date of birth missing, diagnosis list T2DM | Needs review (age unknown) | Age |
| M-20 | Age exactly 18 today, diagnosis list T2DM | Meets | Age |

### Flow scenarios

| ID | Scenario | Expected | Checks | How |
| --- | --- | --- | --- | --- |
| S-01 | Expected patient goes through check-in, intake, visit and checkout | Status moves expected → checked in → ready for physician → with physician → checkout → done | AC-02, 06, 08, 12, 14 | Walkthrough |
| S-02 | Check in with no booked reason and an empty reason field | Check-in is blocked with a message | AC-02.2 | RTL test |
| S-03 | Walk-in for a new patient | Patient and visit created, visit checked in and marked walk-in | AC-03 | Walkthrough |
| S-04 | Nurse types "abc" for weight | Field error, nothing saved | AC-06.2 | RTL test |
| S-05 | Reception selector output for any visit | Contains no observation, note, diagnosis, result or eligibility fields | AC-01.3, 13.3, 24.2 | Unit test |
| S-06 | Physician creates "Book follow-up" in 14 days | Open task due today + 14 on reception's list | AC-11, 15 | Unit test |
| S-07 | Physician creates "Book follow-up 7 days after HbA1c result" | Task waiting; checkout shows "after result, date to be set" | AC-11.3, 13.2 | Walkthrough |
| S-08 | HbA1c result arrives and physician reviews it | Waiting task opens, due = review date + 7, on reception's list with no result details | AC-18 | Unit test + walkthrough |
| S-09 | Result arrives for an M-15 patient | Inbox row shows study needs review; after a note "HbA1c confirms type 2 diabetes" the outcome changes to meets and the change is shown | AC-19, 09.2 | Walkthrough |
| S-10 | Physician approves a candidate | Patient appears on reception's outreach list with name, phone, study only | AC-22, 24 | Walkthrough |
| S-11 | Reception logs "not reached", then "reached, declined" | Stays after first attempt; removed after decline; "Declined" flag on physician's panel | AC-25, 26 | Unit test + walkthrough |
| S-12 | Patient who meets is set to "No study calls" | Removed from all outreach; flagged; outcome still shown to physician | AC-27, 21.2 | Unit test |
| S-13 | Make changes, reload the page | Changes persist | Store | Walkthrough |
| S-14 | Reset demo, confirm | Seed data restored, all changes gone | AC-30 | Walkthrough |

**Done means:** all matcher tests and unit tests green, S-01 and the demo story pass by hand on the deployed URL, and the README lists anything that failed.

## Demo walkthrough for the reviewer

One synthetic patient, Meera Sen, exercises every epic in about five minutes. Put these steps in the README so a reviewer can follow them on the live link.

1. **Reception.** Meera is expected with booked reason "Tiredness, thirst". Check her in and keep the reason. Note her phone on the row.
2. **Nurse.** Open Meera from the queue. Record BP 138/88, weight 82 kg, temperature 36.8 °C, and "Thirsty for a month, waking at night to pass urine". Save.
3. **Physician.** Open Meera. Reason and nurse observations are on one screen; the study badge says needs review because an old note reads "?diabetes".
4. **Physician.** Write a note, order HbA1c with reason "Possible diabetes", and add a reception task: "Book follow-up 7 days after HbA1c result". Finish the visit.
5. **Reception.** Meera's checkout card shows her phone and "Book follow-up: after result, date to be set". No clinical details. Mark her as left.
6. **Demo controls.** Simulate the HbA1c result arriving.
7. **Physician.** The results inbox shows the HbA1c with "Possible diabetes" as the reason and a study needs review flag. Review it with the note "HbA1c confirms type 2 diabetes". The study outcome changes to meets, with that sentence as evidence.
8. **Physician.** Approve Meera for the diabetes study from the candidate list.
9. **Reception.** The task list now shows "Book follow-up" due 7 days from today. The outreach list shows Meera, her phone and the study name only. Log "Reached, consented".
10. **Physician.** Open the seeded edge-case patients. Prediabetes and family history show doesn't meet; gestational and conflicting chart show needs review; opted-out and declined patients are flagged on the candidate list.
11. **Reset demo** to start again.

## Build order and recording notes

Tests for the matcher come before any screen, and the deploy happens before the last 10 minutes. If you are behind at 1:25, cut outreach to a plain list and keep the rest.

| Time | Step | Done when |
| --- | --- | --- |
| 0:00–0:10 | Init Spec Kit in VS Code; add this spec; write the constitution (role visibility in the data layer, deterministic matcher, synthetic data only) | Spec and constitution committed |
| 0:10–0:20 | Run the plan and tasks steps; check generated tasks against the AC IDs; delete anything out of scope | Task list maps to US-01 to US-30 |
| 0:20–0:35 | Scaffold Vite + React + TS + Tailwind; types; have AI generate seed.json | Seed contains M-01 to M-20 and Meera Sen |
| 0:35–0:55 | Write matcher tests from the table, then the matcher | All 20 matcher tests green |
| 0:55–1:25 | E1 to E4: reception, nurse, physician visit, checkout, role switcher | S-01 passes by hand |
| 1:25–1:40 | E5: results inbox, review, waiting tasks, simulate result | S-07 and S-08 pass |
| 1:40–1:50 | E6 and E7: study panel, candidates, decisions, outreach | S-10 and S-11 pass |
| 1:50–2:00 | Deploy to Vercel; run the demo walkthrough on the live URL; finish README | Live link works end to end |

**Making a silent recording explain itself.** Communication is a graded criterion, so let the screen carry your reasoning:

- Keep a `DECISIONS.md` open in a split pane and add one line per decision as you make it, for example "Matcher is rule-based, not AI: static app, must be explainable".
- Reference AC IDs in commit messages, such as "US-18: waiting tasks open on review (AC-18.1, 18.2)".
- When you reject or fix AI output, leave it visible for a moment and log the reason in DECISIONS.md.
- Let the test runner stay on screen while matcher tests go from red to green.
- Finish with the demo walkthrough on the live URL.

**README sections:** live link; how to run locally (`npm install`, `npm run dev`, `npm test`); demo walkthrough; what's built and what's cut; how AI was used and how output was verified; known gaps; time log.

**Time log, honestly:** note that requirements were gathered from the clinic owner and turned into this spec with Claude before recording, and how long that took. The brief counts planning toward the two hours, so state whether you included it. The founder asked for exactly this.
