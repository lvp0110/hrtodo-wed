import type { OrgNode } from "#/types/api";

export const ORG_ROOT_GROUP_CODE = "akustik_group";

export function findOrgNode(
  nodes: OrgNode[],
  predicate: (node: OrgNode) => boolean,
): OrgNode | null {
  for (const node of nodes) {
    if (predicate(node)) return node;
    if (node.children?.length) {
      const found = findOrgNode(node.children, predicate);
      if (found) return found;
    }
  }
  return null;
}

export function findOrgRootGroup(nodes: OrgNode[]): OrgNode | null {
  return findOrgNode(nodes, (node) => node.code === ORG_ROOT_GROUP_CODE);
}

export type DepartmentTreeData = {
  rootLabel: string;
  departments: OrgNode[];
};

export function getDepartmentTree(nodes: OrgNode[]): DepartmentTreeData {
  const root = findOrgRootGroup(nodes);
  if (!root) {
    return { rootLabel: "Все отделы", departments: [] };
  }

  return {
    rootLabel: root.name,
    departments: root.children ?? [],
  };
}

export function findOrgNodeById(
  nodes: OrgNode[],
  id: number,
): OrgNode | null {
  return findOrgNode(nodes, (node) => node.id === id);
}

export function findOrgNodeByName(
  nodes: OrgNode[],
  name: string,
): OrgNode | null {
  return findOrgNode(nodes, (node) => node.name === name);
}

/** ID предков узла — чтобы раскрыть путь к выбранному отделу. */
export function ancestorIdsForNode(
  nodes: OrgNode[],
  targetId: number,
  path: number[] = [],
): number[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return path;
    if (node.children?.length) {
      const found = ancestorIdsForNode(node.children, targetId, [
        ...path,
        node.id,
      ]);
      if (found) return found;
    }
  }
  return null;
}

function matchesDepartmentQuery(name: string, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return name.toLowerCase().includes(normalized);
}

/** Оставляет ветки, где совпадает название узла или потомка. */
export function filterDepartmentTree(
  nodes: OrgNode[],
  query: string,
): OrgNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return nodes;

  const result: OrgNode[] = [];

  for (const node of nodes) {
    const filteredChildren = node.children?.length
      ? filterDepartmentTree(node.children, query)
      : [];
    const selfMatches = matchesDepartmentQuery(node.name, query);

    if (selfMatches || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: selfMatches ? (node.children ?? []) : filteredChildren,
      });
    }
  }

  return result;
}

export function expandableDepartmentIds(nodes: OrgNode[]): number[] {
  const ids: number[] = [];

  for (const node of nodes) {
    if (node.children?.length) {
      ids.push(node.id, ...expandableDepartmentIds(node.children));
    }
  }

  return ids;
}
