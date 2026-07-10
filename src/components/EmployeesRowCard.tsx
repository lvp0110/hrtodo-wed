import type { ReactNode } from "react";

type CardField = {
  key: string;
  label: string;
  onClick?: () => void;
  content: ReactNode;
};

interface EmployeesRowCardProps {
  headerLeading?: ReactNode;
  headerContent: ReactNode;
  headerOnClick?: () => void;
  fields: CardField[];
  actions?: ReactNode;
}

export function EmployeesRowCard({
  headerLeading,
  headerContent,
  headerOnClick,
  fields,
  actions,
}: EmployeesRowCardProps) {
  return (
    <div className="p-4 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/40">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {headerLeading}
          <div
            className={`min-w-0 font-medium text-gray-900 dark:text-gray-100${
              headerOnClick ? " cursor-pointer" : ""
            }`}
            onClick={headerOnClick}
          >
            {headerContent}
          </div>
        </div>
        {actions}
      </div>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {field.label}
            </dt>
            <dd
              className={`mt-0.5 break-words${field.onClick ? " cursor-pointer" : ""}`}
              onClick={field.onClick}
            >
              {field.content}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
