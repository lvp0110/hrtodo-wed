import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { dictInputClass } from "#/components/settings/DictFormModal";
import { DepartmentTreeSelect } from "#/components/DepartmentTreeSelect";
import { GENDER_OPTIONS } from "#/lib/employeeDisplay";
import type { EmployeeVacancyCreateFields } from "#/lib/employeeUpdate";
import { officesApi } from "#/services/api";
import type { City, OrgNode } from "#/types/api";

const emptyDraft: EmployeeVacancyCreateFields = {
  surname: "",
  first_name: "",
  second_name: "",
  email: "",
  gender: "",
  hireDate: "",
  cityCode: "",
  cityId: null,
  officeCode: "",
  officeId: null,
  nodeId: 0,
  position: "",
  isManager: false,
};

const compactInputClass = `${dictInputClass} min-w-0 px-2 py-1.5 text-xs`;

interface EmployeeAddRowProps {
  columnsCount: number;
  cities: City[];
  orgNodes: OrgNode[];
  isPending: boolean;
  error: string | null;
  onSubmit: (data: EmployeeVacancyCreateFields) => void;
}

export function EmployeeAddRow({
  columnsCount,
  cities,
  orgNodes,
  isPending,
  error,
  onSubmit,
}: EmployeeAddRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draft, setDraft] = useState<EmployeeVacancyCreateFields>(emptyDraft);
  const [localError, setLocalError] = useState<string | null>(null);

  const officesQuery = useQuery({
    queryKey: ["offices", "city", draft.cityId] as const,
    queryFn: () => officesApi.getByCity(draft.cityId!).then((res) => res.data ?? []),
    enabled: draft.cityId !== null,
  });

  useEffect(() => {
    if (
      draft.officeCode &&
      officesQuery.data &&
      !officesQuery.data.some((office) => office.code === draft.officeCode)
    ) {
      setDraft((prev) => ({ ...prev, officeCode: "", officeId: null }));
    }
  }, [draft.cityCode, draft.officeCode, officesQuery.data]);

  const displayError = localError ?? error;

  function reset() {
    setDraft(emptyDraft);
    setLocalError(null);
    setIsExpanded(false);
  }

  function updateDraft<K extends keyof EmployeeVacancyCreateFields>(
    key: K,
    value: EmployeeVacancyCreateFields[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setLocalError(null);
  }

  function handleCityChange(cityCode: string) {
    const city = cities.find((item) => item.code === cityCode);
    setDraft((prev) => ({
      ...prev,
      cityCode,
      cityId: city?.id ?? null,
      officeCode: "",
      officeId: null,
    }));
    setLocalError(null);
  }

  function handleOfficeChange(officeCode: string) {
    const office = officesQuery.data?.find((item) => item.code === officeCode);
    setDraft((prev) => ({
      ...prev,
      officeCode,
      officeId: office?.id ?? null,
    }));
    setLocalError(null);
  }

  function handleSubmit() {
    const hasEmployeeDraft =
      Boolean(draft.surname.trim()) ||
      Boolean(draft.first_name.trim()) ||
      Boolean(draft.second_name.trim()) ||
      Boolean(draft.gender) ||
      Boolean(draft.hireDate);

    if (hasEmployeeDraft && (!draft.surname.trim() || !draft.first_name.trim())) {
      setLocalError("Если добавляете сотрудника, укажите фамилию и имя");
      return;
    }
    if (!draft.cityCode) {
      setLocalError("Выберите город");
      return;
    }
    if (!draft.nodeId) {
      setLocalError("Выберите отдел");
      return;
    }
    if (!draft.position.trim()) {
      setLocalError("Укажите должность");
      return;
    }

    onSubmit(draft);
  }

  if (!isExpanded) {
    return (
      <tr
        className="cursor-pointer text-gray-400 transition-colors hover:bg-gray-50 hover:text-blue-600 dark:text-gray-500 dark:hover:bg-gray-800/40 dark:hover:text-blue-400"
        onClick={() => setIsExpanded(true)}
      >
        <td colSpan={columnsCount} className="px-4 py-3">
          <span className="inline-flex items-center gap-2 text-sm">
            <Plus size={14} />
            Добавить сотрудника и вакансию
          </span>
        </td>
      </tr>
    );
  }

  const officesDisabled =
    !draft.cityCode || officesQuery.isPending || officesQuery.isError;

  return (
    <>
      <tr className="bg-blue-50/40 dark:bg-blue-950/20">
        <td className="px-4 py-3 align-top" />
        <td className="px-4 py-3 align-top">
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <input
              type="text"
              value={draft.surname}
              onChange={(e) => updateDraft("surname", e.target.value)}
              placeholder="Фамилия"
              className={compactInputClass}
            />
            <input
              type="text"
              value={draft.first_name}
              onChange={(e) => updateDraft("first_name", e.target.value)}
              placeholder="Имя"
              className={compactInputClass}
            />
            <input
              type="text"
              value={draft.second_name}
              onChange={(e) => updateDraft("second_name", e.target.value)}
              placeholder="Отчество"
              className={compactInputClass}
            />
            <select
              value={draft.gender}
              onChange={(e) => updateDraft("gender", e.target.value)}
              className={compactInputClass}
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value || "unknown"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={draft.hireDate}
              onChange={(e) => updateDraft("hireDate", e.target.value)}
              className={compactInputClass}
              title="Дата устройства"
            />
            <label className="inline-flex items-center gap-2 px-1 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={draft.isManager}
                onChange={(e) => updateDraft("isManager", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
              />
              <span>Руководящая должность</span>
            </label>
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <select
            value={draft.cityCode}
            onChange={(e) => handleCityChange(e.target.value)}
            className={`${compactInputClass} min-w-[120px]`}
          >
            <option value="">Город *</option>
            {cities.map((city) => (
              <option key={city.code} value={city.code}>
                {city.name}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 align-top">
          <select
            value={draft.officeCode}
            onChange={(e) => handleOfficeChange(e.target.value)}
            disabled={officesDisabled}
            className={`${compactInputClass} min-w-[120px] disabled:opacity-60`}
          >
            <option value="">
              {!draft.cityCode
                ? "Сначала город"
                : officesQuery.isPending
                  ? "Загрузка…"
                  : "Офис"}
            </option>
            {officesQuery.data?.map((office) => (
              <option key={office.id} value={office.code}>
                {office.name}
              </option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 align-top">
          <DepartmentTreeSelect
            variant="node"
            tree={orgNodes}
            value={draft.nodeId}
            onChange={(nodeId) => updateDraft("nodeId", nodeId)}
            placeholder="Отдел *"
            compact
          />
        </td>
        <td className="px-4 py-3 align-top">
          <input
            type="text"
            value={draft.position}
            onChange={(e) => updateDraft("position", e.target.value)}
            placeholder="Должность *"
            className={`${compactInputClass} min-w-[140px]`}
          />
        </td>
      </tr>
      <tr className="bg-blue-50/40 dark:bg-blue-950/20">
        <td colSpan={columnsCount} className="px-4 pb-3 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Создаём…" : "Создать"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={isPending}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Отмена
            </button>
            {displayError && (
              <p className="text-xs text-red-500 dark:text-red-400">{displayError}</p>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}
