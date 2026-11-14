// Physician: ready list and visit (E3), results inbox and review (E5), study panel and candidates
// (E6). US-07–US-12, US-16–US-22, US-26–US-27.
import { useId, useState } from 'react'
import { ageOn, todayIso } from '../domain/dates'
import type { Order } from '../domain/types'
import {
  createOrder,
  createTask,
  finishVisit,
  openVisit,
  reviewResult,
  saveNote,
  selectReadyForPhysician,
  selectResultsCount,
  selectCandidates,
  selectResultsInbox,
  selectStudies,
  selectVisitSummary,
  selectWithPhysician,
  useStoreVersion,
  WAITING_LABEL,
  type EligibilityChange,
  type ResultsInboxRow,
  type TaskTiming,
  type VisitSummary,
} from '../store/store'
import { OUTCOME_LABEL, formatDate, formatDateTime, formatTime, useFieldErrors } from '../components/helpers'
import { OptOutToggle } from '../components/OptOutToggle'
import { DecisionControls, EligibilityDetails, OutcomeBadge, StudyFlags } from '../components/study'
import { Badge, Button, Card, Empty, Field, StatusBadge, Tabs } from '../components/ui'

type Tab = 'ready' | 'visit' | 'results' | 'studies'

export function Physician() {
  useStoreVersion()
  const [tab, setTab] = useState<Tab>('ready')
  const [visitId, setVisitId] = useState<string | null>(null)
  const ready = selectReadyForPhysician(new Date())

  const open = (id: string) => {
    openVisit(id)
    setVisitId(id)
    setTab('visit')
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'ready', label: 'Ready', count: ready.length },
          { id: 'visit', label: 'Visit' },
          // AC-16.2: count badge for results waiting for review
          { id: 'results', label: 'Results', count: selectResultsCount() },
          { id: 'studies', label: 'Studies' },
        ]}
      />
      {tab === 'ready' && <ReadyTab onOpen={open} />}
      {tab === 'visit' &&
        (visitId ? (
          <VisitTab
            key={visitId}
            visitId={visitId}
            onFinished={() => {
              setVisitId(null)
              setTab('ready')
            }}
          />
        ) : (
          <Card>
            <Empty>Open a patient from the Ready list to start the visit.</Empty>
          </Card>
        ))}
      {tab === 'results' && <ResultsTab />}
      {tab === 'studies' && <StudiesTab />}
    </div>
  )
}

// ---- Ready list (US-07) ----------------------------------------------------------------

