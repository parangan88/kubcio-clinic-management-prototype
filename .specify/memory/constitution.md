<!--
Sync Impact Report
- Version change: template (unversioned) → 1.0.0
- Modified principles: all placeholders replaced (initial ratification)
  - [PRINCIPLE_1] → I. Synthetic Data Only
  - [PRINCIPLE_2] → II. Role Visibility in the Data Layer
  - [PRINCIPLE_3] → III. Deterministic, Evidence-Backed Eligibility
  - [PRINCIPLE_4] → IV. Domain Tests First, Full AC Traceability
  - [PRINCIPLE_5] → V. Simplicity over Completeness
  - added → VI. Explicit Scope Cuts
- Added sections: Technical Constraints; Development Workflow & Quality Gates
- Removed sections: none
- Templates:
  - ✅ .specify/templates/tasks-template.md (tests mandatory for domain logic; AC IDs in tasks)
  - ✅ .specify/templates/plan-template.md (no change needed; Constitution Check reads gates from here)
  - ✅ .specify/templates/spec-template.md (no change needed; spec already uses AC IDs)
  - ⚠ README.md still the Vite template; rewrite per spec "README sections" during build
- Deferred TODOs: none
-->

# Kubcio Clinic Prototype Constitution

## Core Principles

### I. Synthetic Data Only

- All patients, visits, notes, diagnoses, orders and results MUST be synthetic.
- No real patient data, real names paired with real health information, or production exports
  may enter the repo, seed file, tests, screenshots or deployed demo.
- AI may generate synthetic data at build time; generated data is reviewed before commit.

**Rationale**: The prototype is public and recorded. Synthetic data removes privacy risk entirely.

### II. Role Visibility in the Data Layer

- Role filtering MUST happen in per-role selectors in the store (`store.ts`). Screens receive only
  what their role's selector returns.
- Hiding a field in the UI is never sufficient on its own.
- Reception selectors MUST NOT return clinical fields: observations, notes, diagnoses, orders or
  results, physician assessment, or study eligibility and evidence. Waiting tasks reach reception
  without result details.
- Nurse selectors MUST NOT return the physician assessment, results awaiting review, or eligibility.
- Each role selector MUST have a unit test asserting the forbidden fields are absent from its output.

**Rationale**: The clinic owner requires that reception never sees the chart. Enforcing it at the
data boundary makes accidental leaks impossible and testable. This is a prototype boundary, not
real security.

### III. Deterministic, Evidence-Backed Eligibility

- Study eligibility MUST be computed by pure, rule-based functions in `src/domain/`. Same input,
  same output.
- Every outcome (meets, doesn't meet, needs review) MUST carry evidence: the diagnosis-list entry
  with its date, the quoted note sentence with its date, or the reason a review is needed.
- When the rules cannot be sure (conflict, uncertain wording, missing data, pending result), the
  outcome MUST be "needs review". Missing data is shown as unknown, never as doesn't meet.
- Study criteria are data in the seed file; adding a study MUST NOT require code changes.
- Eligibility is computed on demand, never stored.
- No AI, LLM or network calls at runtime. AI is a build-time tool only.

**Rationale**: A clinic must see why a patient matched, and a static app cannot hide an API key.
Rules with quoted evidence are explainable and testable.

### IV. Domain Tests First, Full AC Traceability

- Domain logic (eligibility matcher, role selectors, task and status transitions) MUST have tests
  written before the screens that use it. Matcher tests are written first and seen failing.
- Every acceptance criterion ID (AC-xx.y) MUST trace to at least one of: a test that names it, the
  code that implements it, or a DECISIONS.md entry recording it as cut.
- Commit messages reference the US/AC IDs they deliver.

**Rationale**: Tests are the cheapest proof that the matcher and visibility rules work, and AC
traceability shows reviewers exactly what was built.

### V. Simplicity over Completeness

- The app is a static Vite + React + TypeScript site. No backend, server, database or auth.
- State starts from `src/data/seed.json` and changes persist to localStorage through a single store
  module, the only code that touches storage.
- New dependencies, abstractions or layers MUST be justified by a specific AC; otherwise they are
  not added.
- When short on time, cut features from the end of the priority list rather than adding shortcuts
  that break Principles II or III.

**Rationale**: The build has a two-hour budget. Every extra moving part costs time that the
handoff flow needs.

### VI. Explicit Scope Cuts

- Every scope cut, simplification or deviation from the spec MUST be recorded as one line in
  `DECISIONS.md` with the reason, at the time it is made.
- Rejected or corrected AI output that changes the approach is also logged there.
- The README "what's cut" and "known gaps" sections MUST agree with DECISIONS.md.

**Rationale**: A silent recording has to explain itself. Recorded cuts keep reviewers from
mistaking an omission for a bug.

## Technical Constraints

- Stack: Vite, React 18, TypeScript, Tailwind CSS, Vitest and React Testing Library.
- Hosting: a static host (Vercel or Netlify) deployed from GitHub.
- Units are metric: kg, °C, mmHg.
- Role switching uses a header switcher, not a login.
- No secrets or API keys in the repo or the browser bundle.

## Development Workflow & Quality Gates

- Build order follows the spec's priority: visit handoff, then results, then studies, then outreach,
  then demo controls.
- Gate 1, before screens: the matcher tests (M-01 to M-20) and role-selector tests pass.
- Gate 2, before deploy: `npm test` is green and `npm run build` succeeds.
- Gate 3, done: the demo walkthrough passes by hand on the deployed URL; failures are listed in
  the README.
- `/speckit-plan` output MUST include a Constitution Check against Principles I–VI; any violation is
  justified in its Complexity Tracking table or logged in DECISIONS.md.

## Governance

- This constitution overrides other practices for this project. Specs, plans and tasks MUST comply.
- Amendments are made by editing this file, bumping the version and logging the change in
  DECISIONS.md.
- Versioning: MAJOR for removing or redefining a principle; MINOR for adding a principle or
  materially expanding guidance; PATCH for wording fixes.
- Compliance is checked at each Spec Kit plan step and before deploy. Runtime guidance lives in
  `CLAUDE.md` and the current plan.

**Version**: 1.0.0 | **Ratified**: 2026-11-14 | **Last Amended**: 2026-11-14
