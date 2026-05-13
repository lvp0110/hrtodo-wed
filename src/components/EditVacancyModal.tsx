import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { CloseButton } from "#/components/CloseButton";
import { dictQueries } from "#/services/api";
import type {
  EditVacancyFormFields,
  VacancyModalData,
} from "#/types/orgChart";
import type { Employer, Entity } from "#/types/api";

interface EditVacancyModalProps {
  data: VacancyModalData;
  onClose: () => void;
  onSubmit: (data: EditVacancyFormFields) => void;
  isPending?: boolean;
  error?: string | null;
}

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

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const dictsReady = cities.isSuccess && employees.isSuccess;
  const dictsError = cities.isError || employees.isError;

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
            employees={employees.data}
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
  cities: Entity[];
  employees: Employer[];
  onClose: () => void;
  onSubmit: (data: EditVacancyFormFields) => void;
  isPending: boolean;
  error: string | null;
}

function EditVacancyForm({
  data,
  cities,
  employees,
  onClose,
  onSubmit,
  isPending,
  error,
}: EditVacancyFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<EditVacancyFormFields>({
    mode: "onChange",
    defaultValues: {
      position: data.position,
      cityCode: data.cityCode,
      userId: data.employer?.id ?? null,
      isManager: data.isManager,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
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
          Сотрудник
        </label>
        <select
          {...register("userId", {
            setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
          })}
          className={`${inputClass} border-gray-200 dark:border-gray-700`}
        >
          <option value="">— Без сотрудника (вакантно) —</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {employeeLabel(emp)}
            </option>
          ))}
        </select>
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

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
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
