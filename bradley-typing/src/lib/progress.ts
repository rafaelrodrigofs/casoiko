export interface CurriculumLesson {
  id: string
  title: string
  exerciseIds: string[]
  /** Lição normal ou avaliação cronometrada */
  mode?: 'lesson' | 'avaliacao'
  /** Duração em segundos (avaliações) */
  durationSeconds?: number
}

export interface CurriculumBlock {
  id: string
  title: string
  lessons: CurriculumLesson[]
}

export interface CurriculumLevel {
  id: string
  title: string
  blocks: CurriculumBlock[]
}

export interface Curriculum {
  sectionTitle: string
  levels: CurriculumLevel[]
}

export interface AssessmentRecord {
  attempts: number
  avgPpm: number
  bestPpm: number
  avgAccuracy: number
  lastPpm: number
  lastAccuracy: number
  lastChars: number
  lastMistakes: number
  lastCompleted: number
}

export interface ProgressState {
  completedLessonIds: string[]
  completedExerciseIds: string[]
  assessments: Record<string, AssessmentRecord>
}

const STORAGE_KEY = 'bradley-typing-progress'

export function isAssessmentLesson(lesson: CurriculumLesson): boolean {
  return lesson.mode === 'avaliacao'
}

export function levelLessons(level: CurriculumLevel): CurriculumLesson[] {
  return level.blocks.flatMap((block) => block.lessons)
}

function normalize(raw: unknown): ProgressState {
  if (!raw || typeof raw !== 'object') {
    return { completedLessonIds: [], completedExerciseIds: [], assessments: {} }
  }
  const obj = raw as Partial<ProgressState>
  const assessments: Record<string, AssessmentRecord> = {}
  if (obj.assessments && typeof obj.assessments === 'object') {
    for (const [id, value] of Object.entries(obj.assessments)) {
      if (!value || typeof value !== 'object') continue
      const v = value as Partial<AssessmentRecord>
      assessments[id] = {
        attempts: Number(v.attempts) || 0,
        avgPpm: Number(v.avgPpm) || 0,
        bestPpm: Number(v.bestPpm) || 0,
        avgAccuracy: Number(v.avgAccuracy) || 0,
        lastPpm: Number(v.lastPpm) || 0,
        lastAccuracy: Number(v.lastAccuracy) || 0,
        lastChars: Number(v.lastChars) || 0,
        lastMistakes: Number(v.lastMistakes) || 0,
        lastCompleted: Number(v.lastCompleted) || 0,
      }
    }
  }
  return {
    completedLessonIds: Array.isArray(obj.completedLessonIds)
      ? obj.completedLessonIds.filter((x) => typeof x === 'string')
      : [],
    completedExerciseIds: Array.isArray(obj.completedExerciseIds)
      ? obj.completedExerciseIds.filter((x) => typeof x === 'string')
      : [],
    assessments,
  }
}

export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { completedLessonIds: [], completedExerciseIds: [], assessments: {} }
    return normalize(JSON.parse(raw))
  } catch {
    return { completedLessonIds: [], completedExerciseIds: [], assessments: {} }
  }
}

