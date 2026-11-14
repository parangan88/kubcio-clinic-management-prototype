// Demo controls (E8). AC-29.1: pick a pending order, enter a value, it becomes "resulted" now.
// Rendered only in the physician role (OQ-09): pending orders are clinical data that reception
// must not receive. "Reset demo" (AC-30.1) is a separate button shown in every role.
import { useState } from 'react'
import { selectPendingOrders, simulateResult, useStoreVersion } from '../store/store'
import { useFieldErrors } from './helpers'
import { Button, Field } from './ui'

export function DemoControls() {
  useStoreVersion()
  const [open, setOpen] = useState(false)
  const pending = selectPendingOrders()
  const [orderId, setOrderId] = useState('')
  const [value, setValue] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const { errors, run } = useFieldErrors()
  const chosen = pending.some((p) => p.orderId === orderId) ? orderId : (pending[0]?.orderId ?? '')

  return (
    <div className="relative">
      <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Demo · simulate result
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Simulate a result arriving"
          className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-amber-200 bg-white p-4 shadow-lg"
        >
          <p className="mb-3 text-xs text-amber-800">
            Demo control: makes a pending order's result arrive now, as if from the lab.
          </p>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-500">No pending orders. Order a test from a visit first.</p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                const p = pending.find((x) => x.orderId === chosen)
                if (p && run(() => simulateResult(chosen, value))) {
                  setDone(`${p.test} for ${p.name} has arrived (${value.trim()}). It is in the Results inbox.`)
                  setValue('')
                  setOrderId('')
                }
              }}
            >
              <div>
                <label htmlFor="demo-order" className="mb-1 block text-xs font-medium text-slate-600">
                  Pending order
                </label>
                <select
                  id="demo-order"
                  value={chosen}
                  onChange={(e) => {
                    setOrderId(e.target.value)
                    setDone(null)
                  }}
                  className="block w-full rounded-md border-0 px-2 py-2 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-teal-600"
                >
                  {pending.map((p) => (
                    <option key={p.orderId} value={p.orderId}>
                      {p.name} · {p.test}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Result value" value={value} onChange={setValue} error={errors.value} placeholder="e.g. 7.4%" />
              <Button type="submit" variant="primary" size="sm">
                Mark resulted now
              </Button>
            </form>
          )}
          {done && (
            <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {done}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
