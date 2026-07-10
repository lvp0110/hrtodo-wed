import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";

export interface DictColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  onClick?: (row: T) => void;
  onHeaderClick?: () => void;
}

interface DictTableProps<T> {
  columns: DictColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  rowHoverVariant?: "background" | "border";
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  emptyMessage?: string;
  topRow?: ReactNode;
  topRowMobile?: ReactNode;
  footerRow?: ReactNode;
  wrapperClassName?: string;
  renderMobileCard?: (row: T, actions: ReactNode) => ReactNode;
}

const rowHoverClasses = {
  background:
    "hover:bg-gray-50 dark:hover:bg-gray-800/40",
  border:
    "hover:ring-1 hover:ring-inset hover:ring-gray-300 dark:hover:ring-gray-600",
} as const;

function RowActions<T>({
  row,
  onEdit,
  onDelete,
}: {
  row: T;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}) {
  if (!onEdit && !onDelete) return null;

  return (
    <div className="inline-flex shrink-0 items-center gap-1">
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
  );
}

export function DictTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  onEdit,
  onDelete,
  rowHoverVariant = "background",
  isLoading = false,
  isError = false,
  errorMessage,
  emptyMessage = "Записей пока нет",
  topRow,
  topRowMobile,
  footerRow,
  wrapperClassName,
  renderMobileCard,
}: DictTableProps<T>) {
  const showActions = Boolean(onEdit || onDelete);
  const showMobileCards = Boolean(renderMobileCard);

  return (
    <div
      className={`overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 ${wrapperClassName ?? ""}`}
    >
      {showMobileCards && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800 lg:hidden">
          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Загрузка…
            </div>
          )}

          {!isLoading && isError && (
            <div className="px-4 py-8 text-center text-sm text-red-500">
              {errorMessage ?? "Не удалось загрузить данные"}
            </div>
          )}

          {!isLoading && !isError && topRowMobile}

          {!isLoading && !isError && rows.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              {emptyMessage}
            </div>
          )}

          {!isLoading &&
            !isError &&
            rows.map((row) => (
              <div key={rowKey(row)}>
                {renderMobileCard!(row, (
                  <RowActions row={row} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </div>
            ))}
        </div>
      )}

      <table
        className={`w-full table-auto text-left text-sm ${showMobileCards ? "hidden lg:table" : ""}`}
      >
        <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={c.onHeaderClick}
                className={`px-4 py-3 font-medium ${c.headerClassName ?? ""}${
                  c.onHeaderClick ? " cursor-pointer select-none" : ""
                }`}
              >
                {c.header}
              </th>
            ))}
            {showActions && (
              <th
                className="w-12 px-4 py-3"
                aria-label="Действия"
              />
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

          {!isLoading && !isError && topRow}

          {!isLoading &&
            !isError &&
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`text-gray-700 dark:text-gray-200 transition-[background-color,box-shadow] ${rowHoverClasses[rowHoverVariant]}${
                  onRowClick ? " cursor-pointer" : ""
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    onClick={
                      c.onClick
                        ? (e) => {
                            e.stopPropagation();
                            c.onClick!(row);
                          }
                        : undefined
                    }
                    className={`px-4 py-3 align-middle${c.onClick ? " cursor-pointer" : ""} ${c.className ?? ""}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
                {showActions && (
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      row={row}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </td>
                )}
              </tr>
            ))}

          {!isLoading && !isError && footerRow}
        </tbody>
      </table>
    </div>
  );
}
