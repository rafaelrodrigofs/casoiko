/**
 * Painel de propriedades — visual estilo Figma.
 */

import { useEffect, useRef, useState } from 'react';
import { normalizeConstraints } from '@figmashow/core/schema';

function typeLabel(type) {
  if (type === 'rect') return 'Retângulo';
  if (type === 'text') return 'Texto';
  if (type === 'button') return 'Botão';
  if (type === 'image') return 'Imagem';
  if (type === 'group') return 'Grupo';
  if (type === 'component') return 'Componente';
  if (type === 'instance') return 'Instância';
  if (type === 'screen') return 'Tela';
  return type || 'Objeto';
}

function displayName(node) {
  if (node.name) return node.name;
  if (node.type === 'text' && node.text) {
    const t = String(node.text).replace(/\s+/g, ' ').trim();
    return t.length > 24 ? `${t.slice(0, 24)}…` : t;
  }
  if (node.type === 'button' && node.label) return node.label;
  return typeLabel(node.type);
}

function normalizeHex(value, fallback = '#CCCCCC') {
  const raw = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const s = raw.slice(1);
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toUpperCase();
  }
  return fallback.toUpperCase();
}

function PropSection({ title, trailing, children }) {
  return (
    <section className="prop-section">
      {(title || trailing) && (
        <div className="prop-section-head">
          {title ? <span className="prop-section-title">{title}</span> : <span />}
          {trailing}
        </div>
      )}
      <div className="prop-section-body">{children}</div>
    </section>
  );
}

function InlineInput({
  label,
  value,
  onChange,
  type = 'number',
  min,
  max,
  step,
  suffix,
  disabled,
}) {
  const [draft, setDraft] = useState(String(value ?? ''));
  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [value]);
  const commit = () => onChange?.(draft);
  return (
    <label className={`prop-inline${disabled ? ' is-disabled' : ''}`}>
      {label ? <span className="prop-inline-label">{label}</span> : null}
      <input
        type={type}
        value={draft}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setDraft(String(value ?? ''));
            e.currentTarget.blur();
          }
        }}
        onBlur={commit}
      />
      {suffix ? <span className="prop-inline-suffix">{suffix}</span> : null}
    </label>
  );
}

function DraftTextField({ value, onCommit, textarea = false, ...props }) {
  const [draft, setDraft] = useState(String(value ?? ''));
  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [value]);
  const commit = () => onCommit?.(draft);
  const inputProps = {
    ...props,
    value: draft,
    onChange: (event) => setDraft(event.target.value),
    onBlur: commit,
    onKeyDown: (event) => {
      if (event.key === 'Escape') {
        setDraft(String(value ?? ''));
        event.currentTarget.blur();
      }
      if (!textarea && event.key === 'Enter') {
        event.preventDefault();
        commit();
        event.currentTarget.blur();
      }
    },
  };
  return textarea ? <textarea {...inputProps} /> : <input {...inputProps} />;
}

