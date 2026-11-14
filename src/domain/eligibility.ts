// Study eligibility matcher: pure, deterministic, rule-based (Constitution III).
// Rules: spec.md "Study eligibility rules"; sentence handling and rule order:
// research.md R-12 (sentence classes), R-13 (outcome order), R-14 (criteria as data).
// No storage, network, clock or randomness: `today` is always passed in.
//
// Covers US-20 (AC-20.1, AC-20.2, AC-20.3) and US-23 (AC-23.1).

import { ageOn } from './dates'
import type {
  Criterion,
  CriterionResult,
  Diagnosis,
  EligibilityResult,
  Evidence,
  Note,
  Outcome,
  PatientChart,
  Study,
} from './types'

// ---- reasons shown to the physician (spec rules table, "Reason" column) -----

export const REASONS = {
  conflicting: 'Conflicting chart: diabetes is documented and also denied; physician reads it',
  gestational: "Gestational diabetes only; the study criteria don't say whether it counts",
  uncertain: 'Unclear note about diabetes; physician reads it',
  medication: 'Diabetes medication without a documented diagnosis',
  resolvedEntry: 'Diabetes entry on the diagnosis list is marked resolved',
  pendingTest: 'Glucose or HbA1c result not yet reviewed; leave open until the physician has seen it',
  notEvidence: 'Prediabetes, family history or a denial is not evidence the patient has diabetes',
  noEvidence: 'No evidence found',
  dobMissing: 'Date of birth missing; age unknown',
  underAge: (min: number) => `Under ${min}`,
  noRules: (condition: string) => `No rules defined for ${condition}`,
} as const

// ---- sentence handling (R-12) -------------------------------------------------

/** Split note text into sentences. "?diabetes" is not a split point; "word? Next" is. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

const MENTION = /(?:\b(?:pre-?)?diabet\w*)|\b(?:t1dm|t2dm|iddm|niddm)\b/i
const FAMILY = /\b(?:mother|father|siblings?|brother|sister|family history)\b/i
const PREDIABETES = /(?:\bpre-?diabet\w*)|\bborderline\b|\bimpaired fasting glucose\b/i
const NEGATION_BEFORE = /\b(?:no|denies|denied|not|without)\b/i
const RULED_OUT = /\bruled out\b/i
const GESTATIONAL = /\bgestational\b/i
const UNCERTAIN =
  /\?\s*(?:diabet|t[12]dm)|\b(?:possible|possibly|suspected|query|rule out|likely|probable)\b/i
const POSITIVE =
  /\bdiabetic\b|\bt[12]dm\b|\bdiabetes mellitus\b|\btype [12] diabetes\b|\b(?:has|have|known|diagnosed with|established)\s+diabetes\b/i
// OQ-05: diabetes medications that count as indirect evidence (rule 6)
const MEDICATION =
  /\b(?:metformin|insulin|gliclazide|glipizide|sitagliptin|empagliflozin|dapagliflozin|semaglutide|liraglutide|dulaglutide)\b/i
const GLUCOSE_TEST = /\b(?:hba1c|a1c|glucose)\b/i

export type SentenceClass =
  | 'family'
  | 'prediabetes'
  | 'denial'
  | 'gestational'
  | 'uncertain'
  | 'positive'
  | 'unclear'
  | 'medication'

/**
 * Classify one sentence. Returns null when the sentence says nothing relevant.
 * Order matters (R-12): family, prediabetes and negation are checked first, so only
 * what is left can count as a positive statement.
 */
