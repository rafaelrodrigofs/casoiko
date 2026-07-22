import { useCallback, useRef } from 'react';

const DEFAULT_MAX = 50;

/**
 * Undo/redo de board + seleção.
 * @param {{
 *   boardRef: import('react').MutableRefObject<object|null>,
 *   setBoard: (b: object) => void,
 *   selectedScreenIdRef: import('react').MutableRefObject<string|null>,
 *   selectedNodeIdsRef: import('react').MutableRefObject<string[]>,
 *   setSelectedScreenId: (id: string|null) => void,
 *   setSelectedNodeIds: (ids: string[]) => void,
 *   persistBoard: (board: object) => void,
 *   cloneBoard: (board: object) => object,
 *   maxHistory?: number,
 * }} opts
 */
export function useBoardHistory({
  boardRef,
  setBoard,
  selectedScreenIdRef,
  selectedNodeIdsRef,
  setSelectedScreenId,
  setSelectedNodeIds,
  persistBoard,
  cloneBoard,
  maxHistory = DEFAULT_MAX,
}) {
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  const pushHistory = useCallback(() => {
    const cur = boardRef.current;
    if (!cur) return;
    undoStackRef.current.push({
      board: cloneBoard(cur),
      selectedScreenId: selectedScreenIdRef.current,
      selectedNodeIds: [...selectedNodeIdsRef.current],
    });
    if (undoStackRef.current.length > maxHistory) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, [
    boardRef,
    cloneBoard,
    maxHistory,
    selectedNodeIdsRef,
    selectedScreenIdRef,
  ]);

  const undo = useCallback(() => {
    const cur = boardRef.current;
    if (!cur || undoStackRef.current.length === 0) return;
    const entry = undoStackRef.current.pop();
    const prevBoard = entry?.board ?? entry;
    if (!prevBoard || typeof prevBoard !== 'object') return;
    redoStackRef.current.push({
      board: cloneBoard(cur),
      selectedScreenId: selectedScreenIdRef.current,
      selectedNodeIds: [...selectedNodeIdsRef.current],
    });
    boardRef.current = prevBoard;
    setBoard(prevBoard);
    setSelectedScreenId(entry?.selectedScreenId ?? null);
    setSelectedNodeIds(entry?.selectedNodeIds ?? []);
    persistBoard(prevBoard);
  }, [
    boardRef,
    cloneBoard,
    persistBoard,
    selectedNodeIdsRef,
    selectedScreenIdRef,
    setBoard,
    setSelectedNodeIds,
    setSelectedScreenId,
  ]);

  const redo = useCallback(() => {
    const cur = boardRef.current;
    if (!cur || redoStackRef.current.length === 0) return;
    const entry = redoStackRef.current.pop();
    const nextBoard = entry?.board ?? entry;
    if (!nextBoard || typeof nextBoard !== 'object') return;
    undoStackRef.current.push({
      board: cloneBoard(cur),
      selectedScreenId: selectedScreenIdRef.current,
      selectedNodeIds: [...selectedNodeIdsRef.current],
    });
    boardRef.current = nextBoard;
    setBoard(nextBoard);
    setSelectedScreenId(entry?.selectedScreenId ?? null);
    setSelectedNodeIds(entry?.selectedNodeIds ?? []);
    persistBoard(nextBoard);
  }, [
    boardRef,
    cloneBoard,
    persistBoard,
    selectedNodeIdsRef,
    selectedScreenIdRef,
    setBoard,
    setSelectedNodeIds,
    setSelectedScreenId,
  ]);

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
  }, []);

  return { pushHistory, undo, redo, clearHistory, undoStackRef, redoStackRef };
}
