import { CANVAS_SCOPE } from '@figmashow/core/schema';

/**
 * Popup de configuração da faceta Prototype de uma Interaction.
 */
export default function InteractionPopup({
  open,
  link,
  screens = [],
  canvasNodes = [],
  anchor = null,
  onClose,
  onChange,
  onDelete,
  onExpand,
}) {
  if (!open || !link) return null;

  const others = (screens || []).filter((s) => s.id !== link.fromScreenId);
  const canvasOptions = (canvasNodes || []).filter((n) => !n.hidden);
  const destValue = link.toNodeId
    ? `canvas:${link.toNodeId}`
    : link.toScreenId;

  const style = anchor
    ? {
        left: Math.min(
          typeof window !== 'undefined' ? window.innerWidth - 280 : 400,
          Math.max(12, anchor.x),
        ),
        top: Math.min(
          typeof window !== 'undefined' ? window.innerHeight - 320 : 200,
          Math.max(12, anchor.y),
        ),
      }
    : { left: '50%', top: 120, transform: 'translateX(-50%)' };

  return (
    <div
      className="interaction-popup"
      role="dialog"
      aria-label="Interação"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="interaction-popup-head">
        <span className="interaction-popup-title">Interação</span>
        <div className="interaction-popup-head-actions">
          <button
            type="button"
            className="interaction-popup-icon"
            title="Fechar"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      <p className="prop-hint">Faceta conceitual (Prototype)</p>

      <label className="interaction-field">
        <span>Gatilho</span>
        <select className="prop-select" value="onClick" disabled>
          <option value="onClick">Ao clicar</option>
        </select>
      </label>

      <label className="interaction-field">
        <span>Ação</span>
        <select
          className="prop-select"
          value={link.toNodeId ? 'overlay' : 'navigate'}
          disabled
        >
          <option value="navigate">Navegue até</option>
          <option value="overlay">Mostrar overlay</option>
        </select>
      </label>

      <label className="interaction-field">
        <span>Destino</span>
        <select
          className="prop-select"
          value={destValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith('canvas:')) {
              const toNodeId = v.slice('canvas:'.length);
              onChange?.({
                toScreenId: CANVAS_SCOPE,
                toNodeId,
                action: 'overlay',
              });
              return;
            }
            onChange?.({
              toScreenId: v,
              toNodeId: undefined,
              action: 'navigate',
            });
          }}
        >
          <optgroup label="Telas">
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </optgroup>
          {canvasOptions.length > 0 && (
            <optgroup label="Canvas (modais)">
              {canvasOptions.map((n) => (
                <option key={n.id} value={`canvas:${n.id}`}>
                  {n.name || n.id}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      <label className="interaction-field">
        <span>Animação</span>
        <select
          className="prop-select"
          value={link.transition || 'instant'}
          onChange={(e) => onChange?.({ transition: e.target.value })}
        >
          <option value="instant">Instantâneo</option>
          <option value="dissolve">Dissolver</option>
          <option value="slide_left">Deslizar ←</option>
          <option value="slide_right">Deslizar →</option>
          <option value="push">Empurrar</option>
        </select>
      </label>

      <button
        type="button"
        className="prop-chip-btn prop-chip-btn--primary"
        onClick={() =>
          onExpand?.({
            screenId: link.fromScreenId,
            nodeId: link.triggerNodeId,
            prototypeLinkId: link.id,
            toScreenId: link.toNodeId ? null : link.toScreenId,
            overlayNodeId: link.toNodeId || null,
            transition: link.transition,
          })
        }
      >
        Expandir fluxo lógico
      </button>

      <button
        type="button"
        className="interaction-popup-delete"
        onClick={() => onDelete?.(link.id)}
      >
        Remover link
      </button>
    </div>
  );
}
