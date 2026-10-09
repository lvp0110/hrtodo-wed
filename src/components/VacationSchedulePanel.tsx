import { useEffect, useMemo, useState, type SelectHTMLAttributes } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Palmtree, Search, Trash2 } from "lucide-react";
import { ApiErrorModal } from "#/components/ApiErrorModal";
import { EmployeesRowCard } from "#/components/EmployeesRowCard";
import {
  HrVacationPeriodModal,
  type HrVacationDialog,
} from "#/components/HrVacationPeriodModal";
import { dictInputClass } from "#/components/settings/DictFormModal";
import { DictTable } from "#/components/settings/DictTable";
import { formatApiError } from "#/lib/apiError";
import {
  vacationsApi,
  type VacationFilterParams,
  type VacationListParams,
} from "#/services/api";
import type {
  VacationFilterValue,
  VacationListItem,
  VacationNamedRef,
  VacationSchedule,
} from "#/types/api";

const PAGE_SIZE = 50;

const PERIOD_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  planned: "Запланирован",
  awaiting_confirmation: "Ожидает подтверждения",
  confirmed: "Подтверждён",
  reschedule_requested: "Запрошен перенос",
  rescheduled: "Перенесён",
  in_progress: "Идёт",
  completed: "Завершён",
  cancelled: "Отменён",
};

const CONFIRMATION_LABELS: Record<string, string> = {
  pending: "Ожидает",
  confirmed: "Подтверждено",
};

const CONFIRMABLE_PERIODS = new Set([
  "planned",
  "awaiting_confirmation",
  "rescheduled",
]);

const RESCHEDULABLE_PERIODS = new Set([
  "planned",
  "awaiting_confirmation",
  "confirmed",
  "rescheduled",
]);

function scheduleFor(
  schedules: VacationSchedule[],
  legalEntityId: number,
): VacationSchedule | undefined {
  return (
    schedules.find(
      (item) => item.legal_entity_id === legalEntityId && item.status === "draft",
    ) ?? schedules.find((item) => item.legal_entity_id === legalEntityId)
  );
}

function confirmationRole(row: VacationListItem): "employee" | "manager" {
  return row.category_code === "manager_on_behalf" ? "manager" : "employee";
}

function canConfirmPeriod(row: VacationListItem): boolean {
  return (
    row.confirmation_status !== "confirmed" &&
    CONFIRMABLE_PERIODS.has(row.period_status)
  );
}

const RESCHEDULE_LABELS: Record<string, string> = {
  pending: "На рассмотрении",
  approved: "Одобрен",
  rejected: "Отклонён",
  cancelled: "Отменён",
};

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Утверждён",
  closed: "Закрыт",
};

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const fieldLabelClass =
  "mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400";

function FilterSelect({
  className = "",
  wrapperClassName = "w-full",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
}) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        {...props}
        className={`${dictInputClass} appearance-none pr-9 [-webkit-appearance:none] ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  );
}

function labelOf(labels: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return labels[value] ?? value;
}

function filterValue(option: VacationFilterValue): string {
  if (typeof option === "string") return option;
  return option.code || option.name || String(option.id);
}

function filterLabel(option: VacationFilterValue, labels?: Record<string, string>): string {
  if (typeof option === "string") return labels?.[option] ?? option;
  if (option.name) return option.name;
  const code = option.code ?? "";
  return (code && labels?.[code]) || code || String(option.id);
}

function filterKey(option: VacationFilterValue, index: number): string {
  if (typeof option === "string") return `${option}-${index}`;
  return String(option.id ?? option.code ?? index);
}

/** Календарная дата из RFC 3339 без сдвига часового пояса. */
function calendarDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function periodText(row: VacationListItem): string {
  const start = calendarDate(row.planned_start_date);
  const end = calendarDate(row.planned_end_date);
  if (!start && !end) return "—";
  if (start && end) return `${start} — ${end}`;
  return start ?? end ?? "—";
}

function positionText(row: VacationListItem): string {
  return row.position_name || "—";
}

function balanceText(row: VacationListItem): string {
  if (row.remaining_days == null && row.available_days == null) return "—";
  if (row.remaining_days != null && row.available_days != null) {
    return `${row.remaining_days} из ${row.available_days}`;
  }
  return String(row.remaining_days ?? row.available_days);
}

function vacationRowKey(row: VacationListItem): string {
  return [
    row.period_id ?? "no-period",
    row.assignment_id ?? "no-assignment",
    row.employee_id ?? "no-employee",
    row.planned_start_date ?? "",
    row.planned_end_date ?? "",
  ].join(":");
}

function optionalId(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function VacationScheduleToggle({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="График отпусков"
      aria-label="График отпусков"
      aria-pressed={active}
      data-hint={
        active
          ? "Возвращает таблицу сотрудников"
          : "Переключает таблицу на график отпусков"
      }
      className={`inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border transition ${
        active
          ? "border-blue-300 bg-blue-50 text-amber-600 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-amber-400"
          : "border-gray-200 bg-white text-amber-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-amber-400 dark:hover:bg-gray-700"
      }`}
    >
      <Palmtree size={20} />
    </button>
  );
}

function ScheduleChip({
  schedule,
  active,
  onClick,
}: {
  schedule: VacationSchedule;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-hint="Оставляет в таблице отпуска этого юридического лица"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300"
          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      }`}
    >
      <span>{schedule.legal_entity_name}</span>
      <span className="text-gray-400">{schedule.year}</span>
      <span>{labelOf(SCHEDULE_STATUS_LABELS, schedule.status)}</span>
    </button>
  );
}

