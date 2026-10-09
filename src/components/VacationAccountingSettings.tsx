import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { EmployeeSelect } from "#/components/EmployeeSelect";
import { DateInput } from "#/components/DateInput";
import { ApiErrorModal } from "#/components/ApiErrorModal";
import { DictTable } from "#/components/settings/DictTable";
import {
  DictFormModal,
  Field,
  dictInputClass,
} from "#/components/settings/DictFormModal";
import { formatApiError } from "#/lib/apiError";
import { dictQueries, hrAccountingApi } from "#/services/api";
import { VacationScheduleEditor } from "#/components/VacationScheduleEditor";
import { VacationNotificationSettings } from "#/components/VacationNotificationSettings";
import type {
  AccountingAssignment,
  AccountingAssignmentReq,
  AccountingStructure,
  EmployeeCategory,
  LegalEntity,
  LegalEntityReq,
  LegalPosition,
  LegalPositionCreateReq,
  LegalPositionUpdateReq,
} from "#/types/api";

export type VacationAccountingTab =
  | "entities"
  | "positions"
  | "managers"
  | "schedule"
  | "notifications";

export const vacationAccountingHint = `Записка: порядок работы HR с юридическим лицом
Юридическое лицо существует независимо от текущей управленческой структуры компании. Сотрудник связывается с юрлицом через учётное назначение.
1. Завести юридическое лицо
HR указывает код, краткое и полное наименование организации.
- Создание: POST /hr/legal-entities
- Просмотр списка: GET /hr/legal-entities
- Редактирование: PUT /hr/legal-entities/{id}
- Деактивация: DELETE /hr/legal-entities/{id}
2. Создать штатные должности юрлица
Для каждого юридического лица формируется собственный список официальных должностей. Они могут отличаться от должностей в управленческой структуре.
- Список: GET /hr/legal-positions?legal_entity_id={id}
- Создание: POST /hr/legal-positions
- Редактирование: PUT /hr/legal-positions/{id}
- Деактивация: DELETE /hr/legal-positions/{id}
3. Проверить наличие сотрудника
Сотрудник должен быть предварительно заведён в общем справочнике сотрудников.
- Выбор сотрудника: GET /dict/employees
- Просмотр карточки: GET /employees/{id}
- Создание нового сотрудника: POST /employees
- Редактирование: PUT /employees/{id}
Один и тот же сотрудник может быть оформлен в нескольких юридических лицах.
4. Определить категорию сотрудника
Категория определяет, кто ведёт и подтверждает отпуск:
- employee_self — сотрудник самостоятельно работает со своим отпуском;
- manager_on_behalf — учёт отпуска ведёт руководитель.
Маршруты:
- Список категорий: GET /hr/employee-categories
- Создание категории: POST /hr/employee-categories
- Редактирование: PUT /hr/employee-categories/{id}
Обычно HR выбирает одну из уже заведённых категорий.
5. Оформить руководителя в юридическом лице
Сначала необходимо создать учётное назначение руководителя:
- выбрать сотрудника;
- выбрать юрлицо;
- указать официальную должность;
- установить признак «Руководитель»;
- указать дату начала работы;
- руководителя для него самого не выбирать.
Маршрут:
- POST /hr/accounting-assignments
Созданное назначение руководителя впоследствии выбирается для его подчинённых.
6. Привязать сотрудника к юридическому лицу
HR создаёт сотруднику учётное назначение и указывает:
- юридическое лицо;
- официальную должность;
- категорию;
- руководителя;
- основное это место работы или совместительство;
- табельный номер;
- ставку;
- дату начала работы.
Маршруты:
- Создание назначения: POST /hr/accounting-assignments
- Просмотр назначения: GET /hr/accounting-assignments/{id}
- Редактирование: PUT /hr/accounting-assignments/{id}
- Завершение работы: POST /hr/accounting-assignments/{id}/end
Именно после создания назначения сотрудник считается привязанным к юридическому лицу.
7. Проверить учётную структуру
После оформления HR открывает структуру юридического лица и проверяет:
- появился ли руководитель;
- отображается ли сотрудник у нужного руководителя;
- нет ли сотрудников без руководителя.
Маршрут:
- GET /hr/accounting-structure?legal_entity_id={id}
Структура двухуровневая: руководитель → его сотрудники. Сотрудники без руководителя попадают в отдельный список unassigned.
8. Особенности совместительства
Если сотрудник работает в нескольких юрлицах, для каждого юрлица создаётся отдельное учётное назначение:
- со своей должностью;
- своим руководителем;
- своей категорией;
- своей датой начала работы;
- своим количеством положенных дней отпуска.
Для совместительства указывается тип part_time. Основное активное назначение primary у сотрудника может быть только одно.
После этого HR может создавать годовой график соответствующего юрлица:
- POST /hr/vacation-schedules
При создании графика система рассчитает положенные дни по назначениям, которые уже есть. Сам период отпуска в график не попадает, пока HR не создаст его отдельно.
9. Заполнить отпуск и отправить график
Таблица графика показывает периоды, а не учётные назначения.
- График юрлица и года: GET /hr/vacation-schedules?legal_entity_id={id}&year={year}
- Если графика нет: POST /hr/vacation-schedules, статус draft
- Если сотрудник добавлен позже: POST /hr/vacation-schedules/{id}/recalculate
- Положено и остаток: GET /hr/vacation-entitlements?legal_entity_id={id}&year={year}
- Период создаётся для assignment_id, не для employee_id: POST /hr/vacations
- HR создаёт отпуск за любое назначение. Категория employee_self или manager_on_behalf этому не мешает: она определяет подтверждение и получателей Telegram
- Изменение и удаление, пока график в draft: PUT /hr/vacations/{period_id}, DELETE /hr/vacations/{period_id}
- После отправки или утверждения даты меняются запросом переноса
- Отправка всего графика: POST /hr/vacation-schedules/{id}/transition с action submit
У совместителя отпуск заполняется отдельно в каждом юрлице: даты начала совпадают, даты окончания могут различаться. Telegram-привязка сотрудника — отдельный следующий процесс и не относится к его оформлению в юридическом лице.
10. Настроить уведомления об отпуске
Общая настройка задаёт, за сколько дней до отпуска начинать уведомления, как часто их повторять и в какое время. Для юрлица можно сохранить свою настройку: она заменяет общую.
- Просмотр: GET /hr/vacation-notification-settings
- Сохранение: PUT /hr/vacation-notification-settings
Если у юрлица уведомления выключены, они не отправляются и общая настройка для него не используется.`;

