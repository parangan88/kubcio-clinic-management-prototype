# Feature Specification: Kubcio Clinic Prototype

**Feature Branch**: `001-clinic-handoff-prototype`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Use docs/kubcio-spec.md as the source of truth for this feature. Carry over every user story (US-01 to US-30) and acceptance criterion with its ID unchanged, plus the roles and visibility table, scope and out-of-scope lists, the eligibility rules table, and the test scenarios (M-01 to M-20, S-01 to S-14). Keep the tech stack out of spec.md; it belongs in the plan. Do not add requirements. If something is ambiguous, list it as an open question instead of deciding."

**Source of truth**: [docs/kubcio-spec.md](../../docs/kubcio-spec.md). Where this spec and the source disagree, the
source wins and the difference is a defect in this spec.

## Context

The prototype fixes the handoff during an ordinary visit and catches study candidates at the moments
information arrives. The clinic owner named the handoff as the one thing to get right on day one.

**What breaks today, in the owner's words:**

- Reception hunts for phone numbers and has to ask the physician what follow-up was wanted.
- Results come back after the patient has left, and it is easy to lose track of what still needs review.
- A diabetes diagnosis can sit in an older note, so the patient is never considered for a study.
- A result that arrives after the visit never triggers a second look for studies.

**Core idea:** handoffs, lost results and missed study candidates are one problem. Information arrives
at the wrong time and nobody is told. The prototype passes each piece of information to the person who
acts on it, and re-checks study eligibility whenever new clinical information lands.

**Users:** a small outpatient clinic with physicians, nurses and a receptionist.

Reviewing a late result is the moment that matters: it opens reception's waiting follow-up and re-runs
the study check in the same step.

## Scope

Build the visit handoff first, then results review, then studies. If time runs out, cutting from the end
still solves the owner's top problem.

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

## User Scenarios & Testing *(mandatory)*

30 stories in 8 epics, in build order. Each acceptance criterion keeps its source ID so tests and
commits can refer to it. Priorities follow the source's scope order and build order (the role switcher
is built with the visit flow).

| Priority | Epics | Source scope item |
| --- | --- | --- |
| P1 | E1–E4, plus US-28 (role switcher) | 1. Visit flow |
| P2 | E5 | 2. Results inbox |
| P3 | E6 | 3. Study eligibility |
| P4 | E7 | 4. Study outreach |
| P5 | E8 (US-29, US-30) | 5. Demo controls |

---

### E1 · Reception: arrival (Priority: P1)

**Why this priority**: The handoff is the owner's top problem; arrival starts it.

**Independent Test**: As receptionist, check in an expected patient and register a walk-in; both appear
as checked in with a reason, and no clinical field is visible.

**US-01 · Today's expected list.** As a receptionist, I want to see who is expected today, so I can greet
and check them in.

- AC-01.1 The list shows time, patient name, booked reason and status, sorted by time.
- AC-01.2 Checked-in patients are visually distinct from those still expected.
- AC-01.3 No clinical fields (observations, notes, diagnoses, results) appear on this screen.

**US-02 · Check in and confirm reason.** As a receptionist, I want to confirm or update why the patient
came, so the nurse knows from the start.

- AC-02.1 Given a booked reason, when I check the patient in, the reason is pre-filled and editable.
- AC-02.2 Given no booked reason, check-in cannot complete until a reason is entered.
- AC-02.3 On check-in, status becomes "checked in", the confirmed reason is saved and the booked reason
  is kept.

**US-03 · Walk-in.** As a receptionist, I want to register a walk-in, so they join the same flow.

- AC-03.1 I can search existing patients by name or create one with name, date of birth and phone.
- AC-03.2 The new visit is created as checked in with a required reason and marked as a walk-in.

**US-04 · Contact details at hand.** As a receptionist, I want the phone number on every row and card,
so I never have to hunt for it.

- AC-04.1 Phone is shown on the expected list, the checkout card, the task list and the outreach list.

---

### E2 · Nurse: intake (Priority: P1)

**Why this priority**: Intake carries the reason and observations to the physician.

**Independent Test**: As nurse, open a checked-in patient, record observations and save; the patient
leaves the nurse queue and becomes ready for physician.

**US-05 · Ready-for-nurse queue.** As a nurse, I want to see checked-in patients and why they came, so I
take them in order.

