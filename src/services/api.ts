import type {
  ApiResponse,
  Employer,
  Entity,
  NodeCreateReq,
  NodeUpdateReq,
  OrgNode,
  OrgNodeRow,
  OrgNodesResponse,
  Vacancy,
  VacancyReq,
  VacancyUpdateReq,
} from "#/types/api";

const BASE_URL = "/api";

type Method = "GET" | "POST" | "PUT" | "DELETE";

async function request<T>(
  path: string,
  init: { method?: Method; body?: unknown } = {},
): Promise<T> {
  const { method = "GET", body } = init;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? res.statusText), {
      code: res.status,
    });
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const orgNodesApi = {
  /** Получить всё организационное дерево */
  getTree: (): Promise<OrgNodesResponse> => request("/orgnodes"),

  /** Получить дерево относительно узла */
  getSubTree: (id: number): Promise<OrgNodesResponse> =>
    request(`/orgnodes/${id}`),

  /** Получить дерево с вакансиями */
  getTreeVacancies: (): Promise<OrgNodesResponse> =>
    request("/orgnodes/tree/vacancies"),

  /** Получить узел по ID (без дочерних) */
  getNode: (id: number): Promise<ApiResponse<OrgNodeRow>> =>
    request(`/orgnodes/node/${id}`),

  /** Создать организационный узел */
  createNode: (body: NodeCreateReq): Promise<ApiResponse<null>> =>
    request("/orgnodes/node", { method: "POST", body }),

  /** Обновить организационный узел */
  updateNode: (id: number, body: NodeUpdateReq): Promise<ApiResponse<null>> =>
    request(`/orgnodes/node/${id}`, { method: "PUT", body }),

  /** Удалить организационный узел */
  deleteNode: (id: number): Promise<void> =>
    request(`/orgnodes/node/${id}`, { method: "DELETE" }),
};

export const vacanciesApi = {
  /** Получить вакансию по ID */
  get: (id: number): Promise<ApiResponse<Vacancy>> =>
    request(`/vacancies/${id}`),

  /** Создать вакансию */
  create: (body: VacancyReq): Promise<ApiResponse<null>> =>
    request("/vacancies", { method: "POST", body }),

  /** Обновить вакансию */
  update: (id: number, body: VacancyUpdateReq): Promise<ApiResponse<null>> =>
    request(`/vacancies/${id}`, { method: "PUT", body }),

  /** Удалить вакансию */
  delete: (id: number): Promise<void> =>
    request(`/vacancies/${id}`, { method: "DELETE" }),

  /** Получить отдел со списком пустых вакансий */
  getEmpty: (nodeId: number): Promise<ApiResponse<OrgNode>> =>
    request(`/vacancies/${nodeId}/vacancies/empty`),

  /** Получить отдел со списком занятых вакансий */
  getFilled: (nodeId: number): Promise<ApiResponse<OrgNode>> =>
    request(`/vacancies/${nodeId}/vacancies/filled`),
};

export const dictApi = {
  /** Справочник городов */
  getCities: (): Promise<ApiResponse<Entity[]>> => request("/dict/cities"),

  /** Справочник сотрудников */
  getEmployees: (): Promise<ApiResponse<Employer[]>> => request("/dict/employees"),
};
