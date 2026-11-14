// Results inbox and review (US-16, US-17, US-19): the inbox row flags a study that needs review,
// saving the review note sets the order to reviewed, and any outcome change is shown old → new.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { todayIso } from '../domain/dates'
import { initStore, selectResultsCount } from '../store/store'
import { memoryStorage } from '../test/memoryStorage'
import { Physician } from './Physician'

beforeEach(() => {
  initStore({ today: todayIso(new Date()), storage: memoryStorage() })
})

describe('Physician · results', () => {
  it('AC-16.1 AC-16.2 AC-19.2 AC-17.1 inbox row shows the study flag; review shows the outcome change and clears the row', async () => {
    const user = userEvent.setup()
    render(<Physician />)

    // AC-16.2 count badge in the navigation
    const resultsTab = screen.getByRole('tab', { name: /results/i })
    expect(resultsTab).toHaveTextContent('1')
    await user.click(resultsTab)

    // AC-16.1 row content, AC-19.2 study flag on the row
    const inbox = screen.getByRole('list', { name: /results waiting for review/i })
    const row = within(inbox).getByRole('listitem')
    expect(row).toHaveTextContent('Fatima Haddad')
    expect(row).toHaveTextContent('HbA1c')
    expect(row).toHaveTextContent('Gained 6 kg this year, check glucose')
    expect(row).toHaveTextContent('5.9%')
    expect(within(row).getByText(/study: needs review/i)).toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: /review/i }))
    // AC-19.2 flag on the review screen too
    const review = screen.getByRole('region', { name: /review result/i })
    expect(within(review).getByText(/adults with documented diabetes: needs review/i)).toBeInTheDocument()

    await user.type(within(review).getByLabelText(/review note/i), 'Normal result')
    await user.click(within(review).getByRole('button', { name: /save review/i }))

    // AC-19.2 change of outcome shown with old and new
    const done = screen.getByRole('status')
    expect(done).toHaveTextContent(/adults with documented diabetes/i)
    expect(done).toHaveTextContent(/needs review\s*→\s*doesn't meet/i)
    // AC-17.1 order reviewed: gone from the inbox and the badge
    expect(selectResultsCount()).toBe(0)
    expect(screen.queryByRole('list', { name: /results waiting for review/i })).toBeNull()
  })
})
