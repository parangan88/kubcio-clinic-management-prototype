// Physician-side study components (E6): outcome badge, per-criterion evidence, decisions, opt-out.
// They render physician selector output only; reception never imports these.
import type { CriterionResult, EligibilityResult, Evidence, Outcome, StudyDecision } from '../domain/types'
import { decideStudy } from '../store/store'
import { OUTCOME_LABEL, OUTCOME_TONE, criterionLabel, formatDate, formatDateTime, useFieldErrors } from './helpers'
import { Badge, Button } from './ui'

export function OutcomeBadge({ outcome, prefix }: { outcome: Outcome; prefix?: string }) {
  return (
    <Badge tone={OUTCOME_TONE[outcome]}>
      {prefix ? `${prefix}: ` : ''}
      {OUTCOME_LABEL[outcome]}
    </Badge>
  )
}

/** AC-20.2: one line of evidence: list entry with date, quoted sentence with note date, order, age or reason. */
function EvidenceLine({ e }: { e: Evidence }) {
  switch (e.type) {
    case 'diagnosis':
      return (
        <>
          Diagnosis list: <span className="font-medium">{e.label}</span> ({e.status}), recorded {formatDate(e.date)}
        </>
      )
    case 'note':
      return (
        <>
          <q className="italic text-slate-800">{e.quote}</q> <span className="text-slate-500">— physician note, {formatDate(e.date)}</span>
        </>
      )
    case 'order':
      return (
        <>
          {e.test} {e.status === 'pending' ? 'ordered, result pending' : 'resulted, not yet reviewed'}
        </>
      )
    case 'age':
      // AC-20.3: a missing value is shown as unknown
      return e.years === null ? <>Age unknown: date of birth missing</> : <>Age {e.years}</>
    case 'reason':
      return <span className="text-slate-700">{e.text}</span>
  }
}

function CriterionRow({ c }: { c: CriterionResult }) {
  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">{criterionLabel(c.criterion)}</span>
        <OutcomeBadge outcome={c.outcome} />
      </div>
      <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
        {c.evidence.map((e, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden className="text-slate-300">•</span>
            <span>
              <EvidenceLine e={e} />
            </span>
          </li>
        ))}
      </ul>
    </li>
  )
}

/** AC-20.1–20.3: each criterion with its own result and evidence. */
export function EligibilityDetails({ result }: { result: EligibilityResult }) {
  return (
    <ul className="divide-y divide-slate-100">
      {result.criteria.map((c, i) => (
        <CriterionRow key={i} c={c} />
      ))}
    </ul>
  )
}

/** AC-26.1, AC-27.2: decline and opt-out flags wherever studies appear. */
export function StudyFlags({ studyName, declined, optOut }: { studyName: string; declined: boolean; optOut: boolean }) {
  if (!declined && !optOut) return null
  return (
    <span className="inline-flex flex-wrap gap-1">
      {declined && <Badge tone="rose">Declined {studyName}</Badge>}
      {optOut && <Badge tone="rose">No study calls</Badge>}
    </span>
  )
}

/**
 * AC-22.1–22.2: approve contact (meets or needs review, not opted out or declined) or mark not
 * eligible; shows who decided and when. The store enforces the same rules.
 */
export function DecisionControls({
  patientId,
  studyId,
  outcome,
  decision,
  declined,
  optOut,
}: {
  patientId: string
  studyId: string
  outcome: Outcome
  decision: StudyDecision | null
  declined: boolean
  optOut: boolean
}) {
  const { errors, run } = useFieldErrors()
  const approved = decision?.decision === 'approve_contact'
  const canApprove = outcome !== 'does_not_meet' && !optOut && !declined && !approved
  const canReject = decision?.decision !== 'not_eligible'

  return (
    <div className="space-y-1">
      {decision && (
        <p className="text-xs text-slate-600">
          {approved ? 'Approved for contact' : 'Marked not eligible'} by {decision.decidedBy}, {formatDateTime(decision.decidedAt)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <Button size="sm" variant="primary" onClick={() => run(() => decideStudy(patientId, studyId, 'approve_contact'))}>
            Approve contact
          </Button>
        )}
        {canReject && (
          <Button size="sm" onClick={() => run(() => decideStudy(patientId, studyId, 'not_eligible'))}>
            Not eligible
          </Button>
        )}
      </div>
      {errors.decision && <p className="text-xs text-rose-600">{errors.decision}</p>}
    </div>
  )
}
