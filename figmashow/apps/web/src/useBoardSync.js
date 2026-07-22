import { useEffect, useRef } from 'react';

/**
 * Sync leve: revision poll + SSE opcional.
 * Full board só é buscado pelo caller em onRevisionChanged.
 * @param {{
 *   projectId: string | null,
 *   enabled: boolean,
 *   dirty?: boolean,
 *   putInFlight?: boolean,
 *   shouldSkip?: () => boolean,
 *   knownRevision: number,
 *   onRevisionChanged: (revision: number) => void,
 *   pollMs?: number,
 * }} opts
 */
export function useBoardSync({
  projectId,
  enabled,
  dirty = false,
  putInFlight = false,
  shouldSkip,
  knownRevision,
  onRevisionChanged,
  pollMs = 1500,
}) {
  const knownRef = useRef(knownRevision);
  knownRef.current = knownRevision;
  const skipRef = useRef(shouldSkip);
  skipRef.current = shouldSkip;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const flightRef = useRef(putInFlight);
  flightRef.current = putInFlight;
  const onChangeRef = useRef(onRevisionChanged);
  onChangeRef.current = onRevisionChanged;

  useEffect(() => {
    if (!enabled || !projectId) return undefined;

    let cancelled = false;
    let es = null;

    const blocked = () =>
      dirtyRef.current ||
      flightRef.current ||
      (typeof skipRef.current === 'function' && !!skipRef.current());

    async function checkRevision() {
      if (cancelled || blocked()) return;
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/revision`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = await res.json();
        const rev = Number(data?.revision) || 0;
        if (rev !== knownRef.current) onChangeRef.current?.(rev);
      } catch {
        /* ignore */
      }
    }

    const timer = setInterval(checkRevision, pollMs);

    try {
      es = new EventSource(
        `/api/projects/${encodeURIComponent(projectId)}/events`,
      );
      es.addEventListener('board', (ev) => {
        if (cancelled || blocked()) return;
        try {
          const data = JSON.parse(ev.data || '{}');
          const rev = Number(data?.revision) || 0;
          if (rev && rev !== knownRef.current) onChangeRef.current?.(rev);
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* EventSource indisponível */
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      es?.close();
    };
  }, [projectId, enabled, pollMs]);
}
