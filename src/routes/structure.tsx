import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { selectableOrgNodeTypes } from "#/lib/orgNodeTypes";
import { toEmployeeUpdateReq } from "#/lib/employeeUpdate";
import { createEmployeeVacancy } from "#/lib/createEmployeeVacancy";
import {
  employeeFromReports,
  toVacancyModalData,
  withReportVacancyFields,
} from "#/lib/vacancyModalData";
import { toVacancyUpdateReq } from "#/lib/vacancyUpdate";
import {
  dictQueries,
  employeeReportQuery,
  employeesApi,
  officesApi,
  orgNodesApi,
  vacanciesApi,
} from "#/services/api";
import { ApiErrorModal } from "#/components/ApiErrorModal";
import { CommentHeadingIcon } from "#/components/CommentHeadingIcon";
import { PageDescription } from "#/components/PageHints";
import { EmployeeAddModal } from "#/components/EmployeeAddRow";
import { DeptModal } from "#/components/DeptModal";
import { EditVacancyModal } from "#/components/EditVacancyModal";
import { EmployeeInfoModal } from "#/components/EmployeeInfoModal";
import { dictInputClass } from "#/components/settings/DictFormModal";
import { formatApiError, formatVacancyError } from "#/lib/apiError";
import {
  employeeVacancyConflictWarning,
  existingPositionSlotWarning,
  findEmployeeVacancyConflict,
  findExistingPositionSlot,
} from "#/lib/vacancyValidation";
import type {
  AddVacancyState,
  DeptFields,
  DeptModalState,
  VacancyModalData,
} from "#/types/orgChart";
import type {
  City,
  EmployeeReportItem,
  Employer,
  EmptyVacancy,
  NodeCreateReq,
  NodeUpdateReq,
  OrgNode,
  OrgNodeType,
  Vacancy,
} from "#/types/api";

export const Route = createFileRoute("/structure")({
  component: StructurePage,
});

/** Раскрытые отделы текущей вкладки. Пустое значение — список свёрнут. */
const EXPANDED_STORAGE_KEY = "hrtodo:structure-expanded";

/** Размер названия узла уменьшается с уровнем подчинения. */
const NODE_TITLE_CLASS = [
  "text-[18px] font-normal leading-6",
  "text-[16px] font-normal leading-5",
  "text-[15px] font-normal leading-5",
  "text-[13px] font-normal leading-5",
  "text-xs font-normal leading-5",
] as const;

function nodeTitleClass(depth: number): string {
  const index = Math.min(Math.max(depth, 0), NODE_TITLE_CLASS.length - 1);
  return NODE_TITLE_CLASS[index];
}

/** Внутренний отступ строки и ширина галочки. Вложенный блок начинается у галочки родителя. */
const NODE_ROW_PAD = 4;
const NODE_CHEVRON = 16;
const NODE_INDENT = NODE_ROW_PAD + NODE_CHEVRON;

function replaceNodeType(
  tree: OrgNode[],
  id: number,
  typeCode: string,
): OrgNode[] {
  return tree.map((node) => {
    if (node.id === id) return { ...node, type: typeCode };
    if (node.children?.length) {
      return { ...node, children: replaceNodeType(node.children, id, typeCode) };
    }
    return node;
  });
}

function isOpenVacancy(vacancy: Vacancy): boolean {
  return !vacancy.employer?.id;
}

function employerName(v: Vacancy): string {
  if (isOpenVacancy(v)) return "Вакантно";
  const { first_name, second_name, surname } = v.employer;
  return [surname, first_name, second_name].filter(Boolean).join(" ");
}

function isReplacementPosition(original: string, next: string): boolean {
  const trimmed = next.trim();
  return trimmed.length > 0 && trimmed.toLowerCase() !== original.trim().toLowerCase();
}

type TransferVacancyDraft = {
  position: string;
  cityCode: string;
  officeCode: string;
  description: string;
  jobOffer: string;
  isManager: boolean;
};

function transferDraftFromVacancy(
  vacancy: Vacancy,
  deptName: string,
  reports: Array<EmployeeReportItem[] | undefined>,
): TransferVacancyDraft {
  const data = withReportVacancyFields(
    toVacancyModalData(vacancy, deptName),
    reports,
  );
  return {
    position: data.position,
    cityCode: data.cityCode,
    officeCode: data.officeCode ?? "",
    description: data.description,
    jobOffer: data.jobOffer,
    isManager: data.isManager,
  };
}

function isNewVacancyDraft(
  original: TransferVacancyDraft,
  draft: TransferVacancyDraft,
): boolean {
  return (
    isReplacementPosition(original.position, draft.position) ||
    draft.cityCode !== original.cityCode ||
    draft.officeCode !== original.officeCode ||
    draft.description !== original.description ||
    draft.jobOffer !== original.jobOffer ||
    draft.isManager !== original.isManager
  );
}

/** Уникальные сотрудники отдела и всех вложенных отделов. */
function collectEmployeeTotals(nodes: OrgNode[]): Map<number, number> {
  const totals = new Map<number, number>();

  const walk = (node: OrgNode): Set<number> => {
    const ids = new Set<number>();
    for (const vacancy of node.vacancies ?? []) {
      const id = vacancy.employer?.id;
      if (id) ids.add(id);
    }
    for (const child of node.children ?? []) {
      for (const id of walk(child)) ids.add(id);
    }
    totals.set(node.id, ids.size);
    return ids;
  };

  for (const node of nodes) walk(node);
  return totals;
}

function CountBadge({
  count,
  label,
  className,
  showZero = false,
}: {
  count: number;
  label: string;
  className: string;
  showZero?: boolean;
}) {
  if (count <= 0 && !showZero) return null;
  return (
    <span
      title={label}
      data-hint={label}
      className={`rounded-full px-2 py-0.5 text-xs ${className}`}
    >
      {count}
    </span>
  );
}

function readExpandedIds(): Set<number> {
  try {
    const raw = sessionStorage.getItem(EXPANDED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is number => typeof id === "number"),
    );
  } catch {
    return new Set();
  }
}

