import { useEffect, useState } from 'react';

function typeIcon(type) {
  if (type === 'group') return '▦';
  if (type === 'text') return 'T';
  if (type === 'button') return '▮';
  if (type === 'image') return '▣';
  return '▢';
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
    if (node.type === 'group') {
      const found = ancestorGroupIds(node.children, targetId, [
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
  selectedNodeId,
  hoveredNodeId,
  expanded,
  onToggle,
  onSelectNode,
  onHoverNode,
}) {
  const isGroup = node.type === 'group';
  const open = isGroup && expanded.has(node.id);
  const active =
    selectedScreenId === screenId && selectedNodeId === node.id;
  const hovered = hoveredNodeId === node.id && !active;
  const pad = 10 + depth * 14;

  return (
    <div className="layer-branch">
      <button
        type="button"
        data-layer-id={node.id}
        className={`layer-row node-row${active ? ' active' : ''}${hovered ? ' hovered' : ''}${isGroup ? ' group-row' : ''}`}
        style={{ paddingLeft: pad }}
        onClick={() => onSelectNode(screenId, node.id)}
        onMouseEnter={() => onHoverNode?.(screenId, node.id)}
        onMouseLeave={() => onHoverNode?.(screenId, null)}
      >
        {isGroup ? (
          <span
            className="layer-chevron"
            onClick={(e) => onToggle(node.id, e)}
            role="presentation"
          >
            {open ? '▾' : '▸'}
          </span>
        ) : (
          <span className="layer-chevron spacer" />
        )}
        <span className={`layer-icon type-${node.type}`}>{typeIcon(node.type)}</span>
        <span className="layer-label">{layerLabel(node)}</span>
      </button>
      {isGroup &&
        open &&
        [...node.children].reverse().map((child) => (
          <NodeBranch
            key={child.id}
            node={child}
            screenId={screenId}
            depth={depth + 1}
            selectedScreenId={selectedScreenId}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            expanded={expanded}
            onToggle={onToggle}
            onSelectNode={onSelectNode}
            onHoverNode={onHoverNode}
          />
        ))}
    </div>
  );
}

/**
 * Painel Camadas estilo Figma: Screen → grupos → nós.
 */
export default function LayersPanel({
  screens,
  selectedScreenId,
  selectedNodeId,
  hoveredNodeId,
  onSelectScreen,
  onSelectNode,
  onHoverNode,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  // Expandir tela + caminho até o nó selecionado (não no poll).
  useEffect(() => {
    const screen =
      screens.find((s) => s.id === selectedScreenId) || screens[0];
    if (!screen) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(screen.id);
      if (selectedNodeId) {
        const anc = ancestorGroupIds(screen.nodes, selectedNodeId);
        if (anc) {
          for (const id of anc) next.add(id);
          const pathNode = findNode(screen.nodes, selectedNodeId);
          if (pathNode?.type === 'group') next.add(selectedNodeId);
        }
      } else {
        const walk = (nodes) => {
          for (const n of nodes) {
            if (n.type === 'group') {
              next.add(n.id);
              walk(n.children);
            }
          }
        };
        walk(screen.nodes);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evita reset no poll
  }, [selectedScreenId, selectedNodeId]);

  // Rolar a linha ativa para ficar visível no painel.
  useEffect(() => {
    const targetId = selectedNodeId || selectedScreenId;
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
  }, [selectedScreenId, selectedNodeId, expanded]);

  const toggle = (id, e) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ordered = [...screens].reverse();

  return (
    <div
      className="layers-panel"
      onMouseLeave={() => onHoverNode?.(null, null)}
    >
      <div className="layers-header">
        <span>Camadas</span>
      </div>
      <div className="layers-tree">
        {ordered.map((screen) => {
          const open = expanded.has(screen.id);
          const screenActive =
            selectedScreenId === screen.id && !selectedNodeId;
          return (
            <div key={screen.id} className="layer-branch">
              <button
                type="button"
                data-layer-id={screen.id}
                className={`layer-row screen-row${screenActive ? ' active' : ''}${selectedScreenId === screen.id ? ' screen-selected' : ''}`}
                onClick={() => onSelectScreen(screen.id)}
                onMouseEnter={() => onHoverNode?.(screen.id, null)}
              >
                <span
                  className="layer-chevron"
                  onClick={(e) => toggle(screen.id, e)}
                  role="presentation"
                >
                  {open ? '▾' : '▸'}
                </span>
                <span className="layer-icon frame-icon">#</span>
                <span className="layer-label">{screen.name}</span>
              </button>
              {open &&
                [...screen.nodes].reverse().map((node) => (
                  <NodeBranch
                    key={node.id}
                    node={node}
                    screenId={screen.id}
                    depth={1}
                    selectedScreenId={selectedScreenId}
                    selectedNodeId={selectedNodeId}
                    hoveredNodeId={hoveredNodeId}
                    expanded={expanded}
                    onToggle={toggle}
                    onSelectNode={onSelectNode}
                    onHoverNode={onHoverNode}
                  />
                ))}
            </div>
          );
        })}
        {!screens.length && (
          <p className="hint layers-empty">Nenhuma camada ainda.</p>
        )}
      </div>
    </div>
  );
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === 'group') {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}
