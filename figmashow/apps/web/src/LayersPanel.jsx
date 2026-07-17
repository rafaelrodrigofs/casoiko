import { useEffect, useState } from 'react';

function IconChevron({ open }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <path
        d={open ? 'M1.5 3L4 5.5L6.5 3' : 'M3 1.5L5.5 4L3 6.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Hash estilo Figma (frame). */
function IconFrame() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M4 1V11M8 1V11M1 4H11M1 8H11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Grupo — retângulo tracejado (Figma section/group). */
function IconGroup() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect
        x="1.75"
        y="1.75"
        width="8.5"
        height="8.5"
        rx="1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeDasharray="2.4 1.6"
      />
    </svg>
  );
}

function IconText() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.5 2.5H9.5M6 2.5V9.5M4 9.5H8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRect() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect
        x="1.75"
        y="2.5"
        width="8.5"
        height="7"
        rx="1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect
        x="1.5"
        y="2"
        width="9"
        height="8"
        rx="1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="4.2" cy="4.6" r="1.15" fill="currentColor" />
      <path
        d="M1.8 8.5L4.5 6.2L6.2 7.6L8.2 5.5L10.5 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconButton() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect
        x="1.5"
        y="3.25"
        width="9"
        height="5.5"
        rx="2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function IconCollapseLayers() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M2 3.5H8.5M2 7H8.5M2 10.5H8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10.2 8.8L12 7L10.2 5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(-90 11.1 7)"
      />
    </svg>
  );
}

function IconComponentMain() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M6 1.2L10.8 6 6 10.8 1.2 6 6 1.2Z"
        fill="none"
        stroke="#9747ff"
        strokeWidth="1.4"
      />
      <path
        d="M6 3.4L8.6 6 6 8.6 3.4 6 6 3.4Z"
        fill="#9747ff"
        stroke="none"
      />
    </svg>
  );
}

function IconInstance() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M6 1.2L10.8 6 6 10.8 1.2 6 6 1.2Z"
        fill="none"
        stroke="#9747ff"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function LayerTypeIcon({ type }) {
  if (type === 'frame') return <IconFrame />;
  if (type === 'group') return <IconGroup />;
  if (type === 'component') return <IconComponentMain />;
  if (type === 'instance') return <IconInstance />;
  if (type === 'text') return <IconText />;
  if (type === 'image') return <IconImage />;
  if (type === 'button') return <IconButton />;
  return <IconRect />;
}

function layerLabel(node) {
  if (node.name) return node.name;
  if (node.type === 'text' && node.icon) return node.text;
  if (node.type === 'text' && node.text) {
    const t = String(node.text).replace(/\s+/g, ' ').trim();
    return t.length > 28 ? `${t.slice(0, 28)}…` : t;
  }
  if (node.type === 'button' && node.label) return node.label;
  return node.id;
}

/** IDs dos grupos ancestrais até o nó (não inclui o próprio nó). */
function ancestorGroupIds(nodes, targetId, trail = []) {
  for (const node of nodes) {
    if (node.id === targetId) return trail;
    if (node.type === 'group' || node.type === 'component') {
      const found = ancestorGroupIds(node.children || [], targetId, [
        ...trail,
        node.id,
      ]);
      if (found) return found;
    }
  }
  return null;
}

