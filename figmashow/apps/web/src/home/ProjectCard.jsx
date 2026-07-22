import BoardMiniPreview from './BoardMiniPreview.jsx';
import { IconDesignFile, IconTrash } from './icons.jsx';

export default function ProjectCard({
  project,
  view,
  formatRelativeTime,
  onOpen,
  onRename,
  onTrash,
  onRestore,
  onDelete,
}) {
  return (
    <article className="project-card">
      <button
        type="button"
        className="project-card-open"
        onClick={onOpen}
        title={`Abrir ${project.name}`}
      >
        <div className="project-card-thumb">
          <BoardMiniPreview
            projectId={project.id}
            updatedAt={project.updatedAt}
          />
        </div>
      </button>
      <div className="project-card-meta">
        <div className="project-card-row">
          <span className="project-card-type" aria-hidden="true">
            <IconDesignFile size={14} />
          </span>
          <button
            type="button"
            className="project-card-name"
            onClick={onOpen}
          >
            {project.name}
          </button>
          <button
            type="button"
            className="project-card-menu"
            title="Renomear projeto"
            onClick={onRename}
          >
            Renomear
          </button>
        </div>
        <div className="project-card-row project-card-sub">
          <span>Editado {formatRelativeTime(project.updatedAt)}</span>
          {view === 'trash' ? (
            <span className="project-card-actions">
              <button type="button" onClick={onRestore}>
                Restaurar
              </button>
              <button type="button" className="danger" onClick={onDelete}>
                Apagar
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="project-card-menu"
              title="Mover para lixeira"
              onClick={(e) => {
                e.stopPropagation();
                onTrash();
              }}
            >
              <IconTrash size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
