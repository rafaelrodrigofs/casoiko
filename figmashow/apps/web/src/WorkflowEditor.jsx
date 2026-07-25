import { useEffect, useMemo, useState } from 'react';
import {
  WORKFLOW_KINDS,
  WORKFLOW_KIND_LABEL,
} from '@figmashow/core/domain';

const NODE_CATALOG = [
  {
    id: 'flow',
    label: 'Fluxo',
    items: [
      {
        kind: 'validate',
        title: 'Validar',
        description: 'Checa campos e regras antes de seguir',
        accent: '#f59e0b',
        glyph: 'Va',
      },
      {
        kind: 'branch',
        title: 'Condição',
        description: 'Bifurca em sucesso ou erro',
        accent: '#22c55e',
        glyph: 'If',
      },
      {
        kind: 'navigate',
        title: 'Navegar',
        description: 'Abre outra tela do protótipo',
        accent: '#3b82f6',
        glyph: 'Go',
      },
    ],
  },
  {
    id: 'data',
    label: 'Dados e ação',
    items: [
      {
        kind: 'apiCall',
        title: 'API',
        description: 'Chama um endpoint lógico (mock no Apresentar)',
        accent: '#a78bfa',
        glyph: 'API',
      },
      {
        kind: 'setState',
        title: 'Estado',
        description: 'Grava uma chave/valor no estado do fluxo',
        accent: '#38bdf8',
        glyph: 'St',
      },
      {
        kind: 'showMessage',
        title: 'Mensagem',
        description: 'Mostra feedback ao usuário',
        accent: '#f472b6',
        glyph: 'Msg',
      },
    ],
  },
];

function catalogItemForKind(kind) {
  for (const cat of NODE_CATALOG) {
    const found = cat.items.find((i) => i.kind === kind);
    if (found) return found;
  }
  return {
    kind,
    title: WORKFLOW_KIND_LABEL[kind] || kind,
    description: '',
    accent: '#a78bfa',
    glyph: '•',
  };
}

/**
 * Drawer lateral estilo n8n: catálogo “o que vem depois?” ou parâmetros do nó.
 */
