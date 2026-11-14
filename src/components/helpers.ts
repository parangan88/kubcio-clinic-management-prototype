// Non-component UI helpers (kept apart from components for React fast refresh).
import { useState } from 'react'
import type { Criterion, Outcome } from '../domain/types'
import { StoreError } from '../store/store'

/** Wording used everywhere an eligibility outcome is shown (spec: meets / doesn't meet / needs review). */
export const OUTCOME_LABEL: Record<Outcome, string> = {
  meets: 'meets',
  does_not_meet: "doesn't meet",
  needs_review: 'needs review',
}

export const OUTCOME_TONE: Record<Outcome, 'emerald' | 'amber' | 'slate'> = {
  meets: 'emerald',
  needs_review: 'amber',
  does_not_meet: 'slate',
}

/** Plain-language name for a study criterion (criteria are data, AC-23.1). */
export function criterionLabel(c: Criterion): string {
  return c.kind === 'minAge' ? `Age ${c.years} or over` : `Documented ${c.condition}`
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(date: string | null): string {
  if (!date) return '—'
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Run a store action; on StoreError keep its field errors for display beside each field,
 * otherwise rethrow. Returns true when the action succeeded.
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({})
  function run(action: () => void): boolean {
    try {
      action()
      setErrors({})
      return true
    } catch (e) {
      if (e instanceof StoreError) {
        setErrors(e.fieldErrors)
        return false
      }
      throw e
    }
  }
  return { errors, run, clear: () => setErrors({}) }
}
