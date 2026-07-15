function NodeView({ node, onSelect, onHover }) {
  const style = {
    left: node.x,
    top: node.y,
    width: node.w,
    height: node.h,
  };

  const className = `node${
    node.type === 'text' ? ' node-text' : ''
  }${node.type === 'button' ? ' node-button' : ''}`;

  const onPointerDown = (e) => {
    e.stopPropagation();
    onSelect?.(node.id);
  };

  const handlers = {
    onPointerDown,
    onPointerEnter: () => onHover?.(node.id),
    onPointerLeave: () => onHover?.(null),
  };

  if (node.type === 'text') {
    return (
      <div
        className={`${className}${node.icon ? ' node-icon' : ''}`}
        style={{
          ...style,
          color: node.color,
          fontSize: node.fontSize,
          fontWeight: node.icon ? 400 : node.fontWeight,
          textAlign: node.align || 'left',
          lineHeight: node.icon ? 1 : 1.2,
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            node.align === 'center'
              ? 'center'
              : node.align === 'right'
                ? 'flex-end'
                : 'flex-start',
        }}
        {...handlers}
      >
        {node.text}
      </div>
    );
  }

  if (node.type === 'button') {
    return (
      <div
        className={className}
        style={{
          ...style,
          background: node.fill,
          color: node.textColor,
          borderRadius: node.cornerRadius,
          fontSize: node.fontSize,
          fontWeight: node.fontWeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          boxSizing: 'border-box',
          border: node.stroke
            ? `${node.strokeWidth || 1}px solid ${node.stroke}`
            : undefined,
        }}
        {...handlers}
      >
        {node.iconSrc ? (
          <img
            className="node-button-icon"
            src={node.iconSrc}
            alt=""
            draggable={false}
          />
        ) : null}
        <span>{node.label}</span>
      </div>
    );
  }

  if (node.type === 'image') {
    const objectFit = node.fit || 'contain';
    return (
      <div
        className={`${className} node-image`}
        style={style}
        {...handlers}
      >
        <img
          src={node.src}
          alt={node.name || ''}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit,
            display: 'block',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }

  const radius =
    node.bottomRadius != null
      ? `0 0 ${node.bottomRadius}px ${node.bottomRadius}px`
      : node.cornerRadius || 0;

  return (
    <div
      className={className}
      style={{
        ...style,
        background: node.fill,
        borderRadius: radius,
        opacity: node.opacity ?? 1,
        boxSizing: 'border-box',
        border: node.stroke
          ? `${node.strokeWidth || 1}px solid ${node.stroke}`
          : undefined,
      }}
      {...handlers}
    />
  );
}

function flattenLeaves(nodes) {
  const out = [];
  for (const node of nodes) {
    if (node.type === 'group') out.push(...flattenLeaves(node.children));
    else out.push(node);
  }
  return out;
}

function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === 'group') {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Caminho [raiz…alvo] até o nó, ou []. */
function findNodePath(nodes, id, trail = []) {
  for (const node of nodes) {
    const next = [...trail, node];
    if (node.id === id) return next;
    if (node.type === 'group') {
      const found = findNodePath(node.children, id, next);
      if (found.length) return found;
    }
  }
  return [];
}

function Outline({ node, kind }) {
  if (!node) return null;
  const cls =
    kind === 'selected'
      ? 'group-outline'
      : kind === 'ancestor'
        ? 'node-hover-ancestor'
        : kind === 'sibling'
          ? 'node-hover-sibling'
          : 'node-hover-outline';
  return (
    <div
      className={cls}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
      }}
    />
  );
}

/**
 * Hover estilo Figma: alvo + grupos pais + irmãos do grupo imediato.
 */
function hoverOutlineNodes(screenNodes, hoveredNodeId, selectedNodeId) {
  if (!hoveredNodeId || hoveredNodeId === selectedNodeId) {
    return { ancestors: [], siblings: [], target: null };
  }
  const path = findNodePath(screenNodes, hoveredNodeId);
  if (!path.length) {
    return { ancestors: [], siblings: [], target: null };
  }

  const target = path[path.length - 1];
  const ancestors = path.slice(0, -1);

  /** @type {typeof target[]} */
  let siblings = [];
  if (target.type === 'group') {
    // Hover no grupo: contorno nos filhos diretos
    siblings = target.children.filter((c) => c.id !== selectedNodeId);
  } else if (ancestors.length) {
    const parent = ancestors[ancestors.length - 1];
    if (parent.type === 'group') {
      siblings = parent.children.filter(
        (c) => c.id !== target.id && c.id !== selectedNodeId,
      );
    }
  }

  return {
    ancestors: ancestors.filter((n) => n.id !== selectedNodeId),
    siblings,
    target,
  };
}

export default function PhoneFrame({
  screen,
  selectedNodeId,
  hoveredNodeId,
  onSelectNode,
  onHoverNode,
}) {
  const leaves = flattenLeaves(screen.nodes);
  const selected = selectedNodeId
    ? findNodeById(screen.nodes, selectedNodeId)
    : null;

  const { ancestors, siblings, target } = hoverOutlineNodes(
    screen.nodes,
    hoveredNodeId,
    selectedNodeId,
  );

  return (
    <div
      className="phone"
      style={{
        width: screen.width,
        height: screen.height,
        background: screen.background,
      }}
      onPointerLeave={() => onHoverNode?.(null)}
    >
      {leaves.map((node) => (
        <NodeView
          key={node.id}
          node={node}
          onSelect={onSelectNode}
          onHover={onHoverNode}
        />
      ))}
      {/* Outline em overlay: não altera z-index do conteúdo */}
      {selected && <Outline node={selected} kind="selected" />}
      {ancestors.map((node) => (
        <Outline key={`anc-${node.id}`} node={node} kind="ancestor" />
      ))}
      {siblings.map((node) => (
        <Outline key={`sib-${node.id}`} node={node} kind="sibling" />
      ))}
      {target && target.type !== 'group' && selectedNodeId !== target.id && (
        <Outline node={target} kind="hover" />
      )}
      {target && target.type === 'group' && (
        <Outline node={target} kind="ancestor" />
      )}
    </div>
  );
}
