import type { EmployeeReportItem, Employer, Vacancy } from "#/types/api";
import type { VacancyModalData } from "#/types/orgChart";

export function toVacancyModalData(
  vacancy: Vacancy,
  deptName: string,
): VacancyModalData {
  const employer = vacancy.employer?.id ? vacancy.employer : null;
  const name = employer
    ? [employer.surname, employer.first_name, employer.second_name]
        .filter(Boolean)
        .join(" ")
    : "";

  return {
    id: vacancy.id,
    nodeId: vacancy.node_id,
    position: vacancy.position?.name ?? vacancy.position?.code ?? "",
    positionCode: vacancy.position?.code ?? vacancy.position?.name ?? "",
    city: vacancy.city?.name ?? "",
    cityCode: vacancy.city?.code ?? "",
    office: vacancy.office?.name,
    officeCode: vacancy.office?.code,
    deptName,
    isManager: vacancy.is_manager,
    employer: employer
      ? { id: employer.id, name, email: employer.email ?? "" }
      : null,
    jobOffer: vacancy.job_offer_link ?? "",
    description: vacancy.position_description ?? "",
  };
}

export function employeeFromReports(
  employeeId: number,
  reports: Array<EmployeeReportItem[] | undefined>,
): Employer | undefined {
  for (const report of reports) {
    const found = report?.find((item) => item.employee.id === employeeId);
    if (found) return found.employee;
  }
  return undefined;
}

/** В дереве у вакансии часто нет города и офиса — их берём из отчёта сотрудников. */
export function withReportVacancyFields(
  data: VacancyModalData,
  reports: Array<EmployeeReportItem[] | undefined>,
): VacancyModalData {
  for (const report of reports) {
    for (const item of report ?? []) {
      const position = item.positions.find((entry) => entry.id === data.id);
      if (!position) continue;
      return {
        ...data,
        position: data.position || position.name || "",
        positionCode: data.positionCode || position.code || "",
        city: data.city || position.city?.name || "",
        cityCode: data.cityCode || position.city?.code || "",
        office: data.office || position.office?.name || "",
        officeCode: data.officeCode || position.office?.code || "",
        deptName: data.deptName || position.node?.name || "",
        description: data.description || position.position_description || "",
        jobOffer: data.jobOffer || position.job_offer_link || "",
        isManager: data.isManager || position.is_manager,
      };
    }
  }
  return data;
}
