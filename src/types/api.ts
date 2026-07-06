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

export interface Employer {
  id: number;
  first_name: string;
  second_name: string;
  surname: string;
  email: string;
  hire_date?: string;
  gender?: string;
  city?: Entity | null;
  city_id?: number | null;
  office?: (Entity & { id?: number }) | null;
  office_id?: number | null;
}

export interface EmployeeUpdateReq {
  first_name: string;
  second_name: string;
  surname: string;
  email: string;
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

export interface OrgNodeRow {
  id: number;
  parent_id: number | null;
  code: string;
  name: string;
  type_code: string;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
}

export interface LoginRequest {
  email: string;
  password: string;
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

export interface ErrorResponse {
  code: number;
  error: string;
}

export type OrgNodesResponse = ApiResponse<OrgNode[]>;
export type OrgNodeRowResponse = ApiResponse<OrgNodeRow>;
export type VacancyResponse = ApiResponse<Vacancy>;
export type OrgNodeResponse = ApiResponse<OrgNode>;

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
  office_code?: string;
  city_code?: string;
  is_manager: boolean;
  position_description: string;
  job_offer_link: string;
}

export interface VacancyUpdateReq {
  node_id: number;
  user_id: number | null;
  office_code?: string;
  position_code: string;
  position_name: string;
  is_manager: boolean;
  position_description: string;
  job_offer_link: string;
}
