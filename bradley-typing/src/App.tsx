import { useCallback, useEffect, useMemo, useState } from 'react'
import curriculumData from './data/curriculum.json'
import exercisesData from './data/exercises.json'
import { AssessmentScreen } from './components/AssessmentScreen'
import { HomeScreen } from './components/HomeScreen'
import { LessonScreen } from './components/LessonScreen'
import { audioBus } from './lib/audioBus'
import {
  findLesson,
  firstIncompleteExerciseIndex,
  isAssessmentLesson,
  isLessonComplete,
  loadProgress,
  markExerciseComplete,
  markLessonComplete,
  recordAssessmentResult,
  resetAllProgress,
  resetLessonProgress,
  type Curriculum,
  type ProgressState,
} from './lib/progress'
import type { Exercise } from './types/exercise'
import './App.css'

const curriculum = curriculumData as Curriculum
const allExercises = exercisesData as Exercise[]

type Route =
  | { screen: 'home' }
  | { screen: 'lesson'; lessonId: string; startIndex: number }
  | { screen: 'avaliacao'; lessonId: string }

export default function App() {
  const [route, setRoute] = useState<Route>({ screen: 'home' })
  const [selectedLevelId, setSelectedLevelId] = useState(
    () => curriculum.levels[0]?.id ?? 'iniciante',
  )
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress())

  useEffect(() => {
    void audioBus.startBgm()
  }, [])

  const startLesson = useCallback(
    (lessonId: string) => {
      void audioBus.startBgm()
      audioBus.setLessonMode(true)
      const found = findLesson(curriculum, lessonId)
      if (!found) return

      if (isAssessmentLesson(found.lesson)) {
        setRoute({ screen: 'avaliacao', lessonId })
        return
      }

      let nextProgress = progress
      let startIndex = firstIncompleteExerciseIndex(found.lesson, progress)

      if (isLessonComplete(found.lesson, progress)) {
        nextProgress = resetLessonProgress(progress, found.lesson)
        setProgress(nextProgress)
        startIndex = 0
      }

      setRoute({ screen: 'lesson', lessonId, startIndex })
    },
    [progress],
  )

  const goHome = useCallback(() => {
    void audioBus.startBgm()
    audioBus.setLessonMode(false)
    setRoute({ screen: 'home' })
  }, [])

  const handleExerciseComplete = useCallback(
    (lessonId: string, exerciseId: string) => {
      const found = findLesson(curriculum, lessonId)
      if (!found) return
      setProgress((prev) => markExerciseComplete(prev, exerciseId, found.lesson))
    },
    [],
  )

  const handleLessonComplete = useCallback((lessonId: string) => {
    const found = findLesson(curriculum, lessonId)
    if (!found) return
    setProgress((prev) => markLessonComplete(prev, found.lesson))
  }, [])

  const handleAssessmentFinished = useCallback(
    (
      lessonId: string,
      result: {
        ppm: number
        accuracy: number
        chars: number
        mistakes: number
        completed: number
      },
    ) => {
      setProgress((prev) => recordAssessmentResult(prev, lessonId, result))
    },
    [],
  )

  const handleResetAll = useCallback(() => {
    const ok = window.confirm(
      'Resetar todo o progresso?\n\nLições, telas e avaliações serão apagados.',
    )
    if (!ok) return
    setProgress(resetAllProgress())
  }, [])

  const activeLesson = useMemo(() => {
    if (route.screen === 'home') return null
    return findLesson(curriculum, route.lessonId)
  }, [route])

  const lessonExercises = useMemo(() => {
    if (!activeLesson || route.screen !== 'lesson') return []
    const map = new Map(allExercises.map((e) => [e.id, e]))
    return activeLesson.lesson.exerciseIds
      .map((id) => map.get(id))
      .filter((e): e is Exercise => Boolean(e))
  }, [activeLesson, route])

  const assessmentPool = useMemo(() => {
    if (!activeLesson || route.screen !== 'avaliacao') return []
    const map = new Map(allExercises.map((e) => [e.id, e]))
    return activeLesson.lesson.exerciseIds
      .map((id) => map.get(id))
      .filter((e): e is Exercise => Boolean(e))
  }, [activeLesson, route])

  if (route.screen === 'avaliacao' && activeLesson) {
    return (
      <AssessmentScreen
        key={route.lessonId}
        lessonTitle={activeLesson.lesson.title}
        pool={assessmentPool}
        durationSeconds={activeLesson.lesson.durationSeconds ?? 60}
        onBack={goHome}
        onFinished={(result) =>
          handleAssessmentFinished(route.lessonId, result)
        }
      />
    )
  }

  if (route.screen === 'lesson' && activeLesson) {
    return (
      <LessonScreen
        key={`${route.lessonId}-${route.startIndex}`}
        lessonTitle={activeLesson.lesson.title}
        exercises={lessonExercises}
        startIndex={route.startIndex}
        onBack={goHome}
        onExerciseComplete={(exerciseId) =>
          handleExerciseComplete(route.lessonId, exerciseId)
        }
        onLessonComplete={() => handleLessonComplete(route.lessonId)}
      />
    )
  }

  return (
    <HomeScreen
      curriculum={curriculum}
      progress={progress}
      selectedLevelId={selectedLevelId}
      onSelectLevel={setSelectedLevelId}
      onStartLesson={startLesson}
      onResetAll={handleResetAll}
    />
  )
}
