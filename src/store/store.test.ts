// Data-layer tests (Phase 2). IDs in test names trace to spec.md.
// (a) seeded matcher cases (AC-30.2, SC-005)  (b) S-05 reception visibility (AC-01.3, AC-13.3, AC-24.2)
// (c) S-06 due dates (AC-11.2, AC-15.1)        (d) AC-18 waiting tasks open on review
// plus persistence and reset (S-13, S-14, AC-30.1).
import { beforeEach, describe, expect, it } from 'vitest'
import seed from '../data/seed.json'
import { REASONS } from '../domain/eligibility'
import type { Outcome } from '../domain/types'
import * as store from './store'

const TODAY = '2026-11-14'
/** A moment on a given day, mid-morning UTC so the local calendar date matches in any common timezone. */
const at = (time: string, date = TODAY) => new Date(`${date}T${time}:00.000Z`)

function memoryStorage(): store.StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

let storage: ReturnType<typeof memoryStorage>

beforeEach(() => {
  storage = memoryStorage()
  store.initStore({ today: TODAY, storage })
})

// ---- (a) matcher over every seeded M-case patient ---------------------------

const EXPECTED: Record<string, Outcome> = {
  'm-01': 'meets',
  'm-02': 'meets',
  'm-03': 'meets',
  'm-04': 'meets',
  'm-05': 'meets',
  'm-06': 'does_not_meet',
  'm-07': 'does_not_meet',
  'm-08': 'does_not_meet',
  'm-09': 'does_not_meet',
  'm-10': 'does_not_meet',
  'm-11': 'needs_review',
  'm-12': 'needs_review',
  'm-13': 'needs_review',
  'm-14': 'needs_review',
  'm-15': 'needs_review',
  'm-16': 'needs_review',
  'm-17': 'does_not_meet',
  'm-18': 'does_not_meet',
  'm-19': 'needs_review',
  'm-20': 'meets',
}

describe('(a) seeded matcher cases (AC-30.2)', () => {
  it('AC-30.2 the seed has exactly one patient per matcher case M-01 to M-20', () => {
    const ids = seed.patients.map((p) => p.id).filter((id) => /^m-\d\d$/.test(id)).sort()
    expect(ids).toEqual(Object.keys(EXPECTED).sort())
  })

  for (const [id, outcome] of Object.entries(EXPECTED)) {
    it(`${id.toUpperCase()} seeded patient → ${outcome}, with evidence on every criterion`, () => {
      const [result] = store.selectEligibility(id, TODAY)
      expect(result.outcome).toBe(outcome)
      for (const c of result.criteria) expect(c.evidence.length).toBeGreaterThan(0)
      if (outcome !== 'meets') {
        const failing = result.criteria.filter((c) => c.outcome === outcome)
        expect(failing.some((c) => c.evidence.some((e) => e.type === 'reason'))).toBe(true)
      }
    })
  }

  it('demo: Meera Sen is expected today with "Tiredness, thirst" and her study outcome is needs review', () => {
    const row = store.selectExpectedToday(TODAY).find((r) => r.name === 'Meera Sen')
    expect(row).toMatchObject({ bookedReason: 'Tiredness, thirst', status: 'expected' })
    const [result] = store.selectEligibility(row!.patientId, TODAY)
    expect(result.outcome).toBe('needs_review')
  })

  it('demo: the opted-out and declined patients both meet the study and are flagged on the candidate list (AC-21.2)', () => {
    const study = store.selectStudies()[0]
    const candidates = store.selectCandidates(study.id, TODAY)
    const optedOut = candidates.find((c) => c.studyCallOptOut)
    const declined = candidates.find((c) => c.declined)
    expect(optedOut?.result.outcome).toBe('meets')
    expect(declined?.result.outcome).toBe('meets')
    expect(optedOut?.canApprove).toBe(false)
    expect(declined?.canApprove).toBe(false)
  })
})

// ---- (b) S-05 reception visibility --------------------------------------------

const FORBIDDEN_KEYS = new Set([
  'observation', 'observations', 'bpSystolic', 'bpDiastolic', 'weightKg', 'tempC', 'patientReport',
  'note', 'notes', 'text', 'diagnosis', 'diagnoses', 'label',
  'order', 'orders', 'test', 'value', 'reasonOrdered', 'resultedAt', 'reviewedAt', 'reviewNote',
  'eligibility', 'outcome', 'evidence', 'criteria', 'quote',
])

