import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAutoLayout, applyBoardOperations, emptyBoard, createScreen } from './index.js';

test('applyAutoLayout vertical', () => {
  const { children, bounds } = applyAutoLayout(
    [
      { id: 'a', type: 'rect', x: 0, y: 0, w: 40, h: 10 },
      { id: 'b', type: 'rect', x: 0, y: 0, w: 20, h: 10 },
    ],
    { direction: 'vertical', gap: 4, padding: 2 },
  );
  assert.equal(children[0].y, 2);
  assert.equal(children[1].y, 16);
  assert.ok(bounds.h >= 26);
});

test('applyBoardOperations create_screen + add_node', () => {
  let board = emptyBoard();
  board = applyBoardOperations(board, [
    { type: 'create_screen', name: 'Home', id: 'screen_home' },
    {
      type: 'add_node',
      screenId: 'screen_home',
      node: {
        id: 'n1',
        type: 'rect',
        x: 0,
        y: 0,
        w: 100,
        h: 40,
        fill: '#fff',
      },
    },
  ]);
  assert.equal(board.screens.length, 1);
  assert.equal(board.screens[0].nodes.length, 1);
});
