import { useEffect, useMemo, useRef, useState } from "react";
import { dictInputClass } from "#/components/settings/DictFormModal";
import type { Employer } from "#/types/api";

function employeeLabel({
  surname,
  first_name,
  second_name,
}: Pick<Employer, "surname" | "first_name" | "second_name">) {
  return [surname, first_name, second_name].filter(Boolean).join(" ");
}

function matchesEmployeeQuery(
  employee: Pick<Employer, "surname" | "first_name" | "second_name">,
  query: string,
): boolean {
  if (!query.trim()) return true;
  return employeeLabel(employee).toLowerCase().includes(query.trim().toLowerCase());
}

interface EmployeeSelectProps {
  employees: Employer[];
  value: number | null;
  onChange: (userId: number | null) => void;
  vacantLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function EmployeeSelect({
  employees,
  value,
  onChange,
  vacantLabel = "— Без сотрудника (вакантно) —",
  className = "",
  disabled = false,
}: EmployeeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === value) ?? null,
    [employees, value],
  );

  const selectedLabel = selectedEmployee
    ? employeeLabel(selectedEmployee)
    : vacantLabel;

  const filteredEmployees = useMemo(() => {
    const matched = employees.filter((employee) =>
      matchesEmployeeQuery(employee, searchQuery),
    );
    if (
      selectedEmployee &&
      !matched.some((employee) => employee.id === selectedEmployee.id)
    ) {
      return [selectedEmployee, ...matched];
    }
    return matched;
  }, [employees, searchQuery, selectedEmployee]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isOpen]);

  function selectVacant() {
    onChange(null);
    setIsOpen(false);
  }

  function selectEmployee(employee: Employer) {
    onChange(employee.id);
    setIsOpen(false);
  }

  const isVacant = value == null;

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`${dictInputClass} w-full min-w-0 text-left disabled:opacity-60`}
      >
        <span className="block truncate" title={selectedLabel}>
          {selectedLabel}
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <button
            type="button"
            role="option"
            aria-selected={isVacant}
            onClick={selectVacant}
            className={`block w-full min-w-0 px-3 py-2 text-left text-sm leading-snug break-words ${
              isVacant
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            }`}
          >
            {vacantLabel}
          </button>

          <div className="border-b border-gray-100 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Поиск по ФИО"
              aria-label="Поиск по ФИО"
              className={dictInputClass}
            />
          </div>

          <div className="max-h-52 overflow-y-auto py-1">
            {filteredEmployees.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                Ничего не найдено
              </p>
            ) : (
              filteredEmployees.map((employee) => {
                const selected = employee.id === value;
                return (
                  <button
                    key={employee.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectEmployee(employee)}
                    className={`block w-full min-w-0 px-3 py-2 text-left text-sm leading-snug break-words ${
                      selected
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    {employeeLabel(employee)}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
