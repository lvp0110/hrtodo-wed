import { useState } from "react";
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
import type { CityReq, Entity } from "#/types/api";

export const Route = createFileRoute("/settings/cities")({ component: CitiesPage });

interface FormFields {
  code: string;
  name: string;
  country_id: number;
}

function CitiesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const citiesQuery = useQuery(dictQueries.cities);
  const countriesQuery = useQuery(dictQueries.countries);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dict", "cities"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: CityReq) => citiesApi.create(body),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
    },
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Добавить город
        </button>
      </div>

      <DictTable<Entity>
        columns={[
          {
            key: "code",
            header: "Код",
            render: (r) => <span className="font-mono text-xs">{r.code}</span>,
          },
          { key: "name", header: "Название", render: (r) => r.name },
        ]}
        rows={citiesQuery.data ?? []}
        rowKey={(r) => r.code}
        isLoading={citiesQuery.isPending}
        isError={citiesQuery.isError}
        errorMessage={citiesQuery.error?.message}
      />

      {createOpen && (
        <CityFormModal
          countries={countriesQuery.data ?? []}
          countriesLoading={countriesQuery.isPending}
          isPending={createMutation.isPending}
          error={createMutation.error?.message ?? null}
          onClose={() => {
            createMutation.reset();
            setCreateOpen(false);
          }}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}
    </>
  );
}

interface CityFormModalProps {
  countries: { id: number; name: string }[];
  countriesLoading: boolean;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: CityReq) => void;
}

function CityFormModal({
  countries,
  countriesLoading,
  isPending,
  error,
  onClose,
  onSubmit,
}: CityFormModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormFields>({
    mode: "onChange",
    defaultValues: { code: "", name: "", country_id: 0 },
  });

  return (
    <DictFormModal
      title="Новый город"
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
      submitLabel="Создать"
      pendingLabel="Создаём…"
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
