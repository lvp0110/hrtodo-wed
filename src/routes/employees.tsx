import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import {
  dictQueries,
  employeeQueries,
  employeesApi,
  officesApi,
  orgNodesApi,
  vacanciesApi,
} from "#/services/api";
import { EmployeeInfoModal } from "#/components/EmployeeInfoModal";
import { EditVacancyModal } from "#/components/EditVacancyModal";
import { DictTable } from "#/components/settings/DictTable";
import { dictInputClass } from "#/components/settings/DictFormModal";
import type { EmployeeReportItem, Employer, OrgNode } from "#/types/api";
import type { EditVacancyFormFields } from "#/types/orgChart";
import { toEmployeeUpdateReq } from "#/lib/employeeUpdate";
import { normalizeGender } from "#/lib/employeeDisplay";
import { toVacancyUpdateReq } from "#/lib/vacancyUpdate";
import { formatVacancyError } from "#/lib/vacancyValidation";

export const Route = createFileRoute("/employees")({
  component: EmployeesPage,
});

type EmployeeFilters = {
  name: string;
  city: string;
  office: string;
  department: string;
  position: string;
  gender: string;
};

const emptyFilters: EmployeeFilters = {
  name: "",
  city: "",
  office: "",
  department: "",
  position: "",
  gender: "",
};

function fullName(e: Employer) {
  return [e.surname, e.first_name, e.second_name].filter(Boolean).join(" ");
}

type EmployeeVacancyInfo = {
  city: string;
  cityCode: string;
  office: string;
  officeId: number | null;
  officeCode: string;
  department: string;
  position: string;
  description: string;
  jobOffer: string;
  isManager: boolean;
};

function collectEmployeeIdsInNodeAndDescendants(node: OrgNode): Set<number> {
  const ids = new Set<number>();

  function walk(n: OrgNode) {
    for (const vacancy of n.vacancies) {
      if (vacancy.employer.id) ids.add(vacancy.employer.id);
    }
    for (const child of n.children) walk(child);
  }

  walk(node);
  return ids;
}

function buildManagerSubordinatesMap(nodes: OrgNode[]): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();

  function walk(node: OrgNode) {
    for (const vacancy of node.vacancies) {
      if (vacancy.is_manager && vacancy.employer.id) {
        const managerId = vacancy.employer.id;
        const subordinates = collectEmployeeIdsInNodeAndDescendants(node);
        subordinates.delete(managerId);

        const existing = map.get(managerId);
        if (existing) {
          for (const id of subordinates) existing.add(id);
        } else {
          map.set(managerId, new Set(subordinates));
        }
      }
    }
    for (const child of node.children) walk(child);
  }

  for (const node of nodes) walk(node);
  return map;
}

function buildEmployeeOrgMapFromReport(
  items: EmployeeReportItem[],
): Map<number, EmployeeVacancyInfo> {
  const map = new Map<number, EmployeeVacancyInfo>();

  for (const { employee, positions } of items) {
    if (positions.length === 0) {
      map.set(employee.id, {
        city: employee.city?.name ?? "",
        cityCode: employee.city?.code ?? "",
        office: employee.office?.name ?? "",
        officeId: employee.office_id ?? employee.office?.id ?? null,
        officeCode: employee.office?.code ?? "",
        department: "",
        position: "",
        description: "",
        jobOffer: "",
        isManager: false,
      });
      continue;
    }

    for (const position of positions) {
      const prev = map.get(employee.id);
      map.set(employee.id, {
        city: employee.city?.name ?? position.city?.name ?? "",
        cityCode: employee.city?.code ?? position.city?.code ?? "",
        office: employee.office?.name ?? position.office?.name ?? "",
        officeId:
          employee.office_id ??
          position.office_id ??
          position.office?.id ??
          null,
        officeCode: employee.office?.code ?? position.office?.code ?? "",
        department: position.node?.name ?? "",
        position: position.name ?? "",
        description: position.position_description,
        jobOffer: position.job_offer_link,
        isManager: position.is_manager || prev?.isManager || false,
      });
    }
  }

  return map;
}

function buildEmployeeVacancyMapFromReport(
  items: EmployeeReportItem[],
): Map<number, VacancyModalData> {
  const map = new Map<number, VacancyModalData>();

  for (const { employee, positions } of items) {
    for (const position of positions) {
      map.set(employee.id, {
        id: position.id,
        nodeId: position.node_id,
        position: position.name ?? "",
        positionCode: position.code ?? position.name ?? "",
        city: position.city?.name ?? "",
        cityCode: position.city?.code ?? "",
        office: position.office?.name ?? "",
        officeCode: position.office?.code ?? "",
        deptName: position.node?.name ?? "",
        isManager: position.is_manager,
        employer: {
          id: employee.id,
          name: fullName(employee),
          email: employee.email,
        },
        jobOffer: position.job_offer_link ?? "",
        description: position.position_description ?? "",
      });
    }
  }

  return map;
}