- AC-05.1 The queue lists checked-in patients by arrival time with their confirmed reason.
- AC-05.2 A patient leaves the queue once intake is saved.

**US-06 · Record observations.** As a nurse, I want to record vitals and what the patient reports, so the
physician doesn't make them repeat it.

- AC-06.1 Fields: blood pressure (systolic and diastolic, mmHg), weight (kg), temperature (°C), patient
  report (free text). All are optional except patient report.
- AC-06.2 Non-numeric vitals are rejected with a message beside the field.
- AC-06.3 Saving sets status to "ready for physician" and records the time.
- AC-06.4 The nurse can see the patient's history read-only but not the physician's assessment.

---

### E3 · Physician: the visit (Priority: P1)

**Why this priority**: The physician decides the follow-up that reception must arrange.

**Independent Test**: As physician, open a ready patient, write a note, order a test, create a reception
task and finish; the patient moves to reception's checkout list.

**US-07 · Ready-for-physician list.** As a physician, I want to see who is ready, so I can pick the next
patient.

- AC-07.1 The list shows patients with status "ready for physician", their reason and time waiting.

**US-08 · One-screen visit summary.** As a physician, I want reason, observations and history together,
so I'm prepared before I speak.

- AC-08.1 Opening a visit sets status to "with physician".
- AC-08.2 The screen shows confirmed reason, today's observations, active diagnoses, the three most
  recent notes and any results waiting for review for this patient.
- AC-08.3 A study badge shows the patient's eligibility outcome for each study (see E6).

**US-09 · Write the visit note.** As a physician, I want to record my assessment, so the chart stays
complete.

- AC-09.1 The note is saved against the visit with the date and author role "physician".
- AC-09.2 Saving a note re-runs study eligibility for that patient.

**US-10 · Order a test.** As a physician, I want to order a test with a reason, so I remember why when
the result returns.

- AC-10.1 An order needs a test name and a reason; it is saved as "pending".

**US-11 · Create a reception task.** As a physician, I want to tell reception what to arrange and when,
so nothing is lost at checkout.

- AC-11.1 A task has an action (free text, e.g. "Book follow-up") and a timing.
- AC-11.2 Timing is either a date, "in N days", or "N days after result of [order]".
- AC-11.3 A task tied to a result is saved as "waiting"; other tasks are "open".

**US-12 · Finish the visit.** As a physician, I want to send the patient to checkout, so reception knows
they're done with me.

- AC-12.1 Finishing sets status to "checkout" and moves the patient to reception's checkout list.

---

### E4 · Reception: checkout and tasks (Priority: P1)

**Why this priority**: Closes the handoff: reception sees exactly what to arrange.

**Independent Test**: As receptionist, open a checkout card, see phone and tasks (including a waiting
one with no result details), mark tasks done and mark the patient as left.

**US-13 · Checkout card.** As a receptionist, I want to see what I must arrange for this patient, so I
can do it before they leave.

- AC-13.1 The card shows name, phone and open tasks with action and due date.
- AC-13.2 Waiting tasks show as "after result, date to be set" with no result details.
- AC-13.3 The card shows no physician assessment, nurse notes or chart.

**US-14 · Complete checkout.** As a receptionist, I want to mark tasks done and close the visit.

- AC-14.1 Each task can be marked done.
- AC-14.2 Marking the patient as left sets the visit to "done"; waiting tasks stay on the task list.

**US-15 · Reception task list.** As a receptionist, I want one list of everything I owe, so tasks from
earlier visits don't vanish.

- AC-15.1 Lists open tasks by due date, then waiting tasks, across all patients.
- AC-15.2 Overdue tasks are highlighted.

---

### E5 · Physician: results (Priority: P2)

**Why this priority**: Results arriving after the patient leaves are the second-named failure.

**Independent Test**: Simulate a result for a pending order; it appears in the physician's inbox with
its reason; reviewing it opens any waiting reception task with the correct due date.

**US-16 · Results inbox.** As a physician, I want one list of results waiting for me, so none get lost
after the patient leaves.

- AC-16.1 Lists orders with status "resulted": patient, test, reason ordered, value and date, oldest
  first.
- AC-16.2 A count badge shows on the physician's navigation.

