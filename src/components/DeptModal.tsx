import { useForm } from "react-hook-form";
import { CloseButton } from "#/components/CloseButton";
import type { DeptFields, DeptModalState } from "#/types/orgChart";

export type { DeptFields };

interface DeptModalProps {
  state: DeptModalState;
  onClose: () => void;
  onSubmit: (data: DeptFields) => void;
}

export function DeptModal({ state, onClose, onSubmit }: DeptModalProps) {
  const isEdit = state.mode === "edit";

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<DeptFields>({
    mode: "onChange",
    defaultValues: isEdit
      ? { name: state.name, type: state.type, code: state.code }
      : undefined,
  });

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
              {isEdit ? "Редактировать отдел" : "Новый отдел"}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {isEdit ? state.name : `Родитель: ${state.parentLabel}`}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Название <span className="text-red-400">*</span>
            </label>
            <input
              {...register("name", { required: "Обязательное поле" })}
              autoFocus
              placeholder="Например: Отдел маркетинга"
              className={`${inputClass} ${errors.name ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Тип
            </label>
            <input
              {...register("type")}
              placeholder="Например: Департамент"
              className={`${inputClass} border-gray-200 dark:border-gray-700`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Код
            </label>
            <input
              {...register("code")}
              placeholder="Например: MKT"
              className={`${inputClass} border-gray-200 dark:border-gray-700`}
            />
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
              {isEdit ? "Сохранить" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
