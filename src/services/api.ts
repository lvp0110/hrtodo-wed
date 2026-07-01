import { queryOptions } from "@tanstack/react-query";
import type {
  ApiResponse,
  City,
  CityReq,
  Country,
  Office,
  CountryReq,
  Employer,
  LoginRequest,
  NodeCreateReq,
  NodeUpdateReq,
  OrgNode,
  OrgNodeRow,
  OrgNodeType,
  OrgNodeTypeReq,
  OrgNodesResponse,
  UserFullInfo,
  Vacancy,
  VacancyReq,
  VacancyUpdateReq,
} from "#/types/api";

const BASE_URL = "/api";

type Method = "GET" | "POST" | "PUT" | "DELETE";

/**
 * Читает значение cookie по имени. CSRF-cookie выставлен бэком без HttpOnly,
 * поэтому доступен из JS — используется для добавления X-CSRF-Token в заголовки.
 */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];

  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }

  return null;
}

async function request<T>(
  path: string,
  init: { method?: Method; body?: unknown } = {},
): Promise<T> {
  const { method = "GET", body } = init;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // CSRF: на мутации обязателен заголовок X-CSRF-Token, совпадающий с cookie.
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    const csrf = readCookie("csrf_token");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    // Куки access_token / csrf_token приходят с бэка и должны отправляться обратно.
    credentials: "include",
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

export const authApi = {
  /** Вход: бэк ставит HttpOnly access_token и csrf_token. */
  login: (body: LoginRequest): Promise<ApiResponse<UserFullInfo>> =>
    request("/login", { method: "POST", body }),

  /** Проверка активной сессии — используется для условного рендера в __root. */
  session: (): Promise<ApiResponse<UserFullInfo>> => request("/auth/session"),

  /** Выход: бэк сбрасывает обе cookies. */
  logout: (): Promise<ApiResponse<string>> =>
    request("/auth/logout", { method: "POST" }),
};

export const authQueries = {
  session: queryOptions({
    queryKey: ["auth", "session"] as const,
    queryFn: () => authApi.session().then((res) => res.data),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: false,
  }),
};

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
   * Справочник городов — полная модель City (id, code, name, country_id),
   * что позволяет редактировать/удалять прямо из списка.
   */
  getCities: (): Promise<ApiResponse<City[]>> => request("/dict/cities"),

  /** Справочник стран */
  getCountries: (): Promise<ApiResponse<Country[]>> => request("/dict/countries"),

  /** Справочник сотрудников */
  getEmployees: (): Promise<ApiResponse<Employer[]>> => request("/dict/employees"),

  /** Справочник типов организационных узлов */
  getNodeTypes: (): Promise<ApiResponse<OrgNodeType[]>> =>
    request("/dict/orgnode/type"),
};

export const officesApi = {
  /** Получить офисы по ID города */
  getByCity: (cityId: number): Promise<ApiResponse<Office[]>> =>
    request(`/offices/city/${cityId}`),
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
 *
 * Бэк отдаёт `data: null` для пустого справочника (nil-срез в Go), поэтому
 * нормализуем в `[]` — потребители вызывают `.map` без доп. проверок.
 */
export const dictQueries = {
  cities: queryOptions({
    queryKey: ["dict", "cities"] as const,
    queryFn: () => dictApi.getCities().then((res) => res.data ?? []),
    staleTime: Infinity,
    gcTime: Infinity,
  }),
  countries: queryOptions({
    queryKey: ["dict", "countries"] as const,
    queryFn: () => dictApi.getCountries().then((res) => res.data ?? []),
    staleTime: Infinity,
    gcTime: Infinity,
  }),
  employees: queryOptions({
    queryKey: ["dict", "employees"] as const,
    queryFn: () => dictApi.getEmployees().then((res) => res.data ?? []),
    staleTime: Infinity,
    gcTime: Infinity,
  }),
  nodeTypes: queryOptions({
    queryKey: ["dict", "nodeTypes"] as const,
    queryFn: () => dictApi.getNodeTypes().then((res) => res.data ?? []),
    staleTime: Infinity,
    gcTime: Infinity,
  }),
};
