import {
  insertLogicStepOnPrototype,
  classifyWorkflowPathNodes,
} from '../packages/core/src/domain.js';
import { samplePointsAlongPrototypeLink } from '../packages/core/src/prototypePath.js';

const screens = [
  {
    id: 's1',
    name: 'Login',
    x: 0,
    y: 0,
    width: 390,
    height: 844,
    nodes: [
      {
        id: 'btn',
        type: 'button',
        name: 'Entrar',
        x: 40,
        y: 400,
        w: 310,
        h: 48,
      },
    ],
  },
  {
    id: 's2',
    name: 'Home',
    x: 500,
    y: 0,
    width: 390,
    height: 844,
    nodes: [],
  },
];
const prototypes = [
  {
    id: 'proto1',
    fromScreenId: 's1',
    triggerNodeId: 'btn',
    toScreenId: 's2',
    transition: 'instant',
    fromSide: 'right',
  },
];

let domain = null;
let domainViews = null;
const r1 = insertLogicStepOnPrototype({
  domain,
  domainViews,
  screens,
  prototypes,
  linkId: 'proto1',
  kind: 'validate',
});
domain = r1.domain;
domainViews = r1.domainViews;
const r2 = insertLogicStepOnPrototype({
  domain,
  domainViews,
  screens,
  prototypes,
  linkId: 'proto1',
  kind: 'apiCall',
});
const { onPath } = classifyWorkflowPathNodes(r2.workflow);
const pts = samplePointsAlongPrototypeLink(screens, prototypes[0], onPath.length);
const ok =
  r2.workflow.nodes.some((n) => n.kind === 'validate') &&
  r2.workflow.nodes.some((n) => n.kind === 'apiCall') &&
  r2.workflow.nodes.some((n) => n.kind === 'navigate') &&
  pts.length === onPath.length &&
  (r2.domainViews.workflows[0]?.nodes?.length || 0) >= onPath.length;

console.log(
  JSON.stringify(
    {
      ok,
      kinds: r2.workflow.nodes.map((n) => n.kind),
      onPathLen: onPath.length,
      pts: pts.length,
      viewNodes: r2.domainViews.workflows[0]?.nodes?.length,
    },
    null,
    2,
  ),
);
if (!ok) process.exit(1);