const inputClass = `${dictInputClass} border-gray-200 dark:border-gray-700`;

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

function categoryNeedsManager(category: EmployeeCategory | undefined): boolean {
  if (!category) return false;
  return (
    category.vacation_management_mode === "manager_on_behalf" ||
    category.code === "manager_on_behalf"
  );
}

export function VacationAccountingSettings({
  tab,
}: {
  tab: VacationAccountingTab;
}) {
  if (tab === "entities") return <LegalEntitiesSection />;
  if (tab === "positions") return <LegalPositionsSection />;
  if (tab === "schedule") return <VacationScheduleEditor />;
  if (tab === "notifications") return <VacationNotificationSettings />;
  return <ManagersSection />;
}

function LegalEntitiesSection() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form, setForm] = useState<
    { mode: "create" } | { mode: "edit"; entity: LegalEntity } | null
  >(null);

  const entitiesQuery = useQuery({
    queryKey: ["hr", "legal-entities", includeInactive] as const,
    queryFn: () =>
      hrAccountingApi.legalEntities(includeInactive).then((res) => res.data ?? []),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["hr", "legal-entities"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: LegalEntityReq) => hrAccountingApi.createLegalEntity(body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: LegalEntityReq }) =>
      hrAccountingApi.updateLegalEntity(id, body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => hrAccountingApi.deactivateLegalEntity(id),
    onSuccess: invalidate,
  });

  const pendingForm = form?.mode === "edit" ? updateMutation : createMutation;

  return (
    <>
      <Toolbar
        addLabel="Добавить юрлицо"
        addHint="Открывает форму нового юридического лица"
        onAdd={() => setForm({ mode: "create" })}
        includeInactive={includeInactive}
        onIncludeInactive={setIncludeInactive}
      />
      <DictTable<LegalEntity>
        columns={[
          {
            key: "code",
            header: "Код",
            render: (row) => <span className="font-mono text-xs">{row.code}</span>,
          },
          {
            key: "short_name",
            header: "Краткое название",
            render: (row) => <InactiveLabel name={row.short_name} active={row.is_active} />,
          },
          { key: "full_name", header: "Полное название", render: (row) => row.full_name },
        ]}
        rows={entitiesQuery.data ?? []}
        rowKey={(row) => row.id}
        onEdit={(entity) => setForm({ mode: "edit", entity })}
        editHint="Открывает редактирование юридического лица"
        showDelete={(row) => row.is_active}
        deleteHint="Деактивирует юридическое лицо: оно пропадёт из обычных списков"
        onDelete={(entity) => {
          if (confirm(`Деактивировать юридическое лицо «${entity.short_name}»?`)) {
            deactivateMutation.mutate(entity.id);
          }
        }}
        isLoading={entitiesQuery.isPending}
        isError={entitiesQuery.isError}
        errorMessage={formatApiError(entitiesQuery.error)}
        emptyMessage="Юридических лиц пока нет"
      />
      {form && (
        <LegalEntityForm
          state={form}
          isPending={pendingForm.isPending}
          error={formatApiError(pendingForm.error)}
          onClose={() => {
            createMutation.reset();
            updateMutation.reset();
            setForm(null);
          }}
          onSubmit={(body) => {
            if (form.mode === "create") createMutation.mutate(body);
            else updateMutation.mutate({ id: form.entity.id, body });
          }}
        />
      )}
      {deactivateMutation.isError && (
        <ApiErrorModal
          error={deactivateMutation.error}
          onClose={() => deactivateMutation.reset()}
        />
      )}
    </>
  );
}

