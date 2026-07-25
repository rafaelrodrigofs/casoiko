import { useCallback, useEffect, useState } from 'react';
import { findNodeById } from '@figmashow/core/schema';
import {
  findInteractionByTrigger,
  findWorkflowForInteraction,
  simulateWorkflow,
} from '@figmashow/core/domain';
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

const ANIM_CLASS = {
  dissolve: 'is-dissolving',
  slide_left: 'is-slide_left',
  slide_right: 'is-slide_right',
  push: 'is-push',
};

export default function PrototypePreview({
  screens,
  prototypes = [],
  domain = null,
  components = [],
  startScreenId,
  onClose,
}) {
  const [currentId, setCurrentId] = useState(startScreenId);
  const [history, setHistory] = useState(() =>
    startScreenId ? [startScreenId] : [],
  );
  const [animClass, setAnimClass] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [screenState, setScreenState] = useState({});
  const [trace, setTrace] = useState([]);

  const screen = screens.find((s) => s.id === currentId);

  const navigateTo = useCallback(
    (toScreenId, transition = 'instant') => {
      if (!toScreenId || toScreenId === currentId) return;
      const ms = TRANSITION_MS[transition];
      const cls = ANIM_CLASS[transition];
      if (ms && cls) {
        setAnimClass(cls);
        window.setTimeout(() => {
          setCurrentId(toScreenId);
          setHistory((h) => [...h, toScreenId]);
          setAnimClass('');
          setScreenState({});
        }, ms);
      } else {
        setCurrentId(toScreenId);
        setHistory((h) => [...h, toScreenId]);
        setScreenState({});
      }
    },
    [currentId],
  );

  const runWorkflow = useCallback(
    (workflow) => {
      setLoading(true);
      setToast(null);
      window.setTimeout(() => {
        const result = simulateWorkflow(workflow);
        setTrace(result.steps || []);
        setLoading(false);
        if (result.statePatches) {
          setScreenState((s) => ({ ...s, ...result.statePatches }));
        }
        if (result.outcome === 'navigate' && result.navigate?.toScreenId) {
          navigateTo(
            result.navigate.toScreenId,
            result.navigate.transition || 'instant',
          );
        } else if (result.outcome === 'message') {
          setToast(result.message || 'Mensagem');
        }
      }, 280);
    },
    [navigateTo],
  );

  const handleTrigger = useCallback(
    (nodeId) => {
      const ix = findInteractionByTrigger(domain, currentId, nodeId);
      if (ix?.workflowId) {
        const wf = findWorkflowForInteraction(domain, ix.id);
        if (wf) {
          runWorkflow(wf);
          return;
        }
      }
      const link = prototypes.find(
        (p) => p.fromScreenId === currentId && p.triggerNodeId === nodeId,
      );
      if (link) navigateTo(link.toScreenId, link.transition || 'instant');
    },
    [currentId, domain, navigateTo, prototypes, runWorkflow],
  );

  const goBack = () => {
    if (history.length <= 1) return;
    const next = history.slice(0, -1);
    setHistory(next);
    setCurrentId(next[next.length - 1]);
    setToast(null);
    setTrace([]);
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
  const interactionsOnScreen = (domain?.interactions || []).filter(
    (ix) => ix.trigger?.screenId === currentId && ix.workflowId,
  );
  const triggerIds = new Set([
    ...linksOnScreen.map((p) => p.triggerNodeId),
    ...interactionsOnScreen.map((ix) => ix.trigger.nodeId),
  ]);
  const visualNodes = collectVisualNodes(screen.nodes, components);
  const triggers = collectTriggerNodes(screen.nodes).filter((n) =>
    triggerIds.has(n.id),
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
          {loading && (
            <div className="prototype-preview-loading">Carregando…</div>
          )}
          {toast && (
            <div className="prototype-preview-toast" role="status">
              {toast}
            </div>
          )}
          {screenState.status && (
            <div className="prototype-preview-state">
              status: {String(screenState.status)}
            </div>
          )}
        </div>
      </div>
      {trace.length > 0 && (
        <div className="prototype-preview-trace" aria-label="Trace do fluxo">
          {trace.map((s, i) => (
            <span key={`${s.nodeId}-${i}`}>
              {s.name}
              {i < trace.length - 1 ? ' → ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
