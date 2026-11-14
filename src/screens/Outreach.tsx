// Reception study outreach (E7): who to call and about which study, with a call log.
// Reads only selectOutreachList, which returns name, phone, study name and attempts: no
// eligibility, evidence or clinical data (AC-24.2). US-24–US-27.
import { useState } from 'react'
import type { OutreachAttempt } from '../domain/types'
import { logCall, selectOutreachList, setOptOut, useStoreVersion, type ReceptionOutreachRow } from '../store/store'
import { formatDateTime, useFieldErrors } from '../components/helpers'
import { Badge, Button, Card, Empty } from '../components/ui'

const RESULT_LABEL: Record<NonNullable<OutreachAttempt['result']>, string> = {
  declined: 'declined',
  consented: 'consented',
  call_back_later: 'call back later',
}

export function Outreach() {
  useStoreVersion()
  const rows = selectOutreachList()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {notice && (
        <p role="status" className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {notice}
        </p>
      )}
      <Card title="Study calls to make" actions={<span className="text-xs text-slate-500">Approved by a physician</span>}>
        {rows.length === 0 ? (
          <Empty>No one to call. Patients appear here once a physician approves contact.</Empty>
        ) : (
          <ul aria-label="Study calls to make" className="divide-y divide-slate-100">
            {rows.map((r) => (
              <OutreachRow key={`${r.patientId}-${r.studyId}`} row={r} onNotice={setNotice} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/** AC-24.1, AC-25.1–25.3, AC-27.1: contact details, attempts so far, log a call, or opt out. */
function OutreachRow({ row, onNotice }: { row: ReceptionOutreachRow; onNotice: (n: string) => void }) {
  const [reached, setReached] = useState<'yes' | 'no' | ''>('')
  const [result, setResult] = useState<OutreachAttempt['result']>(null)
  const { errors, run } = useFieldErrors()
  const name = `call-${row.patientId}-${row.studyId}`

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{row.name}</p>
          <p className="text-base tabular-nums text-slate-800">{row.phone}</p>
          <p className="text-xs text-slate-500">About: {row.studyName}</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>
            {row.attempts.length === 0 ? 'No calls yet' : `${row.attempts.length} attempt${row.attempts.length > 1 ? 's' : ''}`}
          </p>
          <ul className="mt-1 space-y-0.5">
            {row.attempts.map((a) => (
              <li key={a.at}>
                {formatDateTime(a.at)} ·{' '}
                {a.reached ? <Badge tone="sky">reached{a.result ? `, ${RESULT_LABEL[a.result]}` : ''}</Badge> : <Badge>not reached</Badge>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form
        className="mt-2 flex flex-wrap items-end gap-3 rounded-md bg-slate-50 px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!reached) return
          const call = { reached: reached === 'yes', result: reached === 'yes' ? result : null }
          if (run(() => logCall(row.patientId, row.studyId, call))) {
            if (call.result === 'declined' || call.result === 'consented') {
              onNotice(`${row.name} ${RESULT_LABEL[call.result]} ${row.studyName}. Removed from the call list.`)
            }
            setReached('')
            setResult(null)
          }
        }}
      >
        <fieldset className="flex items-center gap-3 text-sm">
          <legend className="sr-only">Call outcome for {row.name}</legend>
          <label className="flex items-center gap-1.5">
            <input type="radio" name={name} checked={reached === 'no'} onChange={() => setReached('no')} className="accent-teal-700" />
            Not reached
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name={name} checked={reached === 'yes'} onChange={() => setReached('yes')} className="accent-teal-700" />
            Reached
          </label>
        </fieldset>
        {reached === 'yes' && (
          <div>
            <label htmlFor={`${name}-result`} className="mb-0.5 block text-xs font-medium text-slate-600">
              What did they say?
            </label>
            <select
              id={`${name}-result`}
              value={result ?? ''}
              onChange={(e) => setResult((e.target.value || null) as OutreachAttempt['result'])}
              className="rounded-md border-0 px-2 py-1.5 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-teal-600"
            >
              <option value="">Choose…</option>
              <option value="consented">Consented</option>
              <option value="declined">Declined</option>
              <option value="call_back_later">Call back later</option>
            </select>
            {errors.result && <p className="mt-1 text-xs text-rose-600">{errors.result}</p>}
          </div>
        )}
        <Button type="submit" size="sm" variant="primary" disabled={!reached}>
          Log call
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            setOptOut(row.patientId, true)
            onNotice(`${row.name} asked for no study calls. Removed from every call list.`)
          }}
        >
          Patient asks: no study calls
        </Button>
      </form>
    </li>
  )
}
