import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Panel,
  ReactFlow,
  Background,
  useReactFlow,
    type Node,
} from "@xyflow/react";
import { Search, X } from "lucide-react";
import "@xyflow/react/dist/style.css";

import {
  employeeReportQuery,
  employeesApi,
  orgNodesApi,
  vacanciesApi,
} from "#/services/api";
import { buildLayout } from "#/lib/orgTreeLayout";
import { formatApiError, formatVacancyError } from "#/lib/apiError";
import { toEmployeeUpdateReq } from "#/lib/employeeUpdate";
import { toVacancyUpdateReq } from "#/lib/vacancyUpdate";
import {
  employeeFromReports,
  withReportVacancyFields,
} from "#/lib/vacancyModalData";
import { dictInputClass } from "#/components/settings/DictFormModal";
import { ApiErrorModal } from "#/components/ApiErrorModal";
import { CommentHeadingIcon } from "#/components/CommentHeadingIcon";
import { PageDescription } from "#/components/PageHints";
import { useTheme } from "#/components/ThemeProvider";
import { OrgNodeCard } from "#/components/OrgNodeCard";
import { AddNodeCard } from "#/components/AddNodeCard";
import { DeptModal } from "#/components/DeptModal";
import { VacancyInfoModal } from "#/components/VacancyInfoModal";
import { CreateVacancyModal } from "#/components/CreateVacancyModal";
import { EditVacancyModal } from "#/components/EditVacancyModal";
import { EmployeeInfoModal } from "#/components/EmployeeInfoModal";
import type {
  Employer,
  NodeCreateReq,
  NodeUpdateReq,
  OrgNode,
  Vacancy,
  VacancyReq,
  VacancyUpdateReq,
} from "#/types/api";
import type {
  AddVacancyState,
  DeptModalState,
  VacancyModalData,
} from "#/types/orgChart";

const nodeTypes = { orgNode: OrgNodeCard, addNode: AddNodeCard };

/** Приближение к выбранному отделу. Кадр не расширяем. */
const FOCUS_ZOOM = 1.2;
const CARD_W = 280;
const HEADER_H = 76;
const CLUSTER_GAP_X = 16;
const CLUSTER_GAP_Y = 28;

type Neighborhood = {
  positions: Map<string, { x: number; y: number }>;
  compact: boolean;
  memberIds: Set<string>;
};

function cardHeight(node: Node, compact: boolean): number {
  if (compact) return HEADER_H;
  const height = Number(node.data?.height);
  return Number.isFinite(height) && height > 0 ? height : HEADER_H;
}

function orgParentId(node: Node): string | null {
  const parentId = node.data.parentId as string | null | undefined;
  return parentId ?? null;
}

/** Все отделы над выбранным, от ближайшего руководителя к корню. */
function ancestorChain(byId: Map<string, Node>, focusedId: string): Node[] {
  const chain: Node[] = [];
  const seen = new Set<string>();
  let parentId = orgParentId(byId.get(focusedId)!);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    chain.push(parent);
    parentId = orgParentId(parent);
  }
  return chain;
}

/** Все отделы под выбранным, уровень за уровнем. */
function descendantLevels(
  nodes: Node[],
  focusedId: string,
): Node[][] {
  const childrenByParent = new Map<string, Node[]>();
  for (const node of nodes) {
    const parentId = orgParentId(node);
    if (!parentId) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(node);
    childrenByParent.set(parentId, list);
  }

  const levels: Node[][] = [];
  const seen = new Set<string>([focusedId]);
  let frontier = childrenByParent.get(focusedId) ?? [];
  while (frontier.length) {
    const level = frontier.filter((node) => !seen.has(node.id));
    if (!level.length) break;
    for (const node of level) seen.add(node.id);
    levels.push(level);
    frontier = level.flatMap((node) => childrenByParent.get(node.id) ?? []);
  }
  return levels;
}

