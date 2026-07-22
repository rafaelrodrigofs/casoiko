/**
 * Exportadores do editor (PNG via html-to-image + CSS/React via core).
 */

import { toPng } from 'html-to-image';
import {
  sanitizeDownloadName,
  screenToCss,
  screenToReact,
} from '@figmashow/core/export';

function triggerDownload(blobOrUrl, filename) {
  const url =
    typeof blobOrUrl === 'string'
      ? blobOrUrl
      : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof blobOrUrl !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

function downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime });
  triggerDownload(blob, filename);
}

/**
 * Captura PNG da tela sem chrome do editor.
 * @param {HTMLElement} element
 * @param {{ id?: string, name?: string, width: number, height: number }} screen
 */
export async function exportScreenPng(element, screen) {
  if (!element) throw new Error('Elemento da tela não encontrado');
  const width = Math.max(1, Math.round(Number(screen.width) || 1));
  const height = Math.max(1, Math.round(Number(screen.height) || 1));
  const filename = `${sanitizeDownloadName(screen.name || screen.id)}.png`;

  // Esconde chrome (seleção, handles, guides, editor) só durante a captura.
  const hide = [
    '.group-outline',
    '.node-hover-outline',
    '.node-hover-ancestor',
    '.node-hover-sibling',
    '.resize-handles',
    '.smart-guides-overlay',
    '.chrome-drag-label',
    '.create-preview',
    '.inline-text-editor',
    '.alt-drag-proxy',
    '.prototype-link',
    '.comment-pin',
    '.constraint-guides',
  ];

  let dataUrl;
  try {
    dataUrl = await toPng(element, {
      width,
      height,
      pixelRatio: 1,
      cacheBust: true,
      style: {
        transform: 'none',
        left: '0',
        top: '0',
      },
      filter: (node) => {
        if (!(node instanceof Element)) return true;
        return !hide.some((sel) => node.matches?.(sel) || node.closest?.(sel));
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cors|tainted|security/i.test(msg)) {
      throw new Error(
        `Falha CORS ao exportar PNG. Use imagens locais (/assets/…) ou assets com CORS liberado. Detalhe: ${msg}`,
      );
    }
    throw new Error(`Falha ao exportar PNG: ${msg}`);
  }

  triggerDownload(dataUrl, filename);
  return { filename, width, height };
}

/**
 * @param {{ id?: string, name?: string, width: number, height: number, nodes?: unknown[] }} screen
 */
export function exportScreenCss(screen, components = []) {
  const css = screenToCss(screen, components);
  const filename = `${sanitizeDownloadName(screen.name || screen.id)}.css`;
  downloadText(css, filename, 'text/css;charset=utf-8');
  return { filename, css };
}

/**
 * @param {{ id?: string, name?: string, width: number, height: number, nodes?: unknown[] }} screen
 */
export function exportScreenReact(screen, components = []) {
  const jsx = screenToReact(screen, components);
  const filename = `${sanitizeDownloadName(screen.name || screen.id)}.jsx`;
  downloadText(jsx, filename, 'text/plain;charset=utf-8');
  return { filename, jsx };
}
