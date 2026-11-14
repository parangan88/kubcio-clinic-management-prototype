# Kubcio Clinic — Prototype

**Live demo:** https://kubcio-clinic-management-prototype.vercel.app/

A working prototype of a clinic management system for a small outpatient clinic with physicians, nurses and a receptionist. It fixes the handoff during an ordinary visit, keeps late results from getting lost, and flags patients who may qualify for a clinical study at the moment new information arrives.

All patient data is synthetic.

---

## Review it in 5 minutes

1. Open the live demo. No login or install needed.
2. Use the **role switcher** in the header to move between Receptionist, Nurse and Physician.
3. Follow the demo story in [GUIDED_TOUR.md](./GUIDED_TOUR.md#part-1--the-5-minute-story). One patient, Meera Sen, exercises every feature.
4. Click **Reset demo** at any time to start over.

Your changes are saved only in your own browser, so every reviewer starts from the same clean data.

---

## The problem, in the clinic owner's words

- Reception hunts for phone numbers and has to ask the physician what follow-up was wanted.
- Results come back after the patient has left, and it is easy to lose track of what still needs review.
- A diabetes diagnosis can sit in an older note, so the patient is never considered for a study.
- A result that arrives after the visit never triggers a second look for studies.

The owner's top priority: **make the handoff during an ordinary visit easier.**

## What's built

| Area | What it does |
| --- | --- |
| Reception: arrival | Today's expected list, check-in with confirmed reason, walk-ins, phone on every row |
| Nurse: intake | Ready queue, vitals (BP, weight, temperature) and patient report |
| Physician: visit | One-screen summary (reason, observations, history, pending results), notes, test orders, reception tasks |
| Reception: checkout | Tasks with action and due date, no clinical detail; one task list across all patients |
| Results | Inbox with "why ordered"; review opens follow-ups that were waiting on the result |
| Study eligibility | Meets / doesn't meet / needs review, with quoted evidence; re-checked when results arrive or notes are saved |
| Study outreach | Physician approval, reception call log, per-study decline, global "No study calls" opt-out |
| Demo controls | Simulate a result arriving, reset demo data |

Full detail: [TECHNICAL.md](./TECHNICAL.md).

## Deliberately out of scope

- Real login and security hardening. A role switcher stands in; role visibility is enforced in the data layer, but this is not real access control.
- Appointment booking and calendar management. Appointments come from seed data.
- Billing, prescriptions, referral letters and lab integrations.
- Sponsor workflows after consent.
- AI at runtime. The app is static, so no API keys ship to the browser, and eligibility is rule-based so every decision can be explained.
- Invented clinical thresholds. The only study is the owner's example, "adults with documented diabetes," with no lab cutoffs or exclusions.

## Run it locally

Requires Node.js 20.19+ (or 22+).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit and component tests (Vitest)
npm run build      # production build into dist/
npm run preview    # serve the production build at http://localhost:4173
```

## How it was built

**Process:** Spec-Driven Development with GitHub Spec Kit and Claude Code in VS Code. Requirements came from two rounds of questions to the clinic owner and were written into a spec with numbered user stories (US-01 to US-30), acceptance criteria and test scenarios. Then: constitution → specify → plan → tasks → implement, one phase at a time.

**What AI did:** generated the spec artifacts, plan and task list from the source spec; wrote code and tests phase by phase; generated synthetic seed data.

**How AI output was checked:**

- The 20 eligibility test cases (M-01 to M-20) were written from the spec before the matcher, confirmed failing, then made to pass without changing expectations.
- A seed-versus-matcher test runs the matcher over every seeded edge-case patient and asserts the expected outcome, so generated data can't silently drift from the rules.
- A visibility test proves reception selectors return no clinical fields.
- Each phase was walked through by hand against its scenarios (S-01 to S-14) before committing.

<!-- VERIFY: edit the bullets above so they describe only what you actually did on camera. Add anything you caught and fixed. -->

Decisions made along the way: [DECISIONS.md](./DECISIONS.md).

## Known gaps

<!-- Paste the "not implemented" list from Phase 6 here, honestly. -->

## Time log

See [TIME_LOG.md](./TIME_LOG.md).

## Documentation

- [GUIDED_TOUR.md](./GUIDED_TOUR.md): how to use the app, by role and by feature
- [TECHNICAL.md](./TECHNICAL.md): architecture, data model, eligibility rules, testing
- `docs/kubcio-spec.md`: the source spec
- `specs/`: Spec Kit artifacts (spec, plan, tasks)
