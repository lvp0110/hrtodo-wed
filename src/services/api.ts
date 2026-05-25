import { queryOptions } from "@tanstack/react-query";
import type {
  ApiResponse,
  City,
  CityReq,
  Country,
  CountryReq,
  Employer,
  Entity,
  NodeCreateReq,
  NodeUpdateReq,
  OrgNode,
  OrgNodeRow,
  OrgNodeType,
  OrgNodeTypeReq,
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
  create: (body: VacancyReq): Promise<ApiResponse<Vacancy>> =>
    request("/vacancies", { method: "POST", body }),

  /** Обновить вакансию */
  update: (id: number, body: VacancyUpdateReq): Promise<ApiResponse<Vacancy>> =>
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
  /**
   * Справочник городов. Бэк отдаёт усечённую модель (без id и country_id),
   * поэтому редактирование/удаление из списка невозможно — только просмотр
   * и добавление новых через POST /cities.
   */
  getCities: (): Promise<ApiResponse<Entity[]>> => request("/dict/cities"),

  /** Справочник стран */
  getCountries: (): Promise<ApiResponse<Country[]>> => request("/dict/countries"),

  /** Справочник сотрудников */
  getEmployees: (): Promise<ApiResponse<Employer[]>> => request("/dict/employees"),

  /** Справочник типов организационных узлов */
  getNodeTypes: (): Promise<ApiResponse<OrgNodeType[]>> =>
    request("/dict/orgnode/type"),
};

export const citiesApi = {
  /** Получить город по ID */
  get: (id: number): Promise<ApiResponse<City>> => request(`/cities/${id}`),

  /** Создать город */
  create: (body: CityReq): Promise<ApiResponse<City>> =>
    request("/cities", { method: "POST", body }),

  /** Обновить город */
  update: (id: number, body: CityReq): Promise<ApiResponse<City>> =>
    request(`/cities/${id}`, { method: "PUT", body }),

  /** Удалить город */
  delete: (id: number): Promise<void> =>
    request(`/cities/${id}`, { method: "DELETE" }),
};

export const countriesApi = {
  /** Получить страну по ID */
  get: (id: number): Promise<ApiResponse<Country>> => request(`/country/${id}`),

  /** Создать страну */
  create: (body: CountryReq): Promise<ApiResponse<Country>> =>
    request("/country", { method: "POST", body }),

  /** Обновить страну */
  update: (id: number, body: CountryReq): Promise<ApiResponse<Country>> =>
    request(`/country/${id}`, { method: "PUT", body }),

  /** Удалить страну */
  delete: (id: number): Promise<void> =>
    request(`/country/${id}`, { method: "DELETE" }),
};

export const orgNodeTypesApi = {
  /** Получить тип узла по ID */
  get: (id: number): Promise<ApiResponse<OrgNodeType>> =>
    request(`/orgnodetypes/${id}`),

  /** Создать тип узла */
  create: (body: OrgNodeTypeReq): Promise<ApiResponse<OrgNodeType>> =>
    request("/orgnodetypes", { method: "POST", body }),

  /** Обновить тип узла */
  update: (id: number, body: OrgNodeTypeReq): Promise<ApiResponse<OrgNodeType>> =>
    request(`/orgnodetypes/${id}`, { method: "PUT", body }),

  /** Удалить тип узла */
  delete: (id: number): Promise<void> =>
    request(`/orgnodetypes/${id}`, { method: "DELETE" }),
};

/**
 * Общие опции для справочников. Используются и в `useQuery`, и в `prefetchQuery`,
 * чтобы данные загружались один раз и переиспользовались всеми модалками.
 */
export const dictQueries = {
  cities: queryOptions({
    queryKey: ["dict", "cities"] as const,
    queryFn: () => dictApi.getCities().then((res) => res.data),
    staleTime: Infinity,
    gcTime: Infinity,
  }),
  countries: queryOptions({
    queryKey: ["dict", "countries"] as const,
    queryFn: () => dictApi.getCountries().then((res) => res.data),
    staleTime: Infinity,
    gcTime: Infinity,
  }),
  employees: queryOptions({
    queryKey: ["dict", "employees"] as const,
    queryFn: () => dictApi.getEmployees().then((res) => res.data),
    staleTime: Infinity,
    gcTime: Infinity,
  }),
  nodeTypes: queryOptions({
    queryKey: ["dict", "nodeTypes"] as const,
    queryFn: () => dictApi.getNodeTypes().then((res) => res.data),
    staleTime: Infinity,
    gcTime: Infinity,
  }),
};
