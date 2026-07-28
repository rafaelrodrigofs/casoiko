import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AutoAudio, type AutoAudioHandle } from './AutoAudio'
import { TypingLane } from './TypingLane'
import { useTypingKeys } from '../hooks/useTypingKeys'
import { currentCharAudio } from '../lib/exerciseAudio'
import {
  advanceAfterComplete,
  createSession,
  currentExercise,
  expectedChar,
  handleKey,
} from '../lib/session'
import { calcAccuracy, calcPpm } from '../lib/progress'
import type { Exercise } from '../types/exercise'
import '../App.css'

const ERROR_FLASH_MS = 220
const ADVANCE_MS = 350

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildQueue(pool: Exercise[], size = 80): Exercise[] {
  const out: Exercise[] = []
  let round = 0
  while (out.length < size) {
    const batch = shuffle(pool)
    for (const ex of batch) {
      out.push({
        ...ex,
        id: `${ex.id}#${round}-${out.length}`,
      })
      if (out.length >= size) break
    }
    round++
  }
  return out
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export interface AssessmentResult {
  ppm: number
  accuracy: number
  chars: number
  mistakes: number
  completed: number
}

interface AssessmentScreenProps {
  lessonTitle: string
  pool: Exercise[]
  durationSeconds: number
  onBack: () => void
  onFinished: (result: AssessmentResult) => void
}

export function AssessmentScreen({
  lessonTitle,
  pool,
  durationSeconds,
  onBack,
  onFinished,
}: AssessmentScreenProps) {
  const queue = useMemo(() => buildQueue(pool), [pool])
  const [session, setSession] = useState(() => createSession(queue, 0))
  const [errorFlash, setErrorFlash] = useState(false)
  const [remaining, setRemaining] = useState(durationSeconds)
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [correctChars, setCorrectChars] = useState(0)
  const [mistakes, setMistakes] = useState(0)

  const audioRef = useRef<AutoAudioHandle>(null)
  const flashTimer = useRef<number | null>(null)
  const advanceTimer = useRef<number | null>(null)
  const startMs = useRef<number | null>(null)
  const finishedRef = useRef(false)
  const correctCharsRef = useRef(0)
  const mistakesRef = useRef(0)
  const completedRef = useRef(0)

  const exercise = currentExercise(session)
  const expected = expectedChar(session)
  const currentClip = useMemo(() => {
    if (!exercise || session.exerciseDone || finished) return null
    return currentCharAudio(exercise, session.cursor)
  }, [exercise, session.cursor, session.exerciseDone, finished])

  const playId = exercise ? `${exercise.id}:${session.cursor}` : 'none'

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setFinished(true)

    const elapsed =
      startMs.current != null
        ? Date.now() - startMs.current
        : durationSeconds * 1000
    const chars = correctCharsRef.current
    const mistakes = mistakesRef.current
    const completed = completedRef.current
    const ppm = calcPpm(chars, Math.max(elapsed, 1000))
    const accuracy = calcAccuracy(chars, mistakes)
    const next: AssessmentResult = {
      ppm,
      accuracy,
      chars,
      mistakes,
      completed,
    }
    setResult(next)
    onFinished(next)
  }, [durationSeconds, onFinished])

  useEffect(() => {
    if (!started || finished) return
    const tick = window.setInterval(() => {
      if (startMs.current == null) return
      const elapsed = Date.now() - startMs.current
      const left = Math.max(0, durationSeconds - Math.floor(elapsed / 1000))
      setRemaining(left)
      if (left <= 0) finish()
    }, 200)
    return () => window.clearInterval(tick)
  }, [started, finished, durationSeconds, finish])

  useEffect(() => {
    if (!session.exerciseDone || finished) return

    completedRef.current = session.completed

    if (session.sessionDone) {
      // Fila esgotou — reconstrói não deve acontecer, mas encerra se acontecer
      finish()
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
  }, [session.exerciseDone, session.sessionDone, session.completed, finished, finish])

  const ensureStarted = useCallback(() => {
    if (started || finished) return
    startMs.current = Date.now()
    setStarted(true)
  }, [started, finished])

  const onChar = useCallback(
    (char: string) => {
      if (finishedRef.current) return
      ensureStarted()

      setSession((prev) => {
        const beforeCursor = prev.cursor
        const result = handleKey(prev, char)
        if (result.kind === 'ignored') return prev

        if (result.kind === 'incorrect') {
          mistakesRef.current = result.session.mistakes
          setMistakes(result.session.mistakes)
          setErrorFlash(true)
          if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
          flashTimer.current = window.setTimeout(() => {
            setErrorFlash(false)
          }, ERROR_FLASH_MS)
          return result.session
        }

        const gained = result.session.cursor - beforeCursor
        if (gained > 0) {
          correctCharsRef.current += gained
          setCorrectChars(correctCharsRef.current)
        }
        completedRef.current = result.session.completed
        mistakesRef.current = result.session.mistakes
        setMistakes(result.session.mistakes)
        setErrorFlash(false)
        return result.session
      })
    },
    [ensureStarted],
  )

  const onReplay = useCallback(() => {
    if (finishedRef.current) return
    audioRef.current?.replay()
  }, [])

  const typingEnabled = Boolean(exercise) && !session.exerciseDone && !finished

  const inputRef = useTypingKeys({
    enabled: typingEnabled || finished,
    expected,
    onChar,
    onReplay,
  })

  const livePpm = started
    ? calcPpm(
        correctChars,
        Math.max(1000, (durationSeconds - remaining) * 1000 || 1000),
      )
    : 0
  const liveAccuracy = calcAccuracy(correctChars, mistakes)

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
        <div className="session-stats" role="status">
          <div className="stat">
            <span className="stat-label">Tempo</span>
            <span className="stat-value">{formatTime(remaining)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">PPM</span>
            <span className="stat-value">{finished ? (result?.ppm ?? 0) : livePpm}</span>
          </div>
          <div className="stat stat-ok">
            <span className="stat-label">Precisão</span>
            <span className="stat-value">
              {finished ? (result?.accuracy ?? 100) : liveAccuracy}%
            </span>
          </div>
          <div className="stat stat-bad">
            <span className="stat-label">Erros</span>
            <span className="stat-value">
              {finished ? (result?.mistakes ?? 0) : mistakes}
            </span>
          </div>
        </div>
      </header>

      <main className="main">
        {finished && result ? (
          <div className="session-complete">
            <p className="complete-title">Avaliação concluída</p>
            <p className="complete-meta">
              {result.ppm} PPM · {result.accuracy}% precisão · {result.completed}{' '}
              telas · {result.mistakes} erro{result.mistakes === 1 ? '' : 's'}
            </p>
            <button type="button" className="btn btn-primary" onClick={onBack}>
              Voltar ao menu
            </button>
          </div>
        ) : exercise ? (
          <>
            <p className="exercise-type">
              Avaliação · {formatTime(durationSeconds)} · Ouça e digite rápido
            </p>
            <p className="hint">
              {started
                ? 'A letra aparece só quando você acerta'
                : 'Digite a primeira tecla para começar o cronômetro'}
            </p>

            <AutoAudio
              key={exercise.id}
              ref={audioRef}
              clip={currentClip}
              playId={playId}
              exerciseId={exercise.id}
            />

            <TypingLane
              revealed={session.revealed}
              errorFlash={errorFlash}
              done={session.exerciseDone}
              totalLength={exercise.answer.length}
            />

            {session.exerciseDone ? (
              <p className="exercise-ok" aria-live="polite">
                Seguindo…
              </p>
            ) : (
              <p className="kbd-hint">{spaceHint}</p>
            )}
          </>
        ) : (
          <p className="empty">Pool de avaliação vazio.</p>
        )}
      </main>
    </div>
  )
}
