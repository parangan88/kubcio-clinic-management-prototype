// AC-27.1: "No study calls", settable by reception or physician. Shows no clinical data.
import { setOptOut } from '../store/store'

export function OptOutToggle({ patientId, value }: { patientId: string; value: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => setOptOut(patientId, e.target.checked)}
        className="h-4 w-4 accent-rose-600"
      />
      No study calls
    </label>
  )
}