function employersFromReport(
  items: EmployeeReportItem[],
  orgByEmployeeId: Map<number, EmployeeVacancyInfo>,
): Employer[] {
  return items.map(({ employee, positions }) => {
    const position = positions[0];
    const org = orgByEmployeeId.get(employee.id);
    return {
      ...employee,
      city_id: employee.city_id ?? position?.city_id ?? null,
      city: employee.city ?? position?.city ?? null,
      office_id: employee.office_id ?? org?.officeId ?? position?.office_id ?? null,
      office:
        employee.office ??
        (org?.officeCode
          ? {
              id: org.officeId ?? undefined,
              code: org.officeCode,
              name: org.office,
            }
          : (position?.office ?? null)),
    };
  });
}

function buildEmployeeOrgMapFromTree(
  nodes: OrgNode[],
): Map<number, EmployeeVacancyInfo> {
  const map = new Map<number, EmployeeVacancyInfo>();

  function walk(node: OrgNode) {
    for (const vacancy of node.vacancies) {
      const { id } = vacancy.employer;
      if (id) {
        const prev = map.get(id);
        map.set(id, {
          city: vacancy.city?.name ?? "",
          cityCode: vacancy.city?.code ?? "",
          office: vacancy.office?.name ?? "",
          officeId:
            (vacancy.office as { id?: number } | null | undefined)?.id ?? null,
          officeCode: vacancy.office?.code ?? "",
          department: node.name,
          position: vacancy.position?.name ?? vacancy.position?.code ?? "",
          description: vacancy.position_description,
          jobOffer: vacancy.job_offer_link,
          isManager: vacancy.is_manager || prev?.isManager || false,
        });
      }
    }
    for (const child of node.children) walk(child);
  }

  for (const node of nodes) walk(node);
  return map;
}

function buildEmployeeVacancyMapFromTree(
  nodes: OrgNode[],
): Map<number, VacancyModalData> {
  const map = new Map<number, VacancyModalData>();

  function walk(node: OrgNode) {
    for (const vacancy of node.vacancies) {
      const { id } = vacancy.employer;
      if (!id) continue;
      map.set(id, {
        id: vacancy.id,
        nodeId: vacancy.node_id,
        position: vacancy.position?.name ?? vacancy.position?.code ?? "",
        positionCode: vacancy.position?.code ?? vacancy.position?.name ?? "",
        city: vacancy.city?.name ?? "",
        cityCode: vacancy.city?.code ?? "",
        office: vacancy.office?.name ?? "",
        officeCode: vacancy.office?.code ?? "",
        deptName: node.name,
        isManager: vacancy.is_manager,
        employer: {
          id: vacancy.employer.id,
          name: fullName(vacancy.employer),
          email: vacancy.employer.email,
        },
        jobOffer: vacancy.job_offer_link ?? "",
        description: vacancy.position_description ?? "",
      });
    }
    for (const child of node.children) walk(child);
  }

  for (const node of nodes) walk(node);
  return map;
}

function mergeOfficeInfo(
  base: EmployeeVacancyInfo,
  treeSource?: EmployeeVacancyInfo,
): EmployeeVacancyInfo {
  if (
    !treeSource?.office &&
    !treeSource?.officeCode &&
    !treeSource?.officeId
  ) {
    return base;
  }

  return {
    ...base,
    office: treeSource.office || base.office,
    officeId: treeSource.officeId ?? base.officeId,
    officeCode: treeSource.officeCode || base.officeCode,
  };
}

function mergeEmployeeOrgMaps(
  reportMap: Map<number, EmployeeVacancyInfo>,
  treeMap: Map<number, EmployeeVacancyInfo>,
): Map<number, EmployeeVacancyInfo> {
  const merged = new Map(reportMap);

  for (const [id, treeInfo] of treeMap) {
    const reportInfo = merged.get(id);
    merged.set(
      id,
      reportInfo ? mergeOfficeInfo(reportInfo, treeInfo) : treeInfo,
    );
  }

  return merged;
}

