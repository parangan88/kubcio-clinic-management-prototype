// Matcher tests M-01 to M-20, taken from the spec's matcher table
// (specs/001-clinic-handoff-prototype/spec.md, "Matcher cases").
// Covers US-20 (AC-20.1, AC-20.2, AC-20.3) and US-23 (AC-23.1).
import { describe, expect, it } from 'vitest'
import { evaluateStudy } from './eligibility'
import type {
  CriterionResult,
  Diagnosis,
  EligibilityResult,
  Evidence,
  Note,
  Order,
  PatientChart,
  Study,
} from './types'

const TODAY = '2026-11-14'

const DIABETES_STUDY: Study = {
  id: 'diabetes',
  name: 'Adults with documented diabetes',
  criteria: [
    { kind: 'minAge', years: 18 },
    { kind: 'diagnosis', condition: 'diabetes' },
  ],
}

// ---- fixture builders -------------------------------------------------------

let seq = 0
const nextId = (prefix: string) => `${prefix}-${++seq}`

function chart(parts: {
  dateOfBirth?: string | null
  diagnoses?: Diagnosis[]
  notes?: Note[]
  orders?: Order[]
} = {}): PatientChart {
  return {
    patient: {
      id: 'p-test',
      // default: a 40-year-old adult
      dateOfBirth: parts.dateOfBirth === undefined ? '1986-05-20' : parts.dateOfBirth,
    },
    diagnoses: parts.diagnoses ?? [],
    notes: parts.notes ?? [],
    orders: parts.orders ?? [],
  }
}

function note(text: string, date = '2026-10-01', authorRole: Note['authorRole'] = 'physician'): Note {
  return { id: nextId('n'), patientId: 'p-test', visitId: null, date, authorRole, text }
}

function dx(label: string, status: Diagnosis['status'] = 'active', recordedOn = '2024-03-02'): Diagnosis {
  return { id: nextId('d'), patientId: 'p-test', label, status, recordedOn }
}

function order(test: string, status: Order['status']): Order {
  return {
    id: nextId('o'),
    patientId: 'p-test',
    visitId: 'v-test',
    test,
    reasonOrdered: 'Check glucose control',
    status,
    value: status === 'pending' ? null : '6.9%',
    resultedAt: status === 'pending' ? null : '2026-11-13T10:00:00.000Z',
    reviewedAt: status === 'reviewed' ? '2026-11-13T12:00:00.000Z' : null,
    reviewNote: status === 'reviewed' ? 'Seen' : null,
  }
}

const T2DM = () => dx('Type 2 diabetes mellitus')

// ---- result helpers ---------------------------------------------------------

function run(c: PatientChart): EligibilityResult {
  return evaluateStudy(DIABETES_STUDY, c, TODAY)
}

function criterion(r: EligibilityResult, kind: 'minAge' | 'diagnosis'): CriterionResult {
  const found = r.criteria.find((c) => c.criterion.kind === kind)
  if (!found) throw new Error(`no ${kind} criterion in result`)
  return found
}

const diabetes = (r: EligibilityResult) => criterion(r, 'diagnosis')
const age = (r: EligibilityResult) => criterion(r, 'minAge')

function reasons(c: CriterionResult): string[] {
  return c.evidence.flatMap((e: Evidence) => (e.type === 'reason' ? [e.text] : []))
}

function quotes(c: CriterionResult): Extract<Evidence, { type: 'note' }>[] {
  return c.evidence.filter((e): e is Extract<Evidence, { type: 'note' }> => e.type === 'note')
}

/** Every criterion result must carry evidence (AC-20.2). */
function expectEvidenceOnEveryCriterion(r: EligibilityResult) {
  for (const c of r.criteria) expect(c.evidence.length).toBeGreaterThan(0)
}

/** A needs-review or doesn't-meet outcome must say why. */
function expectAReason(c: CriterionResult) {
  const texts = reasons(c)
  expect(texts.length).toBeGreaterThan(0)
  for (const t of texts) expect(t.trim()).not.toBe('')
}

// ---- tests ------------------------------------------------------------------

