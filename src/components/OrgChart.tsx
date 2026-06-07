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
import { EditVacancyModal } from "#/components/EditVacancyModal";
import type {
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
  const queryClient = useQueryClient();
  const [deptModal, setDeptModal] = useState<DeptModalState | null>(null);
  const [vacancyModal, setVacancyModal] = useState<VacancyModalData | null>(
    null,
  );
  const [addVacancyModal, setAddVacancyModal] =
    useState<AddVacancyState | null>(null);
  const [editVacancyModal, setEditVacancyModal] =
    useState<VacancyModalData | null>(null);

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
      queryClient.setQueryData<OrgNode[]>(["orgTree"], (old) =>
        old ? upsertVacancy(old, vacancy) : old,
      );
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
      setEditVacancyModal(null);
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
                onVacancyClick: (d: VacancyModalData) => {
                  // Заполненную вакансию (есть id) сразу открываем в форме редактирования.
                  // Пустую (id === 0, пришла из empty_vacancy) показываем read-only.
                  if (d.id > 0) setEditVacancyModal(d);
                  else setVacancyModal(d);
                },
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
              parentId: (node.data.parentId as string | null) ?? null,
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
            updateNodeMutation.reset();
            setDeptModal(null);
          }}
          isPending={
            deptModal.mode === "create"
              ? createNodeMutation.isPending
              : updateNodeMutation.isPending
          }
          error={
            (deptModal.mode === "create"
              ? createNodeMutation.error?.message
              : updateNodeMutation.error?.message) ?? null
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
          error={createVacancyMutation.error?.message ?? null}
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
          error={updateVacancyMutation.error?.message ?? null}
          onSubmit={(data) => {
            updateVacancyMutation.mutate({
              id: editVacancyModal.id,
              body: {
                node_id: editVacancyModal.nodeId,
                user_id: data.userId,
                city_code: data.cityCode,
                position_code: data.position,
                position_name: data.position,
                is_manager: data.isManager,
                position_description: data.description,
                job_offer_link: data.jobOffer,
              },
            });
          }}
        />
      )}
    </>
  );
}
