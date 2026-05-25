import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { citiesApi, dictQueries } from "#/services/api";
import { DictTable } from "#/components/settings/DictTable";
import {
  DictFormModal,
  Field,
  dictInputClass,
} from "#/components/settings/DictFormModal";
import type { City, CityReq } from "#/types/api";

export const Route = createFileRoute("/settings/cities")({ component: CitiesPage });

type FormState =
  | { mode: "create" }
  | { mode: "edit"; city: City }
  | null;

interface FormFields {
  code: string;
  name: string;
  country_id: number;
}

function CitiesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(null);

  const citiesQuery = useQuery(dictQueries.cities);
  const countriesQuery = useQuery(dictQueries.countries);

  const countryById = useMemo(() => {
    const map = new Map<number, string>();
    countriesQuery.data?.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [countriesQuery.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dict", "cities"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: CityReq) => citiesApi.create(body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: CityReq }) =>
      citiesApi.update(id, body),
    onSuccess: () => {
      invalidate();
      setForm(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => citiesApi.delete(id),
    onSuccess: invalidate,
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Города, доступные при создании вакансий.
        </p>
        <button
          type="button"
          onClick={() => setForm({ mode: "create" })}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Добавить город
        </button>
      </div>

      <DictTable<City>
        columns={[
          {
            key: "code",
            header: "Код",
            render: (r) => <span className="font-mono text-xs">{r.code}</span>,
          },
          { key: "name", header: "Название", render: (r) => r.name },
          {
            key: "country",
            header: "Страна",
            render: (r) =>
              countryById.get(r.country_id) ?? (
                <span className="text-gray-400">—</span>
              ),
          },
        ]}
        rows={citiesQuery.data ?? []}
        rowKey={(r) => r.id}
        onEdit={(city) => setForm({ mode: "edit", city })}
        onDelete={(city) => {
          if (confirm(`Удалить город «${city.name}»?`)) {
            deleteMutation.mutate(city.id);
          }
        }}
        isLoading={citiesQuery.isPending}
        isError={citiesQuery.isError}
        errorMessage={citiesQuery.error?.message}
      />

      {form && (
        <CityFormModal
          state={form}
          countries={countriesQuery.data ?? []}
          countriesLoading={countriesQuery.isPending}
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
              updateMutation.mutate({ id: form.city.id, body: data });
            }
          }}
        />
      )}
    </>
  );
}

interface CityFormModalProps {
  state: Exclude<FormState, null>;
  countries: { id: number; name: string }[];
  countriesLoading: boolean;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: CityReq) => void;
}

function CityFormModal({
  state,
  countries,
  countriesLoading,
  isPending,
  error,
  onClose,
  onSubmit,
}: CityFormModalProps) {
  const isEdit = state.mode === "edit";
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormFields>({
    mode: "onChange",
    defaultValues: isEdit
      ? {
          code: state.city.code,
          name: state.city.name,
          country_id: state.city.country_id,
        }
      : { code: "", name: "", country_id: 0 },
  });

  return (
    <DictFormModal
      title={isEdit ? "Редактировать город" : "Новый город"}
      subtitle={isEdit ? state.city.name : undefined}
      onClose={onClose}
      onSubmit={handleSubmit((data) =>
        onSubmit({
          code: data.code,
          name: data.name,
          country_id: Number(data.country_id),
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
          placeholder="Например: ALM"
          className={`${dictInputClass} ${errors.code ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        />
      </Field>

      <Field label="Название" required error={errors.name?.message}>
        <input
          {...register("name", { required: "Обязательное поле" })}
          placeholder="Например: Алматы"
          className={`${dictInputClass} ${errors.name ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}`}
        />
      </Field>

      <Field label="Страна" required error={errors.country_id?.message}>
        <select
          {...register("country_id", {
            required: "Обязательное поле",
            valueAsNumber: true,
            validate: (v) => v > 0 || "Выберите страну",
          })}
          disabled={countriesLoading}
          className={`${dictInputClass} ${errors.country_id ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"} disabled:opacity-60`}
        >
          <option value={0} disabled hidden>
            {countriesLoading ? "Загрузка…" : "Выберите страну"}
          </option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
    </DictFormModal>
  );
}
