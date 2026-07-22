/**
 * Popup de configuração de link de protótipo (estilo Figma).
 */
export default function InteractionPopup({
  open,
  link,
  screens = [],
  anchor = null,
  onClose,
  onChange,
  onDelete,
}) {
  if (!open || !link) return null;

  const others = (screens || []).filter((s) => s.id !== link.fromScreenId);
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

      <label className="interaction-field">
        <span>Gatilho</span>
        <select className="prop-select" value="onClick" disabled>
          <option value="onClick">Ao clicar</option>
        </select>
      </label>

      <label className="interaction-field">
        <span>Ação</span>
        <select className="prop-select" value="navigate" disabled>
          <option value="navigate">Navegue até</option>
        </select>
      </label>

      <label className="interaction-field">
        <span>Destino</span>
        <select
          className="prop-select"
          value={link.toScreenId}
          onChange={(e) => onChange?.({ toScreenId: e.target.value })}
        >
          {others.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
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
        className="interaction-popup-delete"
        onClick={() => onDelete?.(link.id)}
      >
        Remover link
      </button>
    </div>
  );
}
