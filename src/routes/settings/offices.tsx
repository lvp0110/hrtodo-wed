import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { dictQueries, officesApi } from "#/services/api";
import { DictTable } from "#/components/settings/DictTable";
import {
  DictFormModal,
  Field,
  dictInputClass,
} from "#/components/settings/DictFormModal";
import type { City, Office, OfficeReq } from "#/types/api";

export const Route = createFileRoute("/settings/offices")({
  component: OfficesPage,
});

type FormState = { mode: "create" } | { mode: "edit"; office: Office } | null;

function OfficesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(null);

  const citiesQuery = useQuery(dictQueries.cities);
  const cities = citiesQuery.data ?? [];

  const officesByCityQueries = useQueries({
    queries: cities.map((city) => ({
      queryKey: ["offices", "city", city.id] as const,
      queryFn: () => officesApi.getByCity(city.id).then((res) => res.data ?? []),
    })),
  });

  const offices = cities.flatMap(
    (_, index) => officesByCityQueries[index]?.data ?? [],
  );
  const officesPending =
    cities.length > 0 && officesByCityQueries.some((query) => query.isPending);
  const officesError = officesByCityQueries.find((query) => query.isError);

  const cityName = (id: number) =>
    cities.find((city) => city.id === id)?.name ?? "—";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["offices"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: OfficeReq) => officesApi.create(body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: OfficeReq }) =>
      officesApi.update(id, body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => officesApi.delete(id),
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
          Добавить офис
        </button>
      </div>

      {deleteMutation.isError && (
        <p className="mb-3 text-sm text-red-500 dark:text-red-400">
          {deleteMutation.error.message}
        </p>
      )}

      <DictTable<Office>
        columns={[
          {
            key: "code",
            header: "Код",
            render: (r) => <span className="font-mono text-xs">{r.code}</span>,
          },
          { key: "name", header: "Название", render: (r) => r.name },
          {
            key: "city",
            header: "Город",
            render: (r) => cityName(r.city_id),
          },
        ]}
        rows={offices}
        rowKey={(r) => r.id}
        onEdit={(office) => setForm({ mode: "edit", office })}
        onDelete={(office) => {
          if (confirm(`Удалить офис «${office.name}»?`)) {
            deleteMutation.mutate(office.id);
          }
        }}
        isLoading={citiesQuery.isPending || officesPending}
        isError={citiesQuery.isError || Boolean(officesError)}
        errorMessage={
          citiesQuery.error?.message ?? officesError?.error?.message
        }
      />

      {form && (
        <OfficeFormModal
          state={form}
          cities={cities}
          citiesLoading={citiesQuery.isPending}
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
              updateMutation.mutate({ id: form.office.id, body: data });
            }
          }}
        />
      )}
    </>
  );
}

interface OfficeFormModalProps {
  state: Exclude<FormState, null>;
  cities: City[];
  citiesLoading: boolean;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: OfficeReq) => void;
}

interface FormFields {
  code: string;
  name: string;
  city_id: number;
}

function OfficeFormModal({
  state,
  cities,
  citiesLoading,
  isPending,
  error,
  onClose,
  onSubmit,
}: OfficeFormModalProps) {
  const isEdit = state.mode === "edit";
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormFields>({
    mode: "onChange",
    defaultValues: isEdit
      ? {
          code: state.office.code,
          name: state.office.name,
          city_id: state.office.city_id,
        }
      : { code: "", name: "", city_id: 0 },
  });

  return (
    <DictFormModal
      title={isEdit ? "Редактировать офис" : "Новый офис"}
      subtitle={isEdit ? state.office.name : undefined}
      onClose={onClose}
      onSubmit={handleSubmit((data) =>
        onSubmit({
          code: data.code,
          name: data.name,
          city_id: Number(data.city_id),
        }),
      )}
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
          placeholder="Например: HQ"
          className={`${dictInputClass} ${errors.code ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        />
      </Field>

      <Field label="Название" required error={errors.name?.message}>
        <input
          {...register("name", { required: "Обязательное поле" })}
          placeholder="Например: Головной офис"
          className={`${dictInputClass} ${errors.name ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        />
      </Field>

      <Field label="Город" required error={errors.city_id?.message}>
        <select
          {...register("city_id", {
            required: "Обязательное поле",
            valueAsNumber: true,
            validate: (v) => v > 0 || "Выберите город",
          })}
          disabled={citiesLoading}
          className={`${dictInputClass} ${errors.city_id ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"} disabled:opacity-60`}
        >
          <option value={0} disabled hidden>
            {citiesLoading ? "Загрузка…" : "Выберите город"}
          </option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </Field>
    </DictFormModal>
  );
}
