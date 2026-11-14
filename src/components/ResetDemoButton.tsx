// AC-30.1: reset clears saved changes and reloads the seed, after a confirm prompt.
// Shown in every role; it reveals no data.
import { resetDemo } from '../store/store'
import { Button } from './ui'

export function ResetDemoButton({ onReset }: { onReset: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        const ok = window.confirm('Reset the demo? All changes in this browser will be lost and the starting data reloaded.')
        if (!ok) return
        resetDemo()
        onReset()
      }}
    >
      Reset demo
    </Button>
  )
}
