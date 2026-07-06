import type { EmployeeUpdateReq, Employer } from "#/types/api";

export function toEmployeeUpdateReq(
  employee: Employer,
  fields: { gender?: string },
): EmployeeUpdateReq {
  return {
    first_name: employee.first_name,
    second_name: employee.second_name,
    surname: employee.surname,
    email: employee.email,
    gender: fields.gender || undefined,
    hire_date: employee.hire_date,
    city_id: employee.city_id ?? null,
    office_id: employee.office_id ?? null,
  };
}
