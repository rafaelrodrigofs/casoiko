/**
 * Barra inferior estilo Figma — move, mão, retângulo (R) e texto (T).
 */

function IconMove() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 2.5L6.2 13.2L8.1 8.1L13.2 6.2L2.5 2.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFrame() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5 2V14M11 2V14M2 5H14M2 11H14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconShape() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="2.75"
        y="2.75"
        width="10.5"
        height="10.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconPen() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5C8 2.5 5.5 6.2 5.5 9.2C5.5 10.6 6.6 11.7 8 11.7C9.4 11.7 10.5 10.6 10.5 9.2C10.5 6.2 8 2.5 8 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M8 11.7V14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconText() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 3.5H12.5M8 3.5V12.5M5.5 12.5H10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHand() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.2 7.2V4.4C5.2 3.8 5.7 3.3 6.3 3.3C6.9 3.3 7.4 3.8 7.4 4.4V6.8M7.4 6.2V3.6C7.4 3 7.9 2.5 8.5 2.5C9.1 2.5 9.6 3 9.6 3.6V6.5M9.6 5.8V4.1C9.6 3.5 10.1 3 10.7 3C11.3 3 11.8 3.5 11.8 4.1V8.2C11.8 10.6 10.2 13.2 7.6 13.2C5.6 13.2 4 11.6 4 9.6V7.2C4 6.6 4.5 6.1 5.1 6.1C5.15 6.1 5.18 6.1 5.2 6.12"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconResources() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="4.5" cy="11.5" r="2.3" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M9.2 11.5H14.2M11.7 9V14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDraw() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 11C4.5 8.5 5.5 12.5 7.5 10C9.5 7.5 10.2 11.8 13.5 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconComment() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3.5H13C13.3 3.5 13.5 3.7 13.5 4V10.5C13.5 10.8 13.3 11 13 11H7.5L4.5 13.5V11H3C2.7 11 2.5 10.8 2.5 10.5V4C2.5 3.7 2.7 3.5 3 3.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconComponents() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.2L10.2 4.4L8 6.6L5.8 4.4L8 2.2Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M11.6 5.8L13.8 8L11.6 10.2L9.4 8L11.6 5.8Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M8 9.4L10.2 11.6L8 13.8L5.8 11.6L8 9.4Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M4.4 5.8L6.6 8L4.4 10.2L2.2 8L4.4 5.8Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDev() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.5 4.5L2.5 8L5.5 11.5M10.5 4.5L13.5 8L10.5 11.5M9 3.5L7 12.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <path
        d="M2 3L4 5L6 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const LEFT_TOOLS = [
  { id: 'move', label: 'Mover', shortcut: 'V', Icon: IconMove },
  { id: 'frame', label: 'Frame', shortcut: 'F', Icon: IconFrame, chevron: true },
  { id: 'shape', label: 'Retângulo', shortcut: 'R', Icon: IconShape, chevron: true },
  { id: 'pen', label: 'Caneta', shortcut: 'P', Icon: IconPen, chevron: true },
  { id: 'text', label: 'Texto', shortcut: 'T', Icon: IconText },
  { id: 'hand', label: 'Mão', shortcut: 'H', Icon: IconHand },
  { id: 'resources', label: 'Recursos', shortcut: 'Shift+I', Icon: IconResources },
];

const RIGHT_TOOLS = [
  { id: 'draw', label: 'Desenhar', Icon: IconDraw },
  { id: 'comment', label: 'Comentar', Icon: IconComment },
  { id: 'components', label: 'Componentes', Icon: IconComponents },
  { id: 'dev', label: 'Dev Mode', Icon: IconDev },
];

function ToolButton({ tool, active, onClick }) {
  const { Icon, label, shortcut, chevron } = tool;
  const title = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      type="button"
      className={`figma-tool-btn${active ? ' is-active' : ''}${chevron ? ' has-chevron' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="figma-tool-icon">
        <Icon />
      </span>
      {chevron ? (
        <span className="figma-tool-chevron" aria-hidden="true">
          <IconChevron />
        </span>
      ) : null}
    </button>
  );
}

export default function ToolsBar({ activeTool = 'move', onToolChange }) {
  return (
    <div className="figma-tools-bar" role="toolbar" aria-label="Ferramentas">
      <div className="figma-tools-group">
        {LEFT_TOOLS.map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            active={activeTool === tool.id}
            onClick={() => onToolChange?.(tool.id)}
          />
        ))}
      </div>

      <div className="figma-tools-divider" aria-hidden="true" />

      <div className="figma-tools-group figma-tools-group--inset">
        {RIGHT_TOOLS.map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            active={activeTool === tool.id}
            onClick={() => onToolChange?.(tool.id)}
          />
        ))}
      </div>
    </div>
  );
}
