import { CloseButton } from "#/components/CloseButton";

export type EmployeeInfoData = {
  name: string;
  email: string;
  city: string | null;
  department: string | null;
  position: string | null;
  isOccupied: boolean;
  description: string | null;
  jobOffer: string | null;
};

function Row({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="mb-0.5 text-xs text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div
        className={`text-sm text-gray-900 dark:text-gray-100${multiline ? " whitespace-pre-line" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function displayValue(value: string | null) {
  return value?.trim() || "—";
}

interface EmployeeInfoModalProps {
  data: EmployeeInfoData;
  onClose: () => void;
}

export function EmployeeInfoModal({ data, onClose }: EmployeeInfoModalProps) {
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div className="mx-4 w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {data.name}
            </h2>
            {data.position && (
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                {data.position}
              </p>
            )}
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                data.isOccupied
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              {data.isOccupied ? "Занято" : "Вакантно"}
            </span>
          </div>

          <Row label="Email" value={displayValue(data.email)} />
          <Row label="Город" value={displayValue(data.city)} />
          <Row label="Отдел" value={displayValue(data.department)} />
          <Row label="Должность" value={displayValue(data.position)} />
          <Row
            label="Описание вакансии"
            value={displayValue(data.description)}
            multiline
          />
          <Row
            label="Предложение о работе"
            value={displayValue(data.jobOffer)}
            multiline
          />
        </div>

        <div className="px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
