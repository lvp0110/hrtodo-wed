export const NODE_POSITION_SLOT_EXISTS_MESSAGE =
  "В одном отделе уже есть слот на эту должность (в т.ч. строка «Вакантно»). Бэкенд не позволяет второй слот с той же должностью в том же отделе — город и офис не делают слот уникальным.";

const UNIQUE_CONSTRAINTS: Record<string, string> = {
  ux_node_position_employee_notnull:
    "Этот сотрудник уже назначен на такую же должность в выбранном отделе. Освободите другую вакансию или выберите другого сотрудника.",
  node_position_slots_pkey: NODE_POSITION_SLOT_EXISTS_MESSAGE,
  countries_code_key: "Страна с таким кодом уже есть.",
  cities_code_key: "Город с таким кодом уже есть.",
  org_nodes_code_key: "Подразделение с таким кодом уже есть.",
  org_nodes_types_code_key: "Тип подразделения с таким кодом уже есть.",
  users_email_key: "Пользователь с такой почтой уже есть.",
  roles_name_key: "Роль с таким названием уже есть.",
};

const FOREIGN_KEYS: Record<string, string> = {
  cities_country_id_fkey:
    "Нельзя удалить страну: к ней привязаны города. Сначала удалите или перенесите эти города.",
  office_city_id_fkey:
    "Нельзя удалить город: к нему привязаны офисы. Сначала удалите или перенесите эти офисы.",
  org_nodes_type_id_fkey:
    "Нельзя удалить тип подразделения: он используется в структуре.",
  org_nodes_parent_id_fkey:
    "Нельзя удалить подразделение: внутри есть вложенные узлы. Сначала перенесите или удалите их.",
  node_position_slots_node_id_fkey:
    "Нельзя удалить подразделение: в нём есть вакансии. Сначала удалите их.",
  node_position_slots_employee_id_fkey:
    "Нельзя удалить сотрудника: он назначен на вакансию. Сначала освободите позицию.",
  fk_node_position_slots_office:
    "Нельзя удалить офис: к нему привязаны вакансии. Сначала удалите или перенесите их.",
  users_role_id_fkey: "Нельзя удалить роль: она назначена пользователям.",
};

const FALLBACK = "Сервер не разрешил это действие. Попробуйте ещё раз.";

function ruCount(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : many;
  return `${n} ${word}`;
}

function readError(error: unknown): { message: string; code?: number } {
  if (!error) return { message: "" };
  if (typeof error === "string") return { message: error };
  if (typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown };
    return {
      message: typeof record.message === "string" ? record.message : "",
      code: typeof record.code === "number" ? record.code : undefined,
    };
  }
  return { message: "" };
}

