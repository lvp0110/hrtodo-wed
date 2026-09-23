import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { CloseButton } from "#/components/CloseButton";
import { selectableOrgNodeTypes } from "#/lib/orgNodeTypes";
import { flattenOrgNodes, relocateBlockReason } from "#/lib/orgTree";
import { dictQueries, orgNodesApi } from "#/services/api";
import type { DeptFields, DeptModalState } from "#/types/orgChart";

interface DeptModalProps {
  state: DeptModalState;
  onClose: () => void;
  onSubmit: (data: DeptFields) => void;
  isPending?: boolean;
  error?: string | null;
}

export function DeptModal({
  state,
  onClose,
  onSubmit,
  isPending = false,
  error = null,
}: DeptModalProps) {
  const isEdit = state.mode === "edit";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<DeptFields>({
    mode: "onChange",
    defaultValues: isEdit
      ? { name: state.name, type: state.type, code: state.code }
      : { name: "", type: "", code: "" },
  });

  const selectedType = watch("type");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [moveNodeId, setMoveNodeId] = useState<number | null>(null);
  const moveNodeIdRef = useRef<number | null>(null);
  moveNodeIdRef.current = moveNodeId;

  const destinationParentId =
    state.mode === "create" ? Number(state.parentId) : null;

  useEffect(() => {
    setCatalogQuery("");
    if (moveNodeIdRef.current == null) return;
    moveNodeIdRef.current = null;
    setMoveNodeId(null);
    setValue("name", "", { shouldValidate: true });
    setValue("code", "");
  }, [selectedType, setValue]);

  const nodeTypesQuery = useQuery(dictQueries.nodeTypes);
  const nodeTypeOptions = selectableOrgNodeTypes(
    nodeTypesQuery.data ?? [],
    isEdit ? state.type : undefined,
  );

  // Полное дерево: GET /orgnodes отдаёт только корень и прямых детей.
  const nodesQuery = useQuery({
    queryKey: ["orgTree"],
    queryFn: () =>
      orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
  });

  const selectedTypeName =
    nodeTypeOptions.find((t) => t.code === selectedType)?.name ?? "";

  const catalog = useMemo(() => {
    if (!selectedType) return [];
    const typeCode = selectedType.toLowerCase();
    const query = catalogQuery.trim().toLowerCase();
    return flattenOrgNodes(nodesQuery.data)
      .filter((node) => node.type.toLowerCase() === typeCode)
      .filter(
        (node) =>
          !query ||
          node.name.toLowerCase().includes(query) ||
          node.code.toLowerCase().includes(query),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [selectedType, catalogQuery, nodesQuery.data]);

  const nodeTypesDisabled =
    nodeTypesQuery.isPending ||
    nodeTypesQuery.isError ||
    nodeTypeOptions.length === 0;

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div className="mx-4 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isEdit ? "Редактировать отдел" : "Новый отдел"}
            </h2>
            <p className="mt-1 text-sm leading-snug text-gray-600 dark:text-gray-300">
              {isEdit ? state.name : `Родитель: ${state.parentLabel}`}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <form
          onSubmit={handleSubmit((data) =>
            onSubmit(
              moveNodeId != null ? { ...data, moveNodeId } : data,
            ),
          )}
          className="space-y-4 overflow-y-auto px-6 py-5"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Название <span className="text-red-400">*</span>
            </label>
            <input
              {...register("name", { required: "Обязательное поле" })}
              autoFocus
              autoComplete="off"
              readOnly={moveNodeId != null}
              placeholder="Например: Отдел маркетинга"
              className={`${inputClass} read-only:bg-gray-50 dark:read-only:bg-gray-800/60 ${errors.name ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {moveNodeId
                ? "Название выбранного подразделения. Повторный клик в списке снимает перенос."
                : "Можно ввести вручную или выбрать существующее подразделение из списка по типу"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Тип <span className="text-red-400">*</span>
            </label>
            <select
              {...register("type", { required: "Обязательное поле" })}
              disabled={nodeTypesDisabled || moveNodeId != null}
              className={`${inputClass} ${errors.type ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"} disabled:opacity-60`}
            >
              <option value="" disabled hidden>
                {nodeTypesQuery.isPending ? "Загрузка…" : "Выберите тип"}
              </option>
              {nodeTypeOptions.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="mt-1 text-xs text-red-400">{errors.type.message}</p>
            )}
            {nodeTypesQuery.isError && (
              <p className="mt-1 text-xs text-red-400">
                Не удалось загрузить список типов
              </p>
            )}
          </div>

          {state.mode === "create" && selectedType && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Список
                {selectedTypeName ? `: ${selectedTypeName}` : ""}
              </label>
              <input
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Поиск по названию или коду"
                aria-label="Поиск подразделения"
                className={`${inputClass} border-gray-200 dark:border-gray-700`}
              />
              <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                {nodesQuery.isPending ? (
                  <p className="px-3 py-2 text-sm text-gray-400">Загрузка…</p>
                ) : nodesQuery.isError ? (
                  <p className="px-3 py-2 text-sm text-red-400">
                    Не удалось загрузить список
                  </p>
                ) : catalog.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-400">
                    {catalogQuery.trim()
                      ? "Ничего не найдено"
                      : "Нет подразделений этого типа"}
                  </p>
                ) : (
                  catalog.map((node) => {
                    const blockReason =
                      destinationParentId == null
                        ? null
                        : relocateBlockReason(
                            nodesQuery.data ?? [],
                            node.id,
                            destinationParentId,
                          );
                    const selected = moveNodeId === node.id;
                    return (
                      <button
                        key={node.id}
                        type="button"
                        disabled={blockReason != null}
                        title={blockReason ?? undefined}
                        aria-pressed={selected}
                        onClick={() => {
                          if (selected) {
                            setMoveNodeId(null);
                            setValue("name", "", { shouldValidate: true });
                            setValue("code", "");
                            return;
                          }
                          setMoveNodeId(node.id);
                          setValue("name", node.name, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          setValue("code", node.code, { shouldDirty: true });
                        }}
                        className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:text-gray-300 dark:disabled:text-gray-600 ${
                          selected
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {node.name}
                        </span>
                        {node.code && (
                          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                            {node.code}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Выбор из списка переносит подразделение сюда вместе с
                вложенными узлами и вакансиями и убирает его у прежнего
                родителя.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Код (сокращенно, латинскими буквами)
            </label>
            <input
              {...register("code")}
              readOnly={moveNodeId != null}
              placeholder="Например: MKT"
              className={`${inputClass} border-gray-200 dark:border-gray-700 read-only:bg-gray-50 dark:read-only:bg-gray-800/60`}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!isValid || isPending || nodeTypesDisabled}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending
                ? isEdit
                  ? "Сохраняем…"
                  : moveNodeId
                    ? "Переносим…"
                    : "Создаём…"
                : isEdit
                  ? "Сохранить"
                  : moveNodeId
                    ? "Перенести"
                    : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
