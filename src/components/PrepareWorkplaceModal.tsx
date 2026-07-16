import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { CloseButton } from "#/components/CloseButton";
import { GENDER_OPTIONS } from "#/lib/employeeDisplay";
import type { EmployeeVacancyCreateFields } from "#/lib/employeeUpdate";
import { findOrgNodeById } from "#/lib/orgTree";
import { officesApi } from "#/services/api";
import type { City, OrgNode } from "#/types/api";

const inputClass =
  "w-full max-w-xs px-2 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-200 dark:border-gray-700";

const rowLabelClass =
  "w-48 whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400";

const tdClass = "px-3 py-2 text-sm text-gray-900 dark:text-gray-100";

interface PrepareWorkplaceModalProps {
  initial: EmployeeVacancyCreateFields;
  cities: City[];
  orgNodes: OrgNode[];
  onClose: () => void;
  onApply: (data: EmployeeVacancyCreateFields) => void;
}

export function PrepareWorkplaceModal({
  initial,
  cities,
  orgNodes,
  onClose,
  onApply,
}: PrepareWorkplaceModalProps) {
  const [hireDate, setHireDate] = useState(initial.hireDate);

  const officesQuery = useQuery({
    queryKey: ["offices", "city", initial.cityId] as const,
    queryFn: () =>
      officesApi.getByCity(initial.cityId!).then((res) => res.data ?? []),
    enabled: initial.cityId !== null,
  });

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onApply({ ...initial, hireDate });
  }

  const cityName =
    cities.find((city) => city.code === initial.cityCode)?.name || "—";
  const officeName =
    officesQuery.data?.find((office) => office.code === initial.officeCode)
      ?.name ||
    (initial.officeCode ? initial.officeCode : "—");
  const departmentName =
    findOrgNodeById(orgNodes, initial.nodeId)?.name || "—";
  const genderLabel =
    GENDER_OPTIONS.find((option) => option.value === initial.gender)?.label ||
    "—";

  const rows = [
    { key: "surname", label: "Фамилия", value: initial.surname || "—" },
    { key: "first_name", label: "Имя", value: initial.first_name || "—" },
    { key: "second_name", label: "Отчество", value: initial.second_name || "—" },
    { key: "phone", label: "Телефон", value: initial.phone || "—" },
    { key: "email", label: "Эл. почта", value: initial.email || "—" },
    { key: "gender", label: "Пол", value: genderLabel },
    { key: "hireDate", label: "Дата устройства", value: null },
    { key: "city", label: "Город", value: cityName },
    { key: "office", label: "Офис", value: officeName },
    { key: "department", label: "Отдел", value: departmentName },
    { key: "position", label: "Должность", value: initial.position || "—" },
    {
      key: "isManager",
      label: "Руководящая должность",
      value: initial.isManager ? "Да" : "Нет",
    },
    { key: "comment", label: "Комментарии", value: initial.comment || "—" },
  ] as const;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Подготовить рабочее место
            </h2>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Данные сотрудника и вакансии
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full table-auto text-left">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className={rowLabelClass}>
                        {row.label}
                      </th>
                      <td className={tdClass}>
                        {row.key === "hireDate" ? (
                          <input
                            type="date"
                            value={hireDate}
                            onChange={(e) => setHireDate(e.target.value)}
                            className={inputClass}
                            autoFocus
                          />
                        ) : (
                          <span className="whitespace-pre-wrap break-words">
                            {row.value}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Применить
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
