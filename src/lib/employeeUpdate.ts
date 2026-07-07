import type { EmployeeUpdateReq, Employer } from "#/types/api";

function normalizeHireDateForApi(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed}T00:00:00Z`;
}

export function toEmployeeUpdateReq(
  employee: Employer,
  fields: { gender?: string; hireDate?: string },
): EmployeeUpdateReq {
  const hireDateForApi =
    normalizeHireDateForApi(fields.hireDate) ??
    normalizeHireDateForApi(employee.hire_date);

  return {
    first_name: employee.first_name,
    second_name: employee.second_name,
    surname: employee.surname,
    email: employee.email,
    gender: fields.gender || undefined,
    hire_date: hireDateForApi,
    city_id: employee.city_id ?? null,
    office_id: employee.office_id ?? null,
  };
}
