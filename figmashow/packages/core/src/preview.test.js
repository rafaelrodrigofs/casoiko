import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Espelha MiniNode: coordenadas locais ao frame (sem subtrair screen.x/y). */
function miniNodeLeft(node, scale) {
  return node.x * scale;
}

describe('preview node coordinates', () => {
  it('usa coordenadas locais da tela, não canvas global', () => {
    const node = { x: 20, y: 30 };
    const screen = { x: 500, y: 100 };
    const scale = 0.12;
    const wrong = (node.x - screen.x) * scale;
    const right = miniNodeLeft(node, scale);
    assert.ok(right > 0);
    assert.ok(wrong < 0);
    assert.equal(right, 2.4);
  });
});
