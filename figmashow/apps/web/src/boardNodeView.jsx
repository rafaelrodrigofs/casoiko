/**
 * Renderer visual compartilhado (preview home, protótipo, e base do editor).
 * PhoneFrame reutiliza os helpers de estilo abaixo.
 */

export function colorWithOpacity(color, opacity = 1) {
  const raw = String(color || '').trim();
  const alpha = Math.min(1, Math.max(0, Number(opacity) || 1));
  if (!raw || alpha >= 1) return raw || 'transparent';
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (!match) return raw;
  const hex =
    match[1].length === 3
      ? [...match[1]].map((d) => `${d}${d}`).join('')
      : match[1];
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export function nodeBorderStyle(node, scale = 1) {
  const width = Number(node?.strokeWidth);
  if (!node?.stroke || !Number.isFinite(width) || width <= 0) return undefined;
  return `${Math.max(scale < 1 ? 0.5 : 0, width * scale)}px solid ${colorWithOpacity(
    node.stroke,
    node.strokeOpacity ?? 1,
  )}`;
}

export function nodeRadiusStyle(node, scale = 1) {
  if (node.bottomRadius != null) {
    const r = node.bottomRadius * scale;
    return `0 0 ${r}px ${r}px`;
  }
  return (node.cornerRadius || 0) * scale;
}

/**
 * Nó visual estático (sem edição).
 * @param {{ node: object, scale?: number, style?: object }} props
 */
export function BoardNodeView({ node, scale = 1, style: styleProp }) {
  const style = {
    position: 'absolute',
    left: node.x * scale,
    top: node.y * scale,
    width: Math.max(scale < 1 ? 0.5 : 0, (Number(node.w) || 0) * scale),
    height: Math.max(scale < 1 ? 0.5 : 0, (Number(node.h) || 0) * scale),
    opacity: node.opacity ?? 1,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    transformOrigin: '50% 50%',
    ...styleProp,
  };

  if (node.type === 'text') {
    const fs = Math.max(scale < 1 ? 5 : 1, (node.fontSize || 14) * scale);
    return (
      <div
        style={{
          ...style,
          color: node.color || '#1e293b',
          fontSize: fs,
          fontWeight: node.fontWeight || 400,
          textAlign: node.align || 'left',
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1.15,
          overflow: scale < 1 ? 'hidden' : undefined,
          whiteSpace: scale < 1 ? 'nowrap' : undefined,
          textOverflow: scale < 1 ? 'ellipsis' : undefined,
        }}
      >
        {node.text}
      </div>
    );
  }

  if (node.type === 'button') {
    const fs = Math.max(scale < 1 ? 5 : 1, (node.fontSize || 16) * scale);
    return (
      <div
        style={{
          ...style,
          background: colorWithOpacity(node.fill || '#3b82f6', node.fillOpacity ?? 1),
          color: node.textColor || '#fff',
          borderRadius: nodeRadiusStyle(node, scale),
          border: nodeBorderStyle(node, scale) || 'none',
          fontSize: fs,
          fontWeight: node.fontWeight || 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8 * scale,
          overflow: 'hidden',
          padding: scale < 1 ? `0 ${4 * scale}px` : undefined,
        }}
      >
        {node.iconSrc ? (
          <img
            src={node.iconSrc}
            alt=""
            style={{ width: 20 * scale, height: 20 * scale }}
          />
        ) : null}
        {scale > 0.08 ? <span>{node.label}</span> : null}
      </div>
    );
  }

  if (node.type === 'image') {
    return (
      <div style={{ ...style, overflow: 'hidden', background: '#e2e8f0' }}>
        {node.src ? (
          <img
            src={node.src}
            alt=""
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: node.fit || (scale < 1 ? 'cover' : 'contain'),
              display: 'block',
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        ...style,
        background: colorWithOpacity(
          node.fill || (scale < 1 ? '#e2e8f0' : undefined),
          node.fillOpacity ?? 1,
        ),
        borderRadius: nodeRadiusStyle(node, scale),
        border: nodeBorderStyle(node, scale),
      }}
    />
  );
}
