import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { orgNodesApi, vacanciesApi } from "#/services/api";
import { CreateVacancyModal } from "#/components/CreateVacancyModal";
import { DeptModal } from "#/components/DeptModal";
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
    <div>
      <div
        draggable
        role="button"
        onClick={() => ctx.toggle(node.id)}
        onDragStart={(e) => {
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
        className={`group flex cursor-pointer items-center gap-2 rounded-md py-2 pr-3 transition-colors ${
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
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {node.type}
        </span>
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
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [deptModal, setDeptModal] = useState<DeptModalState | null>(null);
  const [addVacancy, setAddVacancy] = useState<AddVacancyState | null>(null);

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
      invalidate();
    },
    onError: (err) =>
      window.alert(err instanceof Error ? err.message : "Не удалось перенести"),
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
    deleteVacancyMutation.isPending;

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
    expanded,
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
    onAddDept: (node) =>
      setDeptModal({
        mode: "create",
        parentId: String(node.id),
        parentLabel: node.name,
      }),
    onAddVacancy: (node) =>
      setAddVacancy({ deptId: String(node.id), deptName: node.name }),
  };

  const allIds = useMemo(() => {
    const acc = new Set<number>();
    collectAllNodeIds(tree, acc);
    return acc;
  }, [tree]);

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
      <div className="max-w-3xl rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
        {tree.map((node) => (
          <TreeNode key={node.id} node={node} depth={0} ctx={ctx} />
        ))}
      </div>

      {deptModal && (
        <DeptModal
          state={deptModal}
          onClose={() => {
            createNodeMutation.reset();
            setDeptModal(null);
          }}
          isPending={createNodeMutation.isPending}
          error={createNodeMutation.error?.message ?? null}
          onSubmit={(data: DeptFields) =>
            createNodeMutation.mutate({
              code: data.code,
              name: data.name,
              type_code: data.type,
              parent_id: Number(deptModal.parentId),
            })
          }
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
