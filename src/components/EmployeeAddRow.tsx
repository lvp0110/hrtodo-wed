import { useEffect, useState, useSyncExternalStore } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { dictInputClass } from "#/components/settings/DictFormModal";
import { DepartmentTreeSelect } from "#/components/DepartmentTreeSelect";
import { PrepareWorkplaceModal } from "#/components/PrepareWorkplaceModal";
import { GENDER_OPTIONS } from "#/lib/employeeDisplay";
import {
  isEmployeeVacancyFormComplete,
  type EmployeeVacancyCreateFields,
} from "#/lib/employeeUpdate";
import { officesApi } from "#/services/api";
import type { City, OrgNode } from "#/types/api";

const emptyDraft: EmployeeVacancyCreateFields = {
  surname: "",
  first_name: "",
  second_name: "",
  personal_number: "",
  work_number: "",
  email: "",
  gender: "",
  hireDate: "",
  cityCode: "",
  cityId: null,
  officeCode: "",
  officeId: null,
  nodeId: 0,
  position: "",
  isManager: false,
  comment: "",
  message: "",
};

const STORAGE_KEY = "hrtodo:employee-add-draft";

type EmployeeAddFormStore = {
  draft: EmployeeVacancyCreateFields;
  isExpanded: boolean;
};

function isDefaultWorkplaceMessage(message: string): boolean {
  const trimmed = message.trim();
  return (
    trimmed === "" ||
    trimmed ===
      "Добрый день, ...! Просьба подготовить рабочее место для нового сотрудника." ||
    trimmed ===
      "Добрый день ...! Просьба подготовить рабочее место для нового сотрудника."
  );
}

function isDraftEmpty(draft: EmployeeVacancyCreateFields): boolean {
  return (
    draft.surname === "" &&
    draft.first_name === "" &&
    draft.second_name === "" &&
    draft.personal_number === "" &&
    draft.work_number === "" &&
    draft.email === "" &&
    draft.gender === "" &&
    draft.hireDate === "" &&
    draft.cityCode === "" &&
    draft.cityId === null &&
    draft.officeCode === "" &&
    draft.officeId === null &&
    draft.nodeId === 0 &&
    draft.position === "" &&
    !draft.isManager &&
    draft.comment === "" &&
    isDefaultWorkplaceMessage(draft.message)
  );
}

function parseStoredDraft(raw: string | null): EmployeeAddFormStore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EmployeeAddFormStore>;
    if (!parsed || typeof parsed !== "object" || !parsed.draft) return null;
    const draft = { ...emptyDraft, ...parsed.draft };
    return {
      draft,
      isExpanded: Boolean(parsed.isExpanded) || !isDraftEmpty(draft),
    };
  } catch {
    return null;
  }
}

function readPersistedStore(): EmployeeAddFormStore {
  if (typeof window === "undefined") {
    return { draft: emptyDraft, isExpanded: false };
  }
  return (
    parseStoredDraft(window.localStorage.getItem(STORAGE_KEY)) ?? {
      draft: emptyDraft,
      isExpanded: false,
    }
  );
}

