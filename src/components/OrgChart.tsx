import { useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { orgNodesApi } from "#/services/api";
import { buildLayout } from "#/lib/orgTreeLayout";
import type { OrgNode, Vacancy, EmptyVacancy } from "#/types/api";

function employerName(v: Vacancy): string {
  if (!v.Employer.ID) return "Вакантно";
  const { FirstName, SecondName, Surname } = v.Employer;
  return [Surname, FirstName, SecondName].filter(Boolean).join(" ");
}

function OrgNodeCard({ data }: NodeProps) {
  const { label, type, isLeaf, isRoot, vacancies, emptyVacancies } = data as {
    label: string;
    type: string;
    code: string;
    isLeaf: boolean;
    isRoot: boolean;
    vacancies: Vacancy[];
    emptyVacancies: EmptyVacancy[];
  };

  const hasVacancies = vacancies.length > 0 || emptyVacancies.length > 0;

  return (
    <>
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 w-[280px] overflow-hidden">
        <div className="px-4 py-3 bg-slate-600 dark:bg-slate-700">
          <div className="text-xs text-slate-300 font-medium uppercase tracking-wide">
            {type}
          </div>
          <div className="text-sm font-semibold leading-tight text-white mt-0.5">
            {label}
          </div>
        </div>

        {hasVacancies && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {vacancies.map((v, i) => (
              <li key={i} className="px-4 py-1.5">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                  {v.Position.Name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-xs truncate ${v.Employer.ID ? "text-gray-600 dark:text-gray-400" : "text-amber-500"}`}
                  >
                    {employerName(v)}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600 text-xs">
                    ·
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {v.City.Name}
                  </span>
                </div>
              </li>
            ))}
            {emptyVacancies.map((v, i) => (
              <li key={`empty-${i}`} className="px-4 py-1.5">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                  {v.Position.Name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-amber-500">Вакантно</span>
                  <span className="text-gray-300 dark:text-gray-600 text-xs">
                    ·
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {v.City.Name}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!isLeaf && <Handle type="source" position={Position.Bottom} />}
    </>
  );
}

const nodeTypes = { orgNode: OrgNodeCard };

export function OrgChart() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    orgNodesApi
      .getTreeVacancies()
      .then((res) => {
        const { nodes, edges } = buildLayout(res.data as OrgNode[]);
        setNodes(nodes);
        setEdges(edges);
        setRootId(nodes.find((n) => n.data.isRoot)?.id ?? null);
        setStatus("ok");
      })
      .catch((err: Error) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        Загрузка оргструктуры…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        Ошибка: {error}
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      nodesDraggable={false}
      fitViewOptions={{
        padding: 1.5,
        nodes: rootId ? [{ id: rootId }] : undefined,
      }}
      minZoom={0.1}
    >
      <Background gap={24} size={1} />
      <Controls />
      <MiniMap nodeStrokeWidth={3} zoomable pannable />
    </ReactFlow>
  );
}