export function saveProgress(progress: ProgressState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function emptyProgress(): ProgressState {
  return {
    completedLessonIds: [],
    completedExerciseIds: [],
    assessments: {},
  }
}

/** Zera lições, telas e avaliações. */
export function resetAllProgress(): ProgressState {
  const next = emptyProgress()
  saveProgress(next)
  return next
}

export function markExerciseComplete(
  progress: ProgressState,
  exerciseId: string,
  lesson: CurriculumLesson,
): ProgressState {
  if (isAssessmentLesson(lesson)) return progress

  const completedExerciseIds = progress.completedExerciseIds.includes(exerciseId)
    ? progress.completedExerciseIds
    : [...progress.completedExerciseIds, exerciseId]

  const lessonDone = lesson.exerciseIds.every((id) =>
    completedExerciseIds.includes(id),
  )

  const completedLessonIds =
    lessonDone && !progress.completedLessonIds.includes(lesson.id)
      ? [...progress.completedLessonIds, lesson.id]
      : progress.completedLessonIds

  const next = {
    completedLessonIds,
    completedExerciseIds,
    assessments: progress.assessments,
  }
  saveProgress(next)
  return next
}

export function markLessonComplete(
  progress: ProgressState,
  lesson: CurriculumLesson,
): ProgressState {
  if (isAssessmentLesson(lesson)) {
    if (progress.completedLessonIds.includes(lesson.id)) return progress
    const next = {
      ...progress,
      completedLessonIds: [...progress.completedLessonIds, lesson.id],
    }
    saveProgress(next)
    return next
  }

  let next = progress
  for (const id of lesson.exerciseIds) {
    next = markExerciseComplete(next, id, lesson)
  }
  if (!next.completedLessonIds.includes(lesson.id)) {
    next = {
      ...next,
      completedLessonIds: [...next.completedLessonIds, lesson.id],
    }
    saveProgress(next)
  }
  return next
}

/** Limpa progresso das telas da lição (para Refazer do zero). */
export function resetLessonProgress(
  progress: ProgressState,
  lesson: CurriculumLesson,
): ProgressState {
  if (isAssessmentLesson(lesson)) {
    const next = {
      ...progress,
      completedLessonIds: progress.completedLessonIds.filter((id) => id !== lesson.id),
    }
    saveProgress(next)
    return next
  }

  const ids = new Set(lesson.exerciseIds)
  const next = {
    completedLessonIds: progress.completedLessonIds.filter((id) => id !== lesson.id),
    completedExerciseIds: progress.completedExerciseIds.filter((id) => !ids.has(id)),
    assessments: progress.assessments,
  }
  saveProgress(next)
  return next
}

export function recordAssessmentResult(
  progress: ProgressState,
  lessonId: string,
  result: {
    ppm: number
    accuracy: number
    chars: number
    mistakes: number
    completed: number
  },
): ProgressState {
  const prev = progress.assessments[lessonId]
  const attempts = (prev?.attempts ?? 0) + 1
  const avgPpm = prev
    ? Math.round((prev.avgPpm * prev.attempts + result.ppm) / attempts)
    : result.ppm
  const avgAccuracy = prev
    ? Math.round(
        (prev.avgAccuracy * prev.attempts + result.accuracy) / attempts,
      )
    : result.accuracy
  const bestPpm = Math.max(prev?.bestPpm ?? 0, result.ppm)

  const record: AssessmentRecord = {
    attempts,
    avgPpm,
    bestPpm,
    avgAccuracy,
    lastPpm: result.ppm,
    lastAccuracy: result.accuracy,
    lastChars: result.chars,
    lastMistakes: result.mistakes,
    lastCompleted: result.completed,
  }

  const completedLessonIds = progress.completedLessonIds.includes(lessonId)
    ? progress.completedLessonIds
    : [...progress.completedLessonIds, lessonId]

  const next: ProgressState = {
    ...progress,
    completedLessonIds,
    assessments: {
      ...progress.assessments,
      [lessonId]: record,
    },
  }
  saveProgress(next)
  return next
}

export function firstIncompleteExerciseIndex(
  lesson: CurriculumLesson,
  progress: ProgressState,
): number {
  if (isAssessmentLesson(lesson)) return 0
  const idx = lesson.exerciseIds.findIndex(
    (id) => !progress.completedExerciseIds.includes(id),
  )
  return idx < 0 ? 0 : idx
}

export function isLessonComplete(
  lesson: CurriculumLesson,
  progress: ProgressState,
): boolean {
  if (isAssessmentLesson(lesson)) {
    return progress.completedLessonIds.includes(lesson.id)
  }
  return (
    progress.completedLessonIds.includes(lesson.id) ||
    lesson.exerciseIds.every((id) => progress.completedExerciseIds.includes(id))
  )
}

function lessonUnitCount(lesson: CurriculumLesson): number {
  return isAssessmentLesson(lesson) ? 1 : lesson.exerciseIds.length
}

function lessonDoneCount(
  lesson: CurriculumLesson,
  progress: ProgressState,
): number {
  if (isAssessmentLesson(lesson)) {
    return isLessonComplete(lesson, progress) ? 1 : 0
  }
  return lesson.exerciseIds.filter((id) =>
    progress.completedExerciseIds.includes(id),
  ).length
}

export function levelProgressPercent(
  level: CurriculumLevel,
  progress: ProgressState,
): number {
  const lessons = levelLessons(level)
  const total = lessons.reduce((n, l) => n + lessonUnitCount(l), 0)
  if (total === 0) return 0
  const done = lessons.reduce((n, l) => n + lessonDoneCount(l, progress), 0)
  return Math.round((done / total) * 100)
}

export function findLesson(
  curriculum: Curriculum,
  lessonId: string,
): { level: CurriculumLevel; lesson: CurriculumLesson; index: number } | null {
  for (const level of curriculum.levels) {
    const lessons = levelLessons(level)
    const index = lessons.findIndex((l) => l.id === lessonId)
    if (index >= 0) {
      return { level, lesson: lessons[index], index }
    }
  }
  return null
}

/** Primeira lição incompleta do nível, ou a primeira se todas completas. */
export function activeLessonIdForLevel(
  level: CurriculumLevel,
  progress: ProgressState,
): string {
  const lessons = levelLessons(level)
  const incomplete = lessons.find((l) => !isLessonComplete(l, progress))
  return incomplete?.id ?? lessons[0]?.id ?? ''
}

/** PPM clássico: (caracteres corretos / 5) por minuto. */
export function calcPpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  const minutes = elapsedMs / 60000
  return Math.round(correctChars / 5 / minutes)
}

export function calcAccuracy(correctChars: number, mistakes: number): number {
  const total = correctChars + mistakes
  if (total <= 0) return 100
  return Math.round((correctChars / total) * 100)
}
