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

test('applyAutoLayout offsets children by group absolute origin', () => {
  const originX = 100;
  const originY = 200;
  const { children, bounds } = applyAutoLayout(
    [
      { id: 'a', type: 'rect', x: 110, y: 210, w: 40, h: 10 },
      { id: 'b', type: 'rect', x: 120, y: 230, w: 20, h: 10 },
    ],
    { direction: 'vertical', gap: 4, padding: 2, originX, originY },
  );
  assert.equal(children[0].x, originX + 2);
  assert.equal(children[0].y, originY + 2);
  assert.equal(children[1].x, originX + 2);
  assert.equal(children[1].y, originY + 16);
  assert.equal(bounds.x, originX);
  assert.equal(bounds.y, originY);
  for (const child of children) {
    assert.ok(child.x >= bounds.x);
    assert.ok(child.y >= bounds.y);
    assert.ok(child.x + child.w <= bounds.x + bounds.w);
    assert.ok(child.y + child.h <= bounds.y + bounds.h);
  }
});

test('applyBoardOperations auto_layout keeps children in displaced group', () => {
  let board = emptyBoard();
  board = applyBoardOperations(board, [
    { type: 'create_screen', name: 'Home', id: 'screen_home' },
    {
      type: 'add_node',
      screenId: 'screen_home',
      node: {
        id: 'g1',
        type: 'group',
        x: 100,
        y: 200,
        w: 80,
        h: 40,
        children: [
          { id: 'a', type: 'rect', x: 110, y: 210, w: 40, h: 10, fill: '#fff' },
          { id: 'b', type: 'rect', x: 120, y: 230, w: 20, h: 10, fill: '#eee' },
        ],
      },
    },
    {
      type: 'auto_layout',
      screenId: 'screen_home',
      nodeId: 'g1',
      direction: 'vertical',
      gap: 4,
      padding: 2,
    },
  ]);
  const group = board.screens[0].nodes[0];
  assert.equal(group.x, 100);
  assert.equal(group.y, 200);
  assert.equal(group.children[0].x, 102);
  assert.equal(group.children[0].y, 202);
  assert.equal(group.children[1].y, 216);
  for (const child of group.children) {
    assert.ok(child.x >= group.x);
    assert.ok(child.y >= group.y);
  }
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