describe('eligibility matcher: diabetes study (spec matcher table)', () => {
  it('M-01 diagnosis list "Type 2 diabetes mellitus", active → meets, evidence = list entry (rule 1)', () => {
    const r = run(chart({ diagnoses: [T2DM()] }))
    expect(r.outcome).toBe('meets')
    expect(diabetes(r).outcome).toBe('meets')
    expect(diabetes(r).evidence).toContainEqual(
      expect.objectContaining({
        type: 'diagnosis',
        label: 'Type 2 diabetes mellitus',
        status: 'active',
        date: '2024-03-02',
      }),
    )
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-02 note "Known T2DM, on metformin." → meets, sentence quoted (rule 2)', () => {
    const r = run(chart({ notes: [note('Known T2DM, on metformin.', '2026-09-10')] }))
    expect(r.outcome).toBe('meets')
    expect(quotes(diabetes(r))).toContainEqual(
      expect.objectContaining({ quote: expect.stringContaining('Known T2DM, on metformin'), date: '2026-09-10' }),
    )
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-03 note "Patient has type 1 diabetes since childhood." → meets (rule 2)', () => {
    const r = run(chart({ notes: [note('Patient has type 1 diabetes since childhood.')] }))
    expect(r.outcome).toBe('meets')
    expect(quotes(diabetes(r))).toContainEqual(
      expect.objectContaining({ quote: expect.stringContaining('has type 1 diabetes since childhood') }),
    )
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-04 note "Diabetic, foot check done today." → meets (rule 2)', () => {
    const r = run(chart({ notes: [note('Diabetic, foot check done today.')] }))
    expect(r.outcome).toBe('meets')
    expect(quotes(diabetes(r))).toContainEqual(
      expect.objectContaining({ quote: expect.stringContaining('Diabetic, foot check done today') }),
    )
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-05 only a 2021 note says "Has type 2 diabetes"; recent notes silent → meets, evidence dated 2021 (rule 2)', () => {
    const r = run(
      chart({
        notes: [
          note('Has type 2 diabetes.', '2021-06-15'),
          note('Knee pain after running, advised rest.', '2026-09-01'),
          note('Blood pressure reviewed, stable.', '2026-10-20'),
        ],
      }),
    )
    expect(r.outcome).toBe('meets')
    const q = quotes(diabetes(r))
    expect(q).toHaveLength(1)
    expect(q[0].quote).toContain('Has type 2 diabetes')
    expect(q[0].date.startsWith('2021')).toBe(true)
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-06 note "Prediabetes, recheck HbA1c in 6 months." → doesn\'t meet (rule 8)', () => {
    const r = run(chart({ notes: [note('Prediabetes, recheck HbA1c in 6 months.')] }))
    expect(r.outcome).toBe('does_not_meet')
    expect(diabetes(r).outcome).toBe('does_not_meet')
    expectAReason(diabetes(r))
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-07 note "Mother has type 2 diabetes." → doesn\'t meet (rule 8)', () => {
    const r = run(chart({ notes: [note('Mother has type 2 diabetes.')] }))
    expect(r.outcome).toBe('does_not_meet')
    expect(diabetes(r).outcome).toBe('does_not_meet')
    expectAReason(diabetes(r))
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-08 note "Family history of diabetes; own glucose normal." → doesn\'t meet (rule 8)', () => {
    const r = run(chart({ notes: [note('Family history of diabetes; own glucose normal.')] }))
    expect(r.outcome).toBe('does_not_meet')
    expect(diabetes(r).outcome).toBe('does_not_meet')
    expectAReason(diabetes(r))
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-09 note "No history of diabetes." → doesn\'t meet (rule 8)', () => {
    const r = run(chart({ notes: [note('No history of diabetes.')] }))
    expect(r.outcome).toBe('does_not_meet')
    expect(diabetes(r).outcome).toBe('does_not_meet')
    expectAReason(diabetes(r))
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-10 note "Denies diabetes or hypertension." → doesn\'t meet (rule 8)', () => {
    const r = run(chart({ notes: [note('Denies diabetes or hypertension.')] }))
    expect(r.outcome).toBe('does_not_meet')
    expect(diabetes(r).outcome).toBe('does_not_meet')
    expectAReason(diabetes(r))
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-11 diagnosis list T2DM and note "No history of diabetes." → needs review, reason "conflicting chart" (rule 3)', () => {
    const r = run(chart({ diagnoses: [T2DM()], notes: [note('No history of diabetes.')] }))
    expect(r.outcome).toBe('needs_review')
    expect(diabetes(r).outcome).toBe('needs_review')
    expect(reasons(diabetes(r)).some((t) => /conflicting chart/i.test(t))).toBe(true)
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-12 only "Gestational diabetes in 2019, resolved after delivery." → needs review (rule 4)', () => {
    const r = run(chart({ notes: [note('Gestational diabetes in 2019, resolved after delivery.')] }))
    expect(r.outcome).toBe('needs_review')
    expect(diabetes(r).outcome).toBe('needs_review')
    expectAReason(diabetes(r))
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-13 note "?diabetes, HbA1c ordered." → needs review (rule 5)', () => {
    const r = run(chart({ notes: [note('?diabetes, HbA1c ordered.')] }))
    expect(r.outcome).toBe('needs_review')
    expect(diabetes(r).outcome).toBe('needs_review')
    expectAReason(diabetes(r))
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-14 note "Started metformin." and nothing else → needs review (rule 6)', () => {
    const r = run(chart({ notes: [note('Started metformin.')] }))
    expect(r.outcome).toBe('needs_review')
    expect(diabetes(r).outcome).toBe('needs_review')
    expectAReason(diabetes(r))
    expectEvidenceOnEveryCriterion(r)
  })

  it('M-15 no mention; HbA1c order pending → needs review (rule 7)', () => {
    const r = run(chart({ orders: [order('HbA1c', 'pending')] }))
    expect(r.outcome).toBe('needs_review')
    expect(diabetes(r).outcome).toBe('needs_review')
    expect(diabetes(r).evidence).toContainEqual(
      expect.objectContaining({ type: 'order', test: 'HbA1c', status: 'pending' }),
    )
    expectAReason(diabetes(r))
  })

  it('M-16 no mention; HbA1c resulted, not yet reviewed → needs review (rule 7)', () => {
    const r = run(chart({ orders: [order('HbA1c', 'resulted')] }))
    expect(r.outcome).toBe('needs_review')
    expect(diabetes(r).outcome).toBe('needs_review')
    expect(diabetes(r).evidence).toContainEqual(
      expect.objectContaining({ type: 'order', test: 'HbA1c', status: 'resulted' }),
    )
    expectAReason(diabetes(r))
  })

  it('M-17 no mention; nothing pending → doesn\'t meet, "no evidence found" (rule 9)', () => {
    const r = run(chart({ notes: [note('Sprained ankle, ice and rest.')] }))
    expect(r.outcome).toBe('does_not_meet')
    expect(diabetes(r).outcome).toBe('does_not_meet')
    expect(reasons(diabetes(r)).some((t) => /no evidence found/i.test(t))).toBe(true)
  })

  it('M-18 age 16, diagnosis list T2DM → doesn\'t meet (age)', () => {
    const r = run(chart({ dateOfBirth: '2010-06-01', diagnoses: [T2DM()] }))
    expect(r.outcome).toBe('does_not_meet')
    expect(age(r).outcome).toBe('does_not_meet')
    expect(age(r).evidence).toContainEqual({ type: 'age', years: 16 })
    expect(diabetes(r).outcome).toBe('meets')
  })

  it('M-19 date of birth missing, diagnosis list T2DM → needs review (age unknown)', () => {
    const r = run(chart({ dateOfBirth: null, diagnoses: [T2DM()] }))
    expect(r.outcome).toBe('needs_review')
    // AC-20.3: a missing value is unknown, never doesn't meet
    expect(age(r).outcome).toBe('needs_review')
    expect(age(r).evidence).toContainEqual({ type: 'age', years: null })
    expectAReason(age(r))
  })

  it('M-20 age exactly 18 today, diagnosis list T2DM → meets', () => {
    const r = run(chart({ dateOfBirth: '2008-11-14', diagnoses: [T2DM()] }))
    expect(r.outcome).toBe('meets')
    expect(age(r).outcome).toBe('meets')
    expect(age(r).evidence).toContainEqual({ type: 'age', years: 18 })
  })
})