**US-17 · Review a result.** As a physician, I want to review a result and decide what happens next.

- AC-17.1 Reviewing records a short note and sets the order to "reviewed" with the time.
- AC-17.2 From the review I can create a reception task (same options as AC-11.2).

**US-18 · Waiting tasks wake up.** As a receptionist, I want follow-ups that depended on a result to
appear when the result is reviewed.

- AC-18.1 When an order is reviewed, every task waiting on it becomes "open".
- AC-18.2 Its due date is the review date plus the task's offset in days.
- AC-18.3 It appears on reception's task list without any result details.

**US-19 · Study impact on review.** As a physician, I want to know if a new result changes a patient's
study eligibility.

- AC-19.1 When a result arrives, eligibility is re-run for that patient.
- AC-19.2 If the patient's outcome for any study is needs review, the inbox row and review screen show
  it, so the physician checks the study while reviewing the result. After the review note is saved,
  eligibility re-runs and any change of outcome is shown with the old and new outcome.

---

### E6 · Studies: eligibility (Priority: P3)

**Why this priority**: Catches study candidates whose diagnosis sits in an older note.

**Independent Test**: Open each seeded matcher patient (M-01 to M-20); each shows the expected outcome
with per-criterion evidence.

**US-20 · Eligibility with evidence.** As a physician, I want to see each study's outcome and why, so I
can trust it or overrule it.

- AC-20.1 Each study shows one outcome: meets, doesn't meet or needs review (rules in the next section).
- AC-20.2 Each criterion shows its own result and the evidence: the diagnosis list entry or the quoted
  note sentence with its date.
- AC-20.3 A missing value is shown as unknown, never as doesn't meet.

**US-21 · Candidate list.** As a physician, I want all patients who meet or need review for a study, so
I can work through them.

- AC-21.1 Lists patients with outcome meets or needs review, needs review first.
- AC-21.2 Patients who opted out or declined this study stay visible, flagged, with no approve button.

**US-22 · Physician decision.** As a physician, I want to approve contact or mark not eligible, so a
human always decides.

- AC-22.1 Approve is available for meets and needs review; it records who and when.
- AC-22.2 Not eligible removes the patient from this study's candidate list and records who and when.
- AC-22.3 No patient reaches reception's outreach list without an approval.

**US-23 · Criteria as data.** As the clinic, we want studies defined in data, so a new study needs no
code change.

- AC-23.1 The study's criteria live in seed.json (min age, diagnosis).
- AC-23.2 The seeded study is "Adults with documented diabetes" with no other criteria.

---

### E7 · Reception: study outreach (Priority: P4)

**Why this priority**: Turns approved candidates into calls without exposing clinical detail.

**Independent Test**: Approve a candidate; as receptionist, see name, phone and study only; log
attempts; a decline or consent removes them from the list and a decline is flagged for the physician.

**US-24 · Outreach list.** As a receptionist, I want to see who to call and about which study, without
clinical detail.

- AC-24.1 Lists approved patients with no outcome yet, excluding opted-out and declined: name, phone,
  study name, attempts so far.
- AC-24.2 No eligibility evidence or clinical data is shown.

**US-25 · Log a call.** As a receptionist, I want to record each attempt and its result.

- AC-25.1 Each attempt records time and reached or not reached.
- AC-25.2 If reached, I record declined, consented or call back later.
- AC-25.3 Declined or consented removes the patient from the outreach list for that study.

**US-26 · Remember a decline.** As clinic staff, we want a declined study to stay visible, so nobody
calls again.

- AC-26.1 A "Declined [study]" flag shows on the physician's study panel and the candidate list.
- AC-26.2 The patient never reappears on outreach for that study, even if eligibility changes.

**US-27 · Opt out of all study calls.** As clinic staff, we want to respect a patient who asks to be
left out.

- AC-27.1 Reception or physician can set "No study calls" on a patient.
- AC-27.2 The patient is excluded from every outreach list and flagged everywhere studies appear.

---

### E8 · Demo support (US-28: Priority P1; US-29, US-30: Priority P5)

**Why this priority**: The role switcher is needed to demonstrate the visit flow; the other demo
controls support the after-visit flow and repeat runs.

**Independent Test**: Switch roles and confirm screens and data change per the visibility table;
simulate a result; reset and confirm starting data returns.