function writePersistedStore(state: EmployeeAddFormStore) {
  if (typeof window === "undefined") return;
  if (isDraftEmpty(state.draft) && !state.isExpanded) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let employeeAddStore: EmployeeAddFormStore = {
  draft: emptyDraft,
  isExpanded: false,
};
let employeeAddStoreHydrated = false;
const employeeAddStoreListeners = new Set<() => void>();

function ensureEmployeeAddStoreHydrated() {
  if (employeeAddStoreHydrated || typeof window === "undefined") return;
  employeeAddStore = readPersistedStore();
  employeeAddStoreHydrated = true;
}

function getEmployeeAddStoreSnapshot(): EmployeeAddFormStore {
  ensureEmployeeAddStoreHydrated();
  return employeeAddStore;
}

function getEmployeeAddStoreServerSnapshot(): EmployeeAddFormStore {
  return { draft: emptyDraft, isExpanded: false };
}

function subscribeEmployeeAddStore(listener: () => void) {
  employeeAddStoreListeners.add(listener);
  return () => {
    employeeAddStoreListeners.delete(listener);
  };
}

function setEmployeeAddStore(
  updater:
    | EmployeeAddFormStore
    | ((prev: EmployeeAddFormStore) => EmployeeAddFormStore),
) {
  ensureEmployeeAddStoreHydrated();
  const next = typeof updater === "function" ? updater(employeeAddStore) : updater;
  employeeAddStore = next;
  writePersistedStore(next);
  employeeAddStoreListeners.forEach((listener) => listener());
}

export function clearEmployeeAddDraft() {
  employeeAddStore = { draft: emptyDraft, isExpanded: false };
  employeeAddStoreHydrated = true;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  employeeAddStoreListeners.forEach((listener) => listener());
}

const compactInputClass = `${dictInputClass} min-w-0 px-2 py-1.5 text-xs`;
const fieldErrorClass = "mt-1 text-xs text-red-500 dark:text-red-400";
const invalidInputClass = "border-red-400 dark:border-red-500";

type FieldKey =
  | "surname"
  | "first_name"
  | "cityCode"
  | "officeCode"
  | "nodeId"
  | "position";

type FieldErrors = Partial<Record<FieldKey, string>>;

function hasEmployeeDraftData(draft: EmployeeVacancyCreateFields): boolean {
  return (
    Boolean(draft.surname.trim()) ||
    Boolean(draft.first_name.trim()) ||
    Boolean(draft.second_name.trim()) ||
    Boolean(draft.personal_number.trim()) ||
    Boolean(draft.work_number.trim()) ||
    Boolean(draft.email.trim()) ||
    Boolean(draft.gender) ||
    Boolean(draft.hireDate)
  );
}

function getRequiredFieldErrors(draft: EmployeeVacancyCreateFields): FieldErrors {
  const errors: FieldErrors = {};

  if (hasEmployeeDraftData(draft)) {
    if (!draft.surname.trim()) errors.surname = "Укажите фамилию";
    if (!draft.first_name.trim()) errors.first_name = "Укажите имя";
  }
  if (!draft.cityCode) errors.cityCode = "Выберите город";
  if (draft.cityCode && !draft.officeCode) errors.officeCode = "Выберите офис";
  if (!draft.nodeId) errors.nodeId = "Выберите отдел";
  if (!draft.position.trim()) errors.position = "Укажите должность";

  return errors;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className={fieldErrorClass}>{message}</p>;
}

function PrepareWorkplaceButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40"
    >
      Подготовить рабочее место
    </button>
  );
}

interface EmployeeAddSharedProps {
  cities: City[];
  orgNodes: OrgNode[];
  isPending: boolean;
  error: string | null;
  onSubmit: (data: EmployeeVacancyCreateFields) => void;
}

