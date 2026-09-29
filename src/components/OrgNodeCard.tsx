import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Pencil, Trash2 } from "lucide-react";
import type { Employer, Vacancy, EmptyVacancy } from "#/types/api";
import type { AddVacancyState, VacancyModalData } from "#/types/orgChart";

function employerName(v: Vacancy): string {
  if (!v.employer?.id) return "Вакантно";
  const { first_name, second_name, surname } = v.employer;
  return [surname, first_name, second_name].filter(Boolean).join(" ");
}

export function OrgNodeCard({ id, data }: NodeProps) {
  const {
    label,
    type,
    isRoot,
    vacancies,
    emptyVacancies,
    highlighted,
    nearby,
    neighbor,
    toggleList,
    onVacancyClick,
    onEditEmployeeClick,
    onDeleteVacancyClick,
    onAddVacancyClick,
    onEditClick,
  } = data as {
    label: string;
    type: string;
    code: string;
    isLeaf: boolean;
    isRoot: boolean;
    highlighted?: boolean;
    nearby?: boolean;
    neighbor?: boolean;
    toggleList?: boolean;
    vacancies: Vacancy[];
    emptyVacancies: EmptyVacancy[];
    onVacancyClick: (d: VacancyModalData) => void;
    onEditEmployeeClick?: (employee: Employer) => void;
    onDeleteVacancyClick?: (vacancy: Vacancy) => void;
    onAddVacancyClick: (d: AddVacancyState) => void;
    onEditClick?: () => void;
  };

  const showEmployees = !nearby;
  const showEdit = Boolean(neighbor && showEmployees && onEditClick);
  const headerToggles = Boolean(toggleList);
  const headerOpens = !neighbor || headerToggles;

  function stopAll(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  function openVacancy(e: React.MouseEvent, d: VacancyModalData) {
    e.stopPropagation();
    onVacancyClick(d);
  }

  function openAddVacancy(e: React.MouseEvent) {
    e.stopPropagation();
    onAddVacancyClick({ deptId: id, deptName: label });
  }

  function vacancyModalData(v: Vacancy): VacancyModalData {
    return {
      id: v.id,
      nodeId: v.node_id,
      position: v.position?.name ?? v.position?.code ?? "",
      positionCode: v.position?.code ?? v.position?.name ?? "",
      city: v.city?.name ?? "",
      cityCode: v.city?.code ?? "",
      office: v.office?.name,
      officeCode: v.office?.code,
      deptName: label,
      isManager: v.is_manager,
      employer: v.employer?.id
        ? {
            id: v.employer.id,
            name: employerName(v),
            email: v.employer.email,
          }
        : null,
      jobOffer: v.job_offer_link,
      description: v.position_description,
    };
  }

  const linkClass =
    "min-w-0 truncate border-0 bg-transparent p-0 text-left text-blue-600 hover:underline dark:text-blue-400";

  return (
    <>
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div
        className={`w-[280px] overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-gray-800 ${
          highlighted
            ? "border-blue-500 ring-2 ring-blue-500"
            : "border-gray-200 dark:border-gray-700"
        }`}
      >
        <div
          data-dept-field
          data-hint={
            headerToggles
              ? nearby
                ? "Показывает сотрудников отдела"
                : "Скрывает сотрудников отдела"
              : headerOpens
                ? "Открывает карточку отдела"
                : undefined
          }
          className={`select-none px-4 py-3 transition-colors ${
            headerOpens ? "cursor-pointer" : ""
          } ${
            highlighted
              ? `bg-blue-600${headerOpens ? " hover:bg-blue-500" : ""}`
              : `bg-slate-600 dark:bg-slate-700${
                  headerOpens
                    ? " hover:bg-slate-500 dark:hover:bg-slate-600"
                    : ""
                }`
          }`}
        >
          <div className="text-xs text-slate-300 font-medium uppercase tracking-wide">
            {type}
          </div>
          <div className="mt-0.5 flex items-start gap-1.5">
            <div className="min-w-0 text-sm font-semibold leading-tight text-white">
              {label}
            </div>
            {showEdit && (
              <button
                type="button"
                title="Редактировать отдел"
                aria-label="Редактировать отдел"
                data-dept-edit
                data-hint="Открывает редактирование отдела"
                onMouseDown={stopAll}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditClick?.();
                }}
                className="nodrag nopan mt-0.5 shrink-0 rounded p-0.5 text-white/80 hover:bg-white/15 hover:text-white"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
        </div>

        {showEmployees && (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {vacancies.map((v, i) => {
            const canDelete = !v.employer?.id && v.id > 0;
            return (
            <li
              key={i}
              className={`flex items-start gap-1 px-4 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${v.is_manager ? "border-l-2 border-l-amber-400 bg-amber-50/40 dark:bg-amber-500/5" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-xs font-medium">
                  {v.is_manager && (
                    <svg
                      aria-label="Руководящая должность"
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="shrink-0 text-amber-500"
                    >
                      <path d="M12 2l2.6 7.6H22l-6.2 4.5 2.4 7.5L12 16.9 5.8 21.6l2.4-7.5L2 9.6h7.4z" />
                    </svg>
                  )}
                  <button
                    type="button"
                    data-hint={
                      v.id > 0
                        ? "Открывает редактирование этой вакансии"
                        : "Открывает просмотр свободной вакансии"
                    }
                    className={`${linkClass} font-medium`}
                    onMouseDown={stopAll}
                    onClick={(e) => openVacancy(e, vacancyModalData(v))}
                  >
                    {v.position?.name ?? v.position?.code ?? "—"}
                  </button>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {v.employer?.id ? (
                    <button
                      type="button"
                      data-hint="Открывает карточку сотрудника"
                      className={`${linkClass} text-xs font-normal`}
                      onMouseDown={stopAll}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditEmployeeClick?.(v.employer);
                      }}
                    >
                      {employerName(v)}
                    </button>
                  ) : (
                    <span className="truncate text-xs text-amber-500">
                      Вакантно
                    </span>
                  )}
                  {v.city?.name && (
                    <>
                      <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                        {v.city.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {canDelete && (
                <button
                  type="button"
                  title="Удалить вакансию"
                  aria-label="Удалить вакансию"
                  data-hint="Удаляет вакансию, на которую ещё не назначен сотрудник"
                  className="nodrag nopan mt-0.5 shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                  onMouseDown={stopAll}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteVacancyClick?.(v);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
            );
          })}
          {emptyVacancies.map((v, i) => (
            <li
              key={`empty-${i}`}
              data-hint="Открывает просмотр свободной вакансии"
              className="px-4 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onMouseDown={stopAll}
              onClick={(e) =>
                openVacancy(e, {
                  id: 0,
                  nodeId: 0,
                  position: v.position?.name ?? v.position?.code ?? "",
                  positionCode: v.position?.code ?? v.position?.name ?? "",
                  city: v.city?.name ?? "",
                  cityCode: v.city?.code ?? "",
                  office: v.office?.name,
                  officeCode: v.office?.code,
                  deptName: label,
                  isManager: false,
                  employer: null,
                  jobOffer: "",
                  description: "",
                })
              }
            >
              <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                {v.position?.name ?? v.position?.code ?? "—"}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-amber-500">Вакантно</span>
                {v.city?.name && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      {v.city.name}
                    </span>
                  </>
                )}
              </div>
            </li>
          ))}

          {/* Строка "добавить вакансию" */}
          <li
            data-hint="Открывает форму новой вакансии в этом отделе"
            className="px-4 py-1.5 flex items-center gap-2 cursor-pointer text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors select-none"
            onMouseDown={stopAll}
            onClick={openAddVacancy}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="text-xs">Добавить вакансию</span>
          </li>
        </ul>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
