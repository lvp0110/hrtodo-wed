import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Vacancy, EmptyVacancy } from "#/types/api";
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
    onVacancyClick,
    onAddVacancyClick,
  } = data as {
    label: string;
    type: string;
    code: string;
    isLeaf: boolean;
    isRoot: boolean;
    vacancies: Vacancy[];
    emptyVacancies: EmptyVacancy[];
    onVacancyClick: (d: VacancyModalData) => void;
    onAddVacancyClick: (d: AddVacancyState) => void;
  };

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

  return (
    <>
      {!isRoot && <Handle type="target" position={Position.Top} />}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 w-[280px] overflow-hidden">
        <div className="px-4 py-3 bg-slate-600 dark:bg-slate-700 cursor-pointer hover:bg-slate-500 dark:hover:bg-slate-600 transition-colors select-none">
          <div className="text-xs text-slate-300 font-medium uppercase tracking-wide">
            {type}
          </div>
          <div className="text-sm font-semibold leading-tight text-white mt-0.5">
            {label}
          </div>
        </div>

        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {vacancies.map((v, i) => (
            <li
              key={i}
              className={`px-4 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${v.is_manager ? "border-l-2 border-l-amber-400 bg-amber-50/40 dark:bg-amber-500/5" : ""}`}
              onMouseDown={stopAll}
              onClick={(e) =>
                openVacancy(e, {
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
                })
              }
            >
              <div className="flex items-center gap-1 text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                {v.is_manager && (
                  <svg
                    aria-label="Руководящая должность"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-amber-500 shrink-0"
                  >
                    <path d="M12 2l2.6 7.6H22l-6.2 4.5 2.4 7.5L12 16.9 5.8 21.6l2.4-7.5L2 9.6h7.4z" />
                  </svg>
                )}
                <span className="truncate">
                  {v.position?.name ?? v.position?.code ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-xs truncate ${v.employer?.id ? "text-gray-600 dark:text-gray-400" : "text-amber-500"}`}
                >
                  {employerName(v)}
                </span>
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
          {emptyVacancies.map((v, i) => (
            <li
              key={`empty-${i}`}
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
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
