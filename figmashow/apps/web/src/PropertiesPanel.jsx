/**
 * Painel de propriedades — edição do nó selecionado.
 */

function Field({ label, children }) {
  return (
    <label className="prop-field">
      <span className="prop-label">{label}</span>
      {children}
    </label>
  );
}

export default function PropertiesPanel({ node, multiCount = 0, onChange }) {
  if (multiCount > 1) {
    return (
      <div className="props-panel">
        <div className="props-title">Propriedades</div>
        <p className="props-empty">{multiCount} itens selecionados</p>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="props-panel">
        <div className="props-title">Propriedades</div>
        <p className="props-empty">Selecione um objeto</p>
      </div>
    );
  }

  const set = (patch) => onChange?.(patch);

  return (
    <div className="props-panel">
      <div className="props-title">Propriedades</div>
      <div className="props-type">{node.type}</div>

      <Field label="Nome">
        <input
          type="text"
          value={node.name || ''}
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>

      <div className="prop-row">
        <Field label="X">
          <input
            type="number"
            value={Math.round(node.x)}
            onChange={(e) => set({ x: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Y">
          <input
            type="number"
            value={Math.round(node.y)}
            onChange={(e) => set({ y: Number(e.target.value) || 0 })}
          />
        </Field>
      </div>
      <div className="prop-row">
        <Field label="W">
          <input
            type="number"
            min={1}
            value={Math.round(node.w)}
            onChange={(e) =>
              set({ w: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </Field>
        <Field label="H">
          <input
            type="number"
            min={1}
            value={Math.round(node.h)}
            onChange={(e) =>
              set({ h: Math.max(1, Number(e.target.value) || 1) })
            }
          />
        </Field>
      </div>

      {(node.type === 'rect' ||
        node.type === 'button' ||
        node.type === 'image') && (
        <Field label={node.type === 'button' ? 'Fill' : 'Cor'}>
          <input
            type="color"
            value={
              node.type === 'button'
                ? node.fill || '#1B355A'
                : node.fill || '#CCCCCC'
            }
            onChange={(e) => set({ fill: e.target.value })}
          />
        </Field>
      )}

      {node.type === 'rect' && (
        <>
          <Field label="Radius">
            <input
              type="number"
              min={0}
              value={node.cornerRadius ?? 0}
              onChange={(e) =>
                set({ cornerRadius: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </Field>
          <Field label="Opacidade">
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={node.opacity ?? 1}
              onChange={(e) => {
                const v = Number(e.target.value);
                set({
                  opacity: Number.isFinite(v)
                    ? Math.min(1, Math.max(0, v))
                    : 1,
                });
              }}
            />
          </Field>
        </>
      )}

      {node.type === 'text' && (
        <>
          <Field label="Texto">
            <textarea
              rows={3}
              value={node.text || ''}
              onChange={(e) => set({ text: e.target.value })}
            />
          </Field>
          <Field label="Cor">
            <input
              type="color"
              value={node.color || '#1A1D21'}
              onChange={(e) => set({ color: e.target.value })}
            />
          </Field>
          <div className="prop-row">
            <Field label="Size">
              <input
                type="number"
                min={1}
                value={node.fontSize || 16}
                onChange={(e) =>
                  set({ fontSize: Math.max(1, Number(e.target.value) || 16) })
                }
              />
            </Field>
            <Field label="Weight">
              <input
                type="number"
                min={100}
                step={100}
                value={node.fontWeight || 400}
                onChange={(e) =>
                  set({
                    fontWeight: Math.max(100, Number(e.target.value) || 400),
                  })
                }
              />
            </Field>
          </div>
        </>
      )}

      {node.type === 'button' && (
        <>
          <Field label="Label">
            <input
              type="text"
              value={node.label || ''}
              onChange={(e) => set({ label: e.target.value })}
            />
          </Field>
          <Field label="Texto">
            <input
              type="color"
              value={node.textColor || '#FFFFFF'}
              onChange={(e) => set({ textColor: e.target.value })}
            />
          </Field>
          <Field label="Radius">
            <input
              type="number"
              min={0}
              value={node.cornerRadius ?? 0}
              onChange={(e) =>
                set({ cornerRadius: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </Field>
        </>
      )}
    </div>
  );
}
