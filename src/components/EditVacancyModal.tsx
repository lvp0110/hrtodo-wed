import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueries, useQuery } from "@tanstack/react-query";
import { CloseButton } from "#/components/CloseButton";
import { DepartmentTreeSelect } from "#/components/DepartmentTreeSelect";
import { EmployeeSelect } from "#/components/EmployeeSelect";
import { dictQueries, officesApi, orgNodesApi } from "#/services/api";
import { findManagerForVacancy } from "#/lib/orgTree";
import {
  employeeVacancyConflictWarning,
  findEmployeeVacancyConflict,
} from "#/lib/vacancyValidation";
import type {
  EditVacancyFormFields,
  VacancyModalData,
} from "#/types/orgChart";
import type { City, Employer, OrgNode } from "#/types/api";

interface EditVacancyModalProps {
  data: VacancyModalData;
  onClose: () => void;
  onSubmit: (data: EditVacancyFormFields) => void;
  isPending?: boolean;
  error?: string | null;
}

const inputClass =
  "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export function EditVacancyModal({
  data,
  onClose,
  onSubmit,
  isPending = false,
  error = null,
}: EditVacancyModalProps) {
  const cities = useQuery(dictQueries.cities);
  const employees = useQuery(dictQueries.employees);
  const orgTree = useQuery({
    queryKey: ["orgTree"],
    queryFn: () => orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
  });
  const cityList = cities.data ?? [];
  const needsCityLookup = !data.cityCode && Boolean(data.officeCode);
  const officeByCityQueries = useQueries({
    queries: needsCityLookup
      ? cityList.map((city) => ({
          queryKey: ["offices", "city", city.id] as const,
          queryFn: () =>
            officesApi.getByCity(city.id).then((res) => res.data ?? []),
          staleTime: 60_000,
        }))
      : [],
  });
  const resolvedCity = useMemo(() => {
    if (!needsCityLookup) return null;
    const index = officeByCityQueries.findIndex((query) =>
      query.data?.some((office) => office.code === data.officeCode),
    );
    return index >= 0 ? (cityList[index] ?? null) : null;
  }, [needsCityLookup, officeByCityQueries, data.officeCode, cityList]);
  const modalData = useMemo<VacancyModalData>(() => {
    if (!resolvedCity) return data;
    return {
      ...data,
      city: data.city || resolvedCity.name,
      cityCode: data.cityCode || resolvedCity.code,
    };
  }, [data, resolvedCity]);
  const initialCityId =
    cityList.find((city) => city.code === modalData.cityCode)?.id ?? null;
  const initialOffices = useQuery({
    queryKey: ["offices", "city", initialCityId] as const,
    queryFn: () =>
      officesApi.getByCity(initialCityId!).then((res) => res.data ?? []),
    enabled: initialCityId !== null,
    staleTime: 60_000,
  });

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const cityLookupDone =
    !needsCityLookup ||
    (cities.isSuccess &&
      (cityList.length === 0 ||
        (officeByCityQueries.length === cityList.length &&
          officeByCityQueries.every((query) => query.isFetched))));
  const officesReady =
    initialCityId === null ||
    initialOffices.isSuccess ||
    initialOffices.isError;
  const dictsReady =
    cities.isSuccess &&
    employees.isSuccess &&
    orgTree.isSuccess &&
    cityLookupDone &&
    officesReady;
  const dictsError = cities.isError || employees.isError || orgTree.isError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <div className="shrink-0 px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Редактирование вакансии
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {data.deptName}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {dictsError && (
            <div className="px-6 py-8 text-sm text-red-500 dark:text-red-400">
              Не удалось загрузить справочники
            </div>
          )}

          {!dictsError && !dictsReady && (
            <div className="px-6 py-8 text-sm text-gray-400 dark:text-gray-500">
              Загрузка справочников…
            </div>
          )}

          {dictsReady && (
            <EditVacancyForm
              data={modalData}
              cities={cities.data}
              employees={employees.data}
              orgNodes={orgTree.data ?? []}
              onClose={onClose}
              onSubmit={onSubmit}
              isPending={isPending}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface EditVacancyFormProps {
  data: VacancyModalData;
  cities: City[];
  employees: Employer[];
  orgNodes: OrgNode[];
  onClose: () => void;
  onSubmit: (data: EditVacancyFormFields) => void;
  isPending: boolean;
  error: string | null;
}

function EditVacancyForm({
  data,
  cities,
  employees,
  orgNodes,
  onClose,
  onSubmit,
  isPending,
  error,
}: EditVacancyFormProps) {
  const employeeOptions = useMemo(() => {
    const activeEmployees = employees.filter(
      (employee) => employee.status !== "archived",
    );
    if (!data.employer?.id) return activeEmployees;
    const alreadyExists = activeEmployees.some(
      (employee) => employee.id === data.employer?.id,
    );
    if (alreadyExists) return activeEmployees;

    const [surname = "", first_name = "", second_name = ""] = data.employer.name.split(" ");
    return [
      ...activeEmployees,
      {
        id: data.employer.id,
        surname,
        first_name,
        second_name,
        email: data.employer.email ?? "",
      } as Employer,
    ];
  }, [employees, data.employer]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid },
  } = useForm<EditVacancyFormFields>({
    mode: "onChange",
    defaultValues: {
      position: data.position,
      cityCode: data.cityCode,
      officeCode: data.officeCode ?? "",
      nodeId: data.nodeId,
      userId: data.employer?.id ?? null,
      isManager: data.isManager,
      description: data.description,
      jobOffer: data.jobOffer,
    },
  });

  const cityCode = watch("cityCode");
  const nodeId = watch("nodeId");
  const position = watch("position");
  const userId = watch("userId");
  const isManager = watch("isManager");
  const [confirmedConflictKey, setConfirmedConflictKey] = useState<string | null>(
    null,
  );
  const assignmentConflict = useMemo(
    () =>
      findEmployeeVacancyConflict(
        orgNodes,
        data.id,
        nodeId,
        position,
        userId,
      ),
    [orgNodes, data.id, nodeId, position, userId],
  );
  const conflictKey = assignmentConflict
    ? `${assignmentConflict.vacancyId}:${nodeId}:${position.trim().toLowerCase()}:${userId}`
    : null;
  const confirming = conflictKey !== null && confirmedConflictKey === conflictKey;
  const assignmentWarning = assignmentConflict
    ? `${employeeVacancyConflictWarning(assignmentConflict)} ${
        confirming
          ? "Нажмите «Всё равно сохранить», чтобы отправить."
          : "Нажмите «Сохранить», чтобы подтвердить отправку."
      }`
    : null;
  const manager = useMemo(
    () => findManagerForVacancy(orgNodes, nodeId, data.id, isManager),
    [orgNodes, nodeId, data.id, isManager],
  );
  const selectedCityId = useMemo(
    () => cities.find((city) => city.code === cityCode)?.id ?? null,
    [cities, cityCode],
  );

  const officesQuery = useQuery({
    queryKey: ["offices", "city", selectedCityId] as const,
    queryFn: () => officesApi.getByCity(selectedCityId!).then((res) => res.data ?? []),
    enabled: selectedCityId !== null,
  });

  const officesDisabled = !cityCode || officesQuery.isPending || officesQuery.isError;
  const officeRestored = useRef(false);

  useEffect(() => {
    if (!officesQuery.isSuccess || !officesQuery.data) return;
    const currentOfficeCode = getValues("officeCode");
    const codes = new Set(officesQuery.data.map((office) => office.code));
    if (currentOfficeCode && !codes.has(currentOfficeCode)) {
      setValue("officeCode", "");
      return;
    }
    const initial = data.officeCode ?? "";
    if (
      !officeRestored.current &&
      !currentOfficeCode &&
      initial &&
      codes.has(initial) &&
      cityCode === data.cityCode
    ) {
      setValue("officeCode", initial);
    }
    if (cityCode === data.cityCode) officeRestored.current = true;
  }, [
    cityCode,
    data.cityCode,
    data.officeCode,
    officesQuery.isSuccess,
    officesQuery.data,
    setValue,
    getValues,
  ]);

  function handleFormSubmit(formData: EditVacancyFormFields) {
    if (conflictKey && confirmedConflictKey !== conflictKey) {
      setConfirmedConflictKey(conflictKey);
      return;
    }
    onSubmit(formData);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="px-6 py-5 space-y-4">
      <input
        type="hidden"
        {...register("nodeId", {
          validate: (value) => value > 0 || "Обязательное поле",
        })}
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Должность <span className="text-red-400">*</span>
        </label>
        <input
          {...register("position", { required: "Обязательное поле" })}
          placeholder="Например: Менеджер по продажам"
          className={`${inputClass} ${errors.position ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        />
        {errors.position && (
          <p className="mt-1 text-xs text-red-400">{errors.position.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Город <span className="text-red-400">*</span>
        </label>
        <select
          {...register("cityCode", { required: "Обязательное поле" })}
          className={`${inputClass} ${errors.cityCode ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        >
          <option value="" disabled hidden>
            Выберите город
          </option>
          {cities.map((city) => (
            <option key={city.code} value={city.code}>
              {city.name}
            </option>
          ))}
        </select>
        {errors.cityCode && (
          <p className="mt-1 text-xs text-red-400">{errors.cityCode.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Офис
        </label>
        <select
          {...register("officeCode")}
          disabled={officesDisabled}
          className={`${inputClass} border-gray-200 dark:border-gray-700 disabled:opacity-60`}
        >
          <option value="">
            {!cityCode
              ? "Сначала выберите город"
              : officesQuery.isPending
                ? "Загрузка…"
                : "— Без офиса —"}
          </option>
          {officesQuery.data?.map((office) => (
            <option key={office.id} value={office.code}>
              {office.name}
            </option>
          ))}
        </select>
        {officesQuery.isError && (
          <p className="mt-1 text-xs text-red-400">
            Не удалось загрузить список офисов
          </p>
        )}
        {cityCode && !watch("officeCode") && (
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Чтобы сохранить город, выберите офис в этом городе.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Отдел <span className="text-red-400">*</span>
        </label>
        <DepartmentTreeSelect
          variant="node"
          tree={orgNodes}
          value={nodeId}
          onChange={(value) =>
            setValue("nodeId", value, { shouldValidate: true })
          }
          placeholder="Выберите отдел"
          hint="Переносит вакансию в выбранный отдел"
          className={errors.nodeId ? "rounded-lg ring-2 ring-red-400" : ""}
        />
        {errors.nodeId && (
          <p className="mt-1 text-xs text-red-400">{errors.nodeId.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Сотрудник
        </label>
        <EmployeeSelect
          employees={employeeOptions}
          value={watch("userId")}
          onChange={(userId) => setValue("userId", userId, { shouldValidate: true })}
          hint="Назначает сотрудника на вакансию или оставляет её свободной"
        />
      </div>

      <div>
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Руководитель
        </div>
        {manager ? (
          <div className="text-sm text-gray-900 dark:text-gray-100">
            <div>{manager.name}</div>
            {manager.position && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {manager.position}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-500">Не указан</div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Описание вакансии
        </label>
        <textarea
          {...register("description")}
          rows={3}
          placeholder="Обязанности, требования, условия…"
          className={`${inputClass} border-gray-200 dark:border-gray-700 resize-y`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Предложение о работе
        </label>
        <textarea
          {...register("jobOffer")}
          rows={3}
          placeholder="Текст предложения о работе…"
          className={`${inputClass} border-gray-200 dark:border-gray-700 resize-y`}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          {...register("isManager")}
          type="checkbox"
          data-hint="Отмечает должность как руководящую"
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Руководящая должность
        </span>
      </label>

      {assignmentWarning && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {assignmentWarning}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          data-hint="Закрывает форму и не сохраняет изменения вакансии"
          disabled={isPending}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Отмена
        </button>
        <button
          type="submit"
          data-hint={
            confirming
              ? "Отправляет изменения, несмотря на совпадение назначения"
              : "Сохраняет изменения вакансии и сотрудника"
          }
          disabled={!isValid || isPending}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Сохраняем…" : confirming ? "Всё равно сохранить" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
