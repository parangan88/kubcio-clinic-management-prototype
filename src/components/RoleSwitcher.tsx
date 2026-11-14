// AC-28.1: header switcher; changing role changes the screens and the data shown.
// A prototype stand-in for login, not security (spec "Roles and visibility").
export type Role = 'reception' | 'nurse' | 'physician'

const ROLES: { id: Role; label: string }[] = [
  { id: 'reception', label: 'Receptionist' },
  { id: 'nurse', label: 'Nurse' },
  { id: 'physician', label: 'Physician' },
]

export function RoleSwitcher({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span id="role-label" className="text-xs font-medium text-slate-500">
        Viewing as
      </span>
      <div role="group" aria-labelledby="role-label" className="flex rounded-lg bg-slate-100 p-0.5">
        {ROLES.map((r) => {
          const active = r.id === role
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(r.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
