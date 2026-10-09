import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useForm,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { DictTable } from "#/components/settings/DictTable";
import {
  DictFormModal,
  Field,
  dictInputClass,
} from "#/components/settings/DictFormModal";
import { formatApiError } from "#/lib/apiError";
import { hrAccountingApi } from "#/services/api";
import type {
  LegalEntity,
  VacationNotificationSetting,
  VacationNotificationSettingReq,
} from "#/types/api";

const inputClass = `${dictInputClass} border-gray-200 dark:border-gray-700`;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SETTINGS_KEY = ["hr", "vacation-notification-settings"] as const;

const DEFAULT_FORM: FormValues = {
  first_notice_days: 14,
  repeat_interval_days: 1,
  notification_time: "09:00",
  timezone: "Europe/Moscow",
  is_active: true,
};

const PREFERRED_TIME_ZONES = [
  "Europe/Kaliningrad",
  "Europe/Moscow",
  "Europe/Samara",
  "Asia/Yekaterinburg",
  "Asia/Omsk",
  "Asia/Novosibirsk",
  "Asia/Krasnoyarsk",
  "Asia/Irkutsk",
  "Asia/Yakutsk",
  "Asia/Vladivostok",
  "Asia/Magadan",
  "Asia/Sakhalin",
  "Asia/Kamchatka",
  "UTC",
];

interface FormValues {
  first_notice_days: number;
  repeat_interval_days: number;
  notification_time: string;
  timezone: string;
  is_active: boolean;
}

interface NotificationRow {
  entityId: number;
  name: string;
  entityActive: boolean;
  setting: VacationNotificationSetting | null;
}

function supportedTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [...PREFERRED_TIME_ZONES];
  }
}