function extractQuotedConstraint(message: string): string | null {
  const quoted = message.match(/constraint ["'`]([^"'`]+)["'`]/i);
  if (quoted?.[1]) return quoted[1];
  const bare = message.match(/\b(ux_[a-z0-9_]+)\b/i);
  return bare?.[1] ?? null;
}

function isArchivedAssignmentConflict(message: string): boolean {
  return /archiv|архив|not active/i.test(message);
}

function blockedActionMessage(message: string): string | null {
  const childMatch = message.match(/cannot delete node with (\d+) child/i);
  if (childMatch) {
    const count = ruCount(
      Number(childMatch[1]),
      "вложенный узел",
      "вложенных узла",
      "вложенных узлов",
    );
    return `Нельзя удалить подразделение: внутри ${count}. Сначала перенесите или удалите их.`;
  }

  const officeMatch = message.match(/cannot delete office: it has (\d+)/i);
  if (officeMatch) {
    const n = Number(officeMatch[1]);
    const vacancies = ruCount(n, "вакансия", "вакансии", "вакансий");
    const verb = n % 10 === 1 && n % 100 !== 11 ? "привязана" : "привязано";
    return `Нельзя удалить офис: к нему ${verb} ${vacancies}. Сначала удалите или перенесите их.`;
  }

  const employeeMatch = message.match(
    /cannot delete employee: they are assigned to (\d+)/i,
  );
  if (employeeMatch) {
    const vacancies = ruCount(
      Number(employeeMatch[1]),
      "вакансию",
      "вакансии",
      "вакансий",
    );
    return `Нельзя удалить сотрудника: он назначен на ${vacancies}. Сначала освободите позиции.`;
  }

  if (/assigned to/i.test(message) && /vacanc/i.test(message)) {
    return "Нельзя удалить сотрудника, пока он назначен на вакансию. Сначала освободите вакансию.";
  }

  return null;
}

/** Текст ошибки сервера для модалки: без SQL и внутренних имён операций. */
export function formatApiError(error: unknown): string | null {
  const { message, code } = readError(error);
  if (!message && code == null) return null;

  if (
    /[а-яё]/i.test(message) &&
    !/sqlstate|constraint|pq:/i.test(message)
  ) {
    return message;
  }

  if (/missing auth cookie|invalid or expired token|missing refresh cookie|refresh session/i.test(message)) {
    return "Сессия истекла или вы не авторизованы. Обновите страницу и войдите снова.";
  }

  if (/invalid credential/i.test(message)) {
    return "Неверный email или пароль.";
  }

  if (/csrf/i.test(message)) {
    return "Сессия устарела. Обновите страницу и повторите действие.";
  }

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return "Нет связи с сервером. Проверьте подключение и повторите.";
  }

  const blocked = blockedActionMessage(message);
  if (blocked) return blocked;

  const constraint = extractQuotedConstraint(message);
  if (constraint && UNIQUE_CONSTRAINTS[constraint]) {
    return UNIQUE_CONSTRAINTS[constraint];
  }
  if (constraint && FOREIGN_KEYS[constraint]) {
    return FOREIGN_KEYS[constraint];
  }

  if (/foreign key constraint/i.test(message)) {
    return "Нельзя выполнить действие: запись используется в других данных. Сначала уберите связанные записи.";
  }

  if (/unique constraint|duplicate key/i.test(message)) {
    return "Такая запись уже существует. Измените код или название и повторите.";
  }

  if (isArchivedAssignmentConflict(message)) {
    return "Архивного сотрудника нельзя назначить на позицию.";
  }

  if (/employee does not exist|user does not exist/i.test(message)) {
    return "Запись не найдена. Обновите страницу и повторите.";
  }

  if (/invalid parameters|invalid request|field validation|invalid id/i.test(message)) {
    return "Сервер не принял данные. Проверьте заполненные поля.";
  }

  if (/schedule is not draft|period is unavailable/i.test(message)) {
    return "Даты можно менять напрямую, только пока график в статусе «Черновик».";
  }

  if (
    /only the assigned employee can request reschedule|user is not linked to an employee/i.test(
      message,
    )
  ) {
    return "Запросить перенос может только сотрудник, на которого записан этот отпуск. После отправки графика даты напрямую не меняются.";
  }

  const daysMatch = message.match(/only (\d+) vacation days/i);
  if (daysMatch) {
    return `Доступно только ${daysMatch[1]} дн.`;
  }

  if (/vacation periods overlap/i.test(message)) {
    return "Новые даты пересекаются с другим периодом этого сотрудника.";
  }

  if (/vacation start must match/i.test(message)) {
    return "У совместителя дата начала должна совпадать с отпуском в другом юрлице.";
  }

  if (/vacation dates must be inside schedule year/i.test(message)) {
    const yearMatch = message.match(/year (\d+)/);
    return yearMatch
      ? `Обе даты должны быть в ${yearMatch[1]} году.`
      : "Обе даты должны быть в году графика.";
  }

  if (code === 409) {
    return "Сервер не разрешил это действие: данные конфликтуют с уже существующими.";
  }

  if (/sqlstate|pq:|duplicate key|violates/i.test(message) || (code != null && code >= 500)) {
    return FALLBACK;
  }

  return message || FALLBACK;
}

export function formatVacancyError(error: unknown): string | null {
  return formatApiError(error);
}
