import { useEffect, useRef, useState } from 'react';
import {
  collectLeafIds,
  cryptoRandomId,
  findNodeById,
  flattenLeaves,
} from '@figmashow/core/schema';
import {
  clearGuidesOverlay,
  collectAlignTargets,
  renderGuidesOverlay,
  snapDrag,
  snapResize,
} from './smartGuides.js';

const DRAG_THRESHOLD = 3;

function NodeView({ node, onPointerDownNode, onHover }) {
  const style = {
    left: node.x,
    top: node.y,
    width: node.w,
    height: node.h,
  };

  const className = `node${
    node.type === 'text' ? ' node-text' : ''
  }${node.type === 'button' ? ' node-button' : ''}`;

  const handlers = {
    onPointerDown: (e) => onPointerDownNode?.(e, node),
    onPointerEnter: (e) => onHover?.(node.id, e),
    onPointerLeave: () => onHover?.(null),
  };

  if (node.type === 'text') {
    return (
      <div
        data-node-id={node.id}
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
        data-node-id={node.id}
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
        data-node-id={node.id}
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
      data-node-id={node.id}
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

/**
 * Sem Ctrl: se o clique cai dentro da seleção atual, mantém ela;
 * senão pega o grupo externo. Com Ctrl/Cmd: nó profundo (folha).
 * @param {string[]} selectedIds
 */
function resolvePickTarget(screenNodes, leafId, deepSelect, selectedIds) {
  const path = findNodePath(screenNodes, leafId);
  if (!path.length) return null;
  const leaf = path[path.length - 1];
  const selectedSet = new Set(selectedIds || []);

  if (deepSelect) return leaf;

  // Preferência pelo nó selecionado mais profundo no caminho
  const selectedOnPath = [...path]
    .reverse()
    .find((n) => selectedSet.has(n.id));
  if (selectedOnPath) return selectedOnPath;

  const outerGroup = path.find((n) => n.type === 'group');
  return outerGroup || leaf;
}

/** IDs selecionados que não são descendentes de outro selecionado. */
function topLevelSelectedIds(screenNodes, selectedIds) {
  return (selectedIds || []).filter((id) => {
    const path = findNodePath(screenNodes, id);
    if (!path.length) return false;
    return !path.slice(0, -1).some((n) => selectedIds.includes(n.id));
  });
}

function boundsOfNodes(nodes) {
  if (!nodes.length) return { x: 0, y: 0, w: 1, h: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  };
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
      data-outline-id={node.id}
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
 * Hover estilo Figma.
 * - Sem deep: grupo externo sólido + filhos tracejados
 * - Com deep: folha sob o mouse (+ ancestrais)
 */
function hoverOutlineNodes(
  screenNodes,
  hoveredLeafId,
  selectedIds,
  deepSelect,
) {
  if (!hoveredLeafId) {
    return { ancestors: [], siblings: [], target: null };
  }

  const selectedSet = new Set(selectedIds || []);
  const pick = resolvePickTarget(
    screenNodes,
    hoveredLeafId,
    deepSelect,
    selectedIds,
  );
  if (!pick || selectedSet.has(pick.id)) {
    return { ancestors: [], siblings: [], target: null };
  }

  if (!deepSelect && pick.type === 'group') {
    return {
      ancestors: [],
      siblings: pick.children.filter((c) => !selectedSet.has(c.id)),
      target: pick,
    };
  }

  const path = findNodePath(screenNodes, hoveredLeafId);
  if (!path.length) {
    return { ancestors: [], siblings: [], target: null };
  }
  const target = path[path.length - 1];
  return {
    ancestors: path.slice(0, -1).filter((n) => !selectedSet.has(n.id)),
    siblings: [],
    target: selectedSet.has(target.id) ? null : target,
  };
}

function gatherMoveOrigins(rootNode, selectedNode) {
  /** @type {Map<string, { x: number, y: number }>} */
  const origins = new Map();
  const leafIds = collectLeafIds(rootNode);
  const all = [
    rootNode,
    ...(rootNode.type === 'group' ? flattenLeaves(rootNode.children) : []),
  ];
  if (selectedNode) {
    const exists = all.some((n) => n.id === selectedNode.id);
    if (!exists) all.push(selectedNode);
  }
  for (const n of all) {
    origins.set(n.id, { x: n.x, y: n.y });
  }
  return { origins, leafIds };
}

function mergeMoveOrigins(entries) {
  /** @type {Map<string, { x: number, y: number }>} */
  const origins = new Map();
  /** @type {string[]} */
  const leafIds = [];
  for (const entry of entries) {
    for (const [id, origin] of entry.origins) {
      origins.set(id, origin);
    }
    leafIds.push(...entry.leafIds);
  }
  return { origins, leafIds: [...new Set(leafIds)] };
}

function applyDomOffset(phoneEl, origins, dx, dy) {
  for (const [id, origin] of origins) {
    const x = origin.x + dx;
    const y = origin.y + dy;
    phoneEl
      .querySelectorAll(`[data-node-id="${CSS.escape(id)}"]`)
      .forEach((el) => {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      });
    phoneEl
      .querySelectorAll(`[data-outline-id="${CSS.escape(id)}"]`)
      .forEach((el) => {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      });
  }
}

function isDeepSelectEvent(e) {
  return !!(e?.ctrlKey || e?.metaKey);
}

const RESIZE_CORNERS = ['nw', 'ne', 'se', 'sw'];
const RESIZE_EDGES = ['n', 'e', 's', 'w'];

function resizeCursorForHandle(handle) {
  if (handle === 'e' || handle === 'w') return 'ew-resize';
  if (handle === 'n' || handle === 's') return 'ns-resize';
  if (handle === 'nw' || handle === 'se') return 'nwse-resize';
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
  return 'ew-resize';
}

function setGlobalResizeCursor(cursor) {
  if (typeof document === 'undefined') return;
  if (cursor) {
    document.documentElement.dataset.figmashowResize = cursor;
  } else {
    delete document.documentElement.dataset.figmashowResize;
  }
}

/**
 * Redimensiona a box. Com fromCenter (Shift), espelha no lado oposto
 * mantendo o centro fixo.
 */
function applyResizeBox(origin, handle, dx, dy, fromCenter = false) {
  if (!fromCenter) {
    let { x, y, w, h } = origin;
    if (handle.includes('e')) w = Math.max(1, origin.w + dx);
    if (handle.includes('s')) h = Math.max(1, origin.h + dy);
    if (handle.includes('w')) {
      w = Math.max(1, origin.w - dx);
      x = origin.x + origin.w - w;
    }
    if (handle.includes('n')) {
      h = Math.max(1, origin.h - dy);
      y = origin.y + origin.h - h;
    }
    return { x, y, w, h };
  }

  const cx = origin.x + origin.w / 2;
  const cy = origin.y + origin.h / 2;
  let w = origin.w;
  let h = origin.h;

  if (handle.includes('e') || handle.includes('w')) {
    const dw = handle.includes('e') ? dx : -dx;
    w = Math.max(1, origin.w + 2 * dw);
  }
  if (handle.includes('n') || handle.includes('s')) {
    const dh = handle.includes('s') ? dy : -dy;
    h = Math.max(1, origin.h + 2 * dh);
  }

  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
  };
}

function buildCreatedNode(type, box) {
  const x = Math.round(Math.min(box.x, box.x + box.w));
  const y = Math.round(Math.min(box.y, box.y + box.h));
  const w = Math.max(1, Math.round(Math.abs(box.w)));
  const h = Math.max(1, Math.round(Math.abs(box.h)));
  if (type === 'text') {
    return {
      id: cryptoRandomId('text'),
      type: 'text',
      name: 'Texto',
      x,
      y,
      w: Math.max(w, 40),
      h: Math.max(h, 24),
      text: 'Texto',
      fontSize: 16,
      fontWeight: 400,
      color: '#1A1D21',
      align: 'left',
    };
  }
  return {
    id: cryptoRandomId('rect'),
    type: 'rect',
    name: 'Retângulo',
    x,
    y,
    w: Math.max(w, 8),
    h: Math.max(h, 8),
    fill: '#93C5FD',
    cornerRadius: 8,
    opacity: 1,
  };
}

export default function PhoneFrame({
  screen,
  selectedNodeIds = [],
  hoveredNodeId,
  onSelectNode,
  onHoverNode,
  dragEnabled = false,
  createTool = null,
  onCreateNode,
  onResizeCommit,
  getZoom,
  onMoveCommit,
  onDragActive,
}) {
  const phoneRef = useRef(null);
  const dragRef = useRef(null);
  const guidesRef = useRef(null);
  const deepSelectRef = useRef(false);
  const hoveredLeafRef = useRef(null);
  const selectedIdsRef = useRef(selectedNodeIds);
  const [createPreview, setCreatePreview] = useState(null);

  const [deepSelect, setDeepSelect] = useState(false);
  const [hoveredLeafId, setHoveredLeafId] = useState(null);

  selectedIdsRef.current = selectedNodeIds;

  const leaves = flattenLeaves(screen.nodes);
  const selectedNodes = selectedNodeIds
    .map((id) => findNodeById(screen.nodes, id))
    .filter(Boolean);
  const singleSelected =
    selectedNodes.length === 1 ? selectedNodes[0] : null;

  // Prefer leaf local; fallback hoveredNodeId do App (ex. painel camadas).
  const leafForHover = hoveredLeafId || hoveredNodeId;
  const { ancestors, siblings, target } = hoverOutlineNodes(
    screen.nodes,
    leafForHover,
    selectedNodeIds,
    deepSelect,
  );

  const emitHoverPick = (leafId, deep) => {
    if (!leafId) {
      onHoverNode?.(null);
      return;
    }
    const pick = resolvePickTarget(
      screen.nodes,
      leafId,
      deep,
      selectedIdsRef.current,
    );
    onHoverNode?.(pick?.id ?? leafId);
  };

  const localPoint = (e) => {
    const rect = phoneRef.current?.getBoundingClientRect();
    const zoom = Math.max(0.0001, getZoom?.() ?? 1);
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  };

  useEffect(() => {
    const syncDeep = (on) => {
      deepSelectRef.current = on;
      setDeepSelect(on);
      if (hoveredLeafRef.current) {
        emitHoverPick(hoveredLeafRef.current, on);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') syncDeep(true);
    };
    const onKeyUp = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') syncDeep(false);
    };
    const onBlur = () => syncDeep(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      setGlobalResizeCursor(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só montar listeners
  }, [screen.nodes]);

  const endDrag = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    onDragActive?.(false);
    setCreatePreview(null);
    if (drag.type === 'resize') {
      setGlobalResizeCursor(null);
    }

    const phoneEl = phoneRef.current;
    if (phoneEl?.hasPointerCapture?.(e.pointerId)) {
      phoneEl.releasePointerCapture(e.pointerId);
    }

    clearGuidesOverlay(guidesRef.current);

    if (drag.type === 'create') {
      const box = drag.box;
      if (!box || (Math.abs(box.w) < 4 && Math.abs(box.h) < 4)) {
        // clique simples → tamanho padrão
        const p = drag.origin;
        const node = buildCreatedNode(drag.createType, {
          x: p.x,
          y: p.y,
          w: drag.createType === 'text' ? 120 : 100,
          h: drag.createType === 'text' ? 28 : 100,
        });
        onCreateNode?.(screen.id, node);
        return;
      }
      onCreateNode?.(screen.id, buildCreatedNode(drag.createType, box));
      return;
    }

    if (drag.type === 'resize') {
      if (!drag.moved || !drag.lastBox) return;
      onResizeCommit?.(screen.id, drag.nodeId, drag.lastBox);
      return;
    }

    if (!drag.moved) return;
    const dx = drag.lastDx ?? 0;
    const dy = drag.lastDy ?? 0;
    if (dx || dy) {
      onMoveCommit?.(screen.id, drag.moveIds, dx, dy);
    }
  };

  const onPointerDownCreate = (e) => {
    if (e.button !== 0 || !createTool) return;
    e.stopPropagation();
    const p = localPoint(e);
    dragRef.current = {
      type: 'create',
      pointerId: e.pointerId,
      createType: createTool,
      origin: p,
      box: { x: p.x, y: p.y, w: 0, h: 0 },
      moved: false,
    };
    setCreatePreview({ x: p.x, y: p.y, w: 0, h: 0 });
    onDragActive?.(true);
    phoneRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerDownResize = (e, handle) => {
    if (e.button !== 0 || !singleSelected || !dragEnabled) return;
    e.stopPropagation();
    e.preventDefault();
    const leafIds = collectLeafIds(singleSelected);
    const exclude = new Set([singleSelected.id, ...leafIds]);
    const targets = collectAlignTargets(screen, exclude);
    dragRef.current = {
      type: 'resize',
      pointerId: e.pointerId,
      nodeId: singleSelected.id,
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originBox: {
        x: singleSelected.x,
        y: singleSelected.y,
        w: singleSelected.w,
        h: singleSelected.h,
      },
      targets,
      lastBox: null,
      moved: false,
    };
    setGlobalResizeCursor(resizeCursorForHandle(handle));
    onDragActive?.(true);
    phoneRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerDownNode = (e, leafNode) => {
    if (createTool) {
      onPointerDownCreate(e);
      return;
    }
    if (e.button !== 0) return;
    if (!onSelectNode && !dragEnabled) return;
    e.stopPropagation();

    const deep = isDeepSelectEvent(e);
    const additive = !!e.shiftKey;
    const currentIds = selectedIdsRef.current || [];
    const pick = resolvePickTarget(
      screen.nodes,
      leafNode.id,
      deep,
      currentIds,
    );
    if (!pick) return;
    const pickId = pick.id;

    /** @type {string[]} */
    let nextIds;
    if (additive) {
      nextIds = currentIds.includes(pickId)
        ? currentIds.filter((id) => id !== pickId)
        : [...currentIds, pickId];
      onSelectNode?.(pickId, { additive: true });
      // Shift só altera a seleção — sem iniciar arraste
      return;
    }
    if (currentIds.includes(pickId) && currentIds.length > 1) {
      // Clique em item já na multi-seleção → mantém todos
      nextIds = currentIds;
      onSelectNode?.(pickId, { preserve: true });
    } else {
      nextIds = [pickId];
      onSelectNode?.(pickId);
    }

    if (!dragEnabled) return;

    const moveIds = topLevelSelectedIds(screen.nodes, nextIds);
    if (!moveIds.length) return;

    const moveNodes = moveIds
      .map((id) => findNodeById(screen.nodes, id))
      .filter(Boolean);
    const { origins, leafIds } = mergeMoveOrigins(
      moveNodes.map((n) => gatherMoveOrigins(n, n)),
    );
    const exclude = new Set([...moveIds, ...leafIds]);
    const targets = collectAlignTargets(screen, exclude);
    const originRect = boundsOfNodes(moveNodes);

    dragRef.current = {
      type: 'move',
      pointerId: e.pointerId,
      moveIds,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origins,
      leafIds,
      targets,
      originRect,
      moved: false,
      lastDx: 0,
      lastDy: 0,
    };
    onDragActive?.(true);
    phoneRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMoveNode = (e) => {
    const drag = dragRef.current;

    if (!drag) {
      const deep = isDeepSelectEvent(e);
      if (deep !== deepSelectRef.current) {
        deepSelectRef.current = deep;
        setDeepSelect(deep);
        if (hoveredLeafRef.current) {
          emitHoverPick(hoveredLeafRef.current, deep);
        }
      }
      return;
    }
    if (drag.pointerId !== e.pointerId) return;

    const zoom = Math.max(0.0001, getZoom?.() ?? 1);

    if (drag.type === 'create') {
      const p = localPoint(e);
      const box = {
        x: drag.origin.x,
        y: drag.origin.y,
        w: p.x - drag.origin.x,
        h: p.y - drag.origin.y,
      };
      drag.box = box;
      drag.moved = true;
      setCreatePreview(box);
      return;
    }

    if (drag.type === 'resize') {
      const rawDx = (e.clientX - drag.startClientX) / zoom;
      const rawDy = (e.clientY - drag.startClientY) / zoom;
      const dist = Math.hypot(
        e.clientX - drag.startClientX,
        e.clientY - drag.startClientY,
      );
      if (!drag.moved && dist < DRAG_THRESHOLD) return;
      drag.moved = true;
      const fromCenter = !!e.shiftKey;
      const raw = applyResizeBox(
        drag.originBox,
        drag.handle,
        rawDx,
        rawDy,
        fromCenter,
      );
      const snapped = snapResize(
        raw,
        drag.handle,
        drag.targets || { x: [], y: [], otherRects: [] },
        { width: screen.width, height: screen.height },
        fromCenter,
        drag.originBox,
      );
      const box = snapped.box;
      drag.lastBox = box;
      const phoneEl = phoneRef.current;
      if (phoneEl) {
        phoneEl
          .querySelectorAll(`[data-outline-id="${CSS.escape(drag.nodeId)}"]`)
          .forEach((el) => {
            el.style.left = `${box.x}px`;
            el.style.top = `${box.y}px`;
            el.style.width = `${box.w}px`;
            el.style.height = `${box.h}px`;
          });
        phoneEl.querySelectorAll('.resize-handles').forEach((el) => {
          el.style.left = `${box.x}px`;
          el.style.top = `${box.y}px`;
          el.style.width = `${box.w}px`;
          el.style.height = `${box.h}px`;
        });
        const node = findNodeById(screen.nodes, drag.nodeId);
        if (node && node.type !== 'group') {
          phoneEl
            .querySelectorAll(`[data-node-id="${CSS.escape(drag.nodeId)}"]`)
            .forEach((el) => {
              el.style.left = `${box.x}px`;
              el.style.top = `${box.y}px`;
              el.style.width = `${box.w}px`;
              el.style.height = `${box.h}px`;
            });
        }
      }
      renderGuidesOverlay(guidesRef.current, snapped.guides, snapped.size);
      return;
    }

    const rawDx = (e.clientX - drag.startClientX) / zoom;
    const rawDy = (e.clientY - drag.startClientY) / zoom;
    const dist = Math.hypot(
      e.clientX - drag.startClientX,
      e.clientY - drag.startClientY,
    );
    if (!drag.moved && dist < DRAG_THRESHOLD) return;
    drag.moved = true;

    const snapped = snapDrag(
      drag.originRect,
      drag.targets,
      rawDx,
      rawDy,
      { width: screen.width, height: screen.height },
    );
    drag.lastDx = snapped.dx;
    drag.lastDy = snapped.dy;

    const phoneEl = phoneRef.current;
    if (phoneEl) applyDomOffset(phoneEl, drag.origins, snapped.dx, snapped.dy);
    renderGuidesOverlay(guidesRef.current, snapped.guides, snapped.size);
  };

  const onNodeHover = (leafId, e) => {
    if (dragRef.current || createTool) return;
    if (leafId == null) {
      hoveredLeafRef.current = null;
      setHoveredLeafId(null);
      onHoverNode?.(null);
      return;
    }
    const deep = e ? isDeepSelectEvent(e) : deepSelectRef.current;
    if (e && deep !== deepSelectRef.current) {
      deepSelectRef.current = deep;
      setDeepSelect(deep);
    }
    hoveredLeafRef.current = leafId;
    setHoveredLeafId(leafId);
    emitHoverPick(leafId, deep);
  };

  const previewBox = createPreview
    ? {
        left: Math.min(createPreview.x, createPreview.x + createPreview.w),
        top: Math.min(createPreview.y, createPreview.y + createPreview.h),
        width: Math.abs(createPreview.w),
        height: Math.abs(createPreview.h),
      }
    : null;

  return (
    <div
      ref={phoneRef}
      className={`phone${dragEnabled ? ' drag-enabled' : ''}${createTool ? ' create-tool' : ''}`}
      style={{
        width: screen.width,
        height: screen.height,
        background: screen.background,
      }}
      onPointerLeave={() => {
        if (!dragRef.current) onNodeHover(null);
      }}
      onPointerDown={(e) => {
        if (createTool && e.target === phoneRef.current) {
          onPointerDownCreate(e);
        }
      }}
      onPointerMove={onPointerMoveNode}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {leaves.map((node) => (
        <NodeView
          key={node.id}
          node={node}
          onPointerDownNode={onPointerDownNode}
          onHover={onNodeHover}
        />
      ))}
      {selectedNodes.map((node) => (
        <Outline key={`sel-${node.id}`} node={node} kind="selected" />
      ))}
      {singleSelected && dragEnabled && !createTool && (
        <div
          className="resize-handles"
          style={{
            left: singleSelected.x,
            top: singleSelected.y,
            width: singleSelected.w,
            height: singleSelected.h,
          }}
        >
          {RESIZE_EDGES.map((h) => (
            <button
              key={`edge-${h}`}
              type="button"
              className={`resize-edge resize-edge-${h}`}
              aria-label={`Redimensionar borda ${h}`}
              onPointerDown={(e) => onPointerDownResize(e, h)}
            />
          ))}
          {RESIZE_CORNERS.map((h) => (
            <button
              key={`corner-${h}`}
              type="button"
              className={`resize-handle resize-${h}`}
              aria-label={`Redimensionar canto ${h}`}
              onPointerDown={(e) => onPointerDownResize(e, h)}
            />
          ))}
        </div>
      )}
      {ancestors.map((node) => (
        <Outline key={`anc-${node.id}`} node={node} kind="ancestor" />
      ))}
      {siblings.map((node) => (
        <Outline key={`sib-${node.id}`} node={node} kind="sibling" />
      ))}
      {target &&
        target.type !== 'group' &&
        !selectedNodeIds.includes(target.id) && (
          <Outline node={target} kind="hover" />
        )}
      {target &&
        target.type === 'group' &&
        !selectedNodeIds.includes(target.id) && (
          <Outline node={target} kind="ancestor" />
        )}
      {previewBox && (
        <div
          className="create-preview"
          style={{
            left: previewBox.left,
            top: previewBox.top,
            width: Math.max(1, previewBox.width),
            height: Math.max(1, previewBox.height),
          }}
        />
      )}
      <div ref={guidesRef} className="smart-guides-overlay" aria-hidden="true" />
    </div>
  );
}