function LegalEntityForm({
  state,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  state: { mode: "create" } | { mode: "edit"; entity: LegalEntity };
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (body: LegalEntityReq) => void;
}) {
  const isEdit = state.mode === "edit";
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LegalEntityReq>({
    mode: "onChange",
    defaultValues: isEdit
      ? {
          code: state.entity.code,
          short_name: state.entity.short_name,
          full_name: state.entity.full_name,
          is_active: state.entity.is_active,
        }
      : { code: "", short_name: "", full_name: "", is_active: true },
  });

  return (
    <DictFormModal
      title={isEdit ? "Редактировать юрлицо" : "Новое юрлицо"}
      subtitle={isEdit ? state.entity.short_name : undefined}
      onClose={onClose}
      isPending={isPending}
      canSubmit={isValid}
      error={error}
      submitLabel={isEdit ? "Сохранить" : "Создать"}
      pendingLabel={isEdit ? "Сохраняем…" : "Создаём…"}
      onSubmit={handleSubmit((data) =>
        onSubmit({
          code: data.code.trim(),
          short_name: data.short_name.trim(),
          full_name: data.full_name.trim(),
          is_active: isEdit ? Boolean(data.is_active) : true,
        }),
      )}
    >
      <Field label="Код" required error={errors.code?.message} hint="Короткий код юридического лица">
        <input {...register("code", { required: "Обязательное поле" })} autoFocus className={inputClass} placeholder="company_1" />
      </Field>
      <Field label="Краткое название" required error={errors.short_name?.message} hint="Название, которое видно в списках">
        <input {...register("short_name", { required: "Обязательное поле" })} className={inputClass} placeholder="ООО Компания" />
      </Field>
      <Field label="Полное название" required error={errors.full_name?.message} hint="Официальное полное наименование">
        <input {...register("full_name", { required: "Обязательное поле" })} className={inputClass} />
      </Field>
      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" {...register("is_active")} data-hint="Возвращает юридическое лицо в обычные списки" />
          Активно
        </label>
      )}
    </DictFormModal>
  );
}

