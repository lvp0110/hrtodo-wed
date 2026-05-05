import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactFlow, Background } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { orgNodesApi, vacanciesApi } from "#/services/api";
import { buildLayout } from "#/lib/orgTreeLayout";
import { OrgNodeCard } from "#/components/OrgNodeCard";
import { AddNodeCard } from "#/components/AddNodeCard";
import { DeptModal } from "#/components/DeptModal";
import { VacancyInfoModal } from "#/components/VacancyInfoModal";
import { CreateVacancyModal } from "#/components/CreateVacancyModal";
import type { NodeCreateReq, OrgNode, VacancyReq } from "#/types/api";
import type {
  AddVacancyState,
  DeptModalState,
  VacancyModalData,
} from "#/types/orgChart";

const nodeTypes = { orgNode: OrgNodeCard, addNode: AddNodeCard };

export function OrgChart() {
  const queryClient = useQueryClient();
  const [deptModal, setDeptModal] = useState<DeptModalState | null>(null);
  const [vacancyModal, setVacancyModal] = useState<VacancyModalData | null>(
    null,
  );
  const [addVacancyModal, setAddVacancyModal] =
    useState<AddVacancyState | null>(null);

  const {
    data: layout,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["orgTree"],
    queryFn: () =>
      orgNodesApi
        .getTreeVacancies()
        .then((res) => buildLayout(res.data as OrgNode[])),
  });

  const createNodeMutation = useMutation({
    mutationFn: (body: NodeCreateReq) => orgNodesApi.createNode(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      setDeptModal(null);
    },
  });

  const createVacancyMutation = useMutation({
    mutationFn: (body: VacancyReq) => vacanciesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      setAddVacancyModal(null);
    },
  });

  const nodes = useMemo(
    () =>
      layout?.nodes.map((n) =>
        n.type === "orgNode"
          ? {
              ...n,
              data: {
                ...n.data,
                onVacancyClick: setVacancyModal,
                onAddVacancyClick: setAddVacancyModal,
              },
            }
          : n,
      ) ?? [],
    [layout?.nodes],
  );

  const edges = layout?.edges ?? [];

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
        Ошибка: {error.message}
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
      </ReactFlow>

      {deptModal && (
        <DeptModal
          state={deptModal}
          onClose={() => {
            createNodeMutation.reset();
            setDeptModal(null);
          }}
          isPending={
            deptModal.mode === "create" && createNodeMutation.isPending
          }
          error={
            deptModal.mode === "create" && createNodeMutation.error
              ? createNodeMutation.error.message
              : null
          }
          onSubmit={(data) => {
            if (deptModal.mode === "create") {
              createNodeMutation.mutate({
                code: data.code,
                name: data.name,
                type_code: data.type,
                parent_id: Number(deptModal.parentId),
              });
            } else {
              console.log("Сохранить отдел:", { id: deptModal.id, ...data });
              setDeptModal(null);
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
          error={createVacancyMutation.error?.message ?? null}
          onSubmit={(data) => {
            createVacancyMutation.mutate({
              node_id: Number(addVacancyModal.deptId),
              position_code: data.position,
              position_name: data.position,
              city_code: data.city,
              is_manager: data.isManager,
            });
          }}
        />
      )}
    </>
  );
}
