// Nurse: ready-for-nurse queue and intake (E2). Reads only nurse selectors: no physician notes,
// orders or eligibility (AC-06.4, OQ-01). US-05, US-06.
import { useState } from 'react'
import { ageOn, todayIso } from '../domain/dates'
import { saveIntake, selectNurseIntake, selectNurseQueue, useStoreVersion } from '../store/store'
import { formatDate, formatTime, useFieldErrors } from '../components/helpers'
import { Badge, Button, Card, Empty, Field } from '../components/ui'

export function Nurse() {
  useStoreVersion()
  const queue = selectNurseQueue()
  const [selected, setSelected] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const visitId = queue.some((q) => q.visitId === selected) ? selected : null

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Ready for nurse" actions={<span className="text-xs text-slate-500">By arrival time</span>}>
        {queue.length === 0 ? (
          <Empty>No one is waiting for intake.</Empty>
        ) : (
          <ul aria-label="Ready for nurse" className="-mx-2 space-y-1">
            {queue.map((q) => (
              <li key={q.visitId}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(q.visitId)
                    setSaved(null)
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    q.visitId === visitId ? 'bg-teal-50 text-teal-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-medium">{q.name}</span>
                    <span className="text-xs tabular-nums text-slate-500">arrived {formatTime(q.checkedInAt)}</span>
                  </span>
                  <span className="block text-xs text-slate-600">{q.confirmedReason}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-4 lg:col-span-2">
        {saved && (
          <p role="status" className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
            Intake saved. {saved} is ready for the physician.
          </p>
        )}
        {visitId ? (
          <IntakeForm
            key={visitId}
            visitId={visitId}
            onSaved={(name) => {
              setSaved(name)
              setSelected(null)
            }}
          />
        ) : (
          <Card>
            <p className="text-sm text-slate-500">Pick a patient from the queue to record their observations.</p>
          </Card>
        )}
      </div>
    </div>
  )
}

/** AC-06.1–06.4: vitals optional but numeric, patient report required, history read-only. */
function IntakeForm({ visitId, onSaved }: { visitId: string; onSaved: (name: string) => void }) {
  const view = selectNurseIntake(visitId)
  const [bpSystolic, setSys] = useState('')
  const [bpDiastolic, setDia] = useState('')
  const [weightKg, setWeight] = useState('')
  const [tempC, setTemp] = useState('')
  const [patientReport, setReport] = useState('')
  const { errors, run } = useFieldErrors()
  const age = ageOn(view.dateOfBirth, todayIso(new Date()))

  return (
    <>
      <Card title={view.name} actions={<span className="text-xs text-slate-500">{age !== null ? `${age} years` : 'Age unknown'}</span>}>
        <p className="text-sm">
          <span className="text-slate-500">Reason for visit: </span>
          <span className="font-medium text-slate-900">{view.confirmedReason}</span>
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (run(() => saveIntake(visitId, { bpSystolic, bpDiastolic, weightKg, tempC, patientReport }))) onSaved(view.name)
          }}
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="BP systolic (mmHg)" value={bpSystolic} onChange={setSys} error={errors.bpSystolic} inputMode="decimal" />
            <Field label="BP diastolic (mmHg)" value={bpDiastolic} onChange={setDia} error={errors.bpDiastolic} inputMode="decimal" />
            <Field label="Weight (kg)" value={weightKg} onChange={setWeight} error={errors.weightKg} inputMode="decimal" />
            <Field label="Temperature (°C)" value={tempC} onChange={setTemp} error={errors.tempC} inputMode="decimal" />
          </div>
          <Field
            label="Patient report"
            value={patientReport}
            onChange={setReport}
            error={errors.patientReport}
            hint="Required. What the patient tells you, in their words."
            multiline
          />
          <Button type="submit" variant="primary">
            Save intake
          </Button>
        </form>
      </Card>

      <Card title="History (read only)">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnoses</h3>
            {view.diagnoses.length === 0 ? (
              <p className="text-sm text-slate-400">None recorded</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {view.diagnoses.map((d) => (
                  <li key={d.label + d.recordedOn}>
                    <Badge tone={d.status === 'active' ? 'slate' : 'emerald'}>
                      {d.label}
                      {d.status === 'resolved' ? ' (resolved)' : ''}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Earlier observations</h3>
            {view.priorObservations.length === 0 ? (
              <p className="text-sm text-slate-400">None recorded</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {view.priorObservations.map((o) => (
                  <li key={o.recordedAt}>
                    <span className="text-xs text-slate-500">{formatDate(o.recordedAt)} · </span>
                    {o.bpSystolic ?? '—'}/{o.bpDiastolic ?? '—'} mmHg, {o.weightKg ?? '—'} kg, {o.tempC ?? '—'} °C
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Nurse notes</h3>
            {view.nurseNotes.length === 0 ? (
              <p className="text-sm text-slate-400">None recorded</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {view.nurseNotes.map((n) => (
                  <li key={n.date + n.text}>
                    <span className="text-xs text-slate-500">{formatDate(n.date)} · </span>
                    {n.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
    </>
  )
}
