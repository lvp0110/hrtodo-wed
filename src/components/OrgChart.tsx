import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { buildLayout, ADD_NODE_WIDTH, ADD_NODE_HEIGHT } from "#/lib/orgTreeLayout";
import type { Vacancy, EmptyVacancy } from "#/types/api";

function employerName(v: Vacancy): string {
  if (!v.Employer.ID) return "Вакантно";
  const { FirstName, SecondName, Surname } = v.Employer;
  return [Surname, FirstName, SecondName].filter(Boolean).join(" ");
}

function OrgNodeCard({ data }: NodeProps) {
  const { label, type, isRoot, vacancies, emptyVacancies } = data as {
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
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

function AddNodeCard() {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div
        style={{ width: ADD_NODE_WIDTH, height: ADD_NODE_HEIGHT }}
        className="group flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 cursor-pointer transition-colors shadow-sm"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-current transition-colors">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span className="text-sm font-medium">Добавить отдел</span>
      </div>
    </>
  );
}

interface CreateDeptModalProps {
  parentLabel: string;
  onClose: () => void;
  onSubmit: (data: CreateDeptFields) => void;
}

type CreateDeptFields = { name: string; type: string; code: string };

function CreateDeptModal({ parentLabel, onClose, onSubmit }: CreateDeptModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateDeptFields>({ mode: "onChange" });

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
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Новый отдел
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Родитель: {parentLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Название <span className="text-red-400">*</span>
            </label>
            <input
              {...register("name", { required: "Обязательное поле" })}
              autoFocus
              placeholder="Например: Отдел маркетинга"
              className={`${inputClass} ${errors.name ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Тип
            </label>
            <input
              {...register("type")}
              placeholder="Например: Департамент"
              className={`${inputClass} border-gray-200 dark:border-gray-700`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Код
            </label>
            <input
              {...register("code")}
              placeholder="Например: MKT"
              className={`${inputClass} border-gray-200 dark:border-gray-700`}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const nodeTypes = { orgNode: OrgNodeCard, addNode: AddNodeCard };

export function OrgChart() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [error, setError] = useState<string>("");
  const [modal, setModal] = useState<{
    parentId: string;
    parentLabel: string;
  } | null>(null);

  useEffect(() => {
    orgNodesApi
      .getTreeVacancies()
      .then((res) => {
        const { nodes, edges } = buildLayout(res.data);
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
    <>
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
        onNodeClick={(_event, node) => {
          if (node.type === "addNode") {
            setModal({
              parentId: node.data.parentId as string,
              parentLabel: node.data.parentLabel as string,
            });
          }
        }}
      >
        <Background gap={24} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>

      {modal && (
        <CreateDeptModal
          parentLabel={modal.parentLabel}
          onClose={() => setModal(null)}
          onSubmit={(data) => {
            console.log("Создать отдел:", { parentId: modal.parentId, ...data });
            setModal(null);
          }}
        />
      )}
    </>
  );
}
