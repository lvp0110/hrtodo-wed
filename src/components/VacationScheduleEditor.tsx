import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { ApiErrorModal } from "#/components/ApiErrorModal";
import { DateInput } from "#/components/DateInput";
import {
  DictFormModal,
  Field,
  dictInputClass,
} from "#/components/settings/DictFormModal";
import { formatApiError } from "#/lib/apiError";
import { hrAccountingApi, vacationsApi, type VacationListParams } from "#/services/api";
import type {
  AccountingAssignment,
  VacationEntitlement,
  VacationListItem,
  VacationPeriodReq,
  VacationSchedule,
} from "#/types/api";

const inputClass = `${dictInputClass} border-gray-200 dark:border-gray-700`;

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  submitted: "На согласовании",
  approved: "Утверждён",
  closed: "Закрыт",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  primary: "Основное",
  part_time: "Совместительство",
};

function calendarDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? "";
}

function displayDate(value: string | null | undefined): string {
  const iso = calendarDate(value);
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function inclusiveDays(start: string, end: string): number | null {
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end);
  if (!startMatch || !endMatch) return null;
  const startUtc = Date.UTC(
    Number(startMatch[1]),
    Number(startMatch[2]) - 1,
    Number(startMatch[3]),
  );
  const endUtc = Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]));
  const days = Math.round((endUtc - startUtc) / 86_400_000) + 1;
  return days >= 1 ? days : null;
}

