import type { Edge, Node } from "@xyflow/react";
import type { OrgNode } from "#/types/api";

const NODE_WIDTH = 280;
const NODE_HEIGHT_BASE = 64;
const VACANCY_ROW_HEIGHT = 38;
const H_GAP = 24;
const V_GAP = 60;

function nodeHeight(node: OrgNode): number {
  const count =
    (node.Vacancies?.length ?? 0) + (node.EmptyVacancy?.length ?? 0);
  return NODE_HEIGHT_BASE + count * VACANCY_ROW_HEIGHT;
}

/** Ширина поддерева с учётом всех потомков */
function subtreeWidth(node: OrgNode): number {
  if (!node.Children?.length) return NODE_WIDTH;
  const childrenTotal =
    node.Children.reduce((sum, c) => sum + subtreeWidth(c), 0) +
    H_GAP * (node.Children.length - 1);
  return Math.max(NODE_WIDTH, childrenTotal);
}

/** Максимальная высота ноды на каждом уровне */
function collectLevelHeights(
  nodes: OrgNode[],
  level: number,
  out: Map<number, number>,
) {
  for (const node of nodes) {
    out.set(level, Math.max(out.get(level) ?? 0, nodeHeight(node)));
    if (node.Children?.length) collectLevelHeights(node.Children, level + 1, out);
  }
}

function levelY(level: number, heights: Map<number, number>): number {
  let y = 0;
  for (let i = 0; i < level; i++) {
    y += (heights.get(i) ?? NODE_HEIGHT_BASE) + V_GAP;
  }
  return y;
}

function placeNodes(
  node: OrgNode,
  centerX: number,
  level: number,
  parentId: string | undefined,
  heights: Map<number, number>,
  acc: { nodes: Node[]; edges: Edge[] },
) {
  const id = String(node.ID);

  acc.nodes.push({
    id,
    type: "orgNode",
    position: { x: centerX - NODE_WIDTH / 2, y: levelY(level, heights) },
    data: {
      label: node.Name,
      type: node.Type,
      code: node.Code,
      isLeaf: !node.Children?.length,
      isRoot: !parentId,
      vacancies: node.Vacancies ?? [],
      emptyVacancies: node.EmptyVacancy ?? [],
      height: nodeHeight(node),
    },
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
    const totalWidth =
      node.Children.reduce((sum, c) => sum + subtreeWidth(c), 0) +
      H_GAP * (node.Children.length - 1);
    let childX = centerX - totalWidth / 2;
    for (const child of node.Children) {
      const sw = subtreeWidth(child);
      placeNodes(child, childX + sw / 2, level + 1, id, heights, acc);
      childX += sw + H_GAP;
    }
  }
}

export function buildLayout(tree: OrgNode[]): { nodes: Node[]; edges: Edge[] } {
  const heights = new Map<number, number>();
  collectLevelHeights(tree, 0, heights);

  const acc: { nodes: Node[]; edges: Edge[] } = { nodes: [], edges: [] };

  const totalWidth =
    tree.reduce((sum, n) => sum + subtreeWidth(n), 0) +
    H_GAP * (tree.length - 1);

  let rootX = -totalWidth / 2;
  for (const root of tree) {
    const sw = subtreeWidth(root);
    placeNodes(root, rootX + sw / 2, 0, undefined, heights, acc);
    rootX += sw + H_GAP;
  }

  return acc;
}
