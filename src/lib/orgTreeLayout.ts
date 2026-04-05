import type { Edge, Node } from "@xyflow/react";
import type { OrgNode } from "#/types/api";

const NODE_WIDTH = 280;
const NODE_HEIGHT_BASE = 64;
const VACANCY_ROW_HEIGHT = 46;
const ADD_VACANCY_ROW_HEIGHT = 46; // строка "+" внизу списка вакансий
const H_GAP = 24;
const V_GAP = 60;
export const ADD_NODE_WIDTH = 280;
export const ADD_NODE_HEIGHT = 80;

function nodeHeight(node: OrgNode): number {
  const count =
    (node.Vacancies?.length ?? 0) + (node.EmptyVacancy?.length ?? 0);
  return NODE_HEIGHT_BASE + count * VACANCY_ROW_HEIGHT + ADD_VACANCY_ROW_HEIGHT;
}

/** Ширина поддерева с учётом всех потомков и ноды "+" */
function subtreeWidth(node: OrgNode): number {
  const realChildren = node.Children ?? [];
  const allWidths = [...realChildren.map(subtreeWidth), ADD_NODE_WIDTH];
  const totalChildrenWidth =
    allWidths.reduce((sum, w) => sum + w, 0) + H_GAP * (allWidths.length - 1);
  return Math.max(NODE_WIDTH, totalChildrenWidth);
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

  const realChildren = node.Children ?? [];

  acc.nodes.push({
    id,
    type: "orgNode",
    position: { x: centerX - NODE_WIDTH / 2, y: levelY(level, heights) },
    data: {
      label: node.Name,
      type: node.Type,
      code: node.Code,
      isLeaf: false,
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

  // Размещаем реальных детей + ноду "+"
  const allWidths = [...realChildren.map(subtreeWidth), ADD_NODE_WIDTH];
  const totalWidth =
    allWidths.reduce((sum, w) => sum + w, 0) + H_GAP * (allWidths.length - 1);

  let childX = centerX - totalWidth / 2;

  for (const child of realChildren) {
    const sw = subtreeWidth(child);
    placeNodes(child, childX + sw / 2, level + 1, id, heights, acc);
    childX += sw + H_GAP;
  }

  // Нода "+"
  const addNodeId = `add-${id}`;
  acc.nodes.push({
    id: addNodeId,
    type: "addNode",
    position: {
      x: childX,
      y: levelY(level + 1, heights),
    },
    selectable: false,
    data: { parentId: id, parentLabel: node.Name },
  });
  acc.edges.push({
    id: `${id}-${addNodeId}`,
    source: id,
    target: addNodeId,
    type: "smoothstep",
    style: { strokeDasharray: "4 4", opacity: 0.35 },
  });
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
