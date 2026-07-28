/**
 * Extrai o caractere digitável de um KeyboardEvent.
 * Retorna null para teclas que devem ser ignoradas pelo motor de digitação.
 */
export function printableFromEvent(event: KeyboardEvent): string | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null

  const { key } = event

  if (key === 'Dead' || key === 'Unidentified') return null
  if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') {
    return null
  }
  if (key.startsWith('Arrow') || /^F\d+$/.test(key)) {
    return null
  }
  if (
    key === 'Tab' ||
    key === 'Escape' ||
    key === 'Backspace' ||
    key === 'Delete' ||
    key === 'Home' ||
    key === 'End' ||
    key === 'PageUp' ||
    key === 'PageDown' ||
    key === 'CapsLock' ||
    key === 'NumLock' ||
    key === 'ScrollLock' ||
    key === 'Insert' ||
    key === 'ContextMenu'
  ) {
    return null
  }

  // Espaço, Enter e caracteres de um único code point
  if (key === ' ') return ' '
  if (key === 'Enter') return '\n'
  if (key.length === 1) return key

  return null
}

/**
 * Espaço serve para repetir o áudio quando o caractere esperado NÃO é espaço
 * e NÃO é acento morto (´ ` ^ ~), que no ABNT pedem Espaço depois da tecla.
 */
const ACCENTS_NEED_SPACE = new Set(['´', '`', '^', '~'])

export function isReplayShortcut(
  event: KeyboardEvent,
  expected: string | null,
): boolean {
  if (expected && ACCENTS_NEED_SPACE.has(expected)) return false
  return (
    event.key === ' ' &&
    expected !== ' ' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  )
}
