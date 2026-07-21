import { IconFigmaShow, NavIcon } from './icons.jsx';

const NAV = [
  { id: 'recent', label: 'Recentes' },
  { id: 'drafts', label: 'Rascunhos' },
  { id: 'trash', label: 'Lixeira' },
];

export default function HomeSidebar({ view, onViewChange }) {
  return (
    <aside className="home-sidebar">
      <div className="home-brand">
        <IconFigmaShow size={20} className="home-brand-icon" />
        <span className="home-brand-name">FigmaShow</span>
      </div>
      <nav className="home-nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`home-nav-item${view === item.id ? ' active' : ''}`}
            onClick={() => onViewChange(item.id)}
          >
            <NavIcon id={item.id} size={16} className="home-nav-icon" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="home-sidebar-foot">
        <p>Editor local + MCP</p>
      </div>
    </aside>
  );
}
