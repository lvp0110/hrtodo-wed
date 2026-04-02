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
import type { OrgNode } from "#/types/api";

function OrgNodeCard({ data }: NodeProps) {
  const { label, type, isLeaf, isRoot } = data as {
    label: string;
    type: string;
    code: string;
    isLeaf: boolean;
    isRoot: boolean;
  };
  return (
    <>
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800 min-w-[180px]">
        <div className="text-xs text-gray-400 dark:text-gray-500">{type}</div>
        <div className="text-sm font-medium leading-tight text-gray-900 dark:text-gray-100 mt-0.5">
          {label}
        </div>
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