function useEmployeeAddForm({
  cities,
  isPending,
  error,
  onSubmit,
}: EmployeeAddSharedProps) {
  const { draft, isExpanded } = useSyncExternalStore(
    subscribeEmployeeAddStore,
    getEmployeeAddStoreSnapshot,
    getEmployeeAddStoreServerSnapshot,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const officesQuery = useQuery({
    queryKey: ["offices", "city", draft.cityId] as const,
    queryFn: () => officesApi.getByCity(draft.cityId!).then((res) => res.data ?? []),
    enabled: draft.cityId !== null,
  });

  useEffect(() => {
    if (
      draft.officeCode &&
      officesQuery.data &&
      !officesQuery.data.some((office) => office.code === draft.officeCode)
    ) {
      setEmployeeAddStore((prev) => ({
        ...prev,
        draft: { ...prev.draft, officeCode: "", officeId: null },
      }));
    }
  }, [draft.cityCode, draft.officeCode, officesQuery.data]);

  useEffect(() => {
    if (!showFieldErrors) return;
    setFieldErrors(getRequiredFieldErrors(draft));
  }, [draft, showFieldErrors]);

  const displayError = localError ?? error;
  const visibleFieldErrors = showFieldErrors ? fieldErrors : {};

  function setIsExpanded(value: boolean) {
    setEmployeeAddStore((prev) => ({ ...prev, isExpanded: value }));
  }

  function reset() {
    clearEmployeeAddDraft();
    setLocalError(null);
    setFieldErrors({});
    setShowFieldErrors(false);
  }

  function updateDraft<K extends keyof EmployeeVacancyCreateFields>(
    key: K,
    value: EmployeeVacancyCreateFields[K],
  ) {
    setEmployeeAddStore((prev) => ({
      ...prev,
      draft: { ...prev.draft, [key]: value },
    }));
    setLocalError(null);
  }

  function applyDraft(data: EmployeeVacancyCreateFields) {
    setEmployeeAddStore((prev) => ({ ...prev, draft: data }));
    setLocalError(null);
  }

  function handleCityChange(cityCode: string) {
    const city = cities.find((item) => item.code === cityCode);
    setEmployeeAddStore((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        cityCode,
        cityId: city?.id ?? null,
        officeCode: "",
        officeId: null,
      },
    }));
    setLocalError(null);
  }

  function handleOfficeChange(officeCode: string) {
    const office = officesQuery.data?.find((item) => item.code === officeCode);
    setEmployeeAddStore((prev) => ({
      ...prev,
      draft: {
        ...prev.draft,
        officeCode,
        officeId: office?.id ?? null,
      },
    }));
    setLocalError(null);
  }

  function revealValidation(nextDraft = draft): FieldErrors {
    const errors = getRequiredFieldErrors(nextDraft);
    setShowFieldErrors(true);
    setFieldErrors(errors);
    const firstError = Object.values(errors)[0];
    setLocalError(firstError ?? null);
    return errors;
  }

  function handleSubmit() {
    const errors = revealValidation();
    if (Object.keys(errors).length > 0) return;
    setLocalError(null);
    onSubmit(draft);
  }

  function handlePrepareWorkplace(): boolean {
    if (isEmployeeVacancyFormComplete(draft)) {
      setLocalError(null);
      setFieldErrors({});
      setShowFieldErrors(false);
      return true;
    }
    revealValidation();
    return false;
  }

  const officesDisabled =
    !draft.cityCode || officesQuery.isPending || officesQuery.isError;

  const prepareWorkplaceReady = isEmployeeVacancyFormComplete(draft);

  return {
    isExpanded,
    setIsExpanded,
    draft,
    displayError,
    fieldErrors: visibleFieldErrors,
    officesQuery,
    officesDisabled,
    prepareWorkplaceReady,
    reset,
    updateDraft,
    applyDraft,
    handleCityChange,
    handleOfficeChange,
    handleSubmit,
    handlePrepareWorkplace,
    isPending,
  };
}