function NodeBranch({
  node,
  screenId,
  depth,
  selectedScreenId,
  selectedNodeIds,
  hoveredNodeId,
  expanded,
  onToggle,
  onSelectNode,
  onHoverNode,
  onRenameNode,
  onReorderNode,
  onToggleNodeFlag,
}) {
  const isGroup = node.type === 'group' || node.type === 'component';
  const open = isGroup && expanded.has(node.id);
  const active =
    selectedScreenId === screenId && selectedNodeIds.includes(node.id);
  const hovered = hoveredNodeId === node.id && !active;
  const pad = 10 + depth * 14;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.name || '');

  return (
    <div className="layer-branch">
      <div
        data-layer-id={node.id}
        className={`layer-row node-row${active ? ' active' : ''}${hovered ? ' hovered' : ''}${isGroup ? ' group-row' : ''}${node.hidden ? ' is-hidden' : ''}${node.locked ? ' is-locked' : ''}`}
        style={{ paddingLeft: pad }}
        onClick={(e) => {
          if (editing) return;
          onSelectNode(screenId, node.id, { additive: e.shiftKey });
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setDraft(node.name || layerLabel(node));
          setEditing(true);
        }}
        onMouseEnter={() => onHoverNode?.(screenId, node.id)}
        onMouseLeave={() => onHoverNode?.(screenId, null)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !editing) {
            onSelectNode(screenId, node.id);
          }
        }}
      >
        {isGroup ? (
          <span
            className="layer-chevron"
            onClick={(e) => onToggle(node.id, e)}
            role="presentation"
          >
            <IconChevron open={open} />
          </span>
        ) : (
          <span className="layer-chevron spacer" />
        )}
        <span className={`layer-icon type-${node.type}`}>
          <LayerTypeIcon type={node.type} />
        </span>
        {editing ? (
          <input
            className="layer-rename"
            value={draft}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              onRenameNode?.(screenId, node.id, draft);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
              if (e.key === 'Escape') {
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="layer-label">{layerLabel(node)}</span>
        )}
        {active && selectedNodeIds.length === 1 && (
          <span className="layer-order-btns">
            <button
              type="button"
              title={node.hidden ? 'Mostrar' : 'Ocultar'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleNodeFlag?.(screenId, node.id, 'hidden');
              }}
            >
              {node.hidden ? 'show' : 'hide'}
            </button>
            <button
              type="button"
              title={node.locked ? 'Desbloquear' : 'Bloquear'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleNodeFlag?.(screenId, node.id, 'locked');
              }}
            >
              {node.locked ? 'unlock' : 'lock'}
            </button>
            <button
              type="button"
              title="Trazer para frente"
              onClick={(e) => {
                e.stopPropagation();
                // lista invertida na UI → delta +1 no array = sobe na lista visual
                onReorderNode?.(screenId, node.id, 1);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              title="Enviar para trás"
              onClick={(e) => {
                e.stopPropagation();
                onReorderNode?.(screenId, node.id, -1);
              }}
            >
              ↓
            </button>
          </span>
        )}
      </div>
      {isGroup &&
        open &&
        [...node.children].reverse().map((child) => (
          <NodeBranch
            key={child.id}
            node={child}
            screenId={screenId}
            depth={depth + 1}
            selectedScreenId={selectedScreenId}
            selectedNodeIds={selectedNodeIds}
            hoveredNodeId={hoveredNodeId}
            expanded={expanded}
            onToggle={onToggle}
            onSelectNode={onSelectNode}
            onHoverNode={onHoverNode}
            onRenameNode={onRenameNode}
            onReorderNode={onReorderNode}
            onToggleNodeFlag={onToggleNodeFlag}
          />
        ))}
    </div>
  );
}

function IconAddScreen() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 2.5V11.5M2.5 7H11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Painel Camadas estilo Figma: Screen → grupos → nós.
 */
