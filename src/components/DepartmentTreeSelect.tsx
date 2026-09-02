import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { dictInputClass } from "#/components/settings/DictFormModal";
import {
  ancestorIdsForNode,
  expandableDepartmentIds,
  filterDepartmentTree,
  findOrgNodeById,
  findOrgNodeByName,
  getDepartmentTree,
} from "#/lib/orgTree";
import type { OrgNode } from "#/types/api";

type DepartmentTreeSelectBaseProps = {
  tree: OrgNode[];
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
};

type DepartmentTreeSelectProps = DepartmentTreeSelectBaseProps &
  (
    | {
        variant: "filter";
        value: string;
        onChange: (value: string) => void;
      }
    | {
        variant: "node";
        value: number;
        onChange: (value: number) => void;
        placeholder?: string;
      }
  );

function isSelected(
  variant: "filter" | "node",
  value: string | number,
  node: OrgNode,
): boolean {
  return variant === "filter" ? value === node.name : value === node.id;
}

function TreeRow({
  node,
  depth,
  variant,
  value,
  expandedIds,
  onToggle,
  onSelect,
  compact,
}: {
  node: OrgNode;
  depth: number;
  variant: "filter" | "node";
  value: string | number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  onSelect: (node: OrgNode) => void;
  compact?: boolean;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedIds.has(node.id);
  const selected = isSelected(variant, value, node);
  const rowClass = compact
    ? "px-2 py-1.5 text-xs"
    : "px-3 py-2 text-sm";

  return (
    <>
      <div
        className={`flex w-full min-w-0 items-start gap-0.5 ${rowClass} ${
          selected
            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
            : "text-gray-800 dark:text-gray-200"
        }`}
        style={{ paddingLeft: `${depth * 12 + (compact ? 8 : 12)}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="mt-0.5 shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label={isExpanded ? "Свернуть" : "Развернуть"}
          >
            <ChevronRight
              size={compact ? 14 : 16}
              className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className={`mt-0.5 shrink-0 ${compact ? "w-[18px]" : "w-5"}`} />
        )}
        <button
          type="button"
          onClick={() => onSelect(node)}
          className="min-w-0 flex-1 text-left leading-snug break-words hover:underline"
        >
          {node.name}
        </button>
      </div>
      {hasChildren &&
        isExpanded &&
        node.children!.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            variant={variant}
            value={value}
            expandedIds={expandedIds}
            onToggle={onToggle}
            onSelect={onSelect}
            compact={compact}
          />
        ))}
    </>
  );
}

export function DepartmentTreeSelect(props: DepartmentTreeSelectProps) {
  const {
    tree,
    isLoading = false,
    disabled = false,
    className = "",
    compact = false,
    variant,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  const { rootLabel, departments } = useMemo(
    () => getDepartmentTree(tree),
    [tree],
  );

  const selectedLabel = useMemo(() => {
    if (variant === "filter") {
      if (!props.value) return rootLabel;
      return findOrgNodeByName(departments, props.value)?.name ?? props.value;
    }

    if (!props.value) {
      return props.placeholder ?? "Выберите отдел";
    }

    return (
      findOrgNodeById(departments, props.value)?.name ??
      props.placeholder ??
      "Выберите отдел"
    );
  }, [variant, props, rootLabel, departments]);

  const filteredDepartments = useMemo(
    () => filterDepartmentTree(departments, searchQuery),
    [departments, searchQuery],
  );

  const effectiveExpandedIds = useMemo(() => {
    if (!searchQuery.trim()) return expandedIds;
    return new Set([
      ...expandedIds,
      ...expandableDepartmentIds(filteredDepartments),
    ]);
  }, [expandedIds, filteredDepartments, searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      return;
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (variant === "node" && props.value) {
      const ancestors = ancestorIdsForNode(departments, props.value);
      if (!ancestors?.length) return;
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of ancestors) next.add(id);
        return next;
      });
      return;
    }

    if (variant === "filter" && props.value) {
      const selected = findOrgNodeByName(departments, props.value);
      if (!selected) return;
      const ancestors = ancestorIdsForNode(departments, selected.id);
      if (!ancestors?.length) return;
      setExpandedIds((prev) => {
        const next = new Set(prev);
        for (const id of ancestors) next.add(id);
        return next;
      });
    }
  }, [variant, props.value, departments]);

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectRoot() {
    if (variant === "filter") props.onChange("");
    else props.onChange(0);
    setIsOpen(false);
  }

  function selectNode(node: OrgNode) {
    if (variant === "filter") props.onChange(node.name);
    else props.onChange(node.id);
    setIsOpen(false);
  }

  const triggerClass = compact
    ? `${dictInputClass} w-full px-2 py-1.5 text-xs text-left`
    : `${dictInputClass} w-full text-left`;
  const panelRowClass = compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm";
  const searchInputClass = compact
    ? `${dictInputClass} px-2 py-1.5 text-xs`
    : dictInputClass;

  const rootSelected =
    variant === "filter" ? props.value === "" : props.value === 0;

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`${triggerClass} w-full min-w-0 disabled:opacity-60`}
      >
        <span
          className="block truncate"
          title={isLoading ? undefined : selectedLabel}
        >
          {isLoading ? "Загрузка…" : selectedLabel}
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 flex max-h-72 w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <button
            type="button"
            role="option"
            aria-selected={rootSelected}
            onClick={selectRoot}
            className={`block w-full min-w-0 shrink-0 text-left leading-snug break-words ${panelRowClass} ${
              rootSelected
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            {rootLabel}
          </button>

          <div className="shrink-0 border-b border-gray-100 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Поиск отдела…"
              aria-label="Поиск отдела"
              className={searchInputClass}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {filteredDepartments.length === 0 ? (
              <p
                className={`${panelRowClass} text-gray-400 dark:text-gray-500`}
              >
                Ничего не найдено
              </p>
            ) : (
              filteredDepartments.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  variant={variant}
                  value={variant === "filter" ? props.value : props.value}
                  expandedIds={effectiveExpandedIds}
                  onToggle={toggleExpanded}
                  onSelect={selectNode}
                  compact={compact}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
