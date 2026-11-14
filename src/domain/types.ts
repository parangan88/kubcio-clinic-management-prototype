// Entity and eligibility types.
// Source: specs/001-clinic-handoff-prototype/data-model.md and contracts/eligibility.md.
// Dates are 'YYYY-MM-DD' strings; timestamps are full ISO strings.

// ---- entities ---------------------------------------------------------------

export interface Patient {
  id: string
  name: string
  dateOfBirth: string | null
  phone: string
  studyCallOptOut: boolean
}

export type VisitStatus =
  | 'expected'
  | 'checked_in'
  | 'ready_for_physician'
  | 'with_physician'
  | 'checkout'
  | 'done'

export interface Visit {
  id: string
  patientId: string
  date: string
  time: string | null
  bookedReason: string | null
  confirmedReason: string | null
  walkIn: boolean
  status: VisitStatus
  checkedInAt: string | null
}

export interface Observation {
  visitId: string
  bpSystolic: number | null
  bpDiastolic: number | null
  weightKg: number | null
  tempC: number | null
  patientReport: string
  recordedAt: string
}

export type AuthorRole = 'physician' | 'nurse'

export interface Note {
  id: string
  patientId: string
  visitId: string | null
  date: string
  authorRole: AuthorRole
  text: string
}

export interface Diagnosis {
  id: string
  patientId: string
  label: string
  status: 'active' | 'resolved'
  recordedOn: string
}

export type OrderStatus = 'pending' | 'resulted' | 'reviewed'

export interface Order {
  id: string
  patientId: string
  visitId: string
  test: string
  reasonOrdered: string
  status: OrderStatus
  value: string | null
  resultedAt: string | null
  reviewedAt: string | null
  reviewNote: string | null
}

export interface Task {
  id: string
  patientId: string
  visitId: string | null
  assignee: 'reception'
  action: string
  dueType: 'date' | 'after_result'
  dueDate: string | null
  waitsOnOrderId: string | null
  offsetDays: number | null
  status: 'waiting' | 'open' | 'done'
}

export type Criterion =
  | { kind: 'minAge'; years: number }
  | { kind: 'diagnosis'; condition: string }

export interface Study {
  id: string
  name: string
  criteria: Criterion[]
}

export interface StudyDecision {
  patientId: string
  studyId: string
  decision: 'approve_contact' | 'not_eligible'
  decidedBy: 'physician'
  decidedAt: string
}

export interface OutreachAttempt {
  at: string
  reached: boolean
  result: 'declined' | 'consented' | 'call_back_later' | null
}

export interface Outreach {
  patientId: string
  studyId: string
  attempts: OutreachAttempt[]
  outcome: 'none' | 'declined' | 'consented'
}

export interface ClinicState {
  schemaVersion: 1
  seedDate: string
  patients: Patient[]
  visits: Visit[]
  observations: Observation[]
  notes: Note[]
  diagnoses: Diagnosis[]
  orders: Order[]
  tasks: Task[]
  studies: Study[]
  studyDecisions: StudyDecision[]
  outreach: Outreach[]
}

// ---- eligibility (computed on demand, never stored) -------------------------

export type Outcome = 'meets' | 'does_not_meet' | 'needs_review'

export interface PatientChart {
  patient: { id: string; dateOfBirth: string | null }
  diagnoses: Diagnosis[]
  notes: Note[]
  orders: Order[]
}

export type Evidence =
  | { type: 'diagnosis'; label: string; status: 'active' | 'resolved'; date: string }
  | { type: 'note'; quote: string; date: string; noteId: string }
  | { type: 'order'; test: string; status: 'pending' | 'resulted'; orderId: string }
  | { type: 'age'; years: number | null }
  | { type: 'reason'; text: string }

export interface CriterionResult {
  criterion: Criterion
  outcome: Outcome
  evidence: Evidence[]
}

export interface EligibilityResult {
  studyId: string
  outcome: Outcome
  criteria: CriterionResult[]
}
