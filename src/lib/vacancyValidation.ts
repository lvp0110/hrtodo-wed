import type { OrgNode } from "#/types/api";

export {
  NODE_POSITION_SLOT_EXISTS_MESSAGE,
  formatVacancyError,
} from "#/lib/apiError";

type VacancyConflict = {
  vacancyId: number;
  deptName: string;
  position: string;
};

function positionMatches(
  vacancyPosition: { code?: string; name?: string } | null | undefined,
  positionKey: string,
): boolean {
  const key = positionKey.trim().toLowerCase();
  if (!key) return false;

  const code = vacancyPosition?.code?.trim().toLowerCase() ?? "";
  const name = vacancyPosition?.name?.trim().toLowerCase() ?? "";

  return code === key || name === key;
}

export function findEmployeeVacancyConflict(
  nodes: OrgNode[],
  vacancyId: number,
  nodeId: number,
  positionKey: string,
  userId: number | null,
): VacancyConflict | null {
  if (!userId) return null;

  function walk(nodeList: OrgNode[]): VacancyConflict | null {
    for (const node of nodeList) {
      for (const vacancy of node.vacancies) {
        if (vacancy.id === vacancyId) continue;
        if (vacancy.employer.id !== userId) continue;
        if (vacancy.node_id !== nodeId) continue;
        if (!positionMatches(vacancy.position, positionKey)) continue;

        return {
          vacancyId: vacancy.id,
          deptName: node.name,
          position:
            vacancy.position?.name ?? vacancy.position?.code ?? positionKey,
        };
      }

      const inChild = walk(node.children);
      if (inChild) return inChild;
    }

    return null;
  }

  return walk(nodes);
}

/** Уже есть слот (занятый или «Вакантно») на должность в отделе — InsertVacancy даст node_position_slots_pkey. */
export function findExistingPositionSlot(
  nodes: OrgNode[],
  nodeId: number,
  positionKey: string,
): VacancyConflict | null {
  function walk(nodeList: OrgNode[]): VacancyConflict | null {
    for (const node of nodeList) {
      for (const vacancy of node.vacancies ?? []) {
        if (vacancy.node_id !== nodeId) continue;
        if (!positionMatches(vacancy.position, positionKey)) continue;

        return {
          vacancyId: vacancy.id,
          deptName: node.name,
          position:
            vacancy.position?.name ?? vacancy.position?.code ?? positionKey,
        };
      }

      const inChild = walk(node.children ?? []);
      if (inChild) return inChild;
    }

    return null;
  }

  return walk(nodes);
}

