import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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

const RESCHEDULABLE_PERIODS = new Set([
  "planned",
  "awaiting_confirmation",
  "confirmed",
  "rescheduled",
]);

function entitlementFromPeriod(period: VacationListItem, year: number): VacationEntitlement {
  return {
    id: 0,
    assignment_id: period.assignment_id,
    employee_id: period.employee_id,
    employee_full_name: period.employee_full_name,
    legal_entity_id: period.legal_entity_id,
    legal_entity_name: period.legal_entity_name,
    year,
    total_days: period.available_days,
    planned_days: period.planned_total_days,
    remaining_days: period.remaining_days,
  };
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

async function loadPeriods(
  legalEntityId: number | null,
  year: number,
): Promise<VacationListItem[]> {
  const pageSize = 200;
  const items: VacationListItem[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params: VacationListParams = {
      legal_entity_id: legalEntityId ?? undefined,
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
    | {
        mode: "create";
        assignment: AccountingAssignment;
        entitlement: VacationEntitlement;
        schedule: VacationSchedule;
      }
    | {
        mode: "edit";
        assignment: AccountingAssignment;
        entitlement: VacationEntitlement;
        period: VacationListItem;
        schedule: VacationSchedule;
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

  const entityFilter = selectedId === null ? {} : { legal_entity_id: selectedId };

  const schedulesQuery = useQuery({
    queryKey: ["hr", "vacation-schedules", selectedId ?? "all", year] as const,
    queryFn: () =>
      vacationsApi.schedules({ ...entityFilter, year }).then((res) => res.data ?? []),
  });
  const scheduleByEntity = new Map(
    (schedulesQuery.data ?? []).map((item) => [item.legal_entity_id, item]),
  );
  const selectedSchedule = selectedId === null ? null : (schedulesQuery.data?.[0] ?? null);
  const isDraft = selectedSchedule?.status === "draft";

  const assignmentsQuery = useQuery({
    queryKey: ["hr", "accounting-assignments", "schedule", selectedId ?? "all"] as const,
    queryFn: () =>
      hrAccountingApi
        .assignments({ ...entityFilter, active_only: true })
        .then((res) => res.data ?? []),
  });

  const entitlementsQuery = useQuery({
    queryKey: ["hr", "vacation-entitlements", selectedId ?? "all", year] as const,
    queryFn: () =>
      vacationsApi.entitlements({ ...entityFilter, year }).then((res) => res.data ?? []),
  });

  const periodsQuery = useQuery({
    queryKey: ["hr", "vacations", "schedule-periods", selectedId ?? "all", year] as const,
    queryFn: () => loadPeriods(selectedId, year),
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

  const rescheduleMutation = useMutation({
    mutationFn: ({
      id,
      startDate,
      endDate,
      reason,
    }: {
      id: number;
      startDate: string;
      endDate: string;
      reason: string | null;
    }) =>
      vacationsApi.createRescheduleRequest(id, {
        proposed_start_date: startDate,
        proposed_end_date: endDate,
        reason,
      }),
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
      vacationsApi.transitionSchedule(selectedSchedule?.id as number, {
        action: "submit",
        comment,
      }),
    onSuccess: () => {
      invalidatePlan();
      setSubmitOpen(false);
    },
  });

  const viewingAll = selectedId === null;
  const assignments = [...(assignmentsQuery.data ?? [])].sort((a, b) => {
    if (viewingAll) {
      const byEntity = (a.legal_entity_name ?? "").localeCompare(
        b.legal_entity_name ?? "",
        "ru",
      );
      if (byEntity !== 0) return byEntity;
    }
    return (a.employee_full_name ?? "").localeCompare(b.employee_full_name ?? "", "ru");
  });
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
  const pendingPeriod =
    periodForm?.mode !== "edit"
      ? createPeriodMutation
      : periodForm.schedule.status === "draft"
        ? updatePeriodMutation
        : rescheduleMutation;
  const actionError = recalculateMutation.error ?? deletePeriodMutation.error ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Юрлицо
          </span>
          <select
            value={entityId}
            onChange={(event) => {
              setEntityId(event.target.value);
              createScheduleMutation.reset();
            }}
            data-hint="Оставляет график выбранного юридического лица. Пустое значение показывает все юрлица"
            className={inputClass}
          >
            <option value="">Все юрлица</option>
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
        {selectedSchedule && (
          <p className="pb-2 text-sm text-gray-600 dark:text-gray-300">
            Статус: {SCHEDULE_STATUS_LABELS[selectedSchedule.status] ?? selectedSchedule.status}
          </p>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {isDraft && selectedSchedule && (
            <button
              type="button"
              onClick={() => recalculateMutation.mutate(selectedSchedule.id)}
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

      {(schedulesQuery.isPending || assignmentsQuery.isPending) && (
        <p className="text-sm text-gray-400">Загрузка графика…</p>
      )}
      {schedulesQuery.isError && (
        <p className="text-sm text-red-500">{formatApiError(schedulesQuery.error)}</p>
      )}
      {assignmentsQuery.isError && (
        <p className="text-sm text-red-500">{formatApiError(assignmentsQuery.error)}</p>
      )}

      {selectedId !== null && !schedulesQuery.isPending && !selectedSchedule && (
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

      {selectedSchedule && isDraft && missingEntitlements && !entitlementsQuery.isPending && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Часть сотрудников добавлена после создания графика. Нажмите «Пересчитать дни», чтобы
          рассчитать им отпуск и дать создать период.
        </p>
      )}

      {selectedSchedule && !isDraft && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          График уже отправлен. Новые периоды и удаление доступны только в черновике. Даты
          существующего отпуска переносятся запросом сотрудника.
        </p>
      )}

      {!schedulesQuery.isPending &&
        !assignmentsQuery.isPending &&
        !schedulesQuery.isError &&
        !assignmentsQuery.isError &&
        (viewingAll || selectedSchedule) && (
        <div className="space-y-3">
          {assignments.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {viewingAll
                ? "Активных назначений нет. Сначала привяжите сотрудников к должностям."
                : "В этом юрлице нет активных назначений. Сначала привяжите сотрудников к должностям."}
            </p>
          )}
          {assignments.map((assignment) => {
            const assignmentSchedule = viewingAll
              ? (scheduleByEntity.get(assignment.legal_entity_id) ?? null)
              : selectedSchedule;
            return (
              <AssignmentPlan
                key={assignment.id}
                assignment={assignment}
                entitlement={entitlementByAssignment.get(assignment.id)}
                periods={periodsByAssignment.get(assignment.id) ?? []}
                editable={assignmentSchedule?.status === "draft"}
                scheduleStatus={assignmentSchedule?.status}
                entityName={viewingAll ? assignment.legal_entity_name || "Юрлицо" : undefined}
                scheduleNote={
                  viewingAll
                    ? assignmentSchedule
                      ? (SCHEDULE_STATUS_LABELS[assignmentSchedule.status] ??
                        assignmentSchedule.status)
                      : `График на ${year} ещё не создан`
                    : undefined
                }
                onAdd={(entitlement) => {
                  if (!assignmentSchedule) return;
                  createPeriodMutation.reset();
                  updatePeriodMutation.reset();
                  rescheduleMutation.reset();
                  setPeriodForm({
                    mode: "create",
                    assignment,
                    entitlement,
                    schedule: assignmentSchedule,
                  });
                }}
                onEdit={(period) => {
                  if (!assignmentSchedule) return;
                  createPeriodMutation.reset();
                  updatePeriodMutation.reset();
                  rescheduleMutation.reset();
                  setPeriodForm({
                    mode: "edit",
                    assignment,
                    entitlement:
                      entitlementByAssignment.get(assignment.id) ??
                      entitlementFromPeriod(period, assignmentSchedule.year),
                    period,
                    schedule: assignmentSchedule,
                  });
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
            );
          })}
        </div>
      )}

      {periodForm && (
        <PeriodForm
          state={periodForm}
          schedule={periodForm.schedule}
          isPending={pendingPeriod.isPending}
          error={formatApiError(pendingPeriod.error)}
          onClose={() => {
            createPeriodMutation.reset();
            updatePeriodMutation.reset();
            rescheduleMutation.reset();
            setPeriodForm(null);
          }}
          onSubmit={(body) => {
            if (periodForm.mode === "create") createPeriodMutation.mutate(body);
            else if (periodForm.schedule.status === "draft")
              updatePeriodMutation.mutate({ id: periodForm.period.period_id, body });
            else
              rescheduleMutation.mutate({
                id: periodForm.period.period_id,
                startDate: body.start_date,
                endDate: body.end_date,
                reason: body.change_reason,
              });
          }}
        />
      )}

      {submitOpen && selectedSchedule && (
        <SubmitScheduleForm
          year={selectedSchedule.year}
          entityName={selectedSchedule.legal_entity_name}
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
  scheduleStatus,
  entityName,
  scheduleNote,
  onAdd,
  onEdit,
  onDelete,
}: {
  assignment: AccountingAssignment;
  entitlement?: VacationEntitlement;
  periods: VacationListItem[];
  editable: boolean;
  scheduleStatus?: string;
  entityName?: string;
  scheduleNote?: string;
  onAdd: (entitlement: VacationEntitlement) => void;
  onEdit: (period: VacationListItem) => void;
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
            {entityName ? `${entityName} · ` : ""}
            {assignment.legal_position_name || "Должность"}
            {" · "}
            {EMPLOYMENT_LABELS[assignment.employment_type] ?? assignment.employment_type}
            {assignment.manager_full_name ? ` · начальник ${assignment.manager_full_name}` : ""}
          </p>
          {scheduleNote && (
            <p className="mt-1 text-xs text-gray-400">{scheduleNote}</p>
          )}
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
          <li key={period.period_id} className="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
            <span>
              {displayDate(period.planned_start_date)} — {displayDate(period.planned_end_date)}
              <span className="ml-2 text-gray-400">{period.planned_days} дн.</span>
            </span>
            {(scheduleStatus === "draft" ||
              (scheduleStatus != null &&
                scheduleStatus !== "closed" &&
                RESCHEDULABLE_PERIODS.has(period.period_status))) && (
              <button
                type="button"
                onClick={() => onEdit(period)}
                data-hint={
                  scheduleStatus === "draft"
                    ? "Открывает изменение дат этого периода, пока график в черновике"
                    : "Открывает запрос на перенос дат этого отпуска"
                }
                className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Перенести даты
              </button>
            )}
            {editable && entitlement && (
              <button
                type="button"
                onClick={() => onDelete(period)}
                aria-label="Удалить период"
                data-hint="Удаляет этот период из черновика графика"
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
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
  const requestsReschedule = isEdit && schedule.status !== "draft";
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
      title={isEdit ? "Перенос дат отпуска" : "Период отпуска"}
      subtitle={state.assignment.employee_full_name || "Сотрудник"}
      onClose={onClose}
      onSubmit={handleSubmit}
      isPending={isPending}
      canSubmit={canSubmit}
      error={error}
      submitLabel={requestsReschedule ? "Запросить перенос" : isEdit ? "Перенести" : "Добавить"}
      pendingLabel={requestsReschedule ? "Отправляем…" : isEdit ? "Переносим…" : "Добавляем…"}
    >
      {requestsReschedule && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          График уже отправлен, поэтому даты не переписываются сразу. Запрос на перенос принимает
          только сотрудник, на которого записан этот отпуск.
        </p>
      )}
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
      <Field
        label="Причина"
        hint={
          isEdit
            ? "Почему переносятся даты. Можно оставить пустым"
            : "Необязательный комментарий к периоду"
        }
      >
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
