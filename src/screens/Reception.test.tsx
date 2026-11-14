// S-02 (AC-02.2): check-in is blocked with a message when there is no booked reason and the
// reason field is left empty. Also AC-02.3: with a reason, check-in succeeds.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { todayIso } from '../domain/dates'
import { initStore } from '../store/store'
import { memoryStorage } from '../test/memoryStorage'
import { Reception } from './Reception'

beforeEach(() => {
  // seed dates shift to the real today, so "today's expected list" is populated
  initStore({ today: todayIso(new Date()), storage: memoryStorage() })
})

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('tr')
  if (!row) throw new Error(`no row for ${name}`)
  return row
}

describe('Reception · check-in', () => {
  it('S-02 AC-02.2 check-in with no booked reason and an empty reason field is blocked with a message', async () => {
    const user = userEvent.setup()
    render(<Reception />)

    await user.click(within(rowFor('Hana Kowal')).getByRole('button', { name: /check in/i }))
    const reason = screen.getByLabelText(/reason for visit/i)
    expect(reason).toHaveValue('')

    await user.click(screen.getByRole('button', { name: /confirm check-in/i }))

    expect(reason).toHaveAttribute('aria-invalid', 'true')
    expect(reason).toHaveAccessibleDescription('Enter the reason for the visit')
    expect(within(rowFor('Hana Kowal')).getByText('Expected')).toBeInTheDocument()
  })

  it('AC-02.1 AC-02.3 a booked reason is pre-filled and editable; confirming checks the patient in', async () => {
    const user = userEvent.setup()
    render(<Reception />)

    await user.click(within(rowFor('Meera Sen')).getByRole('button', { name: /check in/i }))
    const reason = screen.getByLabelText(/reason for visit/i)
    expect(reason).toHaveValue('Tiredness, thirst')

    await user.click(screen.getByRole('button', { name: /confirm check-in/i }))
    expect(within(rowFor('Meera Sen')).getByText('Checked in')).toBeInTheDocument()
  })
})
