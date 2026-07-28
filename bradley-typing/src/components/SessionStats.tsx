interface SessionStatsProps {
  completed: number
  mistakes: number
  current: number
  total: number
}

export function SessionStats({
  completed,
  mistakes,
  current,
  total,
}: SessionStatsProps) {
  return (
    <div className="session-stats" role="status">
      <div className="stat">
        <span className="stat-label">Exercício</span>
        <span className="stat-value">
          {current}/{total}
        </span>
      </div>
      <div className="stat stat-ok">
        <span className="stat-label">Feitos</span>
        <span className="stat-value">{completed}</span>
      </div>
      <div className="stat stat-bad">
        <span className="stat-label">Erros</span>
        <span className="stat-value">{mistakes}</span>
      </div>
    </div>
  )
}
