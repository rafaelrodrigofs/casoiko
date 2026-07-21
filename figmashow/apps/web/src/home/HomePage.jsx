import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeSidebar from './HomeSidebar.jsx';
import ProjectGrid from './ProjectGrid.jsx';
import { IconDesignFile } from './icons.jsx';

function formatRelativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} dia${days > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function HomePage() {
  const navigate = useNavigate();
  const [view, setView] = useState('recent');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const trashed = view === 'trash' ? '1' : '0';
      const res = await fetch(`/api/projects?trashed=${trashed}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let list = Array.isArray(data.projects) ? data.projects : [];
      if (view === 'drafts') {
        list = list.filter(
          (p) =>
            !p.name ||
            p.name === 'Untitled' ||
            /^rascunho/i.test(p.name),
        );
      }
      setProjects(list);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const id = data?.project?.id;
      if (!id) throw new Error('Projeto sem id');
      navigate(`/file/${id}`);
    } catch (err) {
      setError(String(err.message || err));
      setCreating(false);
    }
  };

  const openProject = (id) => {
    navigate(`/file/${id}`);
  };

  const trashProject = async (id) => {
    await fetch(`/api/projects/${encodeURIComponent(id)}/trash`, {
      method: 'POST',
    });
    loadProjects();
  };

  const restoreProject = async (id) => {
    await fetch(`/api/projects/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
    });
    loadProjects();
  };

  const deleteProject = async (id) => {
    if (!window.confirm('Apagar permanentemente este projeto?')) return;
    await fetch(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    loadProjects();
  };

  const title =
    view === 'trash'
      ? 'Lixeira'
      : view === 'drafts'
        ? 'Rascunhos'
        : 'Recentes';

  return (
    <div className="home-shell">
      <HomeSidebar view={view} onViewChange={setView} />
      <main className="home-main">
        <header className="home-header">
          <div>
            <h1 className="home-title">{title}</h1>
            <p className="home-subtitle">
              Crie um design file ou abra um projeto recente.
            </p>
          </div>
          <div className="home-header-actions">
            <button
              type="button"
              className="home-new-btn"
              onClick={createProject}
              disabled={creating}
            >
              <IconDesignFile size={16} className="home-new-icon" />
              Design file
            </button>
          </div>
        </header>

        {error && <div className="home-error">{error}</div>}

        <ProjectGrid
          projects={projects}
          loading={loading}
          view={view}
          formatRelativeTime={formatRelativeTime}
          onOpen={openProject}
          onTrash={trashProject}
          onRestore={restoreProject}
          onDelete={deleteProject}
          onCreate={createProject}
          creating={creating}
        />
      </main>
    </div>
  );
}
