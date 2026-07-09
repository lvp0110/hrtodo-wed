import type { EmployeeCreateReq, EmployeeUpdateReq, Employer } from "#/types/api";

export type EmployeeEditFields = {
  surname: string;
  first_name: string;
  second_name: string;
  email: string;
  gender: string;
  hireDate: string;
};

export type EmployeeVacancyCreateFields = EmployeeEditFields & {
  cityCode: string;
  cityId: number | null;
  officeCode: string;
  officeId: number | null;
  nodeId: number;
  position: string;
  isManager: boolean;
};

function normalizeHireDateForApi(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed}T00:00:00Z`;
}

export function toEmployeeCreateReq(
  fields: EmployeeEditFields,
): EmployeeCreateReq {
  return {
    surname: fields.surname.trim(),
    first_name: fields.first_name.trim(),
    second_name: fields.second_name.trim(),
    email: fields.email.trim(),
    gender: fields.gender || undefined,
    hire_date: normalizeHireDateForApi(fields.hireDate),
  };
}

export function toEmployeeUpdateReq(
  employee: Employer,
  fields: EmployeeEditFields,
): EmployeeUpdateReq {
  const hireDateForApi =
    normalizeHireDateForApi(fields.hireDate) ??
    normalizeHireDateForApi(employee.hire_date);

  return {
    surname: fields.surname.trim(),
    first_name: fields.first_name.trim(),
    second_name: fields.second_name.trim(),
    email: fields.email.trim(),
    gender: fields.gender || undefined,
    hire_date: hireDateForApi,
    city_id: employee.city_id ?? null,
    office_id: employee.office_id ?? null,
  };
}