export default function LayersPanel({
  screens,
  selectedScreenId,
  selectedNodeIds = [],
  hoveredNodeId,
  onSelectScreen,
  onSelectNode,
  onHoverNode,
  onRenameNode,
  onReorderNode,
  onAddScreen,
  onRenameScreen,
  onDeleteScreen,
  onToggleNodeFlag,
  components = [],
  onInsertInstance,
}) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [renamingScreenId, setRenamingScreenId] = useState(null);
  const [screenDraft, setScreenDraft] = useState('');
  const primarySelectedId =
    selectedNodeIds[selectedNodeIds.length - 1] ?? null;

  useEffect(() => {
    const screen =
      screens.find((s) => s.id === selectedScreenId) || screens[0];
    if (!screen) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(screen.id);
      if (selectedNodeIds.length) {
        for (const selectedNodeId of selectedNodeIds) {
          const anc = ancestorGroupIds(screen.nodes, selectedNodeId);
          if (anc) {
            for (const id of anc) next.add(id);
            const pathNode = findNode(screen.nodes, selectedNodeId);
            if (pathNode?.type === 'group' || pathNode?.type === 'component') {
              next.add(selectedNodeId);
            }
          }
        }
      } else {
        next.add(screen.id);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evita reset no poll
  }, [selectedScreenId, selectedNodeIds]);

  useEffect(() => {
    const targetId = primarySelectedId || selectedScreenId;
    if (!targetId) return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const el = document.querySelector(
          `[data-layer-id="${CSS.escape(targetId)}"]`,
        );
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [selectedScreenId, primarySelectedId, expanded]);

  const toggle = (id, e) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  const startRenameScreen = (screen) => {
    setRenamingScreenId(screen.id);
    setScreenDraft(screen.name || '');
  };

  const finishRenameScreen = () => {
    if (!renamingScreenId) return;
    onRenameScreen?.(renamingScreenId, screenDraft);
    setRenamingScreenId(null);
  };

  const ordered = [...screens].reverse();

  return (
    <div
      className="layers-panel"
      onMouseLeave={() => onHoverNode?.(null, null)}
    >
      <div className="layers-header">
        <span>Camadas</span>
        <div className="layers-header-actions">
          <button
            type="button"
            className="layers-collapse-btn"
            title="Nova tela"
            aria-label="Nova tela"
            onClick={() => onAddScreen?.()}
          >
            <IconAddScreen />
          </button>
          <button
            type="button"
            className="layers-collapse-btn"
            title="Recolher camadas"
            aria-label="Recolher camadas"
            onClick={collapseAll}
          >
            <IconCollapseLayers />
          </button>
        </div>
      </div>
      <div className="layers-tree">
        {ordered.map((screen) => {
          const open = expanded.has(screen.id);
          const screenActive =
            selectedScreenId === screen.id && selectedNodeIds.length === 0;
          const renaming = renamingScreenId === screen.id;
          return (
            <div key={screen.id} className="layer-branch">
              <div
                data-layer-id={screen.id}
                className={`layer-row screen-row${screenActive ? ' active' : ''}${selectedScreenId === screen.id ? ' screen-selected' : ''}`}
                onClick={() => {
                  if (!renaming) onSelectScreen(screen.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRenameScreen(screen);
                }}
                onMouseEnter={() => onHoverNode?.(screen.id, null)}
                role="button"
                tabIndex={0}
              >
                <span
                  className="layer-chevron"
                  onClick={(e) => toggle(screen.id, e)}
                  role="presentation"
                >
                  <IconChevron open={open} />
                </span>
                <span className="layer-icon frame-icon">
                  <LayerTypeIcon type="frame" />
                </span>
                {renaming ? (
                  <input
                    className="layer-rename"
                    value={screenDraft}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setScreenDraft(e.target.value)}
                    onBlur={finishRenameScreen}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setRenamingScreenId(null);
                    }}
                  />
                ) : (
                  <span className="layer-label">{screen.name}</span>
                )}
                {screenActive && (
                  <span className="layer-order-btns">
                    <button
                      type="button"
                      title="Apagar tela"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteScreen?.(screen.id);
                      }}
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              {open &&
                [...screen.nodes].reverse().map((node) => (
                  <NodeBranch
                    key={node.id}
                    node={node}
                    screenId={screen.id}
                    depth={1}
                    selectedScreenId={selectedScreenId}
                    selectedNodeIds={selectedNodeIds}
                    hoveredNodeId={hoveredNodeId}
                    expanded={expanded}
                    onToggle={toggle}
                    onSelectNode={onSelectNode}
                    onHoverNode={onHoverNode}
                    onRenameNode={onRenameNode}
                    onReorderNode={onReorderNode}
                    onToggleNodeFlag={onToggleNodeFlag}
                  />
                ))}
            </div>
          );
        })}
        {!screens.length && (
          <div className="layers-empty-wrap">
            <p className="hint layers-empty">Nenhuma tela ainda.</p>
            <button
              type="button"
              className="layers-add-screen-btn"
              onClick={() => onAddScreen?.()}
            >
              Criar tela
            </button>
          </div>
        )}
      </div>
      {components?.length > 0 && (
        <div className="layers-components">
          <div className="layers-header">Componentes</div>
          {components.map((comp) => (
            <div key={comp.id} className="layer-row component-row">
              <span className="layer-icon type-component">
                <IconComponentMain />
              </span>
              <span className="layer-label">{comp.name}</span>
              <button
                type="button"
                className="layers-insert-btn"
                title="Inserir instância"
                onClick={() => onInsertInstance?.(comp.id)}
              >
                Inserir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === 'group' || n.type === 'component') {
      const found = findNode(n.children || [], id);
      if (found) return found;
    }
  }
  return null;
}
