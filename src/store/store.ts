// The only module that touches storage (Constitution V). Screens get data through the per-role
// selectors below, never the raw state (Constitution II). Contract: specs/.../contracts/store.md.
//
// - Starting state is src/data/seed.json, with every date shifted to the demo day (research R-07).
// - Every action validates first, then mutates, saves to localStorage and notifies (R-08).
// - Reception and nurse selectors build their output by explicit field picking (R-05).
// - Eligibility is computed on demand; actions that can change it return the change (R-10).

import { useSyncExternalStore } from 'react'
import seedData from '../data/seed.json'
import { addDays, isBefore, todayIso, daysBetween } from '../domain/dates'
import { evaluateAllStudies } from '../domain/eligibility'
import type {
  ClinicState,
  Diagnosis,
  EligibilityResult,
  Note,
  Observation,
  Order,
  Outcome,
  Outreach,
  OutreachAttempt,
  Patient,
  PatientChart,
  Study,
  StudyDecision,
  Task,
  Visit,
  VisitStatus,
} from '../domain/types'

export const STORAGE_KEY = 'kubcio:state:v1'
const SCHEMA_VERSION = 1

// ============================================================================
// Errors
// ============================================================================

/** Validation or state error. `fieldErrors` maps a form field to the message shown beside it. */
export class StoreError extends Error {
  readonly field: string
  readonly fieldErrors: Record<string, string>
  constructor(fieldErrors: Record<string, string>) {
    const [field, message] = Object.entries(fieldErrors)[0] ?? ['form', 'Invalid input']
    super(message)
    this.name = 'StoreError'
    this.field = field
    this.fieldErrors = fieldErrors
  }
}

const fail = (field: string, message: string): never => {
  throw new StoreError({ [field]: message })
}

// ============================================================================
// Storage, lifecycle, subscription
// ============================================================================

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

let state: ClinicState | null = null
let storage: StorageLike | null = null
let version = 0
let idCounter = 0
const listeners = new Set<() => void>()

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function current(): ClinicState {
  if (!state) initStore()
  return state as ClinicState
}

function save() {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage full or blocked: the demo keeps working in memory
  }
}

function emit() {
  version++
  for (const l of listeners) l()
}

/** Apply a mutation that has already been validated, then persist and notify. */
function commit(mutate: (s: ClinicState) => void) {
  mutate(current())
  save()
  emit()
}

function readSaved(): ClinicState | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ClinicState>
    if (parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.visits) || !Array.isArray(parsed.patients)) {
      return null
    }
    return parsed as ClinicState
  } catch {
    return null
  }
}

const shiftTs = (ts: string | null, days: number) =>
  ts === null ? null : new Date(Date.parse(ts) + days * 86_400_000).toISOString()
const shiftDate = (d: string | null, days: number) => (d === null ? null : addDays(d, days))

/** Seed with every date moved so that seedDate becomes `today` (R-07). */
function seedFor(today: string): ClinicState {
  const s = structuredClone(seedData) as unknown as ClinicState
  const days = daysBetween(s.seedDate, today)
  if (days === 0) return s
  s.seedDate = today
  for (const p of s.patients) p.dateOfBirth = shiftDate(p.dateOfBirth, days)
  for (const v of s.visits) {
    v.date = addDays(v.date, days)
    v.checkedInAt = shiftTs(v.checkedInAt, days)
  }
  for (const o of s.observations) o.recordedAt = shiftTs(o.recordedAt, days) as string
  for (const n of s.notes) n.date = addDays(n.date, days)
  for (const d of s.diagnoses) d.recordedOn = addDays(d.recordedOn, days)
  for (const o of s.orders) {
    o.resultedAt = shiftTs(o.resultedAt, days)
    o.reviewedAt = shiftTs(o.reviewedAt, days)
  }
  for (const t of s.tasks) t.dueDate = shiftDate(t.dueDate, days)
  for (const d of s.studyDecisions) d.decidedAt = shiftTs(d.decidedAt, days) as string
  for (const o of s.outreach) for (const a of o.attempts) a.at = shiftTs(a.at, days) as string
  return s
}

/** Load saved state if valid, otherwise the seed shifted to `today`. */
export function initStore(opts: { today?: string; storage?: StorageLike | null } = {}): void {
  storage = opts.storage !== undefined ? opts.storage : defaultStorage()
  const saved = readSaved()
  state = saved ?? seedFor(opts.today ?? todayIso(new Date()))
  if (!saved) save()
  emit()
}

