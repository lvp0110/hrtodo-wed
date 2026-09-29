import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { CommentHeadingIcon } from "#/components/CommentHeadingIcon";
import { PageDescription } from "#/components/PageHints";

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

function SettingsLayout() {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-8 pt-6 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Настройки справочников
          <CommentHeadingIcon />
        </h1>
        <PageDescription className="mt-2 max-w-3xl">
          Вкладки переключают справочник. «Добавить» открывает форму новой
          записи, карандаш — редактирование, корзина — удаление.
        </PageDescription>
        <nav className="mt-4 flex flex-wrap gap-1">
          {tabs.map((t) => (
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

      <div className="flex-1 overflow-auto bg-gray-50 px-8 py-6 dark:bg-gray-950">
        <Outlet />
      </div>
    </div>
  );
}