export default function WorkflowEditor({
  open,
  interaction,
  workflow,
  selectedNodeId,
  apis = [],
  screens = [],
  onClose,
  onChangeWorkflow,
  onChangeApi,
  onSelectNode,
  onAddNode,
}) {
  const [query, setQuery] = useState('');
  const [forceCatalog, setForceCatalog] = useState(false);

  useEffect(() => {
    if (selectedNodeId) setForceCatalog(false);
  }, [selectedNodeId]);

  const selected = useMemo(
    () => (workflow?.nodes || []).find((n) => n.id === selectedNodeId) || null,
    [workflow, selectedNodeId],
  );

  const apiForNode = useMemo(() => {
    if (selected?.kind !== 'apiCall') return null;
    const apiId = selected.config?.apiId;
    return (apis || []).find((a) => a.id === apiId) || null;
  }, [selected, apis]);

  const showCatalog = forceCatalog || !selected;

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NODE_CATALOG.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => {
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.kind.toLowerCase().includes(q)
        );
      }),
    })).filter((cat) => cat.items.length > 0);
  }, [query]);

  if (!open) return null;

  const patchNode = (nodeId, patch) => {
    if (!workflow) return;
    const nodes = (workflow.nodes || []).map((n) => {
      if (n.id !== nodeId) return n;
      return {
        ...n,
        ...patch,
        config: { ...(n.config || {}), ...(patch.config || {}) },
      };
    });
    onChangeWorkflow?.({ ...workflow, nodes });
  };

  const removeNode = (nodeId) => {
    if (!workflow) return;
    const nodes = (workflow.nodes || []).filter((n) => n.id !== nodeId);
    if (!nodes.length) return;
    const incoming = (workflow.edges || []).filter((e) => e.to === nodeId);
    const outgoing = (workflow.edges || []).filter((e) => e.from === nodeId);
    let edges = (workflow.edges || []).filter(
      (e) => e.from !== nodeId && e.to !== nodeId,
    );
    for (const inn of incoming) {
      for (const out of outgoing) {
        edges.push({
          id: `we_${Math.random().toString(36).slice(2, 9)}`,
          from: inn.from,
          to: out.to,
          when: out.when || inn.when,
        });
      }
    }
    const entryNodeId =
      workflow.entryNodeId === nodeId ? nodes[0].id : workflow.entryNodeId;
    onChangeWorkflow?.({ ...workflow, nodes, edges, entryNodeId });
    onSelectNode?.(nodes[0]?.id || null);
    setForceCatalog(false);
  };

  const flowTitle = interaction?.name || workflow?.name || 'Fluxo';

  if (!workflow) {
    return (
      <aside className="logic-drawer" role="complementary">
        <header className="logic-drawer-head">
          <div>
            <h2 className="logic-drawer-title">Fluxo lógico</h2>
            <p className="logic-drawer-sub">Workflow não encontrado</p>
          </div>
          <button
            type="button"
            className="logic-drawer-close"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>
      </aside>
    );
  }

  const meta = selected ? catalogItemForKind(selected.kind) : null;

  return (
    <aside
      className="logic-drawer"
      role="complementary"
      aria-label="Camada lógica"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="logic-drawer-head">
        <div className="logic-drawer-head-text">
          {showCatalog ? (
            <>
              <h2 className="logic-drawer-title">O que vem depois?</h2>
              <p className="logic-drawer-sub">{flowTitle}</p>
            </>
          ) : (
            <>
              <button
                type="button"
                className="logic-drawer-back"
                onClick={() => {
                  setForceCatalog(true);
                  onSelectNode?.(null);
                }}
              >
                ← Adicionar passo
              </button>
              <h2 className="logic-drawer-title">{meta?.title || 'Passo'}</h2>
              <p className="logic-drawer-sub">{flowTitle}</p>
            </>
          )}
        </div>
        <button
          type="button"
          className="logic-drawer-close"
          aria-label="Voltar ao conceitual"
          title="Voltar ao conceitual"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      {showCatalog ? (
        <div className="logic-drawer-body">
          <label className="logic-drawer-search">
            <svg
              className="logic-drawer-search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path
                d="M20 20l-3.5-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              placeholder="Buscar passos…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <div className="logic-drawer-catalog">
            {filteredCatalog.map((cat) => (
              <section key={cat.id} className="logic-drawer-cat">
                <h3 className="logic-drawer-cat-label">{cat.label}</h3>
                <ul className="logic-drawer-cat-list">
                  {cat.items.map((item) => (
                    <li key={item.kind}>
                      <button
                        type="button"
                        className="logic-drawer-item"
                        onClick={() => {
                          onAddNode?.(item.kind);
                          setForceCatalog(false);
                          setQuery('');
                        }}
                      >
                        <span
                          className="logic-drawer-item-icon"
                          style={{
                            '--logic-accent': item.accent,
                          }}
                        >
                          {item.glyph}
                        </span>
                        <span className="logic-drawer-item-text">
                          <span className="logic-drawer-item-title">
                            {item.title}
                          </span>
                          <span className="logic-drawer-item-desc">
                            {item.description}
                          </span>
                        </span>
                        <span className="logic-drawer-item-chevron" aria-hidden>
                          &gt;
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {!filteredCatalog.length && (
              <p className="logic-drawer-empty">Nenhum passo encontrado.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="logic-drawer-body logic-drawer-body--params">
          <div className="logic-drawer-node-card">
            <span
              className="logic-drawer-item-icon logic-drawer-item-icon--lg"
              style={{ '--logic-accent': meta?.accent }}
            >
              {meta?.glyph}
            </span>
            <div>
              <div className="logic-drawer-node-kind">
                {WORKFLOW_KIND_LABEL[selected.kind] || selected.kind}
              </div>
              <div className="logic-drawer-node-hint">{meta?.description}</div>
            </div>
          </div>

          <div className="logic-drawer-fields">
            <label className="logic-field">
              <span>Nome</span>
              <input
                className="logic-field-input"
                value={selected.name}
                onChange={(e) =>
                  patchNode(selected.id, { name: e.target.value })
                }
              />
            </label>

            <label className="logic-field">
              <span>Tipo</span>
              <select
                className="logic-field-input"
                value={selected.kind}
                onChange={(e) =>
                  patchNode(selected.id, { kind: e.target.value })
                }
              >
                {WORKFLOW_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {WORKFLOW_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>

            {(selected.kind === 'validate' || selected.kind === 'apiCall') && (
              <label className="logic-field">
                <span>Simular no Apresentar</span>
                <select
                  className="logic-field-input"
                  value={selected.config?.simulate || 'success'}
                  onChange={(e) =>
                    patchNode(selected.id, {
                      config: { simulate: e.target.value },
                    })
                  }
                >
                  <option value="success">Sucesso</option>
                  <option value="error">Erro</option>
                </select>
              </label>
            )}

            {selected.kind === 'apiCall' && (
              <>
                <div className="logic-field">
                  <span>API lógica</span>
                  <code className="logic-field-code">
                    {selected.config?.apiId || '—'}
                  </code>
                </div>
                {apiForNode && (
                  <>
                    <label className="logic-field">
                      <span>Método</span>
                      <select
                        className="logic-field-input"
                        value={apiForNode.method}
                        onChange={(e) =>
                          onChangeApi?.({
                            ...apiForNode,
                            method: e.target.value,
                          })
                        }
                      >
                        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="logic-field">
                      <span>Path</span>
                      <input
                        className="logic-field-input"
                        value={apiForNode.path}
                        onChange={(e) =>
                          onChangeApi?.({
                            ...apiForNode,
                            path: e.target.value,
                          })
                        }
                      />
                    </label>
                  </>
                )}
              </>
            )}

            {selected.kind === 'navigate' && (
              <>
                <label className="logic-field">
                  <span>Destino</span>
                  <select
                    className="logic-field-input"
                    value={selected.config?.toScreenId || ''}
                    onChange={(e) =>
                      patchNode(selected.id, {
                        config: { toScreenId: e.target.value },
                      })
                    }
                  >
                    <option value="">—</option>
                    {screens.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="logic-field">
                  <span>Transição</span>
                  <select
                    className="logic-field-input"
                    value={selected.config?.transition || 'instant'}
                    onChange={(e) =>
                      patchNode(selected.id, {
                        config: { transition: e.target.value },
                      })
                    }
                  >
                    <option value="instant">Instantâneo</option>
                    <option value="dissolve">Dissolver</option>
                    <option value="slide_left">Deslizar ←</option>
                    <option value="slide_right">Deslizar →</option>
                    <option value="push">Empurrar</option>
                  </select>
                </label>
              </>
            )}

            {selected.kind === 'showMessage' && (
              <label className="logic-field">
                <span>Mensagem</span>
                <input
                  className="logic-field-input"
                  value={selected.config?.message || ''}
                  onChange={(e) =>
                    patchNode(selected.id, {
                      config: { message: e.target.value },
                    })
                  }
                />
              </label>
            )}

            {selected.kind === 'setState' && (
              <>
                <label className="logic-field">
                  <span>Chave</span>
                  <input
                    className="logic-field-input"
                    value={selected.config?.key || ''}
                    onChange={(e) =>
                      patchNode(selected.id, {
                        config: { key: e.target.value },
                      })
                    }
                  />
                </label>
                <label className="logic-field">
                  <span>Valor</span>
                  <input
                    className="logic-field-input"
                    value={String(selected.config?.value ?? '')}
                    onChange={(e) =>
                      patchNode(selected.id, {
                        config: { value: e.target.value },
                      })
                    }
                  />
                </label>
              </>
            )}
          </div>

          <div className="logic-drawer-footer">
            <button
              type="button"
              className="logic-drawer-danger"
              disabled={(workflow.nodes || []).length <= 1}
              onClick={() => removeNode(selected.id)}
            >
              Remover passo
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
