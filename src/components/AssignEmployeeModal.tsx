import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { CloseButton } from "#/components/CloseButton";
import { GENDER_OPTIONS } from "#/lib/employeeDisplay";
import { findEmployeeVacancyConflict } from "#/lib/vacancyValidation";
import { dictQueries, orgNodesApi } from "#/services/api";
import type { EmployeeEditFields } from "#/lib/employeeUpdate";
import type { VacancyModalData } from "#/types/orgChart";
import type { Employer } from "#/types/api";

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export type AssignEmployeeMode = "existing" | "new";

export type AssignEmployeeFormFields = EmployeeEditFields & {
  mode: AssignEmployeeMode;
  existingUserId: number | null;
};

interface AssignEmployeeModalProps {
  vacancy: VacancyModalData;
  onClose: () => void;
  onSubmit: (data: AssignEmployeeFormFields) => void;
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

export function AssignEmployeeModal({
  vacancy,
  onClose,
  onSubmit,
  isPending = false,
  error = null,
}: AssignEmployeeModalProps) {
  const employees = useQuery(dictQueries.employees);
  const orgTree = useQuery({
    queryKey: ["orgTree"],
    queryFn: () => orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
  });

  const [localError, setLocalError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AssignEmployeeFormFields>({
    mode: "onChange",
    defaultValues: {
      mode: "new",
      existingUserId: null,
      surname: "",
      first_name: "",
      second_name: "",
      personal_number: "",
      work_number: "",
      email: "",
      gender: "",
      hireDate: "",
    },
  });

  const mode = watch("mode");

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleFormSubmit(data: AssignEmployeeFormFields) {
    setLocalError(null);

    if (data.mode === "existing") {
      if (!data.existingUserId) {
        setLocalError("Выберите сотрудника");
        return;
      }
    } else if (!data.surname.trim() || !data.first_name.trim()) {
      setLocalError("Укажите фамилию и имя");
      return;
    }

    if (orgTree.isSuccess && data.mode === "existing" && data.existingUserId) {
      const conflict = findEmployeeVacancyConflict(
        orgTree.data ?? [],
        vacancy.id,
        vacancy.nodeId,
        vacancy.position,
        data.existingUserId,
      );
      if (conflict) {
        setLocalError(
          `Сотрудник уже назначен на должность «${conflict.position}» в отделе «${conflict.deptName}».`,
        );
        return;
      }
    }

    onSubmit(data);
  }

  const dictsLoading = employees.isPending || orgTree.isPending;
  const dictsError = employees.isError || orgTree.isError;
  const displayError = localError ?? error;
  const employeeList = employees.data ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Назначить сотрудника
            </h2>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              {vacancy.position} · {vacancy.deptName}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {dictsError && (
          <div className="px-6 py-8 text-sm text-red-500 dark:text-red-400">
            Не удалось загрузить справочники
          </div>
        )}

        {!dictsError && dictsLoading && (
          <div className="px-6 py-8 text-sm text-gray-400 dark:text-gray-500">
            Загрузка…
          </div>
        )}

        {!dictsError && !dictsLoading && (
          <form
            onSubmit={handleSubmit(handleFormSubmit)}
            className="space-y-4 px-6 py-5"
          >
            <div className="flex gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              <label className="flex-1">
                <input
                  type="radio"
                  value="new"
                  className="peer sr-only"
                  {...register("mode")}
                />
                <span className="block cursor-pointer rounded-md px-3 py-1.5 text-center text-xs font-medium text-gray-600 transition-colors peer-checked:bg-white peer-checked:text-gray-900 peer-checked:shadow-sm dark:text-gray-400 dark:peer-checked:bg-gray-900 dark:peer-checked:text-gray-100">
                  Новый сотрудник
                </span>
              </label>
              <label className="flex-1">
                <input
                  type="radio"
                  value="existing"
                  className="peer sr-only"
                  {...register("mode")}
                />
                <span className="block cursor-pointer rounded-md px-3 py-1.5 text-center text-xs font-medium text-gray-600 transition-colors peer-checked:bg-white peer-checked:text-gray-900 peer-checked:shadow-sm dark:text-gray-400 dark:peer-checked:bg-gray-900 dark:peer-checked:text-gray-100">
                  Из списка
                </span>
              </label>
            </div>

            {mode === "existing" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Сотрудник <span className="text-red-400">*</span>
                </label>
                <select
                  {...register("existingUserId", {
                    setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  })}
                  className={`${inputClass} border-gray-200 dark:border-gray-700`}
                >
                  <option value="">Выберите сотрудника</option>
                  {employeeList.map((emp: Employer) => (
                    <option key={emp.id} value={emp.id}>
                      {employeeLabel(emp)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Фамилия <span className="text-red-400">*</span>
                  </label>
                  <input
                    {...register("surname")}
                    autoFocus
                    className={`${inputClass} border-gray-200 dark:border-gray-700`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Имя <span className="text-red-400">*</span>
                  </label>
                  <input
                    {...register("first_name")}
                    className={`${inputClass} border-gray-200 dark:border-gray-700`}
                  />
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
              </>
            )}

            {displayError && (
              <p className="text-sm text-red-500 dark:text-red-400">{displayError}</p>
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
                disabled={isPending}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? "Назначаем…" : "Назначить"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
