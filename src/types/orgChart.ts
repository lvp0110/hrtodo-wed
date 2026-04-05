export type VacancyModalData = {
  position: string;
  city: string;
  deptName: string;
  employer: { id: number; name: string; email: string } | null;
};

export type DeptFields = { name: string; type: string; code: string };

export type DeptModalState =
  | { mode: "create"; parentId: string; parentLabel: string }
  | { mode: "edit"; id: string; name: string; type: string; code: string };
