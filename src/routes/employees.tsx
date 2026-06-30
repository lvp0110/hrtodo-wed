import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { dictQueries, orgNodesApi } from "#/services/api";
import { EmployeeInfoModal } from "#/components/EmployeeInfoModal";
import { DictTable } from "#/components/settings/DictTable";
import { dictInputClass } from "#/components/settings/DictFormModal";
import type { Employer, OrgNode } from "#/types/api";

export const Route = createFileRoute("/employees")({
  component: EmployeesPage,
});

type EmployeeFilters = {
  name: string;
  city: string;
  department: string;
  position: string;
};

const emptyFilters: EmployeeFilters = {
  name: "",
  city: "",
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
};

function buildEmployeeOrgMap(nodes: OrgNode[]): Map<number, EmployeeVacancyInfo> {
  const map = new Map<number, EmployeeVacancyInfo>();

  function walk(node: OrgNode) {
    for (const vacancy of node.vacancies) {
      const { id } = vacancy.employer;
      if (id) {
        map.set(id, {
          city: vacancy.city.name,
          department: node.name,
          position: vacancy.position.name,
          description: vacancy.position_description,
          jobOffer: vacancy.job_offer_link,
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
  const [filters, setFilters] = useState<EmployeeFilters>(emptyFilters);
  const [selectedEmployee, setSelectedEmployee] = useState<Employer | null>(null);
  const employeesQuery = useQuery(dictQueries.employees);
  const treeQuery = useQuery({
    queryKey: ["orgTree"],
    queryFn: () => orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
  });

  const orgByEmployeeId = useMemo(
    () => buildEmployeeOrgMap(treeQuery.data ?? []),
    [treeQuery.data],
  );

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
    const hasFilters = Object.values(filters).some((value) => value.trim());

    if (!hasFilters) return employees;

    return employees.filter((employee) =>
      matchesFilters(employee, orgByEmployeeId.get(employee.id), filters),
    );
  }, [employeesQuery.data, filters, orgByEmployeeId]);

  const hasFilters = Object.values(filters).some((value) => value.trim());

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
                setFilters((prev) => ({ ...prev, city: e.target.value }))
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
        columns={[
          {
            key: "name",
            header: "ФИО",
            render: (r) =>
              fullName(r) || <span className="text-gray-400">—</span>,
          },
          {
            key: "city",
            header: "Город",
            render: (r) => {
              const city = orgByEmployeeId.get(r.id)?.city;
              return city ? (
                city
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
          {
            key: "department",
            header: "Отдел",
            render: (r) => {
              const department = orgByEmployeeId.get(r.id)?.department;
              return department ? (
                department
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
          {
            key: "position",
            header: "Должность",
            render: (r) => {
              const position = orgByEmployeeId.get(r.id)?.position;
              return position ? (
                position
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
        ]}
        rows={filteredEmployees}
        rowKey={(r) => r.id}
        onRowClick={setSelectedEmployee}
        isLoading={employeesQuery.isPending}
        isError={employeesQuery.isError}
        errorMessage={employeesQuery.error?.message}
        emptyMessage={hasFilters ? "Ничего не найдено" : "Записей пока нет"}
      />

      {selectedEmployeeInfo && (
        <EmployeeInfoModal
          data={selectedEmployeeInfo}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
