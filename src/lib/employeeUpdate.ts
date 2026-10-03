import type { EmployeeCreateReq, EmployeeUpdateReq, Employer } from "#/types/api";

export type EmployeeEditFields = {
  surname: string;
  first_name: string;
  second_name: string;
  personal_number: string;
  work_number: string;
  email: string;
  gender: string;
};

export type EmployeeVacancyCreateFields = EmployeeEditFields & {
  cityCode: string;
  cityId: number | null;
  officeCode: string;
  officeId: number | null;
  nodeId: number;
  position: string;
  isManager: boolean;
  comment: string;
  message: string;
};

export function isEmployeeVacancyFormComplete(
  draft: EmployeeVacancyCreateFields,
): boolean {
  return (
    draft.surname.trim() !== "" &&
    draft.first_name.trim() !== "" &&
    draft.gender !== "" &&
    draft.cityCode !== "" &&
    draft.officeCode !== "" &&
    draft.nodeId !== 0 &&
    draft.position.trim() !== ""
  );
}

export function toEmployeeCreateReq(
  fields: EmployeeEditFields,
): EmployeeCreateReq {
  return {
    surname: fields.surname.trim(),
    first_name: fields.first_name.trim(),
    second_name: fields.second_name.trim(),
    personal_number: fields.personal_number.trim() || undefined,
    work_number: fields.work_number.trim() || undefined,
    email: fields.email.trim(),
    gender: fields.gender || undefined,
  };
}

/** status намеренно не входит в тело: архив меняется только через POST /archive. */
export function toEmployeeUpdateReq(
  employee: Employer,
  fields: EmployeeEditFields,
): EmployeeUpdateReq {
  return {
    surname: fields.surname.trim(),
    first_name: fields.first_name.trim(),
    second_name: fields.second_name.trim(),
    personal_number: fields.personal_number.trim() || undefined,
    work_number: fields.work_number.trim() || undefined,
    email: fields.email.trim(),
    gender: fields.gender || undefined,
    city_id: employee.city_id ?? null,
    office_id: employee.office_id ?? null,
  };
}
