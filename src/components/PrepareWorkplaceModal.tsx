import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { CloseButton } from "#/components/CloseButton";
import { GENDER_OPTIONS } from "#/lib/employeeDisplay";
import type { EmployeeVacancyCreateFields } from "#/lib/employeeUpdate";
import { findOrgNodeById } from "#/lib/orgTree";
import { dictQueries, officesApi } from "#/services/api";
import type { City, Employer, OrgNode } from "#/types/api";

function employeeLabel({
  surname,
  first_name,
  second_name,
}: Pick<Employer, "surname" | "first_name" | "second_name">) {
  return [surname, first_name, second_name].filter(Boolean).join(" ");
}

function matchesEmployeeQuery(employee: Employer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    employeeLabel(employee).toLowerCase().includes(q) ||
    employee.email.toLowerCase().includes(q)
  );
}

const MESSAGE_TEMPLATE_RE =
  /^Добрый день,? (.+?)! Просьба подготовить рабочее место для нового сотрудника\.(?:\n\n([\s\S]*))?$/;

function greetingName(employee: Employer): string {
  return employee.first_name?.trim() || employeeLabel(employee);
}

function buildGreeting(name: string): string {
  return `Добрый день, ${name || "..."}! Просьба подготовить рабочее место для нового сотрудника.`;
}

function parseExtraMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "";
  const match = trimmed.match(MESSAGE_TEMPLATE_RE);
  if (match) return (match[2] ?? "").trimStart();
  return message;
}

function composeMessage(greeting: string, extra: string): string {
  const extraTrimmed = extra.trim();
  return extraTrimmed ? `${greeting}\n\n${extraTrimmed}` : greeting;
}

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
  onMessageChange: (message: string) => void;
}

export function PrepareWorkplaceModal({
  initial,
  cities,
  orgNodes,
  onClose,
  onApply,
  onMessageChange,
}: PrepareWorkplaceModalProps) {
  const [hireDate, setHireDate] = useState(initial.hireDate);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [extraMessage, setExtraMessage] = useState(() =>
    parseExtraMessage(initial.message ?? ""),
  );
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [listsOpen, setListsOpen] = useState(false);
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const recipientRef = useRef<HTMLDivElement>(null);
  const recipientSearchRef = useRef<HTMLInputElement>(null);
  const onMessageChangeRef = useRef(onMessageChange);

  const employeesQuery = useQuery(dictQueries.employees);

  const officesQuery = useQuery({
    queryKey: ["offices", "city", initial.cityId] as const,
    queryFn: () =>
      officesApi.getByCity(initial.cityId!).then((res) => res.data ?? []),
    enabled: initial.cityId !== null,
  });

  const employeesWithEmail = useMemo(
    () =>
      (employeesQuery.data ?? []).filter((employee) =>
        Boolean(employee.email?.trim()),
      ),
    [employeesQuery.data],
  );

  const selectedRecipient = useMemo(
    () =>
      employeesWithEmail.find(
        (employee) =>
          employee.email.toLowerCase() === recipientEmail.trim().toLowerCase(),
      ) ?? null,
    [employeesWithEmail, recipientEmail],
  );

  const greeting = useMemo(
    () =>
      buildGreeting(
        selectedRecipient ? greetingName(selectedRecipient) : "...",
      ),
    [selectedRecipient],
  );

  const message = useMemo(
    () => composeMessage(greeting, extraMessage),
    [greeting, extraMessage],
  );

  const filteredRecipients = useMemo(
    () =>
      employeesWithEmail.filter((employee) =>
        matchesEmployeeQuery(employee, recipientSearch),
      ),
    [employeesWithEmail, recipientSearch],
  );

  useEffect(() => {
    onMessageChangeRef.current = onMessageChange;
  }, [onMessageChange]);

  useEffect(() => {
    onMessageChangeRef.current(message);
  }, [message]);

  useEffect(() => {
    if (!recipientOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!recipientRef.current?.contains(event.target as Node)) {
        setRecipientOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [recipientOpen]);

  useEffect(() => {
    if (recipientOpen) {
      setRecipientSearch("");
      requestAnimationFrame(() => recipientSearchRef.current?.focus());
    }
  }, [recipientOpen]);

  function selectRecipient(employee: Employer) {
    setRecipientEmail(employee.email.trim());
    setRecipientOpen(false);
  }

  function persistDraft() {
    onApply({ ...initial, hireDate, message });
  }

  function handleDismiss() {
    persistDraft();
    onClose();
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) handleDismiss();
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
    {
      key: "personal_number",
      label: "Личный телефон",
      value: initial.personal_number || "—",
    },
    {
      key: "work_number",
      label: "Рабочий телефон",
      value: initial.work_number || "—",
    },
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

    const body = [message.trim(), tableBlock, tasksBlock, questionsBlock]
      .filter(Boolean)
      .join("\n\n");

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;

    persistDraft();
    onClose();
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
          <CloseButton onClick={handleDismiss} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
            <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <label
                htmlFor="workplace-message"
                className="block border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
              >
                Сообщение
              </label>
              <p className="border-b border-gray-100 px-3 py-2 text-sm text-gray-900 dark:border-gray-800 dark:text-gray-100">
                {greeting}
              </p>
              <textarea
                id="workplace-message"
                value={extraMessage}
                onChange={(e) => setExtraMessage(e.target.value)}
                placeholder="Добавьте текст при необходимости"
                rows={3}
                autoFocus
                className="w-full resize-y border-0 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>

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
              <div ref={recipientRef} className="relative">
                <button
                  id="workplace-recipient-email"
                  type="button"
                  onClick={() => setRecipientOpen((open) => !open)}
                  aria-haspopup="listbox"
                  aria-expanded={recipientOpen}
                  className={`${emailInputClass} flex items-center justify-between gap-2 text-left`}
                >
                  <span
                    className={`block min-w-0 truncate ${
                      selectedRecipient || recipientEmail
                        ? "text-gray-900 dark:text-gray-100"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                    title={
                      selectedRecipient
                        ? `${employeeLabel(selectedRecipient)} <${selectedRecipient.email}>`
                        : recipientEmail || undefined
                    }
                  >
                    {selectedRecipient
                      ? `${employeeLabel(selectedRecipient)} <${selectedRecipient.email}>`
                      : recipientEmail || "Выберите сотрудника"}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-gray-400 transition-transform ${recipientOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {recipientOpen && (
                  <div
                    role="listbox"
                    className="absolute inset-x-0 bottom-full z-50 mb-1 max-h-72 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="border-b border-gray-100 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
                      <input
                        ref={recipientSearchRef}
                        type="search"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="Поиск по ФИО или email"
                        aria-label="Поиск сотрудника"
                        className={emailInputClass}
                      />
                    </div>

                    <div className="max-h-52 overflow-y-auto py-1">
                      {employeesQuery.isLoading ? (
                        <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                          Загрузка…
                        </p>
                      ) : filteredRecipients.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                          Ничего не найдено
                        </p>
                      ) : (
                        filteredRecipients.map((employee) => {
                          const selected =
                            employee.email.toLowerCase() ===
                            recipientEmail.trim().toLowerCase();
                          return (
                            <button
                              key={employee.id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => selectRecipient(employee)}
                              className={`block w-full min-w-0 px-3 py-2 text-left text-sm leading-snug ${
                                selected
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                  : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                              }`}
                            >
                              <span className="block truncate">
                                {employeeLabel(employee)}
                              </span>
                              <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                {employee.email}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
            <button
              type="button"
              onClick={handleDismiss}
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
