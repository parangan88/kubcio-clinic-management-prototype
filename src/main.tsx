import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initStore } from './store/store'

// Load saved demo state from localStorage, or the seed shifted to today (research R-07, R-08).
initStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
