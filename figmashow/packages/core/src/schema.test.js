import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  duplicateSiblingNodes,
  groupSiblingNodes,
  moveNodeBy,
  normalizeBoard,
  normalizeNode,
  reorderSiblingNode,
  resizeNodeBox,
  ungroupNode,
} from '../src/schema.js';

function rect(id, x, y, w = 10, h = 10) {
  return normalizeNode({
    id,
    type: 'rect',
    x,
    y,
    w,
    h,
    fill: '#000',
  });
}

describe('normalizeBoard revision', () => {
  it('preserves revision and defaults to 0', () => {
    const a = normalizeBoard({ version: 1, screens: [] });
    assert.equal(a.revision, 0);
    const b = normalizeBoard({ version: 1, revision: 7, screens: [] });
    assert.equal(b.revision, 7);
  });
});

describe('group / ungroup', () => {
  it('groups siblings and ungroups back', () => {
    const nodes = [rect('a', 0, 0), rect('b', 20, 0), rect('c', 40, 0)];
    const g = groupSiblingNodes(nodes, ['a', 'b']);
    assert.ok(g.groupId);
    assert.equal(g.nodes.length, 2);
    const group = g.nodes.find((n) => n.id === g.groupId);
    assert.equal(group.children.length, 2);

    const u = ungroupNode(g.nodes, g.groupId);
    assert.equal(u.ok, true);
    assert.deepEqual(
      u.nodes.map((n) => n.id).sort(),
      ['a', 'b', 'c'],
    );
  });

  it('fails silently for non-siblings', () => {
    const nested = normalizeNode({
      id: 'g',
      type: 'group',
      children: [rect('a', 0, 0)],
    });
    const nodes = [nested, rect('b', 50, 0)];
    const g = groupSiblingNodes(nodes, ['a', 'b']);
    assert.equal(g.groupId, null);
  });
});

describe('move / resize / duplicate / reorder', () => {
  it('moves a node', () => {
    const nodes = [rect('a', 0, 0)];
    const r = moveNodeBy(nodes, 'a', 5, 7);
    assert.equal(r.updated.x, 5);
    assert.equal(r.updated.y, 7);
  });

  it('resizes a leaf', () => {
    const nodes = [rect('a', 10, 10, 20, 20)];
    const r = resizeNodeBox(nodes, 'a', { x: 10, y: 10, w: 40, h: 30 });
    assert.equal(r.updated.w, 40);
    assert.equal(r.updated.h, 30);
  });

  it('duplicates siblings', () => {
    const nodes = [rect('a', 0, 0), rect('b', 20, 0)];
    const r = duplicateSiblingNodes(nodes, ['a'], 10);
    assert.equal(r.clonedIds.length, 1);
    assert.equal(r.nodes.length, 3);
  });

  it('reorders siblings', () => {
    const nodes = [rect('a', 0, 0), rect('b', 20, 0), rect('c', 40, 0)];
    const r = reorderSiblingNode(nodes, 'a', 1);
    assert.equal(r.ok, true);
    assert.deepEqual(
      r.nodes.map((n) => n.id),
      ['b', 'a', 'c'],
    );
  });
});
