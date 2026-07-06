import type { EditVacancyFormFields } from "#/types/orgChart";
import type { VacancyUpdateReq } from "#/types/api";

export function toVacancyUpdateReq(
  data: EditVacancyFormFields,
): VacancyUpdateReq {
  return {
    node_id: data.nodeId,
    user_id: data.userId,
    office_code: data.officeCode,
    position_code: data.position,
    position_name: data.position,
    is_manager: data.isManager,
    position_description: data.description,
    job_offer_link: data.jobOffer,
  };
}
