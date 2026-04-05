import { useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { orgNodesApi } from "#/services/api";
import { buildLayout } from "#/lib/orgTreeLayout";
import { OrgNodeCard } from "#/components/OrgNodeCard";
import { AddNodeCard } from "#/components/AddNodeCard";
import { DeptModal } from "#/components/DeptModal";
import { VacancyInfoModal } from "#/components/VacancyInfoModal";
import type { DeptModalState, VacancyModalData } from "#/types/orgChart";

const nodeTypes = { orgNode: OrgNodeCard, addNode: AddNodeCard };

export function OrgChart() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [error, setError] = useState<string>("");
  const [deptModal, setDeptModal] = useState<DeptModalState | null>(null);
  const [vacancyModal, setVacancyModal] = useState<VacancyModalData | null>(null);

  useEffect(() => {
    orgNodesApi
      .getTreeVacancies()
      .then((res) => {
        const { nodes, edges } = buildLayout(res.data);
        const enriched = nodes.map((n) =>
          n.type === "orgNode"
            ? { ...n, data: { ...n.data, onVacancyClick: setVacancyModal } }
            : n,
        );
        setNodes(enriched);
        setEdges(edges);
        setRootId(enriched.find((n) => n.data.isRoot)?.id ?? null);
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
            setDeptModal({
              mode: "create",
              parentId: node.data.parentId as string,
              parentLabel: node.data.parentLabel as string,
            });
          } else if (node.type === "orgNode") {
            setDeptModal({
              mode: "edit",
              id: node.id,
              name: node.data.label as string,
              type: node.data.type as string,
              code: node.data.code as string,
            });
          }
        }}
      >
        <Background gap={24} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>

      {deptModal && (
        <DeptModal
          state={deptModal}
          onClose={() => setDeptModal(null)}
          onSubmit={(data) => {
            if (deptModal.mode === "create") {
              console.log("Создать отдел:", { parentId: deptModal.parentId, ...data });
            } else {
              console.log("Сохранить отдел:", { id: deptModal.id, ...data });
            }
            setDeptModal(null);
          }}
        />
      )}

      {vacancyModal && (
        <VacancyInfoModal
          data={vacancyModal}
          onClose={() => setVacancyModal(null)}
        />
      )}
    </>
  );
}
