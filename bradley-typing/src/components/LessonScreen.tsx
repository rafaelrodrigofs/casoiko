import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AutoAudio, type AutoAudioHandle } from './AutoAudio'
import { TypingLane } from './TypingLane'
import { SessionStats } from './SessionStats'
import { useTypingKeys } from '../hooks/useTypingKeys'
import { currentCharAudio } from '../lib/exerciseAudio'
import {
  advanceAfterComplete,
  createSession,
  currentExercise,
  expectedChar,
  handleKey,
} from '../lib/session'
import type { Exercise } from '../types/exercise'
import '../App.css'

const ADVANCE_MS = 900
const ERROR_FLASH_MS = 220

interface LessonScreenProps {
  lessonTitle: string
  exercises: Exercise[]
  startIndex: number
  onBack: () => void
  onExerciseComplete: (exerciseId: string) => void
  onLessonComplete: () => void
}

export function LessonScreen({
  lessonTitle,
  exercises,
  startIndex,
  onBack,
  onExerciseComplete,
  onLessonComplete,
}: LessonScreenProps) {
  const [session, setSession] = useState(() =>
    createSession(exercises, startIndex),
  )
  const [errorFlash, setErrorFlash] = useState(false)
  const audioRef = useRef<AutoAudioHandle>(null)
  const flashTimer = useRef<number | null>(null)
  const advanceTimer = useRef<number | null>(null)
  const lessonDoneNotified = useRef(false)
  const lastMarkedId = useRef<string | null>(null)

  const exercise = currentExercise(session)
  const expected = expectedChar(session)
  const currentClip = useMemo(() => {
    if (!exercise || session.exerciseDone) return null
    return currentCharAudio(exercise, session.cursor)
  }, [exercise, session.cursor, session.exerciseDone])

  const playId = exercise
    ? `${exercise.id}:${session.cursor}`
    : 'none'

  const typeLabel = useMemo(() => {
    if (!exercise) return ''
    const labels: Record<Exercise['type'], string> = {
      letra: 'Letra',
      silaba: 'Sílaba',
      palavra: 'Palavra',
      frase: 'Frase',
      sequencia: 'Sequência',
    }
    return labels[exercise.type]
  }, [exercise])

  const clearTimers = useCallback(() => {
    if (flashTimer.current !== null) {
      window.clearTimeout(flashTimer.current)
      flashTimer.current = null
    }
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  useEffect(() => {
    if (!session.exerciseDone) return

    const current = session.exercises[session.index]
    if (current && lastMarkedId.current !== current.id) {
      lastMarkedId.current = current.id
      onExerciseComplete(current.id)
    }

    if (session.sessionDone) {
      if (!lessonDoneNotified.current) {
        lessonDoneNotified.current = true
        onLessonComplete()
      }
      return
    }

    advanceTimer.current = window.setTimeout(() => {
      setSession((prev) => advanceAfterComplete(prev))
      setErrorFlash(false)
    }, ADVANCE_MS)

    return () => {
      if (advanceTimer.current !== null) {
        window.clearTimeout(advanceTimer.current)
        advanceTimer.current = null
      }
    }
  }, [
    session.exerciseDone,
    session.sessionDone,
    session.index,
    session.exercises,
    onExerciseComplete,
    onLessonComplete,
  ])

  const onChar = useCallback((char: string) => {
    setSession((prev) => {
      const result = handleKey(prev, char)
      if (result.kind === 'ignored') return prev

      if (result.kind === 'incorrect') {
        setErrorFlash(true)
        if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
        flashTimer.current = window.setTimeout(() => {
          setErrorFlash(false)
        }, ERROR_FLASH_MS)
        return result.session
      }

      setErrorFlash(false)
      return result.session
    })
  }, [])

  const onReplay = useCallback(() => {
    audioRef.current?.replay()
  }, [])

  const typingEnabled =
    Boolean(exercise) && !session.exerciseDone && !session.sessionDone

  const inputRef = useTypingKeys({
    enabled: typingEnabled || session.sessionDone,
    expected,
    onChar,
    onReplay,
  })

  const spaceHint =
    expected === ' '
      ? 'Pressione Espaço'
      : expected === '\n'
        ? 'Pressione Enter'
        : expected === '´' ||
            expected === '`' ||
            expected === '^' ||
            expected === '~'
          ? 'Tecla do acento e depois Espaço'
          : 'Espaço repete o áudio'

  return (
    <div className="app lesson-screen">
      <input
        ref={inputRef}
        className="hidden-typing-input"
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Digite o que ouviu"
        tabIndex={0}
      />

      <header className="header">
        <div>
          <button type="button" className="btn-back" onClick={onBack}>
            ← Voltar
          </button>
          <p className="eyebrow">{lessonTitle}</p>
          <h1>Bradley Typing</h1>
        </div>
        <SessionStats
          completed={session.completed}
          mistakes={session.mistakes}
          current={Math.min(session.index + 1, session.exercises.length)}
          total={session.exercises.length}
        />
      </header>

      <main className="main">
        {session.sessionDone ? (
          <div className="session-complete">
            <p className="complete-title">Lição concluída</p>
            <p className="complete-meta">
              {session.exercises.length} tela
              {session.exercises.length === 1 ? '' : 's'} · {session.mistakes}{' '}
              erro
              {session.mistakes === 1 ? '' : 's'} de tecla
            </p>
            <button type="button" className="btn btn-primary" onClick={onBack}>
              Voltar ao menu
            </button>
          </div>
        ) : exercise ? (
          <>
            <p className="exercise-type">
              {typeLabel} · Tela {session.index + 1} de {session.exercises.length}
            </p>
            <p className="hint">
              Ouça e digite — a letra aparece só quando você acerta
            </p>

            {exercise ? (
              <AutoAudio
                key={exercise.id}
                ref={audioRef}
                clip={currentClip}
                playId={playId}
                exerciseId={exercise.id}
              />
            ) : null}

            <TypingLane
              revealed={session.revealed}
              errorFlash={errorFlash}
              done={session.exerciseDone}
              totalLength={exercise.answer.length}
            />

            {session.exerciseDone ? (
              <p className="exercise-ok" aria-live="polite">
                Muito bem!
              </p>
            ) : (
              <p className="kbd-hint">{spaceHint}</p>
            )}
          </>
        ) : (
          <p className="empty">Nenhum exercício nesta lição.</p>
        )}
      </main>
    </div>
  )
}
