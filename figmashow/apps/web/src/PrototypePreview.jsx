import { useCallback, useEffect, useState } from 'react';
import { findNodeById } from '@figmashow/core/schema';
import { resolveInstanceTree } from '@figmashow/core/components';
import { BoardNodeView } from './boardNodeView.jsx';

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

const TRANSITION_MS = {
  dissolve: 220,
  slide_left: 280,
  slide_right: 280,
  push: 300,
};

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
  const [animClass, setAnimClass] = useState('');

  const screen = screens.find((s) => s.id === currentId);

  const navigateTo = useCallback(
    (toScreenId, transition = 'instant') => {
      if (!toScreenId || toScreenId === currentId) return;
      const ms = TRANSITION_MS[transition];
      if (ms) {
        setAnimClass(`is-${transition}`);
        window.setTimeout(() => {
          setCurrentId(toScreenId);
          setHistory((h) => [...h, toScreenId]);
          setAnimClass('');
        }, ms);
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
      <div className={`prototype-preview-stage ${animClass}`.trim()}>
        <div
          className="prototype-preview-phone"
          style={{
            width: screen.width,
            height: screen.height,
            background: screen.background,
          }}
        >
          {visualNodes.map((node) => (
            <BoardNodeView key={node.id} node={node} />
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
