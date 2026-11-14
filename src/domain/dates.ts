// Pure date helpers on 'YYYY-MM-DD' strings (research R-06). No clock reads.

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return [y, m, d]
}

/** Whole years of age on `today`, or null when the date of birth is unknown. */
export function ageOn(dateOfBirth: string | null, today: string): number | null {
  if (!dateOfBirth) return null
  const [by, bm, bd] = parts(dateOfBirth)
  const [ty, tm, td] = parts(today)
  let years = ty - by
  if (tm < bm || (tm === bm && td < bd)) years -= 1
  return years
}

/** `date` plus `n` days (n may be negative). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a)
  const [by, bm, bd] = parts(b)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

export function isBefore(a: string, b: string): boolean {
  return a.slice(0, 10) < b.slice(0, 10)
}

/** Local calendar date of `now` as 'YYYY-MM-DD'. Used only at the store boundary. */
export function todayIso(now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