function forbiddenKeysIn(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => forbiddenKeysIn(v, `${path}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [
      ...(FORBIDDEN_KEYS.has(k) ? [`${path}.${k}`] : []),
      ...forbiddenKeysIn(v, `${path}.${k}`),
    ])
  }
  return []
}

/** Clinical text that must never reach reception, taken from the seed and from this test's own actions. */
function clinicalStrings(extra: string[]): string[] {
  return [
    ...seed.notes.map((n) => n.text),
    ...seed.diagnoses.map((d) => d.label),
    ...seed.observations.map((o) => o.patientReport),
    ...seed.orders.flatMap((o) => [o.reasonOrdered, o.value, o.reviewNote]),
    ...(Object.values(REASONS).filter((r) => typeof r === 'string') as string[]),
    ...extra,
  ].filter((s): s is string => typeof s === 'string' && s.length > 0)
}

function everyReceptionOutput(): Record<string, unknown> {
  const checkout = store.selectCheckoutList()
  return {
    expectedToday: store.selectExpectedToday(TODAY),
    checkoutList: checkout,
    checkoutCards: checkout.map((c) => store.selectCheckoutCard(c.visitId, TODAY)),
    tasks: store.selectReceptionTasks(TODAY),
    outreach: store.selectOutreachList(TODAY),
    search: store.searchPatients('a'),
    studyFlags: seed.patients.map((p) => store.selectReceptionStudyFlags(p.id)),
  }
}

function expectNoClinicalData(output: Record<string, unknown>, extraStrings: string[] = []) {
  expect(forbiddenKeysIn(output)).toEqual([])
  const json = JSON.stringify(output)
  const leaked = clinicalStrings(extraStrings).filter((s) => json.includes(s))
  expect(leaked).toEqual([])
}

describe('(b) S-05 reception selectors return no clinical fields', () => {
  it('S-05 seed state: no observation, note, diagnosis, result or eligibility fields or text', () => {
    const out = everyReceptionOutput()
    // sanity: the selectors returned real data, so the scan is meaningful
    expect((out.expectedToday as unknown[]).length).toBeGreaterThanOrEqual(10)
    expect((out.tasks as unknown[]).length).toBeGreaterThan(0)
    expect((out.outreach as unknown[]).length).toBeGreaterThan(0)
    expectNoClinicalData(out)
  })

  it('S-05 after the demo visit (intake, note, order, waiting task, result reviewed): still no clinical data', () => {
    const meera = store.selectExpectedToday(TODAY).find((r) => r.name === 'Meera Sen')!
    store.checkIn(meera.visitId, 'Tiredness, thirst', at('09:31'))
    store.saveIntake(
      meera.visitId,
      { bpSystolic: '138', bpDiastolic: '88', weightKg: '82', tempC: '36.8', patientReport: 'Thirsty for a month, waking at night to pass urine' },
      at('09:40'),
    )
    store.openVisit(meera.visitId)
    store.saveNote(meera.visitId, 'Polydipsia and nocturia for a month. Check HbA1c.', at('09:50'))
    const orderId = store.createOrder(meera.visitId, 'HbA1c', 'Possible diabetes')
    store.createTask(
      { visitId: meera.visitId, action: 'Book follow-up', timing: { kind: 'afterResult', orderId, offsetDays: 7 } },
      at('09:52'),
    )
    store.finishVisit(meera.visitId)
    expectNoClinicalData(everyReceptionOutput(), [
      'Thirsty for a month, waking at night to pass urine',
      'Polydipsia and nocturia for a month',
      'Possible diabetes',
    ])

    store.simulateResult(orderId, '7.4%', at('10:00', '2026-11-15'))
    store.reviewResult(orderId, 'HbA1c confirms type 2 diabetes', at('10:30', '2026-11-15'))
    expectNoClinicalData(everyReceptionOutput(), ['7.4%', 'HbA1c confirms type 2 diabetes', 'Possible diabetes'])
  })
})

describe('nurse selectors: no physician notes, orders or eligibility (AC-06.4, OQ-01)', () => {
  const NURSE_FORBIDDEN = new Set(['orders', 'order', 'test', 'value', 'reasonOrdered', 'reviewNote', 'eligibility', 'outcome', 'evidence', 'criteria', 'quote', 'recentNotes'])

  function nurseForbiddenKeys(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(nurseForbiddenKeys)
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([k, v]) => [...(NURSE_FORBIDDEN.has(k) ? [k] : []), ...nurseForbiddenKeys(v)])
    }
    return []
  }

  it('AC-06.4 queue and intake views contain no physician-note text, order or eligibility fields', () => {
    const queue = store.selectNurseQueue()
    expect(queue.length).toBeGreaterThan(0)
    // every patient with physician notes, seen through the nurse intake view of one of their visits
    const intakes = seed.visits.map((v) => store.selectNurseIntake(v.id))
    const output = { queue, intakes }
    expect(nurseForbiddenKeys(output)).toEqual([])
    const json = JSON.stringify(output)
    const physicianText = seed.notes.filter((n) => n.authorRole === 'physician').map((n) => n.text)
    expect(physicianText.filter((t) => json.includes(t))).toEqual([])
    // the nurse-authored note is visible (history read-only)
    expect(json).toContain('Anxious about flying next week.')
  })
})

// ---- (c) S-06 task due dates ----------------------------------------------------

describe('(c) S-06 task due-date calculation', () => {
  it('S-06 "Book follow-up" in 14 days → open task due today + 14 on reception\'s list (AC-11.2, AC-11.3, AC-15.1)', () => {
    const taskId = store.createTask(
      { visitId: 'v-03', action: 'Book follow-up', timing: { kind: 'inDays', days: 14 } },
      at('09:30'),
    )
    const row = store.selectReceptionTasks(TODAY).find((t) => t.taskId === taskId)
    expect(row).toMatchObject({ action: 'Book follow-up', status: 'open', dueDate: '2026-11-28', overdue: false })
  })

  it('AC-11.2 a task with a fixed date is open and due on that date', () => {
    const taskId = store.createTask(
      { visitId: 'v-03', action: 'Send referral letter', timing: { kind: 'date', date: '2026-12-01' } },
      at('09:30'),
    )
    expect(store.selectReceptionTasks(TODAY).find((t) => t.taskId === taskId)).toMatchObject({
      status: 'open',
      dueDate: '2026-12-01',
    })
  })

  it('AC-15.1 open tasks are listed by due date, then waiting tasks; AC-15.2 overdue is flagged', () => {
    store.createTask({ visitId: 'v-03', action: 'Book follow-up', timing: { kind: 'inDays', days: 14 } }, at('09:30'))
    const rows = store.selectReceptionTasks(TODAY)
    const firstWaiting = rows.findIndex((r) => r.status === 'waiting')
    const open = rows.filter((r) => r.status === 'open')
    expect(firstWaiting).toBeGreaterThanOrEqual(open.length)
    const dues = open.map((r) => r.dueDate!)
    expect(dues).toEqual([...dues].sort())
    expect(open[0].overdue).toBe(true) // seeded task due 2026-11-10
  })
})

// ---- (d) AC-18 waiting tasks wake on review ---------------------------------------

describe('(d) AC-18 waiting task opens on review', () => {
  it('AC-18.1 AC-18.2 seeded waiting task opens when its order is reviewed, due = review date + offset', () => {
    const before = store.selectReceptionTasks(TODAY).find((t) => t.taskId === 't-2')
    expect(before).toMatchObject({ status: 'waiting', dueDate: null, dueLabel: 'after result, date to be set' })

    store.simulateResult('o-1', '7.1%', at('09:00', '2026-11-15'))
    // a result arriving is not enough: the task waits for the physician's review
    expect(store.selectReceptionTasks('2026-11-15').find((t) => t.taskId === 't-2')?.status).toBe('waiting')

    store.reviewResult('o-1', 'Reviewed, discuss at follow-up', at('10:00', '2026-11-16'))
    const after = store.selectReceptionTasks('2026-11-16').find((t) => t.taskId === 't-2')
    expect(after).toMatchObject({ status: 'open', dueDate: '2026-11-23' })
  })

  it('AC-18.2 AC-18.3 a task created "7 days after result" opens on review day + 7 and shows no result details', () => {
    const orderId = store.createOrder('v-03', 'HbA1c', 'Check glucose control')
    const taskId = store.createTask(
      { visitId: 'v-03', action: 'Book follow-up', timing: { kind: 'afterResult', orderId, offsetDays: 7 } },
      at('09:30'),
    )
    expect(store.selectReceptionTasks(TODAY).find((t) => t.taskId === taskId)?.status).toBe('waiting')

    store.simulateResult(orderId, '6.2%', at('09:00', '2026-11-20'))
    store.reviewResult(orderId, 'Normal range', at('11:00', '2026-11-21'))
    const row = store.selectReceptionTasks('2026-11-21').find((t) => t.taskId === taskId)
    expect(row).toMatchObject({ status: 'open', dueDate: '2026-11-28' })
    expect(forbiddenKeysIn(row)).toEqual([])
    expect(JSON.stringify(row)).not.toContain('6.2%')
  })

  it('AC-18.1 reviewing one order leaves tasks waiting on other orders untouched', () => {
    const orderId = store.createOrder('v-03', 'Lipid profile', 'Cardiovascular risk')
    store.simulateResult(orderId, 'LDL 2.9', at('09:00', '2026-11-15'))
    store.reviewResult(orderId, 'Fine', at('10:00', '2026-11-15'))
    expect(store.selectReceptionTasks('2026-11-15').find((t) => t.taskId === 't-2')?.status).toBe('waiting')
  })
})

// ---- results inbox, review and study impact (US-16, US-17, US-19) ---------------------

describe('results inbox, review and study impact', () => {
  it('AC-16.1 AC-16.2 inbox lists resulted orders oldest first, with the count for the badge', () => {
    store.simulateResult('o-1', '7.1%', at('09:00', '2026-11-15'))
    const inbox = store.selectResultsInbox('2026-11-15')
    expect(inbox.map((r) => r.orderId)).toEqual(['o-2', 'o-1']) // o-2 resulted 2026-11-12, o-1 now
    expect(inbox[0]).toMatchObject({ name: 'Fatima Haddad', test: 'HbA1c', reasonOrdered: 'Gained 6 kg this year, check glucose', value: '5.9%' })
    expect(store.selectResultsCount()).toBe(2)
  })

  it('AC-19.1 AC-19.2 inbox row flags a study whose outcome is needs review', () => {
    const [row] = store.selectResultsInbox(TODAY)
    expect(row.studiesNeedingReview).toEqual(['Adults with documented diabetes'])
  })

  it('AC-19.2 S-09 reviewing with "HbA1c confirms type 2 diabetes" returns needs review → meets', () => {
    store.simulateResult('o-1', '7.1%', at('09:00', '2026-11-15'))
    const changes = store.reviewResult('o-1', 'HbA1c confirms type 2 diabetes', at('10:00', '2026-11-15'))
    expect(changes).toEqual([
      { patientId: 'm-15', studyId: 'diabetes-adults', studyName: 'Adults with documented diabetes', from: 'needs_review', to: 'meets' },
    ])
  })

  it('AC-19.2 a review that settles nothing positive returns needs review → doesn\'t meet', () => {
    const changes = store.reviewResult('o-2', 'Normal result', at('10:00'))
    expect(changes.map((c) => [c.from, c.to])).toEqual([['needs_review', 'does_not_meet']])
  })

  it('AC-17.1 OQ-02 review sets reviewed with time and saves the note as a physician note', () => {
    store.reviewResult('o-2', 'Normal result', at('10:00'))
    expect(store.selectResultsInbox(TODAY).some((r) => r.orderId === 'o-2')).toBe(false)
    const visit = store.selectVisitSummary('v-p2', TODAY)
    expect(visit.recentNotes[0]).toMatchObject({ authorRole: 'physician', text: 'Normal result' })
  })

  it('AC-17.2 OQ-11 a task created after review, tied to that order, opens due review date + N', () => {
    store.reviewResult('o-2', 'Normal result', at('10:00'))
    const taskId = store.createTask(
      { visitId: 'v-p2', action: 'Book diet review', timing: { kind: 'afterResult', orderId: 'o-2', offsetDays: 30 } },
      at('10:05'),
    )
    expect(store.selectReceptionTasks(TODAY).find((t) => t.taskId === taskId)).toMatchObject({
      status: 'open',
      dueDate: '2026-12-14',
    })
  })

  it('AC-17.2 review with a follow-up task tied to this order: task opens due review date + N', () => {
    store.reviewResult('o-2', 'Normal result', at('10:00'), {
      action: 'Book diet review',
      timing: { kind: 'afterResult', orderId: 'o-2', offsetDays: 30 },
    })
    expect(store.selectReceptionTasks(TODAY).find((t) => t.action === 'Book diet review')).toMatchObject({
      status: 'open',
      dueDate: '2026-12-14',
    })
  })

  it('AC-17.2 an invalid follow-up blocks the whole review: nothing is saved', () => {
    expect(() =>
      store.reviewResult('o-2', 'Normal result', at('10:00'), { action: '', timing: { kind: 'inDays', days: 7 } }),
    ).toThrow(store.StoreError)
    expect(store.selectResultsInbox(TODAY).some((r) => r.orderId === 'o-2')).toBe(true)
  })

  it('AC-05.1 nurse queue orders by arrival instant even when seed (local) and new (UTC) timestamps mix', () => {
    // 09:40 local clock time on the seed day, between Ines (09:38) and Olu (09:50)
    store.checkIn('v-05', 'Tiredness, thirst', new Date(2026, 10, 14, 9, 40))
    expect(store.selectNurseQueue().map((q) => q.name)).toEqual(['Ines Varga', 'Meera Sen', 'Olu Adeyemi'])
  })

  it('AC-29.1 simulate result: pending → resulted now; needs a value', () => {
    expect(() => store.simulateResult('o-1', '  ', at('09:00'))).toThrow(store.StoreError)
    store.simulateResult('o-1', '6.8%', at('09:00'))
    expect(store.selectPendingOrders().some((o) => o.orderId === 'o-1')).toBe(false)
    expect(store.selectResultsInbox(TODAY).find((r) => r.orderId === 'o-1')).toMatchObject({ value: '6.8%' })
  })
})

// ---- studies and outreach (US-21–US-27) ------------------------------------------------

const STUDY = 'diabetes-adults'
const outreachNames = () => store.selectOutreachList(TODAY).map((r) => r.name)
const candidate = (patientId: string) => store.selectCandidates(STUDY, TODAY).find((c) => c.patientId === patientId)

describe('candidates and physician decisions (US-21, US-22)', () => {
  it('AC-21.1 candidates are meets and needs review only, needs review first', () => {
    const list = store.selectCandidates(STUDY, TODAY)
    const outcomes = list.map((c) => c.result.outcome)
    expect(outcomes).not.toContain('does_not_meet')
    expect(outcomes.lastIndexOf('needs_review')).toBeLessThan(outcomes.indexOf('meets'))
    expect(list.some((c) => c.patientId === 'm-06')).toBe(false) // prediabetes: doesn't meet
  })

  it('AC-22.1 approve records who and when; AC-22.3 the patient then reaches outreach (S-10)', () => {
    expect(outreachNames()).not.toContain('Lina Okafor') // m-02 meets, not approved
    store.decideStudy('m-02', STUDY, 'approve_contact', at('11:00'))
    expect(candidate('m-02')?.decision).toMatchObject({ decision: 'approve_contact', decidedBy: 'physician', decidedAt: at('11:00').toISOString() })
    expect(candidate('m-02')?.canApprove).toBe(false)
    const row = store.selectOutreachList(TODAY).find((r) => r.patientId === 'm-02')
    expect(row).toEqual({ patientId: 'm-02', name: 'Lina Okafor', phone: '07700 900112', studyId: STUDY, studyName: 'Adults with documented diabetes', attempts: [] })
  })

  it('AC-22.1 approve is refused for a patient who doesn\'t meet', () => {
    expect(() => store.decideStudy('m-06', STUDY, 'approve_contact', at('11:00'))).toThrow(store.StoreError)
  })

  it('AC-22.1 needs-review patients can be approved', () => {
    store.decideStudy('m-13', STUDY, 'approve_contact', at('11:00'))
    expect(outreachNames()).toContain('Liam Corcoran')
  })

  it('AC-22.2 not eligible removes the patient from the candidate list and records who and when', () => {
    store.decideStudy('m-14', STUDY, 'not_eligible', at('11:05'))
    expect(candidate('m-14')).toBeUndefined()
    expect(store.selectVisitSummary('v-12', TODAY).decisions[0]).toMatchObject({ decision: 'not_eligible', decidedBy: 'physician' })
  })
})

describe('outreach and call log (US-24–US-26)', () => {
  it('AC-24.1 AC-24.2 outreach rows carry name, phone, study and attempts only', () => {
    const rows = store.selectOutreachList(TODAY)
    expect(rows.map((r) => r.patientId)).toEqual(['m-01']) // seeded: approved, no outcome
    expect(Object.keys(rows[0]).sort()).toEqual(['attempts', 'name', 'patientId', 'phone', 'studyId', 'studyName'])
  })

  it('S-11 not reached keeps the patient; reached + declined removes them and flags the decline (AC-25.1, AC-25.3, AC-26.1)', () => {
    store.decideStudy('m-02', STUDY, 'approve_contact', at('11:00'))

    store.logCall('m-02', STUDY, { reached: false, result: null }, at('11:30'))
    const afterFirst = store.selectOutreachList(TODAY).find((r) => r.patientId === 'm-02')
    expect(afterFirst?.attempts).toEqual([{ at: at('11:30').toISOString(), reached: false, result: null }])

    store.logCall('m-02', STUDY, { reached: true, result: 'declined' }, at('14:00'))
    expect(outreachNames()).not.toContain('Lina Okafor')
    // AC-26.1: "Declined" flag on the physician's study panel and the candidate list
    expect(store.selectVisitSummary('v-08', TODAY).declinedStudyIds).toEqual([STUDY])
    expect(candidate('m-02')).toMatchObject({ declined: true, canApprove: false })
    expect(store.selectReceptionStudyFlags('m-02').declinedStudyIds).toEqual([STUDY])
  })

  it('S-11 AC-26.2 a declined patient never reappears on outreach for that study, even if eligibility changes', () => {
    store.decideStudy('m-02', STUDY, 'approve_contact', at('11:00'))
    store.logCall('m-02', STUDY, { reached: true, result: 'declined' }, at('11:30'))
    // eligibility changes (a conflicting note makes it needs review), yet nothing brings them back
    store.saveNote('v-08', 'No history of diabetes.', at('12:00'))
    expect(store.selectEligibility('m-02', TODAY)[0].outcome).toBe('needs_review')
    expect(() => store.decideStudy('m-02', STUDY, 'approve_contact', at('12:05'))).toThrow(store.StoreError)
    expect(() => store.logCall('m-02', STUDY, { reached: true, result: 'consented' }, at('12:10'))).toThrow(store.StoreError)
    expect(outreachNames()).not.toContain('Lina Okafor')
  })

  it('AC-25.2 AC-25.3 consented removes the patient; call back later keeps them', () => {
    store.logCall('m-01', STUDY, { reached: true, result: 'call_back_later' }, at('10:00'))
    expect(outreachNames()).toContain('Tomas Brennan')
    store.logCall('m-01', STUDY, { reached: true, result: 'consented' }, at('15:00'))
    expect(outreachNames()).not.toContain('Tomas Brennan')
  })

  it('AC-25.2 a reached call needs a result; a missed call has none', () => {
    expect(() => store.logCall('m-01', STUDY, { reached: true, result: null }, at('10:00'))).toThrow(store.StoreError)
    expect(() => store.logCall('m-01', STUDY, { reached: false, result: 'declined' }, at('10:00'))).toThrow(store.StoreError)
  })

  it('AC-22.3 calls cannot be logged for a patient who was never approved', () => {
    expect(() => store.logCall('m-02', STUDY, { reached: false, result: null }, at('10:00'))).toThrow(store.StoreError)
  })
})

describe('opt out of all study calls (US-27)', () => {
  it('S-12 a patient who meets is set to "No study calls": off all outreach, flagged, outcome still shown to the physician', () => {
    expect(outreachNames()).toContain('Tomas Brennan') // m-01: meets, approved
    store.setOptOut('m-01', true)
    expect(outreachNames()).not.toContain('Tomas Brennan')
    // AC-27.2 flagged everywhere studies appear
    expect(candidate('m-01')).toMatchObject({ studyCallOptOut: true, canApprove: false })
    expect(store.selectReceptionStudyFlags('m-01').studyCallOptOut).toBe(true)
    // outcome unchanged: opt-out affects outreach only
    expect(store.selectEligibility('m-01', TODAY)[0].outcome).toBe('meets')
    expect(candidate('m-01')?.result.outcome).toBe('meets')
  })

  it('S-12 AC-27.1 an opted-out patient cannot be approved, and clearing the opt-out restores the approved patient to outreach', () => {
    store.setOptOut('m-02', true)
    expect(() => store.decideStudy('m-02', STUDY, 'approve_contact', at('11:00'))).toThrow(store.StoreError)
    store.setOptOut('m-01', true)
    store.setOptOut('m-01', false)
    expect(outreachNames()).toContain('Tomas Brennan')
  })
})

// ---- visit flow (T016: US-01–US-15) and remaining T019a items ---------------------------

describe('visit flow: arrival, intake, visit, checkout (T016)', () => {
  it('AC-01.1 today\'s list shows time, name, booked reason and status, sorted by time', () => {
    const rows = store.selectExpectedToday(TODAY)
    expect(rows).toHaveLength(12)
    const times = rows.filter((r) => r.time).map((r) => r.time!)
    expect(times).toEqual([...times].sort())
    expect(rows.find((r) => r.name === 'Meera Sen')).toMatchObject({ time: '09:30', bookedReason: 'Tiredness, thirst', status: 'expected' })
  })

  it('AC-04.1 phone is on the expected list, checkout card, task list and outreach list', () => {
    expect(store.selectExpectedToday(TODAY).every((r) => /^07700 9001\d\d$/.test(r.phone))).toBe(true)
    expect(store.selectCheckoutCard('v-02', TODAY).phone).toBe('07700 900118')
    expect(store.selectReceptionTasks(TODAY).every((t) => t.phone.length > 0)).toBe(true)
    expect(store.selectOutreachList(TODAY)[0].phone).toBe('07700 900111')
  })

  it('AC-02.2 check-in with an empty reason throws and changes nothing', () => {
    expect(() => store.checkIn('v-09', '   ', at('10:31'))).toThrow(store.StoreError)
    expect(store.selectExpectedToday(TODAY).find((r) => r.visitId === 'v-09')).toMatchObject({ status: 'expected', confirmedReason: null })
  })

  it('AC-02.1 AC-02.3 check-in saves the confirmed reason and keeps the booked one', () => {
    store.checkIn('v-05', 'Tiredness, thirst, weight loss', at('09:31'))
    expect(store.selectExpectedToday(TODAY).find((r) => r.visitId === 'v-05')).toMatchObject({
      status: 'checked_in',
      bookedReason: 'Tiredness, thirst',
      confirmedReason: 'Tiredness, thirst, weight loss',
    })
  })

  it('AC-03.1 AC-03.2 S-03 walk-in for a new patient: patient and visit created, checked in, marked walk-in', () => {
    const { patientId, visitId } = store.registerWalkIn({ name: 'Zofia Brandt', dateOfBirth: '1990-03-03', phone: '07700 900150' }, 'Cut on hand', at('10:00'))
    expect(store.searchPatients('brandt')).toEqual([{ patientId, name: 'Zofia Brandt', dateOfBirth: '1990-03-03', phone: '07700 900150' }])
    expect(store.selectExpectedToday(TODAY).find((r) => r.visitId === visitId)).toMatchObject({
      walkIn: true,
      status: 'checked_in',
      confirmedReason: 'Cut on hand',
      time: null,
    })
    expect(store.selectNurseQueue().some((q) => q.visitId === visitId)).toBe(true)
  })

  it('AC-03.1 AC-03.2 walk-in for an existing patient; a reason and new-patient fields are required', () => {
    const { visitId } = store.registerWalkIn({ patientId: 'm-07' }, 'Sore throat', at('10:00'))
    expect(store.selectExpectedToday(TODAY).find((r) => r.visitId === visitId)?.name).toBe('Daniel Osei')
    const err = (() => {
      try {
        store.registerWalkIn({ name: '', dateOfBirth: 'soon', phone: '' }, '', at('10:00'))
      } catch (e) {
        return e as store.StoreError
      }
    })()
    expect(Object.keys(err?.fieldErrors ?? {}).sort()).toEqual(['dateOfBirth', 'name', 'phone', 'reason'])
  })

  it('AC-06.1 AC-06.2 intake: vitals optional but numeric, patient report required, nothing saved on error', () => {
    expect(() => store.saveIntake('v-06', { weightKg: 'abc', patientReport: 'Headaches' }, at('09:50'))).toThrow(store.StoreError)
    expect(() => store.saveIntake('v-06', { patientReport: '  ' }, at('09:50'))).toThrow(store.StoreError)
    expect(store.selectNurseQueue().some((q) => q.visitId === 'v-06')).toBe(true)
  })

  it('AC-05.1 AC-05.2 AC-06.3 AC-07.1 intake moves the patient to ready for physician with the time recorded', () => {
    expect(store.selectNurseQueue().map((q) => q.visitId)).toEqual(['v-06', 'v-07']) // by arrival
    store.saveIntake('v-06', { bpSystolic: '122', weightKg: '64.5', patientReport: 'Headaches' }, at('09:50'))
    expect(store.selectNurseQueue().map((q) => q.visitId)).toEqual(['v-07'])
    const ready = store.selectReadyForPhysician(new Date(Date.parse(at('09:50').toISOString()) + 25 * 60_000))
    expect(ready.find((r) => r.visitId === 'v-06')).toMatchObject({ confirmedReason: 'Headaches', minutesWaiting: 25 })
  })

  it('AC-08.1 AC-08.2 opening a visit sets with physician; summary has reason, observations, diagnoses, last 3 notes, results', () => {
    store.openVisit('v-04')
    const v = store.selectVisitSummary('v-04', TODAY)
    expect(v.status).toBe('with_physician')
    expect(v.confirmedReason).toBe('Ankle review')
    expect(v.observation).toMatchObject({ bpSystolic: 124, weightKg: 79, patientReport: 'Ankle still swollen after a week' })
    expect(store.selectVisitSummary('v-p2', TODAY).resultsAwaitingReview.map((o) => o.id)).toEqual(['o-2'])
    expect(store.selectVisitSummary('v-01', TODAY).activeDiagnoses.map((d) => d.label)).toEqual(['Asthma'])
    // m-05 has three notes; the summary shows them newest first
    store.registerWalkIn({ patientId: 'm-05' }, 'Knee', at('10:00'))
    const m05Visit = store.selectExpectedToday(TODAY).find((r) => r.name === 'Paulo Ferreira')!.visitId
    expect(store.selectVisitSummary(m05Visit, TODAY).recentNotes.map((n) => n.date)).toEqual(['2026-09-29', '2026-05-11', '2021-06-15'])
  })

  it('AC-08.3 the visit summary carries an outcome for each study', () => {
    expect(store.selectVisitSummary('v-05', TODAY).eligibility.map((r) => [r.studyId, r.outcome])).toEqual([[STUDY, 'needs_review']])
  })

  it('AC-09.1 AC-09.2 a note is saved with date and author role "physician" and returns any study change', () => {
    store.openVisit('v-04')
    const changes = store.saveNote('v-04', 'Known T2DM per hospital letter.', at('09:40'))
    expect(store.selectVisitSummary('v-04', TODAY).recentNotes[0]).toMatchObject({ date: TODAY, authorRole: 'physician', visitId: 'v-04' })
    expect(changes.map((c) => [c.from, c.to])).toEqual([['does_not_meet', 'meets']])
  })

  it('AC-10.1 an order needs a test name and a reason, and is saved as pending', () => {
    expect(() => store.createOrder('v-03', '', '')).toThrow(store.StoreError)
    const id = store.createOrder('v-03', 'FBC', 'Ear infection, check inflammation')
    expect(store.selectPendingOrders().find((o) => o.orderId === id)).toMatchObject({ test: 'FBC', reasonOrdered: 'Ear infection, check inflammation' })
  })

  it('AC-11.1 a task needs an action', () => {
    expect(() => store.createTask({ visitId: 'v-03', action: ' ', timing: { kind: 'inDays', days: 3 } }, at('09:30'))).toThrow(store.StoreError)
  })

  it('AC-12.1 finishing sets checkout and puts the patient on reception\'s checkout list', () => {
    store.finishVisit('v-03')
    expect(store.selectCheckoutList().map((c) => c.name)).toContain('Aisha Rahman')
  })

  it('AC-13.1 AC-13.2 checkout card: name, phone, open tasks with due date, waiting tasks without result details', () => {
    store.openVisit('v-04')
    const orderId = store.createOrder('v-04', 'Ankle X-ray', 'Swelling after a week')
    store.createTask({ visitId: 'v-04', action: 'Book physio', timing: { kind: 'inDays', days: 7 } }, at('09:40'))
    store.createTask({ visitId: 'v-04', action: 'Book fracture clinic', timing: { kind: 'afterResult', orderId, offsetDays: 2 } }, at('09:40'))
    store.finishVisit('v-04')
    const card = store.selectCheckoutCard('v-04', TODAY)
    expect(card).toMatchObject({ name: 'Noah Whitfield', phone: '07700 900127' })
    expect(card.tasks.map((t) => [t.action, t.status, t.dueLabel])).toEqual([
      ['Book physio', 'open', '2026-11-21'],
      ['Book fracture clinic', 'waiting', 'after result, date to be set'],
    ])
    expect(JSON.stringify(card)).not.toContain('Ankle X-ray')
  })

  it('AC-14.1 AC-14.2 tasks are marked done; marking the patient left sets done and waiting tasks stay listed', () => {
    store.markTaskDone('t-3')
    expect(store.selectCheckoutCard('v-02', TODAY).tasks).toEqual([])
    expect(() => store.markTaskDone('t-2')).toThrow(store.StoreError) // waiting: no date yet
    store.markLeft('v-02')
    expect(store.selectExpectedToday(TODAY).find((r) => r.visitId === 'v-02')?.status).toBe('done')
    expect(store.selectReceptionTasks(TODAY).some((t) => t.taskId === 't-2' && t.status === 'waiting')).toBe(true)
  })

  it('S-01 status moves expected → checked in → ready → with physician → checkout → done; skipping a step throws', () => {
    const status = () => store.selectExpectedToday(TODAY).find((r) => r.visitId === 'v-05')!.status
    expect(() => store.openVisit('v-05')).toThrow(store.StoreError)
    expect(() => store.markLeft('v-05')).toThrow(store.StoreError)
    store.checkIn('v-05', 'Tiredness, thirst', at('09:31'))
    expect(status()).toBe('checked_in')
    store.saveIntake('v-05', { patientReport: 'Thirsty for a month' }, at('09:40'))
    expect(status()).toBe('ready_for_physician')
    store.openVisit('v-05')
    expect(status()).toBe('with_physician')
    store.finishVisit('v-05')
    expect(status()).toBe('checkout')
    store.markLeft('v-05')
    expect(status()).toBe('done')
  })

  it('AC-23.1 AC-23.2 the seeded study is "Adults with documented diabetes" with min age 18 and diagnosis diabetes only', () => {
    expect(store.selectStudies()).toEqual([
      { id: STUDY, name: 'Adults with documented diabetes', criteria: [{ kind: 'minAge', years: 18 }, { kind: 'diagnosis', condition: 'diabetes' }] },
    ])
  })

  it('AC-30.2 OQ-07 loading the seed 10 days later shifts dates and keeps M-20 exactly 18', () => {
    const later = '2026-11-24'
    store.initStore({ today: later, storage: memoryStorage() })
    expect(store.selectExpectedToday(later)).toHaveLength(12)
    const [m20] = store.selectEligibility('m-20', later)
    expect(m20.criteria[0].evidence).toContainEqual({ type: 'age', years: 18 })
    expect(store.selectEligibility('m-18', later)[0].outcome).toBe('does_not_meet')
  })
})

// ---- persistence and reset ---------------------------------------------------------

describe('persistence and reset (S-13, S-14, AC-30.1)', () => {
  it('S-13 a change is saved to storage and survives re-initialising the store', () => {
    store.checkIn('v-05', 'Tiredness, thirst', at('09:31'))
    expect(storage.data.has(store.STORAGE_KEY)).toBe(true)
    store.initStore({ today: TODAY, storage })
    expect(store.selectExpectedToday(TODAY).find((r) => r.visitId === 'v-05')?.status).toBe('checked_in')
  })

  it('S-14 AC-30.1 resetDemo restores the seed', () => {
    store.checkIn('v-05', 'Tiredness, thirst', at('09:31'))
    store.resetDemo(TODAY)
    expect(store.selectExpectedToday(TODAY).find((r) => r.visitId === 'v-05')?.status).toBe('expected')
    store.initStore({ today: TODAY, storage })
    expect(store.selectExpectedToday(TODAY).find((r) => r.visitId === 'v-05')?.status).toBe('expected')
  })

  it('corrupted saved state falls back to the seed', () => {
    storage.setItem(store.STORAGE_KEY, '{not json')
    store.initStore({ today: TODAY, storage })
    expect(store.selectExpectedToday(TODAY)).toHaveLength(12)
  })
})
