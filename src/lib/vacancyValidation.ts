import type { OrgNode } from "#/types/api";

export type VacancyConflict = {
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

/** Тот же сотрудник уже на этой должности в этом отделе. */
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
      for (const vacancy of node.vacancies ?? []) {
        if (vacancy.id === vacancyId) continue;
        if (vacancy.employer?.id !== userId) continue;
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

/** В отделе уже есть слот на эту должность, в том числе строка «Вакантно». */
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

export function existingPositionSlotWarning(conflict: VacancyConflict): string {
  return `В отделе «${conflict.deptName}» уже есть слот на должность «${conflict.position}». Город и офис это совпадение не снимают.`;
}

export function employeeVacancyConflictWarning(conflict: VacancyConflict): string {
  return `Сотрудник уже назначен на должность «${conflict.position}» в отделе «${conflict.deptName}».`;
}