**US-28 · Role switcher.** As a reviewer, I want to switch between receptionist, nurse and physician.

- AC-28.1 A switcher in the header changes the screens and data shown, per the visibility table.

**US-29 · Simulate a result arriving.** As a reviewer, I want to make a pending result arrive, so I can
see the after-visit flow.

- AC-29.1 Pick a pending order, enter a value, and it becomes "resulted" now.

**US-30 · Reset demo.** As a reviewer, I want to start over cleanly.

- AC-30.1 Reset clears saved changes and reloads seed.json, after a confirm prompt.
- AC-30.2 The seed contains every matcher test case and the demo patient.

---

### Demo walkthrough (reference scenario)

One synthetic patient, Meera Sen, exercises every epic in about five minutes.

1. **Reception.** Meera is expected with booked reason "Tiredness, thirst". Check her in and keep the
   reason. Note her phone on the row.
2. **Nurse.** Open Meera from the queue. Record BP 138/88, weight 82 kg, temperature 36.8 °C, and
   "Thirsty for a month, waking at night to pass urine". Save.
3. **Physician.** Open Meera. Reason and nurse observations are on one screen; the study badge says
   needs review because an old note reads "?diabetes".
4. **Physician.** Write a note, order HbA1c with reason "Possible diabetes", and add a reception task:
   "Book follow-up 7 days after HbA1c result". Finish the visit.
5. **Reception.** Meera's checkout card shows her phone and "Book follow-up: after result, date to be
   set". No clinical details. Mark her as left.
6. **Demo controls.** Simulate the HbA1c result arriving.
7. **Physician.** The results inbox shows the HbA1c with "Possible diabetes" as the reason and a study
   needs review flag. Review it with the note "HbA1c confirms type 2 diabetes". The study outcome changes
   to meets, with that sentence as evidence.
8. **Physician.** Approve Meera for the diabetes study from the candidate list.
9. **Reception.** The task list now shows "Book follow-up" due 7 days from today. The outreach list shows
   Meera, her phone and the study name only. Log "Reached, consented".
10. **Physician.** Open the seeded edge-case patients. Prediabetes and family history show doesn't meet;
    gestational and conflicting chart show needs review; opted-out and declined patients are flagged on
    the candidate list.
11. **Reset demo** to start again.

### Edge Cases

Each edge case below is already covered by a source criterion or scenario; none adds a requirement.

- Check-in with no booked reason and an empty reason field → blocked (AC-02.2, S-02).
- Non-numeric vital such as weight "abc" → field error, nothing saved (AC-06.2, S-04).
- Date of birth missing → age criterion needs review, never doesn't meet (Age table, AC-20.3, M-19).
- Patient exactly 18 today → meets the age criterion (M-20).
- Diagnosis list and a note conflict → needs review, "conflicting chart" (rule 3, M-11).
- Waiting task at checkout → shown as "after result, date to be set" with no result details (AC-13.2).
- Patient marked as left while a task still waits → task stays on the task list (AC-14.2).
- Patient who meets but opted out or declined → outcome still shown, flagged, no approve button, never on
  outreach (AC-21.2, AC-26.2, AC-27.2, S-12).
- Eligibility changes after a decline → patient still never reappears on outreach for that study
  (AC-26.2).
- Overdue reception task → highlighted (AC-15.2).

### Test Scenarios

20 matcher cases and 14 flow scenarios. Every matcher case is also a seeded patient, so the reviewer can
see the same result in the app.

#### Matcher cases (automated tests)

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

#### Flow scenarios

