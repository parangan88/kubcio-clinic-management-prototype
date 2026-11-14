// S-04 (AC-06.2): a non-numeric weight is rejected with a message beside the field and
// nothing is saved, so the patient stays in the nurse queue.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { todayIso } from '../domain/dates'
import { initStore, selectNurseQueue } from '../store/store'
import { memoryStorage } from '../test/memoryStorage'
import { Nurse } from './Nurse'

beforeEach(() => {
  initStore({ today: todayIso(new Date()), storage: memoryStorage() })
})

describe('Nurse · intake', () => {
  it('S-04 AC-06.2 nurse types "abc" for weight → field error beside weight, nothing saved', async () => {
    const user = userEvent.setup()
    render(<Nurse />)

    const queue = screen.getByRole('list', { name: /ready for nurse/i })
    await user.click(within(queue).getByRole('button', { name: /ines varga/i }))

    const weight = screen.getByLabelText(/weight \(kg\)/i)
    await user.type(weight, 'abc')
    await user.type(screen.getByLabelText(/patient report/i), 'Headaches for three days')
    await user.click(screen.getByRole('button', { name: /save intake/i }))

    expect(weight).toHaveAttribute('aria-invalid', 'true')
    expect(weight).toHaveAccessibleDescription('Enter a number')
    // nothing saved: still checked in and still in the queue
    expect(selectNurseQueue().some((q) => q.name === 'Ines Varga')).toBe(true)
    expect(within(screen.getByRole('list', { name: /ready for nurse/i })).getByText('Ines Varga')).toBeInTheDocument()
  })

  it('AC-06.3 AC-05.2 valid intake saves and the patient leaves the queue', async () => {
    const user = userEvent.setup()
    render(<Nurse />)

    const queue = screen.getByRole('list', { name: /ready for nurse/i })
    await user.click(within(queue).getByRole('button', { name: /ines varga/i }))
    await user.type(screen.getByLabelText(/weight \(kg\)/i), '64.5')
    await user.type(screen.getByLabelText(/patient report/i), 'Headaches for three days')
    await user.click(screen.getByRole('button', { name: /save intake/i }))

    expect(selectNurseQueue().some((q) => q.name === 'Ines Varga')).toBe(false)
    expect(within(screen.getByRole('list', { name: /ready for nurse/i })).queryByText('Ines Varga')).toBeNull()
  })
})
