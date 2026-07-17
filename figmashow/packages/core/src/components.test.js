import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeNode } from '../src/schema.js';
import {
  addComponentVariant,
  createComponentFromNodes,
  createInstance,
  detachInstance,
  localTreeAabb,
  normalizeComponents,
  replaceDuplicatedMainsWithInstances,
  resolveInstanceTree,
  syncAllComponentDefs,
  switchInstanceVariant,
} from '../src/components.js';
import { duplicateSiblingNodes } from '../src/schema.js';

function rect(id, x, y, w = 20, h = 10, fill = '#000') {
  return normalizeNode({
    id,
    type: 'rect',
    x,
    y,
    w,
    h,
    fill,
  });
}

describe('normalizeComponents', () => {
  it('normalizes empty / invalid input', () => {
    assert.deepEqual(normalizeComponents(null), []);
    assert.deepEqual(normalizeComponents(undefined), []);
  });

  it('fills ids and normalizes variant roots', () => {
    const list = normalizeComponents([
      {
        name: 'Card',
        variants: [{ name: 'Default', root: { type: 'rect', x: 0, y: 0, w: 40, h: 20 } }],
      },
    ]);
    assert.equal(list.length, 1);
    assert.ok(list[0].id);
    assert.equal(list[0].name, 'Card');
    assert.equal(list[0].variants[0].name, 'Default');
    assert.equal(list[0].variants[0].root.type, 'rect');
    assert.equal(list[0].variants[0].root.w, 40);
  });
});

describe('createComponentFromNodes', () => {
  it('creates component from a single selected node in local coords', () => {
    const nodes = [rect('a', 100, 50, 40, 20), rect('b', 200, 50)];
    const result = createComponentFromNodes(nodes, ['a'], 'Button');
    assert.ok(result.component);
    assert.equal(result.component.name, 'Button');
    assert.deepEqual(result.removedIds, ['a']);
    assert.ok(result.mainNode);
    assert.equal(result.mainNode.type, 'component');
    assert.equal(result.mainNode.componentId, result.component.id);
    assert.equal(result.remainingNodes.length, 2);
    assert.equal(result.remainingNodes[0].type, 'component');
    assert.equal(result.remainingNodes[1].id, 'b');

    const root = result.component.variants[0].root;
    assert.equal(result.component.variants[0].name, 'Default');
    assert.equal(root.x, 0);
    assert.equal(root.y, 0);
    assert.equal(root.w, 40);
    assert.equal(root.h, 20);
    assert.notEqual(root.id, 'a');
  });

  it('wraps multiple siblings in a local group', () => {
    const nodes = [rect('a', 10, 20, 10, 10), rect('b', 30, 20, 10, 10)];
    const result = createComponentFromNodes(nodes, ['a', 'b'], 'Pair');
    assert.ok(result.component);
    assert.ok(result.mainNode);
    assert.equal(result.mainNode.type, 'component');
    assert.equal(result.mainNode.children.length, 2);
    const root = result.component.variants[0].root;
    assert.equal(root.type, 'group');
    assert.equal(root.x, 0);
    assert.equal(root.y, 0);
    assert.equal(root.w, 30);
    assert.equal(root.h, 10);
    assert.equal(root.children.length, 2);
    assert.equal(root.children[0].x, 0);
    assert.equal(root.children[0].y, 0);
    assert.equal(root.children[1].x, 20);
    assert.equal(root.children[1].y, 0);
    assert.equal(result.remainingNodes.length, 1);
    assert.equal(result.remainingNodes[0].type, 'component');
  });

  it('fails for non-sibling selection', () => {
    const nested = normalizeNode({
      id: 'g',
      type: 'group',
      children: [rect('a', 0, 0)],
    });
    const nodes = [nested, rect('b', 50, 0)];
    const result = createComponentFromNodes(nodes, ['a', 'b']);
    assert.equal(result.component, null);
    assert.equal(result.removedIds.length, 0);
  });
});

describe('instantiate / switch / detach', () => {
  it('creates instance, switches variant, and detaches to absolute tree', () => {
    const nodes = [rect('a', 40, 60, 50, 24, '#1B355A')];
    const { component } = createComponentFromNodes(nodes, ['a'], 'CTA');
    assert.ok(component);

    const taller = normalizeNode({
      type: 'rect',
      x: 0,
      y: 0,
      w: 50,
      h: 48,
      fill: '#0F766E',
    });
    const withVariant = addComponentVariant(component, taller, 'Tall');
    assert.equal(withVariant.variants.length, 2);
    assert.equal(withVariant.variants[1].name, 'Tall');

    const instance = createInstance(withVariant, undefined, 120, 80);
    assert.equal(instance.type, 'instance');
    assert.equal(instance.componentId, withVariant.id);
    assert.equal(instance.variantId, withVariant.variants[0].id);
    assert.equal(instance.x, 120);
    assert.equal(instance.y, 80);
    assert.equal(instance.w, 50);
    assert.equal(instance.h, 24);
    assert.equal(instance.name, 'CTA');

    const switched = switchInstanceVariant(
      instance,
      withVariant,
      withVariant.variants[1].id,
    );
    assert.equal(switched.variantId, withVariant.variants[1].id);
    assert.equal(switched.w, 50);
    assert.equal(switched.h, 48);

    const detached = detachInstance(switched, withVariant);
    assert.equal(detached.type, 'rect');
    assert.equal(detached.x, 120);
    assert.equal(detached.y, 80);
    assert.equal(detached.w, 50);
    assert.equal(detached.h, 48);
    assert.equal(detached.fill, '#0F766E');
    assert.notEqual(detached.id, withVariant.variants[1].root.id);

    const resolved = resolveInstanceTree(switched, [withVariant]);
    assert.equal(resolved.x, 120);
    assert.equal(resolved.y, 80);
    assert.equal(resolved.h, 48);
  });
});