| ID | Scenario | Expected | Checks | How |
| --- | --- | --- | --- | --- |
| S-01 | Expected patient goes through check-in, intake, visit and checkout | Status moves expected → checked in → ready for physician → with physician → checkout → done | AC-02, 06, 08, 12, 14 | Walkthrough |
| S-02 | Check in with no booked reason and an empty reason field | Check-in is blocked with a message | AC-02.2 | Automated UI test |
| S-03 | Walk-in for a new patient | Patient and visit created, visit checked in and marked walk-in | AC-03 | Walkthrough |
| S-04 | Nurse types "abc" for weight | Field error, nothing saved | AC-06.2 | Automated UI test |
| S-05 | Reception data for any visit | Contains no observation, note, diagnosis, result or eligibility fields | AC-01.3, 13.3, 24.2 | Automated test |
| S-06 | Physician creates "Book follow-up" in 14 days | Open task due today + 14 on reception's list | AC-11, 15 | Automated test |
| S-07 | Physician creates "Book follow-up 7 days after HbA1c result" | Task waiting; checkout shows "after result, date to be set" | AC-11.3, 13.2 | Walkthrough |
| S-08 | HbA1c result arrives and physician reviews it | Waiting task opens, due = review date + 7, on reception's list with no result details | AC-18 | Automated test + walkthrough |
| S-09 | Result arrives for an M-15 patient | Inbox row shows study needs review; after a note "HbA1c confirms type 2 diabetes" the outcome changes to meets and the change is shown | AC-19, 09.2 | Walkthrough |
| S-10 | Physician approves a candidate | Patient appears on reception's outreach list with name, phone, study only | AC-22, 24 | Walkthrough |
| S-11 | Reception logs "not reached", then "reached, declined" | Stays after first attempt; removed after decline; "Declined" flag on physician's panel | AC-25, 26 | Automated test + walkthrough |
| S-12 | Patient who meets is set to "No study calls" | Removed from all outreach; flagged; outcome still shown to physician | AC-27, 21.2 | Automated test |
| S-13 | Make changes, reload the page | Changes persist | Persistence | Walkthrough |
| S-14 | Reset demo, confirm | Seed data restored, all changes gone | AC-30 | Walkthrough |

## Requirements *(mandatory)*

### Functional Requirements

The acceptance criteria AC-01.1 to AC-30.2 above are the functional requirements. No separate FR-xxx
IDs are introduced, so there is one ID scheme for tests and commits. The two rule sets below are
referenced by those criteria (AC-28.1 references the visibility table; AC-20.1 references the
eligibility rules).

### Roles and visibility

Each role sees only what its job needs. Reception never sees clinical assessments, nurse notes or the
chart, as the owner asked.

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

Roles are chosen with a role switcher, not a login. Visibility is enforced where data is provided to
each role, not only by hiding it on screen, so a reception screen cannot load clinical fields even by
accident. This is a prototype boundary, not real security.

### Study eligibility rules

The matcher returns meets, doesn't meet or needs review, and every outcome carries its evidence. When
the rules can't be sure, the answer is needs review, because the owner reads unclear notes personally.

**Combining criteria:** any criterion that doesn't meet makes the study doesn't meet. Otherwise any
needs review makes it needs review. Otherwise it meets.

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

**Sentence handling:** notes are split into sentences. A sentence that mentions diabetes is first
checked for family words (mother, father, sibling, family history), prediabetes words (prediabetes,
pre-diabetes, borderline, impaired fasting glucose) and negation (no, denies, not, ruled out). Only what
is left can count as a positive statement.

**Evidence shown:** the diagnosis list entry with its date, or the matching sentence quoted with the
note date. For needs review, the reason from the table above.

**What does not change eligibility:** opt-out and a per-study decline affect outreach only. The outcome
still shows so the physician has the full picture.

### Key Entities

Ten entities. Eligibility is computed on demand, never stored, so it always reflects the latest notes
and results. Units are metric: weight in kg, temperature in °C, blood pressure in mmHg.

- **Patient**: id, name, dateOfBirth, phone, studyCallOptOut. Opt-out blocks all study outreach.
- **Visit**: id, patientId, date, time, bookedReason, confirmedReason, walkIn, status. Status: expected →
  checked in → ready for physician → with physician → checkout → done.
- **Observation**: visitId, bpSystolic, bpDiastolic, weightKg, tempC, patientReport, recordedAt. One per
  visit, entered by the nurse.
- **Note**: id, patientId, visitId, date, authorRole, text. Free text; the matcher reads physician notes.
- **Diagnosis**: id, patientId, label, status, recordedOn. The formal diagnosis list; status active or
  resolved.
- **Order**: id, patientId, visitId, test, reasonOrdered, status, value, resultedAt, reviewedAt,
  reviewNote. Status: pending → resulted → reviewed.
- **Task**: id, patientId, visitId, assignee, action, dueType, dueDate, waitsOnOrderId, offsetDays,
  status. dueType "date" or "after result"; status waiting → open → done.