export function classifySentence(sentence: string): SentenceClass | null {
  const mention = MENTION.exec(sentence)
  if (!mention) return MEDICATION.test(sentence) ? 'medication' : null

  if (FAMILY.test(sentence)) return 'family'
  if (PREDIABETES.test(sentence)) return 'prediabetes'
  // OQ-03: no/denies/not/without negate only when they come before the diabetes term
  const before = sentence.slice(0, mention.index)
  if (NEGATION_BEFORE.test(before) || RULED_OUT.test(sentence)) return 'denial'
  if (GESTATIONAL.test(sentence)) return 'gestational'
  if (UNCERTAIN.test(sentence)) return 'uncertain'
  if (POSITIVE.test(sentence)) return 'positive'
  // A mention that fits none of the above: unsure, so needs review (R-12 class 7)
  return 'unclear'
}

// ---- diabetes criterion (R-13) ------------------------------------------------

type NoteEvidence = Extract<Evidence, { type: 'note' }>
type DiagnosisEvidence = Extract<Evidence, { type: 'diagnosis' }>
type OrderEvidence = Extract<Evidence, { type: 'order' }>

interface DiabetesFindings {
  activeEntries: DiagnosisEvidence[]
  resolvedEntries: DiagnosisEvidence[]
  gestationalEntries: DiagnosisEvidence[]
  otherEntries: DiagnosisEvidence[] // prediabetes / family-history labels on the list
  sentences: Record<SentenceClass, NoteEvidence[]>
  pendingTests: OrderEvidence[]
}

function emptySentences(): Record<SentenceClass, NoteEvidence[]> {
  return {
    family: [],
    prediabetes: [],
    denial: [],
    gestational: [],
    uncertain: [],
    positive: [],
    unclear: [],
    medication: [],
  }
}

function diagnosisEvidence(d: Diagnosis): DiagnosisEvidence {
  return { type: 'diagnosis', label: d.label, status: d.status, date: d.recordedOn }
}

function collectDiabetesFindings(chart: PatientChart): DiabetesFindings {
  const findings: DiabetesFindings = {
    activeEntries: [],
    resolvedEntries: [],
    gestationalEntries: [],
    otherEntries: [],
    sentences: emptySentences(),
    pendingTests: [],
  }

  for (const d of chart.diagnoses) {
    const cls = classifySentence(d.label)
    if (cls === null || cls === 'medication') continue
    const ev = diagnosisEvidence(d)
    if (cls === 'gestational') findings.gestationalEntries.push(ev)
    else if (cls === 'family' || cls === 'prediabetes' || cls === 'denial') findings.otherEntries.push(ev)
    else if (d.status === 'active') findings.activeEntries.push(ev)
    else findings.resolvedEntries.push(ev) // OQ-06
  }

  // The matcher reads physician notes only (spec Key Entities: Note).
  const physicianNotes = chart.notes.filter((n: Note) => n.authorRole === 'physician')
  for (const n of physicianNotes) {
    for (const sentence of splitSentences(n.text)) {
      const cls = classifySentence(sentence)
      if (cls) findings.sentences[cls].push({ type: 'note', quote: sentence, date: n.date, noteId: n.id })
    }
  }

  for (const o of chart.orders) {
    if (GLUCOSE_TEST.test(o.test) && (o.status === 'pending' || o.status === 'resulted')) {
      findings.pendingTests.push({ type: 'order', test: o.test, status: o.status, orderId: o.id })
    }
  }

  return findings
}

function reason(text: string): Evidence {
  return { type: 'reason', text }
}

