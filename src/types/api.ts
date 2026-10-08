export interface Entity {
  code: string;
  name: string;
}

export interface City {
  id: number;
  code: string;
  name: string;
  country_id: number;
}

export interface Office {
  id: number;
  code: string;
  name: string;
  city_id: number;
}

export interface OfficeReq {
  code: string;
  name: string;
  city_id: number;
}

export interface Country {
  id: number;
  code: string;
  name: string;
}

export interface CityReq {
  code: string;
  name: string;
  country_id: number;
}

export interface CountryReq {
  code: string;
  name: string;
}

export interface OrgNodeTypeReq {
  code: string;
  name: string;
}

/** active попадает в /dict/employees и может быть назначен; archived снят с позиций. */
export type EmployeeStatus = "active" | "archived";

export interface Employer {
  id: number;
  first_name: string;
  second_name: string;
  surname: string;
  email: string;
  phone?: string;
  personal_number?: string;
  work_number?: string;
  hire_date?: string;
  gender?: string;
  city?: Entity | null;
  city_id?: number | null;
  office?: (Entity & { id?: number }) | null;
  office_id?: number | null;
  status?: EmployeeStatus;
}

export interface EmployeeCreateReq {
  first_name: string;
  second_name: string;
  surname: string;
  email?: string;
  phone?: string;
  personal_number?: string;
  work_number?: string;
  hire_date?: string;
  gender?: string;
}

/**
 * Обычное редактирование не меняет status.
 * Архив — только POST /employees/{id}/archive.
 */
export interface EmployeeUpdateReq {
  first_name: string;
  second_name: string;
  surname: string;
  email: string;
  phone?: string;
  personal_number?: string;
  work_number?: string;
  hire_date?: string;
  gender?: string;
  city_id?: number | null;
  office_id?: number | null;
}

export interface EmployeeReportPosition {
  id: number;
  code: string;
  name: string;
  position_description: string;
  job_offer_link: string;
  node_id: number;
  node: Entity;
  node_type: Entity;
  city_id: number;
  city: Entity;
  country_id: number;
  country: Entity;
  is_manager: boolean;
  manager_id: number;
  office_id?: number | null;
  office?: (Entity & { id?: number }) | null;
}

export interface EmployeeReportItem {
  employee: Employer;
  positions: EmployeeReportPosition[];
}

export interface OrgNodeType {
  id: number;
  code: string;
  name: string;
}

export interface EmptyVacancy {
  position?: Entity | null;
  city?: Entity | null;
  office?: Entity | null;
}

export interface Vacancy {
  id: number;
  node_id: number;
  position?: Entity | null;
  city?: Entity | null;
  office?: Entity | null;
  employer: Employer;
  is_manager: boolean;
  position_description: string;
  job_offer_link: string;
}

export interface OrgNode {
  id: number;
  code: string;
  name: string;
  type: string;
  parent_id: number | null;
  children: OrgNode[];
  vacancies: Vacancy[];
  empty_vacancy: EmptyVacancy[];
}

