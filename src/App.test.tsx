// US-30 / S-14: "Reset demo" is available in every role, asks for confirmation, and restores the
// seed. Cancelling keeps the changes. US-28: the role switcher changes the screens shown.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { todayIso } from './domain/dates'
import { initStore } from './store/store'
import { memoryStorage } from './test/memoryStorage'

beforeEach(() => {
  initStore({ today: todayIso(new Date()), storage: memoryStorage() })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function meeraRow(): HTMLElement {
  const row = screen.getByText('Meera Sen').closest('tr')
  if (!row) throw new Error('no row for Meera Sen')
  return row
}

async function checkInMeera(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(meeraRow()).getByRole('button', { name: /check in/i }))
  await user.click(screen.getByRole('button', { name: /confirm check-in/i }))
  expect(within(meeraRow()).getByText('Checked in')).toBeInTheDocument()
}

describe('App · reset demo (US-30)', () => {
  it('AC-30.1 S-14 reset asks for confirmation, then restores the seed', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)
    await checkInMeera(user)

    await user.click(screen.getByRole('button', { name: /reset demo/i }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(within(meeraRow()).getByText('Expected')).toBeInTheDocument()
  })

  it('AC-30.1 cancelling the confirm prompt keeps all changes', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App />)
    await checkInMeera(user)

    await user.click(screen.getByRole('button', { name: /reset demo/i }))

    expect(within(meeraRow()).getByText('Checked in')).toBeInTheDocument()
  })

  it('AC-28.1 reset is available in every role; simulate result only for the physician (OQ-09)', async () => {
    const user = userEvent.setup()
    render(<App />)
    for (const role of ['Receptionist', 'Nurse', 'Physician']) {
      await user.click(screen.getByRole('button', { name: role }))
      expect(screen.getByRole('button', { name: /reset demo/i })).toBeInTheDocument()
      const simulate = screen.queryByRole('button', { name: /simulate result/i })
      if (role === 'Physician') expect(simulate).toBeInTheDocument()
      else expect(simulate).toBeNull()
    }
  })
})
