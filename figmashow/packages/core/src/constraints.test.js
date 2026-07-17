import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeBoard,
  normalizeConstraints,
  normalizeNode,
  resizeScreenWithConstraints,
} from '../src/schema.js';

describe('constraints', () => {
  it('defaults to left+top', () => {
    const c = normalizeConstraints(undefined);
    assert.deepEqual(c, {
      left: true,
      right: false,
      top: true,
      bottom: false,
    });
  });

  it('forces at least one pin per axis', () => {
    const c = normalizeConstraints({
      left: false,
      right: false,
      top: false,
      bottom: false,
    });
    assert.equal(c.left, true);
    assert.equal(c.top, true);
  });

  it('pins left keeps left margin; right stretch grows width', () => {
    const screen = {
      id: 's',
      name: 'S',
      width: 100,
      height: 100,
      background: '#fff',
      x: 0,
      y: 0,
      nodes: [
        normalizeNode({
          id: 'a',
          type: 'rect',
          x: 10,
          y: 10,
          w: 40,
          h: 20,
          fill: '#000',
          constraints: { left: true, right: true, top: true, bottom: false },
        }),
        normalizeNode({
          id: 'b',
          type: 'rect',
          x: 10,
          y: 50,
          w: 20,
          h: 20,
          fill: '#111',
          constraints: { left: false, right: true, top: false, bottom: true },
        }),
      ],
    };
    const next = resizeScreenWithConstraints(screen, 200, 150);
    assert.equal(next.width, 200);
    assert.equal(next.height, 150);
    const a = next.nodes.find((n) => n.id === 'a');
    const b = next.nodes.find((n) => n.id === 'b');
    assert.equal(a.x, 10);
    assert.equal(a.w, 140); // 200 - 10 - 50
    assert.equal(a.y, 10);
    assert.equal(b.x, 110); // right margin 70 → 200 - 70 - 20
    assert.equal(b.y, 100); // bottom margin 30 → 150 - 30 - 20
    assert.equal(b.h, 20);
  });

  it('round-trips constraints on normalizeBoard', () => {
    const board = normalizeBoard({
      version: 1,
      screens: [
        {
          id: 's',
          name: 'S',
          width: 390,
          height: 844,
          nodes: [
            {
              id: 'n',
              type: 'rect',
              x: 0,
              y: 0,
              w: 10,
              h: 10,
              fill: '#000',
              constraints: { left: true, right: true, top: true, bottom: true },
            },
          ],
        },
      ],
    });
    assert.equal(board.version, 2);
    assert.ok(Array.isArray(board.components));
    assert.ok(Array.isArray(board.prototypes));
    assert.deepEqual(board.screens[0].nodes[0].constraints, {
      left: true,
      right: true,
      top: true,
      bottom: true,
    });
  });
});
