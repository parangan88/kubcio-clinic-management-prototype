// App shell: header with role switcher and demo controls; each role sees only its own screens
// (US-28, R-09: no router). "Reset demo" is in every role (US-30); "Simulate result" is physician-only (OQ-09).
import { useState } from 'react'
import { DemoControls } from './components/DemoControls'
import { ResetDemoButton } from './components/ResetDemoButton'
import { RoleSwitcher, type Role } from './components/RoleSwitcher'
import { Nurse } from './screens/Nurse'
import { Physician } from './screens/Physician'
import { Reception } from './screens/Reception'

export default function App() {
  const [role, setRole] = useState<Role>('reception')
  // bumped on reset so the role screen remounts and drops selections that no longer exist
  const [generation, setGeneration] = useState(0)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-sm font-bold text-white">
              K
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Kubcio Clinic</p>
              <p className="text-xs text-slate-500">Prototype · synthetic data only</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {role === 'physician' && <DemoControls />}
            <ResetDemoButton onReset={() => setGeneration((g) => g + 1)} />
            <RoleSwitcher role={role} onChange={setRole} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* keyed by role (and reset generation) so each role starts on its first tab */}
        {role === 'reception' && <Reception key={`reception-${generation}`} />}
        {role === 'nurse' && <Nurse key={`nurse-${generation}`} />}
        {role === 'physician' && <Physician key={`physician-${generation}`} />}
      </main>
    </div>
  )
}
