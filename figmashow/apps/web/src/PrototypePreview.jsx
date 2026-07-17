import { useCallback, useEffect, useState } from 'react';
import { findNodeById } from '@figmashow/core/schema';
import { resolveInstanceTree } from '@figmashow/core/components';

function colorWithOpacity(color, opacity = 1) {
  const raw = String(color || '').trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  const alpha = Math.min(1, Math.max(0, Number(opacity) || 1));
  if (!match || alpha >= 1) return raw;
  const hex =
    match[1].length === 3
      ? [...match[1]].map((d) => `${d}${d}`).join('')
      : match[1];
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function PreviewNode({ node }) {
  const style = {
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: node.w,
    height: node.h,
    opacity: node.opacity ?? 1,
    boxSizing: 'border-box',
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    transformOrigin: '50% 50%',
    pointerEvents: 'none',
  };

  if (node.type === 'text') {
    return (
      <div
        style={{
          ...style,
          color: node.color,
          fontSize: node.fontSize,
          fontWeight: node.fontWeight,
          textAlign: node.align || 'left',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {node.text}
      </div>
    );
  }

  if (node.type === 'button') {
    return (
      <div
        style={{
          ...style,
          background: colorWithOpacity(node.fill, node.fillOpacity ?? 1),
          color: node.textColor,
          borderRadius: node.cornerRadius,
          fontSize: node.fontSize,
          fontWeight: node.fontWeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {node.iconSrc ? (
          <img src={node.iconSrc} alt="" style={{ width: 20, height: 20 }} />
        ) : null}
        <span>{node.label}</span>
      </div>
    );
  }

  if (node.type === 'image') {
    return (
      <div style={style}>
        <img
          src={node.src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: node.fit || 'contain',
            display: 'block',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...style,
        background: colorWithOpacity(node.fill, node.fillOpacity ?? 1),
        borderRadius: node.cornerRadius || 0,
      }}
    />
  );
}

function collectVisualNodes(nodes, components, out = []) {
  for (const node of nodes || []) {
    if (node.hidden) continue;
    if (node.type === 'group' || node.type === 'component') {
      collectVisualNodes(node.children, components, out);
    } else if (node.type === 'instance') {
      const resolved = resolveInstanceTree(node, components);
      if (resolved.type === 'group' || resolved.type === 'component') {
        collectVisualNodes(resolved.children, components, out);
      } else {
        out.push(resolved);
      }
    } else {
      out.push(node);
    }
  }
  return out;
}

/** Nós clicáveis (raiz + instâncias) para protótipo. */
function collectTriggerNodes(nodes, out = []) {
  for (const node of nodes || []) {
    if (node.hidden) continue;
    if (node.type === 'group' || node.type === 'component') {
      collectTriggerNodes(node.children, out);
    } else {
      out.push(node);
    }
  }
  return out;
}

export default function PrototypePreview({
  screens,
  prototypes = [],
  components = [],
  startScreenId,
  onClose,
}) {
  const [currentId, setCurrentId] = useState(startScreenId);
  const [history, setHistory] = useState(() =>
    startScreenId ? [startScreenId] : [],
  );
  const [dissolving, setDissolving] = useState(false);

  const screen = screens.find((s) => s.id === currentId);

  const navigateTo = useCallback(
    (toScreenId, transition = 'instant') => {
      if (!toScreenId || toScreenId === currentId) return;
      if (transition === 'dissolve') {
        setDissolving(true);
        window.setTimeout(() => {
          setCurrentId(toScreenId);
          setHistory((h) => [...h, toScreenId]);
          setDissolving(false);
        }, 220);
      } else {
        setCurrentId(toScreenId);
        setHistory((h) => [...h, toScreenId]);
      }
    },
    [currentId],
  );

  const handleTrigger = useCallback(
    (nodeId) => {
      const link = prototypes.find(
        (p) => p.fromScreenId === currentId && p.triggerNodeId === nodeId,
      );
      if (link) navigateTo(link.toScreenId, link.transition || 'instant');
    },
    [currentId, navigateTo, prototypes],
  );

  const goBack = () => {
    if (history.length <= 1) return;
    const next = history.slice(0, -1);
    setHistory(next);
    setCurrentId(next[next.length - 1]);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!screen) {
    return (
      <div className="prototype-preview-overlay" role="dialog" aria-modal="true">
        <div className="prototype-preview-modal">
          <p>Nenhuma tela para apresentar.</p>
          <button type="button" className="tool-btn" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const linksOnScreen = prototypes.filter((p) => p.fromScreenId === currentId);
  const linkByNode = new Map(
    linksOnScreen.map((p) => [p.triggerNodeId, p]),
  );
  const visualNodes = collectVisualNodes(screen.nodes, components);
  const triggers = collectTriggerNodes(screen.nodes).filter((n) =>
    linkByNode.has(n.id),
  );

  return (
    <div
      className="prototype-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Apresentação de protótipo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="prototype-preview-chrome">
        <button
          type="button"
          className="tool-btn"
          disabled={history.length <= 1}
          onClick={goBack}
        >
          ← Voltar
        </button>
        <span className="prototype-preview-title">{screen.name}</span>
        <button type="button" className="tool-btn" onClick={onClose}>
          Fechar (Esc)
        </button>
      </div>
      <div
        className={`prototype-preview-stage${dissolving ? ' is-dissolving' : ''}`}
      >
        <div
          className="prototype-preview-phone"
          style={{
            width: screen.width,
            height: screen.height,
            background: screen.background,
          }}
        >
          {visualNodes.map((node) => (
            <PreviewNode key={node.id} node={node} />
          ))}
          {triggers.map((node) => {
            const n = findNodeById(screen.nodes, node.id) || node;
            return (
              <button
                key={`trigger-${node.id}`}
                type="button"
                className="prototype-preview-trigger"
                style={{
                  left: n.x,
                  top: n.y,
                  width: n.w,
                  height: n.h,
                  transform: n.rotation
                    ? `rotate(${n.rotation}deg)`
                    : undefined,
                  transformOrigin: '50% 50%',
                }}
                onClick={() => handleTrigger(node.id)}
                aria-label="Navegar protótipo"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
