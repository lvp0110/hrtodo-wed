import type { EditVacancyFormFields } from "#/types/orgChart";
import type { VacancyUpdateReq } from "#/types/api";

export function toVacancyUpdateReq(
  data: EditVacancyFormFields,
): VacancyUpdateReq {
  return {
    node_id: data.nodeId,
    user_id: data.userId,
    city_code: data.cityCode || undefined,
    office_code: data.officeCode || undefined,
    position_code: data.position,
    position_name: data.position,
    is_manager: data.isManager,
    position_description: data.description,
    job_offer_link: data.jobOffer,
  };
}
