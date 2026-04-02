export interface Entity {
  Code: string;
  Name: string;
}

export interface Employer {
  ID: number;
  FirstName: string;
  SecondName: string;
  Surname: string;
  Email: string;
}

export interface EmptyVacancy {
  City: Entity;
  Position: Entity;
}

export interface Vacancy {
  City: Entity;
  Position: Entity;
  Employer: Employer;
}

export interface OrgNode {
  ID: number;
  Code: string;
  Name: string;
  Type: string;
  Children: OrgNode[];
  Vacancies: Vacancy[] | null;
  EmptyVacancy: EmptyVacancy[] | null;
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
