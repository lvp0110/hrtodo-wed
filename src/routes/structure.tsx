import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { selectableOrgNodeTypes } from "#/lib/orgNodeTypes";
import { dictQueries, orgNodesApi, vacanciesApi } from "#/services/api";
import { CreateVacancyModal } from "#/components/CreateVacancyModal";
import { DeptModal } from "#/components/DeptModal";
import { dictInputClass } from "#/components/settings/DictFormModal";
import type {
  AddVacancyState,
  DeptFields,
  DeptModalState,
  VacancyFormFields,
} from "#/types/orgChart";
import type {
  EmptyVacancy,
  NodeCreateReq,
  OrgNode,
  OrgNodeType,
  Vacancy,
  VacancyReq,
} from "#/types/api";

export const Route = createFileRoute("/structure")({
  component: StructurePage,
});

/** Сколько уровней дерева раскрыто по умолчанию. */
const DEFAULT_EXPANDED_LEVELS = 3;

function upsertVacancy(tree: OrgNode[], vacancy: Vacancy): OrgNode[] {
  return tree.map((node) => {
    if (node.id === vacancy.node_id) {
      const existing = node.vacancies ?? [];
      const idx = existing.findIndex((v) => v.id === vacancy.id);
      const vacancies =
        idx >= 0
          ? existing.map((v, i) => (i === idx ? vacancy : v))
          : [...existing, vacancy];
      return { ...node, vacancies };
    }
    if (node.children?.length) {
      return { ...node, children: upsertVacancy(node.children, vacancy) };
    }
    return node;
  });
}

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

function employerName(v: Vacancy): string {
  if (!v.employer?.id) return "Вакантно";
  const { first_name, second_name, surname } = v.employer;
  return [surname, first_name, second_name].filter(Boolean).join(" ");
}

function nodeChildCount(node: OrgNode): number {
  return (
    (node.children?.length ?? 0) +
    (node.vacancies?.length ?? 0) +
    (node.empty_vacancy?.length ?? 0)
  );
}

