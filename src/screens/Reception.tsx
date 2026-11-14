// Reception: arrival (E1) and checkout/tasks (E4). Reads only reception selectors, so no clinical
// field can reach this screen (Constitution II). US-01–US-04, US-12–US-15.
import { useState } from 'react'
import { todayIso } from '../domain/dates'
import {
  checkIn,
  markLeft,
  markTaskDone,
  registerWalkIn,
  searchPatients,
  selectCheckoutCard,
  selectCheckoutList,
  selectExpectedToday,
  selectReceptionTasks,
  useStoreVersion,
  type ReceptionTask,
  type ReceptionVisitRow,
} from '../store/store'
import { formatDate, useFieldErrors } from '../components/helpers'
import { OptOutToggle } from '../components/OptOutToggle'
import { Outreach } from './Outreach'
import { Badge, Button, Card, Empty, Field, StatusBadge, Tabs } from '../components/ui'

type Tab = 'today' | 'checkout' | 'tasks' | 'outreach'

export function Reception() {
  useStoreVersion()
  const today = todayIso(new Date())
  const [tab, setTab] = useState<Tab>('today')
  const checkoutCount = selectCheckoutList().length
  const tasks = selectReceptionTasks(today)

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'today', label: 'Today' },
          { id: 'checkout', label: 'Checkout', count: checkoutCount },
          { id: 'tasks', label: 'Tasks', count: tasks.filter((t) => t.status === 'open').length },
          { id: 'outreach', label: 'Study outreach' },
        ]}
      />
      {tab === 'today' && <TodayTab today={today} />}
      {tab === 'checkout' && <CheckoutTab today={today} />}
      {tab === 'tasks' && <TaskList tasks={tasks} />}
      {tab === 'outreach' && <Outreach />}
    </div>
  )
}

// ---- Today: expected list, check-in, walk-in (US-01–US-04) ---------------------------

