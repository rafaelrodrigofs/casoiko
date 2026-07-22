import ProjectCard from './ProjectCard.jsx';
import { IconPlus } from './icons.jsx';

export default function ProjectGrid({
  projects,
  loading,
  view,
  formatRelativeTime,
  onOpen,
  onRename,
  onTrash,
  onRestore,
  onDelete,
  onCreate,
  creating,
}) {
  if (loading) {
    return <div className="home-empty">Carregando projetos…</div>;
  }

  const showCreate = view !== 'trash';

  return (
    <div className="home-grid-wrap">
      <div className="home-grid">
        {showCreate && (
          <button
            type="button"
            className="project-card project-card--new"
            onClick={onCreate}
            disabled={creating}
          >
            <IconPlus size={28} className="project-card-new-icon" />
            <span className="project-card-new-label">
              {creating ? 'Criando…' : 'Novo design file'}
            </span>
          </button>
        )}
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            view={view}
            formatRelativeTime={formatRelativeTime}
            onOpen={() => onOpen(project.id)}
            onRename={() => onRename(project.id, project.name)}
            onTrash={() => onTrash(project.id)}
            onRestore={() => onRestore(project.id)}
            onDelete={() => onDelete(project.id)}
          />
        ))}
      </div>
      {!loading && projects.length === 0 && view === 'trash' && (
        <div className="home-empty">A lixeira está vazia.</div>
      )}
      {!loading && projects.length === 0 && view !== 'trash' && (
        <div className="home-empty">
          Nenhum projeto ainda. Clique em &quot;Design file&quot; para começar.
        </div>
      )}
    </div>
  );
}
