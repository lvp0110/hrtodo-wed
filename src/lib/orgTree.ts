import type { OrgNode, Vacancy } from "#/types/api";

export const ORG_ROOT_GROUP_CODE = "akustik_group";

function vacancyEmployerLabel(vacancy: Vacancy): string {
  if (!vacancy.employer?.id) return "Вакантно";
  const { surname, first_name, second_name } = vacancy.employer;
  return [surname, first_name, second_name].filter(Boolean).join(" ");
}

/**
 * Руководитель должности: вакансия с is_manager в том же отделе
 * (для руководящей — в родительском и выше по дереву).
 */
export function findManagerForVacancy(
  nodes: OrgNode[],
  nodeId: number,
  vacancyId: number,
  isManager: boolean,
): { name: string; position: string } | null {
  const parentById = new Map<number, number | null>();
  const nodeById = new Map<number, OrgNode>();

  function index(list: OrgNode[], parentId: number | null) {
    for (const node of list) {
      parentById.set(node.id, parentId);
      nodeById.set(node.id, node);
      if (node.children?.length) index(node.children, node.id);
    }
  }
  index(nodes, null);

  function managerInNode(node: OrgNode): Vacancy | null {
    return (
      node.vacancies.find(
        (vacancy) => vacancy.is_manager && vacancy.id !== vacancyId,
      ) ?? null
    );
  }

  let currentId: number | null = isManager
    ? (parentById.get(nodeId) ?? null)
    : nodeId;

  while (currentId != null) {
    const node = nodeById.get(currentId);
    if (!node) break;

    const manager = managerInNode(node);
    if (manager) {
      return {
        name: vacancyEmployerLabel(manager),
        position: manager.position?.name ?? manager.position?.code ?? "",
      };
    }

    currentId = parentById.get(currentId) ?? null;
  }

  return null;
}

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