export interface ApiResponse<T> {
  code: number;
  data: T;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Ответ POST /auth/login: токены только в HttpOnly cookies. */
export interface AuthSession {
  user: UserFullInfo;
  expires_at: string;
  refresh_expires_at: string;
}

/** Ответ POST /auth/refresh: новые сроки жизни access и refresh cookies. */
export interface RefreshSession {
  expires_at: string;
  refresh_expires_at: string;
}

export interface UserFullInfo {
  user_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  role_type: string;
  position_id: number;
  position_type: string;
  department_id: number;
  is_active: boolean;
  created_at: string;
}

export type OrgNodesResponse = ApiResponse<OrgNode[]>;

export interface NodeCreateReq {
  code: string;
  name: string;
  type_code: string;
  parent_id: number | null;
}

export type NodeUpdateReq = NodeCreateReq;

export interface VacancyReq {
  node_id: number;
  position_code: string;
  position_name: string;
  user_id?: number | null;
  office_code?: string;
  city_code?: string;
  is_manager: boolean;
  position_description: string;
  job_offer_link: string;
}

export interface VacancyUpdateReq {
  node_id: number;
  user_id: number | null;
  city_code?: string;
  office_code?: string;
  position_code: string;
  position_name: string;
  is_manager: boolean;
  position_description: string;
  job_offer_link: string;
}

/** Элемент справочника из GET /hr/vacations/filters. code может отсутствовать. */
export interface VacationNamedRef {
  id: number;
  code?: string;
  name: string;
}

export type VacationFilterValue = string | VacationNamedRef;

/** GET /hr/vacations/filters */
export interface VacationFilters {
  years?: number[] | null;
  legal_entities?: VacationNamedRef[] | null;
  positions?: VacationNamedRef[] | null;
  managers?: VacationNamedRef[] | null;
  categories?: VacationNamedRef[] | null;
  period_statuses?: VacationFilterValue[] | null;
  request_statuses?: VacationFilterValue[] | null;
  employment_types?: VacationFilterValue[] | null;
}

/** GET /hr/vacation-schedules — годовой график юрлица. */
export interface VacationSchedule {
  id: number;
  legal_entity_id: number;
  legal_entity_name: string;
  year: number;
  status: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  approval_comment?: string | null;
  closed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Строка GET /hr/vacations, модель VacationListItem.
 * available_days — положено, planned_total_days — уже распределено, remaining_days — остаток.
 */
export interface VacationListItem {
  period_id: number;
  version_id?: number;
  version_no?: number;
  assignment_id: number;
  employee_id: number;
  employee_full_name: string;
  legal_entity_id: number;
  legal_entity_name: string;
  position_id: number;
  position_name: string;
  manager_assignment_id?: number | null;
  manager_employee_id?: number | null;
  manager_full_name?: string | null;
  category_id: number;
  category_code?: string;
  category_name: string;
  employment_type: string;
  planned_start_date: string;
  planned_end_date: string;
  planned_days: number;
  period_status: string;
  confirmation_status: string;
  reschedule_status?: string | null;
  last_notification_at?: string | null;
  last_delivery_status?: string | null;
  available_days: number;
  planned_total_days: number;
  remaining_days: number;
}

/** GET /hr/vacations */
export interface VacationListPage {
  items?: VacationListItem[] | null;
  page?: number;
  page_size?: number;
  total_items?: number;
  total_pages?: number;
}

/** GET /hr/vacations/summary */
export interface VacationSummary {
  employees_total?: number;
  employees_planned?: number;
  employees_not_planned?: number;
  days_need_review?: number;
  upcoming_14_days?: number;
  upcoming_30_days?: number;
  awaiting_confirmation?: number;
  confirmed?: number;
  pending_reschedules?: number;
  delivery_errors?: number;
  employees_outside_schedule?: number;
}

export interface LegalEntity {
  id: number;
  code: string;
  short_name: string;
  full_name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LegalEntityReq {
  code: string;
  short_name: string;
  full_name: string;
  is_active: boolean;
}

export interface LegalPosition {
  id: number;
  legal_entity_id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LegalPositionCreateReq {
  legal_entity_id: number;
  code: string;
  name: string;
  is_active: boolean;
}

export interface LegalPositionUpdateReq {
  code: string;
  name: string;
  is_active: boolean;
}

export interface EmployeeCategory {
  id: number;
  code: string;
  name: string;
  vacation_management_mode: string;
  is_active: boolean;
}

export interface AccountingAssignment {
  id: number;
  employee_id: number;
  employee_full_name?: string;
  legal_entity_id: number;
  legal_entity_name?: string;
  legal_position_id: number;
  legal_position_name?: string;
  category_id: number;
  category_name?: string;
  manager_assignment_id?: number | null;
  manager_full_name?: string | null;
  employment_type: string;
  personnel_number?: string | null;
  work_fraction?: number | null;
  is_manager: boolean;
  started_on: string;
  ended_on?: string | null;
  end_reason?: string | null;
}

export interface AccountingStructureEmployee {
  assignment_id: number;
  employee_id: number;
  full_name: string;
  position_id: number;
  position_name: string;
  category_id: number;
  category_code: string;
  employment_type: string;
}

export interface AccountingStructureManager {
  assignment_id: number;
  employee_id: number;
  full_name: string;
  position_id: number;
  position_name: string;
  employees?: AccountingStructureEmployee[] | null;
}

export interface AccountingStructure {
  legal_entity_id: number;
  legal_entity_name: string;
  managers?: AccountingStructureManager[] | null;
  unassigned?: AccountingStructureEmployee[] | null;
}

export interface AccountingAssignmentReq {
  employee_id: number;
  legal_entity_id: number;
  legal_position_id: number;
  category_id: number;
  manager_assignment_id: number | null;
  employment_type: "primary" | "part_time";
  personnel_number: string | null;
  work_fraction: number | null;
  is_manager: boolean;
  started_on: string;
  ended_on: string | null;
  end_reason: string | null;
}

/** Фильтры для POST /export/excel */
export interface ExportRequest {
  full_name?: string;
  country_code?: string;
  city_code?: string;
  office_code?: string;
  department_id?: number;
  position_name?: string;
  gender?: string;
  hire_year?: number;
  hire_month?: number;
  hire_day?: number;
}
