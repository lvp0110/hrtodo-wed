import { queryOptions } from "@tanstack/react-query";
import {
  clearAuthExpiry,
  expireClientSession,
  refreshSession,
  rememberAuthExpiry,
} from "#/services/authRefresh";
import type {
  ApiResponse,
  City,
  CityReq,
  Country,
  Office,
  CountryReq,
  EmployeeCreateReq,
  EmployeeReportItem,
  EmployeeUpdateReq,
  Employer,
  ExportRequest,
  AuthSession,
  LoginRequest,
  NodeCreateReq,
  NodeUpdateReq,
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

/** Login и сам refresh не должны запускать повторный refresh. */
const SKIP_REFRESH = new Set(["/auth/login", "/auth/refresh", "/login"]);

type FetchInit = {
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
  retried?: boolean;
};

async function errorFromResponse(res: Response): Promise<Error> {
  const err = await res.json().catch(() => ({ error: res.statusText }));
  return Object.assign(new Error(err.error ?? res.statusText), {
    code: res.status,
  });
}

async function fetchApi(path: string, init: FetchInit = {}): Promise<Response> {
  const { method = "GET", body, headers: extraHeaders, retried = false } = init;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extraHeaders,
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
    // access_token / refresh_token / csrf_token приходят с бэка и уходят обратно.
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Первый 401 — refresh и один повтор. Второй 401 или провал refresh — выход.
  if (res.status === 401 && !retried && !SKIP_REFRESH.has(path)) {
    await refreshSession({ force: true });
    return fetchApi(path, { ...init, retried: true });
  }

  if (res.status === 401 && retried && !SKIP_REFRESH.has(path)) {
    expireClientSession();
  }

  return res;
}

async function request<T>(path: string, init: FetchInit = {}): Promise<T> {
  const res = await fetchApi(path, init);

  if (!res.ok) throw await errorFromResponse(res);

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const authApi = {
  /** Вход: бэк ставит HttpOnly access/refresh cookies и csrf_token. */
  login: async (body: LoginRequest): Promise<ApiResponse<AuthSession>> => {
    const res = await request<ApiResponse<AuthSession>>("/auth/login", {
      method: "POST",
      body,
    });
    rememberAuthExpiry(res.data.expires_at, res.data.refresh_expires_at);
    return res;
  },

  /**
   * Проверка активной сессии — используется для условного рендера в __root.
   * 401 на протухшем access token сначала обновляет сессию через /auth/refresh.
   * 404 оставлен для старого бэка без auth-cookie.
   */
  session: async (): Promise<UserFullInfo | null> => {
    try {
      const res = await fetchApi("/auth/session");

      if (res.status === 401 || res.status === 404) return null;

      if (!res.ok) throw await errorFromResponse(res);

      const body = (await res.json()) as ApiResponse<UserFullInfo>;
      return body.data;
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code === 401 || code === 403) return null;
      throw error;
    }
  },

  /** Выход: бэк отзывает сессию и сбрасывает access, refresh и csrf cookies. */
  logout: async (): Promise<ApiResponse<string>> => {
    const res = await request<ApiResponse<string>>("/auth/logout", {
      method: "POST",
    });
    clearAuthExpiry();
    return res;
  },
};

export const authQueries = {
  session: queryOptions({
    queryKey: ["auth", "session"] as const,
    queryFn: () => authApi.session(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: false,
  }),
};

export const orgNodesApi = {
  /** Получить дерево с вакансиями */
  getTreeVacancies: (): Promise<OrgNodesResponse> =>
    request("/orgnodes/tree/vacancies"),

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
  /** Создать вакансию */
  create: (body: VacancyReq): Promise<ApiResponse<Vacancy>> =>
    request("/vacancies", { method: "POST", body }),

  /** Обновить вакансию */
  update: (id: number, body: VacancyUpdateReq): Promise<ApiResponse<Vacancy>> =>
    request(`/vacancies/${id}`, { method: "PUT", body }),

  /** Удалить вакансию */
  delete: (id: number): Promise<void> =>
    request(`/vacancies/${id}`, { method: "DELETE" }),
};

export const employeesApi = {
  /** Список сотрудников с должностями — GET /employees/report */
  getReport: (): Promise<ApiResponse<EmployeeReportItem[]>> =>
    request("/employees/report"),

  /** Создать сотрудника — POST /employees */
  create: (body: EmployeeCreateReq): Promise<ApiResponse<Employer>> =>
    request("/employees", { method: "POST", body }),

  /** Обновить сотрудника — PUT /employees/{id} */
  update: (id: number, body: EmployeeUpdateReq): Promise<ApiResponse<Employer>> =>
    request(`/employees/${id}`, { method: "PUT", body }),

  /** Удалить сотрудника — DELETE /employees/{id} */
  delete: (id: number): Promise<void> =>
    request(`/employees/${id}`, { method: "DELETE" }),
};

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* ignore */
    }
  }
  const plain = header.match(/filename\s*=\s*("?)([^";]+)\1/i);
  return plain?.[2]?.trim() || null;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const exportApi = {
  /** Выгрузка сотрудников в Excel — POST /export/excel */
  excel: async (body: ExportRequest = {}): Promise<void> => {
    const res = await fetchApi("/export/excel", {
      method: "POST",
      body,
      headers: {
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

    if (!res.ok) throw await errorFromResponse(res);

    const blob = await res.blob();
    const filename =
      filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
      `сотрудники-${new Date().toISOString().slice(0, 10)}.xlsx`;
    downloadBlob(blob, filename);
  },
};

export const employeeQueries = {
  report: queryOptions({
    queryKey: ["employees", "report"] as const,
    queryFn: () => employeesApi.getReport().then((res) => res.data ?? []),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  }),
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
  /** Получить офисы по ID города — GET /offices/city/{cityId} */
  getByCity: (cityId: number): Promise<ApiResponse<Office[]>> =>
    request(`/offices/city/${cityId}`),
};

export const citiesApi = {
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