/**
 * На время приближения собирает вокруг выбранного отдела всю цепочку выше
 * и всё дерево ниже. Кадр не отдаляется: если полные карточки не входят,
 * соседние отделы сжимаются до шапки.
 */
function buildNeighborhood(
  nodes: Node[],
  focusedId: string,
  frame: { width: number; height: number },
  expandedIds: Set<string>,
): Neighborhood | null {
  const orgNodes = nodes.filter((node) => node.type === "orgNode");
  const byId = new Map(orgNodes.map((node) => [node.id, node]));
  const selected = byId.get(focusedId);
  if (!selected) return null;

  const ancestors = ancestorChain(byId, focusedId);
  const levels = descendantLevels(orgNodes, focusedId);
  if (!ancestors.length && !levels.length) return null;

  const memberIds = new Set<string>([focusedId]);
  for (const node of ancestors) memberIds.add(node.id);
  for (const level of levels) {
    for (const node of level) memberIds.add(node.id);
  }

  const frameW = frame.width || 1280;
  const frameH = frame.height || 800;
  const visibleW = frameW / FOCUS_ZOOM - 96;
  const visibleH = frameH / FOCUS_ZOOM;
  const topInset = 72 / FOCUS_ZOOM;
  const cols = Math.max(
    1,
    Math.floor((visibleW + CLUSTER_GAP_X) / (CARD_W + CLUSTER_GAP_X)),
  );

  const place = (compact: boolean) => {
    const positions = new Map<string, { x: number; y: number }>();
    const selectedHeight = cardHeight(selected, false);
    const centerX = selected.position.x + CARD_W / 2;
    const shownHeight = (node: Node) =>
      cardHeight(node, compact && !expandedIds.has(node.id));

    // Верхняя точка считается по сжатым шапкам, чтобы заголовок оставался
    // на месте, а раскрытый список рос вниз и сдвигал карточки под ним.
    let top = selected.position.y;
    for (const ancestor of ancestors) {
      top -= CLUSTER_GAP_Y + cardHeight(ancestor, compact);
    }

    let y = top;
    for (const ancestor of [...ancestors].reverse()) {
      positions.set(ancestor.id, { x: centerX - CARD_W / 2, y });
      y += shownHeight(ancestor) + CLUSTER_GAP_Y;
    }

    positions.set(selected.id, { x: selected.position.x, y });

    let below = y + selectedHeight + CLUSTER_GAP_Y;
    for (const level of levels) {
      for (let index = 0; index < level.length; index += cols) {
        const row = level.slice(index, index + cols);
        const rowWidth =
          row.length * CARD_W + (row.length - 1) * CLUSTER_GAP_X;
        let x = centerX - rowWidth / 2;
        let rowHeight = 0;
        for (const node of row) {
          const height = shownHeight(node);
          positions.set(node.id, { x, y: below });
          rowHeight = Math.max(rowHeight, height);
          x += CARD_W + CLUSTER_GAP_X;
        }
        below += rowHeight + CLUSTER_GAP_Y;
      }
    }

    return positions;
  };

  const fits = (
    positions: Map<string, { x: number; y: number }>,
    compact: boolean,
  ) => {
    const selectedHeight = cardHeight(selected, false);
    const centerX = selected.position.x + CARD_W / 2;
    const centerY = selected.position.y + selectedHeight / 2;
    const viewLeft = centerX - visibleW / 2;
    const viewRight = centerX + visibleW / 2;
    const viewTop = centerY - visibleH / 2 + topInset;
    const viewBottom = centerY + visibleH / 2 - 16;

    for (const [id, position] of positions) {
      if (id === focusedId) continue;
      const node = byId.get(id);
      if (!node) continue;
      const height = cardHeight(node, compact);
      if (position.x < viewLeft || position.x + CARD_W > viewRight) return false;
      if (position.y < viewTop || position.y + height > viewBottom) return false;
    }
    return true;
  };

  const full = place(false);
  if (fits(full, false)) {
    return { positions: full, compact: false, memberIds };
  }
  return { positions: place(true), compact: true, memberIds };
}

