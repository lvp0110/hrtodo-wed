import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Vacancy, EmptyVacancy } from "#/types/api";
import type { VacancyModalData } from "#/types/orgChart";

function employerName(v: Vacancy): string {
  if (!v.Employer.ID) return "Вакантно";
  const { FirstName, SecondName, Surname } = v.Employer;
  return [Surname, FirstName, SecondName].filter(Boolean).join(" ");
}

export function OrgNodeCard({ data }: NodeProps) {
  const { label, type, isRoot, vacancies, emptyVacancies, onVacancyClick } =
    data as {
      label: string;
      type: string;
      code: string;
      isLeaf: boolean;
      isRoot: boolean;
      vacancies: Vacancy[];
      emptyVacancies: EmptyVacancy[];
      onVacancyClick: (d: VacancyModalData) => void;
    };

  const hasVacancies = vacancies.length > 0 || emptyVacancies.length > 0;

  function openVacancy(e: React.MouseEvent, d: VacancyModalData) {
    e.stopPropagation();
    onVacancyClick(d);
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

        {hasVacancies && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {vacancies.map((v, i) => (
              <li
                key={i}
                className="px-4 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={(e) =>
                  openVacancy(e, {
                    position: v.Position.Name,
                    city: v.City.Name,
                    deptName: label,
                    employer: {
                      id: v.Employer.ID,
                      name: employerName(v),
                      email: v.Employer.Email,
                    },
                  })
                }
              >
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                  {v.Position.Name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-xs truncate ${v.Employer.ID ? "text-gray-600 dark:text-gray-400" : "text-amber-500"}`}
                  >
                    {employerName(v)}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {v.City.Name}
                  </span>
                </div>
              </li>
            ))}
            {emptyVacancies.map((v, i) => (
              <li
                key={`empty-${i}`}
                className="px-4 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={(e) =>
                  openVacancy(e, {
                    position: v.Position.Name,
                    city: v.City.Name,
                    deptName: label,
                    employer: null,
                  })
                }
              >
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                  {v.Position.Name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-amber-500">Вакантно</span>
                  <span className="text-gray-300 dark:text-gray-600 text-xs">·</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                    {v.City.Name}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}
