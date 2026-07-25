import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBoard } from '../src/schema.js';
import {
  expandInteraction,
  simulateWorkflow,
  findInteractionByTrigger,
  seedLoginWorkflow,
  classifyWorkflowPathNodes,
  layoutWorkflowAlongPath,
  insertStepOnMainPath,
} from '../src/domain.js';

describe('domain interactions', () => {
  it('normalizeBoard seeds empty domain', () => {
    const board = normalizeBoard({ screens: [] });
    assert.ok(board.domain);
    assert.equal(board.domain.version, 2);
    assert.deepEqual(board.domain.interactions, []);
    assert.deepEqual(board.domain.workflows, []);
    assert.ok(board.domainViews);
  });

  it('expandInteraction creates interaction as primary id', () => {
    const { domain, interaction, workflow, created } = expandInteraction({
      domain: null,
      screenId: 'scr_a',
      nodeId: 'btn_1',
      name: 'Entrar',
      prototypeLinkId: 'proto_1',
      toScreenId: 'scr_b',
      transition: 'dissolve',
    });
    assert.equal(created, true);
    assert.ok(interaction.id.startsWith('ix_'));
    assert.equal(interaction.prototypeLinkId, 'proto_1');
    assert.equal(interaction.workflowId, workflow.id);
    assert.equal(workflow.interactionId, interaction.id);
    assert.equal(workflow.nodes.length, 1);
    assert.equal(workflow.nodes[0].kind, 'navigate');
    assert.equal(domain.interactions.length, 1);
    assert.equal(
      findInteractionByTrigger(domain, 'scr_a', 'btn_1')?.id,
      interaction.id,
    );
  });

  it('expand without toScreenId ends in showMessage not navigate', () => {
    const { workflow } = expandInteraction({
      domain: null,
      screenId: 's1',
      nodeId: 'n1',
      name: 'Ação',
    });
    assert.equal(workflow.nodes.length, 1);
    assert.equal(workflow.nodes[0].kind, 'showMessage');
  });

  it('simulateWorkflow can navigate or message', () => {
    const { workflow } = expandInteraction({
      domain: null,
      screenId: 's1',
      nodeId: 'n1',
      toScreenId: 'home',
    });
    const ok = simulateWorkflow(workflow, { forceOutcome: 'success' });
    assert.equal(ok.outcome, 'navigate');
    assert.equal(ok.navigate.toScreenId, 'home');

    const msgWf = {
      ...workflow,
      entryNodeId: 'wn_err',
      nodes: [
        {
          id: 'wn_err',
          kind: 'showMessage',
          name: 'Erro',
          config: { message: 'falhou' },
        },
      ],
      edges: [],
    };
    const err = simulateWorkflow(msgWf);
    assert.equal(err.outcome, 'message');
    assert.equal(err.message, 'falhou');
  });

  it('expandInteraction layoutOrigin anchors view beside frame', () => {
    const { domainViews, workflow } = expandInteraction({
      domain: null,
      screenId: 'scr_a',
      nodeId: 'btn_1',
      toScreenId: 'scr_b',
      layoutOrigin: { x: 500, y: 120 },
    });
    const view = domainViews.workflows.find(
      (v) => v.workflowId === workflow.id,
    );
    assert.ok(view);
    assert.equal(view.nodes[0].x, 500);
    assert.equal(view.nodes[0].y, 120);
  });

  it('seedLoginWorkflow creates branched login graph', () => {
    const { workflow, domain } = seedLoginWorkflow({
      domain: null,
      screenId: 'scr_login',
      nodeId: 'btn_enter',
      toScreenId: 'scr_home',
      transition: 'dissolve',
      layoutOrigin: { x: 460, y: 0 },
    });
    assert.equal(workflow.nodes.length, 5);
    assert.ok(workflow.nodes.some((n) => n.kind === 'validate'));
    assert.ok(workflow.nodes.some((n) => n.kind === 'branch'));
    assert.ok(workflow.edges.some((e) => e.when === 'success'));
    assert.ok(workflow.edges.some((e) => e.when === 'error'));
    assert.ok(domain.apis.length >= 1);
    const sim = simulateWorkflow(workflow, { forceOutcome: 'success' });
    assert.equal(sim.outcome, 'navigate');
    assert.equal(sim.navigate.toScreenId, 'scr_home');
  });

  it('layoutWorkflowAlongPath places onPath nodes on given points', () => {
    const { workflow, domainViews } = seedLoginWorkflow({
      domain: null,
      screenId: 'scr_login',
      nodeId: 'btn_enter',
      toScreenId: 'scr_home',
      layoutOrigin: { x: 0, y: 0 },
    });
    const { onPath } = classifyWorkflowPathNodes(workflow);
    assert.ok(onPath.length >= 3);
    const pts = onPath.map((_, i) => ({ x: 100 + i * 50, y: 200 }));
    const views = layoutWorkflowAlongPath(domainViews, workflow, pts);
    const view = views.workflows.find((v) => v.workflowId === workflow.id);
    assert.equal(view.nodes.length, onPath.length + 1); // + side Mensagem
    assert.equal(view.nodes.find((n) => n.nodeId === onPath[0]).x, 100 - 84);
  });

  it('insertStepOnMainPath inserts before navigate', () => {
    const { workflow } = expandInteraction({
      domain: null,
      screenId: 's1',
      nodeId: 'n1',
      toScreenId: 'home',
    });
    assert.equal(workflow.nodes[0].kind, 'navigate');
    const next = insertStepOnMainPath(workflow, 'validate', {
      simulate: 'success',
    });
    assert.equal(next.entryNodeId !== workflow.entryNodeId || next.nodes.length === 2, true);
    assert.equal(next.nodes.length, 2);
    assert.ok(next.nodes.some((n) => n.kind === 'validate'));
    assert.ok(next.edges.some((e) => true));
  });
});
