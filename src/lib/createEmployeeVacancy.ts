import { toEmployeeCreateReq, type EmployeeVacancyCreateFields } from "#/lib/employeeUpdate";
import { employeesApi, vacanciesApi } from "#/services/api";

/** Создаёт вакансию и, если указаны фамилия или имя, сотрудника на неё. */
export async function createEmployeeVacancy(data: EmployeeVacancyCreateFields) {
  const shouldCreateEmployee =
    Boolean(data.surname.trim()) || Boolean(data.first_name.trim());
  let employeeId: number | null = null;

  if (shouldCreateEmployee) {
    const employeeRes = await employeesApi.create(toEmployeeCreateReq(data));
    employeeId = employeeRes.data.id;
  }

  const positionDescription = data.comment.trim();

  try {
    const vacancyRes = await vacanciesApi.create({
      node_id: data.nodeId,
      position_code: data.position,
      position_name: data.position,
      user_id: employeeId,
      city_code: data.cityCode,
      office_code: data.officeCode || undefined,
      is_manager: data.isManager,
      position_description: positionDescription,
      job_offer_link: "",
    });

    if (employeeId) {
      await vacanciesApi.update(vacancyRes.data.id, {
        node_id: data.nodeId,
        user_id: employeeId,
        city_code: data.cityCode || undefined,
        office_code: data.officeCode || undefined,
        position_code: data.position,
        position_name: data.position,
        is_manager: data.isManager,
        position_description: positionDescription,
        job_offer_link: "",
      });
    }

    if (employeeId && (data.cityId || data.officeId)) {
      const employee = toEmployeeCreateReq(data);
      await employeesApi.update(employeeId, {
        ...employee,
        email: employee.email ?? "",
        city_id: data.cityId,
        office_id: data.officeId,
      });
    }
  } catch (error) {
    if (employeeId !== null) {
      try {
        await employeesApi.delete(employeeId);
      } catch {
        // Оставляем исходную ошибку создания вакансии.
      }
    }
    throw error;
  }
}
