import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { dictQueries } from "#/services/api";
import { DictTable } from "#/components/settings/DictTable";
import type { Employer } from "#/types/api";

export const Route = createFileRoute("/employees")({
  component: EmployeesPage,
});

function fullName(e: Employer) {
  return [e.surname, e.first_name, e.second_name].filter(Boolean).join(" ");
}

function EmployeesPage() {
  const employeesQuery = useQuery(dictQueries.employees);

  return (
    <div className="absolute inset-0 overflow-auto bg-gray-50 px-8 py-6 dark:bg-gray-950">
      <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">
        Сотрудники
      </h1>
      <DictTable<Employer>
        columns={[
          {
            key: "id",
            header: "ID",
            render: (r) => <span className="font-mono text-xs">{r.id}</span>,
          },
          {
            key: "name",
            header: "ФИО",
            render: (r) =>
              fullName(r) || <span className="text-gray-400">—</span>,
          },
          {
            key: "email",
            header: "Email",
            render: (r) =>
              r.email ? (
                <a
                  href={`mailto:${r.email}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {r.email}
                </a>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
        ]}
        rows={employeesQuery.data ?? []}
        rowKey={(r) => r.id}
        isLoading={employeesQuery.isPending}
        isError={employeesQuery.isError}
        errorMessage={employeesQuery.error?.message}
      />
    </div>
  );
}