function writeExpandedIds(ids: Set<number>) {
  try {
    if (ids.size === 0) {
      sessionStorage.removeItem(EXPANDED_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* приватный режим */
  }
}

function textIncludes(value: string | null | undefined, query: string): boolean {
  return (value ?? "").toLowerCase().includes(query);
}

function nodeTextMatches(node: OrgNode, query: string): boolean {
  return (
    textIncludes(node.name, query) ||
    textIncludes(node.code, query) ||
    textIncludes(node.type, query)
  );
}

function vacancyTextMatches(vacancy: Vacancy, query: string): boolean {
  const name = employerName(vacancy);
  const nameMatches =
    name === "Вакантно"
      ? query.length >= 4 && textIncludes(name, query)
      : textIncludes(name, query);
  return (
    textIncludes(vacancy.position?.name, query) ||
    textIncludes(vacancy.position?.code, query) ||
    nameMatches ||
    textIncludes(vacancy.employer?.email, query) ||
    textIncludes(vacancy.city?.name, query)
  );
}

function emptyVacancyTextMatches(vacancy: EmptyVacancy, query: string): boolean {
  return (
    textIncludes(vacancy.position?.name, query) ||
    textIncludes(vacancy.position?.code, query) ||
    textIncludes(vacancy.city?.name, query) ||
    (query.length >= 4 && textIncludes("Вакантно", query))
  );
}

function nodeHasOpenVacancy(node: OrgNode): boolean {
  return (
    (node.vacancies ?? []).some(isOpenVacancy) ||
    (node.empty_vacancy?.length ?? 0) > 0
  );
}

/** Оставляет отделы с вакансиями и их родителей, чтобы ветка осталась на месте. */
function filterDepartmentsWithVacancies(nodes: OrgNode[]): {
  nodes: OrgNode[];
  expandIds: Set<number>;
} {
  const expandIds = new Set<number>();

  const walk = (list: OrgNode[]): OrgNode[] => {
    const result: OrgNode[] = [];
    for (const node of list) {
      const children = walk(node.children ?? []);
      if (!nodeHasOpenVacancy(node) && children.length === 0) continue;
      expandIds.add(node.id);
      result.push({ ...node, children });
    }
    return result;
  };

  return { nodes: walk(nodes), expandIds };
}

/** Оставляет ветки с совпадением и id узлов, которые нужно раскрыть, чтобы совпадения были видны. */
function filterStructureTree(
  nodes: OrgNode[],
  query: string,
): { nodes: OrgNode[]; expandIds: Set<number> } {
  const normalized = query.trim().toLowerCase();
  const expandIds = new Set<number>();
  if (!normalized) return { nodes, expandIds };

  const walk = (list: OrgNode[]): OrgNode[] => {
    const result: OrgNode[] = [];
    for (const node of list) {
      const selfMatches = nodeTextMatches(node, normalized);
      const children = walk(node.children ?? []);
      const vacancies = (node.vacancies ?? []).filter((vacancy) =>
        vacancyTextMatches(vacancy, normalized),
      );
      const emptyVacancy = (node.empty_vacancy ?? []).filter((vacancy) =>
        emptyVacancyTextMatches(vacancy, normalized),
      );
      const hasInnerMatch =
        children.length > 0 ||
        vacancies.length > 0 ||
        emptyVacancy.length > 0;

      if (!selfMatches && !hasInnerMatch) continue;
      if (hasInnerMatch) expandIds.add(node.id);

      result.push(
        selfMatches
          ? node
          : { ...node, children, vacancies, empty_vacancy: emptyVacancy },
      );
    }
    return result;
  };

  return { nodes: walk(nodes), expandIds };
}

function collectAllNodeIds(nodes: OrgNode[], acc: Set<number>) {
  for (const node of nodes) {
    acc.add(node.id);
    if (node.children?.length) collectAllNodeIds(node.children, acc);
  }
}

function findNodeById(nodes: OrgNode[], id: number): OrgNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = n.children && findNodeById(n.children, id);
    if (found) return found;
  }
  return undefined;
}

function findVacancyById(nodes: OrgNode[], id: number): Vacancy | undefined {
  for (const node of nodes) {
    const found = node.vacancies?.find((vacancy) => vacancy.id === id);
    if (found) return found;
    const nested = node.children && findVacancyById(node.children, id);
    if (nested) return nested;
  }
  return undefined;
}

/** `id` — потомок `ancestorId` в дереве (для запрета переноса в свою ветку). */
function isDescendantOf(
  nodes: OrgNode[],
  ancestorId: number,
  id: number,
): boolean {
  const ancestor = findNodeById(nodes, ancestorId);
  const stack: OrgNode[] = [...(ancestor?.children ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === id) return true;
    if (n.children) stack.push(...n.children);
  }
  return false;
}

