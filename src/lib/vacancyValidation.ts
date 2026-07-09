import type { OrgNode } from "#/types/api";

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

export function formatVacancyError(message: string | null | undefined): string | null {
  if (!message) return null;

  if (
    message.includes("ux_node_position_employee_notnull") ||
    message.includes("SQLSTATE 23505")
  ) {
    return "Этот сотрудник уже назначен на такую же должность в выбранном отделе. Освободите другую вакансию или выберите другого сотрудника.";
  }

  return message;
}