function ReadyTab({ onOpen }: { onOpen: (visitId: string) => void }) {
  const ready = selectReadyForPhysician(new Date())
  const inProgress = selectWithPhysician()
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2" title="Ready for physician" actions={<span className="text-xs text-slate-500">Longest wait first</span>}>
        {ready.length === 0 ? (
          <Empty>No one is ready yet.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ready.map((r) => (
              <li key={r.visitId} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-medium text-slate-900">{r.name}</p>
                  <p className="text-sm text-slate-600">{r.confirmedReason}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-slate-500">
                    {r.minutesWaiting === null ? '' : `waiting ${r.minutesWaiting} min`}
                  </span>
                  <Button variant="primary" size="sm" onClick={() => onOpen(r.visitId)}>
                    Open visit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="With you now">
        {inProgress.length === 0 ? (
          <Empty>No open visits.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {inProgress.map((r) => (
              <li key={r.visitId} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.confirmedReason}</p>
                </div>
                <Button size="sm" onClick={() => onOpen(r.visitId)}>
                  Resume
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

// ---- Visit (US-08–US-12) -----------------------------------------------------------------

function VisitTab({ visitId, onFinished }: { visitId: string; onFinished: () => void }) {
  const today = todayIso(new Date())
  const v = selectVisitSummary(visitId, today)
  const age = ageOn(v.patient.dateOfBirth, today)

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{v.patient.name}</h2>
            <p className="text-sm text-slate-500">
              {age !== null ? `${age} years` : 'Age unknown'} · born {formatDate(v.patient.dateOfBirth)} ·{' '}
              <span className="tabular-nums">{v.patient.phone}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* AC-08.3: one badge per study with the patient's outcome */}
            {v.eligibility.map((r) => (
              <OutcomeBadge key={r.studyId} outcome={r.outcome} prefix={studyName(r.studyId)} />
            ))}
            <StatusBadge status={v.status} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Summary v={v} />
          <StudyPanel v={v} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          {v.status === 'with_physician' ? (
            <>
              <NoteForm visitId={visitId} />
              <OrderForm visitId={visitId} />
              <TaskForm v={v} />
              <Card>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    finishVisit(visitId)
                    onFinished()
                  }}
                >
                  Finish visit · send to checkout
                </Button>
              </Card>
            </>
          ) : (
            <Card>
              <p className="text-sm text-slate-500">This visit is no longer with you.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/** AC-08.2: reason, today's observations, active diagnoses, last 3 notes, results waiting. */
function Summary({ v }: { v: VisitSummary }) {
  const o = v.observation
  return (
    <>
      <Card title="Reason for visit">
        <p className="text-base font-medium text-slate-900">{v.confirmedReason}</p>
        {v.bookedReason && v.bookedReason !== v.confirmedReason && (
          <p className="mt-1 text-xs text-slate-500">Booked as "{v.bookedReason}"</p>
        )}
      </Card>

      <Card title="Today's observations" actions={o && <span className="text-xs text-slate-500">Nurse, {formatTime(o.recordedAt)}</span>}>
        {o ? (
          <>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <Vital label="Blood pressure" value={o.bpSystolic !== null || o.bpDiastolic !== null ? `${o.bpSystolic ?? '—'}/${o.bpDiastolic ?? '—'}` : '—'} unit="mmHg" />
              <Vital label="Weight" value={o.weightKg ?? '—'} unit="kg" />
              <Vital label="Temperature" value={o.tempC ?? '—'} unit="°C" />
            </dl>
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">"{o.patientReport}"</p>
          </>
        ) : (
          <Empty>No observations recorded for this visit.</Empty>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Active diagnoses">
          {v.activeDiagnoses.length === 0 ? (
            <p className="text-sm text-slate-400">None</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {v.activeDiagnoses.map((d) => (
                <li key={d.id}>
                  {d.label} <span className="text-xs text-slate-500">· since {formatDate(d.recordedOn)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Results and orders">
          {v.resultsAwaitingReview.length === 0 && v.pendingOrders.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing outstanding</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {v.resultsAwaitingReview.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span>
                    {r.test}: <span className="font-medium">{r.value}</span>
                  </span>
                  <Badge tone="amber">Awaiting review</Badge>
                </li>
              ))}
              {v.pendingOrders.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span>
                    {r.test} <span className="text-xs text-slate-500">· {r.reasonOrdered}</span>
                  </span>
                  <Badge>Pending</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Recent notes" actions={<span className="text-xs text-slate-500">Three most recent</span>}>
        {v.recentNotes.length === 0 ? (
          <p className="text-sm text-slate-400">No notes</p>
        ) : (
          <ul className="space-y-3">
            {v.recentNotes.map((n) => (
              <li key={n.id} className="text-sm">
                <p className="text-xs text-slate-500">
                  {formatDate(n.date)} · {n.authorRole}
                </p>
                <p className="text-slate-800">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {v.receptionTasks.length > 0 && (
        <Card title="Sent to reception from this visit">
          <ul className="space-y-1 text-sm">
            {v.receptionTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span>{t.action}</span>
                <span className="text-xs text-slate-500">{t.status === 'waiting' ? WAITING_LABEL : `due ${formatDate(t.dueDate)}`}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

function Vital({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="rounded-md bg-slate-50 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-slate-900">
        {value} <span className="text-xs font-normal text-slate-500">{unit}</span>
      </dd>
    </div>
  )
}

/** AC-09.2 / AC-19.2: study outcome changes, shown old → new. */
function ChangeList({ changes }: { changes: EligibilityChange[] }) {
  if (changes.length === 0) return <span className="text-slate-500">No change to study eligibility.</span>
  return (
    <ul className="space-y-0.5">
      {changes.map((c) => (
        <li key={c.studyId}>
          <span className="font-medium">{c.studyName}:</span> {OUTCOME_LABEL[c.from]} → <span className="font-semibold">{OUTCOME_LABEL[c.to]}</span>
        </li>
      ))}
    </ul>
  )
}

/** AC-09.1–09.2: note saved against the visit; eligibility re-runs and any change is shown. */
function NoteForm({ visitId }: { visitId: string }) {
  const [text, setText] = useState('')
  const [changes, setChanges] = useState<EligibilityChange[] | null>(null)
  const { errors, run } = useFieldErrors()
  return (
    <Card title="Visit note">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          let result: EligibilityChange[] = []
          if (run(() => (result = saveNote(visitId, text)))) {
            setText('')
            setChanges(result)
          }
        }}
      >
        <Field
          label="Assessment and plan"
          value={text}
          onChange={(t) => {
            setText(t)
            setChanges(null)
          }}
          error={errors.text}
          multiline
        />
        <Button type="submit" variant="primary" size="sm">
          Save note
        </Button>
        {changes && (
          <div role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-200">
            <p className="mb-0.5 font-medium">Note saved.</p>
            <ChangeList changes={changes} />
          </div>
        )}
      </form>
    </Card>
  )
}

/** AC-10.1: test name and reason required; saved as pending. */
function OrderForm({ visitId }: { visitId: string }) {
  const [test, setTest] = useState('')
  const [reason, setReason] = useState('')
  const { errors, run } = useFieldErrors()
  return (
    <Card title="Order a test">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => createOrder(visitId, test, reason))) {
            setTest('')
            setReason('')
          }
        }}
      >
        <Field label="Test" value={test} onChange={setTest} error={errors.test} placeholder="e.g. HbA1c" />
        <Field label="Why it is ordered" value={reason} onChange={setReason} error={errors.reason} placeholder="e.g. Possible diabetes" />
        <Button type="submit" size="sm" variant="primary">
          Order test
        </Button>
      </form>
    </Card>
  )
}

// ---- Task timing (AC-11.2, shared by the visit and the review screen) -----------------------

interface TimingState {
  kind: TaskTiming['kind']
  date: string
  days: string
  orderId: string
  offset: string
}

const EMPTY_TIMING: TimingState = { kind: 'inDays', date: '', days: '', orderId: '', offset: '' }

const toNumber = (s: string) => (s.trim() === '' ? NaN : Number(s))

function toTiming(t: TimingState, defaultOrderId: string): TaskTiming {
  if (t.kind === 'date') return { kind: 'date', date: t.date }
  if (t.kind === 'inDays') return { kind: 'inDays', days: toNumber(t.days) }
  return { kind: 'afterResult', orderId: t.orderId || defaultOrderId, offsetDays: toNumber(t.offset) }
}

/** The three timing options: a date, in N days, or N days after the result of an order. */
function TimingFields({
  value,
  onChange,
  orders,
  errors,
}: {
  value: TimingState
  onChange: (t: TimingState) => void
  orders: Pick<Order, 'id' | 'test' | 'status'>[]
  errors: Record<string, string>
}) {
  const name = useId()
  const set = (patch: Partial<TimingState>) => onChange({ ...value, ...patch })
  const chosenOrder = value.orderId || orders[0]?.id || ''
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-medium text-slate-600">When</legend>
      <TimingOption name={name} label="On a date" checked={value.kind === 'date'} onSelect={() => set({ kind: 'date' })}>
        <Field label="Due date" type="date" value={value.date} onChange={(date) => set({ date })} error={errors.date} />
      </TimingOption>
      <TimingOption name={name} label="In N days" checked={value.kind === 'inDays'} onSelect={() => set({ kind: 'inDays' })}>
        <Field label="Days from today" value={value.days} onChange={(days) => set({ days })} error={errors.days} inputMode="numeric" placeholder="e.g. 14" />
      </TimingOption>
      <TimingOption
        name={name}
        label="N days after a result"
        checked={value.kind === 'afterResult'}
        onSelect={() => set({ kind: 'afterResult' })}
        disabled={orders.length === 0}
        disabledHint="Order a test first"
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`${name}-order`}>
              Result of
            </label>
            <select
              id={`${name}-order`}
              value={chosenOrder}
              onChange={(e) => set({ orderId: e.target.value })}
              className="block w-full rounded-md border-0 px-2 py-2 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-teal-600"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.test}
                  {o.status === 'resulted' ? ' (this result)' : ''}
                </option>
              ))}
            </select>
            {errors.orderId && <p className="mt-1 text-xs text-rose-600">{errors.orderId}</p>}
          </div>
          <Field label="Days after" value={value.offset} onChange={(offset) => set({ offset })} error={errors.offsetDays} inputMode="numeric" placeholder="e.g. 7" />
        </div>
      </TimingOption>
    </fieldset>
  )
}

function TimingOption({
  name,
  label,
  checked,
  onSelect,
  disabled,
  disabledHint,
  children,
}: {
  name: string
  label: string
  checked: boolean
  onSelect: () => void
  disabled?: boolean
  disabledHint?: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-md border px-3 py-2 ${checked ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200'}`}>
      <label className={`flex items-center gap-2 text-sm ${disabled ? 'text-slate-400' : ''}`}>
        <input type="radio" name={name} checked={checked} onChange={onSelect} disabled={disabled} className="accent-teal-700" />
        {label}
        {disabled && disabledHint && <span className="text-xs">· {disabledHint}</span>}
      </label>
      {checked && !disabled && <div className="mt-2">{children}</div>}
    </div>
  )
}

/** AC-11.1–11.3: action plus timing; a task tied to a result waits until it is reviewed. */
function TaskForm({ v }: { v: VisitSummary }) {
  const [action, setAction] = useState('')
  const [timing, setTiming] = useState<TimingState>(EMPTY_TIMING)
  const [added, setAdded] = useState(false)
  const { errors, run } = useFieldErrors()
  const orders = v.pendingOrders.concat(v.resultsAwaitingReview)

  return (
    <Card title="Task for reception">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => createTask({ visitId: v.visitId, action, timing: toTiming(timing, orders[0]?.id ?? '') }))) {
            setAction('')
            setTiming({ ...EMPTY_TIMING, kind: timing.kind })
            setAdded(true)
          }
        }}
      >
        <Field
          label="What to arrange"
          value={action}
          onChange={(t) => {
            setAction(t)
            setAdded(false)
          }}
          error={errors.action}
          placeholder="e.g. Book follow-up"
        />
        <TimingFields value={timing} onChange={setTiming} orders={orders} errors={errors} />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" variant="primary">
            Add task
          </Button>
          {added && <span className="text-xs text-emerald-700">Task sent to reception</span>}
        </div>
      </form>
    </Card>
  )
}

// ---- Results inbox and review (US-16–US-19) -------------------------------------------------

interface ReviewOutcome {
  name: string
  test: string
  changes: EligibilityChange[]
  taskAction: string | null
}

function ResultsTab() {
  const today = todayIso(new Date())
  const inbox = selectResultsInbox(today)
  const [selected, setSelected] = useState<string | null>(null)
  const [last, setLast] = useState<ReviewOutcome | null>(null)
  const row = inbox.find((r) => r.orderId === selected) ?? null

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2" title="Results waiting for review" actions={<span className="text-xs text-slate-500">Oldest first</span>}>
        {inbox.length === 0 ? (
          <Empty>No results waiting. Use “Simulate result” in the header to make one arrive.</Empty>
        ) : (
          // AC-16.1: patient, test, reason ordered, value, date — oldest first
          <ul aria-label="Results waiting for review" className="-mx-2 space-y-1">
            {inbox.map((r) => (
              <li
                key={r.orderId}
                className={`rounded-md px-3 py-2.5 text-sm ${r.orderId === selected ? 'bg-teal-50 ring-1 ring-teal-200' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p>
                      {r.test}: <span className="font-semibold tabular-nums">{r.value}</span>
                    </p>
                    <p className="text-xs text-slate-500">Ordered for: {r.reasonOrdered}</p>
                    <p className="text-xs text-slate-400">Resulted {formatDateTime(r.resultedAt)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={r.orderId === selected ? 'primary' : 'secondary'}
                    onClick={() => {
                      setSelected(r.orderId)
                      setLast(null)
                    }}
                  >
                    Review
                  </Button>
                </div>
                {/* AC-19.2: study needing review flagged on the row */}
                {r.studiesNeedingReview.length > 0 && (
                  <div className="mt-1.5">
                    <Badge tone="amber">Study: needs review</Badge>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-4 lg:col-span-3">
        {last && (
          <div role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
            <p className="font-medium">
              {last.test} for {last.name} reviewed.
              {last.taskAction && ` Reception task added: ${last.taskAction}.`}
            </p>
            <div className="mt-1">
              <ChangeList changes={last.changes} />
            </div>
          </div>
        )}
        {row ? (
          <ReviewPanel
            key={row.orderId}
            row={row}
            onDone={(outcome) => {
              setLast(outcome)
              setSelected(null)
            }}
          />
        ) : (
          !last && (
            <Card>
              <p className="text-sm text-slate-500">Pick a result to review it.</p>
            </Card>
          )
        )}
      </div>
    </div>
  )
}

/** AC-17.1–17.2, AC-19.2: review note, optional reception task, study flag; shows the change after. */
function ReviewPanel({ row, onDone }: { row: ResultsInboxRow; onDone: (o: ReviewOutcome) => void }) {
  const today = todayIso(new Date())
  const visit = selectVisitSummary(row.visitId, today)
  const [note, setNote] = useState('')
  const [withTask, setWithTask] = useState(false)
  const [action, setAction] = useState('')
  const [timing, setTiming] = useState<TimingState>({ ...EMPTY_TIMING, kind: 'afterResult', orderId: row.orderId })
  const { errors, run } = useFieldErrors()
  // this result first, then the patient's other outstanding orders
  const orders = visit.resultsAwaitingReview
    .filter((o) => o.id === row.orderId)
    .concat(visit.resultsAwaitingReview.filter((o) => o.id !== row.orderId), visit.pendingOrders)

  return (
    <Card ariaLabel="Review result" title={`Review result · ${row.name}`}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Test</dt>
          <dd className="font-medium">{row.test}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Value</dt>
          <dd className="font-semibold tabular-nums">{row.value}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">Why it was ordered</dt>
          <dd>{row.reasonOrdered}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">Resulted</dt>
          <dd>{formatDateTime(row.resultedAt)}</dd>
        </div>
      </dl>

      {row.studiesNeedingReview.length > 0 && (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          {row.studiesNeedingReview.map((s) => (
            <p key={s}>
              <span className="font-medium">{s}: needs review</span> — check the study while you review this result.
            </p>
          ))}
        </div>
      )}

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const followUp = withTask ? { action, timing: toTiming(timing, row.orderId) } : undefined
          let changes: EligibilityChange[] = []
          if (run(() => (changes = reviewResult(row.orderId, note, new Date(), followUp)))) {
            onDone({ name: row.name, test: row.test, changes, taskAction: followUp ? action.trim() : null })
          }
        }}
      >
        <Field label="Review note" value={note} onChange={setNote} error={errors.note} multiline placeholder="e.g. HbA1c confirms type 2 diabetes" />

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={withTask} onChange={(e) => setWithTask(e.target.checked)} className="accent-teal-700" />
          Also create a reception task
        </label>
        {withTask && (
          <div className="space-y-3 rounded-md border border-slate-200 p-3">
            <Field label="What to arrange" value={action} onChange={setAction} error={errors.action} placeholder="e.g. Book follow-up" />
            <TimingFields value={timing} onChange={setTiming} orders={orders} errors={errors} />
          </div>
        )}

        <Button type="submit" variant="primary">
          Save review
        </Button>
      </form>
    </Card>
  )
}

// ---- Studies: visit panel and candidate list (US-20–US-22, US-26–US-27) ------------------------

function studyName(studyId: string): string {
  return selectStudies().find((s) => s.id === studyId)?.name ?? studyId
}

/** AC-20.1–20.3, AC-22.1–22.2, AC-26.1, AC-27.1–27.2: per study, outcome, evidence, decision and flags. */
function StudyPanel({ v }: { v: VisitSummary }) {
  return (
    <Card title="Studies" actions={<OptOutToggle patientId={v.patient.id} value={v.patient.studyCallOptOut} />}>
      <div className="space-y-5">
        {v.eligibility.map((r) => {
          const name = studyName(r.studyId)
          const declined = v.declinedStudyIds.includes(r.studyId)
          return (
            <section key={r.studyId} aria-label={`Study ${name}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{name}</h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StudyFlags studyName={name} declined={declined} optOut={v.patient.studyCallOptOut} />
                  <OutcomeBadge outcome={r.outcome} />
                </div>
              </div>
              <EligibilityDetails result={r} />
              <div className="mt-2 border-t border-slate-100 pt-2">
                <DecisionControls
                  patientId={v.patient.id}
                  studyId={r.studyId}
                  outcome={r.outcome}
                  decision={v.decisions.find((d) => d.studyId === r.studyId) ?? null}
                  declined={declined}
                  optOut={v.patient.studyCallOptOut}
                />
              </div>
            </section>
          )
        })}
      </div>
    </Card>
  )
}

/** AC-21.1–21.2, AC-22.1–22.2: meets and needs review, needs review first; flagged rows cannot be approved. */
function StudiesTab() {
  const today = todayIso(new Date())
  const studies = selectStudies()
  return (
    <div className="space-y-4">
      {studies.map((s) => {
        const list = selectCandidates(s.id, today)
        const review = list.filter((c) => c.result.outcome === 'needs_review').length
        return (
          <Card
            key={s.id}
            title={s.name}
            actions={
              <span className="text-xs text-slate-500">
                {review} need review · {list.length - review} meet
              </span>
            }
          >
            {list.length === 0 ? (
              <Empty>No candidates.</Empty>
            ) : (
              <ul aria-label={`Candidates for ${s.name}`} className="divide-y divide-slate-100">
                {list.map((c) => (
                  <li key={c.patientId} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{c.name}</span>
                          <OutcomeBadge outcome={c.result.outcome} />
                          <StudyFlags studyName={s.name} declined={c.declined} optOut={c.studyCallOptOut} />
                        </div>
                      </div>
                      <DecisionControls
                        patientId={c.patientId}
                        studyId={s.id}
                        outcome={c.result.outcome}
                        decision={c.decision}
                        declined={c.declined}
                        optOut={c.studyCallOptOut}
                      />
                    </div>
                    <details className="mt-1" open={c.result.outcome === 'needs_review'}>
                      <summary className="cursor-pointer text-xs font-medium text-teal-800">Evidence</summary>
                      <EligibilityDetails result={c.result} />
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )
      })}
    </div>
  )
}
