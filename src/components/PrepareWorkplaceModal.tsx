import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { CloseButton } from "#/components/CloseButton";
import { GENDER_OPTIONS } from "#/lib/employeeDisplay";
import type { EmployeeVacancyCreateFields } from "#/lib/employeeUpdate";
import { findOrgNodeById } from "#/lib/orgTree";
import { officesApi } from "#/services/api";
import type { City, OrgNode } from "#/types/api";

const inputClass =
  "w-full max-w-xs px-2 py-1.5 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-200 dark:border-gray-700";

const emailInputClass =
  "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-200 dark:border-gray-700";

const listItemInputClass =
  "w-full min-w-0 flex-1 resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

const rowLabelClass =
  "w-48 whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400";

const tdClass = "px-3 py-2 text-sm text-gray-900 dark:text-gray-100";

const DEFAULT_TASKS = [
  "Внести нового сотрудника в физлица в 1С в первый рабочий день",
  "Добавить в корпоративные чаты компании Telegram",
];

const DEFAULT_QUESTIONS = [
  "Аналогия прав 1С и к терминальной шаре? (*В права не будут включены права по заявкам на расходование ДС (Н), данные права согласовываются через Битрикс)",
  "Нужно ли покупать технику? Если да - укажите стационарный ПК либо ноутбук.",
  "Нужна ли рабочая сим-карта?",
  "Где сядет физически?",
  "Под кого в структуре компании в битрикс поместить?",
  "Домен какой компании использовать для заведения почты сотруднику (АГ/ДЕ)?",
  "По аналогии с кем проводим аттестацию? Нужно ли ставить задачу в Битрикс по каким-то еще блокам кроме Битрикс и О компании? Если да, то ориентировочная дата аттестации?",
  "Кто ведёт табель?",
];

interface PrepareWorkplaceModalProps {
  initial: EmployeeVacancyCreateFields;
  cities: City[];
  orgNodes: OrgNode[];
  onClose: () => void;
  onApply: (data: EmployeeVacancyCreateFields) => void;
}

export function PrepareWorkplaceModal({
  initial,
  cities,
  orgNodes,
  onClose,
  onApply,
}: PrepareWorkplaceModalProps) {
  const [hireDate, setHireDate] = useState(initial.hireDate);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [listsOpen, setListsOpen] = useState(false);

  const officesQuery = useQuery({
    queryKey: ["offices", "city", initial.cityId] as const,
    queryFn: () =>
      officesApi.getByCity(initial.cityId!).then((res) => res.data ?? []),
    enabled: initial.cityId !== null,
  });

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function updateTask(index: number, value: string) {
    setTasks((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function updateQuestion(index: number, value: string) {
    setQuestions((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function addTask() {
    setTasks((prev) => [...prev, ""]);
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, ""]);
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  const cityName =
    cities.find((city) => city.code === initial.cityCode)?.name || "—";
  const officeName =
    officesQuery.data?.find((office) => office.code === initial.officeCode)
      ?.name ||
    (initial.officeCode ? initial.officeCode : "—");
  const departmentName =
    findOrgNodeById(orgNodes, initial.nodeId)?.name || "—";
  const genderLabel =
    GENDER_OPTIONS.find((option) => option.value === initial.gender)?.label ||
    "—";

  const rows = [
    { key: "surname", label: "Фамилия", value: initial.surname || "—" },
    { key: "first_name", label: "Имя", value: initial.first_name || "—" },
    { key: "second_name", label: "Отчество", value: initial.second_name || "—" },
    { key: "phone", label: "Телефон", value: initial.phone || "—" },
    { key: "email", label: "Эл. почта", value: initial.email || "—" },
    { key: "gender", label: "Пол", value: genderLabel },
    {
      key: "hireDate",
      label: "Дата устройства",
      value: hireDate || "—",
    },
    { key: "city", label: "Город", value: cityName },
    { key: "office", label: "Офис", value: officeName },
    { key: "department", label: "Отдел", value: departmentName },
    { key: "position", label: "Должность", value: initial.position || "—" },
    {
      key: "isManager",
      label: "Руководящая должность",
      value: initial.isManager ? "Да" : "Нет",
    },
    { key: "comment", label: "Комментарии", value: initial.comment || "—" },
  ] as const;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const to = recipientEmail.trim();
    if (!to) return;

    const employeeName = [initial.surname, initial.first_name, initial.second_name]
      .filter(Boolean)
      .join(" ");
    const subject = employeeName
      ? `Подготовить рабочее место: ${employeeName}`
      : "Подготовить рабочее место";

    const tableBlock = rows
      .map((row) => `${row.label}: ${row.value}`)
      .join("\n");

    const tasksBlock = tasks
      .map((task) => task.trim())
      .filter(Boolean)
      .map((task, index) => `${index + 1}. ${task}`)
      .join("\n");

    const questionsBlock = questions
      .map((question) => question.trim())
      .filter(Boolean)
      .map((question) => `  ∙  ${question}`)
      .join("\n");

    const body = [tableBlock, tasksBlock, questionsBlock]
      .filter(Boolean)
      .join("\n\n");

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;

    onApply({ ...initial, hireDate });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={handleBackdropClick}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Подготовить рабочее место
            </h2>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Данные сотрудника и вакансии
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full table-auto text-left">
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className={rowLabelClass}>
                        {row.label}
                      </th>
                      <td className={tdClass}>
                        {row.key === "hireDate" ? (
                          <input
                            type="date"
                            value={hireDate}
                            onChange={(e) => setHireDate(e.target.value)}
                            className={inputClass}
                            autoFocus
                          />
                        ) : (
                          <span className="whitespace-pre-wrap break-words">
                            {row.value}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setListsOpen((open) => !open)}
                aria-expanded={listsOpen}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60"
              >
                <span>Задачи и вопросы</span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-gray-400 transition-transform ${listsOpen ? "rotate-180" : ""}`}
                />
              </button>

              {listsOpen && (
                <div className="space-y-4 border-t border-gray-200 px-3 py-3 dark:border-gray-700">
                  <div className="space-y-2">
                    {tasks.map((task, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="mt-2 w-5 shrink-0 text-sm text-gray-500 dark:text-gray-400">
                          {index + 1}.
                        </span>
                        <textarea
                          value={task}
                          onChange={(e) => updateTask(index, e.target.value)}
                          rows={2}
                          className={listItemInputClass}
                        />
                        <button
                          type="button"
                          onClick={() => removeTask(index)}
                          aria-label="Удалить пункт"
                          className="mt-1.5 shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addTask}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                    >
                      <Plus size={14} />
                      Добавить пункт
                    </button>
                  </div>

                  <div className="space-y-2 pl-4">
                    {questions.map((question, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="mt-2 shrink-0 text-sm text-gray-500 dark:text-gray-400">
                          ∙
                        </span>
                        <textarea
                          value={question}
                          onChange={(e) =>
                            updateQuestion(index, e.target.value)
                          }
                          rows={index === 0 || index === 6 ? 3 : 2}
                          className={listItemInputClass}
                        />
                        <button
                          type="button"
                          onClick={() => removeQuestion(index)}
                          aria-label="Удалить пункт"
                          className="mt-1.5 shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                    >
                      <Plus size={14} />
                      Добавить пункт
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label
                htmlFor="workplace-recipient-email"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Кому:
              </label>
              <input
                id="workplace-recipient-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="name@example.com"
                required
                autoComplete="email"
                className={emailInputClass}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!recipientEmail.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Отправить
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