type ChartDepartment = {
  id: string;
  name: string;
  type: string;
  code: string;
};

function departmentRank(dept: ChartDepartment, query: string): number {
  const normalized = query.trim().toLowerCase();
  const name = dept.name.toLowerCase();
  const code = dept.code.toLowerCase();
  if (name === normalized || code === normalized) return 0;
  if (name.startsWith(normalized) || code.startsWith(normalized)) return 1;
  return 2;
}

function filterDepartments(
  departments: ChartDepartment[],
  query: string,
): ChartDepartment[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return departments
    .filter(
      (dept) =>
        dept.name.toLowerCase().includes(normalized) ||
        dept.code.toLowerCase().includes(normalized),
    )
    .sort((a, b) => {
      const rank = departmentRank(a, query) - departmentRank(b, query);
      if (rank !== 0) return rank;
      return a.name.localeCompare(b.name, "ru");
    });
}

/** Держит в кадре выбранный отдел и всю цепочку выше и ниже него. */
function FocusCamera({
  focusedId,
  memberIds,
  layoutKey,
}: {
  focusedId: string | null;
  memberIds: string[];
  layoutKey: string;
}) {
  const { fitView } = useReactFlow();
  const zoomedRef = useRef(false);
  const membersKey = memberIds.join("\0");

  useEffect(() => {
    if (!focusedId) {
      if (!zoomedRef.current) return;
      zoomedRef.current = false;
      let secondFrame = 0;
      const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          void fitView({ duration: 450, padding: 0.15 });
        });
      });
      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
      };
    }

    const chain = membersKey ? membersKey.split("\0") : [focusedId];
    const opened = layoutKey ? layoutKey.split("\0") : [];
    const ids = opened.length ? [focusedId, ...opened] : chain;
    const timer = window.setTimeout(() => {
      zoomedRef.current = true;
      void fitView({
        nodes: ids.map((id) => ({ id })),
        duration: 450,
        padding: 0.12,
        maxZoom: FOCUS_ZOOM,
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusedId, membersKey, layoutKey, fitView]);

  return null;
}

function DepartmentSearch({
  departments,
  onHighlight,
}: {
  departments: ChartDepartment[];
  onHighlight: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(
    () => filterDepartments(departments, query),
    [departments, query],
  );

  useEffect(() => {
    onHighlight(activeId);
  }, [activeId, onHighlight]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !activeId) return;
    document
      .getElementById(`dept-search-${activeId}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeId, matches]);

  const choose = (dept: ChartDepartment) => {
    setQuery(dept.name);
    setActiveId(dept.id);
    setOpen(false);
  };

  const clear = () => {
    setQuery("");
    setActiveId(null);
    setOpen(false);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (matches.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
      const index = matches.findIndex((dept) => dept.id === activeId);
      const nextIndex =
        event.key === "ArrowDown"
          ? Math.min(index + 1, matches.length - 1)
          : Math.max(index <= 0 ? 0 : index - 1, 0);
      setActiveId(matches[nextIndex]?.id ?? null);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = matches.find((dept) => dept.id === activeId);
      if (selected) choose(selected);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      clear();
    }
  };

  return (
    <Panel position="top-left" className="!m-3">
      <div ref={rootRef} className="nodrag nopan nowheel w-80">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              const nextMatches = filterDepartments(departments, next);
              setQuery(next);
              setActiveId(nextMatches[0]?.id ?? null);
              setOpen(true);
            }}
            onFocus={() => {
              if (query.trim()) setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Поиск по департаментам"
            aria-label="Поиск по департаментам"
            data-hint="Находит отдел на схеме и приближает к нему"
            aria-expanded={open}
            aria-controls="dept-search-list"
            aria-activedescendant={
              activeId ? `dept-search-${activeId}` : undefined
            }
            className={`${dictInputClass} border-gray-200 pr-8 pl-9 shadow-sm [&::-webkit-search-cancel-button]:hidden dark:border-gray-700`}
          />
          {query && (
            <button
              type="button"
              title="Очистить поиск"
              data-hint="Сбрасывает поиск и возвращает общий вид схемы"
              onClick={clear}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X size={14} />
            </button>
          )}
          </div>
          <CommentHeadingIcon />
        </div>
        <PageDescription className="mt-2">
          Клик по должности открывает вакансию, по имени — карточку сотрудника.
          Корзина удаляет свободную вакансию. Клик по шапке отдела открывает
          его карточку. Поиск приближает цепочку выше и ниже: клик по такому
          отделу показывает сотрудников, повторный — скрывает. Кнопка у
          названия — редактирование. Пунктирная карточка создаёт отдел, строка
          «Добавить вакансию» — вакансию.
        </PageDescription>
        {open && query.trim() && (
          <div
            id="dept-search-list"
            role="listbox"
            className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                Ничего не найдено
              </p>
            ) : (
              matches.map((dept) => {
                const selected = dept.id === activeId;
                return (
                  <button
                    key={dept.id}
                    id={`dept-search-${dept.id}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-hint="Приближает схему к этому отделу"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(dept)}
                    className={`block w-full px-3 py-2 text-left ${
                      selected
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="block truncate text-sm">{dept.name}</span>
                    <span className="block truncate text-xs text-gray-400 uppercase dark:text-gray-500">
                      {dept.type}
                      {dept.code ? ` · ${dept.code}` : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Кладёт/заменяет вакансию в дереве: ищет узел по node_id, обновляет по id. */
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
    if (node.children) {
      return { ...node, children: upsertVacancy(node.children, vacancy) };
    }
    return node;
  });
}

export function OrgChart() {
  const { resolved: colorMode } = useTheme();
  const queryClient = useQueryClient();
  const [deptModal, setDeptModal] = useState<DeptModalState | null>(null);
  const [vacancyModal, setVacancyModal] = useState<VacancyModalData | null>(
    null,
  );
  const [addVacancyModal, setAddVacancyModal] =
    useState<AddVacancyState | null>(null);
  const [editVacancyModal, setEditVacancyModal] =
    useState<VacancyModalData | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employer | null>(
    null,
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const onHighlight = useCallback((id: string | null) => {
    setFocusedId(id);
    setExpandedIds(new Set());
  }, []);

  const openDeptEditor = useCallback((node: Node) => {
    setDeptModal({
      mode: "edit",
      id: node.id,
      parentId: (node.data.parentId as string | null) ?? null,
      name: node.data.label as string,
      type: node.data.type as string,
      code: node.data.code as string,
    });
  }, []);

  const {
    data: layout,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["orgTree"],
    queryFn: () =>
      orgNodesApi.getTreeVacancies().then((res) => res.data as OrgNode[]),
    select: buildLayout,
  });

  const activeReportQuery = useQuery(employeeReportQuery("active"));
  const archivedReportQuery = useQuery(employeeReportQuery("archived"));

  const createNodeMutation = useMutation({
    mutationFn: (body: NodeCreateReq) => orgNodesApi.createNode(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      setDeptModal(null);
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: NodeUpdateReq }) =>
      orgNodesApi.updateNode(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      setDeptModal(null);
    },
  });

  const createVacancyMutation = useMutation({
    mutationFn: (body: VacancyReq) => vacanciesApi.create(body),
    onSuccess: ({ data: vacancy }) => {
      if (vacancy) {
        queryClient.setQueryData<OrgNode[]>(["orgTree"], (old) =>
          old ? upsertVacancy(old, vacancy) : old,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      setAddVacancyModal(null);
    },
  });

  const updateVacancyMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: VacancyUpdateReq }) =>
      vacanciesApi.update(id, body),
    onSuccess: ({ data: vacancy }) => {
      queryClient.setQueryData<OrgNode[]>(["orgTree"], (old) =>
        old ? upsertVacancy(old, vacancy) : old,
      );
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      setEditVacancyModal(null);
    },
  });

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

  const deleteVacancyMutation = useMutation({
    mutationFn: (id: number) => vacanciesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      setEditVacancyModal(null);
      setVacancyModal(null);
    },
  });

  const baseNodes = useMemo(
    () =>
      layout?.nodes.map((n) =>
        n.type === "orgNode"
          ? {
              ...n,
              style: { transition: "transform 450ms ease" },
              data: {
                ...n.data,
                highlighted: n.id === focusedId,
                onVacancyClick: (d: VacancyModalData) => {
                  const enriched = withReportVacancyFields(d, [
                    activeReportQuery.data,
                    archivedReportQuery.data,
                  ]);
                  if (enriched.id > 0) setEditVacancyModal(enriched);
                  else setVacancyModal(enriched);
                },
                onEditEmployeeClick: (employee: Employer) => {
                  const fromReport = employeeFromReports(employee.id, [
                    activeReportQuery.data,
                    archivedReportQuery.data,
                  ]);
                  updateEmployeeMutation.reset();
                  setSelectedEmployee(fromReport ?? employee);
                },
                onDeleteVacancyClick: (vacancy: Vacancy) => {
                  if (vacancy.employer?.id || vacancy.id <= 0) return;
                  const title =
                    vacancy.position?.name ?? vacancy.position?.code ?? "—";
                  if (window.confirm(`Удалить вакансию «${title}»?`)) {
                    deleteVacancyMutation.mutate(vacancy.id);
                  }
                },
                onAddVacancyClick: setAddVacancyModal,
              },
            }
          : n,
      ) ?? [],
    [
      layout?.nodes,
      focusedId,
      activeReportQuery.data,
      archivedReportQuery.data,
      updateEmployeeMutation.reset,
      deleteVacancyMutation.mutate,
    ],
  );

  const neighborhood = useMemo(
    () =>
      focusedId
        ? buildNeighborhood(baseNodes, focusedId, frame, expandedIds)
        : null,
    [baseNodes, focusedId, frame, expandedIds],
  );
  const expandedKey = useMemo(
    () => [...expandedIds].sort().join("\0"),
    [expandedIds],
  );
  const focusIds = useMemo(() => {
    if (!focusedId) return [];
    if (!neighborhood) return [focusedId];
    return [...neighborhood.memberIds];
  }, [focusedId, neighborhood]);

  const nodes = useMemo(() => {
    if (!neighborhood) return baseNodes;
    return baseNodes.map((node) => {
      const position = neighborhood.positions.get(node.id);
      const inCluster = neighborhood.memberIds.has(node.id);
      const isNeighbor = inCluster && node.id !== focusedId;
      const hideAdd =
        node.type === "addNode" &&
        neighborhood.memberIds.has(String(node.data.parentId));
      if (!position && !inCluster && !hideAdd) return node;
      return {
        ...node,
        position: position ?? node.position,
        hidden: hideAdd || node.hidden,
        zIndex: inCluster ? (node.id === focusedId ? 30 : 20) : node.zIndex,
        data: {
          ...node.data,
          neighbor: isNeighbor,
          toggleList: isNeighbor && neighborhood.compact,
          nearby:
            neighborhood.compact && isNeighbor && !expandedIds.has(node.id),
          onEditClick: () => openDeptEditor(node),
        },
      };
    });
  }, [baseNodes, neighborhood, focusedId, expandedIds, openDeptEditor]);

  const edges = useMemo(() => {
    const source = layout?.edges ?? [];
    if (!neighborhood) return source;
    return source.map((edge) => {
      const sourceIn = neighborhood.memberIds.has(edge.source);
      const targetIn = neighborhood.memberIds.has(edge.target);
      if (sourceIn && targetIn) return { ...edge, zIndex: 10, hidden: false };
      if (sourceIn || targetIn) return { ...edge, hidden: true };
      return edge;
    });
  }, [layout?.edges, neighborhood]);

  const departments = useMemo<ChartDepartment[]>(
    () =>
      (layout?.nodes ?? [])
        .filter((node) => node.type === "orgNode")
        .map((node) => ({
          id: node.id,
          name: String(node.data.label ?? ""),
          type: String(node.data.type ?? ""),
          code: String(node.data.code ?? ""),
        })),
    [layout?.nodes],
  );

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () =>
      setFrame({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isPending, isError]);

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        Загрузка оргструктуры…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        Ошибка: {formatApiError(error)}
      </div>
    );
  }

  return (
    <>
      <div ref={frameRef} className="absolute inset-0">
      <ReactFlow
        colorMode={colorMode}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        minZoom={0.1}
        onNodeClick={(_event, node) => {
          if (node.type === "addNode") {
            setDeptModal({
              mode: "create",
              parentId: node.data.parentId as string,
              parentLabel: node.data.parentLabel as string,
            });
          } else if (node.type === "orgNode") {
            const isNeighbor =
              !!focusedId &&
              neighborhood?.memberIds.has(node.id) &&
              node.id !== focusedId;
            if (isNeighbor) {
              const target = _event.target as HTMLElement | null;
              const onField = !!target?.closest?.("[data-dept-field]");
              if (neighborhood?.compact && onField && !target?.closest?.("[data-dept-edit]")) {
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.id)) next.delete(node.id);
                  else next.add(node.id);
                  return next;
                });
              }
              return;
            }
            openDeptEditor(node);
          }
        }}
      >
        <DepartmentSearch departments={departments} onHighlight={onHighlight} />
        <FocusCamera
          focusedId={focusedId}
          memberIds={focusIds}
          layoutKey={expandedKey}
        />
        <Background
          gap={24}
          size={1}
          bgColor={colorMode === "light" ? "transparent" : undefined}
          color={colorMode === "light" ? "rgba(23, 58, 64, 0.16)" : undefined}
        />
      </ReactFlow>
      </div>

      {deptModal && (
        <DeptModal
          state={deptModal}
          onClose={() => {
            createNodeMutation.reset();
            updateNodeMutation.reset();
            setDeptModal(null);
          }}
          isPending={
            createNodeMutation.isPending || updateNodeMutation.isPending
          }
          error={formatApiError(
            createNodeMutation.error ?? updateNodeMutation.error,
          )}
          onSubmit={(data) => {
            if (deptModal.mode === "create" && data.moveNodeId) {
              createNodeMutation.reset();
              updateNodeMutation.mutate({
                id: data.moveNodeId,
                body: {
                  code: data.code,
                  name: data.name,
                  type_code: data.type,
                  parent_id: Number(deptModal.parentId),
                },
              });
            } else if (deptModal.mode === "create") {
              updateNodeMutation.reset();
              createNodeMutation.mutate({
                code: data.code,
                name: data.name,
                type_code: data.type,
                parent_id: Number(deptModal.parentId),
              });
            } else {
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
            }
          }}
        />
      )}

      {vacancyModal && (
        <VacancyInfoModal
          data={vacancyModal}
          onClose={() => setVacancyModal(null)}
        />
      )}

      {addVacancyModal && (
        <CreateVacancyModal
          state={addVacancyModal}
          onClose={() => {
            createVacancyMutation.reset();
            setAddVacancyModal(null);
          }}
          isPending={createVacancyMutation.isPending}
          error={formatApiError(createVacancyMutation.error)}
          onSubmit={(data) => {
            createVacancyMutation.mutate({
              node_id: Number(addVacancyModal.deptId),
              position_code: data.position,
              position_name: data.position,
              city_code: data.cityCode,
              is_manager: data.isManager,
              position_description: data.description,
              job_offer_link: data.jobOffer,
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

      {deleteVacancyMutation.isError && (
        <ApiErrorModal
          error={deleteVacancyMutation.error}
          onClose={() => deleteVacancyMutation.reset()}
        />
      )}
    </>
  );
}