function LegalPositionsSection() {
  const queryClient = useQueryClient();
  const [entityId, setEntityId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form, setForm] = useState<
    { mode: "create" } | { mode: "edit"; position: LegalPosition } | null
  >(null);
  const [assignmentForm, setAssignmentForm] = useState<
    | { mode: "create"; position: LegalPosition }
    | { mode: "edit"; assignment: AccountingAssignment }
    | null
  >(null);
  const selectedId = entityId ? Number(entityId) : null;

  const entitiesQuery = useQuery({
    queryKey: ["hr", "legal-entities", false] as const,
    queryFn: () => hrAccountingApi.legalEntities(false).then((res) => res.data ?? []),
  });

  const positionsQuery = useQuery({
    queryKey: ["hr", "legal-positions", selectedId, includeInactive] as const,
    queryFn: () =>
      hrAccountingApi
        .legalPositions(selectedId as number, includeInactive)
        .then((res) => res.data ?? []),
    enabled: selectedId !== null,
  });

  const assignmentsQuery = useQuery({
    queryKey: ["hr", "accounting-assignments", "by-entity", selectedId ?? "none"] as const,
    queryFn: () =>
      hrAccountingApi
        .assignments({ legal_entity_id: selectedId as number, active_only: true })
        .then((res) => res.data ?? []),
    enabled: selectedId !== null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["hr", "legal-positions"] });
    queryClient.invalidateQueries({ queryKey: ["hr", "accounting-assignments"] });
    queryClient.invalidateQueries({ queryKey: ["hr", "accounting-structure"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: LegalPositionCreateReq) => hrAccountingApi.createLegalPosition(body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: LegalPositionUpdateReq }) =>
      hrAccountingApi.updateLegalPosition(id, body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => hrAccountingApi.deactivateLegalPosition(id),
    onSuccess: invalidate,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: (body: AccountingAssignmentReq) => hrAccountingApi.createAssignment(body),
    onSuccess: () => {
      invalidate();
      setAssignmentForm(null);
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: AccountingAssignmentReq }) =>
      hrAccountingApi.updateAssignment(id, body),
    onSuccess: () => {
      invalidate();
      setAssignmentForm(null);
    },
  });

  const pendingForm = form?.mode === "edit" ? updateMutation : createMutation;
  const pendingAssignment =
    assignmentForm?.mode === "edit" ? updateAssignmentMutation : createAssignmentMutation;
  const positionAssignments = assignmentsQuery.data ?? [];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Юридическое лицо
          </span>
          <select
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
            data-hint="Показывает штатные должности выбранного юридического лица"
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
        <Toolbar
          addLabel="Добавить должность"
          addHint="Открывает форму штатной должности этого юридического лица"
          onAdd={() => setForm({ mode: "create" })}
          addDisabled={selectedId === null}
          includeInactive={includeInactive}
          onIncludeInactive={setIncludeInactive}
        />
      </div>
      <DictTable<LegalPosition>
        columns={[
          {
            key: "code",
            header: "Код",
            render: (row) => <span className="font-mono text-xs">{row.code}</span>,
          },
          {
            key: "name",
            header: "Должность",
            render: (row) => <InactiveLabel name={row.name} active={row.is_active} />,
          },
          {
            key: "employees",
            header: "Сотрудники",
            className: "align-top",
            render: (row) => (
              <PositionEmployees
                assignments={positionAssignments.filter(
                  (item) => item.legal_position_id === row.id,
                )}
                onEdit={(assignment) =>
                  setAssignmentForm({ mode: "edit", assignment })
                }
                onAdd={() => setAssignmentForm({ mode: "create", position: row })}
              />
            ),
          },
        ]}
        rows={selectedId === null ? [] : (positionsQuery.data ?? [])}
        rowKey={(row) => row.id}
        onEdit={(position) => setForm({ mode: "edit", position })}
        editHint="Открывает редактирование штатной должности"
        showDelete={(row) => row.is_active}
        deleteHint="Деактивирует должность: она пропадёт из обычных списков"
        onDelete={(position) => {
          if (confirm(`Деактивировать должность «${position.name}»?`)) {
            deactivateMutation.mutate(position.id);
          }
        }}
        isLoading={selectedId !== null && positionsQuery.isPending}
        isError={positionsQuery.isError}
        errorMessage={formatApiError(positionsQuery.error)}
        emptyMessage={
          selectedId === null
            ? "Сначала выберите юридическое лицо"
            : "Должностей пока нет"
        }
      />
      {form && selectedId !== null && (
        <LegalPositionForm
          state={form}
          legalEntityId={selectedId}
          isPending={pendingForm.isPending}
          error={formatApiError(pendingForm.error)}
          onClose={() => {
            createMutation.reset();
            updateMutation.reset();
            setForm(null);
          }}
          onCreate={(body) => createMutation.mutate(body)}
          onUpdate={(id, body) => updateMutation.mutate({ id, body })}
        />
      )}
      {assignmentForm && selectedId !== null && (
        <PositionAssignmentForm
          state={assignmentForm}
          legalEntityId={selectedId}
          managers={positionAssignments.filter((item) => item.is_manager)}
          isPending={pendingAssignment.isPending}
          error={formatApiError(pendingAssignment.error)}
          onClose={() => {
            createAssignmentMutation.reset();
            updateAssignmentMutation.reset();
            setAssignmentForm(null);
          }}
          onSubmit={(body) => {
            if (assignmentForm.mode === "create") createAssignmentMutation.mutate(body);
            else {
              updateAssignmentMutation.mutate({
                id: assignmentForm.assignment.id,
                body,
              });
            }
          }}
        />
      )}
      {deactivateMutation.isError && (
        <ApiErrorModal
          error={deactivateMutation.error}
          onClose={() => deactivateMutation.reset()}
        />
      )}
      {selectedId !== null && <AccountingStructureView legalEntityId={selectedId} />}
    </>
  );
}

function LegalPositionForm({
  state,
  legalEntityId,
  isPending,
  error,
  onClose,
  onCreate,
  onUpdate,
}: {
  state: { mode: "create" } | { mode: "edit"; position: LegalPosition };
  legalEntityId: number;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (body: LegalPositionCreateReq) => void;
  onUpdate: (id: number, body: LegalPositionUpdateReq) => void;
}) {
  const isEdit = state.mode === "edit";
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<{ code: string; name: string; is_active: boolean }>({
    mode: "onChange",
    defaultValues: isEdit
      ? {
          code: state.position.code,
          name: state.position.name,
          is_active: state.position.is_active,
        }
      : { code: "", name: "", is_active: true },
  });

  return (
    <DictFormModal
      title={isEdit ? "Редактировать должность" : "Новая должность"}
      subtitle={isEdit ? state.position.name : undefined}
      onClose={onClose}
      isPending={isPending}
      canSubmit={isValid}
      error={error}
      submitLabel={isEdit ? "Сохранить" : "Создать"}
      pendingLabel={isEdit ? "Сохраняем…" : "Создаём…"}
      onSubmit={handleSubmit((data) => {
        const fields = {
          code: data.code.trim(),
          name: data.name.trim(),
          is_active: isEdit ? Boolean(data.is_active) : true,
        };
        if (isEdit) onUpdate(state.position.id, fields);
        else onCreate({ ...fields, legal_entity_id: legalEntityId });
      })}
    >
      <Field label="Код" required error={errors.code?.message} hint="Короткий код штатной должности">
        <input {...register("code", { required: "Обязательное поле" })} autoFocus className={inputClass} placeholder="accountant" />
      </Field>
      <Field label="Название" required error={errors.name?.message} hint="Официальное название должности в этом юрлице">
        <input {...register("name", { required: "Обязательное поле" })} className={inputClass} placeholder="Бухгалтер" />
      </Field>
      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" {...register("is_active")} data-hint="Возвращает должность в обычные списки" />
          Активна
        </label>
      )}
    </DictFormModal>
  );
}

