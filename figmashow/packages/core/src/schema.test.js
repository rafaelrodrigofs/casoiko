import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  duplicateSiblingNodes,
  groupSiblingNodes,
  moveNodeBy,
  normalizeBoard,
  normalizeNode,
  normalizeRotation,
  reorderSiblingNode,
  reparentNode,
  resizeNodeBox,
  summarizeNodeTree,
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

describe('normalizeRotation', () => {
  it('keeps degrees in [0, 360)', () => {
    assert.equal(normalizeRotation(0), 0);
    assert.equal(normalizeRotation(90), 90);
    assert.equal(normalizeRotation(360), 0);
    assert.equal(normalizeRotation(-90), 270);
    assert.equal(normalizeRotation(450), 90);
  });

  it('stores rotation on leaf nodes', () => {
    const n = normalizeNode({
      id: 'r1',
      type: 'rect',
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      rotation: 45,
      fill: '#000',
    });
    assert.equal(n.rotation, 45);
    const z = normalizeNode({
      id: 'r2',
      type: 'rect',
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      rotation: 0,
      fill: '#000',
    });
    assert.equal(z.rotation, undefined);
  });
});

describe('fill and stroke opacity', () => {
  it('normalizes independent fill/stroke alpha and preserves zero width', () => {
    const node = normalizeNode({
      id: 'paint',
      type: 'rect',
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      fill: '#112233',
      fillOpacity: 0.35,
      stroke: '#445566',
      strokeOpacity: 0.6,
      strokeWidth: 0,
    });
    assert.equal(node.fillOpacity, 0.35);
    assert.equal(node.strokeOpacity, 0.6);
    assert.equal(node.strokeWidth, 0);
    assert.equal(node.opacity, 1);
  });

  it('clamps alpha and omits stroke metadata without a stroke', () => {
    const node = normalizeNode({
      id: 'paint-clamped',
      type: 'button',
      x: 0,
      y: 0,
      w: 80,
      h: 30,
      fillOpacity: 2,
      strokeOpacity: -1,
      strokeWidth: 4,
    });
    assert.equal(node.fillOpacity, 1);
    assert.equal(node.stroke, undefined);
    assert.equal(node.strokeOpacity, undefined);
    assert.equal(node.strokeWidth, undefined);
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

describe('summarize / reparent', () => {
  it('summarizes tree without heavy props', () => {
    const nodes = [
      rect('a', 0, 0),
      normalizeNode({
        id: 'g',
        type: 'group',
        name: 'Bloco',
        children: [rect('b', 10, 10)],
      }),
    ];
    const tree = summarizeNodeTree(nodes);
    assert.equal(tree.length, 2);
    assert.equal(tree[0].id, 'a');
    assert.equal(tree[0].type, 'rect');
    assert.equal(tree[1].children[0].id, 'b');
    assert.equal('fill' in tree[0], false);
  });

  it('reparents a node into a group', () => {
    const group = normalizeNode({
      id: 'g',
      type: 'group',
      children: [rect('a', 0, 0)],
    });
    const nodes = [group, rect('b', 50, 0)];
    const r = reparentNode(nodes, 'b', 'g');
    assert.equal(r.ok, true);
    assert.equal(r.nodes.length, 1);
    assert.equal(r.nodes[0].children.length, 2);
  });
});
