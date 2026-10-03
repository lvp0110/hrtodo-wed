import { createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown, FileSpreadsheet, IdCard, Search, Star } from "lucide-react";
import {
  dictQueries,
  employeeReportQuery,
  employeesApi,
  exportApi,
  officesApi,
  orgNodesApi,
  vacanciesApi,
} from "#/services/api";
import { ApiErrorModal } from "#/components/ApiErrorModal";
import { CommentHeadingIcon } from "#/components/CommentHeadingIcon";
import { PageDescription } from "#/components/PageHints";
import { DeleteArchivedEmployeeModal } from "#/components/DeleteArchivedEmployeeModal";
import {
  AssignEmployeeModal,
  type AssignEmployeeFormFields,
} from "#/components/AssignEmployeeModal";
import { EmployeeInfoModal } from "#/components/EmployeeInfoModal";
import {
  EmployeeAddRow,
  EmployeeAddCard,
  clearEmployeeAddDraft,
} from "#/components/EmployeeAddRow";
import { EmployeesRowCard } from "#/components/EmployeesRowCard";
import { EditVacancyModal } from "#/components/EditVacancyModal";
import { DictTable } from "#/components/settings/DictTable";
import { dictInputClass } from "#/components/settings/DictFormModal";
import type {
  City,
  Country,
  EmployeeReportItem,
  EmployeeHistoryEndType,
  EmployeePositionHistory,
  Employer,
  ExportRequest,
  Office,
  OrgNode,
} from "#/types/api";
import type { VacancyModalData } from "#/types/orgChart";
import { DepartmentTreeSelect } from "#/components/DepartmentTreeSelect";
import { normalizeGender } from "#/lib/employeeDisplay";
import {
  toEmployeeCreateReq,
  toEmployeeUpdateReq,
  type EmployeeVacancyCreateFields,
} from "#/lib/employeeUpdate";
import { toVacancyUpdateReq } from "#/lib/vacancyUpdate";
import { formatApiError, formatVacancyError } from "#/lib/apiError";
import { findOrgNodeByName } from "#/lib/orgTree";

/** Город по коду офиса — в дереве вакансий бэк отдаёт только office, без city. */
type CityByOfficeCode = Map<string, { name: string; code: string }>;

export const Route = createFileRoute("/employees")({
  component: EmployeesPage,
});

type EmployeeFilters = {
  name: string;
  country: string;
  city: string;
  office: string;
  department: string;
  position: string;
  gender: string;
  hireYear: string;
  hireMonth: string;
  hireDay: string;
};

type RowKindFilter = "all" | "employee" | "vacancy";

const emptyFilters: EmployeeFilters = {
  name: "",
  country: "",
  city: "",
  office: "",
  department: "",
  position: "",
  gender: "",
  hireYear: "",
  hireMonth: "",
  hireDay: "",
};

function fullName(e: Employer) {
  return [e.surname, e.first_name, e.second_name].filter(Boolean).join(" ");
}

function employeeNameContent(employee: Employer) {
  const name = fullName(employee);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {name || <span className="text-gray-400">—</span>}
      {employee.status === "archived" && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Архив
        </span>
      )}
    </span>
  );
}

function normalizeHireDateForCompare(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.trim();
  return parsed.toISOString().slice(0, 10);
}

function getHireDateParts(value: string | null | undefined): {
  year: string;
  month: string;
  day: string;
} | null {
  const normalized = normalizeHireDateForCompare(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: match[1], month: match[2], day: match[3] };
}

const HISTORY_END_LABEL: Record<EmployeeHistoryEndType, string> = {
  transferred: "Перевод",
  unassigned: "Снятие",
  archived: "Архив",
  correction: "Корректировка",
};

const CARD_COLUMN_COUNT = 4;

type HistoryLoad =
  | { status: "ok"; items: EmployeePositionHistory[] }
  | { status: "error" };

function parseCardDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCardDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const date = parseCardDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("ru-RU");
}

