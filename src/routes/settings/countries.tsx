import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { countriesApi, dictQueries } from "#/services/api";
import { DictTable } from "#/components/settings/DictTable";
import {
  DictFormModal,
  Field,
  dictInputClass,
} from "#/components/settings/DictFormModal";
import type { Country, CountryReq } from "#/types/api";

export const Route = createFileRoute("/settings/countries")({
  component: CountriesPage,
});

type FormState =
  | { mode: "create" }
  | { mode: "edit"; country: Country }
  | null;

function CountriesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(null);

  const countriesQuery = useQuery(dictQueries.countries);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dict", "countries"] });
    // Cities показывают страну по country_id — освежим и их.
    queryClient.invalidateQueries({ queryKey: ["dict", "cities"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: CountryReq) => countriesApi.create(body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: CountryReq }) =>
      countriesApi.update(id, body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => countriesApi.delete(id),
    onSuccess: invalidate,
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Список стран используется при создании городов.
        </p>
        <button
          type="button"
          onClick={() => setForm({ mode: "create" })}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Добавить страну
        </button>
      </div>

      <DictTable<Country>
        columns={[
          {
            key: "code",
            header: "Код",
            render: (r) => <span className="font-mono text-xs">{r.code}</span>,
          },
          { key: "name", header: "Название", render: (r) => r.name },
        ]}
        rows={countriesQuery.data ?? []}
        rowKey={(r) => r.id}
        onEdit={(country) => setForm({ mode: "edit", country })}
        onDelete={(country) => {
          if (confirm(`Удалить страну «${country.name}»?`)) {
            deleteMutation.mutate(country.id);
          }
        }}
        isLoading={countriesQuery.isPending}
        isError={countriesQuery.isError}
        errorMessage={countriesQuery.error?.message}
      />

      {form && (
        <CountryFormModal
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
              updateMutation.mutate({ id: form.country.id, body: data });
            }
          }}
        />
      )}
    </>
  );
}

interface CountryFormModalProps {
  state: Exclude<FormState, null>;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: CountryReq) => void;
}

function CountryFormModal({
  state,
  isPending,
  error,
  onClose,
  onSubmit,
}: CountryFormModalProps) {
  const isEdit = state.mode === "edit";
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CountryReq>({
    mode: "onChange",
    defaultValues: isEdit
      ? { code: state.country.code, name: state.country.name }
      : { code: "", name: "" },
  });

  return (
    <DictFormModal
      title={isEdit ? "Редактировать страну" : "Новая страна"}
      subtitle={isEdit ? state.country.name : undefined}
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
          placeholder="Например: KZ"
          className={`${dictInputClass} ${errors.code ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        />
      </Field>

      <Field label="Название" required error={errors.name?.message}>
        <input
          {...register("name", { required: "Обязательное поле" })}
          placeholder="Например: Казахстан"
          className={`${dictInputClass} ${errors.name ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        />
      </Field>
    </DictFormModal>
  );
}
