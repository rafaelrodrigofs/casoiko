import { useEffect, useRef } from 'react'
import { isReplayShortcut, printableFromEvent } from '../lib/keys'

interface UseTypingKeysOptions {
  enabled: boolean
  expected: string | null
  onChar: (char: string) => void
  onReplay: () => void
}

/**
 * Captura teclado global + mantém foco num input oculto (necessário no Electron).
 */
export function useTypingKeys({
  enabled,
  expected,
  onChar,
  onReplay,
}: UseTypingKeysOptions) {
  const inputRef = useRef<HTMLInputElement>(null)
  const expectedRef = useRef(expected)
  const onCharRef = useRef(onChar)
  const onReplayRef = useRef(onReplay)

  expectedRef.current = expected
  onCharRef.current = onChar
  onReplayRef.current = onReplay

  useEffect(() => {
    if (!enabled) return

    const focusHidden = () => {
      inputRef.current?.focus({ preventScroll: true })
    }

    focusHidden()

    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return

      if (isReplayShortcut(event, expectedRef.current)) {
        event.preventDefault()
        onReplayRef.current()
        return
      }

      const ch = printableFromEvent(event)
      if (ch === null) return

      event.preventDefault()
      onCharRef.current(ch)
    }

    const onWindowFocus = () => focusHidden()
    const onMouseDown = () => {
      // Recupera foco após clicar em botões (exceto se for o próprio replay — ainda ok)
      requestAnimationFrame(focusHidden)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('focus', onWindowFocus)
    window.addEventListener('mousedown', onMouseDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('focus', onWindowFocus)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [enabled])

  return inputRef
}