function evaluateDiabetes(criterion: Criterion, chart: PatientChart): CriterionResult {
  const f = collectDiabetesFindings(chart)
  const s = f.sentences
  const result = (outcome: Outcome, evidence: Evidence[]): CriterionResult => ({ criterion, outcome, evidence })

  // Rule 3: a positive finding (rule 1 or 2) and a denial → conflicting chart
  const hasPositive = f.activeEntries.length > 0 || s.positive.length > 0
  if (hasPositive && s.denial.length > 0) {
    return result('needs_review', [...f.activeEntries, ...s.positive, ...s.denial, reason(REASONS.conflicting)])
  }

  // Rule 1: active diabetes entry on the diagnosis list
  if (f.activeEntries.length > 0) return result('meets', f.activeEntries)

  // Rule 2: a physician note sentence clearly stating the patient has diabetes
  if (s.positive.length > 0) return result('meets', s.positive)

  // Rules 4–7 (plus OQ-06): anything uncertain → needs review, one reason per finding
  const review: Evidence[] = []
  if (f.gestationalEntries.length > 0 || s.gestational.length > 0) {
    review.push(...f.gestationalEntries, ...s.gestational, reason(REASONS.gestational))
  }
  if (s.uncertain.length > 0 || s.unclear.length > 0) {
    review.push(...s.uncertain, ...s.unclear, reason(REASONS.uncertain))
  }
  if (s.medication.length > 0) review.push(...s.medication, reason(REASONS.medication))
  if (f.resolvedEntries.length > 0) review.push(...f.resolvedEntries, reason(REASONS.resolvedEntry))
  if (f.pendingTests.length > 0) review.push(...f.pendingTests, reason(REASONS.pendingTest))
  if (review.length > 0) return result('needs_review', review)

  // Rule 8: only prediabetes, family history or a denial
  const notEvidence = [...f.otherEntries, ...s.prediabetes, ...s.family, ...s.denial]
  if (notEvidence.length > 0) return result('does_not_meet', [...notEvidence, reason(REASONS.notEvidence)])

  // Rule 9: no mention at all
  return result('does_not_meet', [reason(REASONS.noEvidence)])
}

// ---- criteria as data (R-14) --------------------------------------------------

type ConditionRule = (criterion: Criterion, chart: PatientChart) => CriterionResult

/** Vocabulary per condition. A study naming an unknown condition fails safe to needs review. */
const CONDITION_RULES: Record<string, ConditionRule> = {
  diabetes: evaluateDiabetes,
}

function evaluateAge(criterion: Extract<Criterion, { kind: 'minAge' }>, chart: PatientChart, today: string): CriterionResult {
  const years = ageOn(chart.patient.dateOfBirth, today)
  if (years === null) {
    // AC-20.3: missing value is unknown, never doesn't meet
    return { criterion, outcome: 'needs_review', evidence: [{ type: 'age', years: null }, reason(REASONS.dobMissing)] }
  }
  if (years < criterion.years) {
    return { criterion, outcome: 'does_not_meet', evidence: [{ type: 'age', years }, reason(REASONS.underAge(criterion.years))] }
  }
  return { criterion, outcome: 'meets', evidence: [{ type: 'age', years }] }
}

function evaluateCriterion(criterion: Criterion, chart: PatientChart, today: string): CriterionResult {
  switch (criterion.kind) {
    case 'minAge':
      return evaluateAge(criterion, chart, today)
    case 'diagnosis': {
      const rule = CONDITION_RULES[criterion.condition.toLowerCase()]
      if (!rule) {
        return { criterion, outcome: 'needs_review', evidence: [reason(REASONS.noRules(criterion.condition))] }
      }
      return rule(criterion, chart)
    }
  }
}

/** Any doesn't meet → doesn't meet; otherwise any needs review → needs review; otherwise meets. */
export function combineOutcomes(outcomes: Outcome[]): Outcome {
  if (outcomes.includes('does_not_meet')) return 'does_not_meet'
  if (outcomes.includes('needs_review')) return 'needs_review'
  return 'meets'
}

// ---- public API (contracts/eligibility.md) ------------------------------------

export function evaluateStudy(study: Study, chart: PatientChart, today: string): EligibilityResult {
  const criteria = study.criteria.map((c) => evaluateCriterion(c, chart, today))
  return { studyId: study.id, outcome: combineOutcomes(criteria.map((c) => c.outcome)), criteria }
}

export function evaluateAllStudies(studies: Study[], chart: PatientChart, today: string): EligibilityResult[] {
  return studies.map((s) => evaluateStudy(s, chart, today))
}