function EmployeeNameFields({
  draft,
  updateDraft,
  fieldErrors,
}: {
  draft: EmployeeVacancyCreateFields;
  updateDraft: ReturnType<typeof useEmployeeAddForm>["updateDraft"];
  fieldErrors?: FieldErrors;
}) {
  return (
    <>
      <div>
        <input
          type="text"
          value={draft.surname}
          onChange={(e) => updateDraft("surname", e.target.value)}
          placeholder="Фамилия"
          className={`${compactInputClass} ${fieldErrors?.surname ? invalidInputClass : ""}`}
        />
        <FieldError message={fieldErrors?.surname} />
      </div>
      <div>
        <input
          type="text"
          value={draft.first_name}
          onChange={(e) => updateDraft("first_name", e.target.value)}
          placeholder="Имя"
          className={`${compactInputClass} ${fieldErrors?.first_name ? invalidInputClass : ""}`}
        />
        <FieldError message={fieldErrors?.first_name} />
      </div>
      <input
        type="text"
        value={draft.second_name}
        onChange={(e) => updateDraft("second_name", e.target.value)}
        placeholder="Отчество"
        className={compactInputClass}
      />
      <input
        type="tel"
        value={draft.personal_number}
        onChange={(e) => updateDraft("personal_number", e.target.value)}
        placeholder="Личный телефон"
        className={compactInputClass}
        autoComplete="tel"
      />
      <input
        type="tel"
        value={draft.work_number}
        onChange={(e) => updateDraft("work_number", e.target.value)}
        placeholder="Рабочий телефон"
        className={compactInputClass}
        autoComplete="tel"
      />
      <input
        type="email"
        value={draft.email}
        onChange={(e) => updateDraft("email", e.target.value)}
        placeholder="Эл. почта"
        className={compactInputClass}
        autoComplete="email"
      />
      <select
        value={draft.gender}
        onChange={(e) => updateDraft("gender", e.target.value)}
        className={compactInputClass}
      >
        {GENDER_OPTIONS.map((option) => (
          <option key={option.value || "unknown"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={draft.hireDate}
        onChange={(e) => updateDraft("hireDate", e.target.value)}
        className={compactInputClass}
        title="Дата устройства"
      />
    </>
  );
}

function EmployeeAddActions({
  displayError,
  isPending,
  onSubmit,
  onCancel,
  onPrepareWorkplace,
  prepareWorkplaceReady,
}: {
  displayError: string | null;
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onPrepareWorkplace?: () => void;
  prepareWorkplaceReady?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Создаём…" : "Создать"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        Отмена
      </button>
      {onPrepareWorkplace && (
        <PrepareWorkplaceButton
          onClick={onPrepareWorkplace}
          disabled={isPending || !prepareWorkplaceReady}
        />
      )}
      {displayError && (
        <p className="text-xs text-red-500 dark:text-red-400">{displayError}</p>
      )}
    </div>
  );
}

interface EmployeeAddRowProps extends EmployeeAddSharedProps {
  columnsCount: number;
}

export function EmployeeAddRow({
  columnsCount,
  cities,
  orgNodes,
  isPending,
  error,
  onSubmit,
}: EmployeeAddRowProps) {
  const form = useEmployeeAddForm({ cities, orgNodes, isPending, error, onSubmit });
  const [isPrepareModalOpen, setIsPrepareModalOpen] = useState(false);

  if (!form.isExpanded) {
    return (
      <tr
        className="cursor-pointer bg-white text-sm font-normal normal-case tracking-normal text-gray-400 transition-colors hover:bg-gray-50 hover:text-blue-600 dark:bg-gray-900 dark:text-gray-500 dark:hover:bg-gray-800/40 dark:hover:text-blue-400"
        onClick={() => form.setIsExpanded(true)}
      >
        <td colSpan={columnsCount} className="bg-white px-4 py-3 dark:bg-gray-900">
          <span className="inline-flex items-center gap-2">
            <Plus size={14} />
            Добавить сотрудника и вакансию
          </span>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="bg-blue-50 text-sm font-normal normal-case tracking-normal text-gray-700 dark:bg-blue-950/40 dark:text-gray-200">
        <td className="bg-blue-50 px-4 py-3 align-top dark:bg-blue-950/40" rowSpan={2} />
        <td className="bg-blue-50 px-4 py-3 align-top dark:bg-blue-950/40" rowSpan={2}>
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <EmployeeNameFields
              draft={form.draft}
              updateDraft={form.updateDraft}
              fieldErrors={form.fieldErrors}
            />
          </div>
        </td>
        <td className="bg-blue-50 px-4 py-3 align-top dark:bg-blue-950/40">
          <select
            value={form.draft.cityCode}
            onChange={(e) => form.handleCityChange(e.target.value)}
            className={`${compactInputClass} min-w-[120px] ${form.fieldErrors.cityCode ? invalidInputClass : ""}`}
          >
            <option value="">Город *</option>
            {cities.map((city) => (
              <option key={city.code} value={city.code}>
                {city.name}
              </option>
            ))}
          </select>
          <FieldError message={form.fieldErrors.cityCode} />
        </td>
        <td className="bg-blue-50 px-4 py-3 align-top dark:bg-blue-950/40">
          <select
            value={form.draft.officeCode}
            onChange={(e) => form.handleOfficeChange(e.target.value)}
            disabled={form.officesDisabled}
            className={`${compactInputClass} min-w-[120px] disabled:opacity-60 ${form.fieldErrors.officeCode ? invalidInputClass : ""}`}
          >
            <option value="">
              {!form.draft.cityCode
                ? "Сначала город"
                : form.officesQuery.isPending
                  ? "Загрузка…"
                  : "Офис *"}
            </option>
            {form.officesQuery.data?.map((office) => (
              <option key={office.id} value={office.code}>
                {office.name}
              </option>
            ))}
          </select>
          <FieldError message={form.fieldErrors.officeCode} />
        </td>
        <td className="bg-blue-50 px-4 py-3 align-top dark:bg-blue-950/40">
          <DepartmentTreeSelect
            variant="node"
            tree={orgNodes}
            value={form.draft.nodeId}
            onChange={(nodeId) => form.updateDraft("nodeId", nodeId)}
            placeholder="Отдел *"
            compact
            className={form.fieldErrors.nodeId ? "rounded-lg ring-2 ring-red-400" : ""}
          />
          <FieldError message={form.fieldErrors.nodeId} />
        </td>
        <td className="bg-blue-50 px-4 py-3 align-top dark:bg-blue-950/40">
          <div className="flex min-w-[140px] flex-col gap-1.5">
            <input
              type="text"
              value={form.draft.position}
              onChange={(e) => form.updateDraft("position", e.target.value)}
              placeholder="Должность *"
              className={`${compactInputClass} min-w-[140px] ${form.fieldErrors.position ? invalidInputClass : ""}`}
            />
            <FieldError message={form.fieldErrors.position} />
            <label className="inline-flex items-center gap-2 px-1 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.draft.isManager}
                onChange={(e) => form.updateDraft("isManager", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
              />
              <span>Руководящая должность</span>
            </label>
          </div>
        </td>
      </tr>
      <tr className="bg-blue-50 text-sm font-normal normal-case tracking-normal text-gray-700 dark:bg-blue-950/40 dark:text-gray-200">
        <td colSpan={4} className="bg-blue-50 px-4 pb-3 pt-0 align-top dark:bg-blue-950/40">
          <textarea
            value={form.draft.comment}
            onChange={(e) => form.updateDraft("comment", e.target.value)}
            placeholder="Комментарии"
            rows={3}
            className={`${compactInputClass} w-full resize-y`}
          />
        </td>
      </tr>
      <tr className="bg-blue-50 text-sm font-normal normal-case tracking-normal text-gray-700 dark:bg-blue-950/40 dark:text-gray-200">
        <td colSpan={columnsCount} className="bg-blue-50 px-4 pb-3 pt-0 dark:bg-blue-950/40">
          <EmployeeAddActions
            displayError={form.displayError}
            isPending={form.isPending}
            onSubmit={form.handleSubmit}
            onCancel={form.reset}
            prepareWorkplaceReady={form.prepareWorkplaceReady}
            onPrepareWorkplace={() => {
              if (form.handlePrepareWorkplace()) {
                setIsPrepareModalOpen(true);
              }
            }}
          />
        </td>
      </tr>
      {isPrepareModalOpen && (
        <PrepareWorkplaceModal
          initial={form.draft}
          cities={cities}
          orgNodes={orgNodes}
          onClose={() => setIsPrepareModalOpen(false)}
          onApply={(data) => form.applyDraft(data)}
          onMessageChange={(message) => form.updateDraft("message", message)}
        />
      )}
    </>
  );
}

export function EmployeeAddCard(props: EmployeeAddSharedProps) {
  const { cities, orgNodes } = props;
  const form = useEmployeeAddForm(props);
  const [isPrepareModalOpen, setIsPrepareModalOpen] = useState(false);

  if (!form.isExpanded) {
    return (
      <button
        type="button"
        onClick={() => form.setIsExpanded(true)}
        className="flex w-full items-center gap-2 bg-white px-4 py-3 text-left text-sm text-gray-400 transition-colors hover:bg-gray-50 hover:text-blue-600 dark:bg-gray-900 dark:text-gray-500 dark:hover:bg-gray-800/40 dark:hover:text-blue-400"
      >
        <Plus size={14} />
        Добавить сотрудника и вакансию
      </button>
    );
  }

  return (
    <div className="space-y-3 bg-blue-50 p-4 dark:bg-blue-950/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <EmployeeNameFields
            draft={form.draft}
            updateDraft={form.updateDraft}
            fieldErrors={form.fieldErrors}
          />
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <select
              value={form.draft.cityCode}
              onChange={(e) => form.handleCityChange(e.target.value)}
              className={`${compactInputClass} ${form.fieldErrors.cityCode ? invalidInputClass : ""}`}
            >
              <option value="">Город *</option>
              {cities.map((city) => (
                <option key={city.code} value={city.code}>
                  {city.name}
                </option>
              ))}
            </select>
            <FieldError message={form.fieldErrors.cityCode} />
          </div>
          <div>
            <select
              value={form.draft.officeCode}
              onChange={(e) => form.handleOfficeChange(e.target.value)}
              disabled={form.officesDisabled}
              className={`${compactInputClass} disabled:opacity-60 ${form.fieldErrors.officeCode ? invalidInputClass : ""}`}
            >
              <option value="">
                {!form.draft.cityCode
                  ? "Сначала город"
                  : form.officesQuery.isPending
                    ? "Загрузка…"
                    : "Офис *"}
              </option>
              {form.officesQuery.data?.map((office) => (
                <option key={office.id} value={office.code}>
                  {office.name}
                </option>
              ))}
            </select>
            <FieldError message={form.fieldErrors.officeCode} />
          </div>
          <div className="sm:col-span-2">
            <DepartmentTreeSelect
              variant="node"
              tree={orgNodes}
              value={form.draft.nodeId}
              onChange={(nodeId) => form.updateDraft("nodeId", nodeId)}
              placeholder="Отдел *"
              compact
              className={form.fieldErrors.nodeId ? "rounded-lg ring-2 ring-red-400" : ""}
            />
            <FieldError message={form.fieldErrors.nodeId} />
          </div>
          <div>
            <input
              type="text"
              value={form.draft.position}
              onChange={(e) => form.updateDraft("position", e.target.value)}
              placeholder="Должность *"
              className={`${compactInputClass} ${form.fieldErrors.position ? invalidInputClass : ""}`}
            />
            <FieldError message={form.fieldErrors.position} />
          </div>
          <label className="inline-flex items-center gap-2 px-1 text-xs text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.draft.isManager}
              onChange={(e) => form.updateDraft("isManager", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
            />
            <span>Руководящая должность</span>
          </label>
          <textarea
            value={form.draft.comment}
            onChange={(e) => form.updateDraft("comment", e.target.value)}
            placeholder="Комментарии"
            rows={3}
            className={`${compactInputClass} w-full resize-y sm:col-span-2`}
          />
        </div>
      </div>
      <EmployeeAddActions
        displayError={form.displayError}
        isPending={form.isPending}
        onSubmit={form.handleSubmit}
        onCancel={form.reset}
        prepareWorkplaceReady={form.prepareWorkplaceReady}
        onPrepareWorkplace={() => {
          if (form.handlePrepareWorkplace()) {
            setIsPrepareModalOpen(true);
          }
        }}
      />
      {isPrepareModalOpen && (
        <PrepareWorkplaceModal
          initial={form.draft}
          cities={cities}
          orgNodes={orgNodes}
          onClose={() => setIsPrepareModalOpen(false)}
          onApply={(data) => form.applyDraft(data)}
          onMessageChange={(message) => form.updateDraft("message", message)}
        />
      )}
    </div>
  );
}
