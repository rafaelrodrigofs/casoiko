import type { Exercise, KeyResult, SessionState } from '../types/exercise'

function resetExerciseFields(partial: Pick<SessionState, 'exercises' | 'index' | 'completed' | 'mistakes'>): SessionState {
  return {
    ...partial,
    cursor: 0,
    revealed: '',
    exerciseDone: false,
    sessionDone: false,
  }
}

export function createSession(
  exercises: Exercise[],
  startIndex = 0,
): SessionState {
  const index = Math.min(Math.max(0, startIndex), Math.max(0, exercises.length - 1))
  return resetExerciseFields({
    exercises,
    index: exercises.length === 0 ? 0 : index,
    completed: exercises.length === 0 ? 0 : index,
    mistakes: 0,
  })
}

export function currentExercise(session: SessionState): Exercise | null {
  return session.exercises[session.index] ?? null
}

export function expectedChar(session: SessionState): string | null {
  const exercise = currentExercise(session)
  if (!exercise || session.exerciseDone) return null
  return exercise.answer[session.cursor] ?? null
}

/**
 * Processa uma tecla digitável (já normalizada para o caractere esperado).
 * Comparação case-sensitive, char a char.
 */
export function handleKey(session: SessionState, key: string): KeyResult {
  if (session.sessionDone || session.exerciseDone) {
    return { kind: 'ignored' }
  }

  const exercise = currentExercise(session)
  if (!exercise) return { kind: 'ignored' }

  const expected = exercise.answer[session.cursor]
  if (expected === undefined) return { kind: 'ignored' }

  if (key !== expected) {
    return {
      kind: 'incorrect',
      session: {
        ...session,
        mistakes: session.mistakes + 1,
      },
    }
  }

  const nextCursor = session.cursor + 1
  const revealed = session.revealed + key
  const exerciseDone = nextCursor >= exercise.answer.length

  if (!exerciseDone) {
    return {
      kind: 'correct',
      session: {
        ...session,
        cursor: nextCursor,
        revealed,
      },
    }
  }

  const nextIndex = session.index + 1
  const sessionDone = nextIndex >= session.exercises.length
  const completed = session.completed + 1

  const doneSession: SessionState = {
    ...session,
    cursor: nextCursor,
    revealed,
    exerciseDone: true,
    completed,
    sessionDone,
  }

  return { kind: 'complete', session: doneSession }
}

/** Avança para o próximo exercício após completar o atual. */
export function advanceAfterComplete(session: SessionState): SessionState {
  if (!session.exerciseDone || session.sessionDone) {
    return session
  }

  return resetExerciseFields({
    exercises: session.exercises,
    index: session.index + 1,
    completed: session.completed,
    mistakes: session.mistakes,
  })
}

export function restartSession(exercises: Exercise[]): SessionState {
  return createSession(exercises)
}
