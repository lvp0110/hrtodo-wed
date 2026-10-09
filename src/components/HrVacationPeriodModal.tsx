import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DateInput } from "#/components/DateInput";
import {
  DictFormModal,
  Field,
  dictInputClass,
} from "#/components/settings/DictFormModal";
import { formatApiError } from "#/lib/apiError";
import {
  findDateOverlap,
  formatIsoDate,
  inclusiveDays,
  isoDate,
} from "#/lib/vacationPeriod";
import { hrAccountingApi, vacationsApi } from "#/services/api";
import type {
  AccountingAssignment,
  VacationEntitlement,
  VacationListItem,
  VacationPeriodReq,
  VacationSchedule,
} from "#/types/api";

const inputClass = `${dictInputClass} border-gray-200 dark:border-gray-700`;

export type HrVacationDialog =
  | { mode: "create" }
  | { mode: "edit"; period: VacationListItem }
  | { mode: "reschedule"; period: VacationListItem };

async function loadOccupiedRanges(params: {
  year: number;
  legalEntityId: number;
  employeeId: number;
  assignmentId: number;
  exceptPeriodId?: number;
}): Promise<{ start: string; end: string }[]> {
  const pageSize = 200;
  const items: VacationListItem[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await vacationsApi.list({
      year: params.year,
      legal_entity_id: params.legalEntityId,
      employee_id: params.employeeId,
      page,
      page_size: pageSize,
      sort: "start_date",
      order: "asc",
    });
    items.push(...(res.data?.items ?? []));
    totalPages = res.data?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages && page <= 20);

  return items
    .filter(
      (item) =>
        item.assignment_id === params.assignmentId &&
        item.period_id !== params.exceptPeriodId &&
        item.period_status !== "cancelled",
    )
    .map((item) => ({
      start: isoDate(item.planned_start_date),
      end: isoDate(item.planned_end_date),
    }));
}

