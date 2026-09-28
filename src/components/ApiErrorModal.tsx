import { CloseButton } from "#/components/CloseButton";
import { formatApiError } from "#/lib/apiError";

interface ApiErrorModalProps {
  error: unknown;
  onClose: () => void;
}

export function ApiErrorModal({ error, onClose }: ApiErrorModalProps) {
  const message = formatApiError(error);
  if (!message) return null;

  function handleBackdropClick(event: React.MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div
        role="alertdialog"
        aria-labelledby="api-error-title"
        aria-describedby="api-error-message"
        className="mx-4 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2
            id="api-error-title"
            className="text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            Действие отклонено
          </h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="space-y-4 px-6 py-5">
          <p
            id="api-error-message"
            className="text-sm leading-relaxed text-gray-700 dark:text-gray-300"
          >
            {message}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
