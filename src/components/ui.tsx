// Small shared UI pieces: badges, buttons, cards, fields, tabs. Presentation only, no data access.
import { useId, type ReactNode } from 'react'
import type { VisitStatus } from '../domain/types'

// ---- badges -----------------------------------------------------------------------

export type Tone = 'slate' | 'sky' | 'amber' | 'violet' | 'emerald' | 'rose' | 'teal'

const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
}

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  )
}

const STATUS: Record<VisitStatus, { label: string; tone: Tone }> = {
  expected: { label: 'Expected', tone: 'slate' },
  checked_in: { label: 'Checked in', tone: 'sky' },
  ready_for_physician: { label: 'Ready for physician', tone: 'amber' },
  with_physician: { label: 'With physician', tone: 'violet' },
  checkout: { label: 'Checkout', tone: 'teal' },
  done: { label: 'Done', tone: 'emerald' },
}

export function StatusBadge({ status }: { status: VisitStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
}

// ---- buttons, cards -------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 focus-visible:outline-teal-700',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400',
  ghost: 'text-teal-800 hover:bg-teal-50 focus-visible:outline-teal-700',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({
  title,
  actions,
  children,
  className = '',
  ariaLabel,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Gives the card a region role with this name. */
  ariaLabel?: string
}) {
  return (
    <section aria-label={ariaLabel} className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>
}

// ---- fields -----------------------------------------------------------------------

const inputBase =
  'block w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-teal-600'

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  placeholder?: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  multiline?: boolean
  className?: string
  autoFocus?: boolean
}

/** Labelled input; an error is shown beside the field and linked with aria-describedby. */
export function Field({ label, value, onChange, error, hint, multiline, className = '', ...rest }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const common = {
    id,
    value,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: `${inputBase} ${error ? 'ring-rose-400' : 'ring-slate-300'}`,
  }
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      {multiline ? (
        <textarea rows={3} {...common} placeholder={rest.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} {...rest} type={rest.type ?? 'text'} onChange={(e) => onChange(e.target.value)} />
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

// ---- tabs ---------------------------------------------------------------------------

export interface TabDef<T extends string> {
  id: T
  label: string
  count?: number
  hint?: string
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: TabDef<T>[]; value: T; onChange: (t: T) => void }) {
  return (
    <nav className="flex gap-1 border-b border-slate-200" role="tablist">
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
