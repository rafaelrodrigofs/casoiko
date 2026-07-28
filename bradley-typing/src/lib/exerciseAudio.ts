/**
 * Áudio da tecla atual (cursor).
 * Não toca a sequência inteira de uma vez — só o caractere que precisa digitar agora.
 */
export function currentCharAudio(
  exercise: {
    audio?: string
    audioSequence?: string[]
    answer: string
  },
  cursor: number,
): string | null {
  if (cursor < 0 || cursor >= exercise.answer.length) return null

  if (exercise.audioSequence && exercise.audioSequence.length > 0) {
    return exercise.audioSequence[cursor] ?? null
  }

  // Exercício de um único clip: só na primeira posição
  if (exercise.audio && cursor === 0) {
    return exercise.audio
  }

  return null
}
