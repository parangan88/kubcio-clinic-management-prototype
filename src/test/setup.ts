import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest globals are off (research R-03), so RTL's automatic cleanup is not registered: do it here.
afterEach(() => cleanup())
