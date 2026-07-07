export type VacancyModalData = {
  id: number;
  nodeId: number;
  position: string;
  positionCode: string;
  city: string;
  cityCode: string;
  office?: string;
  officeCode?: string;
  deptName: string;
  isManager: boolean;
  employer: { id: number; name: string; email: string } | null;
  jobOffer: string;
  description: string;
};

export type DeptFields = { name: string; type: string; code: string };

export type DeptModalState =
  | { mode: "create"; parentId: string; parentLabel: string }
  | {
      mode: "edit";
      id: string;
      parentId: string | null;
      name: string;
      type: string;
      code: string;
    };

export type AddVacancyState = {
  deptId: string;
  deptName: string;
};

export type VacancyFormFields = {
  position: string;
  cityCode: string;
  isManager: boolean;
  jobOffer: string;
  description: string;
};

export type EditVacancyFormFields = {
  position: string;
  cityCode: string;
  officeCode: string;
  nodeId: number;
  userId: number | null;
  gender: string;
  hireDate: string;
  isManager: boolean;
  jobOffer: string;
  description: string;
};
