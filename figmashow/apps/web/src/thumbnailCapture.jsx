import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import BoardPreviewCanvas from './home/boardPreviewCore.jsx';

const THUMB_W = 560;
const THUMB_H = 336;

/**
 * Gera PNG offscreen e envia ao servidor (miniatura estilo Figma).
 * @param {string} projectId
 * @param {object} board
 */
export async function captureAndUploadProjectThumb(projectId, board) {
  if (!projectId || !board?.screens?.length) return;

  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${THUMB_W}px;height:${THUMB_H}px;pointer-events:none;opacity:1;`;
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(
    <BoardPreviewCanvas board={board} width={THUMB_W} height={THUMB_H} maxScreens={8} />,
  );

  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const imgs = host.querySelectorAll('img');
  await Promise.all(
    [...imgs].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) resolve(undefined);
          else {
            img.onload = () => resolve(undefined);
            img.onerror = () => resolve(undefined);
          }
        }),
    ),
  );
  await new Promise((r) => setTimeout(r, 150));

  const target = host.firstElementChild;
  if (!target) {
    root.unmount();
    host.remove();
    return;
  }

  try {
    const dataUrl = await toPng(target, {
      width: THUMB_W,
      height: THUMB_H,
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#ececec',
    });

    await fetch(`/api/projects/${encodeURIComponent(projectId)}/thumb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    });
  } finally {
    root.unmount();
    host.remove();
  }
}