/** AC-30.1: clear saved changes and reload the seed. The screen asks for confirmation first. */
export function resetDemo(today: string = todayIso(new Date())): void {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  state = seedFor(today)
  save()
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Re-render on every store change. Screens call selectors during render after this hook. */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

// ============================================================================
// Internal lookups and eligibility helpers
// ============================================================================

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(++idCounter).toString(36)}`

function getVisit(id: string): Visit {
  return current().visits.find((v) => v.id === id) ?? fail('visitId', 'Visit not found')
}
function getPatient(id: string): Patient {
  return current().patients.find((p) => p.id === id) ?? fail('patientId', 'Patient not found')
}
function getOrder(id: string): Order {
  return current().orders.find((o) => o.id === id) ?? fail('orderId', 'Order not found')
}
function getStudy(id: string): Study {
  return current().studies.find((s) => s.id === id) ?? fail('studyId', 'Study not found')
}

const NEXT_STATUS: Record<VisitStatus, VisitStatus | null> = {
  expected: 'checked_in',
  checked_in: 'ready_for_physician',
  ready_for_physician: 'with_physician',
  with_physician: 'checkout',
  checkout: 'done',
  done: null,
}

function requireStatus(visit: Visit, status: VisitStatus) {
  if (visit.status !== status) fail('status', `Visit is "${visit.status}", expected "${status}"`)
}

function chartFor(patientId: string): PatientChart {
  const s = current()
  const patient = getPatient(patientId)
  return {
    patient: { id: patient.id, dateOfBirth: patient.dateOfBirth },
    diagnoses: s.diagnoses.filter((d) => d.patientId === patientId),
    notes: s.notes.filter((n) => n.patientId === patientId),
    orders: s.orders.filter((o) => o.patientId === patientId),
  }
}

function eligibilityFor(patientId: string, today: string): EligibilityResult[] {
  return evaluateAllStudies(current().studies, chartFor(patientId), today)
}

function outcomeFor(patientId: string, studyId: string, today: string): Outcome {
  return evaluateAllStudies([getStudy(studyId)], chartFor(patientId), today)[0].outcome
}

export interface EligibilityChange {
  patientId: string
  studyId: string
  studyName: string
  from: Outcome
  to: Outcome
}

function diffEligibility(patientId: string, before: EligibilityResult[], after: EligibilityResult[]): EligibilityChange[] {
  return after.flatMap((a) => {
    const b = before.find((r) => r.studyId === a.studyId)
    if (!b || b.outcome === a.outcome) return []
    return [{ patientId, studyId: a.studyId, studyName: getStudy(a.studyId).name, from: b.outcome, to: a.outcome }]
  })
}

function outreachFor(patientId: string, studyId: string): Outreach | undefined {
  return current().outreach.find((o) => o.patientId === patientId && o.studyId === studyId)
}

function decisionFor(patientId: string, studyId: string): StudyDecision | undefined {
  return current().studyDecisions.find((d) => d.patientId === patientId && d.studyId === studyId)
}

function declinedStudyIds(patientId: string): string[] {
  return current()
    .outreach.filter((o) => o.patientId === patientId && o.outcome === 'declined')
    .map((o) => o.studyId)
}

function requireText(field: string, value: string | null | undefined, message: string): string {
  const v = (value ?? '').trim()
  if (!v) fail(field, message)
  return v
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Compare timestamps by instant, not by string: seed times are local ("…T09:38:00") while
 * times written by actions are UTC ("…Z"), so string order can be wrong. Nulls sort last.
 */
function byInstant(a: string | null, b: string | null): number {
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1
  return Date.parse(a) - Date.parse(b)
}

// ============================================================================
// Actions: E1 Reception arrival
// ============================================================================

/** AC-02.1–02.3: confirm reason and check in; booked reason is kept. */
export function checkIn(visitId: string, reason: string, now: Date = new Date()): void {
  const visit = getVisit(visitId)
  const confirmed = requireText('reason', reason, 'Enter the reason for the visit')
  requireStatus(visit, 'expected')
  commit(() => {
    visit.confirmedReason = confirmed
    visit.checkedInAt = now.toISOString()
    visit.status = 'checked_in'
  })
}

export interface PatientSearchResult {
  patientId: string
  name: string
  dateOfBirth: string | null
  phone: string
}

/** AC-03.1: name search, contact fields only. */
export function searchPatients(query: string): PatientSearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return current()
    .patients.filter((p) => p.name.toLowerCase().includes(q))
    .map((p) => ({ patientId: p.id, name: p.name, dateOfBirth: p.dateOfBirth, phone: p.phone }))
}

export type WalkInPatient = { patientId: string } | { name: string; dateOfBirth: string; phone: string }

/** AC-03.1–03.2: walk-in for an existing or new patient, created checked in with a required reason. */
export function registerWalkIn(
  who: WalkInPatient,
  reason: string,
  now: Date = new Date(),
): { patientId: string; visitId: string } {
  const errors: Record<string, string> = {}
  if (!reason.trim()) errors.reason = 'Enter the reason for the visit'
  let newPatient: Patient | null = null
  if ('patientId' in who) {
    getPatient(who.patientId)
  } else {
    if (!who.name.trim()) errors.name = 'Enter the patient name'
    if (!ISO_DATE.test(who.dateOfBirth)) errors.dateOfBirth = 'Enter date of birth as YYYY-MM-DD'
    if (!who.phone.trim()) errors.phone = 'Enter a phone number'
    newPatient = {
      id: newId('p'),
      name: who.name.trim(),
      dateOfBirth: who.dateOfBirth,
      phone: who.phone.trim(),
      studyCallOptOut: false,
    }
  }
  if (Object.keys(errors).length) throw new StoreError(errors)

  const patientId = newPatient ? newPatient.id : (who as { patientId: string }).patientId
  const visit: Visit = {
    id: newId('v'),
    patientId,
    date: todayIso(now),
    time: null,
    bookedReason: null,
    confirmedReason: reason.trim(),
    walkIn: true,
    status: 'checked_in',
    checkedInAt: now.toISOString(),
  }
  commit((s) => {
    if (newPatient) s.patients.push(newPatient)
    s.visits.push(visit)
  })
  return { patientId, visitId: visit.id }
}

// ============================================================================
// Actions: E2 Nurse intake
// ============================================================================

export interface IntakeInput {
  bpSystolic?: string
  bpDiastolic?: string
  weightKg?: string
  tempC?: string
  patientReport: string
}

/** AC-06.1–06.3: vitals optional but numeric; patient report required. Nothing is saved on error. */
export function saveIntake(visitId: string, input: IntakeInput, now: Date = new Date()): void {
  const visit = getVisit(visitId)
  const errors: Record<string, string> = {}
  const num = (field: keyof IntakeInput): number | null => {
    const raw = (input[field] ?? '').trim()
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      errors[field] = 'Enter a number'
      return null
    }
    return n
  }
  const observation: Observation = {
    visitId,
    bpSystolic: num('bpSystolic'),
    bpDiastolic: num('bpDiastolic'),
    weightKg: num('weightKg'),
    tempC: num('tempC'),
    patientReport: input.patientReport.trim(),
    recordedAt: now.toISOString(),
  }
  if (!observation.patientReport) errors.patientReport = 'Enter what the patient reports'
  if (Object.keys(errors).length) throw new StoreError(errors)
  requireStatus(visit, 'checked_in')

  commit((s) => {
    s.observations = s.observations.filter((o) => o.visitId !== visitId)
    s.observations.push(observation)
    visit.status = 'ready_for_physician'
  })
}

// ============================================================================
// Actions: E3 Physician visit
// ============================================================================

/** AC-08.1: opening a ready visit sets "with physician"; reopening is allowed. */
export function openVisit(visitId: string): void {
  const visit = getVisit(visitId)
  if (visit.status === 'with_physician') return
  requireStatus(visit, 'ready_for_physician')
  commit(() => {
    visit.status = 'with_physician'
  })
}

/** AC-09.1–09.2: physician note on the visit; returns any study outcome change. */
export function saveNote(visitId: string, text: string, now: Date = new Date()): EligibilityChange[] {
  const visit = getVisit(visitId)
  const body = requireText('text', text, 'Write the note before saving')
  const today = todayIso(now)
  const before = eligibilityFor(visit.patientId, today)
  commit((s) => {
    s.notes.push({ id: newId('n'), patientId: visit.patientId, visitId, date: today, authorRole: 'physician', text: body })
  })
  return diffEligibility(visit.patientId, before, eligibilityFor(visit.patientId, today))
}

/** AC-10.1: test name and reason required; saved as pending. */
export function createOrder(visitId: string, test: string, reason: string): string {
  const visit = getVisit(visitId)
  const errors: Record<string, string> = {}
  if (!test.trim()) errors.test = 'Enter the test name'
  if (!reason.trim()) errors.reason = 'Enter why the test is ordered'
  if (Object.keys(errors).length) throw new StoreError(errors)
  const order: Order = {
    id: newId('o'),
    patientId: visit.patientId,
    visitId,
    test: test.trim(),
    reasonOrdered: reason.trim(),
    status: 'pending',
    value: null,
    resultedAt: null,
    reviewedAt: null,
    reviewNote: null,
  }
  commit((s) => {
    s.orders.push(order)
  })
  return order.id
}

export type TaskTiming =
  | { kind: 'date'; date: string }
  | { kind: 'inDays'; days: number }
  | { kind: 'afterResult'; orderId: string; offsetDays: number }

export interface CreateTaskInput {
  visitId: string
  action: string
  timing: TaskTiming
}

/** Check a task's fields without saving; throws StoreError with every field problem at once. */
function validateTaskInput(input: CreateTaskInput): void {
  const visit = getVisit(input.visitId)
  const errors: Record<string, string> = {}
  if (!input.action.trim()) errors.action = 'Describe what reception should arrange'
  const t = input.timing
  if (t.kind === 'date' && !ISO_DATE.test(t.date)) errors.date = 'Pick a due date'
  if (t.kind === 'inDays' && (!Number.isInteger(t.days) || t.days < 0)) errors.days = 'Enter a whole number of days'
  if (t.kind === 'afterResult') {
    if (!Number.isInteger(t.offsetDays) || t.offsetDays < 0) errors.offsetDays = 'Enter a whole number of days'
    const order = current().orders.find((o) => o.id === t.orderId)
    if (!order || order.patientId !== visit.patientId) errors.orderId = 'Pick an order for this patient'
  }
  if (Object.keys(errors).length) throw new StoreError(errors)
}

/**
 * AC-11.1–11.3, AC-17.2: reception task with a date, "in N days" (stored as a date), or
 * "N days after result of [order]" (waiting). OQ-11: if that order is already reviewed,
 * the task is open, due review date + N.
 */
export function createTask(input: CreateTaskInput, now: Date = new Date()): string {
  validateTaskInput(input)
  const visit = getVisit(input.visitId)
  const action = input.action.trim()
  const today = todayIso(now)
  const base = { id: newId('t'), patientId: visit.patientId, visitId: visit.id, assignee: 'reception' as const, action }
  let task: Task
  const t = input.timing
  if (t.kind === 'date') {
    if (!ISO_DATE.test(t.date)) fail('date', 'Pick a due date')
    task = { ...base, dueType: 'date', dueDate: t.date, waitsOnOrderId: null, offsetDays: null, status: 'open' }
  } else if (t.kind === 'inDays') {
    if (!Number.isInteger(t.days) || t.days < 0) fail('days', 'Enter a whole number of days')
    task = { ...base, dueType: 'date', dueDate: addDays(today, t.days), waitsOnOrderId: null, offsetDays: null, status: 'open' }
  } else {
    if (!Number.isInteger(t.offsetDays) || t.offsetDays < 0) fail('offsetDays', 'Enter a whole number of days')
    const order = getOrder(t.orderId)
    if (order.patientId !== visit.patientId) fail('orderId', 'Pick an order for this patient')
    const reviewed = order.status === 'reviewed' && order.reviewedAt
    task = {
      ...base,
      dueType: 'after_result',
      dueDate: reviewed ? addDays(todayIso(new Date(order.reviewedAt as string)), t.offsetDays) : null,
      waitsOnOrderId: order.id,
      offsetDays: t.offsetDays,
      status: reviewed ? 'open' : 'waiting',
    }
  }
  commit((s) => {
    s.tasks.push(task)
  })
  return task.id
}

/** AC-12.1: send the patient to checkout. */
export function finishVisit(visitId: string): void {
  const visit = getVisit(visitId)
  requireStatus(visit, 'with_physician')
  commit(() => {
    visit.status = NEXT_STATUS.with_physician as VisitStatus
  })
}

// ============================================================================
// Actions: E4 Checkout and tasks
// ============================================================================

/** AC-14.1: mark an open task done. Waiting tasks have no date yet and stay waiting. */
export function markTaskDone(taskId: string): void {
  const task = current().tasks.find((t) => t.id === taskId) ?? fail('taskId', 'Task not found')
  if (task.status !== 'open') fail('status', 'Only open tasks can be marked done')
  commit(() => {
    task.status = 'done'
  })
}

/** AC-14.2: patient left; visit done; waiting tasks stay on the list. */
export function markLeft(visitId: string): void {
  const visit = getVisit(visitId)
  requireStatus(visit, 'checkout')
  commit(() => {
    visit.status = 'done'
  })
}

// ============================================================================
// Actions: E5 Results (simulateResult is the E8 demo control, AC-29.1)
// ============================================================================

/** AC-29.1: a pending order becomes resulted now. */
export function simulateResult(orderId: string, value: string, now: Date = new Date()): void {
  const order = getOrder(orderId)
  const v = requireText('value', value, 'Enter the result value')
  if (order.status !== 'pending') fail('status', 'Only pending orders can receive a result')
  commit(() => {
    order.status = 'resulted'
    order.value = v
    order.resultedAt = now.toISOString()
  })
}

/** AC-17.2: optional reception task created from the review screen (same timing options as AC-11.2). */
export type ReviewFollowUp = Omit<CreateTaskInput, 'visitId'>

/**
 * AC-17.1–17.2, AC-18.1–18.2, AC-19.2: review a result. Also saves the review note as a physician
 * note (OQ-02), opens every task waiting on this order with due = review date + offset, optionally
 * creates a follow-up task, and returns any study outcome change. The note and the follow-up are
 * validated together before anything is saved.
 */
export function reviewResult(
  orderId: string,
  note: string,
  now: Date = new Date(),
  followUp?: ReviewFollowUp,
): EligibilityChange[] {
  const order = getOrder(orderId)
  const errors: Record<string, string> = {}
  if (!note.trim()) errors.note = 'Write a short review note'
  if (followUp) {
    try {
      validateTaskInput({ ...followUp, visitId: order.visitId })
    } catch (e) {
      if (e instanceof StoreError) Object.assign(errors, e.fieldErrors)
      else throw e
    }
  }
  if (Object.keys(errors).length) throw new StoreError(errors)
  const text = note.trim()
  if (order.status !== 'resulted') fail('status', 'Only resulted orders can be reviewed')
  const reviewDate = todayIso(now)
  const before = eligibilityFor(order.patientId, reviewDate)
  commit((s) => {
    order.status = 'reviewed'
    order.reviewedAt = now.toISOString()
    order.reviewNote = text
    s.notes.push({
      id: newId('n'),
      patientId: order.patientId,
      visitId: order.visitId,
      date: reviewDate,
      authorRole: 'physician',
      text,
    })
    for (const t of s.tasks) {
      if (t.waitsOnOrderId === order.id && t.status === 'waiting') {
        t.status = 'open'
        t.dueDate = addDays(reviewDate, t.offsetDays ?? 0)
      }
    }
  })
  // Created after the review, so a task tied to this order opens with due = review date + N (OQ-11).
  if (followUp) createTask({ ...followUp, visitId: order.visitId }, now)
  return diffEligibility(order.patientId, before, eligibilityFor(order.patientId, reviewDate))
}

// ============================================================================
// Actions: E6 Study decisions, E7 Outreach
// ============================================================================

/** AC-22.1–22.2: approve (meets or needs review only; not opted out or declined) or not eligible. */
export function decideStudy(
  patientId: string,
  studyId: string,
  decision: StudyDecision['decision'],
  now: Date = new Date(),
): void {
  const patient = getPatient(patientId)
  getStudy(studyId)
  if (decision === 'approve_contact') {
    const outcome = outcomeFor(patientId, studyId, todayIso(now))
    if (outcome === 'does_not_meet') fail('decision', 'Only patients who meet or need review can be approved')
    if (patient.studyCallOptOut) fail('decision', 'Patient asked for no study calls')
    if (outreachFor(patientId, studyId)?.outcome === 'declined') fail('decision', 'Patient declined this study')
  }
  const record: StudyDecision = { patientId, studyId, decision, decidedBy: 'physician', decidedAt: now.toISOString() }
  commit((s) => {
    s.studyDecisions = s.studyDecisions.filter((d) => !(d.patientId === patientId && d.studyId === studyId))
    s.studyDecisions.push(record)
  })
}

export interface CallInput {
  reached: boolean
  result: OutreachAttempt['result']
}

/** AC-25.1–25.3: log an attempt; declined or consented closes outreach for that study. */
export function logCall(patientId: string, studyId: string, call: CallInput, now: Date = new Date()): void {
  getPatient(patientId)
  getStudy(studyId)
  if (decisionFor(patientId, studyId)?.decision !== 'approve_contact') fail('decision', 'Patient is not approved for contact')
  const existing = outreachFor(patientId, studyId)
  if (existing && existing.outcome !== 'none') fail('outcome', `Outreach already closed: ${existing.outcome}`)
  if (call.reached && !call.result) fail('result', 'Record what the patient said')
  if (!call.reached && call.result) fail('result', 'No result when the patient was not reached')
  const attempt: OutreachAttempt = { at: now.toISOString(), reached: call.reached, result: call.reached ? call.result : null }
  commit((s) => {
    let record = existing
    if (!record) {
      record = { patientId, studyId, attempts: [], outcome: 'none' }
      s.outreach.push(record)
    }
    record.attempts.push(attempt)
    if (attempt.result === 'declined' || attempt.result === 'consented') record.outcome = attempt.result
  })
}

/** AC-27.1: reception or physician sets "No study calls". */
export function setOptOut(patientId: string, value: boolean): void {
  const patient = getPatient(patientId)
  commit(() => {
    patient.studyCallOptOut = value
  })
}

// ============================================================================
// Selectors: Reception (contact, reasons, tasks, outreach; never clinical data)
// ============================================================================

export interface ReceptionVisitRow {
  visitId: string
  patientId: string
  name: string
  phone: string
  time: string | null
  bookedReason: string | null
  confirmedReason: string | null
  status: VisitStatus
  walkIn: boolean
}

function receptionVisitRow(v: Visit): ReceptionVisitRow {
  const p = getPatient(v.patientId)
  return {
    visitId: v.id,
    patientId: p.id,
    name: p.name,
    phone: p.phone,
    time: v.time,
    bookedReason: v.bookedReason,
    confirmedReason: v.confirmedReason,
    status: v.status,
    walkIn: v.walkIn,
  }
}

/** AC-01.1–01.3, AC-04.1: today's visits sorted by time; walk-ins after booked times, by arrival. */
export function selectExpectedToday(today: string = todayIso(new Date())): ReceptionVisitRow[] {
  return current()
    .visits.filter((v) => v.date === today)
    .sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time)
      if (a.time) return -1
      if (b.time) return 1
      return byInstant(a.checkedInAt, b.checkedInAt)
    })
    .map(receptionVisitRow)
}

export interface ReceptionTask {
  taskId: string
  patientId: string
  name: string
  phone: string
  action: string
  status: 'open' | 'waiting'
  dueDate: string | null
  overdue: boolean
  /** "after result, date to be set" for waiting tasks (AC-13.2), otherwise the due date. */
  dueLabel: string
}

export const WAITING_LABEL = 'after result, date to be set'

function receptionTask(t: Task, today: string): ReceptionTask {
  const p = getPatient(t.patientId)
  const status = t.status === 'waiting' ? 'waiting' : 'open'
  return {
    taskId: t.id,
    patientId: p.id,
    name: p.name,
    phone: p.phone,
    action: t.action,
    status,
    dueDate: status === 'open' ? t.dueDate : null,
    overdue: status === 'open' && t.dueDate !== null && isBefore(t.dueDate, today),
    dueLabel: status === 'waiting' ? WAITING_LABEL : (t.dueDate ?? ''),
  }
}

function byDueThenWaiting(a: Task, b: Task): number {
  if (a.status !== b.status) return a.status === 'open' ? -1 : 1
  return (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.id.localeCompare(b.id)
}

/** AC-15.1–15.2, AC-18.3: open tasks by due date, then waiting tasks, across all patients. */
export function selectReceptionTasks(today: string = todayIso(new Date())): ReceptionTask[] {
  return current()
    .tasks.filter((t) => t.status === 'open' || t.status === 'waiting')
    .sort(byDueThenWaiting)
    .map((t) => receptionTask(t, today))
}

export interface ReceptionCheckoutRow {
  visitId: string
  patientId: string
  name: string
  phone: string
}

/** AC-12.1: patients the physician has sent to checkout. */
export function selectCheckoutList(): ReceptionCheckoutRow[] {
  return current()
    .visits.filter((v) => v.status === 'checkout')
    .map((v) => {
      const p = getPatient(v.patientId)
      return { visitId: v.id, patientId: p.id, name: p.name, phone: p.phone }
    })
}

export interface ReceptionCheckoutCard extends ReceptionCheckoutRow {
  studyCallOptOut: boolean
  tasks: ReceptionTask[]
}

/** AC-13.1–13.3: name, phone, open and waiting tasks; no assessment, nurse notes or chart. */
export function selectCheckoutCard(visitId: string, today: string = todayIso(new Date())): ReceptionCheckoutCard {
  const v = getVisit(visitId)
  const p = getPatient(v.patientId)
  return {
    visitId: v.id,
    patientId: p.id,
    name: p.name,
    phone: p.phone,
    studyCallOptOut: p.studyCallOptOut,
    tasks: current()
      .tasks.filter((t) => t.patientId === p.id && (t.status === 'open' || t.status === 'waiting'))
      .sort(byDueThenWaiting)
      .map((t) => receptionTask(t, today)),
  }
}

export interface ReceptionOutreachRow {
  patientId: string
  name: string
  phone: string
  studyId: string
  studyName: string
  attempts: { at: string; reached: boolean; result: OutreachAttempt['result'] }[]
}

/**
 * AC-22.3, AC-24.1–24.2, AC-26.2, AC-27.2: approved patients with no outcome yet, excluding
 * opted-out and declined, and (OQ-10) anyone whose current outcome is doesn't meet.
 * Eligibility is used to filter only; it is never returned.
 */
export function selectOutreachList(today: string = todayIso(new Date())): ReceptionOutreachRow[] {
  return current()
    .studyDecisions.filter((d) => d.decision === 'approve_contact')
    .flatMap((d) => {
      const p = getPatient(d.patientId)
      const record = outreachFor(d.patientId, d.studyId)
      if (p.studyCallOptOut) return []
      if (record && record.outcome !== 'none') return []
      if (outcomeFor(d.patientId, d.studyId, today) === 'does_not_meet') return []
      return [
        {
          patientId: p.id,
          name: p.name,
          phone: p.phone,
          studyId: d.studyId,
          studyName: getStudy(d.studyId).name,
          attempts: (record?.attempts ?? []).map((a) => ({ at: a.at, reached: a.reached, result: a.result })),
        },
      ]
    })
}

export interface ReceptionStudyFlags {
  patientId: string
  studyCallOptOut: boolean
  declinedStudyIds: string[]
}

/** AC-26.1, AC-27.2: flags reception may see; no outcome or evidence. */
export function selectReceptionStudyFlags(patientId: string): ReceptionStudyFlags {
  const p = getPatient(patientId)
  return { patientId: p.id, studyCallOptOut: p.studyCallOptOut, declinedStudyIds: declinedStudyIds(p.id) }
}

// ============================================================================
// Selectors: Nurse (observations, read-only history; no physician notes, orders or eligibility)
// ============================================================================

export interface NurseQueueItem {
  visitId: string
  patientId: string
  name: string
  confirmedReason: string | null
  checkedInAt: string | null
}

/** AC-05.1–05.2: checked-in patients by arrival time; they leave once intake is saved. */
export function selectNurseQueue(): NurseQueueItem[] {
  return current()
    .visits.filter((v) => v.status === 'checked_in')
    .sort((a, b) => byInstant(a.checkedInAt, b.checkedInAt))
    .map((v) => {
      const p = getPatient(v.patientId)
      return { visitId: v.id, patientId: p.id, name: p.name, confirmedReason: v.confirmedReason, checkedInAt: v.checkedInAt }
    })
}

export interface ObservationView {
  bpSystolic: number | null
  bpDiastolic: number | null
  weightKg: number | null
  tempC: number | null
  patientReport: string
  recordedAt: string
}

const observationView = (o: Observation): ObservationView => ({
  bpSystolic: o.bpSystolic,
  bpDiastolic: o.bpDiastolic,
  weightKg: o.weightKg,
  tempC: o.tempC,
  patientReport: o.patientReport,
  recordedAt: o.recordedAt,
})

export interface NurseIntakeView {
  visitId: string
  patientId: string
  name: string
  dateOfBirth: string | null
  phone: string
  confirmedReason: string | null
  priorObservations: ObservationView[]
  diagnoses: { label: string; status: Diagnosis['status']; recordedOn: string }[]
  nurseNotes: { date: string; text: string }[]
}

/** AC-06.4: history read-only, without the physician's assessment (OQ-01: no physician notes). */
export function selectNurseIntake(visitId: string): NurseIntakeView {
  const s = current()
  const v = getVisit(visitId)
  const p = getPatient(v.patientId)
  const patientVisitIds = new Set(s.visits.filter((x) => x.patientId === p.id && x.id !== v.id).map((x) => x.id))
  return {
    visitId: v.id,
    patientId: p.id,
    name: p.name,
    dateOfBirth: p.dateOfBirth,
    phone: p.phone,
    confirmedReason: v.confirmedReason,
    priorObservations: s.observations
      .filter((o) => patientVisitIds.has(o.visitId))
      .sort((a, b) => byInstant(b.recordedAt, a.recordedAt))
      .map(observationView),
    diagnoses: s.diagnoses
      .filter((d) => d.patientId === p.id)
      .map((d) => ({ label: d.label, status: d.status, recordedOn: d.recordedOn })),
    nurseNotes: s.notes
      .filter((n) => n.patientId === p.id && n.authorRole === 'nurse')
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((n) => ({ date: n.date, text: n.text })),
  }
}

// ============================================================================
// Selectors: Physician (full clinical picture)
// ============================================================================

export interface ReadyRow {
  visitId: string
  patientId: string
  name: string
  confirmedReason: string | null
  minutesWaiting: number | null
}

/** AC-07.1: ready patients, reason and time waiting since intake was saved (OQ-08). */
export function selectReadyForPhysician(now: Date = new Date()): ReadyRow[] {
  const s = current()
  return s.visits
    .filter((v) => v.status === 'ready_for_physician')
    .map((v) => {
      const p = getPatient(v.patientId)
      const obs = s.observations.find((o) => o.visitId === v.id)
      return {
        visitId: v.id,
        patientId: p.id,
        name: p.name,
        confirmedReason: v.confirmedReason,
        minutesWaiting: obs ? Math.max(0, Math.round((now.getTime() - Date.parse(obs.recordedAt)) / 60_000)) : null,
      }
    })
    .sort((a, b) => (b.minutesWaiting ?? 0) - (a.minutesWaiting ?? 0))
}

export interface InProgressRow {
  visitId: string
  patientId: string
  name: string
  confirmedReason: string | null
}

/** Visits the physician has opened but not finished, so they can return to them. */
export function selectWithPhysician(): InProgressRow[] {
  return current()
    .visits.filter((v) => v.status === 'with_physician')
    .map((v) => {
      const p = getPatient(v.patientId)
      return { visitId: v.id, patientId: p.id, name: p.name, confirmedReason: v.confirmedReason }
    })
}

export interface VisitSummary {
  visitId: string
  status: VisitStatus
  bookedReason: string | null
  confirmedReason: string | null
  patient: Patient
  observation: Observation | null
  activeDiagnoses: Diagnosis[]
  recentNotes: Note[]
  resultsAwaitingReview: Order[]
  pendingOrders: Order[]
  eligibility: EligibilityResult[]
  declinedStudyIds: string[]
  decisions: StudyDecision[]
  /** Reception tasks created in this visit (visibility table: physician sees reception tasks). */
  receptionTasks: Task[]
}

/** AC-08.2–08.3, AC-26.1: one-screen summary with study outcomes and flags. */
export function selectVisitSummary(visitId: string, today: string = todayIso(new Date())): VisitSummary {
  const s = current()
  const v = getVisit(visitId)
  const p = getPatient(v.patientId)
  const obs = s.observations.find((o) => o.visitId === v.id)
  return {
    visitId: v.id,
    status: v.status,
    bookedReason: v.bookedReason,
    confirmedReason: v.confirmedReason,
    patient: { ...p },
    observation: obs ? { ...obs } : null,
    activeDiagnoses: s.diagnoses.filter((d) => d.patientId === p.id && d.status === 'active').map((d) => ({ ...d })),
    recentNotes: s.notes
      .filter((n) => n.patientId === p.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
      .map((n) => ({ ...n })),
    resultsAwaitingReview: s.orders.filter((o) => o.patientId === p.id && o.status === 'resulted').map((o) => ({ ...o })),
    pendingOrders: s.orders.filter((o) => o.patientId === p.id && o.status === 'pending').map((o) => ({ ...o })),
    eligibility: eligibilityFor(p.id, today),
    declinedStudyIds: declinedStudyIds(p.id),
    decisions: s.studyDecisions.filter((d) => d.patientId === p.id).map((d) => ({ ...d })),
    receptionTasks: s.tasks.filter((t) => t.visitId === v.id).map((t) => ({ ...t })),
  }
}

export interface ResultsInboxRow {
  orderId: string
  visitId: string
  patientId: string
  name: string
  test: string
  reasonOrdered: string
  value: string | null
  resultedAt: string | null
  /** AC-19.2: names of studies whose outcome for this patient is needs review. */
  studiesNeedingReview: string[]
}

/** AC-16.1, AC-19.1–19.2: resulted orders, oldest first, with a study needs-review flag. */
export function selectResultsInbox(today: string = todayIso(new Date())): ResultsInboxRow[] {
  return current()
    .orders.filter((o) => o.status === 'resulted')
    .sort((a, b) => byInstant(a.resultedAt, b.resultedAt))
    .map((o) => ({
      orderId: o.id,
      visitId: o.visitId,
      patientId: o.patientId,
      name: getPatient(o.patientId).name,
      test: o.test,
      reasonOrdered: o.reasonOrdered,
      value: o.value,
      resultedAt: o.resultedAt,
      studiesNeedingReview: eligibilityFor(o.patientId, today)
        .filter((r) => r.outcome === 'needs_review')
        .map((r) => getStudy(r.studyId).name),
    }))
}

/** AC-16.2: count for the navigation badge. */
export function selectResultsCount(): number {
  return current().orders.filter((o) => o.status === 'resulted').length
}

export interface Candidate {
  patientId: string
  name: string
  result: EligibilityResult
  studyCallOptOut: boolean
  declined: boolean
  decision: StudyDecision | null
  canApprove: boolean
}

/**
 * AC-21.1–21.2, AC-22.2: patients who meet or need review, needs review first; not-eligible
 * decisions removed; opted-out and declined stay visible, flagged, without approve.
 */
export function selectCandidates(studyId: string, today: string = todayIso(new Date())): Candidate[] {
  const study = getStudy(studyId)
  const rank: Record<Outcome, number> = { needs_review: 0, meets: 1, does_not_meet: 2 }
  return current()
    .patients.flatMap((p) => {
      const result = evaluateAllStudies([study], chartFor(p.id), today)[0]
      if (result.outcome === 'does_not_meet') return []
      const decision = decisionFor(p.id, studyId) ?? null
      if (decision?.decision === 'not_eligible') return []
      const declined = outreachFor(p.id, studyId)?.outcome === 'declined'
      return [
        {
          patientId: p.id,
          name: p.name,
          result,
          studyCallOptOut: p.studyCallOptOut,
          declined,
          decision: decision ? { ...decision } : null,
          canApprove: !p.studyCallOptOut && !declined && decision?.decision !== 'approve_contact',
        },
      ]
    })
    .sort((a, b) => rank[a.result.outcome] - rank[b.result.outcome] || a.name.localeCompare(b.name))
}

/** AC-20.1–20.3: each study's outcome with per-criterion evidence. */
export function selectEligibility(patientId: string, today: string = todayIso(new Date())): EligibilityResult[] {
  return eligibilityFor(patientId, today)
}

/** Study list (names and criteria) for the physician's Studies tab. */
export function selectStudies(): Study[] {
  return current().studies.map((s) => ({ ...s, criteria: s.criteria.map((c) => ({ ...c })) }))
}

export interface PendingOrderRow {
  orderId: string
  patientId: string
  name: string
  test: string
  reasonOrdered: string
}

/** AC-29.1, OQ-09: pending orders for the physician-only "simulate result" control. */
export function selectPendingOrders(): PendingOrderRow[] {
  return current()
    .orders.filter((o) => o.status === 'pending')
    .map((o) => ({
      orderId: o.id,
      patientId: o.patientId,
      name: getPatient(o.patientId).name,
      test: o.test,
      reasonOrdered: o.reasonOrdered,
    }))
}
