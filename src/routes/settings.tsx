import { useState } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { CommentHeadingIcon } from "#/components/CommentHeadingIcon";
import { PageDescription } from "#/components/PageHints";
import {
  VacationAccountingSettings,
  vacationAccountingHint,
  type VacationAccountingTab,
} from "#/components/VacationAccountingSettings";

export const Route = createFileRoute("/settings")({ component: SettingsLayout });

const tabs = [
  { to: "/settings/cities", label: "Города", hint: "Открывает справочник городов" },
  { to: "/settings/offices", label: "Офисы", hint: "Открывает справочник офисов" },
  { to: "/settings/countries", label: "Страны", hint: "Открывает справочник стран" },
  {
    to: "/settings/orgnodetypes",
    label: "Типы отделов",
    hint: "Открывает справочник типов отделов на схеме",
  },
] as const;

const vacationTabs: { id: VacationAccountingTab; label: string; hint: string }[] = [
  {
    id: "entities",
    label: "Юрлица",
    hint: "Список юридических лиц: их можно добавить, изменить и деактивировать",
  },
  {
    id: "positions",
    label: "Должности",
    hint: "Штатные должности юрлица и привязка сотрудников с выбором начальника",
  },
  {
    id: "managers",
    label: "Руководители",
    hint: "Учётные назначения сотрудников с признаком руководителя",
  },
  {
    id: "schedule",
    label: "График",
    hint: "Показывает годовой график по всем юрлицам. Фильтр оставляет одно юридическое лицо",
  },
  {
    id: "notifications",
    label: "Уведомления",
    hint: "Общая настройка уведомлений об отпуске и отдельные настройки юридических лиц",
  },
];

function SettingsLayout() {
  const [vacationMode, setVacationMode] = useState(false);
  const [vacationTab, setVacationTab] = useState<VacationAccountingTab>("entities");

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-8 pt-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            Настройки справочников
            <CommentHeadingIcon />
          </h1>
          <div
            role="group"
            aria-label="Раздел настроек"
            className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700"
          >
            <button
              type="button"
              aria-pressed={!vacationMode}
              onClick={() => setVacationMode(false)}
              data-hint="Показывает справочники городов, офисов, стран и типов отделов"
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                vacationMode
                  ? "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                  : "bg-blue-600 text-white"
              }`}
            >
              Справочники
            </button>
            <button
              type="button"
              aria-pressed={vacationMode}
              onClick={() => setVacationMode(true)}
              data-hint="Переключает справочники на учётную структуру графика отпусков"
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                vacationMode
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              }`}
            >
              График отпусков
            </button>
          </div>
        </div>
        <PageDescription className="mt-2 max-w-3xl whitespace-pre-line">
          {vacationMode
            ? vacationAccountingHint
            : "Вкладки переключают справочник. «Добавить» открывает форму новой записи, карандаш — редактирование, корзина — удаление. Переключатель «График отпусков» открывает юрлица, должности, руководителей и уведомления об отпусках."}
        </PageDescription>
        <nav className="mt-4 flex flex-wrap gap-1">
          {vacationMode
            ? vacationTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVacationTab(tab.id)}
                  data-hint={tab.hint}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                    vacationTab === tab.id
                      ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                      : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))
            : tabs.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  data-hint={t.hint}
                  activeProps={{
                    className:
                      "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300",
                  }}
                  inactiveProps={{
                    className:
                      "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100",
                  }}
                  className="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors"
                >
                  {t.label}
                </Link>
              ))}
        </nav>
      </header>

      <div className="flex-1 overflow-auto bg-transparent px-8 py-6 dark:bg-gray-950">
        {vacationMode ? (
          <VacationAccountingSettings tab={vacationTab} />
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