function isValidTimeZone(value: string): boolean {
  if (!value) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const zoneLabels = new Map<string, string>();

function zoneLabel(zone: string): string {
  const cached = zoneLabels.get(zone);
  if (cached) return cached;
  let label = zone;
  try {
    const offset = new Intl.DateTimeFormat("ru-RU", {
      timeZone: zone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    if (offset) label = `${zone} (${offset})`;
  } catch {
    label = zone;
  }
  zoneLabels.set(zone, label);
  return label;
}

function timeZoneGroups(current: string): { preferred: string[]; rest: string[] } {
  const supported = supportedTimeZones();
  const supportedSet = new Set(supported);
  const preferred = PREFERRED_TIME_ZONES.filter(
    (zone) => supportedSet.has(zone) || isValidTimeZone(zone),
  );
  const preferredSet = new Set(preferred);
  const rest = supported.filter((zone) => !preferredSet.has(zone));
  if (current && !preferredSet.has(current) && !rest.includes(current)) {
    rest.unshift(current);
  }
  return { preferred, rest };
}

function normalizeTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return value.trim();
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function asInt(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function isWholeNumber(value: unknown, min: number): boolean {
  if (typeof value === "number") return Number.isInteger(value) && value >= min;
  if (typeof value !== "string" || value.trim() === "") return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= min;
}

function toFormValues(setting: VacationNotificationSetting | null): FormValues {
  if (!setting) return { ...DEFAULT_FORM };
  return {
    first_notice_days: asInt(setting.first_notice_days, DEFAULT_FORM.first_notice_days),
    repeat_interval_days: asInt(
      setting.repeat_interval_days,
      DEFAULT_FORM.repeat_interval_days,
    ),
    notification_time: normalizeTime(setting.notification_time || DEFAULT_FORM.notification_time),
    timezone: setting.timezone || DEFAULT_FORM.timezone,
    is_active: setting.is_active,
  };
}

function toRequest(
  legalEntityId: number | null,
  values: FormValues,
): VacationNotificationSettingReq {
  return {
    legal_entity_id: legalEntityId,
    first_notice_days: asInt(values.first_notice_days, Number.NaN),
    repeat_interval_days: asInt(values.repeat_interval_days, Number.NaN),
    notification_time: normalizeTime(values.notification_time),
    timezone: values.timezone,
    is_active: values.is_active,
  };
}

function formatUpdated(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function useNotificationForm(setting: VacationNotificationSetting | null) {
  const form = useForm<FormValues>({
    mode: "onChange",
    defaultValues: toFormValues(setting),
  });
  const { trigger } = form;
  useEffect(() => {
    void trigger();
  }, [trigger]);
  return form;
}

function globalSettingOf(
  settings: VacationNotificationSetting[],
): VacationNotificationSetting | null {
  return settings.find((item) => item.legal_entity_id == null) ?? null;
}

function buildRows(
  entities: LegalEntity[],
  settings: VacationNotificationSetting[],
): NotificationRow[] {
  const byEntity = new Map<number, VacationNotificationSetting>();
  for (const setting of settings) {
    if (setting.legal_entity_id != null) byEntity.set(setting.legal_entity_id, setting);
  }

  const rows: NotificationRow[] = [];
  const known = new Set<number>();
  for (const entity of entities) {
    const setting = byEntity.get(entity.id) ?? null;
    if (!entity.is_active && !setting) continue;
    known.add(entity.id);
    rows.push({
      entityId: entity.id,
      name: entity.short_name,
      entityActive: entity.is_active,
      setting,
    });
  }

  for (const [entityId, setting] of byEntity) {
    if (known.has(entityId)) continue;
    rows.push({
      entityId,
      name: `Юрлицо #${entityId}`,
      entityActive: true,
      setting,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return rows;
}

function displayValue(
  row: NotificationRow,
  globalSetting: VacationNotificationSetting | null,
  pick: (setting: VacationNotificationSetting) => string,
): { text: string; inherited: boolean } {
  if (row.setting) return { text: pick(row.setting), inherited: false };
  if (globalSetting) return { text: pick(globalSetting), inherited: true };
  return { text: "—", inherited: false };
}

export function VacationNotificationSettings() {
  const settingsQuery = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () =>
      hrAccountingApi
        .vacationNotificationSettings()
        .then((res) => (Array.isArray(res.data) ? res.data : [])),
  });
  const entitiesQuery = useQuery({
    queryKey: ["hr", "legal-entities", true] as const,
    queryFn: () =>
      hrAccountingApi.legalEntities(true).then((res) => res.data ?? []),
  });

  const [editing, setEditing] = useState<NotificationRow | null>(null);
  const settings = settingsQuery.data ?? [];
  const globalSetting = globalSettingOf(settings);
  const rows = buildRows(entitiesQuery.data ?? [], settings);

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
        Общая настройка действует для юридических лиц, у которых нет своей.
        Своя настройка полностью заменяет общую. Если у юрлица уведомления
        выключены, они не отправляются и общая настройка для него не используется.
      </p>

      {settingsQuery.isPending && (
        <p className="text-sm text-gray-400">Загрузка настроек…</p>
      )}
      {settingsQuery.isError && (
        <p className="text-sm text-red-500 dark:text-red-400">
          {formatApiError(settingsQuery.error)}
        </p>
      )}
      {settingsQuery.isSuccess && (
        <>
          <GlobalNotificationForm setting={globalSetting} />
          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
              Настройки юрлиц
            </h2>
            <DictTable<NotificationRow>
              columns={[
                {
                  key: "name",
                  header: "Юрлицо",
                  render: (row) => (
                    <span>
                      {row.name}
                      {!row.entityActive && (
                        <span className="ml-2 text-xs text-gray-400">Неактивно</span>
                      )}
                    </span>
                  ),
                },
                {
                  key: "source",
                  header: "Настройка",
                  render: (row) => (row.setting ? "Своя" : globalSetting ? "Общая" : "Нет"),
                },
                {
                  key: "active",
                  header: "Уведомления",
                  render: (row) => (
                    <ActivityLabel row={row} globalSetting={globalSetting} />
                  ),
                },
                {
                  key: "first",
                  header: (
                    <span data-hint="За сколько дней до отпуска начать уведомлять">
                      Первое, дн.
                    </span>
                  ),
                  render: (row) => (
                    <InheritedValue
                      value={displayValue(row, globalSetting, (item) =>
                        String(item.first_notice_days),
                      )}
                    />
                  ),
                },
                {
                  key: "repeat",
                  header: (
                    <span data-hint="Через сколько дней повторять уведомление">
                      Повтор, дн.
                    </span>
                  ),
                  render: (row) => (
                    <InheritedValue
                      value={displayValue(row, globalSetting, (item) =>
                        String(item.repeat_interval_days),
                      )}
                    />
                  ),
                },
                {
                  key: "time",
                  header: "Время",
                  render: (row) => (
                    <InheritedValue
                      value={displayValue(row, globalSetting, (item) =>
                        normalizeTime(item.notification_time),
                      )}
                    />
                  ),
                },
                {
                  key: "zone",
                  header: "Часовой пояс",
                  render: (row) => (
                    <InheritedValue
                      value={displayValue(row, globalSetting, (item) => item.timezone)}
                    />
                  ),
                },
              ]}
              rows={rows}
              rowKey={(row) => row.entityId}
              onEdit={setEditing}
              editHint="Открывает свою настройку уведомлений этого юридического лица"
              isLoading={entitiesQuery.isPending}
              isError={entitiesQuery.isError}
              errorMessage={formatApiError(entitiesQuery.error)}
              emptyMessage="Юридических лиц пока нет"
            />
            <p className="mt-2 text-xs text-gray-400">
              Серым показаны значения общей настройки. После сохранения своей
              настройки юрлицо использует только её.
            </p>
          </section>
        </>
      )}

      {editing && (
        <EntityNotificationModal
          key={editing.entityId}
          row={editing}
          initial={editing.setting ?? globalSetting}
          hasOwn={editing.setting !== null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function InheritedValue({
  value,
}: {
  value: { text: string; inherited: boolean };
}) {
  return (
    <span className={value.inherited ? "text-gray-400 dark:text-gray-500" : undefined}>
      {value.text}
    </span>
  );
}

function ActivityLabel({
  row,
  globalSetting,
}: {
  row: NotificationRow;
  globalSetting: VacationNotificationSetting | null;
}) {
  const source = row.setting ?? globalSetting;
  if (!source) return <span>—</span>;
  if (source.is_active) {
    return (
      <span data-hint={row.setting ? undefined : "Как в общей настройке"}>
        Включены
      </span>
    );
  }
  return (
    <span
      className="text-amber-700 dark:text-amber-300"
      data-hint={
        row.setting
          ? "Уведомления этого юрлица выключены и не берутся из общей настройки"
          : "Выключены в общей настройке"
      }
    >
      Выключены
    </span>
  );
}

function GlobalNotificationForm({
  setting,
}: {
  setting: VacationNotificationSetting | null;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    watch,
    formState: { errors, isValid, isDirty },
  } = useNotificationForm(setting);
  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      hrAccountingApi.saveVacationNotificationSetting(toRequest(null, values)),
    onSuccess: () => {
      reset(getValues());
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });
  const updated = formatUpdated(setting?.updated_at);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Общая настройка
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          {setting
            ? `Действует для юрлиц без своей настройки${updated ? ` · обновлено ${updated}` : ""}`
            : "Ещё не сохранена. Ниже значения по умолчанию."}
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
      >
        <NotificationFields
          register={register}
          errors={errors}
          isActive={watch("is_active")}
          timezone={watch("timezone")}
          scope="global"
          hasOwn
        />
        <div className="flex flex-wrap items-center justify-end gap-3">
          {saveMutation.isError && (
            <p className="mr-auto text-sm text-red-500 dark:text-red-400">
              {formatApiError(saveMutation.error)}
            </p>
          )}
          {saveMutation.isSuccess && !isDirty && (
            <p className="text-sm text-green-600 dark:text-green-400">Сохранено</p>
          )}
          <button
            type="submit"
            disabled={!isValid || saveMutation.isPending}
            data-hint="Сохраняет общую настройку уведомлений об отпусках"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveMutation.isPending ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </section>
  );
}

function EntityNotificationModal({
  row,
  initial,
  hasOwn,
  onClose,
}: {
  row: NotificationRow;
  initial: VacationNotificationSetting | null;
  hasOwn: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useNotificationForm(initial);
  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      hrAccountingApi.saveVacationNotificationSetting(
        toRequest(row.entityId, values),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      onClose();
    },
  });

  return (
    <DictFormModal
      title={`Уведомления · ${row.name}`}
      subtitle={
        hasOwn
          ? "Своя настройка заменяет общую"
          : "Сейчас действует общая настройка"
      }
      panelClassName="max-w-lg"
      onClose={onClose}
      isPending={saveMutation.isPending}
      canSubmit={isValid}
      error={formatApiError(saveMutation.error)}
      submitLabel={hasOwn ? "Сохранить" : "Сохранить свою настройку"}
      onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
    >
      <NotificationFields
        register={register}
        errors={errors}
        isActive={watch("is_active")}
        timezone={watch("timezone")}
        scope="entity"
        hasOwn={hasOwn}
      />
    </DictFormModal>
  );
}

function NotificationFields({
  register,
  errors,
  isActive,
  timezone,
  scope,
  hasOwn,
}: {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  isActive: boolean;
  timezone: string;
  scope: "global" | "entity";
  hasOwn: boolean;
}) {
  const zones = timeZoneGroups(timezone || DEFAULT_FORM.timezone);
  const zoneOptions = (items: string[]) =>
    items.map((zone) => (
      <option key={zone} value={zone}>
        {zoneLabel(zone)}
      </option>
    ));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="За сколько дней до отпуска"
          required
          error={errors.first_notice_days?.message}
          hint="За сколько дней до начала отпуска отправить первое уведомление. 0 — в день начала"
        >
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className={inputClass}
            {...register("first_notice_days", {
              valueAsNumber: true,
              validate: (value) =>
                isWholeNumber(value, 0) || "Укажите целое число от 0",
            })}
          />
        </Field>
        <Field
          label="Повторять каждые, дней"
          required
          error={errors.repeat_interval_days?.message}
          hint="Через сколько дней повторять уведомление"
        >
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className={inputClass}
            {...register("repeat_interval_days", {
              valueAsNumber: true,
              validate: (value) =>
                isWholeNumber(value, 1) || "Укажите целое число от 1",
            })}
          />
        </Field>
        <Field
          label="Время отправки"
          required
          error={errors.notification_time?.message}
          hint="Время отправки в формате ЧЧ:ММ"
        >
          <input
            type="time"
            step={60}
            className={inputClass}
            {...register("notification_time", {
              required: "Укажите время",
              validate: (value) =>
                TIME_PATTERN.test(normalizeTime(value)) || "Время в формате ЧЧ:ММ",
            })}
          />
        </Field>
        <Field
          label="Часовой пояс"
          required
          error={errors.timezone?.message}
          hint="Часовой пояс, в котором считается время отправки"
        >
          <select
            className={inputClass}
            {...register("timezone", {
              validate: (value) =>
                isValidTimeZone(value) || "Выберите корректный часовой пояс",
            })}
          >
            {zones.rest.length > 0 ? (
              <>
                <optgroup label="Частые">{zoneOptions(zones.preferred)}</optgroup>
                <optgroup label="Другие">{zoneOptions(zones.rest)}</optgroup>
              </>
            ) : (
              zoneOptions(zones.preferred)
            )}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          data-hint={
            scope === "global"
              ? "Включает уведомления для юрлиц без своей настройки"
              : "Включает уведомления только для этого юридического лица"
          }
          {...register("is_active")}
        />
        Уведомления включены
      </label>
      {scope === "global" && !isActive && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Общие уведомления выключены. Их не получат юрлица без своей настройки.
          Юрлицо со своей включённой настройкой продолжит получать уведомления.
        </p>
      )}
      {scope === "entity" && !hasOwn && isActive && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          После сохранения это юрлицо перестанет использовать общую настройку.
        </p>
      )}
      {scope === "entity" && !isActive && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Уведомления для этого юрлица будут полностью отключены. Возврата к общей
          настройке не будет.
        </p>
      )}
    </>
  );
}
