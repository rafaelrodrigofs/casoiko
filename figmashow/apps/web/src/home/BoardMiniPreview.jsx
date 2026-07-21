import { useEffect, useRef, useState } from 'react';
import BoardPreviewCanvas from './boardPreviewCore.jsx';
import { captureAndUploadProjectThumb } from '../thumbnailCapture.jsx';

export default function BoardMiniPreview({ projectId, updatedAt }) {
  const containerRef = useRef(null);
  const [board, setBoard] = useState(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ w: 280, h: 168 });
  const [pngLoaded, setPngLoaded] = useState(false);
  const [thumbKey, setThumbKey] = useState(0);
  const generatingRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({
        w: Math.max(1, entry.contentRect.width),
        h: Math.max(1, entry.contentRect.height),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setPngLoaded(false);
    setThumbKey(0);
  }, [projectId, updatedAt]);

  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setFailed(false);

    (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (!cancelled) setBoard(payload?.board || null);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, updatedAt]);

  useEffect(() => {
    if (!board || generatingRef.current) return;
    let cancelled = false;

    (async () => {
      const check = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/thumb`,
        { cache: 'no-store' },
      );
      if (check.ok || cancelled) return;

      generatingRef.current = true;
      try {
        await captureAndUploadProjectThumb(projectId, board);
        if (!cancelled) setThumbKey((k) => k + 1);
      } catch {
        /* preview ao vivo permanece */
      } finally {
        generatingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [board, projectId]);

  const thumbUrl = `/api/projects/${encodeURIComponent(projectId)}/thumb?v=${encodeURIComponent(updatedAt || '')}&k=${thumbKey}`;

  return (
    <div ref={containerRef} className="board-mini-preview-wrap">
      {failed ? (
        <div className="board-mini-preview board-mini-preview--empty" />
      ) : !board ? (
        <div className="board-mini-preview board-mini-preview--loading">
          <span className="board-mini-preview-shimmer" />
        </div>
      ) : (
        <>
          <BoardPreviewCanvas
            board={board}
            width={size.w}
            height={size.h}
            maxScreens={4}
            className={pngLoaded ? 'board-mini-preview--hidden' : ''}
          />
          <img
            className={`board-mini-preview-img${pngLoaded ? ' visible' : ''}`}
            src={thumbUrl}
            alt=""
            draggable={false}
            onLoad={() => setPngLoaded(true)}
            onError={() => setPngLoaded(false)}
          />
        </>
      )}
    </div>
  );
}
