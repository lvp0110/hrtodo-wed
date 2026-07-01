import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { dictQueries, officesApi, orgNodesApi, vacanciesApi } from "#/services/api";
import { EmployeeInfoModal } from "#/components/EmployeeInfoModal";
import { EditVacancyModal } from "#/components/EditVacancyModal";
import { DictTable } from "#/components/settings/DictTable";
import { dictInputClass } from "#/components/settings/DictFormModal";
import type { Employer, OrgNode } from "#/types/api";
import type { VacancyModalData } from "#/types/orgChart";

export const Route = createFileRoute("/employees")({
  component: EmployeesPage,
});

type EmployeeFilters = {
  name: string;
  city: string;
  office: string;
  department: string;
  position: string;
};

const emptyFilters: EmployeeFilters = {
  name: "",
  city: "",
  office: "",
  department: "",
  position: "",
};

function fullName(e: Employer) {
  return [e.surname, e.first_name, e.second_name].filter(Boolean).join(" ");
}

type EmployeeVacancyInfo = {
  city: string;
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

function buildEmployeeOrgMap(nodes: OrgNode[]): Map<number, EmployeeVacancyInfo> {
  const map = new Map<number, EmployeeVacancyInfo>();

  function walk(node: OrgNode) {
    for (const vacancy of node.vacancies) {
      const { id } = vacancy.employer;
      if (id) {
        const prev = map.get(id);
        map.set(id, {
          city: vacancy.city.name,
          department: node.name,
          position: vacancy.position.name,
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

function buildEmployeeVacancyMap(
  nodes: OrgNode[],
): Map<number, VacancyModalData> {
  const map = new Map<number, VacancyModalData>();

  function walk(node: OrgNode) {
    for (const vacancy of node.vacancies) {
      const { id } = vacancy.employer;
      if (id) {
        map.set(id, {
          id: vacancy.id,
          nodeId: vacancy.node_id,
          position: vacancy.position.name,
          positionCode: vacancy.position.code,
          city: vacancy.city.name,
          cityCode: vacancy.city.code,
          deptName: node.name,
          isManager: vacancy.is_manager,
          employer: {
            id: vacancy.employer.id,
            name: fullName(vacancy.employer),
            email: vacancy.employer.email,
          },
          jobOffer: vacancy.job_offer_link,
          description: vacancy.position_description,
        });
      }
    }
    for (const child of node.children) walk(child);
  }

  for (const node of nodes) walk(node);
  return map;
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
    filters.position &&
    !(org?.position.toLowerCase().includes(q(filters.position)) ?? false)
  ) {
    return false;
  }

  if (filters.city && org?.city !== filters.city) return false;
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
  const employeesQuery = useQuery(dictQueries.employees);
  const citiesQuery = useQuery(dictQueries.cities);
  const treeQuery = useQuery({
    queryKey: ["orgTree"],
    queryFn: () => orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
  });

  const orgByEmployeeId = useMemo(
    () => buildEmployeeOrgMap(treeQuery.data ?? []),
    [treeQuery.data],
  );

  const vacancyByEmployeeId = useMemo(
    () => buildEmployeeVacancyMap(treeQuery.data ?? []),
    [treeQuery.data],
  );

  const updateVacancyMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof vacanciesApi.update>[1] }) =>
      vacanciesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
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
    const departments = new Set<string>();

    for (const info of orgByEmployeeId.values()) {
      cities.add(info.city);
      departments.add(info.department);
    }

    return {
      cities: [...cities].sort((a, b) => a.localeCompare(b, "ru")),
      departments: [...departments].sort((a, b) => a.localeCompare(b, "ru")),
    };
  }, [orgByEmployeeId]);

  const filteredEmployees = useMemo(() => {
    const employees = employeesQuery.data ?? [];
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
    employeesQuery.data,
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
      email: selectedEmployee.email,
      city: org?.city ?? null,
      department: org?.department ?? null,
      position: org?.position ?? null,
      isOccupied: Boolean(org),
      description: org?.description || null,
      jobOffer: org?.jobOffer || null,
    };
  }, [selectedEmployee, orgByEmployeeId]);

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
            {employeesQuery.isPending ? (
              <span className="text-gray-400">…</span>
            ) : hasFilters ? (
              <>
                {filteredEmployees.length}
                <span className="text-gray-400">
                  {" "}
                  из {employeesQuery.data?.length ?? 0}
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
            onClick: (employee) => {
              const vacancy = vacancyByEmployeeId.get(employee.id);
              if (vacancy) {
                setEditVacancyModal(vacancy);
                return;
              }
              setSelectedEmployee(employee);
            },
            render: (r) =>
              fullName(r) || <span className="text-gray-400">—</span>,
          },
          {
            key: "city",
            header: "Город",
            className: "whitespace-nowrap",
            onClick: (r) => {
              const city = orgByEmployeeId.get(r.id)?.city;
              if (city) setFilters((prev) => ({ ...prev, city }));
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
        isLoading={employeesQuery.isPending}
        isError={employeesQuery.isError}
        errorMessage={employeesQuery.error?.message}
        emptyMessage={hasFilters ? "Ничего не найдено" : "Записей пока нет"}
      />

      {editVacancyModal && (
        <EditVacancyModal
          data={editVacancyModal}
          onClose={() => {
            updateVacancyMutation.reset();
            setEditVacancyModal(null);
          }}
          isPending={updateVacancyMutation.isPending}
          error={updateVacancyMutation.error?.message ?? null}
          onSubmit={(data) => {
            updateVacancyMutation.mutate({
              id: editVacancyModal.id,
              body: {
                node_id: data.nodeId,
                user_id: data.userId,
                city_code: data.cityCode,
                position_code: data.position,
                position_name: data.position,
                is_manager: data.isManager,
                position_description: data.description,
                job_offer_link: data.jobOffer,
              },
            });
          }}
        />
      )}

      {selectedEmployeeInfo && (
        <EmployeeInfoModal
          data={selectedEmployeeInfo}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