async function loadPeriods(legalEntityId: number, year: number): Promise<VacationListItem[]> {
  const pageSize = 200;
  const items: VacationListItem[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params: VacationListParams = {
      legal_entity_id: legalEntityId,
      year,
      page,
      page_size: pageSize,
      sort: "start_date",
      order: "asc",
    };
    const res = await vacationsApi.list(params);
    items.push(...(res.data?.items ?? []));
    totalPages = res.data?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return items.filter((item) => item.period_status !== "cancelled");
}

export function VacationScheduleEditor() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [entityId, setEntityId] = useState("");
  const [year, setYear] = useState(currentYear);
  const [periodForm, setPeriodForm] = useState<
    | { mode: "create"; assignment: AccountingAssignment; entitlement: VacationEntitlement }
    | {
        mode: "edit";
        assignment: AccountingAssignment;
        entitlement: VacationEntitlement;
        period: VacationListItem;
      }
    | null
  >(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const selectedId = entityId ? Number(entityId) : null;
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const entitiesQuery = useQuery({
    queryKey: ["hr", "legal-entities", false] as const,
    queryFn: () => hrAccountingApi.legalEntities(false).then((res) => res.data ?? []),
  });

  const schedulesQuery = useQuery({
    queryKey: ["hr", "vacation-schedules", selectedId ?? "none", year] as const,
    queryFn: () =>
      vacationsApi
        .schedules({ legal_entity_id: selectedId as number, year })
        .then((res) => res.data ?? []),
    enabled: selectedId !== null,
  });
  const schedule = schedulesQuery.data?.[0] ?? null;
  const isDraft = schedule?.status === "draft";

  const assignmentsQuery = useQuery({
    queryKey: ["hr", "accounting-assignments", "by-entity", selectedId ?? "none"] as const,
    queryFn: () =>
      hrAccountingApi
        .assignments({ legal_entity_id: selectedId as number, active_only: true })
        .then((res) => res.data ?? []),
    enabled: selectedId !== null,
  });

  const entitlementsQuery = useQuery({
    queryKey: ["hr", "vacation-entitlements", selectedId ?? "none", year] as const,
    queryFn: () =>
      vacationsApi
        .entitlements({ legal_entity_id: selectedId as number, year })
        .then((res) => res.data ?? []),
    enabled: selectedId !== null && schedule !== null,
  });

  const periodsQuery = useQuery({
    queryKey: ["hr", "vacations", "schedule-periods", selectedId ?? "none", year] as const,
    queryFn: () => loadPeriods(selectedId as number, year),
    enabled: selectedId !== null && schedule !== null,
  });

  const invalidatePlan = () => {
    queryClient.invalidateQueries({ queryKey: ["hr", "vacation-schedules"] });
    queryClient.invalidateQueries({ queryKey: ["hr", "vacation-entitlements"] });
    queryClient.invalidateQueries({ queryKey: ["hr", "vacations"] });
  };

  const createScheduleMutation = useMutation({
    mutationFn: () =>
      vacationsApi.createSchedule({
        legal_entity_id: selectedId as number,
        year,
      }),
    onSuccess: invalidatePlan,
  });

  const recalculateMutation = useMutation({
    mutationFn: (id: number) => vacationsApi.recalculateSchedule(id),
    onSuccess: invalidatePlan,
  });

  const createPeriodMutation = useMutation({
    mutationFn: (body: VacationPeriodReq) => vacationsApi.createPeriod(body),
    onSuccess: () => {
      invalidatePlan();
      setPeriodForm(null);
    },
  });

  const updatePeriodMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: VacationPeriodReq }) =>
      vacationsApi.updatePeriod(id, body),
    onSuccess: () => {
      invalidatePlan();
      setPeriodForm(null);
    },
  });

  const deletePeriodMutation = useMutation({
    mutationFn: (id: number) => vacationsApi.deletePeriod(id),
    onSuccess: invalidatePlan,
  });

  const submitMutation = useMutation({
    mutationFn: (comment: string) =>
      vacationsApi.transitionSchedule(schedule?.id as number, {
        action: "submit",
        comment,
      }),
    onSuccess: () => {
      invalidatePlan();
      setSubmitOpen(false);
    },
  });

  const assignments = [...(assignmentsQuery.data ?? [])].sort((a, b) =>
    (a.employee_full_name ?? "").localeCompare(b.employee_full_name ?? "", "ru"),
  );
  const entitlementByAssignment = new Map(
    (entitlementsQuery.data ?? []).map((item) => [item.assignment_id, item]),
  );
  const periodsByAssignment = new Map<number, VacationListItem[]>();
  for (const period of periodsQuery.data ?? []) {
    const list = periodsByAssignment.get(period.assignment_id) ?? [];
    list.push(period);
    periodsByAssignment.set(period.assignment_id, list);
  }
  const missingEntitlements = assignments.some(
    (assignment) => !entitlementByAssignment.has(assignment.id),
  );
  const pendingPeriod = periodForm?.mode === "edit" ? updatePeriodMutation : createPeriodMutation;
  const actionError = recalculateMutation.error ?? deletePeriodMutation.error ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Юридическое лицо
          </span>
          <select
            value={entityId}
            onChange={(event) => {
              setEntityId(event.target.value);
              createScheduleMutation.reset();
            }}
            data-hint="Показывает годовой график отпусков выбранного юридического лица"
            className={inputClass}
          >
            <option value="">Выберите юрлицо</option>
            {(entitiesQuery.data ?? []).map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.short_name}
              </option>
            ))}
          </select>
        </label>
        <label className="w-36">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Год
          </span>
          <select
            value={year}
            onChange={(event) => {
              setYear(Number(event.target.value));
              createScheduleMutation.reset();
            }}
            data-hint="Год, на который заполняется график отпусков"
            className={inputClass}
          >
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        {schedule && (
          <p className="pb-2 text-sm text-gray-600 dark:text-gray-300">
            Статус: {SCHEDULE_STATUS_LABELS[schedule.status] ?? schedule.status}
          </p>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {isDraft && (
            <button
              type="button"
              onClick={() => recalculateMutation.mutate(schedule.id)}
              disabled={recalculateMutation.isPending}
              data-hint="Пересчитывает положенные дни и включает сотрудников, добавленных после создания графика"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              {recalculateMutation.isPending ? "Считаем…" : "Пересчитать дни"}
            </button>
          )}
          {isDraft && (
            <button
              type="button"
              onClick={() => {
                submitMutation.reset();
                setSubmitOpen(true);
              }}
              data-hint="Отправляет на согласование весь график юридического лица"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Отправить
            </button>
          )}
        </div>
      </div>

      {selectedId === null && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Выберите юридическое лицо, чтобы создать или заполнить его график.
        </p>
      )}

      {selectedId !== null && schedulesQuery.isPending && (
        <p className="text-sm text-gray-400">Загрузка графика…</p>
      )}
      {schedulesQuery.isError && (
        <p className="text-sm text-red-500">{formatApiError(schedulesQuery.error)}</p>
      )}

      {selectedId !== null && !schedulesQuery.isPending && !schedule && (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-5 dark:border-gray-600">
          <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-300">
            Графика на {year} год ещё нет. Создание рассчитает положенные дни по текущим
            назначениям. В таблице графика сотрудник появится после отдельного периода отпуска.
          </p>
          <button
            type="button"
            onClick={() => createScheduleMutation.mutate()}
            disabled={createScheduleMutation.isPending}
            data-hint="Создаёт черновик годового графика и считает положенные дни"
            className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createScheduleMutation.isPending ? "Создаём…" : `Создать график на ${year}`}
          </button>
          {createScheduleMutation.isError && (
            <p className="mt-3 text-sm text-red-500">
              {formatApiError(createScheduleMutation.error)}
            </p>
          )}
        </div>
      )}

      {schedule && isDraft && missingEntitlements && !entitlementsQuery.isPending && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Часть сотрудников добавлена после создания графика. Нажмите «Пересчитать дни», чтобы
          рассчитать им отпуск и дать создать период.
        </p>
      )}

      {schedule && !isDraft && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Периоды можно менять, пока график в статусе «Черновик».
        </p>
      )}

      {schedule && (
        <div className="space-y-3">
          {assignmentsQuery.isPending && <p className="text-sm text-gray-400">Загрузка назначений…</p>}
          {assignmentsQuery.isError && (
            <p className="text-sm text-red-500">{formatApiError(assignmentsQuery.error)}</p>
          )}
          {!assignmentsQuery.isPending && assignments.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              В этом юрлице нет активных назначений. Сначала привяжите сотрудников к должностям.
            </p>
          )}
          {assignments.map((assignment) => (
            <AssignmentPlan
              key={assignment.id}
              assignment={assignment}
              entitlement={entitlementByAssignment.get(assignment.id)}
              periods={periodsByAssignment.get(assignment.id) ?? []}
              editable={isDraft}
              onAdd={(entitlement) => {
                createPeriodMutation.reset();
                updatePeriodMutation.reset();
                setPeriodForm({ mode: "create", assignment, entitlement });
              }}
              onEdit={(period, entitlement) => {
                createPeriodMutation.reset();
                updatePeriodMutation.reset();
                setPeriodForm({ mode: "edit", assignment, entitlement, period });
              }}
              onDelete={(period) => {
                const start = displayDate(period.planned_start_date);
                const end = displayDate(period.planned_end_date);
                if (
                  confirm(
                    `Удалить период ${start} — ${end} у ${assignment.employee_full_name || "сотрудника"}?`,
                  )
                ) {
                  deletePeriodMutation.mutate(period.period_id);
                }
              }}
            />
          ))}
        </div>
      )}

      {periodForm && schedule && (
        <PeriodForm
          state={periodForm}
          schedule={schedule}
          isPending={pendingPeriod.isPending}
          error={formatApiError(pendingPeriod.error)}
          onClose={() => {
            createPeriodMutation.reset();
            updatePeriodMutation.reset();
            setPeriodForm(null);
          }}
          onSubmit={(body) => {
            if (periodForm.mode === "create") createPeriodMutation.mutate(body);
            else updatePeriodMutation.mutate({ id: periodForm.period.period_id, body });
          }}
        />
      )}

      {submitOpen && schedule && (
        <SubmitScheduleForm
          year={schedule.year}
          entityName={schedule.legal_entity_name}
          isPending={submitMutation.isPending}
          error={formatApiError(submitMutation.error)}
          onClose={() => {
            submitMutation.reset();
            setSubmitOpen(false);
          }}
          onSubmit={(comment) => submitMutation.mutate(comment)}
        />
      )}

      {actionError && (
        <ApiErrorModal
          error={actionError}
          onClose={() => {
            recalculateMutation.reset();
            deletePeriodMutation.reset();
          }}
        />
      )}
    </div>
  );
}

