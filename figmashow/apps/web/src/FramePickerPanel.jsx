/**
 * Painel Quadro — presets por categoria + tamanho livre (estilo Figma).
 */

import { useEffect, useState } from 'react';
import { FRAME_PRESET_CATEGORIES } from '@figmashow/core/framePresets';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onPick: (opts: { width: number, height: number, name: string }) => void,
 * }} props
 */
export default function FramePickerPanel({ open, onClose, onPick }) {
  const [expanded, setExpanded] = useState(() => new Set(['phone']));
  const [customW, setCustomW] = useState('390');
  const [customH, setCustomH] = useState('844');

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createCustom = () => {
    const width = Math.max(1, Math.round(Number(customW) || 0));
    const height = Math.max(1, Math.round(Number(customH) || 0));
    if (!width || !height) return;
    onPick?.({ width, height, name: `Quadro ${width}×${height}` });
    onClose?.();
  };

  return (
    <div className="frame-picker" role="dialog" aria-label="Quadro">
      <div className="frame-picker-head">
        <span className="frame-picker-title">Quadro</span>
        <button
          type="button"
          className="frame-picker-close"
          title="Fechar"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="frame-picker-body">
        {FRAME_PRESET_CATEGORIES.map((cat) => {
          const openCat = expanded.has(cat.id);
          return (
            <div key={cat.id} className="frame-picker-cat">
              <button
                type="button"
                className="frame-picker-cat-btn"
                aria-expanded={openCat}
                onClick={() => toggle(cat.id)}
              >
                <span className={`frame-picker-chevron${openCat ? ' open' : ''}`}>
                  ›
                </span>
                {cat.label}
              </button>
              {openCat && (
                <ul className="frame-picker-list">
                  {cat.presets.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="frame-picker-preset"
                        onClick={() => {
                          onPick?.({
                            width: p.width,
                            height: p.height,
                            name: p.name,
                          });
                          onClose?.();
                        }}
                      >
                        <span>{p.name}</span>
                        <small>
                          {p.width} × {p.height}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="frame-picker-custom">
        <span className="frame-picker-custom-label">Personalizado</span>
        <div className="frame-picker-custom-row">
          <label>
            L
            <input
              type="number"
              min={1}
              value={customW}
              onChange={(e) => setCustomW(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createCustom();
              }}
            />
          </label>
          <label>
            A
            <input
              type="number"
              min={1}
              value={customH}
              onChange={(e) => setCustomH(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createCustom();
              }}
            />
          </label>
          <button type="button" className="tool-btn" onClick={createCustom}>
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}