function TodayTab({ today }: { today: string }) {
  const rows = selectExpectedToday(today)
  const [checkingIn, setCheckingIn] = useState<ReceptionVisitRow | null>(null)
  const [walkIn, setWalkIn] = useState(false)
  const arrived = rows.filter((r) => r.status !== 'expected').length

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        className="lg:col-span-2"
        title={`Today · ${formatDate(today)}`}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {arrived} of {rows.length} arrived
            </span>
            <Button
              size="sm"
              onClick={() => {
                setWalkIn(true)
                setCheckingIn(null)
              }}
            >
              + Walk-in
            </Button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <Empty>No visits today.</Empty>
        ) : (
          <div className="-mx-4 -my-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Patient</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const waiting = r.status === 'expected'
                  return (
                    // AC-01.2: arrived patients are visually distinct from those still expected
                    <tr key={r.visitId} className={waiting ? 'bg-white' : 'bg-slate-50/70 text-slate-500'}>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{r.time ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={waiting ? 'font-medium text-slate-900' : ''}>{r.name}</span>
                        {r.walkIn && (
                          <span className="ml-2">
                            <Badge tone="violet">Walk-in</Badge>
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{r.phone}</td>
                      <td className="px-4 py-2.5">
                        {r.confirmedReason ?? r.bookedReason ?? <span className="italic text-slate-400">No reason booked</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {waiting && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setCheckingIn(r)
                              setWalkIn(false)
                            }}
                          >
                            Check in
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        {checkingIn && <CheckInPanel key={checkingIn.visitId} row={checkingIn} onClose={() => setCheckingIn(null)} />}
        {walkIn && <WalkInPanel onClose={() => setWalkIn(false)} />}
        {!checkingIn && !walkIn && (
          <Card>
            <p className="text-sm text-slate-500">
              Choose <span className="font-medium text-slate-700">Check in</span> on a row to confirm why the patient came,
              or register a <span className="font-medium text-slate-700">walk-in</span>.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}

/** AC-02.1–02.3: booked reason pre-filled and editable; an empty reason blocks check-in. */
function CheckInPanel({ row, onClose }: { row: ReceptionVisitRow; onClose: () => void }) {
  const [reason, setReason] = useState(row.bookedReason ?? '')
  const { errors, run } = useFieldErrors()

  return (
    <Card title={`Check in ${row.name}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (run(() => checkIn(row.visitId, reason))) onClose()
        }}
      >
        <p className="text-xs text-slate-500">
          Phone <span className="tabular-nums text-slate-700">{row.phone}</span>
          {row.bookedReason ? ` · booked for "${row.bookedReason}"` : ' · no reason was booked'}
        </p>
        <Field label="Reason for visit" value={reason} onChange={setReason} error={errors.reason} autoFocus />
        <div className="flex gap-2">
          <Button type="submit" variant="primary">
            Confirm check-in
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}

/** AC-03.1–03.2: find an existing patient or create one; the visit is checked in with a reason. */
function WalkInPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<{ patientId: string; name: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const { errors, run } = useFieldErrors()
  const results = picked || creating ? [] : searchPatients(query).slice(0, 5)

  return (
    <Card title="Register a walk-in" actions={<Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const who = picked ? { patientId: picked.patientId } : { name, dateOfBirth: dob, phone }
          if (!picked && !creating) return
          if (run(() => registerWalkIn(who, reason))) onClose()
        }}
      >
        {!picked && !creating && (
          <>
            <Field label="Search patients by name" value={query} onChange={setQuery} placeholder="e.g. Kowal" autoFocus />
            {results.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {results.map((p) => (
                  <li key={p.patientId} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {p.name} <span className="text-xs text-slate-500">· {formatDate(p.dateOfBirth)}</span>
                    </span>
                    <Button size="sm" onClick={() => setPicked({ patientId: p.patientId, name: p.name })}>
                      Select
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>
              + New patient
            </Button>
          </>
        )}

        {picked && (
          <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium">{picked.name}</span>
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
              Change
            </Button>
          </div>
        )}

        {creating && (
          <div className="space-y-3 rounded-md border border-slate-200 p-3">
            <Field label="Full name" value={name} onChange={setName} error={errors.name} />
            <Field label="Date of birth" type="date" value={dob} onChange={setDob} error={errors.dateOfBirth} />
            <Field label="Phone" value={phone} onChange={setPhone} error={errors.phone} inputMode="tel" />
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Back to search
            </Button>
          </div>
        )}

        {(picked || creating) && (
          <>
            <Field label="Reason for visit" value={reason} onChange={setReason} error={errors.reason} />
            <Button type="submit" variant="primary">
              Register and check in
            </Button>
          </>
        )}
      </form>
    </Card>
  )
}

// ---- Checkout card (US-12–US-14) ---------------------------------------------------

function CheckoutTab({ today }: { today: string }) {
  const list = selectCheckoutList()
  const [selected, setSelected] = useState<string | null>(null)
  const visitId = list.some((c) => c.visitId === selected) ? selected : (list[0]?.visitId ?? null)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Ready to leave">
        {list.length === 0 ? (
          <Empty>Nobody is waiting at checkout.</Empty>
        ) : (
          <ul className="-mx-2 space-y-1">
            {list.map((c) => (
              <li key={c.visitId}>
                <button
                  type="button"
                  onClick={() => setSelected(c.visitId)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    c.visitId === visitId ? 'bg-teal-50 text-teal-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-xs tabular-nums text-slate-500">{c.phone}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="lg:col-span-2">{visitId && <CheckoutCard key={visitId} visitId={visitId} today={today} />}</div>
    </div>
  )
}

/** AC-13.1–13.3, AC-14.1–14.2: name, phone, tasks; no assessment, nurse notes or chart. */
function CheckoutCard({ visitId, today }: { visitId: string; today: string }) {
  const card = selectCheckoutCard(visitId, today)
  return (
    <Card
      title={card.name}
      actions={
        <Button variant="primary" onClick={() => markLeft(visitId)}>
          Patient has left
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Phone <span className="text-base font-medium tabular-nums text-slate-900">{card.phone}</span>
        </p>
        {/* AC-27.1: reception can record "No study calls" when the patient asks */}
        <OptOutToggle patientId={card.patientId} value={card.studyCallOptOut} />
      </div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">To arrange</h3>
      {card.tasks.length === 0 ? (
        <Empty>Nothing to arrange for this patient.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {card.tasks.map((t) => (
            <TaskRow key={t.taskId} task={t} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">Waiting tasks stay on the task list after the patient leaves.</p>
    </Card>
  )
}

function TaskRow({ task }: { task: ReceptionTask }) {
  return (
    <li className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm ${task.overdue ? 'bg-rose-50' : ''}`}>
      <div>
        <p className="font-medium text-slate-900">{task.action}</p>
        <p className="text-xs text-slate-500">{task.status === 'waiting' ? task.dueLabel : `Due ${formatDate(task.dueDate)}`}</p>
      </div>
      <div className="flex items-center gap-2">
        {task.status === 'waiting' && <Badge tone="amber">Waiting for result</Badge>}
        {task.overdue && <Badge tone="rose">Overdue</Badge>}
        {task.status === 'open' && (
          <Button size="sm" onClick={() => markTaskDone(task.taskId)}>
            Mark done
          </Button>
        )}
      </div>
    </li>
  )
}

// ---- Task list (US-15) ----------------------------------------------------------------

/** AC-15.1–15.2, AC-04.1: open tasks by due date, then waiting; overdue highlighted; phone on every row. */
function TaskList({ tasks }: { tasks: ReceptionTask[] }) {
  return (
    <Card title="Everything reception owes" actions={<span className="text-xs text-slate-500">Across all patients and visits</span>}>
      {tasks.length === 0 ? (
        <Empty>No open or waiting tasks.</Empty>
      ) : (
        <div className="-mx-4 -my-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((t) => (
                <tr key={t.taskId} className={t.overdue ? 'bg-rose-50' : ''}>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {t.status === 'waiting' ? <span className="text-slate-500">{t.dueLabel}</span> : formatDate(t.dueDate)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{t.action}</td>
                  <td className="px-4 py-2.5">{t.name}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{t.phone}</td>
                  <td className="px-4 py-2.5">
                    {t.overdue ? (
                      <Badge tone="rose">Overdue</Badge>
                    ) : t.status === 'waiting' ? (
                      <Badge tone="amber">Waiting for result</Badge>
                    ) : (
                      <Badge tone="sky">Open</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {t.status === 'open' && (
                      <Button size="sm" onClick={() => markTaskDone(t.taskId)}>
                        Mark done
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
