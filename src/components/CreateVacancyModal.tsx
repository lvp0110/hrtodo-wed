import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { CloseButton } from "#/components/CloseButton";
import { dictQueries } from "#/services/api";
import type { AddVacancyState, VacancyFormFields } from "#/types/orgChart";

interface CreateVacancyModalProps {
  state: AddVacancyState;
  onClose: () => void;
  onSubmit: (data: VacancyFormFields) => void;
  isPending?: boolean;
  error?: string | null;
}

export function CreateVacancyModal({
  state,
  onClose,
  onSubmit,
  isPending = false,
  error = null,
}: CreateVacancyModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<VacancyFormFields>({
    mode: "onChange",
    defaultValues: {
      isManager: false,
      cityCode: "",
      description: "",
      jobOffer: "",
    },
  });

  const citiesQuery = useQuery(dictQueries.cities);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  const citiesDisabled = citiesQuery.isPending || citiesQuery.isError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Новая вакансия
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {state.deptName}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Должность <span className="text-red-400">*</span>
            </label>
            <input
              {...register("position", { required: "Обязательное поле" })}
              autoFocus
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
              disabled={citiesDisabled}
              className={`${inputClass} ${errors.cityCode ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"} disabled:opacity-60`}
            >
              <option value="" disabled hidden>
                {citiesQuery.isPending ? "Загрузка…" : "Выберите город"}
              </option>
              {citiesQuery.data?.map((city) => (
                <option key={city.code} value={city.code}>
                  {city.name}
                </option>
              ))}
            </select>
            {errors.cityCode && (
              <p className="mt-1 text-xs text-red-400">{errors.cityCode.message}</p>
            )}
            {citiesQuery.isError && (
              <p className="mt-1 text-xs text-red-400">
                Не удалось загрузить список городов
              </p>
            )}
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
              disabled={!isValid || isPending || citiesDisabled}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Создаём…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