function collectDefaultExpanded(
  nodes: OrgNode[],
  level: number,
  acc: Set<number>,
) {
  for (const node of nodes) {
    if (level < DEFAULT_EXPANDED_LEVELS) acc.add(node.id);
    if (node.children?.length) {
      collectDefaultExpanded(node.children, level + 1, acc);
    }
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
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDragOver: (id: number) => void;
  onDragLeave: (id: number) => void;
  onDrop: (targetId: number) => void;
  onDeleteNode: (node: OrgNode) => void;
  onDeleteVacancy: (v: Vacancy) => void;
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
}

function VacancyRow({
  vacancy,
  depth,
  ctx,
}: {
  vacancy: Vacancy;
  depth: number;
  ctx: TreeContext;
}) {
  const filled = !!vacancy.employer?.id;
  return (
    <div
      className="group flex items-center gap-2 rounded-md py-1.5 pr-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50"
      style={{ paddingLeft: depth * 20 + 28 }}
    >
      {vacancy.is_manager && (
        <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />
      )}
      <span className="truncate text-gray-700 dark:text-gray-300">
        {vacancy.position?.name ?? vacancy.position?.code ?? "—"}
      </span>
      <span className="text-gray-300 dark:text-gray-600">·</span>
      <span
        className={`truncate text-xs ${filled ? "text-gray-500 dark:text-gray-400" : "text-amber-500"}`}
      >
        {employerName(vacancy)}
      </span>
      {vacancy.city?.name && (
        <>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {vacancy.city.name}
          </span>
        </>
      )}
      <button
        type="button"
        title="Удалить вакансию"
        disabled={ctx.busy}
        onClick={() => ctx.onDeleteVacancy(vacancy)}
        className="ml-auto shrink-0 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 disabled:opacity-30 group-hover:opacity-100 dark:hover:bg-red-500/10"
      >
        <Trash2 size={14} />
      </button>
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
        disabled={ctx.typePending}
        onClick={(e) => {
          e.stopPropagation();
          ctx.onToggleTypeMenu(node.id);
        }}
        className="border-0 bg-transparent p-0 text-[length:var(--tsrd-font-size)] font-medium uppercase tracking-wide text-gray-400 hover:text-blue-600 disabled:opacity-50 dark:text-gray-500 dark:hover:text-blue-400"
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
  const childCount = nodeChildCount(node);
  const isOpen = ctx.expanded.has(node.id);
  const isDragging = ctx.draggingId === node.id;
  const isDropTarget = ctx.dropTargetId === node.id;
  const addPadding = (depth + 1) * 20 + 28;

  return (
    <div className={ctx.typeMenuNodeId === node.id ? "relative z-20" : undefined}>
      <div
        draggable
        role="button"
        onClick={() => ctx.toggle(node.id)}
        onDragStart={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest("[data-node-type]")) {
            e.preventDefault();
            return;
          }
          e.stopPropagation();
          e.dataTransfer.effectAllowed = "move";
          ctx.onDragStart(node.id);
        }}
        onDragEnd={ctx.onDragEnd}
        onDragOver={(e) => {
          if (ctx.canDrop(node.id)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            ctx.onDragOver(node.id);
          }
        }}
        onDragLeave={() => ctx.onDragLeave(node.id)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          ctx.onDrop(node.id);
        }}
        className={`group flex cursor-pointer items-center gap-2 rounded-md border border-solid border-[#7198bb] py-2 pr-3 transition-colors ${
          isDragging ? "opacity-40" : ""
        } ${
          isDropTarget
            ? "bg-blue-50 ring-2 ring-blue-400 dark:bg-blue-500/10"
            : "hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
        style={{ paddingLeft: depth * 20 + 4 }}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-400">
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <GripVertical
          size={14}
          className="shrink-0 text-gray-300 dark:text-gray-600"
        />
        <NodeTypeControl node={node} ctx={ctx} />
        <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {node.name}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {childCount > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {childCount}
            </span>
          )}
          <button
            type="button"
            title="Удалить отдел со всем содержимым"
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
          {(node.children ?? []).map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} ctx={ctx} />
          ))}
          {(node.vacancies ?? []).map((v, i) => (
            <VacancyRow
              key={`v-${v.id}-${i}`}
              vacancy={v}
              depth={depth + 1}
              ctx={ctx}
            />
          ))}
          {(node.empty_vacancy ?? []).map((v, i) => (
            <EmptyVacancyRow key={`e-${i}`} vacancy={v} depth={depth + 1} />
          ))}
          <div
            className="flex items-center gap-4"
            style={{ paddingLeft: addPadding }}
          >
            <button
              type="button"
              onClick={() => ctx.onAddDept(node)}
              className="flex items-center gap-1 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
            >
              <Plus size={13} /> Добавить отдел
            </button>
            <button
              type="button"
              onClick={() => ctx.onAddVacancy(node)}
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

function StructureTree({ tree }: { tree: OrgNode[] }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const acc = new Set<number>();
    collectDefaultExpanded(tree, 1, acc);
    return acc;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [deptModal, setDeptModal] = useState<DeptModalState | null>(null);
  const [addVacancy, setAddVacancy] = useState<AddVacancyState | null>(null);
  const [typeMenuNodeId, setTypeMenuNodeId] = useState<number | null>(null);

  const nodeTypesQuery = useQuery(dictQueries.nodeTypes);

  const allIds = useMemo(() => {
    const acc = new Set<number>();
    collectAllNodeIds(tree, acc);
    return acc;
  }, [tree]);

  const filteredTree = useMemo(
    () => filterStructureTree(tree, searchQuery),
    [tree, searchQuery],
  );

  const effectiveExpanded = useMemo(() => {
    if (!searchQuery.trim()) return expanded;
    const next = new Set(expanded);
    for (const id of filteredTree.expandIds) next.add(id);
    return next;
  }, [expanded, filteredTree.expandIds, searchQuery]);

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
      setExpanded((prev) => new Set(prev).add(vars.parentId));
      setDeptModal(null);
      invalidate();
    },
    onError: (err) => {
      if (deptModal) return;
      window.alert(err instanceof Error ? err.message : "Не удалось перенести");
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (id: number) => orgNodesApi.deleteNode(id),
    onSuccess: invalidate,
    onError: (err) =>
      window.alert(
        err instanceof Error ? err.message : "Не удалось удалить узел",
      ),
  });

  const deleteVacancyMutation = useMutation({
    mutationFn: (id: number) => vacanciesApi.delete(id),
    onSuccess: invalidate,
    onError: (err) =>
      window.alert(
        err instanceof Error ? err.message : "Не удалось удалить вакансию",
      ),
  });

  const createNodeMutation = useMutation({
    mutationFn: (body: NodeCreateReq) => orgNodesApi.createNode(body),
    onSuccess: (_data, body) => {
      if (body.parent_id !== null) {
        setExpanded((prev) => new Set(prev).add(body.parent_id!));
      }
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
    onError: (err) =>
      window.alert(err instanceof Error ? err.message : "Не удалось сменить тип"),
  });

  const createVacancyMutation = useMutation({
    mutationFn: (body: VacancyReq) => vacanciesApi.create(body),
    onSuccess: ({ data: vacancy }, body) => {
      if (vacancy) {
        queryClient.setQueryData<OrgNode[]>(["orgTree"], (old) =>
          old ? upsertVacancy(old, vacancy) : old,
        );
      }
      setExpanded((prev) => new Set(prev).add(body.node_id));
      setAddVacancy(null);
      invalidate();
    },
  });

  const busy =
    moveMutation.isPending ||
    deleteNodeMutation.isPending ||
    deleteVacancyMutation.isPending ||
    changeTypeMutation.isPending;

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canDrop = (targetId: number) =>
    draggingId !== null &&
    targetId !== draggingId &&
    !isDescendantOf(tree, draggingId, targetId);

  const onDrop = (targetId: number) => {
    const id = draggingId;
    const ok = canDrop(targetId);
    setDraggingId(null);
    setDropTargetId(null);
    if (id === null || !ok) return;
    const node = findNodeById(tree, id);
    if (node) moveMutation.mutate({ node, parentId: targetId });
  };

  const onDeleteNode = (node: OrgNode) => {
    if (window.confirm(`Удалить «${node.name}» со всем содержимым?`)) {
      deleteNodeMutation.mutate(node.id);
    }
  };

  const onDeleteVacancy = (v: Vacancy) => {
    if (
      window.confirm(
        `Удалить вакансию «${v.position?.name ?? v.position?.code ?? "—"}»?`,
      )
    ) {
      deleteVacancyMutation.mutate(v.id);
    }
  };

  const ctx: TreeContext = {
    expanded: effectiveExpanded,
    toggle,
    busy,
    draggingId,
    dropTargetId,
    canDrop,
    onDragStart: setDraggingId,
    onDragEnd: () => {
      setDraggingId(null);
      setDropTargetId(null);
    },
    onDragOver: setDropTargetId,
    onDragLeave: (id) => setDropTargetId((cur) => (cur === id ? null : cur)),
    onDrop,
    onDeleteNode,
    onDeleteVacancy,
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
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Перетащите отдел на другой, чтобы сменить родителя. Разверните отдел,
          чтобы добавить вложенные отделы и вакансии; корзина для удаления — по
          наведению на строку.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setExpanded(new Set(allIds))}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Развернуть всё
          </button>
          <button
            type="button"
            onClick={() => setExpanded(new Set())}
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по отделу, должности или сотруднику"
            aria-label="Поиск по структуре"
            className={`${dictInputClass} border-gray-200 pl-9 dark:border-gray-700`}
          />
        </div>
      </div>
      <div className="max-w-3xl rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
        {filteredTree.nodes.length === 0 ? (
          <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
            Ничего не найдено
          </p>
        ) : (
          filteredTree.nodes.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} ctx={ctx} />
          ))
        )}
      </div>

      {deptModal && (
        <DeptModal
          state={deptModal}
          onClose={() => {
            createNodeMutation.reset();
            moveMutation.reset();
            setDeptModal(null);
          }}
          isPending={
            createNodeMutation.isPending || moveMutation.isPending
          }
          error={
            createNodeMutation.error?.message ??
            moveMutation.error?.message ??
            null
          }
          onSubmit={(data: DeptFields) => {
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

      {addVacancy && (
        <CreateVacancyModal
          state={addVacancy}
          onClose={() => {
            createVacancyMutation.reset();
            setAddVacancy(null);
          }}
          isPending={createVacancyMutation.isPending}
          error={createVacancyMutation.error?.message ?? null}
          onSubmit={(data: VacancyFormFields) =>
            createVacancyMutation.mutate({
              node_id: Number(addVacancy.deptId),
              position_code: data.position,
              position_name: data.position,
              user_id: null,
              city_code: data.cityCode,
              is_manager: data.isManager,
              position_description: data.description,
              job_offer_link: data.jobOffer,
            })
          }
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
    <div className="absolute inset-0 overflow-auto bg-gray-50 px-8 py-6 dark:bg-gray-950">
      <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">
        Структура
      </h1>

      {treeQuery.isPending ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>
      ) : treeQuery.isError ? (
        <p className="text-sm text-red-500">
          {treeQuery.error?.message ?? "Не удалось загрузить структуру"}
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
