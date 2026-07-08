import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { CloseButton } from "#/components/CloseButton";
import { dictQueries, officesApi, orgNodesApi } from "#/services/api";
import { findEmployeeVacancyConflict } from "#/lib/vacancyValidation";
import type {
  EditVacancyFormFields,
  VacancyModalData,
} from "#/types/orgChart";
import type { City, Employer, OrgNode } from "#/types/api";

interface EditVacancyModalProps {
  data: VacancyModalData;
  onClose: () => void;
  onSubmit: (data: EditVacancyFormFields) => void;
  isPending?: boolean;
  error?: string | null;
}

type DeptOption = {
  id: number;
  label: string;
};

function employeeLabel({
  surname,
  first_name,
  second_name,
}: {
  surname: string;
  first_name: string;
  second_name: string;
}) {
  return [surname, first_name, second_name].filter(Boolean).join(" ");
}

function flattenOrgNodes(nodes: OrgNode[], depth = 0): DeptOption[] {
  const result: DeptOption[] = [];

  for (const node of nodes) {
    const prefix = depth > 0 ? `${"— ".repeat(depth)}` : "";
    result.push({ id: node.id, label: `${prefix}${node.name}` });
    if (node.children?.length) {
      result.push(...flattenOrgNodes(node.children, depth + 1));
    }
  }

  return result;
}

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export function EditVacancyModal({
  data,
  onClose,
  onSubmit,
  isPending = false,
  error = null,
}: EditVacancyModalProps) {
  const cities = useQuery(dictQueries.cities);
  const employees = useQuery(dictQueries.employees);
  const orgTree = useQuery({
    queryKey: ["orgTree"],
    queryFn: () => orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
  });

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const departments = useMemo(
    () => flattenOrgNodes(orgTree.data ?? []),
    [orgTree.data],
  );

  const dictsReady =
    cities.isSuccess && employees.isSuccess && orgTree.isSuccess;
  const dictsError = cities.isError || employees.isError || orgTree.isError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Редактирование вакансии
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {data.deptName}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {dictsError && (
          <div className="px-6 py-8 text-sm text-red-500 dark:text-red-400">
            Не удалось загрузить справочники
          </div>
        )}

        {!dictsError && !dictsReady && (
          <div className="px-6 py-8 text-sm text-gray-400 dark:text-gray-500">
            Загрузка справочников…
          </div>
        )}

        {dictsReady && (
          <EditVacancyForm
            data={data}
            cities={cities.data}
            departments={departments}
            employees={employees.data}
            orgNodes={orgTree.data ?? []}
            onClose={onClose}
            onSubmit={onSubmit}
            isPending={isPending}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

interface EditVacancyFormProps {
  data: VacancyModalData;
  cities: City[];
  departments: DeptOption[];
  employees: Employer[];
  orgNodes: OrgNode[];
  onClose: () => void;
  onSubmit: (data: EditVacancyFormFields) => void;
  isPending: boolean;
  error: string | null;
}

function EditVacancyForm({
  data,
  cities,
  departments,
  employees,
  orgNodes,
  onClose,
  onSubmit,
  isPending,
  error,
}: EditVacancyFormProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const employeeOptions = useMemo(() => {
    if (!data.employer?.id) return employees;
    const alreadyExists = employees.some((employee) => employee.id === data.employer?.id);
    if (alreadyExists) return employees;

    const [surname = "", first_name = "", second_name = ""] = data.employer.name.split(" ");
    return [
      ...employees,
      {
        id: data.employer.id,
        surname,
        first_name,
        second_name,
        email: data.employer.email ?? "",
      } as Employer,
    ];
  }, [employees, data.employer]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid },
  } = useForm<EditVacancyFormFields>({
    mode: "onChange",
    defaultValues: {
      position: data.position,
      cityCode: data.cityCode,
      officeCode: data.officeCode ?? "",
      nodeId: data.nodeId,
      userId: data.employer?.id ?? null,
      isManager: data.isManager,
      description: data.description,
      jobOffer: data.jobOffer,
    },
  });

  const cityCode = watch("cityCode");
  const selectedCityId = useMemo(
    () => cities.find((city) => city.code === cityCode)?.id ?? null,
    [cities, cityCode],
  );

  const officesQuery = useQuery({
    queryKey: ["offices", "city", selectedCityId] as const,
    queryFn: () => officesApi.getByCity(selectedCityId!).then((res) => res.data ?? []),
    enabled: selectedCityId !== null,
  });

  useEffect(() => {
    const currentOfficeCode = getValues("officeCode");
    if (
      currentOfficeCode &&
      officesQuery.data &&
      !officesQuery.data.some((office) => office.code === currentOfficeCode)
    ) {
      setValue("officeCode", "");
    }
  }, [cityCode, officesQuery.data, setValue, getValues]);

  const officesDisabled = !cityCode || officesQuery.isPending || officesQuery.isError;

  function handleFormSubmit(formData: EditVacancyFormFields) {
    setLocalError(null);

    const conflict = findEmployeeVacancyConflict(
      orgNodes,
      data.id,
      formData.nodeId,
      formData.position,
      formData.userId,
    );

    if (conflict) {
      setLocalError(
        `Сотрудник уже назначен на должность «${conflict.position}» в отделе «${conflict.deptName}».`,
      );
      return;
    }

    onSubmit(formData);
  }

  const displayError = localError ?? error;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="px-6 py-5 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Должность <span className="text-red-400">*</span>
        </label>
        <input
          {...register("position", { required: "Обязательное поле" })}
          placeholder="Например: Менеджер по продажам"
          className={`${inputClass} ${errors.position ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        />
        {errors.position && (
          <p className="mt-1 text-xs text-red-400">{errors.position.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Город <span className="text-red-400">*</span>
        </label>
        <select
          {...register("cityCode", { required: "Обязательное поле" })}
          className={`${inputClass} ${errors.cityCode ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        >
          <option value="" disabled hidden>
            Выберите город
          </option>
          {cities.map((city) => (
            <option key={city.code} value={city.code}>
              {city.name}
            </option>
          ))}
        </select>
        {errors.cityCode && (
          <p className="mt-1 text-xs text-red-400">{errors.cityCode.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Офис
        </label>
        <select
          {...register("officeCode")}
          disabled={officesDisabled}
          className={`${inputClass} border-gray-200 dark:border-gray-700 disabled:opacity-60`}
        >
          <option value="">
            {!cityCode
              ? "Сначала выберите город"
              : officesQuery.isPending
                ? "Загрузка…"
                : "— Без офиса —"}
          </option>
          {officesQuery.data?.map((office) => (
            <option key={office.id} value={office.code}>
              {office.name}
            </option>
          ))}
        </select>
        {officesQuery.isError && (
          <p className="mt-1 text-xs text-red-400">
            Не удалось загрузить список офисов
          </p>
        )}
        {cityCode && !watch("officeCode") && (
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Чтобы сохранить город, выберите офис в этом городе.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Отдел <span className="text-red-400">*</span>
        </label>
        <select
          {...register("nodeId", {
            required: "Обязательное поле",
            setValueAs: (value) => Number(value),
          })}
          className={`${inputClass} ${errors.nodeId ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        >
          <option value="" disabled hidden>
            Выберите отдел
          </option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.label}
            </option>
          ))}
        </select>
        {errors.nodeId && (
          <p className="mt-1 text-xs text-red-400">{errors.nodeId.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Сотрудник
        </label>
        <select
          {...register("userId", {
            setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
          })}
          className={`${inputClass} border-gray-200 dark:border-gray-700`}
        >
          <option value="">— Без сотрудника (вакантно) —</option>
          {employeeOptions.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {employeeLabel(emp)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Описание вакансии
        </label>
        <textarea
          {...register("description")}
          rows={3}
          placeholder="Обязанности, требования, условия…"
          className={`${inputClass} border-gray-200 dark:border-gray-700 resize-y`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Предложение о работе
        </label>
        <textarea
          {...register("jobOffer")}
          rows={3}
          placeholder="Текст предложения о работе…"
          className={`${inputClass} border-gray-200 dark:border-gray-700 resize-y`}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          {...register("isManager")}
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Руководящая должность
        </span>
      </label>

      {displayError && (
        <p className="text-sm text-red-500 dark:text-red-400">{displayError}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={!isValid || isPending}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
