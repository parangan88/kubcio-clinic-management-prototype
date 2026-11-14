# Contract: Eligibility matcher (`src/domain/eligibility.ts`)

Pure functions: no storage, no network, no clock reads, no randomness. Same input, same output
(Constitution III). Rules are in [research.md](../research.md) R-12 to R-14.

## Inputs

```ts
interface PatientChart {
  patient: { id: string; dateOfBirth: string | null };
  diagnoses: Diagnosis[];   // this patient's
  notes: Note[];            // this patient's; the matcher filters to authorRole 'physician'
  orders: Order[];          // this patient's; used for rule 7
}

evaluateStudy(study: Study, chart: PatientChart, today: string /* YYYY-MM-DD */): EligibilityResult
evaluateAllStudies(studies: Study[], chart: PatientChart, today: string): EligibilityResult[]
```

## Output

```ts
type Outcome = 'meets' | 'does_not_meet' | 'needs_review';

interface EligibilityResult {
  studyId: string;
  outcome: Outcome;                 // combined: any does_not_meet → does_not_meet;
                                    // else any needs_review → needs_review; else meets
  criteria: CriterionResult[];      // one per study criterion, in study order
}

interface CriterionResult {
  criterion: Criterion;             // { kind: 'minAge', years } | { kind: 'diagnosis', condition }
  outcome: Outcome;
  evidence: Evidence[];             // never empty (AC-20.2)
}

type Evidence =
  | { type: 'diagnosis'; label: string; status: 'active' | 'resolved'; date: string }
  | { type: 'note'; quote: string; date: string; noteId: string }
  | { type: 'order'; test: string; status: 'pending' | 'resulted'; orderId: string }
  | { type: 'age'; years: number | null }       // null = unknown (AC-20.3)
  | { type: 'reason'; text: string };           // e.g. "conflicting chart", "no evidence found"
```

## Guarantees (each is a test)

| Guarantee | Test |
| --- | --- |
| M-01 to M-20 return the outcomes in the spec table | `eligibility.test.ts`, one `it` per M-ID |
| Missing date of birth → age criterion `needs_review` with `{ type: 'age', years: null }`, never `does_not_meet` | M-19 |
| Every `needs_review` carries at least one `reason` evidence item from the rules table | per-case assertions |
| Rule 9 carries `{ type: 'reason', text: 'no evidence found' }` | M-17 |
| Nurse-authored notes never affect the outcome | extra case in the same file |
| Unknown `diagnosis.condition` → `needs_review`, "no rules defined for <condition>" | extra case (R-14) |
| Opt-out and declines are not inputs, so they cannot change the outcome | by signature |