export function VacationSchedulePanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [year, setYear] = useState(currentYear);
  const [legalEntityId, setLegalEntityId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [managerAssignmentId, setManagerAssignmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [month, setMonth] = useState("");
  const [periodStatus, setPeriodStatus] = useState("");
  const [confirmationStatus, setConfirmationStatus] = useState("");
  const [rescheduleStatus, setRescheduleStatus] = useState("");
  const [periodDialog, setPeriodDialog] = useState<HrVacationDialog | null>(null);
  const filterKey = [
    debouncedSearch,
    year,
    legalEntityId,
    positionId,
    managerAssignmentId,
    categoryId,
    month,
    periodStatus,
    confirmationStatus,
    rescheduleStatus,
  ].join("|");
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (next: number | ((current: number) => number)) => {
    setPageState((prev) => {
      const current = prev.key === filterKey ? prev.page : 1;
      return {
        key: filterKey,
        page: typeof next === "function" ? next(current) : next,
      };
    });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filtersQuery = useQuery({
    queryKey: ["hr", "vacations", "filters", year] as const,
    queryFn: () => vacationsApi.filters(year).then((res) => res.data),
  });

  const filterParams: VacationFilterParams = {
    year,
    legal_entity_id: optionalId(legalEntityId),
    manager_assignment_id: optionalId(managerAssignmentId),
    position_id: optionalId(positionId),
    category_id: optionalId(categoryId),
    month: optionalId(month),
    period_status: periodStatus || undefined,
    confirmation_status: confirmationStatus || undefined,
    reschedule_status: rescheduleStatus || undefined,
    search: debouncedSearch || undefined,
  };

  const listParams: VacationListParams = {
    ...filterParams,
    page,
    page_size: PAGE_SIZE,
    sort: "employee",
    order: "asc",
  };

  const listQuery = useQuery({
    queryKey: ["hr", "vacations", "list", listParams] as const,
    queryFn: () => vacationsApi.list(listParams).then((res) => res.data),
  });

  const summaryQuery = useQuery({
    queryKey: ["hr", "vacations", "summary", filterParams] as const,
    queryFn: () => vacationsApi.summary(filterParams).then((res) => res.data),
  });

  const schedulesQuery = useQuery({
    queryKey: ["hr", "vacation-schedules", year] as const,
    queryFn: () =>
      vacationsApi.schedules({ year }).then((res) => res.data ?? []),
  });

  const confirmMutation = useMutation({
    mutationFn: (row: VacationListItem) =>
      vacationsApi.confirmPeriod(row.period_id, { role: confirmationRole(row) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "vacations"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vacationsApi.deletePeriod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr", "vacations"] });
      queryClient.invalidateQueries({ queryKey: ["hr", "vacation-entitlements"] });
    },
  });

  const years = useMemo(() => {
    const values = new Set<number>(filtersQuery.data?.years ?? []);
    values.add(year);
    return [...values].sort((a, b) => b - a);
  }, [filtersQuery.data?.years, year]);

  const rows = listQuery.data?.items ?? [];
  const totalItems = listQuery.data?.total_items ?? rows.length;
  const totalPages = listQuery.data?.total_pages ?? (rows.length ? 1 : 0);
  const pageSize = listQuery.data?.page_size ?? PAGE_SIZE;
  const rangeFrom = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, totalItems);

  const hasFilters = Boolean(
    search.trim() ||
      legalEntityId ||
      positionId ||
      managerAssignmentId ||
      categoryId ||
      month ||
      periodStatus ||
      confirmationStatus ||
      rescheduleStatus ||
      year !== currentYear,
  );

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setYear(currentYear);
    setLegalEntityId("");
    setPositionId("");
    setManagerAssignmentId("");
    setCategoryId("");
    setMonth("");
    setPeriodStatus("");
    setConfirmationStatus("");
    setRescheduleStatus("");
  };

  const summary = summaryQuery.data;
  const summaryItems = summary
    ? [
        ["Сотрудники", summary.employees_total],
        ["С планом", summary.employees_planned],
        ["Без плана", summary.employees_not_planned],
        ["На проверке", summary.days_need_review],
        ["14 дней", summary.upcoming_14_days],
        ["30 дней", summary.upcoming_30_days],
        ["Ждут подтверждения", summary.awaiting_confirmation],
        ["Подтверждено", summary.confirmed],
        ["Переносы", summary.pending_reschedules],
        ["Ошибки отправки", summary.delivery_errors],
        ["Вне графика", summary.employees_outside_schedule],
      ]
    : [];

  const schedules = schedulesQuery.data ?? [];

  function openDelete(row: VacationListItem) {
    const start = calendarDate(row.planned_start_date) ?? "—";
    const end = calendarDate(row.planned_end_date) ?? "—";
    if (
      confirm(
        `Удалить отпуск ${start} — ${end} у ${row.employee_full_name || "сотрудника"}?`,
      )
    ) {
      deleteMutation.mutate(row.period_id);
    }
  }

  function periodActions(row: VacationListItem) {
    const schedule = scheduleFor(schedules, row.legal_entity_id);
    const draft = schedule?.status === "draft";
    const canReschedule =
      schedule != null &&
      schedule.status !== "draft" &&
      schedule.status !== "closed" &&
      RESCHEDULABLE_PERIODS.has(row.period_status);
    if (!draft && !canReschedule) return null;
    const deleting =
      deleteMutation.isPending && deleteMutation.variables === row.period_id;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {draft && (
          <button
            type="button"
            onClick={() => setPeriodDialog({ mode: "edit", period: row })}
            data-hint="Меняет даты этого отпуска, пока график в черновике"
            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Изменить
          </button>
        )}
        {draft && (
          <button
            type="button"
            onClick={() => openDelete(row)}
            disabled={deleting}
            aria-label="Удалить отпуск"
            data-hint="Удаляет этот отпуск из черновика графика"
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
        )}
        {canReschedule && (
          <button
            type="button"
            onClick={() => setPeriodDialog({ mode: "reschedule", period: row })}
            data-hint="Открывает запрос на перенос дат. График уже не в черновике"
            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Запросить перенос
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-6 flex shrink-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <label className="max-md:w-full min-w-[160px] flex-1">
          <span className={fieldLabelClass}>ФИО</span>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по ФИО"
              data-hint="Ищет сотрудников графика отпусков по ФИО"
              className={`${dictInputClass} pl-9`}
            />
          </div>
        </label>

        <label className="max-md:min-w-0 max-md:flex-1 min-w-[110px]">
          <span className={fieldLabelClass}>Год</span>
          <FilterSelect
            value={String(year)}
            onChange={(event) => setYear(Number(event.target.value))}
            data-hint="Показывает график отпусков выбранного года"
          >
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FilterSelect>
        </label>

        <NamedSelect
          label="Юрлицо"
          hint="Оставляет отпуска выбранного юридического лица"
          value={legalEntityId}
          onChange={setLegalEntityId}
          options={filtersQuery.data?.legal_entities}
          emptyLabel="Все юрлица"
        />
        <NamedSelect
          label="Должность"
          hint="Оставляет отпуска выбранной должности"
          value={positionId}
          onChange={setPositionId}
          options={filtersQuery.data?.positions}
          emptyLabel="Все должности"
        />
        <NamedSelect
          label="Руководитель"
          hint="Оставляет отпуска сотрудников выбранного руководителя"
          value={managerAssignmentId}
          onChange={setManagerAssignmentId}
          options={filtersQuery.data?.managers}
          emptyLabel="Все руководители"
        />
        <NamedSelect
          label="Категория"
          hint="Оставляет отпуска выбранной категории сотрудников"
          value={categoryId}
          onChange={setCategoryId}
          options={filtersQuery.data?.categories}
          emptyLabel="Все категории"
        />

        <label className="max-md:min-w-0 max-md:flex-1 min-w-[140px]">
          <span className={fieldLabelClass}>Месяц начала</span>
          <FilterSelect
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            data-hint="Оставляет отпуска, которые начинаются в выбранном месяце"
          >
            <option value="">Все месяцы</option>
            {MONTHS.map((name, index) => (
              <option key={name} value={String(index + 1)}>
                {name}
              </option>
            ))}
          </FilterSelect>
        </label>

        <ValueSelect
          label="Статус"
          hint="Оставляет периоды выбранного статуса"
          value={periodStatus}
          onChange={setPeriodStatus}
          options={filtersQuery.data?.period_statuses}
          labels={PERIOD_STATUS_LABELS}
          emptyLabel="Все статусы"
        />
        <ValueSelect
          label="Подтверждение"
          hint="Оставляет периоды по статусу подтверждения"
          value={confirmationStatus}
          onChange={setConfirmationStatus}
          options={["pending", "confirmed"]}
          labels={CONFIRMATION_LABELS}
          emptyLabel="Все"
        />
        <ValueSelect
          label="Перенос"
          hint="Оставляет периоды с выбранным статусом переноса"
          value={rescheduleStatus}
          onChange={setRescheduleStatus}
          options={filtersQuery.data?.request_statuses}
          labels={RESCHEDULE_LABELS}
          emptyLabel="Все"
        />

        <button
          type="button"
          onClick={() => setPeriodDialog({ mode: "create" })}
          data-hint="Создаёт отпуск за любого сотрудника, пока график юридического лица в черновике"
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Добавить отпуск
        </button>
        <button
          type="button"
          onClick={resetFilters}
          disabled={!hasFilters}
          data-hint="Очищает фильтры графика отпусков"
          className="min-w-[150px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          Сбросить фильтры
        </button>

        <VacationScheduleToggle active onClick={onClose} />
      </div>

      {schedules.length > 0 && (
        <div className="mb-4 flex shrink-0 flex-wrap gap-2">
          {schedules.map((schedule) => (
            <ScheduleChip
              key={schedule.id}
              schedule={schedule}
              active={legalEntityId === String(schedule.legal_entity_id)}
              onClick={() =>
                setLegalEntityId((prev) =>
                  prev === String(schedule.legal_entity_id)
                    ? ""
                    : String(schedule.legal_entity_id),
                )
              }
            />
          ))}
        </div>
      )}

      {summaryItems.length > 0 && (
        <div className="mb-4 flex shrink-0 flex-wrap gap-2">
          {summaryItems.map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {value ?? "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        <DictTable<VacationListItem>
          rowHoverVariant="border"
          wrapperClassName="h-full"
          rows={rows}
          rowKey={vacationRowKey}
          isLoading={listQuery.isPending}
          isError={listQuery.isError}
          errorMessage={formatApiError(listQuery.error)}
          emptyMessage={hasFilters ? "Ничего не найдено" : "Периодов отпуска пока нет"}
          renderMobileCard={(row) => (
            <EmployeesRowCard
              headerContent={row.employee_full_name || "—"}
              actions={periodActions(row)}
              fields={[
                { key: "entity", label: "Юрлицо", content: row.legal_entity_name || "—" },
                { key: "position", label: "Должность", content: positionText(row) },
                { key: "manager", label: "Руководитель", content: row.manager_full_name || "—" },
                { key: "period", label: "Период", content: periodText(row) },
                {
                  key: "days",
                  label: "Дней",
                  content: row.planned_days == null ? "—" : String(row.planned_days),
                },
                {
                  key: "status",
                  label: "Статус",
                  content: (
                    <StatusDetails
                      row={row}
                      confirming={
                        confirmMutation.isPending &&
                        confirmMutation.variables?.period_id === row.period_id
                      }
                      onConfirm={() => confirmMutation.mutate(row)}
                    />
                  ),
                },
                { key: "balance", label: "Остаток", content: balanceText(row) },
              ]}
            />
          )}
          columns={[
            {
              key: "name",
              header: "ФИО",
              headerClassName: "whitespace-normal",
              className: "whitespace-normal align-top",
              render: (row) => row.employee_full_name || "—",
            },
            {
              key: "entity",
              header: "Юрлицо",
              className: "whitespace-normal align-top",
              render: (row) => row.legal_entity_name || "—",
            },
            {
              key: "position",
              header: "Должность",
              className: "whitespace-normal align-top",
              render: (row) => (
                <span>
                  {positionText(row)}
                  {row.employment_type === "part_time" && (
                    <span className="mt-0.5 block text-xs text-gray-400">
                      Совместительство
                    </span>
                  )}
                </span>
              ),
            },
            {
              key: "manager",
              header: "Руководитель",
              className: "whitespace-normal align-top",
              render: (row) => row.manager_full_name || "—",
            },
            {
              key: "period",
              header: "Период",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap",
              render: (row) => periodText(row),
            },
            {
              key: "days",
              header: "Дней",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap",
              render: (row) => (row.planned_days == null ? "—" : String(row.planned_days)),
            },
            {
              key: "status",
              header: "Статус",
              className: "whitespace-normal align-top",
              render: (row) => (
                <StatusDetails
                  row={row}
                  confirming={
                    confirmMutation.isPending &&
                    confirmMutation.variables?.period_id === row.period_id
                  }
                  onConfirm={() => confirmMutation.mutate(row)}
                />
              ),
            },
            {
              key: "balance",
              header: "Остаток",
              headerClassName: "whitespace-nowrap",
              className: "whitespace-nowrap",
              render: (row) => balanceText(row),
            },
            {
              key: "actions",
              header: "Действия",
              className: "whitespace-normal align-top",
              render: (row) => periodActions(row),
            },
          ]}
        />
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span>
          {totalItems === 0 ? "0 записей" : `${rangeFrom}–${rangeTo} из ${totalItems}`}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || listQuery.isPending}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={totalPages === 0 || page >= totalPages || listQuery.isPending}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            Дальше
          </button>
        </div>
      </div>
      {confirmMutation.isError && (
        <ApiErrorModal
          error={confirmMutation.error}
          onClose={() => confirmMutation.reset()}
        />
      )}
      {deleteMutation.isError && (
        <ApiErrorModal
          error={deleteMutation.error}
          onClose={() => deleteMutation.reset()}
        />
      )}
      {periodDialog && (
        <HrVacationPeriodModal
          key={
            periodDialog.mode === "create"
              ? "create"
              : `${periodDialog.mode}-${periodDialog.period.period_id}`
          }
          dialog={periodDialog}
          year={year}
          schedules={schedules}
          preferredLegalEntityId={optionalId(legalEntityId)}
          onClose={() => setPeriodDialog(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["hr", "vacations"] });
            queryClient.invalidateQueries({ queryKey: ["hr", "vacation-entitlements"] });
          }}
        />
      )}
    </div>
  );
}

function StatusDetails({
  row,
  confirming,
  onConfirm,
}: {
  row: VacationListItem;
  confirming: boolean;
  onConfirm: () => void;
}) {
  return (
    <div>
      <div>{labelOf(PERIOD_STATUS_LABELS, row.period_status)}</div>
      {row.confirmation_status && (
        <div className="mt-0.5 text-xs text-gray-400">
          Подтверждение: {labelOf(CONFIRMATION_LABELS, row.confirmation_status)}
        </div>
      )}
      {canConfirmPeriod(row) && (
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          data-hint="Подтверждает этот отпуск и переводит его статус в «Подтверждён»"
          className="mt-1.5 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {confirming ? "Подтверждаем…" : "Подтвердить"}
        </button>
      )}
      {row.reschedule_status && (
        <div className="mt-0.5 text-xs text-gray-400">
          Перенос: {labelOf(RESCHEDULE_LABELS, row.reschedule_status)}
        </div>
      )}
    </div>
  );
}

function NamedSelect({
  label,
  hint,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  options?: VacationNamedRef[] | null;
  emptyLabel: string;
}) {
  return (
    <label className="max-md:min-w-0 max-md:flex-1 min-w-[160px]">
      <span className={fieldLabelClass}>{label}</span>
      <FilterSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-hint={hint}
      >
        <option value="">{emptyLabel}</option>
        {(options ?? []).map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </FilterSelect>
    </label>
  );
}

function ValueSelect({
  label,
  hint,
  value,
  onChange,
  options,
  labels,
  emptyLabel,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  options?: VacationFilterValue[] | null;
  labels: Record<string, string>;
  emptyLabel: string;
}) {
  return (
    <label className="max-md:min-w-0 max-md:flex-1 min-w-[160px]">
      <span className={fieldLabelClass}>{label}</span>
      <FilterSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-hint={hint}
      >
        <option value="">{emptyLabel}</option>
        {(options ?? []).map((option, index) => (
          <option key={filterKey(option, index)} value={filterValue(option)}>
            {filterLabel(option, labels)}
          </option>
        ))}
      </FilterSelect>
    </label>
  );
}