describe('rotated component AABB', () => {
  it('sizes instance by axis-aligned bounds of rotated root', () => {
    const nodes = [
      normalizeNode({
        id: 'rot',
        type: 'rect',
        x: 10,
        y: 20,
        w: 100,
        h: 40,
        rotation: 90,
        fill: '#93C5FD',
      }),
    ];
    const { component, origin, mainNode } = createComponentFromNodes(
      nodes,
      ['rot'],
      'Rot',
    );
    assert.ok(component);
    assert.ok(origin);
    assert.ok(mainNode);
    assert.equal(mainNode.type, 'component');

    const root = component.variants[0].root;
    const aabb = localTreeAabb(root);
    assert.ok(Math.abs(aabb.x) < 0.001);
    assert.ok(Math.abs(aabb.y) < 0.001);
    // 90° troca visualmente w↔h
    assert.ok(Math.abs(aabb.w - 40) < 0.001);
    assert.ok(Math.abs(aabb.h - 100) < 0.001);

    const instance = createInstance(component, undefined, origin.x, origin.y);
    assert.ok(Math.abs(instance.w - 40) < 0.001);
    assert.ok(Math.abs(instance.h - 100) < 0.001);
  });
});

describe('duplicate main becomes instance', () => {
  it('replaceDuplicatedMainsWithInstances swaps main clone for instance', () => {
    const nodes = [rect('a', 0, 0, 40, 20)];
    const { component, remainingNodes, mainNode } = createComponentFromNodes(
      nodes,
      ['a'],
      'Btn',
    );
    assert.ok(mainNode);
    const dup = duplicateSiblingNodes(remainingNodes, [mainNode.id], 10);
    assert.equal(dup.clonedIds.length, 1);
    const replaced = replaceDuplicatedMainsWithInstances(
      dup.nodes,
      dup.clonedIds,
      [component],
    );
    const clone = replaced.nodes.find((n) => n.id === replaced.ids[0]);
    assert.equal(clone.type, 'instance');
    assert.equal(clone.componentId, component.id);
    const stillMain = replaced.nodes.find((n) => n.type === 'component');
    assert.ok(stillMain);
  });
});

describe('sync instance size from main', () => {
  it('updates instance w/h when main children change size', () => {
    const nodes = [rect('a', 10, 10, 40, 20, '#F00')];
    const { component, remainingNodes, mainNode } = createComponentFromNodes(
      nodes,
      ['a'],
      'Card',
    );
    const instance = createInstance(component, undefined, 200, 10);
    assert.equal(instance.w, 40);
    assert.equal(instance.h, 20);

    const main = {
      ...mainNode,
      children: [{ ...mainNode.children[0], w: 80, h: 50 }],
      w: 80,
      h: 50,
    };
    const board = syncAllComponentDefs({
      components: [component],
      screens: [{ id: 's1', nodes: [main, instance] }],
    });
    const syncedInst = board.screens[0].nodes.find((n) => n.type === 'instance');
    assert.equal(syncedInst.w, 80);
    assert.equal(syncedInst.h, 50);
    assert.equal(board.components[0].variants[0].root.w, 80);
    assert.equal(board.components[0].variants[0].root.h, 50);
  });
});

describe('missing variant placeholder', () => {
  it('returns placeholder when component is missing', () => {
    const instance = {
      id: 'inst_1',
      type: /** @type {const} */ ('instance'),
      componentId: 'gone',
      variantId: 'v1',
      x: 10,
      y: 20,
      w: 80,
      h: 30,
    };
    const tree = resolveInstanceTree(instance, []);
    assert.equal(tree.type, 'rect');
    assert.equal(tree.name, 'Missing component');
    assert.equal(tree.fill, '#F1F5F9');
    assert.equal(tree.x, 10);
    assert.equal(tree.y, 20);
    assert.equal(tree.w, 80);
    assert.equal(tree.h, 30);
  });

  it('detachInstance returns placeholder without component', () => {
    const instance = {
      id: 'inst_2',
      type: /** @type {const} */ ('instance'),
      componentId: 'c',
      variantId: 'v',
      x: 0,
      y: 0,
      w: 40,
      h: 20,
    };
    const tree = detachInstance(instance, null);
    assert.equal(tree.name, 'Missing component');
    assert.equal(tree.fill, '#F1F5F9');
  });
});