function mergeVacancyMaps(
  reportMap: Map<number, VacancyModalData>,
  treeMap: Map<number, VacancyModalData>,
): Map<number, VacancyModalData> {
  const merged = new Map(reportMap);

  for (const [employeeId, treeVacancy] of treeMap) {
    const reportVacancy = merged.get(employeeId);
    if (!reportVacancy) {
      merged.set(employeeId, treeVacancy);
      continue;
    }

    merged.set(employeeId, {
      ...reportVacancy,
      id: treeVacancy.id,
      nodeId: treeVacancy.nodeId,
      positionCode: treeVacancy.positionCode || reportVacancy.positionCode,
      city: treeVacancy.city || reportVacancy.city,
      cityCode: treeVacancy.cityCode || reportVacancy.cityCode,
      deptName: treeVacancy.deptName || reportVacancy.deptName,
      office: treeVacancy.office || reportVacancy.office,
      officeCode: treeVacancy.officeCode || reportVacancy.officeCode,
      isManager: treeVacancy.isManager,
      employer: treeVacancy.employer ?? reportVacancy.employer,
      description: reportVacancy.description || treeVacancy.description,
      jobOffer: reportVacancy.jobOffer || treeVacancy.jobOffer,
    });
  }

  return merged;
}

function matchesFilters(
  employee: Employer,
  org: EmployeeVacancyInfo | undefined,
  filters: EmployeeFilters,
): boolean {
  const q = (value: string) => value.trim().toLowerCase();

  if (filters.name && !fullName(employee).toLowerCase().includes(q(filters.name))) {
    return false;
  }

  if (
    filters.gender &&
    normalizeGender(employee.gender) !== filters.gender
  ) {
    return false;
  }

  if (
    filters.position &&
    !(org?.position.toLowerCase().includes(q(filters.position)) ?? false)
  ) {
    return false;
  }

  if (filters.city && org?.city !== filters.city) return false;
  if (filters.office && org?.office !== filters.office) return false;
  if (filters.department && org?.department !== filters.department) return false;

  return true;
}

function EmployeesPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<EmployeeFilters>(emptyFilters);
  const [managersOnlyFilter, setManagersOnlyFilter] = useState(false);
  const [managerFilterId, setManagerFilterId] = useState<number | null>(null);
  const [editVacancyModal, setEditVacancyModal] =
    useState<VacancyModalData | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employer | null>(
    null,
  );
  const reportQuery = useQuery(employeeQueries.report);
  const citiesQuery = useQuery(dictQueries.cities);
  const treeQuery = useQuery({
    queryKey: ["orgTree"],
    queryFn: () => orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
  });

  const orgByEmployeeId = useMemo(
    () =>
      mergeEmployeeOrgMaps(
        buildEmployeeOrgMapFromReport(reportQuery.data ?? []),
        buildEmployeeOrgMapFromTree(treeQuery.data ?? []),
      ),
    [reportQuery.data, treeQuery.data],
  );

  const employees = useMemo(
    () => employersFromReport(reportQuery.data ?? [], orgByEmployeeId),
    [reportQuery.data, orgByEmployeeId],
  );

  const vacancyByEmployeeId = useMemo(
    () =>
      mergeVacancyMaps(
        buildEmployeeVacancyMapFromReport(reportQuery.data ?? []),
        buildEmployeeVacancyMapFromTree(treeQuery.data ?? []),
      ),
    [reportQuery.data, treeQuery.data],
  );

  const updateVacancyMutation = useMutation({
    mutationFn: async ({
      id,
      body,
      formData,
      employee,
    }: {
      id: number;
      body: Parameters<typeof vacanciesApi.update>[1];
      formData: EditVacancyFormFields;
      employee?: Employer;
    }) => {
      if (
        formData.userId &&
        employee &&
        normalizeGender(formData.gender) !== normalizeGender(employee.gender)
      ) {
        await employeesApi.update(
          formData.userId,
          toEmployeeUpdateReq(employee, { gender: formData.gender }),
        );
      }
      return vacanciesApi.update(id, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      setEditVacancyModal(null);
    },
  });

  const subordinatesByManagerId = useMemo(
    () => buildManagerSubordinatesMap(treeQuery.data ?? []),
    [treeQuery.data],
  );

  const selectedCityId = useMemo(() => {
    if (!filters.city) return null;
    return citiesQuery.data?.find((city) => city.name === filters.city)?.id ?? null;
  }, [filters.city, citiesQuery.data]);

  const officesQuery = useQuery({
    queryKey: ["offices", "city", selectedCityId] as const,
    queryFn: () => officesApi.getByCity(selectedCityId!).then((res) => res.data ?? []),
    enabled: selectedCityId !== null,
  });

  const filterOptions = useMemo(() => {
    const cities = new Set<string>();
    const offices = new Set<string>();
    const departments = new Set<string>();

    for (const info of orgByEmployeeId.values()) {
      if (info.city) cities.add(info.city);
      if (info.office) offices.add(info.office);
      if (info.department) departments.add(info.department);
    }

    return {
      cities: [...cities].sort((a, b) => a.localeCompare(b, "ru")),
      offices: [...offices].sort((a, b) => a.localeCompare(b, "ru")),
      departments: [...departments].sort((a, b) => a.localeCompare(b, "ru")),
    };
  }, [orgByEmployeeId]);

  const filteredEmployees = useMemo(() => {
    const hasTextFilters = Object.values(filters).some((value) => value.trim());

    let result = employees;

    if (managersOnlyFilter) {
      result = employees.filter(
        (employee) => orgByEmployeeId.get(employee.id)?.isManager,
      );
    } else if (managerFilterId !== null) {
      const subordinates = subordinatesByManagerId.get(managerFilterId);
      const team = employees.filter(
        (employee) =>
          employee.id === managerFilterId ||
          (subordinates?.has(employee.id) ?? false),
      );
      const manager = team.find((employee) => employee.id === managerFilterId);
      result = manager
        ? [manager, ...team.filter((employee) => employee.id !== managerFilterId)]
        : team;
    }

    if (!hasTextFilters) return result;

    return result.filter((employee) =>
      matchesFilters(employee, orgByEmployeeId.get(employee.id), filters),
    );
  }, [
    employees,
    filters,
    managersOnlyFilter,
    managerFilterId,
    orgByEmployeeId,
    subordinatesByManagerId,
  ]);

  const hasFilters =
    managersOnlyFilter ||
    managerFilterId !== null ||
    Object.values(filters).some((value) => value.trim());

  const selectedEmployeeInfo = useMemo(() => {
    if (!selectedEmployee) return null;

    const org = orgByEmployeeId.get(selectedEmployee.id);

    return {
      name: fullName(selectedEmployee) || "Сотрудник",
      gender: selectedEmployee.gender ?? null,
      position: org?.position ?? null,
      email: selectedEmployee.email || null,
      city: org?.city ?? selectedEmployee.city?.name ?? null,
      office: org?.office ?? selectedEmployee.office?.name ?? null,
      department: org?.department ?? null,
      hireDate: selectedEmployee.hire_date ?? null,
    };
  }, [selectedEmployee, orgByEmployeeId]);

  const selectedEmployeeVacancy = selectedEmployee
    ? vacancyByEmployeeId.get(selectedEmployee.id)
    : undefined;

  return (
    <div className="absolute inset-0 overflow-auto bg-gray-50 px-8 py-6 dark:bg-gray-950">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              ФИО
            </span>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={filters.name}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Поиск по ФИО"
                className={`${dictInputClass} pl-9`}
              />
            </div>
          </label>

          <label className="min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Город
            </span>
            <select
              value={filters.city}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  city: e.target.value,
                  office: "",
                }))
              }
              className={dictInputClass}
            >
              <option value="">Все города</option>
              {filterOptions.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[160px]">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Офис
            </span>
            <select
              value={filters.office}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, office: e.target.value }))
              }
              disabled={!filters.city || officesQuery.isPending}
              className={`${dictInputClass} disabled:opacity-60`}
            >
              <option value="">
                {!filters.city
                  ? "Сначала выберите город"
                  : officesQuery.isPending
                    ? "Загрузка…"
                    : "Все офисы"}
              </option>
              {officesQuery.data?.map((office) => (
                <option key={office.id} value={office.name}>
                  {office.name}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[180px]">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Отдел
            </span>
            <select
              value={filters.department}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, department: e.target.value }))
              }
              className={dictInputClass}
            >
              <option value="">Все отделы</option>
              {filterOptions.departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Пол
            </span>
            <select
              value={filters.gender}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, gender: e.target.value }))
              }
              className={dictInputClass}
            >
              <option value="">Все</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </label>

          <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Должность
            </span>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={filters.position}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, position: e.target.value }))
                }
                placeholder="Поиск по должности"
                className={`${dictInputClass} pl-9`}
              />
            </div>
          </label>

        <div className="shrink-0">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Сотрудники
          </span>
          <div className="flex min-w-[72px] items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            {reportQuery.isPending ? (
              <span className="text-gray-400">…</span>
            ) : hasFilters ? (
              <>
                {filteredEmployees.length}
                <span className="text-gray-400">
                  {" "}
                  из {employees.length}
                </span>
              </>
            ) : (
              filteredEmployees.length
            )}
          </div>
        </div>
      </div>

      <DictTable<Employer>
        rowHoverVariant="border"
        columns={[
          {
            key: "isManager",
            header: (
              <Star
                size={12}
                aria-label="Только руководители"
                title={
                  managersOnlyFilter
                    ? "Сбросить фильтр"
                    : "Показать только руководителей"
                }
                className={`mx-auto shrink-0 ${
                  managersOnlyFilter
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-300 text-gray-300 dark:fill-gray-600 dark:text-gray-600"
                }`}
              />
            ),
            headerClassName: "w-10 text-center",
            onHeaderClick: () => {
              setManagersOnlyFilter((prev) => !prev);
              setManagerFilterId(null);
            },
            className: "text-center",
            onClick: (r) => {
              if (!orgByEmployeeId.get(r.id)?.isManager) return;
              setManagersOnlyFilter(false);
              setManagerFilterId((prev) => (prev === r.id ? null : r.id));
            },
            render: (r) =>
              orgByEmployeeId.get(r.id)?.isManager ? (
                <Star
                  size={12}
                  aria-label="Руководитель"
                  title={
                    managerFilterId === r.id
                      ? "Сбросить фильтр"
                      : "Показать подчинённых"
                  }
                  className={`mx-auto shrink-0 ${
                    managerFilterId === r.id
                      ? "fill-amber-500 text-amber-500"
                      : "fill-amber-400 text-amber-400"
                  }`}
                />
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
          {
            key: "name",
            header: "ФИО",
            onClick: (employee) => setSelectedEmployee(employee),
            render: (r) =>
              fullName(r) || <span className="text-gray-400">—</span>,
          },
          {
            key: "city",
            header: "Город",
            className: "whitespace-nowrap",
            onClick: (r) => {
              const city = orgByEmployeeId.get(r.id)?.city;
              if (city) setFilters((prev) => ({ ...prev, city, office: "" }));
            },
            render: (r) => {
              const city = orgByEmployeeId.get(r.id)?.city;
              return city ? (
                <span className="text-blue-600 hover:underline dark:text-blue-400">
                  {city}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
          {
            key: "office",
            header: "Офис",
            className: "whitespace-nowrap",
            onClick: (r) => {
              const org = orgByEmployeeId.get(r.id);
              if (!org?.office) return;
              setFilters((prev) => ({
                ...prev,
                city: org.city || prev.city,
                office: org.office,
              }));
            },
            render: (r) => {
              const office = orgByEmployeeId.get(r.id)?.office;
              return office ? (
                <span className="text-blue-600 hover:underline dark:text-blue-400">
                  {office}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
          {
            key: "department",
            header: "Отдел",
            onClick: (r) => {
              const department = orgByEmployeeId.get(r.id)?.department;
              if (department) setFilters((prev) => ({ ...prev, department }));
            },
            render: (r) => {
              const department = orgByEmployeeId.get(r.id)?.department;
              return department ? (
                <span className="text-blue-600 hover:underline dark:text-blue-400">
                  {department}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
          {
            key: "position",
            header: "Должность",
            onClick: (r) => {
              const position = orgByEmployeeId.get(r.id)?.position;
              if (position) setFilters((prev) => ({ ...prev, position }));
            },
            render: (r) => {
              const position = orgByEmployeeId.get(r.id)?.position;
              return position ? (
                <span className="text-blue-600 hover:underline dark:text-blue-400">
                  {position}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
        ]}
        rows={filteredEmployees}
        rowKey={(r) => r.id}
        isLoading={reportQuery.isPending}
        isError={reportQuery.isError}
        errorMessage={reportQuery.error?.message}
        emptyMessage={hasFilters ? "Ничего не найдено" : "Записей пока нет"}
      />

      {selectedEmployeeInfo && (
        <EmployeeInfoModal
          data={selectedEmployeeInfo}
          onClose={() => setSelectedEmployee(null)}
          onEdit={
            selectedEmployeeVacancy
              ? () => {
                  setEditVacancyModal(selectedEmployeeVacancy);
                  setSelectedEmployee(null);
                }
              : undefined
          }
        />
      )}

      {editVacancyModal && (
        <EditVacancyModal
          data={editVacancyModal}
          onClose={() => {
            updateVacancyMutation.reset();
            setEditVacancyModal(null);
          }}
          isPending={updateVacancyMutation.isPending}
          error={formatVacancyError(updateVacancyMutation.error?.message)}
          onSubmit={(data) => {
            updateVacancyMutation.mutate({
              id: editVacancyModal.id,
              body: toVacancyUpdateReq(data),
              formData: data,
              employee: data.userId
                ? employees.find((employee) => employee.id === data.userId)
                : undefined,
            });
          }}
        />
      )}
    </div>
  );
}