function AssignmentPlan({
  assignment,
  entitlement,
  periods,
  editable,
  onAdd,
  onEdit,
  onDelete,
}: {
  assignment: AccountingAssignment;
  entitlement?: VacationEntitlement;
  periods: VacationListItem[];
  editable: boolean;
  onAdd: (entitlement: VacationEntitlement) => void;
  onEdit: (period: VacationListItem, entitlement: VacationEntitlement) => void;
  onDelete: (period: VacationListItem) => void;
}) {
  const canAdd = editable && entitlement != null && entitlement.remaining_days > 0;

  return (
    <article className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {assignment.employee_full_name || "Сотрудник"}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {assignment.legal_position_name || "Должность"}
            {" · "}
            {EMPLOYMENT_LABELS[assignment.employment_type] ?? assignment.employment_type}
            {assignment.manager_full_name ? ` · начальник ${assignment.manager_full_name}` : ""}
          </p>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-200">
          {entitlement
            ? `Осталось ${entitlement.remaining_days} из ${entitlement.total_days}`
            : "Дни ещё не рассчитаны"}
        </p>
      </div>

      <ul className="mt-3 space-y-1">
        {periods.length === 0 && (
          <li className="text-sm text-gray-400">Периодов отпуска нет</li>
        )}
        {periods.map((period) => (
          <li key={period.period_id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
            <span>
              {displayDate(period.planned_start_date)} — {displayDate(period.planned_end_date)}
              <span className="ml-2 text-gray-400">{period.planned_days} дн.</span>
            </span>
            {editable && entitlement && (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(period, entitlement)}
                  aria-label="Изменить период"
                  data-hint="Открывает изменение дат этого периода отпуска"
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(period)}
                  aria-label="Удалить период"
                  data-hint="Удаляет этот период из черновика графика"
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {editable && (
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => entitlement && onAdd(entitlement)}
          data-hint={
            !entitlement
              ? "Сначала пересчитайте положенные дни графика"
              : entitlement.remaining_days <= 0
                ? "Все положенные дни этого назначения уже распределены"
                : "Добавляет ещё одну часть отпуска для этого назначения"
          }
          className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-800 disabled:cursor-not-allowed disabled:text-gray-400 dark:text-blue-300 dark:hover:text-blue-200"
        >
          Добавить период
        </button>
      )}
    </article>
  );
}

function PeriodForm({
  state,
  schedule,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  state:
    | { mode: "create"; assignment: AccountingAssignment; entitlement: VacationEntitlement }
    | {
        mode: "edit";
        assignment: AccountingAssignment;
        entitlement: VacationEntitlement;
        period: VacationListItem;
      };
  schedule: VacationSchedule;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (body: VacationPeriodReq) => void;
}) {
  const isEdit = state.mode === "edit";
  const [startDate, setStartDate] = useState(
    isEdit ? calendarDate(state.period.planned_start_date) : "",
  );
  const [endDate, setEndDate] = useState(
    isEdit ? calendarDate(state.period.planned_end_date) : "",
  );
  const [changeReason, setChangeReason] = useState("");
  const days = inclusiveDays(startDate, endDate);
  const reservedByOthers = isEdit
    ? Math.max(0, state.entitlement.planned_days - state.period.planned_days)
    : state.entitlement.planned_days;
  const available = state.entitlement.total_days - reservedByOthers;
  const withinYear =
    days != null &&
    startDate.startsWith(`${schedule.year}-`) &&
    endDate.startsWith(`${schedule.year}-`);
  const withinBalance = days != null && days <= available;
  const canSubmit = withinYear && withinBalance;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      schedule_id: schedule.id,
      assignment_id: state.assignment.id,
      start_date: startDate,
      end_date: endDate,
      day_source: "current_year",
      change_reason: changeReason.trim() || null,
    });
  }

  return (
    <DictFormModal
      title={isEdit ? "Изменить период" : "Период отпуска"}
      subtitle={state.assignment.employee_full_name || "Сотрудник"}
      onClose={onClose}
      onSubmit={handleSubmit}
      isPending={isPending}
      canSubmit={canSubmit}
      error={error}
      submitLabel={isEdit ? "Сохранить" : "Добавить"}
      pendingLabel={isEdit ? "Сохраняем…" : "Добавляем…"}
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Осталось распределить {available} из {state.entitlement.total_days}. Дни считает сервер
        по календарю, включая обе даты.
      </p>
      {state.assignment.employment_type === "part_time" && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Для совместителя отпуск создаётся отдельно в каждом юрлице. Даты начала периодов должны
          совпадать, даты окончания могут различаться.
        </p>
      )}
      <Field label="Начало" required hint="Первый день отпуска в году графика">
        <DateInput value={startDate} onChange={setStartDate} className={inputClass} />
      </Field>
      <Field label="Окончание" required hint="Последний день отпуска, включительно">
        <DateInput value={endDate} onChange={setEndDate} className={inputClass} />
      </Field>
      {days != null && (
        <p className="text-sm text-gray-700 dark:text-gray-200">Календарных дней: {days}</p>
      )}
      {days != null && !withinYear && (
        <p className="text-sm text-red-500">Обе даты должны быть в {schedule.year} году.</p>
      )}
      {days != null && withinYear && !withinBalance && (
        <p className="text-sm text-red-500">Доступно только {available} дн.</p>
      )}
      <Field label="Причина" hint="Необязательный комментарий к периоду">
        <textarea
          value={changeReason}
          onChange={(event) => setChangeReason(event.target.value)}
          rows={2}
          className={inputClass}
        />
      </Field>
    </DictFormModal>
  );
}

function SubmitScheduleForm({
  year,
  entityName,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  year: number;
  entityName: string;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}) {
  const [comment, setComment] = useState("");

  return (
    <DictFormModal
      title="Отправить график"
      subtitle={`${entityName}, ${year}`}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(comment.trim());
      }}
      isPending={isPending}
      error={error}
      submitLabel="Отправить"
      pendingLabel="Отправляем…"
    >
      <p className="text-sm text-gray-500 dark:text-gray-400">
        На согласование уходит весь график юридического лица. У каждого сотрудника должны быть
        распределены все положенные дни, а у совместителей — совпадать даты начала.
      </p>
      <Field label="Комментарий" hint="Необязательный комментарий к отправке графика">
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          className={inputClass}
        />
      </Field>
    </DictFormModal>
  );
}
