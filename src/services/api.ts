import type {
  OrgNodeResponse,
  OrgNodesResponse,
  OrgNode,
} from "#/types/api";

const BASE_URL = "http://localhost:3008";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? res.statusText), {
      code: res.status,
    });
  }

  return res.json() as Promise<T>;
}

export const orgNodesApi = {
  /** Получить всё организационное дерево */
  getTree(): Promise<OrgNodesResponse> {
    return request("/orgnodes");
  },

  /** Получить дерево относительно узла */
  getSubTree(id: number): Promise<OrgNodesResponse> {
    return request(`/orgnodes/${id}`);
  },

  /** Получить узел по ID (без дочерних) */
  getNode(id: number): Promise<OrgNodeResponse> {
    return request(`/orgnodes/node/${id}`);
  },

  /** Получить пустые вакансии отдела */
  getEmptyVacancies(id: number): Promise<OrgNode> {
    return request(`/orgnodes/${id}/vacancies/empty`);
  },

  /** Получить занятые вакансии отдела */
  getFilledVacancies(id: number): Promise<OrgNode> {
    return request(`/orgnodes/${id}/vacancies/filled`);
  },
};
