import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";

export interface DictColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DictTableProps<T> {
  columns: DictColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  emptyMessage?: string;
}

export function DictTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  onEdit,
  onDelete,
  isLoading = false,
  isError = false,
  errorMessage,
  emptyMessage = "Записей пока нет",
}: DictTableProps<T>) {
  const showActions = Boolean(onEdit || onDelete);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-3 font-medium ${c.headerClassName ?? ""}`}
              >
                {c.header}
              </th>
            ))}
            {showActions && (
              <th className="w-40 px-4 py-3 font-medium text-right">
                Действия
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {isLoading && (
            <tr>
              <td
                colSpan={columns.length + (showActions ? 1 : 0)}
                className="px-4 py-8 text-center text-gray-400"
              >
                Загрузка…
              </td>
            </tr>
          )}

          {!isLoading && isError && (
            <tr>
              <td
                colSpan={columns.length + (showActions ? 1 : 0)}
                className="px-4 py-8 text-center text-red-500"
              >
                {errorMessage ?? "Не удалось загрузить данные"}
              </td>
            </tr>
          )}

          {!isLoading && !isError && rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (showActions ? 1 : 0)}
                className="px-4 py-8 text-center text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          )}

          {!isLoading &&
            !isError &&
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/40${
                  onRowClick ? " cursor-pointer" : ""
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 align-middle ${c.className ?? ""}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
                {showActions && (
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          aria-label="Редактировать"
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          aria-label="Удалить"
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
