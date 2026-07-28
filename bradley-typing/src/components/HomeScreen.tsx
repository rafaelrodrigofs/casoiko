import { useMemo } from 'react'
import type { Curriculum, ProgressState } from '../lib/progress'
import {
  activeLessonIdForLevel,
  isAssessmentLesson,
  isLessonComplete,
  levelLessons,
  levelProgressPercent,
} from '../lib/progress'
import './HomeScreen.css'

interface HomeScreenProps {
  curriculum: Curriculum
  progress: ProgressState
  selectedLevelId: string
  onSelectLevel: (levelId: string) => void
  onStartLesson: (lessonId: string) => void
  onResetAll: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function HomeScreen({
  curriculum,
  progress,
  selectedLevelId,
  onSelectLevel,
  onStartLesson,
  onResetAll,
}: HomeScreenProps) {
  const level =
    curriculum.levels.find((l) => l.id === selectedLevelId) ??
    curriculum.levels[0]

  const percent = useMemo(
    () => (level ? levelProgressPercent(level, progress) : 0),
    [level, progress],
  )

  const highlightedLessonId = level
    ? activeLessonIdForLevel(level, progress)
    : ''

  const lessonNumberById = useMemo(() => {
    if (!level) return new Map<string, number>()
    const map = new Map<string, number>()
    levelLessons(level).forEach((lesson, i) => {
      map.set(lesson.id, i + 1)
    })
    return map
  }, [level])

  if (!level) {
    return <p className="home-empty">Currículo vazio.</p>
  }

  return (
    <div className="home">
      <aside className="home-sidebar">
        <div className="home-brand">
          <h1>Bradley Typing</h1>
          <p>Treino auditivo</p>
        </div>

        <section className="home-nav-section">
          <h2>{curriculum.sectionTitle}</h2>
          <ul className="home-level-list">
            {curriculum.levels.map((item) => {
              const active = item.id === level.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`home-level-btn${active ? ' is-active' : ''}`}
                    onClick={() => onSelectLevel(item.id)}
                  >
                    <span className="home-level-icon" aria-hidden>
                      ▶
                    </span>
                    <span>{item.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="home-sidebar-foot">
          <button
            type="button"
            className="home-reset-btn"
            onClick={onResetAll}
          >
            Resetar tudo
          </button>
        </div>
      </aside>

      <section className="home-panel">
        <div className="home-panel-top">
          <div className="home-progress-wrap">
            <div className="home-progress-bar" aria-hidden>
              <div
                className="home-progress-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="home-progress-label">{percent}% completo</span>
          </div>
          <button type="button" className="home-cert-btn" disabled>
            Certificado da unidade
          </button>
        </div>

        {level.blocks.map((block) => (
          <div key={block.id} className="home-block">
            <h2 className="home-panel-title">{block.title}</h2>

            <ul className="home-lesson-list">
              {block.lessons.map((lesson) => {
                const assessment = isAssessmentLesson(lesson)
                const done = isLessonComplete(lesson, progress)
                const isActive = lesson.id === highlightedLessonId
                const doneCount = assessment
                  ? 0
                  : lesson.exerciseIds.filter((id) =>
                      progress.completedExerciseIds.includes(id),
                    ).length
                const num = lessonNumberById.get(lesson.id) ?? 0
                const stats = progress.assessments[lesson.id]
                const duration = lesson.durationSeconds ?? 60

                return (
                  <li
                    key={lesson.id}
                    className={`home-lesson-card${isActive ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                  >
                    <div className="home-lesson-main">
                      <span className="home-lesson-num">{num}</span>
                      <div className="home-lesson-text">
                        <p className="home-lesson-title-row">
                          <span className="home-lesson-title">{lesson.title}</span>
                          {assessment ? (
                            <span className="home-timer-badge" title="Duração">
                              ⏱ {formatDuration(duration)}
                            </span>
                          ) : null}
                        </p>
                        {assessment && stats ? (
                          <div className="home-assessment-stats">
                            <span>Tempos medidos: {stats.attempts}</span>
                            <span>Veloc. Méd: {stats.avgPpm} PPM</span>
                            <span>Maior velocidade: {stats.bestPpm} PPM</span>
                            <span>Méd. de Precisão: {stats.avgAccuracy}%</span>
                          </div>
                        ) : done ? (
                          <p className="home-lesson-meta">Concluída</p>
                        ) : doneCount > 0 ? (
                          <p className="home-lesson-meta home-lesson-meta-progress">
                            {doneCount}/{lesson.exerciseIds.length} telas
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={`home-start-btn${isActive ? ' is-primary' : ''}`}
                        onClick={() => onStartLesson(lesson.id)}
                      >
                        {assessment
                          ? stats
                            ? 'Novamente'
                            : 'Começar'
                          : done
                            ? 'Refazer'
                            : doneCount > 0
                              ? 'Continuar'
                              : 'Começar'}
                      </button>
                    </div>

                    {!assessment ? (
                      <div className="home-lesson-segments">
                        {lesson.exerciseIds.map((exId, segIndex) => {
                          const segDone =
                            progress.completedExerciseIds.includes(exId)
                          return (
                            <span
                              key={exId}
                              className={`seg${segDone ? ' is-on' : ''}`}
                              title={`${lesson.title} — Tela ${segIndex + 1}`}
                            />
                          )
                        })}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
