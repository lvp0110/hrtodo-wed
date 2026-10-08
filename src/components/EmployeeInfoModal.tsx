import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IdCard, Pencil } from "lucide-react";
import { CloseButton } from "#/components/CloseButton";
import { DateInput } from "#/components/DateInput";
import { EmployeeCardPanel } from "#/components/EmployeeCardPanel";
import { GENDER_OPTIONS, normalizeGender } from "#/lib/employeeDisplay";
import type { Employer } from "#/types/api";
import type { EmployeeEditFields } from "#/lib/employeeUpdate";

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800/60 dark:disabled:text-gray-400";

function headerIconClass(active: boolean) {
  return `rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    active
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-100"
  }`;
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
  const [editing, setEditing] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<EmployeeEditFields>({
    mode: "onChange",
    defaultValues: {
      surname: employee.surname,
      first_name: employee.first_name,
      second_name: employee.second_name,
      personal_number: employee.personal_number ?? "",
      work_number: employee.work_number ?? "",
      email: employee.email ?? "",
      gender: normalizeGender(employee.gender),
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div
        className={`mx-4 flex max-h-[calc(100dvh-2rem)] w-full items-stretch overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900 ${
          cardOpen ? "max-w-4xl" : "max-w-md"
        }`}
      >
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="flex min-h-16 items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Редактирование сотрудника
            </h2>
            {employee.status === "archived" && (
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                Архивный. Статус не меняется при сохранении.
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-pressed={editing}
              aria-label={editing ? "Завершить редактирование" : "Редактировать"}
              title={editing ? "Завершить редактирование" : "Редактировать"}
              data-hint="Включает и выключает редактирование полей карточки"
              disabled={isPending}
              onClick={() => setEditing((value) => !value)}
              className={headerIconClass(editing)}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              aria-pressed={cardOpen}
              aria-label={
                cardOpen ? "Скрыть карточку сотрудника" : "Карточка сотрудника"
              }
              title={
                cardOpen ? "Скрыть карточку сотрудника" : "Карточка сотрудника"
              }
              data-hint="Открывает карточку сотрудника справа от формы"
              onClick={() => setCardOpen((value) => !value)}
              className={headerIconClass(cardOpen)}
            >
              <IdCard size={28} />
            </button>
            <CloseButton onClick={onClose} />
          </div>
        </div>

        <form
          onSubmit={handleSubmit((fields) => {
            if (!editing) return;
            onSubmit(fields);
          })}
          className="px-6 py-5"
        >
          <fieldset
            disabled={!editing}
            className="m-0 min-w-0 space-y-4 border-0 p-0"
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
              Личный телефон
            </label>
            <input
              type="tel"
              autoComplete="tel"
              {...register("personal_number")}
              className={`${inputClass} border-gray-200 dark:border-gray-700`}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Рабочий телефон
            </label>
            <input
              type="tel"
              autoComplete="tel"
              {...register("work_number")}
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
            <Controller
              name="hireDate"
              control={control}
              render={({ field }) => (
                <DateInput
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  className={`${inputClass} border-gray-200 dark:border-gray-700`}
                />
              )}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}
          </fieldset>

          <div className="mt-4 flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              data-hint="Закрывает карточку и не сохраняет правки"
              disabled={isPending}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              data-hint="Сохраняет изменения карточки сотрудника"
              disabled={!editing || !isValid || isPending}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Сохраняем…" : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
      {cardOpen && <EmployeeCardPanel employee={employee} />}
      </div>
    </div>
  );
}