function IconBtn({ title, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      className={`prop-icon-btn${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function FillRow({
  color,
  opacity = 1,
  empty = false,
  onColorCommit,
  onColorPreview,
  onColorPreviewCancel,
  onOpacityCommit,
  onOpacityPreview,
  onOpacityPreviewCancel,
  showOpacity = true,
}) {
  const hex = normalizeHex(color);
  const [hexDraft, setHexDraft] = useState(hex.replace('#', ''));
  const [opacityDraft, setOpacityDraft] = useState(
    String(Math.round((opacity ?? 1) * 100)),
  );
  const colorInputRef = useRef(null);
  const colorPreviewActiveRef = useRef(false);
  const hexPreviewActiveRef = useRef(false);
  const opacityPreviewActiveRef = useRef(false);

  useEffect(() => {
    setHexDraft(hex.replace('#', ''));
  }, [hex]);

  useEffect(() => {
    setOpacityDraft(String(Math.round((opacity ?? 1) * 100)));
  }, [opacity]);

  // React trata alguns eventos "input" do color como onChange. O listener
  // nativo de "change" só confirma quando o seletor é fechado.
  useEffect(() => {
    const input = colorInputRef.current;
    if (!input) return undefined;
    const commit = (event) => {
      colorPreviewActiveRef.current = false;
      onColorCommit?.(normalizeHex(event.target.value, hex));
    };
    input.addEventListener('change', commit);
    return () => input.removeEventListener('change', commit);
  }, [hex, onColorCommit]);

  const commitHex = () => {
    const next = normalizeHex(hexDraft, hex);
    hexPreviewActiveRef.current = false;
    setHexDraft(next.replace('#', ''));
    onColorCommit?.(next);
  };

  const opacityValue = () => {
    const n = Number(opacityDraft);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n / 100)) : opacity;
  };

  const commitOpacity = () => {
    const next = opacityValue();
    opacityPreviewActiveRef.current = false;
    setOpacityDraft(String(Math.round(next * 100)));
    onOpacityCommit?.(next);
  };

  return (
    <div className="prop-fill-row">
      <label className={`prop-swatch${empty ? ' is-empty' : ''}`}>
        <span
          className="prop-swatch-chip"
          style={{
            background: hex,
            opacity: Math.min(1, Math.max(0, Number(opacity))),
          }}
        />
        <input
          ref={colorInputRef}
          type="color"
          value={hex}
          onInput={(e) => {
            colorPreviewActiveRef.current = true;
            onColorPreview?.(normalizeHex(e.currentTarget.value, hex));
          }}
          onBlur={() => {
            if (!colorPreviewActiveRef.current) return;
            colorPreviewActiveRef.current = false;
            onColorPreviewCancel?.();
          }}
        />
      </label>
      <input
        className="prop-hex"
        type="text"
        value={hexDraft}
        spellCheck={false}
        maxLength={6}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
          setHexDraft(raw);
          if (raw.length === 6) {
            hexPreviewActiveRef.current = true;
            onColorPreview?.(normalizeHex(raw, hex));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitHex();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            hexPreviewActiveRef.current = false;
            setHexDraft(hex.replace('#', ''));
            onColorPreviewCancel?.();
            e.currentTarget.blur();
          }
        }}
        onBlur={commitHex}
      />
      {showOpacity ? (
        <label className="prop-inline">
          <input
            type="number"
            value={opacityDraft}
            min={0}
            max={100}
            onChange={(e) => {
              const raw = e.target.value;
              setOpacityDraft(raw);
              const n = Number(raw);
              if (raw !== '' && Number.isFinite(n)) {
                opacityPreviewActiveRef.current = true;
                onOpacityPreview?.(Math.min(1, Math.max(0, n / 100)));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitOpacity();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                opacityPreviewActiveRef.current = false;
                setOpacityDraft(String(Math.round((opacity ?? 1) * 100)));
                onOpacityPreviewCancel?.();
                e.currentTarget.blur();
              }
            }}
            onBlur={commitOpacity}
          />
          <span className="prop-inline-suffix">%</span>
        </label>
      ) : null}
    </div>
  );
}

function IconAlignLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 2V12M5 4H12M5 7H9M5 10H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconAlignCenterH() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2V12M3 4H11M4.5 7H9.5M3.5 10H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconAlignRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M12 2V12M2 4H9M5 7H9M3 10H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconAlignTop() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 2H12M4 5V12M7 5V9M10 5V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconAlignMiddle() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7H12M4 3V11M7 4.5V9.5M10 3.5V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconAlignBottom() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 12H12M4 2V9M7 5V9M10 3V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconLock({ locked }) {
  return locked ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="3" y="6.5" width="8" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 6.5V4.5a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="3" y="6.5" width="8" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 6.5V4.5a2 2 0 0 1 3.7-.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconHide({ hidden }) {
  return hidden ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7s2.2-3.5 5-3.5S12 7 12 7s-2.2 3.5-5 3.5S2 7 2 7Z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 11.5L11 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7s2.2-3.5 5-3.5S12 7 12 7s-2.2 3.5-5 3.5S2 7 2 7Z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function AlignRow({ onAlign, onDistribute, canDistribute }) {
  return (
    <PropSection title="Alinhamento">
      <div className="prop-align-row">
        <IconBtn title="Esquerda" onClick={() => onAlign?.('left')}>
          <IconAlignLeft />
        </IconBtn>
        <IconBtn title="Centro H" onClick={() => onAlign?.('center')}>
          <IconAlignCenterH />
        </IconBtn>
        <IconBtn title="Direita" onClick={() => onAlign?.('right')}>
          <IconAlignRight />
        </IconBtn>
        <IconBtn title="Topo" onClick={() => onAlign?.('top')}>
          <IconAlignTop />
        </IconBtn>
        <IconBtn title="Meio" onClick={() => onAlign?.('middle')}>
          <IconAlignMiddle />
        </IconBtn>
        <IconBtn title="Base" onClick={() => onAlign?.('bottom')}>
          <IconAlignBottom />
        </IconBtn>
      </div>
      <div className="prop-row prop-row--gap">
        <button
          type="button"
          className="prop-chip-btn"
          disabled={!canDistribute}
          onClick={() => onDistribute?.('horizontal')}
        >
          Dist H
        </button>
        <button
          type="button"
          className="prop-chip-btn"
          disabled={!canDistribute}
          onClick={() => onDistribute?.('vertical')}
        >
          Dist V
        </button>
      </div>
    </PropSection>
  );
}

function LayerToggles({ locked, hidden, onChange }) {
  return (
    <div className="prop-layer-toggles">
      <IconBtn
        title={locked ? 'Desbloquear' : 'Bloquear'}
        active={!!locked}
        onClick={() => onChange?.({ locked: !locked || undefined })}
      >
        <IconLock locked={!!locked} />
      </IconBtn>
      <IconBtn
        title={hidden ? 'Mostrar' : 'Ocultar'}
        active={!!hidden}
        onClick={() => onChange?.({ hidden: !hidden || undefined })}
      >
        <IconHide hidden={!!hidden} />
      </IconBtn>
    </div>
  );
}

function DraftNumberInput({ label, value, min, max, step, suffix, onCommit }) {
  const [draft, setDraft] = useState(String(Math.round(Number(value) || 0)));
  useEffect(() => {
    setDraft(String(Math.round(Number(value) || 0)));
  }, [value]);

  const commit = () => {
    let n = Number(draft);
    if (!Number.isFinite(n)) n = Number(value) || 0;
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    setDraft(String(Math.round(n)));
    onCommit?.(n);
  };

  return (
    <label className="prop-inline">
      {label ? <span className="prop-inline-label">{label}</span> : null}
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setDraft(String(Math.round(Number(value) || 0)));
            e.currentTarget.blur();
          }
        }}
        onBlur={commit}
      />
      {suffix ? <span className="prop-inline-suffix">{suffix}</span> : null}
    </label>
  );
}

function ConstraintsSection({ constraints, onChange }) {
  const c = normalizeConstraints(constraints);

  const togglePin = (key) => {
    if (c[key]) {
      const next = { ...c, [key]: false };
      if ((key === 'left' || key === 'right') && !next.left && !next.right) {
        return;
      }
      if ((key === 'top' || key === 'bottom') && !next.top && !next.bottom) {
        return;
      }
      onChange?.({ constraints: normalizeConstraints(next) });
    } else {
      onChange?.({ constraints: normalizeConstraints({ ...c, [key]: true }) });
    }
  };

  return (
    <PropSection title="Restrições">
      <div className="prop-constraint-row">
        <div className="constraint-diagram" aria-label="Diagrama de restrições">
          <button
            type="button"
            className={`constraint-edge constraint-edge-left${c.left ? ' is-active' : ''}`}
            title="Esquerda"
            aria-pressed={c.left}
            onClick={() => togglePin('left')}
          />
          <button
            type="button"
            className={`constraint-edge constraint-edge-right${c.right ? ' is-active' : ''}`}
            title="Direita"
            aria-pressed={c.right}
            onClick={() => togglePin('right')}
          />
          <button
            type="button"
            className={`constraint-edge constraint-edge-top${c.top ? ' is-active' : ''}`}
            title="Topo"
            aria-pressed={c.top}
            onClick={() => togglePin('top')}
          />
          <button
            type="button"
            className={`constraint-edge constraint-edge-bottom${c.bottom ? ' is-active' : ''}`}
            title="Base"
            aria-pressed={c.bottom}
            onClick={() => togglePin('bottom')}
          />
          <span className="constraint-diagram-inner" />
        </div>
        <div className="prop-constraint-labels">
          <button
            type="button"
            className={`constraint-pin${c.left ? ' is-active' : ''}`}
            title="Esquerda"
            onClick={() => togglePin('left')}
          >
            Esq.
          </button>
          <button
            type="button"
            className={`constraint-pin${c.right ? ' is-active' : ''}`}
            title="Direita"
            onClick={() => togglePin('right')}
          >
            Dir.
          </button>
          <button
            type="button"
            className={`constraint-pin${c.top ? ' is-active' : ''}`}
            title="Topo"
            onClick={() => togglePin('top')}
          >
            Topo
          </button>
          <button
            type="button"
            className={`constraint-pin${c.bottom ? ' is-active' : ''}`}
            title="Base"
            onClick={() => togglePin('bottom')}
          >
            Base
          </button>
        </div>
      </div>
      <p className="constraint-help">
        Afeta só ao mudar L/A da tela. Linhas azuis no canvas mostram as âncoras.
      </p>
    </PropSection>
  );
}

function PrototypeSection({
  screens,
  currentScreenId,
  nodeId,
  prototypes,
  onAddLink,
  onDeleteLink,
  onEditLink,
}) {
  const [toScreenId, setToScreenId] = useState('');
  const [transition, setTransition] = useState('instant');

  const others = (screens || []).filter((s) => s.id !== currentScreenId);
  const links = (prototypes || []).filter(
    (p) => p.fromScreenId === currentScreenId && p.triggerNodeId === nodeId,
  );

  useEffect(() => {
    if (!toScreenId && others[0]) setToScreenId(others[0].id);
  }, [others, toScreenId]);

  const transitionLabel = (t) => {
    switch (t) {
      case 'dissolve':
        return 'Dissolver';
      case 'slide_left':
        return 'Deslizar ←';
      case 'slide_right':
        return 'Deslizar →';
      case 'push':
        return 'Empurrar';
      default:
        return 'Instantâneo';
    }
  };

  return (
    <PropSection title="Protótipo">
      <p className="prop-hint">
        No modo Protótipo (P), arraste o <strong>+</strong> na borda do nó até
        outro quadro.
      </p>
      <div className="prop-row prop-row--stack">
        <select
          className="prop-select"
          value={toScreenId}
          onChange={(e) => setToScreenId(e.target.value)}
        >
          {others.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="prop-select"
          value={transition}
          onChange={(e) => setTransition(e.target.value)}
        >
          <option value="instant">Instantâneo</option>
          <option value="dissolve">Dissolver</option>
          <option value="slide_left">Deslizar ←</option>
          <option value="slide_right">Deslizar →</option>
          <option value="push">Empurrar</option>
        </select>
        <button
          type="button"
          className="prop-chip-btn"
          disabled={!toScreenId || !others.length}
          onClick={() =>
            onAddLink?.({
              toScreenId,
              transition,
              fromScreenId: currentScreenId,
              triggerNodeId: nodeId,
            })
          }
        >
          Salvar link
        </button>
      </div>
      {links.length > 0 && (
        <ul className="prop-link-list">
          {links.map((link) => {
            const dest = screens.find((s) => s.id === link.toScreenId);
            return (
              <li key={link.id} className="prop-link-item">
                <button
                  type="button"
                  className="prop-link-edit"
                  onClick={() => onEditLink?.(link.id)}
                >
                  → {dest?.name || link.toScreenId} (
                  {transitionLabel(link.transition)})
                </button>
                <button
                  type="button"
                  className="prop-link-delete"
                  title="Remover link"
                  onClick={() => onDeleteLink?.(link.id)}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PropSection>
  );
}

function CommentProps({ comment, onChange, onResolve, onDelete }) {
  const set = (patch) => onChange?.(patch);
  return (
    <div className="props-panel">
      <div className="prop-header">
        <div className="prop-name-static">Comentário</div>
        <span className="prop-type-badge">
          {comment.resolved ? 'Resolvido' : 'Aberto'}
        </span>
      </div>
      <PropSection title="Texto">
        <DraftTextField
          className="prop-textarea"
          rows={4}
          value={comment.text || ''}
          textarea
          onCommit={(text) => set({ text })}
        />
      </PropSection>
      <div className="prop-row prop-row--gap">
        <button
          type="button"
          className="prop-chip-btn"
          onClick={() => onResolve?.(!comment.resolved)}
        >
          {comment.resolved ? 'Reabrir' : 'Resolver'}
        </button>
        <button
          type="button"
          className="prop-chip-btn prop-chip-btn--danger"
          onClick={() => onDelete?.()}
        >
          Apagar
        </button>
      </div>
    </div>
  );
}

function ScreenProps({ screen, onChange }) {
  const set = (patch) => onChange?.(patch);
  return (
    <div className="props-panel">
      <div className="prop-header">
        <DraftTextField
          className="prop-name-input"
          type="text"
          value={screen.name || ''}
          onCommit={(name) => set({ name })}
        />
        <span className="prop-type-badge">Tela</span>
      </div>

      <PropSection title="Layout">
        <div className="prop-row">
          <DraftNumberInput
            label="L"
            value={screen.width}
            min={1}
            onCommit={(n) => set({ width: n })}
          />
          <DraftNumberInput
            label="A"
            value={screen.height}
            min={1}
            onCommit={(n) => set({ height: n })}
          />
        </div>
      </PropSection>

      <PropSection title="Preenchimento">
        <FillRow
          color={screen.background || '#FFFFFF'}
          showOpacity={false}
          onColorCommit={(c) => set({ background: c })}
        />
      </PropSection>
    </div>
  );
}

function MultiProps({ multiCount, onChange, onAlign, onDistribute }) {
  return (
    <div className="props-panel">
      <div className="prop-header">
        <div className="prop-name-static">{multiCount} selecionados</div>
      </div>

      <AlignRow
        onAlign={onAlign}
        onDistribute={onDistribute}
        canDistribute={multiCount >= 3}
      />

      <PropSection title="Preenchimento">
        <FillRow
          color="#93C5FD"
          opacity={1}
          onColorCommit={(c) => onChange?.({ fill: c })}
          onOpacityCommit={(o) => onChange?.({ fillOpacity: o })}
        />
      </PropSection>
    </div>
  );
}

export default function PropertiesPanel({
  node,
  screen = null,
  comment = null,
  multiCount = 0,
  isScreenRoot = false,
  interactionMode = 'edit',
  screens = [],
  selectedScreenId,
  prototypes = [],
  components = [],
  onChange,
  onPreview,
  onPreviewCancel,
  onChangeScreen,
  onAlign,
  onDistribute,
  onAddPrototypeLink,
  onDeletePrototypeLink,
  onEditPrototypeLink,
  onChangeComment,
  onResolveComment,
  onDeleteComment,
  onCreateComponent,
  onInsertInstance,
  onSwitchVariant,
  onDetachInstance,
  onAutoLayout,
  designPanel = null,
}) {
  if (comment) {
    return (
      <CommentProps
        comment={comment}
        onChange={onChangeComment}
        onResolve={onResolveComment}
        onDelete={onDeleteComment}
      />
    );
  }

  if (multiCount > 1) {
    return (
      <MultiProps
        multiCount={multiCount}
        onChange={onChange}
        onAlign={onAlign}
        onDistribute={onDistribute}
      />
    );
  }

  if (!node && screen) {
    return (
      <>
        <ScreenProps screen={screen} onChange={onChangeScreen} />
        {designPanel}
      </>
    );
  }

  if (!node) {
    return (
      designPanel || (
        <div className="props-panel">
          <p className="props-empty">Selecione um objeto</p>
        </div>
      )
    );
  }

  const set = (patch) => onChange?.(patch);

  return (
    <div className="props-panel">
      <div className="prop-header">
        <DraftTextField
          className="prop-name-input"
          type="text"
          value={node.name || ''}
          placeholder={displayName(node)}
          onCommit={(name) => set({ name })}
        />
        <div className="prop-header-right">
          <span className="prop-type-badge">{typeLabel(node.type)}</span>
          <LayerToggles
            locked={node.locked}
            hidden={node.hidden}
            onChange={set}
          />
        </div>
      </div>

      <PropSection title="Posição">
        <div className="prop-row">
          <InlineInput
            label="X"
            value={Math.round(node.x)}
            onChange={(v) => set({ x: Number(v) || 0 })}
          />
          <InlineInput
            label="Y"
            value={Math.round(node.y)}
            onChange={(v) => set({ y: Number(v) || 0 })}
          />
        </div>
      </PropSection>

      <PropSection title="Layout">
        <div className="prop-row">
          <InlineInput
            label="L"
            value={Math.round(node.w)}
            min={1}
            onChange={(v) => set({ w: Math.max(1, Number(v) || 1) })}
          />
          <InlineInput
            label="A"
            value={Math.round(node.h)}
            min={1}
            onChange={(v) => set({ h: Math.max(1, Number(v) || 1) })}
          />
        </div>
      </PropSection>

      {isScreenRoot ? (
        <ConstraintsSection
          constraints={node.constraints}
          onChange={set}
        />
      ) : (
        <p className="prop-hint">
          Constraints só em objetos <strong>raiz</strong> da tela. Abra{' '}
          <strong>00 — Demo (guia)</strong> no painel Camadas.
        </p>
      )}

      {(interactionMode === 'prototype' ||
        (prototypes || []).some(
          (p) =>
            p.fromScreenId === selectedScreenId &&
            p.triggerNodeId === node.id,
        )) &&
        selectedScreenId && (
        <PrototypeSection
          screens={screens}
          currentScreenId={selectedScreenId}
          nodeId={node.id}
          prototypes={prototypes}
          onAddLink={onAddPrototypeLink}
          onDeleteLink={onDeletePrototypeLink}
          onEditLink={onEditPrototypeLink}
        />
      )}

      {multiCount <= 1 && selectedScreenId && onCreateComponent && (
        <PropSection title="Componentes">
          {node.type === 'component' ? (
            <div className="prop-row prop-row--stack">
              <span className="prop-mini-label">
                Principal — edite os filhos; duplicar cria instância
              </span>
              <button
                type="button"
                className="prop-chip-btn"
                onClick={() => onInsertInstance?.(node.componentId)}
              >
                Inserir instância
              </button>
            </div>
          ) : node.type !== 'instance' ? (
            <button
              type="button"
              className="prop-chip-btn"
              onClick={() => onCreateComponent?.()}
            >
              Criar componente
            </button>
          ) : (
            <div className="prop-row prop-row--stack">
              {(() => {
                const def = components.find((c) => c.id === node.componentId);
                if (!def?.variants?.length) {
                  return (
                    <span className="prop-mini-label">Componente ausente</span>
                  );
                }
                return (
                  <select
                    className="prop-select"
                    value={node.variantId}
                    onChange={(e) => onSwitchVariant?.(e.target.value)}
                  >
                    {def.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                );
              })()}
              <button
                type="button"
                className="prop-chip-btn"
                onClick={() => onDetachInstance?.()}
              >
                Desanexar
              </button>
            </div>
          )}
        </PropSection>
      )}

      {(node.type === 'rect' ||
        node.type === 'button' ||
        node.type === 'text' ||
        node.type === 'image') && (
        <PropSection title="Aparência">
          {(node.type === 'rect' || node.type === 'button') && (
            <div className="prop-row">
              <DraftNumberInput
                label="R"
                value={node.cornerRadius ?? 0}
                min={0}
                onCommit={(n) => set({ cornerRadius: Math.max(0, n) })}
              />
              <DraftNumberInput
                label="°"
                value={Math.round(node.rotation ?? 0)}
                onCommit={(n) => {
                  if (!Number.isFinite(n) || n === 0) {
                    set({ rotation: null });
                    return;
                  }
                  set({ rotation: ((n % 360) + 360) % 360 });
                }}
              />
            </div>
          )}
          {node.type === 'rect' && (
            <div className="prop-row">
              <DraftNumberInput
                label="Opac."
                value={Math.round((node.opacity ?? 1) * 100)}
                min={0}
                max={100}
                suffix="%"
                onCommit={(n) =>
                  set({
                    opacity: Math.min(1, Math.max(0, n / 100)),
                  })
                }
              />
            </div>
          )}
          {(node.type === 'text' || node.type === 'image') && (
            <div className="prop-row">
              <DraftNumberInput
                label="°"
                value={Math.round(node.rotation ?? 0)}
                onCommit={(n) => {
                  if (!Number.isFinite(n) || n === 0) {
                    set({ rotation: null });
                    return;
                  }
                  set({ rotation: ((n % 360) + 360) % 360 });
                }}
              />
            </div>
          )}
        </PropSection>
      )}

      {(node.type === 'rect' || node.type === 'button') && (
        <PropSection title="Preenchimento">
          <FillRow
            color={
              node.type === 'button'
                ? node.fill || '#1B355A'
                : node.fill || '#CCCCCC'
            }
            opacity={node.fillOpacity ?? 1}
            onColorPreview={(c) => onPreview?.({ fill: c })}
            onColorCommit={(c) => set({ fill: c })}
            onColorPreviewCancel={onPreviewCancel}
            onOpacityPreview={(o) => onPreview?.({ fillOpacity: o })}
            onOpacityCommit={(o) => set({ fillOpacity: o })}
            onOpacityPreviewCancel={onPreviewCancel}
          />
        </PropSection>
      )}

      {(node.type === 'rect' || node.type === 'button') && (
        <PropSection
          title="Traçado"
          trailing={
            node.stroke ? (
              <IconBtn
                title="Remover traçado"
                onClick={() =>
                  set({
                    stroke: null,
                    strokeWidth: null,
                    strokeOpacity: null,
                  })
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 7H11"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </IconBtn>
            ) : null
          }
        >
          <div className="prop-stroke-row">
            <FillRow
              color={node.stroke || '#000000'}
              opacity={node.strokeOpacity ?? 1}
              empty={!node.stroke}
              onColorPreview={(c) =>
                onPreview?.({
                  stroke: c,
                  strokeWidth: node.strokeWidth ?? 1,
                  strokeOpacity: node.strokeOpacity ?? 1,
                })
              }
              onColorCommit={(c) =>
                set({
                  stroke: c,
                  strokeWidth: node.strokeWidth ?? 1,
                  strokeOpacity: node.strokeOpacity ?? 1,
                })
              }
              onColorPreviewCancel={onPreviewCancel}
              onOpacityPreview={(o) =>
                onPreview?.({
                  stroke: node.stroke || '#000000',
                  strokeWidth: node.strokeWidth ?? 1,
                  strokeOpacity: o,
                })
              }
              onOpacityCommit={(o) =>
                set({
                  stroke: node.stroke || '#000000',
                  strokeWidth: node.strokeWidth ?? 1,
                  strokeOpacity: o,
                })
              }
              onOpacityPreviewCancel={onPreviewCancel}
            />
            <DraftNumberInput
              label="W"
              value={node.strokeWidth ?? 0}
              min={0}
              onCommit={(n) =>
                set({
                  stroke: node.stroke || '#000000',
                  strokeWidth: Math.max(0, n),
                  strokeOpacity: node.strokeOpacity ?? 1,
                })
              }
            />
          </div>
        </PropSection>
      )}

      {node.type === 'text' && (
        <>
          <PropSection title="Conteúdo">
            <DraftTextField
              className="prop-textarea"
              rows={3}
              value={node.text || ''}
              textarea
              onCommit={(text) => set({ text })}
            />
          </PropSection>
          <PropSection title="Tipografia">
            <FillRow
              color={node.color || '#1A1D21'}
              showOpacity={false}
              onColorCommit={(c) => set({ color: c })}
            />
            <div className="prop-row">
              <InlineInput
                label="S"
                value={node.fontSize || 16}
                min={1}
                onChange={(v) =>
                  set({ fontSize: Math.max(1, Number(v) || 16) })
                }
              />
              <InlineInput
                label="W"
                value={node.fontWeight || 400}
                min={100}
                step={100}
                onChange={(v) =>
                  set({ fontWeight: Math.max(100, Number(v) || 400) })
                }
              />
            </div>
            <select
              className="prop-select"
              value={node.align || 'left'}
              onChange={(e) => set({ align: e.target.value })}
            >
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
            </select>
          </PropSection>
        </>
      )}

      {node.type === 'button' && (
        <PropSection title="Conteúdo">
          <DraftTextField
            className="prop-text-full"
            type="text"
            value={node.label || ''}
            placeholder="Label"
            onCommit={(label) => set({ label })}
          />
          <div className="prop-row prop-row--gap">
            <span className="prop-mini-label">Texto</span>
            <FillRow
              color={node.textColor || '#FFFFFF'}
              showOpacity={false}
              onColorCommit={(c) => set({ textColor: c })}
            />
          </div>
          <div className="prop-row">
            <InlineInput
              label="S"
              value={node.fontSize || 16}
              min={1}
              onChange={(v) =>
                set({ fontSize: Math.max(1, Number(v) || 16) })
              }
            />
            <InlineInput
              label="W"
              value={node.fontWeight || 600}
              min={100}
              step={100}
              onChange={(v) =>
                set({ fontWeight: Math.max(100, Number(v) || 600) })
              }
            />
          </div>
          <DraftTextField
            className="prop-text-full"
            type="text"
            value={node.iconSrc || ''}
            placeholder="Icon URL"
            onCommit={(raw) =>
              set({ iconSrc: String(raw || '').trim() || undefined })
            }
          />
        </PropSection>
      )}

      {node.type === 'image' && (
        <PropSection title="Imagem">
          <DraftTextField
            className="prop-text-full"
            type="text"
            value={node.src || ''}
            placeholder="/assets/… ou URL"
            onCommit={(src) => set({ src })}
          />
          <select
            className="prop-select"
            value={node.fit || 'contain'}
            onChange={(e) => set({ fit: e.target.value })}
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="fill">Fill</option>
          </select>
        </PropSection>
      )}

      {(node.type === 'group' || node.type === 'component') && onAutoLayout && (
        <PropSection title="Auto-layout">
          <div className="prop-row prop-row--gap">
            <button
              type="button"
              className="tool-btn"
              onClick={() =>
                onAutoLayout({
                  direction: 'vertical',
                  gap: 8,
                  padding: 0,
                  align: 'start',
                })
              }
            >
              Vertical
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() =>
                onAutoLayout({
                  direction: 'horizontal',
                  gap: 8,
                  padding: 0,
                  align: 'start',
                })
              }
            >
              Horizontal
            </button>
          </div>
        </PropSection>
      )}
    </div>
  );
}
