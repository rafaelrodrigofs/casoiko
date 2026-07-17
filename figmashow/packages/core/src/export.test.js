import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeNode } from '../src/schema.js';
import {
  sanitizeDownloadName,
  screenToCss,
  screenToReact,
} from '../src/export.js';

function sampleScreen() {
  return {
    id: 'screen_login',
    name: 'Login',
    width: 390,
    height: 844,
    background: '#FFFFFF',
    x: 0,
    y: 0,
    nodes: [
      normalizeNode({
        id: 'hero',
        type: 'rect',
        name: 'Hero',
        x: 0,
        y: 0,
        w: 390,
        h: 200,
        fill: '#112233',
        fillOpacity: 0.8,
        cornerRadius: 0,
      }),
      normalizeNode({
        id: 'title',
        type: 'text',
        name: 'Title',
        x: 24,
        y: 40,
        w: 300,
        h: 40,
        text: 'Olá',
        color: '#111111',
        fontSize: 28,
        fontWeight: 700,
      }),
      normalizeNode({
        id: 'cta',
        type: 'button',
        name: 'CTA',
        x: 24,
        y: 700,
        w: 342,
        h: 48,
        label: 'Entrar',
        fill: '#0D99FF',
        textColor: '#FFFFFF',
        cornerRadius: 12,
        stroke: '#003366',
        strokeWidth: 1,
        strokeOpacity: 0.5,
      }),
      normalizeNode({
        id: 'g1',
        type: 'group',
        name: 'Bloco',
        children: [
          normalizeNode({
            id: 'img1',
            type: 'image',
            name: 'Logo',
            x: 40,
            y: 220,
            w: 80,
            h: 80,
            src: '/assets/logo.png',
            fit: 'contain',
          }),
        ],
      }),
      normalizeNode({
        id: 'hidden',
        type: 'rect',
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        fill: '#ff0000',
        hidden: true,
      }),
    ],
  };
}

describe('screenToCss / screenToReact', () => {
  it('emits screen frame and visible nodes', () => {
    const css = screenToCss(sampleScreen());
    assert.match(css, /\.login \{/);
    assert.match(css, /width: 390px;/);
    assert.match(css, /height: 844px;/);
    assert.match(css, /\.hero \{/);
    assert.match(css, /rgba\(17, 34, 51, 0\.8\)/);
    assert.match(css, /\.cta \{/);
    assert.match(css, /border: 1px solid rgba\(0, 51, 102, 0\.5\)/);
    assert.match(css, /\.bloco \{/);
    assert.match(css, /\.logo img \{/);
    assert.equal(/\.hidden\b/.test(css), false);
  });

  it('emits readable JSX with text/button/image', () => {
    const jsx = screenToReact(sampleScreen());
    assert.match(jsx, /export default function Login\(\)/);
    assert.match(jsx, /Olá/);
    assert.match(jsx, /Entrar/);
    assert.match(jsx, /\/assets\/logo\.png/);
    assert.match(jsx, /width: 390/);
    assert.equal(jsx.includes('#ff0000'), false);
  });

  it('sanitizes download names', () => {
    assert.equal(sanitizeDownloadName('Tela A/B'), 'Tela_A_B');
    assert.equal(sanitizeDownloadName(''), 'screen');
  });
});
