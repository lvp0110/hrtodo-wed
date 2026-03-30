import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { OrgNode } from "#/types/api";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;

function flattenTree(
  nodes: OrgNode[],
  parentId?: string,
  acc: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] },
) {
  for (const node of nodes) {
    const id = String(node.ID);

    acc.nodes.push({
      id,
      type: "orgNode",
      position: { x: 0, y: 0 },
      data: { label: node.Name, type: node.Type, code: node.Code, isLeaf: !node.Children?.length, isRoot: !parentId },
    });

    if (parentId) {
      acc.edges.push({
        id: `${parentId}-${id}`,
        source: parentId,
        target: id,
        type: "smoothstep",
      });
    }

    if (node.Children?.length) {
      flattenTree(node.Children, id, acc);
    }
  }

  return acc;
}

export function buildLayout(tree: OrgNode[]): { nodes: Node[]; edges: Edge[] } {
  const { nodes, edges } = flattenTree(tree);

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 60, nodesep: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const { x, y } = g.node(node.id);
    return {
      ...node,
      position: {
        x: x - NODE_WIDTH / 2,
        y: y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
