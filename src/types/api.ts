export interface Entity {
  code: string;
  name: string;
}

export interface Employer {
  id: number;
  firstName: string;
  secondName: string;
  surname: string;
  email: string;
}

export interface EmptyVacancy {
  city: Entity;
  position: Entity;
}

export interface Vacancy {
  city: Entity;
  position: Entity;
  employer: Employer;
}

export interface OrgNode {
  id: number;
  code: string;
  name: string;
  type: string;
  children: OrgNode[];
  vacancies: Vacancy[];
  emptyVacancy: EmptyVacancy[];
}

export interface OrgNodeRow {
  id: number;
  code: string;
  name: string;
  parentID: number;
  typeCode: string;
}

export interface OrgNodesResponse {
  code: number;
  data: OrgNode[];
}

export interface OrgNodeResponse {
  code: number;
  data: OrgNodeRow[];
}

export interface ErrorResponse {
  code: number;
  error: string;
}
