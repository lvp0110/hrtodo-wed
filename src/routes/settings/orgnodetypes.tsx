import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { dictQueries, orgNodeTypesApi } from "#/services/api";
import { DictTable } from "#/components/settings/DictTable";
import {
  DictFormModal,
  Field,
  dictInputClass,
} from "#/components/settings/DictFormModal";
import type { OrgNodeType, OrgNodeTypeReq } from "#/types/api";

export const Route = createFileRoute("/settings/orgnodetypes")({
  component: OrgNodeTypesPage,
});

type FormState =
  | { mode: "create" }
  | { mode: "edit"; nodeType: OrgNodeType }
  | null;

function OrgNodeTypesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(null);

  const nodeTypesQuery = useQuery(dictQueries.nodeTypes);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dict", "nodeTypes"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: OrgNodeTypeReq) => orgNodeTypesApi.create(body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: OrgNodeTypeReq }) =>
      orgNodeTypesApi.update(id, body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => orgNodeTypesApi.delete(id),
    onSuccess: invalidate,
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setForm({ mode: "create" })}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Добавить тип
        </button>
      </div>

      <DictTable<OrgNodeType>
        columns={[
          {
            key: "code",
            header: "Код",
            render: (r) => <span className="font-mono text-xs">{r.code}</span>,
          },
          { key: "name", header: "Название", render: (r) => r.name },
        ]}
        rows={nodeTypesQuery.data ?? []}
        rowKey={(r) => r.id}
        onEdit={(nodeType) => setForm({ mode: "edit", nodeType })}
        onDelete={(nodeType) => {
          if (confirm(`Удалить тип «${nodeType.name}»?`)) {
            deleteMutation.mutate(nodeType.id);
          }
        }}
        isLoading={nodeTypesQuery.isPending}
        isError={nodeTypesQuery.isError}
        errorMessage={nodeTypesQuery.error?.message}
      />

      {form && (
        <OrgNodeTypeFormModal
          state={form}
          isPending={
            form.mode === "create"
              ? createMutation.isPending
              : updateMutation.isPending
          }
          error={
            (form.mode === "create"
              ? createMutation.error?.message
              : updateMutation.error?.message) ?? null
          }
          onClose={() => {
            createMutation.reset();
            updateMutation.reset();
            setForm(null);
          }}
          onSubmit={(data) => {
            if (form.mode === "create") {
              createMutation.mutate(data);
            } else {
              updateMutation.mutate({ id: form.nodeType.id, body: data });
            }
          }}
        />
      )}
    </>
  );
}

interface OrgNodeTypeFormModalProps {
  state: Exclude<FormState, null>;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: OrgNodeTypeReq) => void;
}

function OrgNodeTypeFormModal({
  state,
  isPending,
  error,
  onClose,
  onSubmit,
}: OrgNodeTypeFormModalProps) {
  const isEdit = state.mode === "edit";
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<OrgNodeTypeReq>({
    mode: "onChange",
    defaultValues: isEdit
      ? { code: state.nodeType.code, name: state.nodeType.name }
      : { code: "", name: "" },
  });

  return (
    <DictFormModal
      title={isEdit ? "Редактировать тип" : "Новый тип"}
      subtitle={isEdit ? state.nodeType.name : undefined}
      onClose={onClose}
      onSubmit={handleSubmit(onSubmit)}
      isPending={isPending}
      canSubmit={isValid}
      error={error}
      submitLabel={isEdit ? "Сохранить" : "Создать"}
      pendingLabel={isEdit ? "Сохраняем…" : "Создаём…"}
    >
      <Field label="Код" required error={errors.code?.message}>
        <input
          {...register("code", { required: "Обязательное поле" })}
          autoFocus
          placeholder="Например: DEPT"
          className={`${dictInputClass} ${errors.code ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        />
      </Field>

      <Field label="Название" required error={errors.name?.message}>
        <input
          {...register("name", { required: "Обязательное поле" })}
          placeholder="Например: Отдел"
          className={`${dictInputClass} ${errors.name ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        />
      </Field>
    </DictFormModal>
  );
}
