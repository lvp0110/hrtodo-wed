import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { formatApiError } from "#/lib/apiError";
import { employeeReportQuery, employeesApi, orgNodesApi } from "#/services/api";
import type {
  EmployeeHistoryEndType,
  EmployeePositionHistory,
  Employer,
  OrgNode,
} from "#/types/api";

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-800/60 dark:disabled:text-gray-400";

const END_TYPE_LABEL: Record<EmployeeHistoryEndType, string> = {
  transferred: "Перевод",
  unassigned: "Снятие",
  archived: "Архив",
  correction: "Корректировка",
};

function formatDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU");
}

function employeeName(employee: Employer): string {
  return [employee.surname, employee.first_name, employee.second_name]
    .filter(Boolean)
    .join(" ");
}

type OpenVacancy = { id: number; label: string };

function listOpenVacancies(nodes: OrgNode[]): OpenVacancy[] {
  const options: OpenVacancy[] = [];

  function walk(nodeList: OrgNode[]) {
    for (const node of nodeList) {
      for (const vacancy of node.vacancies ?? []) {
        if (!vacancy.id || vacancy.id <= 0 || vacancy.employer?.id) continue;
        const position =
          vacancy.position?.name || vacancy.position?.code || "Должность";
        const office = vacancy.office?.name;
        options.push({
          id: vacancy.id,
          label: [position, node.name, office]
            .map((part) => part?.replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .join(" · "),
        });
      }
      walk(node.children ?? []);
    }
  }

  walk(nodes);
  options.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  return options;
}

function PositionSlotSelect({
  vacancies,
  value,
  onChange,
  disabled,
  loading,
}: {
  vacancies: OpenVacancy[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = vacancies.find((vacancy) => String(vacancy.id) === value) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return vacancies;
    return vacancies.filter((vacancy) =>
      vacancy.label.toLowerCase().includes(needle),
    );
  }, [vacancies, query]);

  useEffect(() => {
    if (!open) return;

    function place() {
      setAnchor(buttonRef.current?.getBoundingClientRect() ?? null);
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    place();
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  const menu =
    open && anchor
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Должности"
            style={{
              position: "fixed",
              zIndex: 60,
              left: anchor.left,
              width: anchor.width,
              ...(window.innerHeight - anchor.bottom < 280 &&
              anchor.top > window.innerHeight - anchor.bottom
                ? { bottom: window.innerHeight - anchor.top + 4 }
                : { top: anchor.bottom + 4 }),
            }}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(false);
                }}
                placeholder="Поиск по должности, отделу или офису"
                aria-label="Поиск должности"
                data-hint="Оставляет в списке должности, в названии, отделе или офисе которых есть введённый текст"
                className={inputClass}
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {loading ? (
                <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                  Загрузка…
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                  {vacancies.length === 0
                    ? "Свободных должностей нет"
                    : "Ничего не найдено"}
                </p>
              ) : (
                filtered.map((vacancy) => {
                  const isSelected = String(vacancy.id) === value;
                  return (
                    <button
                      key={vacancy.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-hint="Подставляет эту должность для назначения или перевода"
                      onClick={() => {
                        onChange(String(vacancy.id));
                        setOpen(false);
                      }}
                      className={`block w-full min-w-0 px-3 py-2 text-left text-sm leading-snug break-words ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                      }`}
                    >
                      {vacancy.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  const label = loading
    ? "Загрузка…"
    : (selected?.label ?? "Выберите должность");

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-hint="Свободная должность для назначения или перевода"
        className={`${inputClass} flex items-center justify-between gap-2 text-left`}
      >
        <span
          className={`block min-w-0 truncate ${
            selected ? "" : "text-gray-400 dark:text-gray-500"
          }`}
          title={selected?.label}
        >
          {label}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
    </div>
  );
}

function invalidateEmployeeCard(
  queryClient: ReturnType<typeof useQueryClient>,
  employeeId: number,
) {
  queryClient.invalidateQueries({ queryKey: ["employees", "history", employeeId] });
  queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
  queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
  queryClient.invalidateQueries({ queryKey: ["orgTree"] });
}

export function EmployeeCardPanel({ employee }: { employee: Employer }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [slotId, setSlotId] = useState("");
  const reportQuery = useQuery(employeeReportQuery());
  const currentEmployee =
    reportQuery.data?.find((item) => item.employee.id === employee.id)
      ?.employee ?? employee;
  const archived = currentEmployee.status === "archived";

  const historyQuery = useQuery({
    queryKey: ["employees", "history", employee.id] as const,
    queryFn: () =>
      employeesApi.history(employee.id).then((res) => res.data ?? []),
  });
  const orgTree = useQuery({
    queryKey: ["orgTree"] as const,
    queryFn: () => orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
    enabled: !archived,
  });

  const history = historyQuery.data ?? [];
  const current = history.find((item) => !item.ended_at) ?? null;
  const journal = useMemo(
    () =>
      [...history].sort((a, b) => {
        const byStart = b.started_at.localeCompare(a.started_at);
        return byStart !== 0 ? byStart : b.id - a.id;
      }),
    [history],
  );
  const openVacancies = useMemo(
    () => listOpenVacancies(orgTree.data ?? []),
    [orgTree.data],
  );

  const assignMutation = useMutation({
    mutationFn: () =>
      employeesApi.assign(employee.id, {
        position_slot_id: Number(slotId),
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      setReason("");
      setSlotId("");
      invalidateEmployeeCard(queryClient, employee.id);
    },
  });
  const closeMutation = useMutation({
    mutationFn: () => employeesApi.closeAssignment(employee.id, reason),
    onSuccess: () => {
      setReason("");
      invalidateEmployeeCard(queryClient, employee.id);
    },
  });
  const archiveMutation = useMutation({
    mutationFn: () => employeesApi.archive(employee.id, reason),
    onSuccess: () => {
      setReason("");
      invalidateEmployeeCard(queryClient, employee.id);
    },
  });

  const busy =
    assignMutation.isPending ||
    closeMutation.isPending ||
    archiveMutation.isPending;
  const actionError =
    formatApiError(assignMutation.error) ??
    formatApiError(closeMutation.error) ??
    formatApiError(archiveMutation.error);

  function assignOrTransfer() {
    if (!slotId) return;
    assignMutation.mutate();
  }

  function archiveEmployee() {
    const name = employeeName(currentEmployee) || "этого сотрудника";
    const confirmed = window.confirm(
      `Архивировать ${name}? Текущая должность будет освобождена.`,
    );
    if (!confirmed) return;
    archiveMutation.mutate();
  }

  return (
    <section
      aria-label="Карточка сотрудника"
      className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-gray-100 dark:border-gray-800"
    >
      <div className="flex min-h-16 shrink-0 items-center border-b border-gray-100 px-6 py-4 dark:border-gray-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Карточка сотрудника
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Текущая должность
          </h3>
          {historyQuery.isPending ? (
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Загрузка…</p>
          ) : historyQuery.isError ? (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">
              Не удалось загрузить карточку
            </p>
          ) : current ? (
            <PositionSummary item={current} open />
          ) : (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Не назначен
            </p>
          )}
        </div>

        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Дата устройства</dt>
            <dd className="text-gray-900 dark:text-gray-100">
              {currentEmployee.hire_date
                ? formatDate(currentEmployee.hire_date)
                : "Появится при первом назначении"}
            </dd>
          </div>
          {archived && (
            <>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Архивирован</dt>
                <dd className="text-gray-900 dark:text-gray-100">
                  {formatDate(currentEmployee.archived_at)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Архивировал</dt>
                <dd className="break-all text-gray-900 dark:text-gray-100">
                  {currentEmployee.archived_by?.trim() || "—"}
                </dd>
              </div>
            </>
          )}
        </dl>

        {!archived && historyQuery.isSuccess && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Должность
              </label>
              <PositionSlotSelect
                vacancies={openVacancies}
                value={slotId}
                onChange={setSlotId}
                disabled={busy}
                loading={orgTree.isPending}
              />
              {!orgTree.isPending && openVacancies.length === 0 && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Свободных должностей нет
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Комментарий
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
                rows={2}
                placeholder="Необязательно"
                data-hint="Комментарий к назначению, переводу, снятию или архивированию"
                className={`${inputClass} resize-y`}
              />
            </div>

            {actionError && (
              <p className="text-sm text-red-500 dark:text-red-400">{actionError}</p>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={assignOrTransfer}
                disabled={busy || !slotId}
                data-hint={
                  current
                    ? "Переводит сотрудника и освобождает прежнюю должность"
                    : "Назначает сотрудника на выбранную должность"
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {assignMutation.isPending
                  ? "Сохраняем…"
                  : current
                    ? "Перевести"
                    : "Назначить"}
              </button>
              {current && (
                <button
                  type="button"
                  onClick={() => closeMutation.mutate()}
                  disabled={busy}
                  data-hint="Снимает сотрудника с должности без перевода"
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {closeMutation.isPending ? "Снимаем…" : "Снять с должности"}
                </button>
              )}
              <button
                type="button"
                onClick={archiveEmployee}
                disabled={busy}
                data-hint="Архивирует сотрудника и освобождает текущую должность"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {archiveMutation.isPending ? "Архивируем…" : "В архив"}
              </button>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Журнал перемещений
          </h3>
          {historyQuery.isPending ? null : historyQuery.isError ? null : journal.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Перемещений пока нет
            </p>
          ) : (
            <ol className="mt-2 space-y-3">
              {journal.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
                >
                  <PositionSummary item={item} open={!item.ended_at} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

function PositionSummary({
  item,
  open,
}: {
  item: EmployeePositionHistory;
  open: boolean;
}) {
  const title = item.position_name || item.position_code || "Должность";
  const place = [item.node_name, item.office_name].filter(Boolean).join(" · ");
  const period = open
    ? `с ${formatDate(item.started_at)}`
    : `${formatDate(item.started_at)} — ${formatDate(item.ended_at)}`;
  const endLabel = item.end_type ? END_TYPE_LABEL[item.end_type] : null;

  return (
    <div className="text-sm">
      <div className="font-medium text-gray-900 dark:text-gray-100">
        {title}
        {item.is_manager ? " · руководитель" : ""}
        {open ? (
          <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">
            Сейчас
          </span>
        ) : null}
      </div>
      {place && (
        <div className="text-gray-500 dark:text-gray-400">{place}</div>
      )}
      <div className="text-gray-500 dark:text-gray-400">{period}</div>
      {(endLabel || item.end_reason) && (
        <div className="text-gray-500 dark:text-gray-400">
          {[endLabel, item.end_reason].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}
