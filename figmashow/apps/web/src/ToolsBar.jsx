/**
 * Barra inferior — só ferramentas implementadas.
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

function IconButton() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="2"
        y="4.5"
        width="12"
        height="7"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="2"
        y="2.5"
        width="12"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="5.5" cy="6" r="1.4" fill="currentColor" />
      <path
        d="M2.5 11.5L5.5 8.5L7.5 10.2L10 7.5L13.5 11.5"
        stroke="currentColor"
        strokeWidth="1.4"
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

function IconPrototype() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8H13M8 3V13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

function IconComment() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 3.5H13V10.5H6.5L3.5 13V10.5H3V3.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFrame() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 5.5H13M3 10.5H13M5.5 3V13M10.5 3V13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const TOOLS = [
  { id: 'move', label: 'Mover', shortcut: 'V', Icon: IconMove },
  { id: 'frame', label: 'Quadro', shortcut: 'F', Icon: IconFrame },
  { id: 'shape', label: 'Retângulo', shortcut: 'R', Icon: IconShape },
  { id: 'text', label: 'Texto', shortcut: 'T', Icon: IconText },
  { id: 'button', label: 'Botão', shortcut: 'B', Icon: IconButton },
  { id: 'image', label: 'Imagem', shortcut: 'I', Icon: IconImage },
  { id: 'prototype', label: 'Protótipo', shortcut: 'P', Icon: IconPrototype },
  { id: 'comment', label: 'Comentário', shortcut: 'C', Icon: IconComment },
  { id: 'hand', label: 'Mão', shortcut: 'H', Icon: IconHand },
];

function ToolButton({ tool, active, onClick }) {
  const { Icon, label, shortcut } = tool;
  const title = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      type="button"
      className={`figma-tool-btn${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="figma-tool-icon">
        <Icon />
      </span>
    </button>
  );
}

export default function ToolsBar({ activeTool = 'move', onToolChange }) {
  return (
    <div className="figma-tools-bar" role="toolbar" aria-label="Ferramentas">
      <div className="figma-tools-group">
        {TOOLS.map((tool) => (
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
