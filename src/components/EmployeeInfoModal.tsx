import { useForm } from "react-hook-form";
import { CloseButton } from "#/components/CloseButton";
import { GENDER_OPTIONS, normalizeGender } from "#/lib/employeeDisplay";
import type { Employer } from "#/types/api";
import type { EmployeeEditFields } from "#/lib/employeeUpdate";

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

function toDateInputValue(date: string | null | undefined): string {
  if (!date?.trim()) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

interface EmployeeInfoModalProps {
  employee: Employer;
  onClose: () => void;
  onSubmit: (fields: EmployeeEditFields) => void;
  isPending?: boolean;
  error?: string | null;
}

export function EmployeeInfoModal({
  employee,
  onClose,
  onSubmit,
  isPending = false,
  error = null,
}: EmployeeInfoModalProps) {
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<EmployeeEditFields>({
    mode: "onChange",
    defaultValues: {
      surname: employee.surname,
      first_name: employee.first_name,
      second_name: employee.second_name,
      phone: employee.phone ?? "",
      email: employee.email ?? "",
      gender: normalizeGender(employee.gender),
      hireDate: toDateInputValue(employee.hire_date),
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Редактирование сотрудника
          </h2>
          <CloseButton onClick={onClose} />
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 px-6 py-5"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Фамилия <span className="text-red-400">*</span>
            </label>
            <input
              {...register("surname", { required: "Обязательное поле" })}
              className={`${inputClass} ${errors.surname ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
            />
            {errors.surname && (
              <p className="mt-1 text-xs text-red-400">{errors.surname.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Имя <span className="text-red-400">*</span>
            </label>
            <input
              {...register("first_name", { required: "Обязательное поле" })}
              className={`${inputClass} ${errors.first_name ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
            />
            {errors.first_name && (
              <p className="mt-1 text-xs text-red-400">{errors.first_name.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Отчество
            </label>
            <input
              {...register("second_name")}
              className={`${inputClass} border-gray-200 dark:border-gray-700`}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Телефон
            </label>
            <input
              type="tel"
              autoComplete="tel"
              {...register("phone")}
              className={`${inputClass} border-gray-200 dark:border-gray-700`}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Эл. почта
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email", {
                validate: (value) => {
                  const trimmed = value.trim();
                  if (!trimmed) return true;
                  return (
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ||
                    "Некорректный email"
                  );
                },
              })}
              className={`${inputClass} ${errors.email ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Пол
            </label>
            <select
              {...register("gender")}
              className={`${inputClass} border-gray-200 dark:border-gray-700`}
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value || "unknown"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Дата устройства на работу
            </label>
            <input
              type="date"
              {...register("hireDate")}
              className={`${inputClass} border-gray-200 dark:border-gray-700`}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!isValid || isPending}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Сохраняем…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
