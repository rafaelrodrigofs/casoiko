import { useCallback, useRef, useState } from 'react';

/**
 * Seleção de tela / nós / hover / comentário no editor.
 */
export function useBoardSelection() {
  const [selectedScreenId, setSelectedScreenId] = useState(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [selectedCommentId, setSelectedCommentId] = useState(null);

  const selectedScreenIdRef = useRef(null);
  const selectedNodeIdsRef = useRef([]);
  selectedScreenIdRef.current = selectedScreenId;
  selectedNodeIdsRef.current = selectedNodeIds;

  const selectNode = useCallback((screenId, nodeId, opts = {}) => {
    setSelectedScreenId(screenId);
    setSelectedCommentId(null);
    setSelectedNodeIds((prev) => {
      if (opts.preserve) return prev;
      if (opts.additive) {
        if (prev.includes(nodeId)) {
          return prev.filter((id) => id !== nodeId);
        }
        return [...prev, nodeId];
      }
      return [nodeId];
    });
  }, []);

  const selectScreen = useCallback((id) => {
    setSelectedScreenId(id);
    setSelectedNodeIds([]);
    setHoveredNodeId(null);
    setSelectedCommentId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedScreenId(null);
    setSelectedNodeIds([]);
    setHoveredNodeId(null);
    setSelectedCommentId(null);
  }, []);

  const hoverNode = useCallback((_screenId, nodeId) => {
    setHoveredNodeId(nodeId ?? null);
  }, []);

  return {
    selectedScreenId,
    setSelectedScreenId,
    selectedNodeIds,
    setSelectedNodeIds,
    hoveredNodeId,
    setHoveredNodeId,
    selectedCommentId,
    setSelectedCommentId,
    selectedScreenIdRef,
    selectedNodeIdsRef,
    selectNode,
    selectScreen,
    clearSelection,
    hoverNode,
  };
}
