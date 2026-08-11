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

export const NODE_POSITION_SLOT_EXISTS_MESSAGE =
  "В одном отделе уже есть слот на эту должность (в т.ч. строка «Вакантно»). Бэкенд не позволяет второй слот с той же должностью в том же отделе — город и офис не делают слот уникальным. Удалите старую вакансию, выберите другой отдел/должность или измените город/офис у существующей.";

const KNOWN_UNIQUE_CONSTRAINTS: Record<string, string> = {
  ux_node_position_employee_notnull:
    "Этот сотрудник уже назначен на такую же должность в выбранном отделе. Освободите другую вакансию или выберите другого сотрудника.",
  node_position_slots_pkey: NODE_POSITION_SLOT_EXISTS_MESSAGE,
};

/** Имя constraint из типичного текста pq/Postgres: ... constraint "name" ... */
function extractUniqueConstraintName(message: string): string | null {
  const quoted = message.match(
    /unique constraint ["'`]([^"'`]+)["'`]/i,
  );
  if (quoted?.[1]) return quoted[1];

  const bare = message.match(/\b(ux_[a-z0-9_]+)\b/i);
  return bare?.[1] ?? null;
}

export function formatVacancyError(message: string | null | undefined): string | null {
  if (!message) return null;

  if (message.includes("missing auth cookie")) {
    return "Сессия истекла или вы не авторизованы. Обновите страницу и войдите снова.";
  }

  if (
    message.includes("assigned to") &&
    message.toLowerCase().includes("vacancy")
  ) {
    return "Нельзя удалить сотрудника, пока он назначен на вакансию. Сначала освободите вакансию.";
  }

  const constraint = extractUniqueConstraintName(message);
  if (constraint && KNOWN_UNIQUE_CONSTRAINTS[constraint]) {
    return KNOWN_UNIQUE_CONSTRAINTS[constraint];
  }

  // Прочие unique / сырые ошибки бэка — без подмены, чтобы была видна точная причина.
  return message;
}
