/**
 * Geradores de CSS / React a partir de uma Screen do board.
 */

function sanitizeIdent(raw, fallback = 'node') {
  const base = String(raw || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const ident = base || fallback;
  return /^[a-z_]/.test(ident) ? ident : `n-${ident}`;
}

function cssEscape(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function colorCss(color, opacity = 1) {
  const raw = String(color || '').trim();
  const alpha = Math.min(1, Math.max(0, Number(opacity)));
  if (!Number.isFinite(alpha) || alpha >= 1) return raw;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (!match) return raw;
  const hex =
    match[1].length === 3
      ? [...match[1]].map((d) => `${d}${d}`).join('')
      : match[1];
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function nodeClassName(node, used) {
  const preferred = sanitizeIdent(node.name || node.id || node.type, node.type);
  let candidate = preferred;
  let i = 2;
  while (used.has(candidate)) {
    candidate = `${preferred}-${i}`;
    i += 1;
  }
  used.add(candidate);
  return candidate;
}

function rotationCss(rotation) {
  const r = Number(rotation) || 0;
  if (!r) return '';
  return `  transform: rotate(${r}deg);\n  transform-origin: 50% 50%;\n`;
}

function absoluteBox(node) {
  return `  position: absolute;\n  left: ${Math.round(node.x)}px;\n  top: ${Math.round(node.y)}px;\n  width: ${Math.round(node.w)}px;\n  height: ${Math.round(node.h)}px;\n`;
}

function nodeCssRules(node, className, used) {
  /** @type {string[]} */
  const chunks = [];
  if (node.hidden) return chunks;

  if (node.type === 'group' || node.type === 'component') {
    chunks.push(
      `.${className} {\n${absoluteBox(node)}  box-sizing: border-box;\n}\n`,
    );
    for (const child of node.children || []) {
      const childClass = nodeClassName(child, used);
      chunks.push(...nodeCssRules(child, childClass, used));
    }
    return chunks;
  }

  let body = absoluteBox(node);
  body += '  box-sizing: border-box;\n';
  if (node.opacity != null && Number(node.opacity) !== 1) {
    body += `  opacity: ${node.opacity};\n`;
  }
  body += rotationCss(node.rotation);

  if (node.type === 'rect') {
    body += `  background: ${colorCss(node.fill, node.fillOpacity ?? 1)};\n`;
    if (node.bottomRadius != null && Number(node.bottomRadius) > 0) {
      body += `  border-radius: 0 0 ${node.bottomRadius}px ${node.bottomRadius}px;\n`;
    } else if (node.cornerRadius) {
      body += `  border-radius: ${node.cornerRadius}px;\n`;
    }
    if (node.stroke && Number(node.strokeWidth) > 0) {
      body += `  border: ${node.strokeWidth}px solid ${colorCss(
        node.stroke,
        node.strokeOpacity ?? 1,
      )};\n`;
    }
  } else if (node.type === 'text') {
    body += `  color: ${node.color || '#1A1D21'};\n`;
    body += `  font-size: ${node.fontSize || 16}px;\n`;
    body += `  font-weight: ${node.fontWeight || 400};\n`;
    body += `  text-align: ${node.align || 'left'};\n`;
    body += '  line-height: 1.2;\n';
    body += '  display: flex;\n  align-items: center;\n';
    body += `  justify-content: ${
      node.align === 'center'
        ? 'center'
        : node.align === 'right'
          ? 'flex-end'
          : 'flex-start'
    };\n`;
  } else if (node.type === 'button') {
    body += `  background: ${colorCss(node.fill, node.fillOpacity ?? 1)};\n`;
    body += `  color: ${node.textColor || '#FFFFFF'};\n`;
    body += `  border-radius: ${node.cornerRadius || 0}px;\n`;
    body += `  font-size: ${node.fontSize || 16}px;\n`;
    body += `  font-weight: ${node.fontWeight || 600};\n`;
    body +=
      '  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 10px;\n';
    if (node.stroke && Number(node.strokeWidth) > 0) {
      body += `  border: ${node.strokeWidth}px solid ${colorCss(
        node.stroke,
        node.strokeOpacity ?? 1,
      )};\n`;
    } else {
      body += '  border: none;\n';
    }
  } else if (node.type === 'image') {
    body += '  overflow: hidden;\n';
  } else if (node.type === 'instance') {
    body +=
      '  /* instance — resolva a variante no runtime */\n  outline: 1px dashed #94a3b8;\n';
  }

  chunks.push(`.${className} {\n${body}}\n`);

  if (node.type === 'image') {
    chunks.push(
      `.${className} img {\n  width: 100%;\n  height: 100%;\n  object-fit: ${node.fit || 'contain'};\n  display: block;\n}\n`,
    );
  }

  return chunks;
}

/**
 * @param {import('./schema.js').Screen} screen
 * @returns {string}
 */
export function screenToCss(screen) {
  const root = sanitizeIdent(screen.name || screen.id, 'screen');
  const used = new Set([root]);
  /** @type {string[]} */
  const parts = [
    `/* Export FigmaShow — ${screen.name || screen.id} */\n`,
    `.${root} {\n  position: relative;\n  width: ${screen.width}px;\n  height: ${screen.height}px;\n  background: ${screen.background || '#FFFFFF'};\n  overflow: hidden;\n  box-sizing: border-box;\n}\n`,
  ];

  for (const node of screen.nodes || []) {
    const className = nodeClassName(node, used);
    parts.push(...nodeCssRules(node, className, used));
  }

  return parts.join('\n');
}

function jsxEscape(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function styleObject(entries) {
  const lines = Object.entries(entries)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      if (typeof v === 'number') return `    ${k}: ${v},`;
      return `    ${k}: '${cssEscape(v)}',`;
    });
  return `{\n${lines.join('\n')}\n  }`;
}

function nodeToJsx(node, indent = 2) {
  if (node.hidden) return '';
  const pad = ' '.repeat(indent);
  const base = {
    position: 'absolute',
    left: Math.round(node.x),
    top: Math.round(node.y),
    width: Math.round(node.w),
    height: Math.round(node.h),
    boxSizing: 'border-box',
  };
  if (node.opacity != null && Number(node.opacity) !== 1) {
    base.opacity = Number(node.opacity);
  }
  if (node.rotation) {
    base.transform = `rotate(${node.rotation}deg)`;
    base.transformOrigin = '50% 50%';
  }

  if (node.type === 'group' || node.type === 'component') {
    const kids = (node.children || [])
      .map((c) => nodeToJsx(c, indent + 2))
      .filter(Boolean)
      .join('\n');
    return `${pad}<div style={${styleObject(base)}}>\n${kids}\n${pad}</div>`;
  }

  if (node.type === 'text') {
    Object.assign(base, {
      color: node.color || '#1A1D21',
      fontSize: node.fontSize || 16,
      fontWeight: node.fontWeight || 400,
      textAlign: node.align || 'left',
      lineHeight: 1.2,
      display: 'flex',
      alignItems: 'center',
      justifyContent:
        node.align === 'center'
          ? 'center'
          : node.align === 'right'
            ? 'flex-end'
            : 'flex-start',
    });
    return `${pad}<div style={${styleObject(base)}}>${jsxEscape(node.text || '')}</div>`;
  }

  if (node.type === 'button') {
    Object.assign(base, {
      background: colorCss(node.fill, node.fillOpacity ?? 1),
      color: node.textColor || '#FFFFFF',
      borderRadius: node.cornerRadius || 0,
      fontSize: node.fontSize || 16,
      fontWeight: node.fontWeight || 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      border:
        node.stroke && Number(node.strokeWidth) > 0
          ? `${node.strokeWidth}px solid ${colorCss(
              node.stroke,
              node.strokeOpacity ?? 1,
            )}`
          : 'none',
    });
    const icon = node.iconSrc
      ? `\n${pad}  <img src="${cssEscape(node.iconSrc)}" alt="" style={{ width: 20, height: 20 }} />\n${pad}  `
      : '';
    return `${pad}<div style={${styleObject(base)}}>${icon}<span>${jsxEscape(node.label || '')}</span></div>`;
  }

  if (node.type === 'image') {
    return `${pad}<div style={${styleObject({ ...base, overflow: 'hidden' })}}>\n${pad}  <img src="${cssEscape(node.src || '')}" alt="${cssEscape(node.name || '')}" style={{ width: '100%', height: '100%', objectFit: '${node.fit || 'contain'}', display: 'block' }} />\n${pad}</div>`;
  }

  // rect (default) + instance placeholder
  Object.assign(base, {
    background: colorCss(node.fill || '#E5E7EB', node.fillOpacity ?? 1),
  });
  if (node.bottomRadius != null && Number(node.bottomRadius) > 0) {
    base.borderRadius = `0 0 ${node.bottomRadius}px ${node.bottomRadius}px`;
  } else if (node.cornerRadius) {
    base.borderRadius = node.cornerRadius;
  }
  if (node.stroke && Number(node.strokeWidth) > 0) {
    base.border = `${node.strokeWidth}px solid ${colorCss(
      node.stroke,
      node.strokeOpacity ?? 1,
    )}`;
  }
  if (node.type === 'instance') {
    base.outline = '1px dashed #94a3b8';
  }
  return `${pad}<div style={${styleObject(base)}} />`;
}

/**
 * @param {import('./schema.js').Screen} screen
 * @returns {string}
 */
export function screenToReact(screen) {
  const name = sanitizeIdent(screen.name || screen.id, 'Screen')
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  const componentName = /^[A-Z]/.test(name) ? name : `Screen${name}`;
  const children = (screen.nodes || [])
    .map((n) => nodeToJsx(n, 6))
    .filter(Boolean)
    .join('\n');

  return `/** Export FigmaShow — ${screen.name || screen.id} */\nexport default function ${componentName}() {\n  return (\n    <div\n      style={{\n        position: 'relative',\n        width: ${screen.width},\n        height: ${screen.height},\n        background: '${cssEscape(screen.background || '#FFFFFF')}',\n        overflow: 'hidden',\n        boxSizing: 'border-box',\n      }}\n    >\n${children}\n    </div>\n  );\n}\n`;
}

/**
 * @param {string} name
 */
export function sanitizeDownloadName(name) {
  return (
    String(name || 'screen')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'screen'
  );
}
