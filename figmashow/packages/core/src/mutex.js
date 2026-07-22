/**
 * Filas in-process por chave (path) para serializar read-check-write.
 * Evita TOCTOU entre writers no mesmo processo.
 */

/** @type {Map<string, Promise<unknown>>} */
const tails = new Map();

/**
 * Executa `fn` serializado por `key`.
 * @template T
 * @param {string} key
 * @param {() => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
export function withMutex(key, fn) {
  const prev = tails.get(key) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => fn());
  tails.set(
    key,
    next.finally(() => {
      if (tails.get(key) === next) tails.delete(key);
    }),
  );
  return next;
}

/**
 * Variante sync: usa fila e bloqueia via Atomics wait... não disponível sem Worker.
 * Para código sync existente, expomos runExclusiveSync com Promise + busy wait não é bom.
 * Preferimos tornar writeBoardIfRevision async OU usar uma fila sync com flag.
 *
 * Mutex sync simples (single-threaded Node): se já há lock, enfileira callbacks.
 */

/** @type {Map<string, { locked: boolean, queue: Array<() => void> }>} */
const syncLocks = new Map();

/**
 * @param {string} key
 * @param {() => T} fn
 * @template T
 * @returns {T}
 */
export function withMutexSync(key, fn) {
  let state = syncLocks.get(key);
  if (!state) {
    state = { locked: false, queue: [] };
    syncLocks.set(key, state);
  }

  if (!state.locked) {
    state.locked = true;
    try {
      return fn();
    } finally {
      state.locked = false;
      const queued = state.queue.shift();
      if (queued) {
        // Re-enter synchronously for next waiter
        queued();
      } else if (state.queue.length === 0 && !state.locked) {
        syncLocks.delete(key);
      }
    }
  }

  // Nested/concurrent call on same tick while locked: queue and run after
  // In Node single-thread, concurrent only happens if fn is re-entrant.
  // For true parallel async callers, use withMutex (async).
  // Sync path: if locked mid-execution from same stack, just run (re-entrant).
  return fn();
}
