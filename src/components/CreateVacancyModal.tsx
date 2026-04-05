import { useForm } from "react-hook-form";
import { CloseButton } from "#/components/CloseButton";
import type { AddVacancyState, VacancyFormFields } from "#/types/orgChart";

interface CreateVacancyModalProps {
  state: AddVacancyState;
  onClose: () => void;
  onSubmit: (data: VacancyFormFields) => void;
}

export function CreateVacancyModal({
  state,
  onClose,
  onSubmit,
}: CreateVacancyModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<VacancyFormFields>({ mode: "onChange" });

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

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
            <input
              {...register("city", { required: "Обязательное поле" })}
              placeholder="Например: Москва"
              className={`${inputClass} ${errors.city ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
            />
            {errors.city && (
              <p className="mt-1 text-xs text-red-400">{errors.city.message}</p>
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Сотрудник — необязательно. Если не указан, позиция считается вакантной.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Фамилия
                  </label>
                  <input
                    {...register("surname")}
                    placeholder="Иванов"
                    className={`${inputClass} border-gray-200 dark:border-gray-700`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Имя
                  </label>
                  <input
                    {...register("firstName")}
                    placeholder="Иван"
                    className={`${inputClass} border-gray-200 dark:border-gray-700`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Отчество
                </label>
                <input
                  {...register("secondName")}
                  placeholder="Иванович"
                  className={`${inputClass} border-gray-200 dark:border-gray-700`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  {...register("email", {
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Некорректный email",
                    },
                  })}
                  type="email"
                  placeholder="ivanov@company.ru"
                  className={`${inputClass} ${errors.email ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