function ManagersSection() {
  const queryClient = useQueryClient();
  const [entityId, setEntityId] = useState("");
  const [form, setForm] = useState<
    { mode: "create" } | { mode: "edit"; assignment: AccountingAssignment } | null
  >(null);
  const selectedId = entityId ? Number(entityId) : undefined;

  const entitiesQuery = useQuery({
    queryKey: ["hr", "legal-entities", false] as const,
    queryFn: () => hrAccountingApi.legalEntities(false).then((res) => res.data ?? []),
  });

  const assignmentsQuery = useQuery({
    queryKey: ["hr", "accounting-assignments", "managers", selectedId ?? "all"] as const,
    queryFn: () =>
      hrAccountingApi
        .assignments({ legal_entity_id: selectedId, active_only: true })
        .then((res) => (res.data ?? []).filter((item) => item.is_manager)),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["hr", "accounting-assignments"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: AccountingAssignmentReq) => hrAccountingApi.createAssignment(body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: AccountingAssignmentReq }) =>
      hrAccountingApi.updateAssignment(id, body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const pendingForm = form?.mode === "edit" ? updateMutation : createMutation;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Юридическое лицо
          </span>
          <select
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
            data-hint="Оставляет руководителей выбранного юридического лица"
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
        <button
          type="button"
          onClick={() => setForm({ mode: "create" })}
          data-hint="Открывает оформление сотрудника руководителем юридического лица"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Добавить руководителя
        </button>
      </div>
      <DictTable<AccountingAssignment>
        columns={[
          {
            key: "name",
            header: "Сотрудник",
            render: (row) => row.employee_full_name || "—",
          },
          {
            key: "entity",
            header: "Юрлицо",
            render: (row) => row.legal_entity_name || "—",
          },
          {
            key: "position",
            header: "Должность",
            render: (row) => row.legal_position_name || "—",
          },
          {
            key: "category",
            header: "Категория",
            render: (row) => row.category_name || "—",
          },
          {
            key: "type",
            header: "Занятость",
            render: (row) =>
              row.employment_type === "part_time" ? "Совместительство" : "Основное",
          },
          {
            key: "started",
            header: "Начало",
            render: (row) => displayDate(row.started_on),
          },
        ]}
        rows={assignmentsQuery.data ?? []}
        rowKey={(row) => row.id}
        onEdit={(assignment) => setForm({ mode: "edit", assignment })}
        editHint="Открывает редактирование учётного назначения руководителя"
        isLoading={assignmentsQuery.isPending}
        isError={assignmentsQuery.isError}
        errorMessage={formatApiError(assignmentsQuery.error)}
        emptyMessage="Руководителей пока нет"
      />
      {form && (
        <ManagerForm
          state={form}
          entities={entitiesQuery.data ?? []}
          isPending={pendingForm.isPending}
          error={formatApiError(pendingForm.error)}
          onClose={() => {
            createMutation.reset();
            updateMutation.reset();
            setForm(null);
          }}
          onSubmit={(body) => {
            if (form.mode === "create") createMutation.mutate(body);
            else updateMutation.mutate({ id: form.assignment.id, body });
          }}
        />
      )}
    </>
  );
}

function ManagerForm({
  state,
  entities,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  state: { mode: "create" } | { mode: "edit"; assignment: AccountingAssignment };
  entities: LegalEntity[];
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (body: AccountingAssignmentReq) => void;
}) {
  const isEdit = state.mode === "edit";
  const assignment = isEdit ? state.assignment : null;
  const [employeeId, setEmployeeId] = useState<number | null>(assignment?.employee_id ?? null);
  const [legalEntityId, setLegalEntityId] = useState(
    assignment ? String(assignment.legal_entity_id) : "",
  );
  const [positionId, setPositionId] = useState(
    assignment ? String(assignment.legal_position_id) : "",
  );
  const [categoryId, setCategoryId] = useState(
    assignment ? String(assignment.category_id) : "",
  );
  const [employmentType, setEmploymentType] = useState<"primary" | "part_time">(
    assignment?.employment_type === "part_time" ? "part_time" : "primary",
  );
  const [personnelNumber, setPersonnelNumber] = useState(assignment?.personnel_number ?? "");
  const [workFraction, setWorkFraction] = useState(
    assignment?.work_fraction == null ? "1" : String(assignment.work_fraction),
  );
  const [startedOn, setStartedOn] = useState(calendarDate(assignment?.started_on));

  const employeesQuery = useQuery(dictQueries.employees);
  const categoriesQuery = useQuery({
    queryKey: ["hr", "employee-categories"] as const,
    queryFn: () =>
      hrAccountingApi.employeeCategories(false).then((res) => res.data ?? []),
  });
  const positionsQuery = useQuery({
    queryKey: ["hr", "legal-positions", legalEntityId || "none", false] as const,
    queryFn: () =>
      hrAccountingApi
        .legalPositions(Number(legalEntityId), false)
        .then((res) => res.data ?? []),
    enabled: Boolean(legalEntityId),
  });

  const fraction = workFraction.trim() === "" ? null : Number(workFraction);
  const fractionValid = fraction === null || (fraction > 0 && fraction <= 1);
  const canSubmit = Boolean(
    employeeId &&
      legalEntityId &&
      positionId &&
      categoryId &&
      startedOn &&
      fractionValid,
  );

  return (
    <DictFormModal
      title={isEdit ? "Редактировать руководителя" : "Новый руководитель"}
      subtitle="Руководителя для него самого не выбирают"
      panelClassName="max-w-lg"
      onClose={onClose}
      isPending={isPending}
      canSubmit={canSubmit}
      error={error}
      submitLabel={isEdit ? "Сохранить" : "Создать"}
      pendingLabel={isEdit ? "Сохраняем…" : "Создаём…"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit || employeeId === null) return;
        onSubmit({
          employee_id: employeeId,
          legal_entity_id: Number(legalEntityId),
          legal_position_id: Number(positionId),
          category_id: Number(categoryId),
          manager_assignment_id: null,
          employment_type: employmentType,
          personnel_number: personnelNumber.trim() || null,
          work_fraction: fraction,
          is_manager: true,
          started_on: startedOn,
          ended_on: calendarDate(assignment?.ended_on) || null,
          end_reason: assignment?.end_reason ?? null,
        });
      }}
    >
      <Field label="Сотрудник" required hint="Сотрудник уже должен быть в общем справочнике">
        <EmployeeSelect
          employees={employeesQuery.data ?? []}
          value={employeeId}
          onChange={setEmployeeId}
          allowVacant={false}
          hint="Сотрудник уже должен быть в общем справочнике"
          placeholder={employeesQuery.isPending ? "Загрузка…" : "Выберите сотрудника"}
          disabled={employeesQuery.isPending}
        />
      </Field>
      <Field label="Юридическое лицо" required hint="Юрлицо, в котором сотрудник становится руководителем">
        <select
          value={legalEntityId}
          onChange={(event) => {
            setLegalEntityId(event.target.value);
            setPositionId("");
          }}
          className={inputClass}
        >
          <option value="">Выберите юрлицо</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.short_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Должность" required hint="Официальная должность этого юридического лица">
        <select
          value={positionId}
          onChange={(event) => setPositionId(event.target.value)}
          disabled={!legalEntityId}
          className={`${inputClass} disabled:opacity-60`}
        >
          <option value="">
            {legalEntityId ? "Выберите должность" : "Сначала выберите юрлицо"}
          </option>
          {(positionsQuery.data ?? []).map((position) => (
            <option key={position.id} value={position.id}>
              {position.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Категория" required hint="Кто ведёт отпуск: сам сотрудник или руководитель">
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={inputClass}
        >
          <option value="">Выберите категорию</option>
          {(categoriesQuery.data ?? []).map((category: EmployeeCategory) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Занятость" required hint="Основное место или совместительство. Активное основное назначение может быть только одно">
        <select
          value={employmentType}
          onChange={(event) =>
            setEmploymentType(event.target.value as "primary" | "part_time")
          }
          className={inputClass}
        >
          <option value="primary">Основное</option>
          <option value="part_time">Совместительство</option>
        </select>
      </Field>
      <Field label="Табельный номер" hint="Кадровый номер в этом юридическом лице">
        <input
          value={personnelNumber}
          onChange={(event) => setPersonnelNumber(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Ставка" hint="Число больше 0 и не больше 1. Пустое поле оставляет ставку незаполненной">
        <input
          value={workFraction}
          onChange={(event) => setWorkFraction(event.target.value)}
          inputMode="decimal"
          className={inputClass}
        />
        {!fractionValid && (
          <p className="mt-1 text-xs text-red-400">Ставка должна быть больше 0 и не больше 1</p>
        )}
      </Field>
      <Field label="Дата начала" required hint="Дата начала работы в этом юридическом лице">
        <DateInput value={startedOn} onChange={setStartedOn} className={inputClass} />
      </Field>
    </DictFormModal>
  );
}

function Toolbar({
  addLabel,
  addHint,
  onAdd,
  addDisabled = false,
  includeInactive,
  onIncludeInactive,
}: {
  addLabel: string;
  addHint: string;
  onAdd: () => void;
  addDisabled?: boolean;
  includeInactive: boolean;
  onIncludeInactive: (value: boolean) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-4">
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={includeInactive}
          onChange={(event) => onIncludeInactive(event.target.checked)}
          data-hint="Показывает деактивированные записи вместе с действующими"
        />
        Показать неактивные
      </label>
      <button
        type="button"
        onClick={onAdd}
        disabled={addDisabled}
        data-hint={addHint}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus size={16} />
        {addLabel}
      </button>
    </div>
  );
}

function InactiveLabel({ name, active }: { name: string; active: boolean }) {
  return (
    <span>
      {name}
      {!active && <span className="ml-2 text-xs text-gray-400">Неактивно</span>}
    </span>
  );
}

function PositionEmployees({
  assignments,
  onEdit,
  onAdd,
}: {
  assignments: AccountingAssignment[];
  onEdit: (assignment: AccountingAssignment) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      {assignments.map((assignment) => (
        <button
          key={assignment.id}
          type="button"
          onClick={onEdit.bind(null, assignment)}
          data-hint="Меняет начальника и остальные поля этого учётного назначения"
          className="text-left text-blue-600 hover:underline dark:text-blue-400"
        >
          {assignment.employee_full_name || "Сотрудник"}
          {assignment.is_manager ? " · начальник" : ""}
          {assignment.manager_full_name ? ` · нач. ${assignment.manager_full_name}` : ""}
        </button>
      ))}
      <button
        type="button"
        onClick={onAdd}
        data-hint="Привязывает сотрудника из справочника HR к этой должности и выбирает начальника"
        className="text-left text-sm font-medium text-gray-700 hover:text-blue-700 dark:text-gray-200 dark:hover:text-blue-300"
      >
        Привязать сотрудника
      </button>
    </div>
  );
}

function PositionAssignmentForm({
  state,
  legalEntityId,
  managers,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  state:
    | { mode: "create"; position: LegalPosition }
    | { mode: "edit"; assignment: AccountingAssignment };
  legalEntityId: number;
  managers: AccountingAssignment[];
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (body: AccountingAssignmentReq) => void;
}) {
  const isEdit = state.mode === "edit";
  const assignment = state.mode === "edit" ? state.assignment : null;
  const positionId = state.mode === "edit" ? state.assignment.legal_position_id : state.position.id;
  const positionName =
    state.mode === "edit"
      ? state.assignment.legal_position_name || "Должность"
      : state.position.name;
  const [employeeId, setEmployeeId] = useState<number | null>(assignment?.employee_id ?? null);
  const [categoryId, setCategoryId] = useState(assignment ? String(assignment.category_id) : "");
  const [managerAssignmentId, setManagerAssignmentId] = useState(
    assignment?.manager_assignment_id ? String(assignment.manager_assignment_id) : "",
  );
  const [employmentType, setEmploymentType] = useState<"primary" | "part_time">(
    assignment?.employment_type === "part_time" ? "part_time" : "primary",
  );
  const [personnelNumber, setPersonnelNumber] = useState(assignment?.personnel_number ?? "");
  const [workFraction, setWorkFraction] = useState(
    assignment?.work_fraction == null ? "1" : String(assignment.work_fraction),
  );
  const [startedOn, setStartedOn] = useState(calendarDate(assignment?.started_on));

  const employeesQuery = useQuery(dictQueries.employees);
  const categoriesQuery = useQuery({
    queryKey: ["hr", "employee-categories"] as const,
    queryFn: () =>
      hrAccountingApi.employeeCategories(false).then((res) => res.data ?? []),
  });

  const category = (categoriesQuery.data ?? []).find(
    (item) => item.id === Number(categoryId),
  );
  const keepsManagerFlag = assignment?.is_manager ?? false;
  const needsManager = !keepsManagerFlag && categoryNeedsManager(category);
  const managerOptions = managers.filter(
    (item) => item.id !== assignment?.id && item.employee_id !== employeeId,
  );
  const fraction = workFraction.trim() === "" ? null : Number(workFraction);
  const fractionValid = fraction === null || (fraction > 0 && fraction <= 1);
  const canSubmit = Boolean(
    employeeId &&
      categoryId &&
      startedOn &&
      fractionValid &&
      (!needsManager || managerAssignmentId),
  );

  return (
    <DictFormModal
      title={isEdit ? "Назначение сотрудника" : "Привязать сотрудника"}
      subtitle={positionName}
      panelClassName="max-w-lg"
      onClose={onClose}
      isPending={isPending}
      canSubmit={canSubmit}
      error={error}
      submitLabel={isEdit ? "Сохранить" : "Привязать"}
      pendingLabel={isEdit ? "Сохраняем…" : "Привязываем…"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit || employeeId === null) return;
        onSubmit({
          employee_id: employeeId,
          legal_entity_id: legalEntityId,
          legal_position_id: positionId,
          category_id: Number(categoryId),
          manager_assignment_id: keepsManagerFlag
            ? null
            : managerAssignmentId
              ? Number(managerAssignmentId)
              : null,
          employment_type: employmentType,
          personnel_number: personnelNumber.trim() || null,
          work_fraction: fraction,
          is_manager: keepsManagerFlag,
          started_on: startedOn,
          ended_on: calendarDate(assignment?.ended_on) || null,
          end_reason: assignment?.end_reason ?? null,
        });
      }}
    >
      <Field label="Сотрудник" required hint="Сотрудник из общего справочника HR">
        <EmployeeSelect
          employees={employeesQuery.data ?? []}
          value={employeeId}
          onChange={setEmployeeId}
          allowVacant={false}
          hint="Выбирает сотрудника из справочника HR"
          placeholder={employeesQuery.isPending ? "Загрузка…" : "Выберите сотрудника"}
          disabled={employeesQuery.isPending}
        />
      </Field>
      {keepsManagerFlag ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Это назначение начальника: своего начальника у него нет.
        </p>
      ) : (
        <Field
          label="Начальник"
          required={needsManager}
          hint="Передаётся assignment_id начальника в этом же юрлице, а не employee_id"
        >
          <select
            value={managerAssignmentId}
            onChange={(event) => setManagerAssignmentId(event.target.value)}
            className={inputClass}
          >
            <option value="">
              {needsManager ? "Выберите начальника" : "Без начальника"}
            </option>
            {managerAssignmentId &&
              !managerOptions.some((manager) => String(manager.id) === managerAssignmentId) && (
                <option value={managerAssignmentId}>
                  {assignment?.manager_full_name || "Текущий начальник"}
                </option>
              )}
            {managerOptions.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.employee_full_name || "Начальник"}
                {manager.legal_position_name ? ` — ${manager.legal_position_name}` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Категория" required hint="Для категории, где отпуск ведёт руководитель, начальник обязателен">
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className={inputClass}
        >
          <option value="">Выберите категорию</option>
          {(categoriesQuery.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Занятость" required hint="В другом юрлице у совместителя может быть другой начальник">
        <select
          value={employmentType}
          onChange={(event) =>
            setEmploymentType(event.target.value as "primary" | "part_time")
          }
          className={inputClass}
        >
          <option value="primary">Основное</option>
          <option value="part_time">Совместительство</option>
        </select>
      </Field>
      <Field label="Табельный номер" hint="Кадровый номер в этом юридическом лице">
        <input
          value={personnelNumber}
          onChange={(event) => setPersonnelNumber(event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Ставка" hint="Число больше 0 и не больше 1">
        <input
          value={workFraction}
          onChange={(event) => setWorkFraction(event.target.value)}
          inputMode="decimal"
          className={inputClass}
        />
        {!fractionValid && (
          <p className="mt-1 text-xs text-red-400">Ставка должна быть больше 0 и не больше 1</p>
        )}
      </Field>
      <Field label="Дата начала" required hint="Дата начала работы на этой должности">
        <DateInput value={startedOn} onChange={setStartedOn} className={inputClass} />
      </Field>
    </DictFormModal>
  );
}

function AccountingStructureView({ legalEntityId }: { legalEntityId: number }) {
  const structureQuery = useQuery({
    queryKey: ["hr", "accounting-structure", legalEntityId] as const,
    queryFn: () =>
      hrAccountingApi.structure(legalEntityId).then((res) => res.data),
  });
  const structure: AccountingStructure | undefined = structureQuery.data ?? undefined;
  const managers = structure?.managers ?? [];
  const unassigned = structure?.unassigned ?? [];

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Учётная структура
      </h2>
      {structureQuery.isPending && (
        <p className="text-sm text-gray-400">Загрузка…</p>
      )}
      {structureQuery.isError && (
        <p className="text-sm text-red-500">{formatApiError(structureQuery.error)}</p>
      )}
      {!structureQuery.isPending && !structureQuery.isError && (
        <div className="space-y-3">
          {managers.length === 0 && unassigned.length === 0 && (
            <p className="text-sm text-gray-400">Назначений пока нет</p>
          )}
          {managers.map((manager) => (
            <div
              key={manager.assignment_id}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {manager.full_name}
                <span className="ml-2 font-normal text-gray-500">{manager.position_name}</span>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {(manager.employees ?? []).length === 0 && (
                  <li className="text-gray-400">Подчинённых нет</li>
                )}
                {(manager.employees ?? []).map((employee) => (
                  <li key={employee.assignment_id}>
                    {employee.full_name}
                    <span className="ml-2 text-gray-400">{employee.position_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {unassigned.length > 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 dark:border-gray-600">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Без начальника
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {unassigned.map((employee) => (
                  <li key={employee.assignment_id}>
                    {employee.full_name}
                    <span className="ml-2 text-gray-400">{employee.position_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
