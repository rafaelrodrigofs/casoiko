interface TypingLaneProps {
  revealed: string
  errorFlash: boolean
  done: boolean
  /** Tamanho total da resposta (para encolher quadrados em drills longos) */
  totalLength?: number
}

/**
 * Só mostra quadrados depois do acerto — sem pista de tamanho/espaços futuros.
 */
export function TypingLane({
  revealed,
  errorFlash,
  done,
  totalLength = 0,
}: TypingLaneProps) {
  const chars = [...revealed]
  const long = totalLength >= 18 || chars.length >= 18
  const compact = totalLength >= 28 || chars.length >= 28

  return (
    <div
      className={`typing-lane${done ? ' typing-lane-done' : ''}${errorFlash ? ' typing-lane-error' : ''}${chars.length === 0 ? ' typing-lane-empty' : ''}${long ? ' typing-lane-long' : ''}${compact ? ' typing-lane-compact' : ''}`}
      aria-label="Área de digitação"
      aria-live="polite"
    >
      {chars.map((char, i) => {
        const isSpace = char === ' '
        const isEnter = char === '\n'
        let className = 'char-box char-box-revealed'
        if (isSpace || isEnter) className += ' char-box-space'
        if (done) className += ' char-box-done'

        return (
          <span key={`${i}-${char}`} className={className} aria-hidden>
            {isSpace ? '·' : isEnter ? '↵' : char}
          </span>
        )
      })}
    </div>
  )
}
