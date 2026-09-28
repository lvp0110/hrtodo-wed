import { useState } from "react";
import { CloseButton } from "#/components/CloseButton";

interface DeleteArchivedEmployeeModalProps {
  employeeName: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteArchivedEmployeeModal({
  employeeName,
  isPending,
  onClose,
  onConfirm,
}: DeleteArchivedEmployeeModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const name = employeeName || "этого сотрудника";

  function handleBackdropClick(event: React.MouseEvent) {
    if (isPending) return;
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div
        role="alertdialog"
        aria-labelledby="delete-archived-employee-title"
        aria-describedby="delete-archived-employee-message"
        className="mx-4 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2
            id="delete-archived-employee-title"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            {step === 1 ? "Удалить из архива?" : "Подтвердите удаление"}
          </h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="space-y-4 px-6 py-5">
          <p
            id="delete-archived-employee-message"
            className="text-sm leading-relaxed text-gray-700 dark:text-gray-300"
          >
            {step === 1
              ? `Сотрудник «${name}» будет удалён из архива. Это действие необратимо.`
              : `Удалить «${name}» окончательно? Восстановить запись будет нельзя.`}
          </p>
          <div className="flex gap-2">
            {step === 1 ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  Продолжить
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Удаление…" : "Удалить"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isPending}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  Назад
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