function pluralRu(value: number, one: string, few: string, many: string): string {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function formatTenure(
  hireDate: string | null | undefined,
  until: string | null | undefined,
): string {
  if (!hireDate?.trim()) return "—";
  const start = parseCardDate(hireDate);
  const end = until?.trim() ? parseCardDate(until) : new Date();
  if (!start || !end || end < start) return "—";

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "—";

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ${pluralRu(years, "год", "года", "лет")}`);
  }
  if (months > 0) {
    parts.push(`${months} ${pluralRu(months, "месяц", "месяца", "месяцев")}`);
  }
  if (parts.length > 0) return parts.join(" ");

  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  if (days <= 0) return "меньше дня";
  return `${days} ${pluralRu(days, "день", "дня", "дней")}`;
}

function sortHistory(items: EmployeePositionHistory[]): EmployeePositionHistory[] {
  return [...items].sort((a, b) => {
    const byStart = b.started_at.localeCompare(a.started_at);
    return byStart !== 0 ? byStart : b.id - a.id;
  });
}

function historyJournalText(item: EmployeePositionHistory): string {
  const title = item.position_name || item.position_code || "Должность";
  const place = [item.node_name, item.office_name].filter(Boolean).join(" · ");
  const period = item.ended_at
    ? `${formatCardDate(item.started_at)} — ${formatCardDate(item.ended_at)}`
    : `с ${formatCardDate(item.started_at)}`;
  return [
    `${title}${item.is_manager ? " · руководитель" : ""}${item.ended_at ? "" : " · сейчас"}`,
    place,
    period,
  ]
    .filter(Boolean)
    .join("\n");
}

function historyReasonText(item: EmployeePositionHistory): string {
  const endLabel = item.end_type ? HISTORY_END_LABEL[item.end_type] : "";
  return [endLabel, item.end_reason?.trim()].filter(Boolean).join(" · ");
}

async function loadEmployeeHistories(
  ids: number[],
): Promise<Record<number, HistoryLoad>> {
  const unique = [...new Set(ids)];
  const result: Record<number, HistoryLoad> = {};
  let cursor = 0;
  const workerCount = Math.min(6, unique.length);

  async function worker() {
    while (cursor < unique.length) {
      const id = unique[cursor];
      cursor += 1;
      if (id == null) return;
      try {
        const res = await employeesApi.history(id);
        result[id] = { status: "ok", items: res.data ?? [] };
      } catch {
        result[id] = { status: "error" };
      }
    }
  }

  if (workerCount > 0) {
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }
  return result;
}

function mutedDash() {
  return <span className="text-gray-400">—</span>;
}

function cardHireDate(row: EmployeesTableRow): ReactNode {
  if (row.kind !== "employee") return mutedDash();
  return row.employee.hire_date ? formatCardDate(row.employee.hire_date) : mutedDash();
}

function cardTenure(row: EmployeesTableRow): ReactNode {
  if (row.kind !== "employee") return mutedDash();
  const tenure = formatTenure(
    row.employee.hire_date,
    row.employee.status === "archived" ? row.employee.archived_at : null,
  );
  return tenure === "—" ? mutedDash() : tenure;
}

function cardHistoryList(
  row: EmployeesTableRow,
  histories: Record<number, HistoryLoad> | undefined,
  pending: boolean,
  mode: "journal" | "reason",
): ReactNode {
  if (row.kind !== "employee") return mutedDash();
  const load = histories?.[row.employee.id];
  if (!load) {
    if (pending) {
      return <span className="text-gray-400">Загрузка…</span>;
    }
    return <span className="text-red-500 dark:text-red-400">Не удалось загрузить</span>;
  }
  if (load.status === "error") {
    return <span className="text-red-500 dark:text-red-400">Не удалось загрузить</span>;
  }

  const items = sortHistory(load.items);
  if (items.length === 0) {
    return mode === "journal" ? (
      <span className="text-gray-400">Перемещений пока нет</span>
    ) : (
      mutedDash()
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const text = mode === "journal" ? historyJournalText(item) : historyReasonText(item);
        return (
          <div
            key={item.id}
            className="whitespace-pre-line break-words border-b border-gray-100 pb-2 last:border-b-0 last:pb-0 dark:border-gray-800"
          >
            {text || mutedDash()}
          </div>
        );
      })}
    </div>
  );
}

type EmployeeVacancyInfo = {
  city: string;
  cityCode: string;
  office: string;
  officeId: number | null;
  officeCode: string;
  department: string;
  position: string;
  description: string;
  jobOffer: string;
  isManager: boolean;
};

type EmployeesTableRow =
  | {
      kind: "employee";
      id: number;
      employee: Employer;
      org: EmployeeVacancyInfo | undefined;
      vacancy: VacancyModalData | undefined;
    }
  | {
      kind: "vacancy";
      id: string;
      org: EmployeeVacancyInfo;
      vacancy: VacancyModalData;
    };

function collectEmployeeIdsInNodeAndDescendants(node: OrgNode): Set<number> {
  const ids = new Set<number>();

  function walk(n: OrgNode) {
    for (const vacancy of n.vacancies) {
      if (vacancy.employer.id) ids.add(vacancy.employer.id);
    }
    for (const child of n.children) walk(child);
  }

  walk(node);
  return ids;
}

function buildManagerSubordinatesMap(nodes: OrgNode[]): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();

  function walk(node: OrgNode) {
    for (const vacancy of node.vacancies) {
      if (vacancy.is_manager && vacancy.employer.id) {
        const managerId = vacancy.employer.id;
        const subordinates = collectEmployeeIdsInNodeAndDescendants(node);
        subordinates.delete(managerId);

        const existing = map.get(managerId);
        if (existing) {
          for (const id of subordinates) existing.add(id);
        } else {
          map.set(managerId, new Set(subordinates));
        }
      }
    }
    for (const child of node.children) walk(child);
  }

  for (const node of nodes) walk(node);
  return map;
}

function buildEmployeeOrgMapFromReport(
  items: EmployeeReportItem[],
): Map<number, EmployeeVacancyInfo> {
  const map = new Map<number, EmployeeVacancyInfo>();

  for (const { employee, positions } of items) {
    if (positions.length === 0) {
      map.set(employee.id, {
        city: employee.city?.name ?? "",
        cityCode: employee.city?.code ?? "",
        office: employee.office?.name ?? "",
        officeId: employee.office_id ?? employee.office?.id ?? null,
        officeCode: employee.office?.code ?? "",
        department: "",
        position: "",
        description: "",
        jobOffer: "",
        isManager: false,
      });
      continue;
    }

    for (const position of positions) {
      const prev = map.get(employee.id);
      map.set(employee.id, {
        city: employee.city?.name ?? position.city?.name ?? "",
        cityCode: employee.city?.code ?? position.city?.code ?? "",
        office: employee.office?.name ?? position.office?.name ?? "",
        officeId:
          employee.office_id ??
          position.office_id ??
          position.office?.id ??
          null,
        officeCode: employee.office?.code ?? position.office?.code ?? "",
        department: position.node?.name ?? "",
        position: position.name ?? "",
        description: position.position_description,
        jobOffer: position.job_offer_link,
        isManager: position.is_manager || prev?.isManager || false,
      });
    }
  }

  return map;
}

function buildEmployeeVacancyMapFromReport(
  items: EmployeeReportItem[],
): Map<number, VacancyModalData> {
  const map = new Map<number, VacancyModalData>();

  for (const { employee, positions } of items) {
    for (const position of positions) {
      map.set(employee.id, {
        id: position.id,
        nodeId: position.node_id,
        position: position.name ?? "",
        positionCode: position.code ?? position.name ?? "",
        city: position.city?.name ?? "",
        cityCode: position.city?.code ?? "",
        office: position.office?.name ?? "",
        officeCode: position.office?.code ?? "",
        deptName: position.node?.name ?? "",
        isManager: position.is_manager,
        employer: {
          id: employee.id,
          name: fullName(employee),
          email: employee.email,
        },
        jobOffer: position.job_offer_link ?? "",
        description: position.position_description ?? "",
      });
    }
  }

  return map;
}

function employersFromReport(
  items: EmployeeReportItem[],
  orgByEmployeeId: Map<number, EmployeeVacancyInfo>,
): Employer[] {
  return items.map(({ employee, positions }) => {
    const position = positions[0];
    const org = orgByEmployeeId.get(employee.id);
    return {
      ...employee,
      city_id: employee.city_id ?? position?.city_id ?? null,
      city: employee.city ?? position?.city ?? null,
      office_id: employee.office_id ?? org?.officeId ?? position?.office_id ?? null,
      office:
        employee.office ??
        (org?.officeCode
          ? {
              id: org.officeId ?? undefined,
              code: org.officeCode,
              name: org.office,
            }
          : (position?.office ?? null)),
    };
  });
}

function buildEmployeeOrgMapFromTree(
  nodes: OrgNode[],
): Map<number, EmployeeVacancyInfo> {
  const map = new Map<number, EmployeeVacancyInfo>();

  function walk(node: OrgNode) {
    for (const vacancy of node.vacancies) {
      const { id } = vacancy.employer;
      if (id) {
        const prev = map.get(id);
        map.set(id, {
          city: vacancy.city?.name ?? "",
          cityCode: vacancy.city?.code ?? "",
          office: vacancy.office?.name ?? "",
          officeId:
            (vacancy.office as { id?: number } | null | undefined)?.id ?? null,
          officeCode: vacancy.office?.code ?? "",
          department: node.name,
          position: vacancy.position?.name ?? vacancy.position?.code ?? "",
          description: vacancy.position_description,
          jobOffer: vacancy.job_offer_link,
          isManager: vacancy.is_manager || prev?.isManager || false,
        });
      }
    }
    for (const child of node.children) walk(child);
  }

  for (const node of nodes) walk(node);
  return map;
}

function buildEmployeeVacancyMapFromTree(
  nodes: OrgNode[],
): Map<number, VacancyModalData> {
  const map = new Map<number, VacancyModalData>();

  function walk(node: OrgNode) {
    for (const vacancy of node.vacancies) {
      const { id } = vacancy.employer;
      if (!id) continue;
      map.set(id, {
        id: vacancy.id,
        nodeId: vacancy.node_id,
        position: vacancy.position?.name ?? vacancy.position?.code ?? "",
        positionCode: vacancy.position?.code ?? vacancy.position?.name ?? "",
        city: vacancy.city?.name ?? "",
        cityCode: vacancy.city?.code ?? "",
        office: vacancy.office?.name ?? "",
        officeCode: vacancy.office?.code ?? "",
        deptName: node.name,
        isManager: vacancy.is_manager,
        employer: {
          id: vacancy.employer.id,
          name: fullName(vacancy.employer),
          email: vacancy.employer.email,
        },
        jobOffer: vacancy.job_offer_link ?? "",
        description: vacancy.position_description ?? "",
      });
    }
    for (const child of node.children) walk(child);
  }

  for (const node of nodes) walk(node);
  return map;
}

function mergeOfficeInfo(
  base: EmployeeVacancyInfo,
  treeSource?: EmployeeVacancyInfo,
): EmployeeVacancyInfo {
  if (
    !treeSource?.office &&
    !treeSource?.officeCode &&
    !treeSource?.officeId
  ) {
    return base;
  }

  return {
    ...base,
    office: treeSource.office || base.office,
    officeId: treeSource.officeId ?? base.officeId,
    officeCode: treeSource.officeCode || base.officeCode,
  };
}

function mergeEmployeeOrgMaps(
  reportMap: Map<number, EmployeeVacancyInfo>,
  treeMap: Map<number, EmployeeVacancyInfo>,
): Map<number, EmployeeVacancyInfo> {
  const merged = new Map(reportMap);

  for (const [id, treeInfo] of treeMap) {
    const reportInfo = merged.get(id);
    merged.set(
      id,
      reportInfo ? mergeOfficeInfo(reportInfo, treeInfo) : treeInfo,
    );
  }

  return merged;
}

function mergeVacancyMaps(
  reportMap: Map<number, VacancyModalData>,
  treeMap: Map<number, VacancyModalData>,
): Map<number, VacancyModalData> {
  const merged = new Map(reportMap);

  for (const [employeeId, treeVacancy] of treeMap) {
    const reportVacancy = merged.get(employeeId);
    if (!reportVacancy) {
      merged.set(employeeId, treeVacancy);
      continue;
    }

    merged.set(employeeId, {
      ...reportVacancy,
      id: treeVacancy.id,
      nodeId: treeVacancy.nodeId,
      positionCode: treeVacancy.positionCode || reportVacancy.positionCode,
      city: treeVacancy.city || reportVacancy.city,
      cityCode: treeVacancy.cityCode || reportVacancy.cityCode,
      deptName: treeVacancy.deptName || reportVacancy.deptName,
      office: treeVacancy.office || reportVacancy.office,
      officeCode: treeVacancy.officeCode || reportVacancy.officeCode,
      isManager: treeVacancy.isManager,
      employer: treeVacancy.employer ?? reportVacancy.employer,
      description: reportVacancy.description || treeVacancy.description,
      jobOffer: reportVacancy.jobOffer || treeVacancy.jobOffer,
    });
  }

  return merged;
}

function collectVacantRowsFromTree(
  nodes: OrgNode[],
  cityByOfficeCode: CityByOfficeCode,
): EmployeesTableRow[] {
  const rows: EmployeesTableRow[] = [];

  function walk(node: OrgNode) {
    for (const vacancy of node.vacancies ?? []) {
      if (vacancy.employer?.id) continue;
      const position = vacancy.position?.name ?? vacancy.position?.code ?? "";
      const office = vacancy.office?.name ?? "";
      const officeCode = vacancy.office?.code ?? "";
      const cityFromOffice = officeCode
        ? cityByOfficeCode.get(officeCode)
        : undefined;
      // В API дерева у вакансии нет city — только office → город берём из справочника.
      const city = vacancy.city?.name || cityFromOffice?.name || "";
      const cityCode = vacancy.city?.code || cityFromOffice?.code || "";

      rows.push({
        kind: "vacancy",
        id: `vacancy-${vacancy.id}`,
        org: {
          city,
          cityCode,
          office,
          officeId:
            (vacancy.office as { id?: number } | null | undefined)?.id ?? null,
          officeCode,
          department: node.name,
          position,
          description: vacancy.position_description ?? "",
          jobOffer: vacancy.job_offer_link ?? "",
          isManager: vacancy.is_manager,
        },
        vacancy: {
          id: vacancy.id,
          nodeId: vacancy.node_id,
          position,
          positionCode: vacancy.position?.code ?? vacancy.position?.name ?? "",
          city,
          cityCode,
          office,
          officeCode,
          deptName: node.name,
          isManager: vacancy.is_manager,
          employer: null,
          jobOffer: vacancy.job_offer_link ?? "",
          description: vacancy.position_description ?? "",
        },
      });
    }
    for (const child of node.children ?? []) walk(child);
  }

  for (const node of nodes ?? []) walk(node);
  return rows;
}

function matchesFilters(
  employee: Employer,
  org: EmployeeVacancyInfo | undefined,
  filters: EmployeeFilters,
  cityCountryByName: Map<string, string>,
): boolean {
  const q = (value: string) => value.trim().toLowerCase();

  if (filters.name && !fullName(employee).toLowerCase().includes(q(filters.name))) {
    return false;
  }

  if (
    filters.gender &&
    normalizeGender(employee.gender) !== filters.gender
  ) {
    return false;
  }

  if (
    filters.position &&
    !(org?.position.toLowerCase().includes(q(filters.position)) ?? false)
  ) {
    return false;
  }

  if (
    filters.country &&
    (org?.city ? cityCountryByName.get(org.city) : undefined) !== filters.country
  ) {
    return false;
  }
  if (filters.city && org?.city !== filters.city) return false;
  if (filters.office && org?.office !== filters.office) return false;
  if (filters.department && org?.department !== filters.department) return false;
  if (filters.hireYear || filters.hireMonth || filters.hireDay) {
    const hireDateParts = getHireDateParts(employee.hire_date);
    if (!hireDateParts) return false;
    if (filters.hireYear && hireDateParts.year !== filters.hireYear) return false;
    if (filters.hireMonth && hireDateParts.month !== filters.hireMonth) return false;
    if (filters.hireDay && hireDateParts.day !== filters.hireDay) return false;
  }

  return true;
}

function optionalInt(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function buildExportRequest(
  filters: EmployeeFilters,
  countries: Country[],
  cities: City[],
  offices: Office[],
  tree: OrgNode[],
): ExportRequest {
  const body: ExportRequest = {};

  if (filters.name.trim()) body.full_name = filters.name.trim();

  if (filters.country) {
    const country = countries.find((c) => c.name === filters.country);
    if (country?.code) body.country_code = country.code;
  }

  if (filters.city) {
    const city = cities.find((c) => c.name === filters.city);
    if (city?.code) body.city_code = city.code;
  }

  if (filters.office) {
    const office = offices.find((o) => o.name === filters.office);
    if (office?.code) body.office_code = office.code;
  }

  if (filters.department) {
    const node = findOrgNodeByName(tree, filters.department);
    if (node) body.department_id = node.id;
  }

  if (filters.position.trim()) body.position_name = filters.position.trim();
  if (filters.gender) body.gender = filters.gender;

  const hireYear = optionalInt(filters.hireYear);
  const hireMonth = optionalInt(filters.hireMonth);
  const hireDay = optionalInt(filters.hireDay);
  if (hireYear !== undefined) body.hire_year = hireYear;
  if (hireMonth !== undefined) body.hire_month = hireMonth;
  if (hireDay !== undefined) body.hire_day = hireDay;

  return body;
}

function FilterSelect({
  className = "",
  wrapperClassName = "w-full",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
}) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        {...props}
        className={`${dictInputClass} appearance-none pr-9 [-webkit-appearance:none] ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  );
}

function EmployeesPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<EmployeeFilters>(emptyFilters);
  const [showCardColumns, setShowCardColumns] = useState(false);
  const [archiveView, setArchiveView] = useState(false);
  const [rowKindFilter, setRowKindFilter] = useState<RowKindFilter>("all");
  const [managersOnlyFilter, setManagersOnlyFilter] = useState(false);
  const [managerFilterId, setManagerFilterId] = useState<number | null>(null);
  const [editVacancyModal, setEditVacancyModal] =
    useState<VacancyModalData | null>(null);
  const [assignEmployeeTarget, setAssignEmployeeTarget] = useState<{
    vacancy: VacancyModalData;
    org: EmployeeVacancyInfo;
  } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employer | null>(
    null,
  );
  const [employeeToDelete, setEmployeeToDelete] = useState<Employer | null>(
    null,
  );
  const [addRowKey, setAddRowKey] = useState(0);
  const activeReportQuery = useQuery(employeeReportQuery("active"));
  const archivedReportQuery = useQuery(employeeReportQuery("archived"));
  const reportQuery = archiveView ? archivedReportQuery : activeReportQuery;
  const historiesQuery = useQuery({
    queryKey: [
      "employees",
      "histories",
      archiveView ? "archived" : "active",
      reportQuery.dataUpdatedAt,
    ] as const,
    enabled: showCardColumns && reportQuery.isSuccess,
    staleTime: 60_000,
    queryFn: () =>
      loadEmployeeHistories(
        (reportQuery.data ?? []).map((item) => item.employee.id),
      ),
  });
  const citiesQuery = useQuery(dictQueries.cities);
  const countriesQuery = useQuery(dictQueries.countries);
  const treeQuery = useQuery({
    queryKey: ["orgTree"],
    queryFn: () => orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
  });

  const cities = citiesQuery.data ?? [];
  const officesByCityQueries = useQueries({
    queries: cities.map((city) => ({
      queryKey: ["offices", "city", city.id] as const,
      queryFn: () => officesApi.getByCity(city.id).then((res) => res.data ?? []),
      staleTime: 60_000,
    })),
  });
  const officesDataUpdatedAt = officesByCityQueries
    .map((query) => query.dataUpdatedAt)
    .join(",");

  const cityByOfficeCode = useMemo(() => {
    const map: CityByOfficeCode = new Map();
    officesByCityQueries.forEach((query, index) => {
      const city = cities[index];
      if (!city || !query.data) return;
      for (const office of query.data) {
        map.set(office.code, { name: city.name, code: city.code });
      }
    });
    return map;
    // officesDataUpdatedAt отражает загрузку офисов по городам
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, officesDataUpdatedAt]);

  const orgByEmployeeId = useMemo(
    () =>
      mergeEmployeeOrgMaps(
        buildEmployeeOrgMapFromReport(reportQuery.data ?? []),
        buildEmployeeOrgMapFromTree(treeQuery.data ?? []),
      ),
    [reportQuery.data, treeQuery.data],
  );

  const employees = useMemo(
    () => employersFromReport(reportQuery.data ?? [], orgByEmployeeId),
    [reportQuery.data, orgByEmployeeId],
  );

  const vacancyByEmployeeId = useMemo(
    () =>
      mergeVacancyMaps(
        buildEmployeeVacancyMapFromReport(reportQuery.data ?? []),
        buildEmployeeVacancyMapFromTree(treeQuery.data ?? []),
      ),
    [reportQuery.data, treeQuery.data],
  );

  const vacantRows = useMemo(
    () => collectVacantRowsFromTree(treeQuery.data ?? [], cityByOfficeCode),
    [treeQuery.data, cityByOfficeCode],
  );

  const updateVacancyMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Parameters<typeof vacanciesApi.update>[1];
    }) => vacanciesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      setEditVacancyModal(null);
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: Parameters<typeof employeesApi.update>[1];
    }) => employeesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      setSelectedEmployee(null);
    },
  });

  const archiveEmployeeMutation = useMutation({
    mutationFn: (employeeId: number) => employeesApi.archive(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      setSelectedEmployee(null);
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: (employeeId: number) => employeesApi.delete(employeeId),
    onSuccess: (_data, employeeId) => {
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      setEmployeeToDelete(null);
      setSelectedEmployee((current) =>
        current?.id === employeeId ? null : current,
      );
    },
    onError: () => {
      setEmployeeToDelete(null);
    },
  });

  const deleteVacancyMutation = useMutation({
    mutationFn: (id: number) => vacanciesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      if (editVacancyModal) setEditVacancyModal(null);
    },
  });

  const assignEmployeeMutation = useMutation({
    mutationFn: async ({
      vacancy,
      org,
      fields,
    }: {
      vacancy: VacancyModalData;
      org: EmployeeVacancyInfo;
      fields: AssignEmployeeFormFields;
    }) => {
      let employeeId: number;
      let createdEmployeeId: number | null = null;

      if (fields.mode === "existing") {
        if (!fields.existingUserId) {
          throw new Error("Выберите сотрудника");
        }
        employeeId = fields.existingUserId;
      } else {
        const employeeRes = await employeesApi.create(toEmployeeCreateReq(fields));
        employeeId = employeeRes.data.id;
        createdEmployeeId = employeeId;

        const cityId =
          citiesQuery.data?.find((city) => city.code === org.cityCode)?.id ?? null;
        if (cityId || org.officeId) {
          await employeesApi.update(employeeId, {
            ...toEmployeeCreateReq(fields),
            city_id: cityId,
            office_id: org.officeId,
          });
        }
      }

      try {
        await vacanciesApi.update(vacancy.id, {
          node_id: vacancy.nodeId,
          user_id: employeeId,
          city_code: vacancy.cityCode || org.cityCode || undefined,
          office_code: vacancy.officeCode || org.officeCode || undefined,
          position_code: vacancy.position,
          position_name: vacancy.position,
          is_manager: vacancy.isManager,
          position_description: vacancy.description,
          job_offer_link: vacancy.jobOffer,
        });
      } catch (error) {
        if (createdEmployeeId !== null) {
          try {
            await employeesApi.delete(createdEmployeeId);
          } catch {
            // Оставляем исходную ошибку назначения.
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      assignEmployeeMutation.reset();
      setAssignEmployeeTarget(null);
    },
  });

  const createEmployeeVacancyMutation = useMutation({
    mutationFn: async (data: EmployeeVacancyCreateFields) => {
      const shouldCreateEmployee =
        Boolean(data.surname.trim()) || Boolean(data.first_name.trim());
      let employeeId: number | null = null;

      if (shouldCreateEmployee) {
        const employeeRes = await employeesApi.create(toEmployeeCreateReq(data));
        employeeId = employeeRes.data.id;
      }

      const positionDescription = data.comment.trim();

      try {
        const vacancyRes = await vacanciesApi.create({
          node_id: data.nodeId,
          position_code: data.position,
          position_name: data.position,
          user_id: employeeId,
          city_code: data.cityCode,
          office_code: data.officeCode || undefined,
          is_manager: data.isManager,
          position_description: positionDescription,
          job_offer_link: "",
        });

        if (employeeId) {
          await vacanciesApi.update(vacancyRes.data.id, {
            node_id: data.nodeId,
            user_id: employeeId,
            city_code: data.cityCode || undefined,
            office_code: data.officeCode || undefined,
            position_code: data.position,
            position_name: data.position,
            is_manager: data.isManager,
            position_description: positionDescription,
            job_offer_link: "",
          });
        }

        if (employeeId && (data.cityId || data.officeId)) {
          await employeesApi.update(employeeId, {
            ...toEmployeeCreateReq(data),
            city_id: data.cityId,
            office_id: data.officeId,
          });
        }
      } catch (error) {
        // Сотрудник уже создан, а вакансия нет — иначе в отчёте остаются «без должности».
        if (employeeId !== null) {
          try {
            await employeesApi.delete(employeeId);
          } catch {
            // Оставляем исходную ошибку создания вакансии.
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgTree"] });
      queryClient.invalidateQueries({ queryKey: ["employees", "report"] });
      queryClient.invalidateQueries({ queryKey: ["dict", "employees"] });
      clearEmployeeAddDraft();
      createEmployeeVacancyMutation.reset();
      setAddRowKey((key) => key + 1);
    },
  });

  const subordinatesByManagerId = useMemo(
    () => buildManagerSubordinatesMap(treeQuery.data ?? []),
    [treeQuery.data],
  );

  const selectedCityId = useMemo(() => {
    if (!filters.city) return null;
    return citiesQuery.data?.find((city) => city.name === filters.city)?.id ?? null;
  }, [filters.city, citiesQuery.data]);

  const officesQuery = useQuery({
    queryKey: ["offices", "city", selectedCityId] as const,
    queryFn: () => officesApi.getByCity(selectedCityId!).then((res) => res.data ?? []),
    enabled: selectedCityId !== null,
  });

  const cityCountryByName = useMemo(() => {
    const countryNameById = new Map(
      (countriesQuery.data ?? []).map((country) => [country.id, country.name]),
    );
    const map = new Map<string, string>();
    for (const city of citiesQuery.data ?? []) {
      const countryName = countryNameById.get(city.country_id);
      if (countryName) map.set(city.name, countryName);
    }
    return map;
  }, [citiesQuery.data, countriesQuery.data]);

  const filterOptions = useMemo(() => {
    const cities = new Set<string>();
    const offices = new Set<string>();
    const hireYears = new Set<string>();

    for (const info of orgByEmployeeId.values()) {
      if (info.city) cities.add(info.city);
      if (info.office) offices.add(info.office);
    }
    for (const row of vacantRows) {
      if (row.org.city) cities.add(row.org.city);
      if (row.org.office) offices.add(row.org.office);
    }

    for (const employee of employees) {
      const hireDateParts = getHireDateParts(employee.hire_date);
      if (hireDateParts?.year) hireYears.add(hireDateParts.year);
    }

    const cityList = [...cities].sort((a, b) => a.localeCompare(b, "ru"));
    const countries = new Set<string>();
    for (const city of cityList) {
      const country = cityCountryByName.get(city);
      if (country) countries.add(country);
    }

    return {
      countries: [...countries].sort((a, b) => a.localeCompare(b, "ru")),
      cities: cityList,
      offices: [...offices].sort((a, b) => a.localeCompare(b, "ru")),
      hireYears: [...hireYears].sort((a, b) => b.localeCompare(a, "ru")),
    };
  }, [employees, orgByEmployeeId, vacantRows, cityCountryByName]);

  const citiesForCountry = useMemo(() => {
    if (!filters.country) return filterOptions.cities;
    return filterOptions.cities.filter(
      (city) => cityCountryByName.get(city) === filters.country,
    );
  }, [filterOptions.cities, filters.country, cityCountryByName]);

  const tableRows = useMemo<EmployeesTableRow[]>(() => {
    const employeeRows = employees.map((employee) => ({
      kind: "employee" as const,
      id: employee.id,
      employee,
      org: orgByEmployeeId.get(employee.id),
      vacancy: vacancyByEmployeeId.get(employee.id),
    }));
    // В архиве только архивные сотрудники: их позиции уже освобождены.
    if (archiveView) return employeeRows;
    return [...employeeRows, ...vacantRows];
  }, [
    employees,
    orgByEmployeeId,
    vacancyByEmployeeId,
    vacantRows,
    archiveView,
  ]);

  const filteredRows = useMemo(() => {
    const hasTextFilters = Object.values(filters).some((value) => value.trim());

    let result = tableRows;

    if (managersOnlyFilter) {
      result = tableRows.filter(
        (row) => row.kind === "employee" && row.org?.isManager,
      );
    } else if (managerFilterId !== null) {
      const subordinates = subordinatesByManagerId.get(managerFilterId);
      const team = tableRows.filter(
        (row) =>
          row.kind === "employee" &&
          (row.employee.id === managerFilterId ||
            (subordinates?.has(row.employee.id) ?? false)),
      );
      const manager = team.find(
        (row) => row.kind === "employee" && row.employee.id === managerFilterId,
      );
      result = manager
        ? [
            manager,
            ...team.filter(
              (row) =>
                !(row.kind === "employee" && row.employee.id === managerFilterId),
            ),
          ]
        : team;
    }

    if (!hasTextFilters) {
      if (rowKindFilter === "all") return result;
      return result.filter((row) => row.kind === rowKindFilter);
    }

    const textFiltered = result.filter((row) => {
      if (row.kind === "vacancy") {
        const org = row.org;
        const q = (value: string) => value.trim().toLowerCase();
        if (filters.name && !"вакантно".includes(q(filters.name))) return false;
        if (filters.gender || filters.hireYear || filters.hireMonth || filters.hireDay)
          return false;
        if (
          filters.position &&
          !org.position.toLowerCase().includes(q(filters.position))
        )
          return false;
        if (
          filters.country &&
          (org.city ? cityCountryByName.get(org.city) : undefined) !==
            filters.country
        ) {
          return false;
        }
        if (filters.city && org.city !== filters.city) return false;
        if (filters.office && org.office !== filters.office) return false;
        if (filters.department && org.department !== filters.department) return false;
        return true;
      }

      return matchesFilters(row.employee, row.org, filters, cityCountryByName);
    });

    if (rowKindFilter === "all") return textFiltered;
    return textFiltered.filter((row) => row.kind === rowKindFilter);
  }, [
    tableRows,
    filters,
    rowKindFilter,
    managersOnlyFilter,
    managerFilterId,
    subordinatesByManagerId,
    cityCountryByName,
  ]);

  const hasClientFilters =
    rowKindFilter !== "all" ||
    managersOnlyFilter ||
    managerFilterId !== null ||
    Object.values(filters).some((value) => value.trim());
  const hasFilters = hasClientFilters || archiveView;

  const employeeCounts = useMemo(() => {
    const total = tableRows.filter((row) => row.kind === "employee").length;
    const filtered = filteredRows.filter((row) => row.kind === "employee").length;
    return { total, filtered };
  }, [tableRows, filteredRows]);

  const vacancyCounts = useMemo(() => {
    const total = tableRows.filter((row) => row.kind === "vacancy").length;
    const filtered = filteredRows.filter((row) => row.kind === "vacancy").length;
    return { total, filtered };
  }, [tableRows, filteredRows]);

  const resetAllFilters = () => {
    setFilters({ ...emptyFilters });
    setArchiveView(false);
    setRowKindFilter("all");
    setManagersOnlyFilter(false);
    setManagerFilterId(null);
  };

  const exportMutation = useMutation({
    mutationFn: () =>
      exportApi.excel(
        buildExportRequest(
          filters,
          countriesQuery.data ?? [],
          citiesQuery.data ?? [],
          officesQuery.data ?? [],
          treeQuery.data ?? [],
        ),
      ),
  });

  return (
    <div className="employees-page absolute inset-0 flex flex-col overflow-hidden bg-gray-50 px-4 py-6 min-[1070px]:px-8 dark:bg-gray-950">
      <div className="mb-6 shrink-0">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Сотрудники
          <CommentHeadingIcon />
        </h1>
        <PageDescription className="mt-2 max-w-3xl">
          Фильтры сужают таблицу, счётчики переключают сотрудников, вакансии и
          архив. Клик по ФИО открывает карточку, по городу, офису и отделу
          фильтрует список, по должности открывает вакансию. Звезда оставляет
          руководителей или их подчинённых. Кнопка карточки добавляет в таблицу
          дату устройства, журнал перемещений, причину изменений и стаж. Кнопка
          с таблицей выгружает текущую выборку в Excel.
        </PageDescription>
      </div>
      <div className="mb-6 flex shrink-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-3">
        <label className="max-md:w-full min-w-[160px] flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            ФИО
          </span>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={filters.name}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Поиск по ФИО"
              data-hint="Оставляет в таблице сотрудников, в имени которых есть введённый текст"
              className={`${dictInputClass} pl-9`}
            />
          </div>
        </label>

        <div className="flex w-full gap-3 md:contents">
          <label className="max-md:min-w-0 max-md:flex-1 min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Страна
            </span>
            <FilterSelect
              value={filters.country}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  country: e.target.value,
                  city: "",
                  office: "",
                }))
              }
              data-hint="Оставляет записи выбранной страны и сбрасывает город и офис"
            >
              <option value="">Все страны</option>
              {filterOptions.countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </FilterSelect>
          </label>

          <label className="max-md:min-w-0 max-md:flex-1 min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Город
            </span>
            <FilterSelect
              value={filters.city}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  city: e.target.value,
                  office: "",
                }))
              }
              disabled={Boolean(filters.country) && citiesForCountry.length === 0}
              data-hint="Оставляет записи выбранного города и сбрасывает офис"
              className="disabled:opacity-60"
            >
              <option value="">
                {filters.country && citiesForCountry.length === 0
                  ? "Нет городов"
                  : "Все города"}
              </option>
              {citiesForCountry.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </FilterSelect>
          </label>

          <label className="max-md:min-w-0 max-md:flex-1 min-w-[160px]">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Офис
            </span>
            <FilterSelect
              value={filters.office}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, office: e.target.value }))
              }
              disabled={!filters.city || officesQuery.isPending}
              data-hint="Оставляет записи выбранного офиса. Список появляется после выбора города"
              className="disabled:opacity-60"
            >
              <option value="">
                {!filters.city
                  ? "Сначала выберите город"
                  : officesQuery.isPending
                    ? "Загрузка…"
                    : "Все офисы"}
              </option>
              {officesQuery.data?.map((office) => (
                <option key={office.id} value={office.name}>
                  {office.name}
                </option>
              ))}
            </FilterSelect>
          </label>
        </div>

        <label className="block max-md:w-full w-[360px] shrink-0">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Отделы
          </span>
          <DepartmentTreeSelect
            variant="filter"
            tree={treeQuery.data ?? []}
            isLoading={treeQuery.isPending}
            value={filters.department}
            hint="Оставляет записи выбранного отдела"
            onChange={(department) =>
              setFilters((prev) => ({ ...prev, department }))
            }
          />
        </label>

        <label className="max-md:w-full min-w-[160px] flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Должность
          </span>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={filters.position}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, position: e.target.value }))
              }
              placeholder="Поиск по должности"
              data-hint="Оставляет записи, в названии должности которых есть введённый текст"
              className={`${dictInputClass} pl-9`}
            />
          </div>
        </label>

        <div className="flex w-full gap-3 md:contents">
          <label className="max-md:min-w-[120px] max-md:shrink-0 min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Пол
            </span>
            <FilterSelect
              value={filters.gender}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, gender: e.target.value }))
              }
              data-hint="Оставляет сотрудников выбранного пола"
            >
              <option value="">Все</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </FilterSelect>
          </label>

          <div className="max-md:min-w-0 max-md:flex-1 min-w-[332px]">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Дата устройства
            </span>
            <div className="flex gap-2">
              <FilterSelect
                value={filters.hireYear}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, hireYear: e.target.value }))
                }
                data-hint="Оставляет сотрудников, принятых в выбранном году"
                wrapperClassName="max-md:min-w-0 max-md:flex-1 min-w-[112px]"
              >
                <option value="">Год</option>
                {filterOptions.hireYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                value={filters.hireMonth}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, hireMonth: e.target.value }))
                }
                data-hint="Оставляет сотрудников, принятых в выбранном месяце"
                wrapperClassName="max-md:min-w-0 max-md:flex-1 min-w-[108px]"
              >
                <option value="">Месяц</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(
                  (month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ),
                )}
              </FilterSelect>
              <FilterSelect
                value={filters.hireDay}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, hireDay: e.target.value }))
                }
                data-hint="Оставляет сотрудников, принятых в выбранный день месяца"
                wrapperClassName="max-md:min-w-0 max-md:flex-1 min-w-[96px]"
              >
                <option value="">День</option>
                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map(
                  (day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ),
                )}
              </FilterSelect>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-end gap-3 md:contents">
          <button
            type="button"
            onClick={resetAllFilters}
            data-hint="Очищает все фильтры и снова показывает полный список"
            disabled={!hasFilters}
            className="min-w-[150px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            Сбросить фильтры
          </button>

          <div className="shrink-0">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Сотрудники
            </span>
            <button
              type="button"
              onClick={() => {
                setArchiveView(false);
                setRowKindFilter((prev) => (prev === "employee" ? "all" : "employee"));
              }}
              data-hint="Показывает только сотрудников. Повторное нажатие возвращает весь список"
              className={`inline-flex min-w-[72px] items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                !archiveView && rowKindFilter === "employee"
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-gray-200 bg-white text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {activeReportQuery.isPending ? (
                <span className="text-gray-400">…</span>
              ) : !archiveView && hasClientFilters ? (
                <span className="inline-flex items-center gap-1.5">
                  {employeeCounts.filtered}
                  <span className="text-gray-400">
                    из {employeeCounts.total}
                  </span>
                </span>
              ) : archiveView ? (
                activeReportQuery.data?.length ?? 0
              ) : (
                employeeCounts.total
              )}
            </button>
          </div>

          <div className="shrink-0">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Вакансии
            </span>
            <button
              type="button"
              onClick={() => {
                setArchiveView(false);
                setRowKindFilter((prev) => (prev === "vacancy" ? "all" : "vacancy"));
              }}
              data-hint="Показывает только вакансии. Повторное нажатие возвращает весь список"
              className={`inline-flex min-w-[72px] items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                !archiveView && rowKindFilter === "vacancy"
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-gray-200 bg-white text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {activeReportQuery.isPending ? (
                <span className="text-gray-400">…</span>
              ) : !archiveView && hasClientFilters ? (
                <span className="inline-flex items-center gap-1.5">
                  {vacancyCounts.filtered}
                  <span className="text-gray-400">
                    из {vacancyCounts.total}
                  </span>
                </span>
              ) : archiveView ? (
                vacantRows.length
              ) : (
                vacancyCounts.total
              )}
            </button>
          </div>

          <div className="shrink-0">
            <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Архив
            </span>
            <button
              type="button"
              onClick={() => {
                setRowKindFilter("all");
                setManagersOnlyFilter(false);
                setManagerFilterId(null);
                setArchiveView((prev) => !prev);
              }}
              data-hint="Переключает таблицу между действующими сотрудниками и архивом"
              className={`inline-flex min-w-[72px] items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors ${
                archiveView
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-gray-200 bg-white text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {archivedReportQuery.isPending ? (
                <span className="text-gray-400">…</span>
              ) : archiveView && hasClientFilters ? (
                <span className="inline-flex items-center gap-1.5">
                  {employeeCounts.filtered}
                  <span className="text-gray-400">
                    из {archivedReportQuery.data?.length ?? employeeCounts.total}
                  </span>
                </span>
              ) : (
                archivedReportQuery.data?.length ?? 0
              )}
            </button>
          </div>

          <button
            type="button"
            aria-pressed={showCardColumns}
            aria-label={
              showCardColumns
                ? "Скрыть данные карточки"
                : "Показать данные карточки"
            }
            title={
              showCardColumns
                ? "Скрыть данные карточки"
                : "Показать данные карточки"
            }
            data-hint="Добавляет в таблицу дату устройства, журнал перемещений, причину изменений и стаж"
            onClick={() => setShowCardColumns((value) => !value)}
            className={`inline-flex h-[42px] w-[72px] shrink-0 items-center justify-center rounded-lg border transition-colors ${
              showCardColumns
                ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300"
                : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            <IdCard size={32} />
          </button>

          <button
            type="button"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            title="Выгрузить в Excel"
            aria-label="Выгрузить в Excel"
            data-hint="Скачивает текущую выборку таблицы файлом Excel"
            className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-emerald-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-emerald-400 dark:hover:bg-gray-700"
          >
            <FileSpreadsheet size={20} />
          </button>
        </div>
      </div>

      {(archiveEmployeeMutation.isError ||
        deleteEmployeeMutation.isError ||
        deleteVacancyMutation.isError ||
        exportMutation.isError) && (
        <ApiErrorModal
          error={
            archiveEmployeeMutation.error ??
            deleteEmployeeMutation.error ??
            deleteVacancyMutation.error ??
            exportMutation.error
          }
          onClose={() => {
            archiveEmployeeMutation.reset();
            deleteEmployeeMutation.reset();
            deleteVacancyMutation.reset();
            exportMutation.reset();
          }}
        />
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
      <DictTable<EmployeesTableRow>
        rowHoverVariant="border"
        wrapperClassName={`employees-dict-table h-full${
          showCardColumns ? " employees-card-columns" : ""
        }`}
        renderMobileCard={(row, actions) => {
          const nameColumn = row.kind === "employee"
            ? employeeNameContent(row.employee)
            : <span className="text-amber-500">Вакантно</span>;

          const headerOnClick = () => {
            if (row.kind === "employee") {
              setSelectedEmployee(row.employee);
              return;
            }
            setAssignEmployeeTarget({ vacancy: row.vacancy, org: row.org });
          };

          const city = row.org?.city;
          const office = row.org?.office;
          const department = row.org?.department;
          const position = row.org?.position;

          return (
            <EmployeesRowCard
              headerLeading={
                row.kind === "employee" && row.org?.isManager ? (
                  <button
                    type="button"
                    onClick={() => {
                      setManagersOnlyFilter(false);
                      setManagerFilterId((prev) =>
                        prev === row.employee.id ? null : row.employee.id,
                      );
                    }}
                    aria-label="Руководитель"
                    data-hint={
                      managerFilterId === row.employee.id
                        ? "Снимает отбор по подчинённым этого руководителя"
                        : "Оставляет в таблице только подчинённых этого руководителя"
                    }
                    title={
                      managerFilterId === row.employee.id
                        ? "Сбросить фильтр"
                        : "Показать подчинённых"
                    }
                    className="mt-0.5 shrink-0"
                  >
                    <Star
                      size={14}
                      className={
                        managerFilterId === row.employee.id
                          ? "fill-amber-500 text-amber-500"
                          : "fill-amber-400 text-amber-400"
                      }
                    />
                  </button>
                ) : undefined
              }
              headerContent={nameColumn}
              headerOnClick={headerOnClick}
              headerHint={
                row.kind === "employee"
                  ? "Открывает карточку сотрудника"
                  : "Открывает назначение сотрудника на эту вакансию"
              }
              actions={actions}
              fields={[
                {
                  key: "city",
                  label: "Город",
                  hint: "Фильтрует таблицу по этому городу",
                  onClick: city
                    ? () => setFilters((prev) => ({ ...prev, city, office: "" }))
                    : undefined,
                  content: city ? (
                    <span className="text-blue-600 dark:text-blue-400">{city}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  ),
                },
                {
                  key: "office",
                  label: "Офис",
                  hint: "Фильтрует таблицу по этому офису",
                  onClick:
                    office && row.org
                      ? () =>
                          setFilters((prev) => ({
                            ...prev,
                            city: row.org!.city || prev.city,
                            office,
                          }))
                      : undefined,
                  content: office ? (
                    <span className="text-blue-600 dark:text-blue-400">{office}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  ),
                },
                {
                  key: "department",
                  label: "Отдел",
                  hint: "Фильтрует таблицу по этому отделу",
                  onClick: department
                    ? () => setFilters((prev) => ({ ...prev, department }))
                    : undefined,
                  content: department ? (
                    <span className="text-blue-600 dark:text-blue-400">{department}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  ),
                },
                {
                  key: "position",
                  label: "Должность",
                  hint: "Открывает редактирование этой вакансии",
                  onClick: row.vacancy
                    ? () => setEditVacancyModal(row.vacancy!)
                    : undefined,
                  content: position ? (
                    <span className="text-blue-600 dark:text-blue-400">{position}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  ),
                },
                ...(showCardColumns
                  ? [
                      {
                        key: "hireDate",
                        label: "Дата устройства",
                        content: cardHireDate(row),
                      },
                      {
                        key: "history",
                        label: "Журнал перемещений",
                        content: cardHistoryList(
                          row,
                          historiesQuery.data,
                          !historiesQuery.data && !historiesQuery.isError,
                          "journal",
                        ),
                      },
                      {
                        key: "changeReason",
                        label: "Причина изменений",
                        content: cardHistoryList(
                          row,
                          historiesQuery.data,
                          !historiesQuery.data && !historiesQuery.isError,
                          "reason",
                        ),
                      },
                      {
                        key: "tenure",
                        label: "Стаж",
                        content: cardTenure(row),
                      },
                    ]
                  : []),
              ]}
            />
          );
        }}
        columns={[
          {
            key: "isManager",
            header: (
              <Star
                size={12}
                aria-label="Только руководители"
                title={
                  managersOnlyFilter
                    ? "Сбросить фильтр"
                    : "Показать только руководителей"
                }
                className={`mx-auto shrink-0 ${
                  managersOnlyFilter
                    ? "fill-amber-400 text-amber-400"
                    : "fill-gray-300 text-gray-300 dark:fill-gray-600 dark:text-gray-600"
                }`}
              />
            ),
            headerClassName: "w-10 text-center",
            onHeaderClick: () => {
              setManagersOnlyFilter((prev) => !prev);
              setManagerFilterId(null);
            },
            headerHint: managersOnlyFilter
              ? "Снимает отбор и снова показывает всех сотрудников"
              : "Оставляет в таблице только руководителей",
            className: "text-center",
            onClick: (r) => {
              if (r.kind !== "employee" || !r.org?.isManager) return;
              setManagersOnlyFilter(false);
              setManagerFilterId((prev) => (prev === r.employee.id ? null : r.employee.id));
            },
            hint: (r) => {
              if (r.kind !== "employee" || !r.org?.isManager) return undefined;
              return managerFilterId === r.employee.id
                ? "Снимает отбор по подчинённым этого руководителя"
                : "Оставляет в таблице только подчинённых этого руководителя";
            },
            render: (r) =>
              r.kind === "employee" && r.org?.isManager ? (
                <Star
                  size={12}
                  aria-label="Руководитель"
                  title={
                    managerFilterId === r.employee.id
                      ? "Сбросить фильтр"
                      : "Показать подчинённых"
                  }
                  className={`mx-auto shrink-0 ${
                    managerFilterId === r.employee.id
                      ? "fill-amber-500 text-amber-500"
                      : "fill-amber-400 text-amber-400"
                  }`}
                />
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
          {
            key: "name",
            header: "ФИО",
            headerClassName: "whitespace-normal break-normal",
            className: "w-max whitespace-normal break-normal align-top",
            onClick: (row) => {
              if (row.kind === "employee") {
                setSelectedEmployee(row.employee);
                return;
              }
              setAssignEmployeeTarget({ vacancy: row.vacancy, org: row.org });
            },
            hint: (row) =>
              row.kind === "employee"
                ? "Открывает карточку сотрудника"
                : "Открывает назначение сотрудника на эту вакансию",
            render: (r) =>
              r.kind === "employee" ? (
                employeeNameContent(r.employee)
              ) : (
                <span className="cursor-pointer text-amber-500 hover:underline">
                  Вакантно
                </span>
              ),
          },
          {
            key: "city",
            header: "Город",
            headerClassName: "w-px whitespace-nowrap",
            className: "w-px whitespace-nowrap",
            onClick: (r) => {
              const city = r.org?.city;
              if (city) setFilters((prev) => ({ ...prev, city, office: "" }));
            },
            hint: (r) =>
              r.org?.city ? "Фильтрует таблицу по этому городу" : undefined,
            render: (r) => {
              const city = r.org?.city;
              return city ? (
                <span className="text-blue-600 hover:underline dark:text-blue-400">
                  {city}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
          {
            key: "office",
            header: "Офис",
            headerClassName: "w-px whitespace-nowrap",
            className: "w-px whitespace-nowrap",
            onClick: (r) => {
              const org = r.org;
              if (!org?.office) return;
              setFilters((prev) => ({
                ...prev,
                city: org.city || prev.city,
                office: org.office,
              }));
            },
            hint: (r) =>
              r.org?.office ? "Фильтрует таблицу по этому офису" : undefined,
            render: (r) => {
              const office = r.org?.office;
              return office ? (
                <span className="text-blue-600 hover:underline dark:text-blue-400">
                  {office}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
          {
            key: "department",
            header: "Отдел",
            headerClassName: "whitespace-normal break-normal",
            className: "w-max whitespace-normal break-normal align-top",
            onClick: (r) => {
              const department = r.org?.department;
              if (department) setFilters((prev) => ({ ...prev, department }));
            },
            hint: (r) =>
              r.org?.department
                ? "Фильтрует таблицу по этому отделу"
                : undefined,
            render: (r) => {
              const department = r.org?.department;
              return department ? (
                <span className="text-blue-600 hover:underline dark:text-blue-400">
                  {department}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
          {
            key: "position",
            header: "Должность",
            headerClassName: "whitespace-normal break-normal",
            className: "w-max whitespace-normal break-normal align-top",
            onClick: (r) => {
              const vacancy = r.vacancy;
              if (vacancy) setEditVacancyModal(vacancy);
            },
            hint: (r) =>
              r.vacancy ? "Открывает редактирование этой вакансии" : undefined,
            render: (r) => {
              const position = r.org?.position;
              return position ? (
                <span className="text-blue-600 hover:underline dark:text-blue-400">
                  {position}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              );
            },
          },
          ...(showCardColumns
            ? [
                {
                  key: "hireDate",
                  header: "Дата устройства",
                  headerClassName: "whitespace-nowrap",
                  className: "whitespace-nowrap align-top",
                  render: (row: EmployeesTableRow) => cardHireDate(row),
                },
                {
                  key: "history",
                  header: "Журнал перемещений",
                  headerClassName: "whitespace-normal",
                  className: "min-w-[220px] whitespace-normal align-top",
                  render: (row: EmployeesTableRow) =>
                    cardHistoryList(
                      row,
                      historiesQuery.data,
                      !historiesQuery.data && !historiesQuery.isError,
                      "journal",
                    ),
                },
                {
                  key: "changeReason",
                  header: "Причина изменений",
                  headerClassName: "whitespace-normal",
                  className: "min-w-[160px] whitespace-normal align-top",
                  render: (row: EmployeesTableRow) =>
                    cardHistoryList(
                      row,
                      historiesQuery.data,
                      !historiesQuery.data && !historiesQuery.isError,
                      "reason",
                    ),
                },
                {
                  key: "tenure",
                  header: "Стаж",
                  headerClassName: "whitespace-nowrap",
                  className: "whitespace-nowrap align-top",
                  render: (row: EmployeesTableRow) => cardTenure(row),
                },
              ]
            : []),
        ]}
        rows={filteredRows}
        rowKey={(r) => r.id}
        isLoading={reportQuery.isPending}
        isError={reportQuery.isError}
        errorMessage={formatApiError(reportQuery.error)}
        emptyMessage={hasFilters ? "Ничего не найдено" : "Записей пока нет"}
        showDelete={(row) =>
          row.kind === "vacancy" ||
          (archiveView &&
            row.kind === "employee" &&
            row.employee.status === "archived")
        }
        deleteHint={(row) =>
          row.kind === "vacancy"
            ? "Безвозвратно удаляет вакансию"
            : "Безвозвратно удаляет сотрудника из архива"
        }
        archiveHint="Снимает сотрудника со всех позиций и переносит его в архив"
        onDelete={(row) => {
          if (row.kind === "vacancy") {
            const vacancyTitle = row.org.position || "эту вакансию";
            const confirmed = window.confirm(
              `Удалить вакансию «${vacancyTitle}»? Действие необратимо.`,
            );
            if (!confirmed) return;
            deleteVacancyMutation.mutate(row.vacancy.id);
            return;
          }
          if (!archiveView || row.employee.status !== "archived") return;
          deleteEmployeeMutation.reset();
          setEmployeeToDelete(row.employee);
        }}
        showArchive={(row) =>
          row.kind === "employee" && row.employee.status !== "archived"
        }
        onArchive={(row) => {
          if (row.kind !== "employee" || row.employee.status === "archived") return;
          const employeeName = fullName(row.employee) || "этого сотрудника";
          const confirmed = window.confirm(
            `Архивировать ${employeeName}? Сотрудник будет снят со всех позиций.`,
          );
          if (!confirmed) return;
          archiveEmployeeMutation.mutate(row.employee.id);
        }}
        topRow={
          archiveView ? undefined : (
          <EmployeeAddRow
            key={addRowKey}
            columnsCount={6 + (showCardColumns ? CARD_COLUMN_COUNT : 0)}
            trailingEmptyColumns={showCardColumns ? CARD_COLUMN_COUNT : 0}
            cities={citiesQuery.data ?? []}
            orgNodes={treeQuery.data ?? []}
            isPending={createEmployeeVacancyMutation.isPending}
            error={formatVacancyError(createEmployeeVacancyMutation.error)}
            onSubmit={(data) => createEmployeeVacancyMutation.mutate(data)}
          />
          )
        }
        topRowMobile={
          archiveView ? undefined : (
          <EmployeeAddCard
            key={addRowKey}
            cities={citiesQuery.data ?? []}
            orgNodes={treeQuery.data ?? []}
            isPending={createEmployeeVacancyMutation.isPending}
            error={formatVacancyError(createEmployeeVacancyMutation.error)}
            onSubmit={(data) => createEmployeeVacancyMutation.mutate(data)}
          />
          )
        }
      />
      </div>

      {selectedEmployee && (
        <EmployeeInfoModal
          employee={selectedEmployee}
          onClose={() => {
            updateEmployeeMutation.reset();
            setSelectedEmployee(null);
          }}
          isPending={updateEmployeeMutation.isPending}
          error={formatApiError(updateEmployeeMutation.error)}
          onSubmit={(fields) => {
            updateEmployeeMutation.mutate({
              id: selectedEmployee.id,
              body: toEmployeeUpdateReq(selectedEmployee, fields),
            });
          }}
        />
      )}

      {editVacancyModal && (
        <EditVacancyModal
          data={editVacancyModal}
          onClose={() => {
            updateVacancyMutation.reset();
            setEditVacancyModal(null);
          }}
          isPending={updateVacancyMutation.isPending}
          error={formatVacancyError(updateVacancyMutation.error)}
          onSubmit={(data) => {
            updateVacancyMutation.mutate({
              id: editVacancyModal.id,
              body: toVacancyUpdateReq(data),
            });
          }}
        />
      )}

      {employeeToDelete && (
        <DeleteArchivedEmployeeModal
          employeeName={fullName(employeeToDelete)}
          isPending={deleteEmployeeMutation.isPending}
          onClose={() => {
            if (deleteEmployeeMutation.isPending) return;
            deleteEmployeeMutation.reset();
            setEmployeeToDelete(null);
          }}
          onConfirm={() => deleteEmployeeMutation.mutate(employeeToDelete.id)}
        />
      )}

      {assignEmployeeTarget && (
        <AssignEmployeeModal
          vacancy={assignEmployeeTarget.vacancy}
          onClose={() => {
            assignEmployeeMutation.reset();
            setAssignEmployeeTarget(null);
          }}
          isPending={assignEmployeeMutation.isPending}
          error={formatVacancyError(assignEmployeeMutation.error)}
          onSubmit={(fields) => {
            assignEmployeeMutation.mutate({
              vacancy: assignEmployeeTarget.vacancy,
              org: assignEmployeeTarget.org,
              fields,
            });
          }}
        />
      )}
    </div>
  );
}
