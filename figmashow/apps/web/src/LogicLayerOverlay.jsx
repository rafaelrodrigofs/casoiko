import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WORKFLOW_KINDS,
  WORKFLOW_KIND_LABEL,
  classifyWorkflowPathNodes,
  bezierPath,
  bezierControls,
  edgePoint,
  getPrototypeLinkEndpoints,
  sampleCubicBezier,
  samplePointsAlongPrototypeLink,
} from '@figmashow/core/domain';

const NODE_W = 168;
const NODE_H = 56;

function nodeBox(pos) {
  return { x: pos.x, y: pos.y, w: NODE_W, h: NODE_H };
}

function hitLogicNode(positions, wx, wy, excludeId) {
  for (let i = positions.length - 1; i >= 0; i -= 1) {
    const p = positions[i];
    if (p.nodeId === excludeId) continue;
    if (
      wx >= p.x &&
      wx <= p.x + NODE_W &&
      wy >= p.y &&
      wy <= p.y + NODE_H
    ) {
      return p;
    }
  }
  return null;
}

/**
 * Camada lógica: nós no caminho (referência do protótipo) + eixo roxo do fluxo.
 */
export default function LogicLayerOverlay({
  active = false,
  graphs = [],
  screens = [],
  prototypes = [],
  selectedNodeId = null,
  selectedScreenId = null,
  focusedWorkflowId = null,
  focusedLinkId = null,
  clientToWorld,
  onSelectNode,
  onMoveNode,
  onConnect,
  onAddNodeAt,
  onInsertOnPrototype,
  onFocusLink,
  onClearSelection,
}) {
  const [dragMove, setDragMove] = useState(null);
  const [dragLink, setDragLink] = useState(null);
  const [hoverTargetId, setHoverTargetId] = useState(null);
  const [addMenu, setAddMenu] = useState(null);
  const dragMoveRef = useRef(null);
  const dragLinkRef = useRef(null);
  const positionsRef = useRef([]);
  const clientToWorldRef = useRef(clientToWorld);

  useEffect(() => {
    clientToWorldRef.current = clientToWorld;
  }, [clientToWorld]);

  const positions = useMemo(() => {
    const list = [];
    for (const g of graphs || []) {
      const wf = g.workflow;
      if (!wf) continue;
      if (focusedLinkId && g.prototypeLinkId !== focusedLinkId) continue;
      const hideNavigate = Boolean(g.prototypeLinkId);
      const byId = new Map((wf.nodes || []).map((n) => [n.id, n]));

      // Com protótipo: posição sempre derivada da curva atual das telas
      if (g.prototypeLinkId) {
        const link = (prototypes || []).find((p) => p.id === g.prototypeLinkId);
        const { onPath, side } = classifyWorkflowPathNodes(wf);
        const pts = link
          ? samplePointsAlongPrototypeLink(screens, link, onPath.length)
          : [];
        const placed = new Map();
        onPath.forEach((id, i) => {
          const node = byId.get(id);
          if (!node || (hideNavigate && node.kind === 'navigate')) return;
          const p = pts[i];
          if (!p) return;
          const x = p.x - NODE_W / 2;
          const y = p.y - NODE_H / 2;
          placed.set(id, { x, y });
          list.push({
            nodeId: id,
            workflowId: wf.id,
            interactionId: g.interactionId || null,
            prototypeLinkId: g.prototypeLinkId,
            x,
            y,
            node,
            label: g.label,
          });
        });
        for (const s of side) {
          const node = byId.get(s.nodeId);
          if (!node) continue;
          const near = placed.get(s.nearId);
          const x = near ? near.x : 40;
          const y = near ? near.y + NODE_H + 36 : 40;
          list.push({
            nodeId: s.nodeId,
            workflowId: wf.id,
            interactionId: g.interactionId || null,
            prototypeLinkId: g.prototypeLinkId,
            x,
            y,
            node,
            label: g.label,
          });
        }
        continue;
      }

      const viewById = new Map((g.view?.nodes || []).map((n) => [n.nodeId, n]));
      (wf.nodes || []).forEach((n, i) => {
        if (hideNavigate && n.kind === 'navigate') return;
        const v = viewById.get(n.id);
        list.push({
          nodeId: n.id,
          workflowId: wf.id,
          interactionId: g.interactionId || null,
          prototypeLinkId: null,
          x: v ? v.x : 40 + list.length * 24,
          y: v ? v.y : 40 + i * 100,
          node: n,
          label: g.label,
        });
      });
    }
    return list;
  }, [graphs, screens, prototypes, focusedLinkId]);

  const livePositions = useMemo(() => {
    if (!dragMove) return positions;
    return positions.map((p) =>
      p.nodeId === dragMove.nodeId
        ? { ...p, x: dragMove.x, y: dragMove.y }
        : p,
    );
  }, [positions, dragMove]);

  useEffect(() => {
    positionsRef.current = livePositions;
  }, [livePositions]);

  useEffect(() => {
    dragMoveRef.current = dragMove;
  }, [dragMove]);

  useEffect(() => {
    dragLinkRef.current = dragLink;
  }, [dragLink]);

  const endMove = useCallback(
    (cancelled) => {
      const d = dragMoveRef.current;
      setDragMove(null);
      if (!d || cancelled) return;
      onMoveNode?.(d.nodeId, d.x, d.y, d.workflowId);
    },
    [onMoveNode],
  );

  const endLink = useCallback(
    (cancelled) => {
      const d = dragLinkRef.current;
      setDragLink(null);
      setHoverTargetId(null);
      if (!d || cancelled) return;
      const target = hitLogicNode(
        positionsRef.current,
        d.cursorX,
        d.cursorY,
        d.fromNodeId,
      );
      if (target) {
        onConnect?.(d.fromNodeId, target.nodeId, d.workflowId);
        return;
      }
      setAddMenu({
        x: d.cursorX,
        y: d.cursorY,
        fromNodeId: d.fromNodeId,
        workflowId: d.workflowId,
      });
    },
    [onConnect],
  );

  useEffect(() => {
    if (!dragMove) return undefined;
    const onMove = (e) => {
      const d = dragMoveRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startClientX) / (d.zoom || 1);
      const dy = (e.clientY - d.startClientY) / (d.zoom || 1);
      setDragMove({
        ...d,
        x: d.originX + dx,
        y: d.originY + dy,
      });
    };
    const onUp = () => endMove(false);
    const onKey = (ev) => {
      if (ev.key === 'Escape') endMove(true);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [dragMove, endMove]);

  useEffect(() => {
    if (!dragLink) return undefined;
    const onMove = (e) => {
      const world = clientToWorldRef.current?.(e.clientX, e.clientY);
      if (!world) return;
      setDragLink((prev) =>
        prev ? { ...prev, cursorX: world.x, cursorY: world.y } : prev,
      );
      const hit = hitLogicNode(
        positionsRef.current,
        world.x,
        world.y,
        dragLink.fromNodeId,
      );
      setHoverTargetId(hit?.nodeId || null);
    };
    const onUp = () => endLink(false);
    const onKey = (ev) => {
      if (ev.key === 'Escape') endLink(true);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [dragLink, endLink]);

  const axes = useMemo(() => {
    const list = [];
    for (const g of graphs || []) {
      if (!g.prototypeLinkId) continue;
      if (focusedLinkId && g.prototypeLinkId !== focusedLinkId) continue;
      const link = (prototypes || []).find((p) => p.id === g.prototypeLinkId);
      if (!link) continue;
      const ep = getPrototypeLinkEndpoints(screens, link);
      if (!ep) continue;
      const ctrl = bezierControls(
        ep.start.x,
        ep.start.y,
        ep.end.x,
        ep.end.y,
        ep.side,
      );
      const mid = sampleCubicBezier(ctrl, 0.5);
      list.push({
        key: `axis-${g.workflowId}`,
        linkId: link.id,
        workflowId: g.workflowId,
        interactionId: g.interactionId || null,
        label: g.label,
        fromScreenId: link.fromScreenId,
        toScreenId: link.toScreenId,
        start: ep.start,
        end: ep.end,
        side: ep.side,
        mid,
        d: bezierPath(ep.start.x, ep.start.y, ep.end.x, ep.end.y, ep.side),
      });
    }
    return list;
  }, [graphs, screens, prototypes, focusedLinkId]);

  if (!active) return null;
  if (!(graphs || []).length && !axes.length) return null;

  const screenFocusActive = Boolean(selectedScreenId && !focusedLinkId);
  const axisRelated = (axis) =>
    !screenFocusActive ||
    axis.fromScreenId === selectedScreenId ||
    axis.toScreenId === selectedScreenId;

  const sortedAxes = screenFocusActive
    ? [...axes].sort((a, b) => Number(axisRelated(a)) - Number(axisRelated(b)))
    : axes;

  const linkById = new Map((prototypes || []).map((p) => [p.id, p]));

  const posById = new Map(livePositions.map((p) => [p.nodeId, p]));

  /** Arestas laterais (erro) + fluxos sem protótipo */
  const noodles = [];
  for (const g of graphs || []) {
    const wf = g.workflow;
    if (!wf) continue;
    for (const edge of wf.edges || []) {
      if (g.prototypeLinkId && edge.when !== 'error') continue;
      const from = posById.get(edge.from);
      const to = posById.get(edge.to);
      if (!from || !to) continue;
      const start = edgePoint(nodeBox(from), 'right');
      const end = edgePoint(nodeBox(to), 'left');
      noodles.push({ edge, start, end, workflowId: wf.id });
    }
  }

  return (
    <div
      className="logic-layer-overlay"
      aria-label="Camada lógica"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          setAddMenu(null);
          onClearSelection?.();
        }
      }}
    >
      <svg className="logic-noodles" overflow="visible">
        <defs>
          <marker
            id="logic-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#a78bfa" />
          </marker>
          <marker
            id="logic-arrow-dim"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="rgba(167, 139, 250, 0.25)" />
          </marker>
          <marker
            id="logic-arrow-hot"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#c4b5fd" />
          </marker>
        </defs>

        {sortedAxes.map((axis) => {
          const related = axisRelated(axis);
          return (
            <g
              key={axis.key}
              className={
                related ? 'logic-axis-group is-related' : 'logic-axis-group is-dimmed'
              }
            >
              <path
                className="logic-noodle-hit"
                d={axis.d}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onFocusLink?.(axis.linkId);
                }}
              />
              <path
                className={`logic-noodle logic-noodle--axis${
                  screenFocusActive
                    ? related
                      ? ' is-related'
                      : ' is-dimmed'
                    : ''
                }`}
                d={axis.d}
                fill="none"
                markerEnd={
                  screenFocusActive
                    ? related
                      ? 'url(#logic-arrow-hot)'
                      : 'url(#logic-arrow-dim)'
                    : 'url(#logic-arrow)'
                }
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onFocusLink?.(axis.linkId);
                }}
              />
            </g>
          );
        })}

        {noodles.map(({ edge, start, end }) => (
          <g key={`${edge.id}`}>
            <path
              className="logic-noodle"
              d={bezierPath(start.x, start.y, end.x, end.y, 'right')}
              fill="none"
              markerEnd="url(#logic-arrow)"
            />
            {edge.when ? (
              <text
                className="logic-noodle-label"
                x={(start.x + end.x) / 2}
                y={(start.y + end.y) / 2 - 8}
                textAnchor="middle"
              >
                {edge.when}
              </text>
            ) : null}
          </g>
        ))}
        {dragLink && (
          <path
            className="logic-noodle logic-noodle--draft"
            d={bezierPath(
              dragLink.startX,
              dragLink.startY,
              dragLink.cursorX,
              dragLink.cursorY,
              'right',
            )}
            fill="none"
            markerEnd="url(#logic-arrow)"
          />
        )}
      </svg>

      {sortedAxes.map((axis) => {
        const related = axisRelated(axis);
        return (
          <button
            key={`mid-${axis.key}`}
            type="button"
            className={`logic-mid-handle${
              screenFocusActive && !related ? ' is-dimmed' : ''
            }`}
            style={{ left: axis.mid.x, top: axis.mid.y }}
            title="Adicionar passo no caminho"
            aria-label="Adicionar passo no caminho"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAddMenu({
                x: axis.mid.x,
                y: axis.mid.y,
                prototypeLinkId: axis.linkId,
                mode: 'insert-on-path',
              });
            }}
          >
            +
          </button>
        );
      })}

      {livePositions.map((p) => {
        const selected = p.nodeId === selectedNodeId;
        const hover = p.nodeId === hoverTargetId;
        const link = p.prototypeLinkId
          ? linkById.get(p.prototypeLinkId)
          : null;
        const screenDimmed =
          screenFocusActive &&
          link &&
          link.fromScreenId !== selectedScreenId &&
          link.toScreenId !== selectedScreenId;
        const dimmed =
          (focusedWorkflowId &&
            p.workflowId !== focusedWorkflowId &&
            !selected) ||
          screenDimmed;
        const kind = p.node.kind;
        return (
          <div
            key={p.nodeId}
            className={`logic-node${selected ? ' is-selected' : ''}${
              hover ? ' is-drop-target' : ''
            }${dimmed ? ' is-dimmed' : ''}`}
            style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              e.preventDefault();
              onSelectNode?.(p.nodeId, p.workflowId, p.interactionId);
              const zoom =
                e.currentTarget.getBoundingClientRect().width / NODE_W || 1;
              setAddMenu(null);
              setDragMove({
                nodeId: p.nodeId,
                workflowId: p.workflowId,
                originX: p.x,
                originY: p.y,
                x: p.x,
                y: p.y,
                startClientX: e.clientX,
                startClientY: e.clientY,
                zoom,
              });
            }}
          >
            {p.label ? (
              <span className="logic-node-flow">{p.label}</span>
            ) : null}
            <span className="logic-node-kind">
              {WORKFLOW_KIND_LABEL[kind] || kind}
            </span>
            <span className="logic-node-name">{p.node.name}</span>
            {!p.prototypeLinkId && (
              <button
                type="button"
                className="logic-node-plus"
                title="Ligar / adicionar passo"
                aria-label="Ligar ou adicionar passo"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectNode?.(p.nodeId, p.workflowId, p.interactionId);
                  const start = edgePoint(nodeBox(p), 'right');
                  const world =
                    clientToWorldRef.current?.(e.clientX, e.clientY) || start;
                  setDragLink({
                    fromNodeId: p.nodeId,
                    workflowId: p.workflowId,
                    startX: start.x,
                    startY: start.y,
                    cursorX: world.x,
                    cursorY: world.y,
                  });
                }}
              >
                +
              </button>
            )}
          </div>
        );
      })}

      {addMenu && (
        <div
          className="logic-add-menu"
          style={{ left: addMenu.x, top: addMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="logic-add-menu-title">
            {addMenu.mode === 'insert-on-path'
              ? 'Adicionar no caminho'
              : 'Adicionar passo'}
          </div>
          {(addMenu.mode === 'insert-on-path'
            ? WORKFLOW_KINDS.filter((k) => k !== 'navigate')
            : WORKFLOW_KINDS
          ).map((kind) => (
            <button
              key={kind}
              type="button"
              className="logic-add-menu-item"
              onClick={() => {
                if (addMenu.mode === 'insert-on-path' && addMenu.prototypeLinkId) {
                  onInsertOnPrototype?.(addMenu.prototypeLinkId, kind);
                } else {
                  onAddNodeAt?.(
                    kind,
                    addMenu.x,
                    addMenu.y,
                    addMenu.fromNodeId,
                    addMenu.workflowId,
                  );
                }
                setAddMenu(null);
              }}
            >
              {WORKFLOW_KIND_LABEL[kind] || kind}
            </button>
          ))}
          <button
            type="button"
            className="logic-add-menu-item logic-add-menu-cancel"
            onClick={() => setAddMenu(null)}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