function assignmentLabel(assignment: AccountingAssignment): string {
  return [
    assignment.employee_full_name || "Сотрудник",
    assignment.legal_position_name,
    assignment.employment_type === "part_time" ? "совместительство" : null,
    assignment.category_name,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function HrVacationPeriodModal({
  dialog,
  year,
  schedules,
  preferredLegalEntityId,
  onClose,
  onSaved,
}: {
  dialog: HrVacationDialog;
  year: number;
  schedules: VacationSchedule[];
  preferredLegalEntityId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const draftSchedules = schedules.filter((item) => item.status === "draft");
  const lockedPeriod = dialog.mode === "create" ? null : dialog.period;
  const [scheduleId, setScheduleId] = useState(() => {
    if (lockedPeriod) {
      return (
        schedules.find((item) => item.legal_entity_id === lockedPeriod.legal_entity_id)?.id ?? 0
      );
    }
    return (
      draftSchedules.find((item) => item.legal_entity_id === preferredLegalEntityId)?.id ??
      draftSchedules[0]?.id ??
      0
    );
  });
  const [assignmentId, setAssignmentId] = useState("");
  const [startDate, setStartDate] = useState(
    lockedPeriod ? isoDate(lockedPeriod.planned_start_date) : "",
  );
  const [endDate, setEndDate] = useState(
    lockedPeriod ? isoDate(lockedPeriod.planned_end_date) : "",
  );
  const [changeReason, setChangeReason] = useState("");

  const schedule = schedules.find((item) => item.id === scheduleId) ?? null;
  const legalEntityId = schedule?.legal_entity_id;

  const assignmentsQuery = useQuery({
    queryKey: ["hr", "accounting-assignments", "vacation-create", legalEntityId ?? "none"] as const,
    queryFn: () =>
      hrAccountingApi
        .assignments({ legal_entity_id: legalEntityId as number, active_only: true })
        .then((res) => res.data ?? []),
    enabled: dialog.mode === "create" && legalEntityId != null,
  });

  const assignments = [...(assignmentsQuery.data ?? [])].sort((a, b) =>
    (a.employee_full_name ?? "").localeCompare(b.employee_full_name ?? "", "ru"),
  );
  const selectedAssignment =
    assignments.find((item) => item.id === Number(assignmentId)) ?? null;
  const employeeId =
    dialog.mode === "create" ? selectedAssignment?.employee_id : lockedPeriod?.employee_id;
  const targetAssignmentId =
    dialog.mode === "create" ? selectedAssignment?.id : lockedPeriod?.assignment_id;

  const entitlementsQuery = useQuery({
    queryKey: [
      "hr",
      "vacation-entitlements",
      "vacation-form",
      legalEntityId ?? "none",
      employeeId ?? "none",
      year,
    ] as const,
    queryFn: () =>
      vacationsApi
        .entitlements({
          year,
          legal_entity_id: legalEntityId as number,
          employee_id: employeeId as number,
        })
        .then((res) => res.data ?? []),
    enabled: legalEntityId != null && employeeId != null,
  });

  const occupiedQuery = useQuery({
    queryKey: [
      "hr",
      "vacations",
      "occupied",
      legalEntityId ?? "none",
      employeeId ?? "none",
      targetAssignmentId ?? "none",
      lockedPeriod?.period_id ?? "new",
      year,
    ] as const,
    queryFn: () =>
      loadOccupiedRanges({
        year,
        legalEntityId: legalEntityId as number,
        employeeId: employeeId as number,
        assignmentId: targetAssignmentId as number,
        exceptPeriodId: lockedPeriod?.period_id,
      }),
    enabled: legalEntityId != null && employeeId != null && targetAssignmentId != null,
  });

  const entitlement =
    (entitlementsQuery.data ?? []).find((item) => item.assignment_id === targetAssignmentId) ??
    null;
  const days = inclusiveDays(startDate, endDate);
  const available = availableDays(entitlement, lockedPeriod);
  const withinYear =
    schedule != null &&
    days != null &&
    startDate.startsWith(`${schedule.year}-`) &&
    endDate.startsWith(`${schedule.year}-`);
  const withinBalance = available != null && days != null && days <= available;
  const overlap =
    withinYear && occupiedQuery.isSuccess
      ? findDateOverlap(startDate, endDate, occupiedQuery.data)
      : null;
  const rangesReady = targetAssignmentId == null || occupiedQuery.isSuccess;
  const entitlementReady =
    dialog.mode !== "create" ? available != null || entitlementsQuery.isSuccess : entitlement != null;
  const assignmentMatchesEntity =
    dialog.mode !== "create" ||
    (selectedAssignment != null && selectedAssignment.legal_entity_id === legalEntityId);
  const statusAllowsWrite =
    dialog.mode === "reschedule"
      ? schedule != null && schedule.status !== "draft" && schedule.status !== "closed"
      : schedule?.status === "draft";
  const canSubmit = Boolean(
    schedule &&
      targetAssignmentId &&
      assignmentMatchesEntity &&
      statusAllowsWrite &&
      rangesReady &&
      entitlementReady &&
      withinYear &&
      withinBalance &&
      overlap == null &&
      !occupiedQuery.isError &&
      (dialog.mode !== "create" || !entitlementsQuery.isError),
  );

  const saveMutation = useMutation({
    mutationFn: (body: VacationPeriodReq) => {
      if (dialog.mode === "create") return vacationsApi.createPeriod(body);
      if (dialog.mode === "edit") return vacationsApi.updatePeriod(dialog.period.period_id, body);
      return vacationsApi.createRescheduleRequest(dialog.period.period_id, {
        proposed_start_date: body.start_date,
        proposed_end_date: body.end_date,
        reason: body.change_reason,
      });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !schedule || targetAssignmentId == null) return;
    saveMutation.mutate({
      schedule_id: schedule.id,
      assignment_id: targetAssignmentId,
      start_date: startDate,
      end_date: endDate,
      day_source: "current_year",
      change_reason: changeReason.trim() || null,
    });
  }

  const title =
    dialog.mode === "reschedule"
      ? "Запрос переноса"
      : dialog.mode === "edit"
        ? "Изменить отпуск"
        : "Новый отпуск";
  const subtitle =
    lockedPeriod?.employee_full_name ||
    selectedAssignment?.employee_full_name ||
    (schedule ? `${schedule.legal_entity_name}, ${year}` : `${year}`);

  return (
    <DictFormModal
      title={title}
      subtitle={subtitle}
      panelClassName="max-w-lg"
      onClose={onClose}
      onSubmit={handleSubmit}
      isPending={saveMutation.isPending}
      canSubmit={canSubmit}
      error={formatApiError(saveMutation.error)}
      submitLabel={
        dialog.mode === "reschedule"
          ? "Запросить перенос"
          : dialog.mode === "edit"
            ? "Сохранить"
            : "Создать"
      }
      pendingLabel={
        dialog.mode === "create"
          ? "Создаём…"
          : dialog.mode === "reschedule"
            ? "Отправляем…"
            : "Сохраняем…"
      }
    >
      {dialog.mode === "create" && draftSchedules.length === 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          На {year} год нет графика в статусе «Черновик». Создать отпуск можно только в черновике.
          После отправки даты меняются запросом на перенос.
        </p>
      )}
      {dialog.mode === "create" && draftSchedules.length > 0 && (
        <>
          <Field
            label="Юрлицо"
            required
            hint="Отпуск попадает в черновик графика этого юридического лица"
          >
            <select
              value={scheduleId || ""}
              onChange={(event) => {
                setScheduleId(Number(event.target.value));
                setAssignmentId("");
              }}
              className={inputClass}
            >
              {draftSchedules.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.legal_entity_name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Сотрудник"
            required
            hint="Отпуск создаётся для назначения в этом юрлице, а не просто для сотрудника"
          >
            <select
              value={assignmentId}
              onChange={(event) => setAssignmentId(event.target.value)}
              className={inputClass}
              disabled={assignmentsQuery.isPending}
            >
              <option value="">
                {assignmentsQuery.isPending ? "Загрузка…" : "Выберите назначение"}
              </option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignmentLabel(assignment)}
                </option>
              ))}
            </select>
          </Field>
          {assignmentsQuery.isSuccess && assignments.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              В этом юрлице нет активных назначений.
            </p>
          )}
          {selectedAssignment && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedAssignment.category_name
                ? `Категория «${selectedAssignment.category_name}» не запрещает HR создать отпуск. `
                : "Категория сотрудника не запрещает HR создать отпуск. "}
              Она определяет, кто подтверждает период и кому уходит уведомление в Telegram.
            </p>
          )}
          {selectedAssignment?.employment_type === "part_time" && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Для совместителя отпуск создаётся отдельно в каждом юрлице. Даты начала периодов
              должны совпадать, даты окончания могут различаться.
            </p>
          )}
        </>
      )}
      {dialog.mode !== "create" && !schedule && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          График этого юрлица на {year} год не найден.
        </p>
      )}
      {dialog.mode === "reschedule" && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          График уже отправлен, поэтому даты не переписываются сразу. Изменение уходит запросом
          на перенос.
        </p>
      )}
      {(dialog.mode !== "create" || draftSchedules.length > 0) && (
        <>
          {(dialog.mode !== "create" || selectedAssignment) && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {targetAssignmentId != null && entitlementsQuery.isPending
                ? "Считаем доступные дни…"
                : available == null
                  ? "Положено дней ещё не рассчитано. Пересчитайте график, если сотрудник добавлен после его создания."
                  : `Можно распределить ${available} дн. Количество дней посчитает сервер, обе даты входят в период.`}
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
          {days != null && schedule && !withinYear && (
            <p className="text-sm text-red-500">Обе даты должны быть в {schedule.year} году.</p>
          )}
          {days != null && withinYear && available != null && !withinBalance && (
            <p className="text-sm text-red-500">Доступно только {available} дн.</p>
          )}
          {overlap && (
            <p className="text-sm text-red-500">
              Даты пересекаются с другим отпуском этого назначения: {formatIsoDate(overlap.start)}{" "}
              — {formatIsoDate(overlap.end)}.
            </p>
          )}
          {(occupiedQuery.isError || entitlementsQuery.isError) && (
            <p className="text-sm text-red-500">
              {formatApiError(occupiedQuery.error ?? entitlementsQuery.error)}
            </p>
          )}
          <Field
            label="Причина"
            hint={
              dialog.mode === "create"
                ? "Необязательный комментарий. Можно оставить пустым"
                : "Почему меняются даты. Можно оставить пустым"
            }
          >
            <textarea
              value={changeReason}
              onChange={(event) => setChangeReason(event.target.value)}
              rows={2}
              className={inputClass}
            />
          </Field>
        </>
      )}
    </DictFormModal>
  );
}

function availableDays(
  entitlement: VacationEntitlement | null,
  period: VacationListItem | null,
): number | null {
  if (entitlement) {
    const reservedByOthers = period
      ? Math.max(0, entitlement.planned_days - period.planned_days)
      : entitlement.planned_days;
    return entitlement.total_days - reservedByOthers;
  }
  if (!period) return null;
  const reservedByOthers = Math.max(0, period.planned_total_days - period.planned_days);
  return period.available_days - reservedByOthers;
}