- **Study**: id, name, criteria[]. Criteria are data, for example min age 18 and diagnosis "diabetes".
- **StudyDecision**: patientId, studyId, decision, decidedBy, decidedAt. Physician's call: approve
  contact or not eligible.
- **Outreach**: patientId, studyId, attempts[] (at, reached), outcome. Outcome: none, declined or
  consented.

## Success Criteria *(mandatory)*

### Measurable Outcomes

Taken from the source's "Done means" and test sections; no new targets.

- **SC-001**: All 20 matcher cases (M-01 to M-20) return the expected outcome and evidence.
- **SC-002**: Reception-facing data contains zero observation, note, diagnosis, result or eligibility
  fields for every visit (S-05).
- **SC-003**: S-01 and the demo walkthrough pass by hand on the public demo link; anything that fails is
  listed in the README.
- **SC-004**: A reviewer completes the Meera Sen demo walkthrough, covering every epic, in about five
  minutes.
- **SC-005**: Every matcher case is also a seeded patient that shows the same outcome in the app
  (AC-30.2).

## Assumptions

- The only study is the owner's example: adults with documented diabetes. No lab cutoffs or exclusions
  are invented.
- "Adult" means age 18 or over.
- Study criteria are data, so a second study can be added without code changes.
- Clinic headcount and daily volume are unknown, so the design targets one clinic day of roughly 10 to
  20 patients.
- Appointments come from the starting data; there is no booking.
- Each reviewer gets a clean, private demo: changes are kept for that reviewer and survive a reload
  (S-13) until reset (AC-30.1).
- All data is synthetic.

## Open Questions

Ambiguities found in the source. None is decided here; resolve with `/speckit-clarify` or record the
choice in DECISIONS.md.

- **OQ-01 · Nurse view of physician notes.** The visibility table gives the nurse "History, notes,
  diagnoses: Read only" but "Physician assessment: No", and AC-06.4 hides "the physician's assessment".
  US-09 saves the physician's assessment as a note. Can the nurse read past physician notes?
- **OQ-02 · Does a review note count for eligibility?** The matcher reads physician notes, and the review
  note is stored on the order (AC-17.1). Demo step 7 expects the review note "HbA1c confirms type 2
  diabetes" to become the meets evidence; S-09 says "after a note". Is the review note read by the
  matcher, or must the physician also write a visit note?
- **OQ-03 · Negation words inside positive statements.** "not" is a negation word, so a sentence such as
  "Diabetes not well controlled" would be discarded. Should negation apply only when it negates the
  diabetes mention itself?
- **OQ-04 · Mixed evidence beyond rule 3.** Rules are "checked in this order", yet rule 3 overrides 1 and
  2. What is the outcome when a positive finding (rule 1 or 2) co-exists with uncertain wording,
  gestational diabetes or medication-only evidence, rather than a denial?
- **OQ-05 · Which medications count as indirect evidence (rule 6)?** Only metformin appears in examples,
  and there is no medication entity, so this evidence comes from note text.
- **OQ-06 · Resolved diabetes on the diagnosis list.** Rule 1 counts only active entries. What is the
  outcome for a resolved (non-gestational) diabetes entry with no other evidence?
- **OQ-07 · Meaning of "today".** The expected list (US-01), age on "today's date" (M-20) and due dates
  depend on the current date, but appointments and dates of birth come from fixed starting data. Should
  starting data be dated relative to the day the demo runs?
- **OQ-08 · Arrival time and time waiting.** AC-05.1 sorts by arrival time and AC-07.1 shows time
  waiting, but the Visit entity has no check-in time, and "time waiting" has no stated start point.
- **OQ-09 · Demo controls and visibility.** Simulating a result (AC-29.1) shows pending orders, which
  reception must not see. Are demo controls available in every role, or only outside role-filtered
  views?
- **OQ-10 · Eligibility change after approval.** If an approved patient's outcome later becomes doesn't
  meet, do they stay on reception's outreach list? AC-26.2 covers declined patients only.
- **OQ-11 · Result-tied task created during review.** AC-17.2 allows "N days after result of [order]"
  from the review screen. If the chosen order is the one being reviewed, is the task created open with a
  due date of review date + N, or as waiting?