interface TreeContext {
  expanded: Set<number>;
  toggle: (id: number) => void;
  busy: boolean;
  draggingId: number | null;
  dropTargetId: number | null;
  canDrop: (targetId: number) => boolean;
  onRowPointerDown: (
    id: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  draggingVacancyId: number | null;
  onVacancyPointerDown: (
    vacancy: Vacancy,
    deptName: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  takeSuppressedClick: () => boolean;
  onHoverTarget: (id: number) => void;
  onLeaveTarget: (id: number) => void;
  onDrop: (targetId: number) => void;
  onDeleteNode: (node: OrgNode) => void;
  onEditDept: (node: OrgNode) => void;
  onDeleteVacancy: (v: Vacancy) => void;
  onEditEmployee: (employee: Employer) => void;
  onEditVacancy: (vacancy: Vacancy, deptName: string) => void;
  onAddDept: (node: OrgNode) => void;
  onAddVacancy: (node: OrgNode) => void;
  typeMenuNodeId: number | null;
  typePending: boolean;
  nodeTypes: OrgNodeType[];
  nodeTypesPending: boolean;
  nodeTypesError: boolean;
  onToggleTypeMenu: (id: number) => void;
  onCloseTypeMenu: () => void;
  onChangeType: (node: OrgNode, typeCode: string) => void;
  showVacancies: boolean;
  pinnedOpenVacancyIds: Set<number>;
  employeeTotals: Map<number, number>;
}

function isVacancyVisible(vacancy: Vacancy, ctx: TreeContext): boolean {
  if (!isOpenVacancy(vacancy)) return true;
  return ctx.showVacancies || ctx.pinnedOpenVacancyIds.has(vacancy.id);
}

function VacancyRow({
  vacancy,
  depth,
  deptName,
  ctx,
}: {
  vacancy: Vacancy;
  depth: number;
  deptName: string;
  ctx: TreeContext;
}) {
  const filled = !!vacancy.employer?.id;
  const position = vacancy.position?.name ?? vacancy.position?.code ?? "—";
  const isDragging = ctx.draggingVacancyId === vacancy.id;
  const linkClass =
    "min-w-0 truncate border-0 bg-transparent p-0 text-left text-blue-600 hover:underline dark:text-blue-400";
  return (
    <div
      onPointerDown={(e) => {
        if (!filled) return;
        if (
          e.pointerType === "mouse" ||
          (e.target as HTMLElement).closest("[data-drag-handle]")
        ) {
          ctx.onVacancyPointerDown(vacancy, deptName, e);
        }
      }}
      onClickCapture={(e) => {
        if (!ctx.takeSuppressedClick()) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      className={`group flex items-center gap-2 rounded-md py-1.5 pr-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
        filled ? "select-none" : ""
      } ${isDragging ? "opacity-40" : ""}`}
      style={{ paddingLeft: depth * 20 + 28, paddingBottom: 10 }}
    >
      {filled && (
        <span
          data-drag-handle
          data-hint="Берёт сотрудника вместе с вакансией, чтобы перенести в другой отдел"
          className="inline-flex shrink-0"
        >
          <GripVertical
            size={14}
            className="cursor-grab text-gray-300 active:cursor-grabbing dark:text-gray-600"
          />
        </span>
      )}
      {vacancy.is_manager && (
        <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />
      )}
      <button
        type="button"
        onClick={() => ctx.onEditVacancy(vacancy, deptName)}
        data-hint="Открывает редактирование этой вакансии"
        className={linkClass}
      >
        {position}
      </button>
      <span className="text-gray-300 dark:text-gray-600">·</span>
      {filled ? (
        <button
          type="button"
          onClick={() => ctx.onEditEmployee(vacancy.employer)}
          data-hint="Открывает карточку сотрудника"
          className={`${linkClass} text-xs`}
        >
          {employerName(vacancy)}
        </button>
      ) : (
        <span className="truncate text-xs text-amber-500">Вакантно</span>
      )}
      {vacancy.city?.name && (
        <>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {vacancy.city.name}
          </span>
        </>
      )}
      {!filled && (
        <button
          type="button"
          title="Удалить вакансию"
          data-hint="Удаляет вакансию, на которую ещё не назначен сотрудник"
          disabled={ctx.busy}
          onClick={() => ctx.onDeleteVacancy(vacancy)}
          className="ml-auto shrink-0 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 disabled:opacity-30 group-hover:opacity-100 dark:hover:bg-red-500/10"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function EmptyVacancyRow({
  vacancy,
  depth,
}: {
  vacancy: EmptyVacancy;
  depth: number;
}) {
  return (
    <div
      className="flex items-center gap-2 py-1.5 pr-3 text-sm"
      style={{ paddingLeft: depth * 20 + 28 }}
    >
      <span className="truncate text-gray-700 dark:text-gray-300">
        {vacancy.position?.name ?? vacancy.position?.code ?? "—"}
      </span>
      <span className="text-gray-300 dark:text-gray-600">·</span>
      <span className="truncate text-xs text-amber-500">Вакантно</span>
      {vacancy.city?.name && (
        <>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {vacancy.city.name}
          </span>
        </>
      )}
    </div>
  );
}

function NodeTypeControl({
  node,
  ctx,
}: {
  node: OrgNode;
  ctx: TreeContext;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const onCloseRef = useRef(ctx.onCloseTypeMenu);
  onCloseRef.current = ctx.onCloseTypeMenu;
  const open = ctx.typeMenuNodeId === node.id;
  const options = selectableOrgNodeTypes(ctx.nodeTypes, node.type);
  const typeLabel =
    ctx.nodeTypes.find(
      (type) => type.code.toUpperCase() === node.type.toUpperCase(),
    )?.name ?? node.type;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onCloseRef.current();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <span ref={rootRef} data-node-type className="relative shrink-0">
      <button
        type="button"
        title="Изменить тип"
        data-hint="Открывает список, чтобы сменить тип отдела"
        disabled={ctx.typePending}
        onClick={(e) => {
          e.stopPropagation();
          ctx.onToggleTypeMenu(node.id);
        }}
        className="border-0 bg-transparent p-0 text-[length:var(--tsrd-font-size)] font-medium uppercase tracking-wide text-blue-600 hover:opacity-60 disabled:opacity-50 dark:text-blue-400"
      >
        {typeLabel}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Типы узлов"
          className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
            Типы узлов
          </p>
          <div className="max-h-60 overflow-y-auto py-1">
            {ctx.nodeTypesPending ? (
              <p className="px-3 py-2 text-sm text-gray-400">Загрузка…</p>
            ) : ctx.nodeTypesError ? (
              <p className="px-3 py-2 text-sm text-red-400">
                Не удалось загрузить список типов
              </p>
            ) : options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">Нет типов</p>
            ) : (
              options.map((type) => {
                const selected =
                  type.code.toUpperCase() === node.type.toUpperCase();
                return (
                  <button
                    key={type.code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-hint="Меняет тип отдела на выбранный"
                    disabled={ctx.typePending}
                    onClick={() => ctx.onChangeType(node, type.code)}
                    className={`block w-full truncate px-3 py-2 text-left text-sm disabled:opacity-50 ${
                      selected
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    {type.name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </span>
  );
}

function TreeNode({
  node,
  depth,
  ctx,
}: {
  node: OrgNode;
  depth: number;
  ctx: TreeContext;
}) {
  const departmentCount = node.children?.length ?? 0;
  const vacancies = node.vacancies ?? [];
  const emptyVacancyCount =
    vacancies.filter(isOpenVacancy).length + (node.empty_vacancy?.length ?? 0);
  const isOpen = ctx.expanded.has(node.id);
  const isDragging = ctx.draggingId === node.id;
  const isDropTarget = ctx.dropTargetId === node.id;
  const addPadding = (depth + 1) * 20 + 28;

  const canAccept = ctx.canDrop(node.id);

  return (
    <div className={ctx.typeMenuNodeId === node.id ? "relative z-20" : undefined}>
      <div
        role="button"
        onPointerDown={(e) => {
          if (
            e.pointerType === "mouse" ||
            (e.target as HTMLElement).closest("[data-drag-handle]")
          ) {
            ctx.onRowPointerDown(node.id, e);
          }
        }}
        onClick={(e) => {
          if (ctx.takeSuppressedClick()) return;
          if ((e.target as HTMLElement).closest("[data-node-toggle]")) {
            ctx.toggle(node.id);
            return;
          }
          if (canAccept) {
            ctx.onDrop(node.id);
            return;
          }
          ctx.toggle(node.id);
        }}
        onMouseEnter={() => {
          if (canAccept) ctx.onHoverTarget(node.id);
        }}
        onMouseLeave={(e) => {
          const next = e.relatedTarget;
          if (next instanceof Node && e.currentTarget.contains(next)) return;
          ctx.onLeaveTarget(node.id);
        }}
        onDragOver={(e) => {
          if (!canAccept) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          ctx.onHoverTarget(node.id);
        }}
        onDragLeave={(e) => {
          const next = e.relatedTarget;
          if (next instanceof Node && e.currentTarget.contains(next)) return;
          ctx.onLeaveTarget(node.id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (canAccept) ctx.onDrop(node.id);
        }}
        data-hint="Раскрывает или сворачивает отдел. Во время переноса вставляет сюда переносимый отдел или сотрудника"
        className={`group flex select-none items-center gap-2 rounded-md border border-solid border-[#7198bb] py-2 pr-3 pl-1 transition-colors ${
          canAccept ? "cursor-copy" : "cursor-pointer"
        } ${isDragging ? "opacity-40" : ""} ${
          isDropTarget
            ? "bg-blue-50 ring-2 ring-blue-400 dark:bg-blue-500/10"
            : "hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
        style={{ marginLeft: depth * NODE_INDENT }}
      >
        <span
          data-node-toggle
          className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-400"
        >
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span
          data-drag-handle
          data-hint="Берёт отдел, чтобы перенести его к другому родителю"
          className="inline-flex shrink-0"
        >
          <GripVertical
            size={14}
            className="cursor-grab text-gray-300 active:cursor-grabbing dark:text-gray-600"
          />
        </span>
        <NodeTypeControl node={node} ctx={ctx} />
        <span
          className={`truncate text-gray-900 dark:text-gray-100 ${nodeTitleClass(depth)}`}
        >
          {node.name}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <CountBadge
            count={departmentCount}
            label="Общее количество отделов"
            className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          />
          <CountBadge
            count={ctx.employeeTotals.get(node.id) ?? 0}
            label="Общее количество сотрудников"
            className="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
          />
          {isOpen && ctx.showVacancies && (
            <CountBadge
              count={emptyVacancyCount}
              label="Количество пустых вакансий"
              className="bg-amber-500/10 text-amber-500"
            />
          )}
          <button
            type="button"
            title="Редактировать отдел"
            aria-label="Редактировать отдел"
            data-hint="Открывает редактирование отдела"
            disabled={ctx.busy}
            onClick={(e) => {
              e.stopPropagation();
              ctx.onEditDept(node);
            }}
            className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            title="Удалить отдел со всем содержимым"
            data-hint="Удаляет отдел вместе с вложенными отделами и вакансиями"
            disabled={ctx.busy}
            onClick={(e) => {
              e.stopPropagation();
              ctx.onDeleteNode(node);
            }}
            className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 disabled:opacity-30 group-hover:opacity-100 dark:hover:bg-red-500/10"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div>
          {(node.vacancies ?? [])
            .filter((vacancy) => isVacancyVisible(vacancy, ctx))
            .map((v, i) => (
              <VacancyRow
                key={`v-${v.id}-${i}`}
                vacancy={v}
                depth={depth + 1}
                deptName={node.name}
                ctx={ctx}
              />
            ))}
          {ctx.showVacancies &&
            (node.empty_vacancy ?? []).map((v, i) => (
              <EmptyVacancyRow key={`e-${i}`} vacancy={v} depth={depth + 1} />
            ))}
          {(node.children ?? []).map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} ctx={ctx} />
          ))}
          <div
            className="flex items-center gap-4"
            style={{ paddingLeft: addPadding }}
          >
            <button
              type="button"
              onClick={() => ctx.onAddDept(node)}
              data-hint="Открывает форму нового отдела внутри этого"
              className="flex items-center gap-1 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
            >
              <Plus size={13} /> Добавить отдел
            </button>
            <button
              type="button"
              onClick={() => ctx.onAddVacancy(node)}
              data-hint="Открывает форму новой вакансии в этом отделе"
              className="flex items-center gap-1 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
            >
              <Plus size={13} /> Добавить вакансию
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HeldNodeCard({
  node,
  typeLabel,
  onCancel,
  onDragFinished,
}: {
  node: OrgNode;
  typeLabel: string;
  onCancel: () => void;
  onDragFinished: () => void;
}) {
  return (
    <aside
      aria-label="Переносимый отдел"
      className="sticky top-6 rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Перенос отдела
        </p>
        <button
          type="button"
          title="Отменить перенос"
          data-hint="Возвращает отдел на место и отменяет перенос"
          onClick={onCancel}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <X size={14} />
        </button>
      </div>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(node.id));
        }}
        onDragEnd={onDragFinished}
        data-hint="Перетаскивает отдел на нового родителя"
        className="flex cursor-grab items-center gap-2 rounded-md border border-solid border-[#7198bb] py-2 pr-3 pl-2 active:cursor-grabbing"
      >
        <GripVertical
          size={14}
          className="shrink-0 text-gray-300 dark:text-gray-600"
        />
        <span className="shrink-0 text-[length:var(--tsrd-font-size)] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {typeLabel}
        </span>
        <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {node.name}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Список можно прокручивать и искать. Нажмите нужный отдел или
        перетащите эту карточку на него.
      </p>
    </aside>
  );
}

function HeldVacancyCard({
  vacancy,
  deptName,
  draft,
  original,
  cities,
  notice,
  onDraftChange,
  onCancel,
  onDragFinished,
}: {
  vacancy: Vacancy;
  deptName: string;
  draft: TransferVacancyDraft;
  original: TransferVacancyDraft;
  cities: City[];
  notice: string | null;
  onDraftChange: (draft: TransferVacancyDraft) => void;
  onCancel: () => void;
  onDragFinished: () => void;
}) {
  const changed = isNewVacancyDraft(original, draft);
  const shownPosition = draft.position.trim() || original.position || "—";
  const selectedCityId =
    cities.find((city) => city.code === draft.cityCode)?.id ?? null;
  const officesQuery = useQuery({
    queryKey: ["offices", "city", selectedCityId] as const,
    queryFn: () =>
      officesApi.getByCity(selectedCityId!).then((res) => res.data ?? []),
    enabled: selectedCityId !== null,
  });
  const fieldLabel =
    "mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400";
  const fieldInput = `${dictInputClass} border-gray-200 px-2 py-1.5 dark:border-gray-700`;

  useEffect(() => {
    if (!officesQuery.isSuccess || !draft.officeCode) return;
    const stillThere = officesQuery.data?.some(
      (office) => office.code === draft.officeCode,
    );
    if (stillThere) return;
    onDraftChange({ ...draft, officeCode: "" });
  }, [
    officesQuery.isSuccess,
    officesQuery.data,
    draft.officeCode,
    draft.cityCode,
    draft,
    onDraftChange,
  ]);

  return (
    <aside
      aria-label="Переносимый сотрудник"
      className="sticky top-6 max-h-[calc(100dvh-4.5rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      onKeyDown={(event) => {
        const target = event.target;
        if (
          event.key === "Escape" &&
          target instanceof HTMLElement &&
          target.closest("input, select, textarea")
        ) {
          event.stopPropagation();
        }
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Перенос сотрудника
        </p>
        <button
          type="button"
          title="Отменить перенос"
          data-hint="Возвращает сотрудника на место и отменяет перенос"
          onClick={onCancel}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <X size={14} />
        </button>
      </div>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(vacancy.id));
        }}
        onDragEnd={onDragFinished}
        data-hint="Перетаскивает сотрудника вместе с вакансией в другой отдел"
        className="flex cursor-grab items-center gap-2 rounded-md border border-solid border-[#7198bb] py-2 pr-3 pl-2 active:cursor-grabbing"
      >
        <GripVertical
          size={14}
          className="shrink-0 text-gray-300 dark:text-gray-600"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {employerName(vacancy)}
          </span>
          <span className="block truncate text-xs text-gray-400 dark:text-gray-500">
            {shownPosition}
          </span>
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Новая вакансия
        </p>
        <label className="block">
          <span className={fieldLabel}>
            Должность <span className="text-red-400">*</span>
          </span>
          <input
            value={draft.position}
            onChange={(event) =>
              onDraftChange({ ...draft, position: event.target.value })
            }
            aria-label="Должность новой вакансии"
            data-hint="Название вакансии, на которую перейдёт сотрудник"
            className={fieldInput}
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>
            Город <span className="text-red-400">*</span>
          </span>
          <select
            value={draft.cityCode}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                cityCode: event.target.value,
                officeCode:
                  event.target.value === draft.cityCode ? draft.officeCode : "",
              })
            }
            aria-label="Город новой вакансии"
            data-hint="Город, по которому выбирается офис новой вакансии"
            className={fieldInput}
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
        </label>
        <label className="block">
          <span className={fieldLabel}>
            Офис <span className="text-red-400">*</span>
          </span>
          <select
            value={draft.officeCode}
            disabled={!draft.cityCode || officesQuery.isPending}
            onChange={(event) =>
              onDraftChange({ ...draft, officeCode: event.target.value })
            }
            aria-label="Офис новой вакансии"
            data-hint="Офис сохраняется вместе с новой вакансией"
            className={`${fieldInput} disabled:opacity-60`}
          >
            <option value="">
              {!draft.cityCode
                ? "Сначала выберите город"
                : officesQuery.isPending
                  ? "Загрузка…"
                  : "Выберите офис"}
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
        </label>
        <label className="block">
          <span className={fieldLabel}>Описание вакансии</span>
          <textarea
            value={draft.description}
            rows={2}
            onChange={(event) =>
              onDraftChange({ ...draft, description: event.target.value })
            }
            aria-label="Описание новой вакансии"
            data-hint="Описание, которое сохранится у новой вакансии"
            className={`${fieldInput} resize-y`}
          />
        </label>
        <label className="block">
          <span className={fieldLabel}>Предложение о работе</span>
          <textarea
            value={draft.jobOffer}
            rows={2}
            onChange={(event) =>
              onDraftChange({ ...draft, jobOffer: event.target.value })
            }
            aria-label="Предложение о работе новой вакансии"
            data-hint="Текст предложения, который сохранится у новой вакансии"
            className={`${fieldInput} resize-y`}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.isManager}
            onChange={(event) =>
              onDraftChange({ ...draft, isManager: event.target.checked })
            }
            data-hint="Отмечает новую должность как руководящую"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
          />
          <span className="text-xs text-gray-700 dark:text-gray-300">
            Руководящая должность
          </span>
        </label>
      </div>
      {notice && (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400">{notice}</p>
      )}
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        {changed
          ? `«${original.position || "—"}» останется в отделе «${deptName}» свободной. Сотрудник перейдёт на новую вакансию с этими данными.`
          : "Поля заполнены текущей вакансией. Измените их, чтобы создать новую: прежняя останется в исходном отделе свободной. Затем нажмите нужный отдел."}
      </p>
    </aside>
  );
}

function StructureRoot({
  node,
  source,
  ctx,
}: {
  node: OrgNode;
  source: OrgNode;
  ctx: TreeContext;
}) {
  const departmentCount = source.children?.length ?? 0;
  const employeeCount = ctx.employeeTotals.get(source.id) ?? 0;
  const isDropTarget = ctx.dropTargetId === source.id;
  const canAccept = ctx.canDrop(source.id);
  const vacancies = (node.vacancies ?? []).filter((vacancy) =>
    isVacancyVisible(vacancy, ctx),
  );
  const emptyVacancies = ctx.showVacancies ? (node.empty_vacancy ?? []) : [];
  const children = node.children ?? [];

  return (
    <section>
      <div
        onClick={() => {
          if (ctx.takeSuppressedClick()) return;
          if (canAccept) ctx.onDrop(source.id);
        }}
        onMouseEnter={() => {
          if (canAccept) ctx.onHoverTarget(source.id);
        }}
        onMouseLeave={(e) => {
          const next = e.relatedTarget;
          if (next instanceof Node && e.currentTarget.contains(next)) return;
          ctx.onLeaveTarget(source.id);
        }}
        onDragOver={(e) => {
          if (!canAccept) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          ctx.onHoverTarget(source.id);
        }}
        onDragLeave={(e) => {
          const next = e.relatedTarget;
          if (next instanceof Node && e.currentTarget.contains(next)) return;
          ctx.onLeaveTarget(source.id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (canAccept) ctx.onDrop(source.id);
        }}
        className={`group mb-2 flex items-center gap-2 rounded-md px-1 py-1 ${
          canAccept ? "cursor-copy" : ""
        } ${
          isDropTarget
            ? "bg-blue-50 ring-2 ring-blue-400 dark:bg-blue-500/10"
            : ""
        }`}
      >
        <NodeTypeControl node={source} ctx={ctx} />
        <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
          {source.name}
        </h2>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <CountBadge
            count={departmentCount}
            label="Общее количество отделов"
            showZero
            className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          />
          <CountBadge
            count={employeeCount}
            label="Общее количество сотрудников"
            showZero
            className="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
          />
          <button
            type="button"
            title="Редактировать отдел"
            aria-label="Редактировать отдел"
            data-hint="Открывает редактирование отдела"
            disabled={ctx.busy}
            onClick={(e) => {
              e.stopPropagation();
              ctx.onEditDept(source);
            }}
            className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 group-hover:opacity-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            title="Удалить отдел со всем содержимым"
            data-hint="Удаляет отдел вместе с вложенными отделами и вакансиями"
            disabled={ctx.busy}
            onClick={(e) => {
              e.stopPropagation();
              ctx.onDeleteNode(source);
            }}
            className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 disabled:opacity-30 group-hover:opacity-100 dark:hover:bg-red-500/10"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
        {vacancies.map((vacancy, index) => (
          <VacancyRow
            key={`v-${vacancy.id}-${index}`}
            vacancy={vacancy}
            depth={0}
            deptName={source.name}
            ctx={ctx}
          />
        ))}
        {emptyVacancies.map((vacancy, index) => (
          <EmptyVacancyRow key={`e-${index}`} vacancy={vacancy} depth={0} />
        ))}
        {children.map((child) => (
          <TreeNode key={child.id} node={child} depth={0} ctx={ctx} />
        ))}
        {children.length === 0 &&
          vacancies.length === 0 &&
          emptyVacancies.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
              Ничего не найдено
            </p>
          )}
        <div className="flex items-center gap-4 pl-7">
          <button
            type="button"
            onClick={() => ctx.onAddDept(source)}
            data-hint="Открывает форму нового отдела внутри этого"
            className="flex items-center gap-1 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
          >
            <Plus size={13} /> Добавить отдел
          </button>
          <button
            type="button"
            onClick={() => ctx.onAddVacancy(source)}
            data-hint="Открывает форму новой вакансии в этом отделе"
            className="flex items-center gap-1 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
          >
            <Plus size={13} /> Добавить вакансию
          </button>
        </div>
      </div>
    </section>
  );
}

function StructureTree({ tree }: { tree: OrgNode[] }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(readExpandedIds);
  /** Узлы, которые пользователь свернул поверх авто-раскрытия фильтра. */
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [vacancyFilter, setVacancyFilter] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [draggingVacancy, setDraggingVacancy] = useState<{
    vacancy: Vacancy;
    deptName: string;
    original: TransferVacancyDraft;
    draft: TransferVacancyDraft;
  } | null>(null);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const pickRef = useRef<
    | { kind: "node"; id: number; x: number; y: number }
    | {
        kind: "vacancy";
        vacancy: Vacancy;
        deptName: string;
        x: number;
        y: number;
      }
    | null
  >(null);
  const suppressClickRef = useRef(false);
  const reportsRef = useRef<Array<EmployeeReportItem[] | undefined>>([]);
  const [deptModal, setDeptModal] = useState<DeptModalState | null>(null);
  const [addVacancy, setAddVacancy] = useState<AddVacancyState | null>(null);
  const [editVacancyModal, setEditVacancyModal] =
    useState<VacancyModalData | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employer | null>(
    null,
  );
  const [pinnedOpenVacancyIds, setPinnedOpenVacancyIds] = useState<Set<number>>(
    new Set(),
  );
  const [typeMenuNodeId, setTypeMenuNodeId] = useState<number | null>(null);
  const activeReportQuery = useQuery(employeeReportQuery("active"));
  const archivedReportQuery = useQuery(employeeReportQuery("archived"));
  reportsRef.current = [activeReportQuery.data, archivedReportQuery.data];

  const nodeTypesQuery = useQuery(dictQueries.nodeTypes);
  const citiesQuery = useQuery(dictQueries.cities);

  const allIds = useMemo(() => {
    const acc = new Set<number>();
    collectAllNodeIds(tree, acc);
    return acc;
  }, [tree]);

  const employeeTotals = useMemo(() => collectEmployeeTotals(tree), [tree]);

  useEffect(() => {
    writeExpandedIds(expanded);
  }, [expanded]);

  const filteredTree = useMemo(() => {
    const base = vacancyFilter ? filterDepartmentsWithVacancies(tree) : null;
    const searched = filterStructureTree(base?.nodes ?? tree, searchQuery);
    if (!base) return searched;
    const expandIds = new Set(base.expandIds);
    for (const id of searched.expandIds) expandIds.add(id);
    return { nodes: searched.nodes, expandIds };
  }, [tree, searchQuery, vacancyFilter]);

  const forceExpand = vacancyFilter || searchQuery.trim().length > 0;

  const effectiveExpanded = useMemo(() => {
    if (!forceExpand) return expanded;
    const next = new Set(expanded);
    for (const id of filteredTree.expandIds) {
      if (!collapsedIds.has(id)) next.add(id);
    }
    return next;
  }, [expanded, filteredTree.expandIds, collapsedIds, forceExpand]);

  const revealNode = (id: number) => {
    setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    setCollapsedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["orgTree"] });

  // Перенос = PUT /orgnodes/node/:id с новым parent_id (отдельной ручки нет).
  // Шлём текущие code/name/type_code узла, иначе бэк перезапишет их пустыми.
  const moveMutation = useMutation({
    mutationFn: (vars: { node: OrgNode; parentId: number }) =>
      orgNodesApi.updateNode(vars.node.id, {
        code: vars.node.code,
        name: vars.node.name,
        type_code: vars.node.type,
        parent_id: vars.parentId,
      }),
    onSuccess: (_data, vars) => {
      revealNode(vars.parentId);
      setDeptModal(null);
      invalidate();
    },
  });

  const moveVacancyMutation = useMutation({
    mutationFn: async (vars: {
      vacancy: Vacancy;
      deptName: string;
      nodeId: number;
      draft: TransferVacancyDraft;
      replacing: boolean;
    }) => {
      const data = withReportVacancyFields(
        toVacancyModalData(vars.vacancy, vars.deptName),
        [activeReportQuery.data, archivedReportQuery.data],
      );
      if (!vars.replacing) {
        return vacanciesApi.update(
          vars.vacancy.id,
          toVacancyUpdateReq({
            position: data.position,
            cityCode: data.cityCode,
            officeCode: data.officeCode ?? "",
            nodeId: vars.nodeId,
            userId: data.employer?.id ?? null,
            isManager: data.isManager,
            jobOffer: data.jobOffer,
            description: data.description,
          }),
        );
      }

      const employeeId = data.employer?.id;
      if (!employeeId) {
        throw new Error("У переносимой вакансии нет сотрудника");
      }

      const position = vars.draft.position.trim();
      const created = await vacanciesApi.create({
        node_id: vars.nodeId,
        position_code: position,
        position_name: position,
        office_code: vars.draft.officeCode,
        is_manager: vars.draft.isManager,
        position_description: vars.draft.description,
        job_offer_link: vars.draft.jobOffer,
      });
      const slotId = created.data?.id;
      if (!slotId) {
        throw new Error("Сервер не вернул созданную вакансию");
      }

      try {
        await employeesApi.assignPosition(employeeId, slotId);
      } catch (error) {
        try {
          await vacanciesApi.delete(slotId);
        } catch {
          // Оставляем исходную ошибку переноса.
        }
        throw error;
      }

      return created;
    },
    onSuccess: (_data, vars) => {
      revealNode(vars.nodeId);
      if (vars.replacing) {
        revealNode(vars.vacancy.node_id);
        setPinnedOpenVacancyIds((prev) => new Set(prev).add(vars.vacancy.id));
      }
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      invalidate();
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (id: number) => orgNodesApi.deleteNode(id),
    onSuccess: invalidate,
  });

  const deleteVacancyMutation = useMutation({
    mutationFn: (id: number) => vacanciesApi.delete(id),
    onSuccess: invalidate,
  });

  const createNodeMutation = useMutation({
    mutationFn: (body: NodeCreateReq) => orgNodesApi.createNode(body),
    onSuccess: (_data, body) => {
      if (body.parent_id !== null) revealNode(body.parent_id);
      setDeptModal(null);
      invalidate();
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: NodeUpdateReq }) =>
      orgNodesApi.updateNode(id, body),
    onSuccess: () => {
      setDeptModal(null);
      invalidate();
    },
  });

  const changeTypeMutation = useMutation({
    mutationFn: (vars: { node: OrgNode; typeCode: string }) =>
      orgNodesApi.updateNode(vars.node.id, {
        code: vars.node.code,
        name: vars.node.name,
        type_code: vars.typeCode,
        parent_id: vars.node.parent_id,
      }),
    onSuccess: (_data, vars) => {
      setTypeMenuNodeId(null);
      queryClient.setQueryData<OrgNode[]>(["orgTree"], (old) =>
        old ? replaceNodeType(old, vars.node.id, vars.typeCode) : old,
      );
      invalidate();
    },
  });

  const createEmployeeVacancyMutation = useMutation({
    mutationFn: createEmployeeVacancy,
    onSuccess: (_data, body) => {
      revealNode(body.nodeId);
      setAddVacancy(null);
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      invalidate();
    },
  });

  const busy =
    moveMutation.isPending ||
    moveVacancyMutation.isPending ||
    deleteNodeMutation.isPending ||
    deleteVacancyMutation.isPending ||
    changeTypeMutation.isPending;

  const toggle = (id: number) => {
    const willOpen = !effectiveExpanded.has(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (willOpen) next.add(id);
      else next.delete(id);
      return next;
    });
    if (!forceExpand) return;
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (willOpen) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canDrop = (targetId: number) => {
    if (draggingVacancy) {
      return draggingVacancy.vacancy.node_id !== targetId;
    }
    return (
      draggingId !== null &&
      targetId !== draggingId &&
      !isDescendantOf(tree, draggingId, targetId)
    );
  };

  const cancelDrag = () => {
    setDraggingId(null);
    setDraggingVacancy(null);
    setDropTargetId(null);
    setTransferNotice(null);
  };

  const onRowPointerDown = (
    id: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, [data-node-type]")) return;
    pickRef.current = { kind: "node", id, x: event.clientX, y: event.clientY };
  };

  const onVacancyPointerDown = (
    vacancy: Vacancy,
    deptName: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0 || !vacancy.employer?.id) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea")) return;
    pickRef.current = {
      kind: "vacancy",
      vacancy,
      deptName,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const takeSuppressedClick = () => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const pick = pickRef.current;
      if (!pick) return;
      if (event.buttons !== 1) {
        pickRef.current = null;
        return;
      }
      const dx = event.clientX - pick.x;
      const dy = event.clientY - pick.y;
      if (dx * dx + dy * dy < 36) return;
      pickRef.current = null;
      suppressClickRef.current = true;
      if (pick.kind === "node") {
        setDraggingVacancy(null);
        setDraggingId(pick.id);
      } else {
        const draft = transferDraftFromVacancy(
          pick.vacancy,
          pick.deptName,
          reportsRef.current,
        );
        setDraggingId(null);
        setTransferNotice(null);
        setDraggingVacancy({
          vacancy: pick.vacancy,
          deptName: pick.deptName,
          original: draft,
          draft,
        });
      }
      setDropTargetId(null);
    };
    const onUp = () => {
      pickRef.current = null;
      if (!suppressClickRef.current) return;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    if (draggingId === null && draggingVacancy === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelDrag();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [draggingId, draggingVacancy]);

  useEffect(() => {
    if (draggingId !== null && !findNodeById(tree, draggingId)) cancelDrag();
  }, [draggingId, tree]);

  useEffect(() => {
    if (
      draggingVacancy &&
      !findVacancyById(tree, draggingVacancy.vacancy.id)
    ) {
      setDraggingVacancy(null);
      setDropTargetId(null);
    }
  }, [draggingVacancy, tree]);

  const onDrop = (targetId: number) => {
    const id = draggingId;
    const vacancyDrag = draggingVacancy;
    const ok = canDrop(targetId);
    if (!ok) {
      setDropTargetId(null);
      return;
    }
    if (vacancyDrag) {
      const { vacancy, draft, original } = vacancyDrag;
      const replacing = isNewVacancyDraft(original, draft);
      if (replacing && !draft.position.trim()) {
        setTransferNotice("Укажите должность новой вакансии");
        setDropTargetId(null);
        return;
      }
      if (replacing && !draft.officeCode) {
        setTransferNotice("Выберите офис новой вакансии");
        setDropTargetId(null);
        return;
      }
      const positionKey = draft.position.trim() || original.position;
      const conflict = findEmployeeVacancyConflict(
        tree,
        vacancy.id,
        targetId,
        positionKey,
        vacancy.employer?.id ?? null,
      );
      const slot = replacing
        ? findExistingPositionSlot(tree, targetId, positionKey)
        : null;
      const warning = [
        conflict ? employeeVacancyConflictWarning(conflict) : "",
        slot ? existingPositionSlotWarning(slot) : "",
      ]
        .filter(Boolean)
        .join(" ");
      if (warning && !window.confirm(`${warning} Перенести всё равно?`)) {
        setDropTargetId(null);
        return;
      }
      setTransferNotice(null);
      setDraggingId(null);
      setDraggingVacancy(null);
      setDropTargetId(null);
      moveVacancyMutation.mutate({
        vacancy,
        deptName: vacancyDrag.deptName,
        nodeId: targetId,
        draft,
        replacing,
      });
      return;
    }
    if (id === null) return;
    setDraggingId(null);
    setDropTargetId(null);
    const node = findNodeById(tree, id);
    if (node) moveMutation.mutate({ node, parentId: targetId });
  };

  const onDeleteNode = (node: OrgNode) => {
    if (window.confirm(`Удалить «${node.name}» со всем содержимым?`)) {
      deleteNodeMutation.mutate(node.id);
    }
  };

  const onDeleteVacancy = (v: Vacancy) => {
    if (v.employer?.id) return;
    if (
      window.confirm(
        `Удалить вакансию «${v.position?.name ?? v.position?.code ?? "—"}»?`,
      )
    ) {
      deleteVacancyMutation.mutate(v.id);
    }
  };

  const updateEmployeeMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Parameters<typeof employeesApi.update>[1];
    }) => employeesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      setSelectedEmployee(null);
    },
  });

  const updateVacancyMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Parameters<typeof vacanciesApi.update>[1];
    }) => vacanciesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      setEditVacancyModal(null);
    },
  });

  const onEditEmployee = (employee: Employer) => {
    const fromReport = employeeFromReports(employee.id, [
      activeReportQuery.data,
      archivedReportQuery.data,
    ]);
    updateEmployeeMutation.reset();
    setSelectedEmployee(fromReport ?? employee);
  };

  const onEditVacancy = (vacancy: Vacancy, deptName: string) => {
    updateVacancyMutation.reset();
    setEditVacancyModal(
      withReportVacancyFields(toVacancyModalData(vacancy, deptName), [
        activeReportQuery.data,
        archivedReportQuery.data,
      ]),
    );
  };

  const ctx: TreeContext = {
    expanded: effectiveExpanded,
    toggle,
    busy,
    draggingId,
    dropTargetId,
    canDrop,
    onRowPointerDown,
    draggingVacancyId: draggingVacancy?.vacancy.id ?? null,
    onVacancyPointerDown,
    takeSuppressedClick,
    onHoverTarget: setDropTargetId,
    onLeaveTarget: (id) => setDropTargetId((cur) => (cur === id ? null : cur)),
    onDrop,
    onDeleteNode,
    onEditDept: (node) => {
      updateNodeMutation.reset();
      createNodeMutation.reset();
      moveMutation.reset();
      setDeptModal({
        mode: "edit",
        id: String(node.id),
        parentId: node.parent_id == null ? null : String(node.parent_id),
        name: node.name,
        type: node.type,
        code: node.code,
      });
    },
    onDeleteVacancy,
    onEditEmployee,
    onEditVacancy,
    onAddDept: (node) => {
      moveMutation.reset();
      createNodeMutation.reset();
      setDeptModal({
        mode: "create",
        parentId: String(node.id),
        parentLabel: node.name,
      });
    },
    onAddVacancy: (node) =>
      setAddVacancy({ deptId: String(node.id), deptName: node.name }),
    typeMenuNodeId,
    typePending: changeTypeMutation.isPending,
    nodeTypes: nodeTypesQuery.data ?? [],
    nodeTypesPending: nodeTypesQuery.isPending,
    nodeTypesError: nodeTypesQuery.isError,
    onToggleTypeMenu: (id) =>
      setTypeMenuNodeId((current) => (current === id ? null : id)),
    onCloseTypeMenu: () => setTypeMenuNodeId(null),
    onChangeType: (node, typeCode) => {
      if (typeCode.toUpperCase() === node.type.toUpperCase()) {
        setTypeMenuNodeId(null);
        return;
      }
      changeTypeMutation.mutate({ node, typeCode });
    },
    showVacancies: vacancyFilter,
    pinnedOpenVacancyIds,
    employeeTotals,
  };

  const heldNode =
    draggingId !== null ? findNodeById(tree, draggingId) : undefined;

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-2">
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-pressed={vacancyFilter}
            data-hint="Показывает или скрывает свободные вакансии в списке отделов"
            onClick={() => {
              setCollapsedIds(new Set());
              setVacancyFilter((on) => !on);
            }}
            className={`rounded-md border px-3 py-1.5 text-sm text-amber-500 transition-colors ${
              vacancyFilter
                ? "border-amber-500 bg-amber-500/10"
                : "border-amber-500/40 hover:bg-amber-500/10"
            }`}
          >
            Вакансии
          </button>
          <button
            type="button"
            onClick={() => {
              setCollapsedIds(new Set());
              setExpanded(new Set(allIds));
            }}
            data-hint="Раскрывает все отделы в списке"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Развернуть всё
          </button>
          <button
            type="button"
            onClick={() => {
              setExpanded(new Set());
              setCollapsedIds(
                forceExpand ? new Set(filteredTree.expandIds) : new Set(),
              );
            }}
            data-hint="Сворачивает все отделы в списке"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Свернуть всё
          </button>
        </div>
      </div>
      <div className="mb-3 max-w-3xl">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              const wasActive = searchQuery.trim().length > 0;
              const willBeActive = value.trim().length > 0;
              if (wasActive !== willBeActive) setCollapsedIds(new Set());
              setSearchQuery(value);
            }}
            placeholder="Поиск по отделу, должности или сотруднику"
            aria-label="Поиск по структуре"
            data-hint="Оставляет в списке отделы, должности и сотрудников, подходящие под запрос"
            className={`${dictInputClass} border-gray-200 pl-9 dark:border-gray-700`}
          />
        </div>
      </div>
      <div className="flex items-stretch gap-4">
        <div className="max-w-3xl min-w-0 flex-1 space-y-4">
          {filteredTree.nodes.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                {vacancyFilter && !searchQuery.trim()
                  ? "Нет отделов с вакансиями"
                  : "Ничего не найдено"}
              </p>
            </div>
          ) : (
            filteredTree.nodes.map((node) => (
              <StructureRoot
                key={node.id}
                node={node}
                source={findNodeById(tree, node.id) ?? node}
                ctx={ctx}
              />
            ))
          )}
        </div>
        {(heldNode || draggingVacancy) && (
          <div className={`${draggingVacancy ? "w-80" : "w-72"} shrink-0`}>
            {heldNode ? (
              <HeldNodeCard
                node={heldNode}
                typeLabel={
                  nodeTypesQuery.data?.find(
                    (type) =>
                      type.code.toUpperCase() === heldNode.type.toUpperCase(),
                  )?.name ?? heldNode.type
                }
                onCancel={cancelDrag}
                onDragFinished={() => setDropTargetId(null)}
              />
            ) : (
              draggingVacancy && (
                <HeldVacancyCard
                  vacancy={draggingVacancy.vacancy}
                  deptName={draggingVacancy.deptName}
                  draft={draggingVacancy.draft}
                  original={draggingVacancy.original}
                  cities={citiesQuery.data ?? []}
                  notice={transferNotice}
                  onDraftChange={(draft) => {
                    setTransferNotice(null);
                    setDraggingVacancy((current) =>
                      current ? { ...current, draft } : current,
                    );
                  }}
                  onCancel={cancelDrag}
                  onDragFinished={() => setDropTargetId(null)}
                />
              )
            )}
          </div>
        )}
      </div>

      {deptModal && (
        <DeptModal
          state={deptModal}
          onClose={() => {
            createNodeMutation.reset();
            moveMutation.reset();
            updateNodeMutation.reset();
            setDeptModal(null);
          }}
          isPending={
            createNodeMutation.isPending ||
            moveMutation.isPending ||
            updateNodeMutation.isPending
          }
          error={formatApiError(
            createNodeMutation.error ??
              moveMutation.error ??
              updateNodeMutation.error,
          )}
          onSubmit={(data: DeptFields) => {
            if (deptModal.mode === "edit") {
              updateNodeMutation.mutate({
                id: Number(deptModal.id),
                body: {
                  code: data.code,
                  name: data.name,
                  type_code: data.type,
                  parent_id:
                    deptModal.parentId === null
                      ? null
                      : Number(deptModal.parentId),
                },
              });
              return;
            }
            if (data.moveNodeId) {
              const node = findNodeById(tree, data.moveNodeId);
              if (!node) return;
              createNodeMutation.reset();
              moveMutation.mutate({
                node,
                parentId: Number(deptModal.parentId),
              });
              return;
            }
            moveMutation.reset();
            createNodeMutation.mutate({
              code: data.code,
              name: data.name,
              type_code: data.type,
              parent_id: Number(deptModal.parentId),
            });
          }}
        />
      )}

      {selectedEmployee && (
        <EmployeeInfoModal
          employee={selectedEmployee}
          onClose={() => {
            updateEmployeeMutation.reset();
            setSelectedEmployee(null);
          }}
          isPending={updateEmployeeMutation.isPending}
          error={formatApiError(updateEmployeeMutation.error)}
          onSubmit={(fields) => {
            updateEmployeeMutation.mutate({
              id: selectedEmployee.id,
              body: toEmployeeUpdateReq(selectedEmployee, fields),
            });
          }}
        />
      )}

      {editVacancyModal && (
        <EditVacancyModal
          data={editVacancyModal}
          onClose={() => {
            updateVacancyMutation.reset();
            setEditVacancyModal(null);
          }}
          isPending={updateVacancyMutation.isPending}
          error={formatVacancyError(updateVacancyMutation.error)}
          onSubmit={(data) => {
            updateVacancyMutation.mutate({
              id: editVacancyModal.id,
              body: toVacancyUpdateReq(data),
            });
          }}
        />
      )}

      {addVacancy && (
        <EmployeeAddModal
          key={addVacancy.deptId}
          nodeId={Number(addVacancy.deptId)}
          deptName={addVacancy.deptName}
          cities={citiesQuery.data ?? []}
          orgNodes={tree}
          isPending={createEmployeeVacancyMutation.isPending}
          error={formatVacancyError(createEmployeeVacancyMutation.error)}
          onClose={() => {
            createEmployeeVacancyMutation.reset();
            setAddVacancy(null);
          }}
          onSubmit={(data) => createEmployeeVacancyMutation.mutate(data)}
        />
      )}

      {(deleteNodeMutation.isError ||
        deleteVacancyMutation.isError ||
        changeTypeMutation.isError ||
        moveVacancyMutation.isError ||
        (moveMutation.isError && !deptModal)) && (
        <ApiErrorModal
          error={
            deleteNodeMutation.error ??
            deleteVacancyMutation.error ??
            changeTypeMutation.error ??
            moveVacancyMutation.error ??
            moveMutation.error
          }
          onClose={() => {
            deleteNodeMutation.reset();
            deleteVacancyMutation.reset();
            changeTypeMutation.reset();
            moveVacancyMutation.reset();
            moveMutation.reset();
          }}
        />
      )}
    </>
  );
}

function StructurePage() {
  const treeQuery = useQuery({
    queryKey: ["orgTree"],
    queryFn: () => orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
  });

  const tree = treeQuery.data ?? [];

  return (
    <div className="absolute inset-0 overflow-auto bg-transparent px-8 py-6 dark:bg-gray-950">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Структура
          <CommentHeadingIcon />
        </h1>
        <PageDescription className="mt-2 max-w-3xl">
          Карандаш открывает редактирование отдела. Потяните отдел или
          сотрудника — карточка закрепится справа от списка. На ней можно
          изменить данные новой вакансии: прежняя останется в исходном отделе
          свободной. Прокрутите список или найдите отдел и нажмите на него,
          чтобы вставить. Стрелка раскрывает ветку и во время переноса, Esc
          отменяет. Корзина для удаления — по наведению на строку.
        </PageDescription>
      </div>

      {treeQuery.isPending ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>
      ) : treeQuery.isError ? (
        <p className="text-sm text-red-500">
          {formatApiError(treeQuery.error) ?? "Не удалось загрузить структуру"}
        </p>
      ) : tree.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Структура пуста
        </p>
      ) : (
        <StructureTree tree={tree} />
      )}
    </div>
  );
}
