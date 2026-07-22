import { EventEmitter } from 'node:events';

/** @type {EventEmitter} */
export const boardEvents = new EventEmitter();
boardEvents.setMaxListeners(100);

/**
 * @param {string} projectId
 * @param {{ revision: number, reason?: string }} payload
 */
export function emitBoardChanged(projectId, payload) {
  if (!projectId) return;
  boardEvents.emit('board', { projectId, ...payload });
  boardEvents.emit(`board:${projectId}`, payload);
}
