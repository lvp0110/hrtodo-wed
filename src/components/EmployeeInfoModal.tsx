import { CloseButton } from "#/components/CloseButton";
import {
  displayValue,
  formatGender,
  formatHireDate,
} from "#/lib/employeeDisplay";

export type EmployeeInfoData = {
  name: string;
  gender: string | null;
  position: string | null;
  email: string | null;
  city: string | null;
  office: string | null;
  department: string | null;
  hireDate: string | null;
};

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="mb-0.5 text-xs text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div className="text-sm text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

interface EmployeeInfoModalProps {
  data: EmployeeInfoData;
  onClose: () => void;
  onEdit?: () => void;
}

export function EmployeeInfoModal({ data, onClose, onEdit }: EmployeeInfoModalProps) {
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
          <Row label="Пол" value={formatGender(data.gender)} />
          <Row label="ФИО" value={displayValue(data.name)} />
          <Row label="Должность" value={displayValue(data.position)} />
          <Row label="Email" value={displayValue(data.email)} />
          <Row label="Город" value={displayValue(data.city)} />
          <Row label="Офис" value={displayValue(data.office)} />
          <Row label="Отдел" value={displayValue(data.department)} />
          <Row label="Дата устройства" value={formatHireDate(data.hireDate)} />
        </div>

        <div className="flex gap-2 px-6 pb-5">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Редактировать
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
