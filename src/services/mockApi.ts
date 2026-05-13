import type {
  ApiResponse,
  Employer,
  Entity,
  NodeCreateReq,
  NodeUpdateReq,
  OrgNode,
  OrgNodeRow,
  OrgNodeType,
  OrgNodesResponse,
  Vacancy,
  VacancyReq,
  VacancyUpdateReq,
} from "#/types/api";

const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_TREE: OrgNode[] = [
  {
    id: 1,
    code: "ceo",
    name: "Генеральный директор",
    type: "top",
    parent_id: null,
    children: [
      {
        id: 2,
        code: "fin",
        name: "Финансовый департамент",
        type: "department",
        parent_id: 1,
        children: [
          {
            id: 10,
            code: "accounting",
            name: "Бухгалтерия",
            type: "department",
            parent_id: 2,
            children: [],
            vacancies: [
              { id: 1001, node_id: 10, is_manager: true, city: { code: "msk", name: "Москва" }, position: { code: "acc_lead", name: "Главный бухгалтер" }, employer: { id: 101, first_name: "Анна", second_name: "Петровна", surname: "Смирнова", email: "smirnova@corp.ru" } },
              { id: 1002, node_id: 10, is_manager: false, city: { code: "msk", name: "Москва" }, position: { code: "acc_jr", name: "Бухгалтер" }, employer: { id: 102, first_name: "Елена", second_name: "Игоревна", surname: "Фёдорова", email: "fedorova@corp.ru" } },
            ],
            empty_vacancy: null,
          },
          {
            id: 11,
            code: "controlling",
            name: "Контроллинг",
            type: "department",
            parent_id: 2,
            children: [],
            vacancies: null,
            empty_vacancy: [
              { city: { code: "msk", name: "Москва" }, position: { code: "analyst", name: "Финансовый аналитик" } },
              { city: { code: "msk", name: "Москва" }, position: { code: "controller", name: "Контролёр" } },
            ],
          },
          {
            id: 12,
            code: "treasury",
            name: "Казначейство",
            type: "department",
            parent_id: 2,
            children: [],
            vacancies: [
              { id: 1003, node_id: 12, is_manager: false, city: { code: "msk", name: "Москва" }, position: { code: "treasurer", name: "Казначей" }, employer: { id: 103, first_name: "Дмитрий", second_name: "Олегович", surname: "Беляев", email: "belyaev@corp.ru" } },
            ],
            empty_vacancy: null,
          },
        ],
        vacancies: null,
        empty_vacancy: null,
      },
      {
        id: 3,
        code: "tech",
        name: "Технический департамент",
        type: "department",
        parent_id: 1,
        children: [
          {
            id: 13,
            code: "dev",
            name: "Разработка",
            type: "department",
            parent_id: 3,
            children: [
              {
                id: 20,
                code: "frontend",
                name: "Frontend",
                type: "team",
                parent_id: 13,
                children: [],
                vacancies: [
                  { id: 1010, node_id: 20, is_manager: true, city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "fe_lead", name: "Frontend Lead" }, employer: { id: 110, first_name: "Иван", second_name: "Сергеевич", surname: "Козлов", email: "kozlov@corp.ru" } },
                  { id: 1011, node_id: 20, is_manager: false, city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "fe_mid", name: "Frontend Dev" }, employer: { id: 111, first_name: "Мария", second_name: "Андреевна", surname: "Новикова", email: "novikova@corp.ru" } },
                ],
                empty_vacancy: [
                  { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "fe_jun", name: "Junior Frontend" } },
                ],
              },
              {
                id: 21,
                code: "backend",
                name: "Backend",
                type: "team",
                parent_id: 13,
                children: [],
                vacancies: [
                  { id: 1012, node_id: 21, is_manager: true, city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "be_lead", name: "Backend Lead" }, employer: { id: 112, first_name: "Алексей", second_name: "Николаевич", surname: "Громов", email: "gromov@corp.ru" } },
                ],
                empty_vacancy: [
                  { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "be_mid", name: "Backend Dev" } },
                  { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "be_jun", name: "Junior Backend" } },
                ],
              },
              {
                id: 22,
                code: "mobile",
                name: "Mobile",
                type: "team",
                parent_id: 13,
                children: [],
                vacancies: null,
                empty_vacancy: [
                  { city: { code: "msk", name: "Москва" }, position: { code: "mob_dev", name: "Mobile Dev" } },
                ],
              },
            ],
            vacancies: null,
            empty_vacancy: null,
          },
          {
            id: 14,
            code: "qa",
            name: "Тестирование",
            type: "department",
            parent_id: 3,
            children: [],
            vacancies: [
              { id: 1013, node_id: 14, is_manager: true, city: { code: "msk", name: "Москва" }, position: { code: "qa_lead", name: "QA Lead" }, employer: { id: 113, first_name: "Светлана", second_name: "Павловна", surname: "Орлова", email: "orlova@corp.ru" } },
            ],
            empty_vacancy: [
              { city: { code: "msk", name: "Москва" }, position: { code: "qa_eng", name: "QA инженер" } },
            ],
          },
          {
            id: 15,
            code: "devops",
            name: "DevOps",
            type: "department",
            parent_id: 3,
            children: [],
            vacancies: [
              { id: 1014, node_id: 15, is_manager: false, city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "devops_eng", name: "DevOps инженер" }, employer: { id: 114, first_name: "Роман", second_name: "Витальевич", surname: "Суворов", email: "suvorov@corp.ru" } },
            ],
            empty_vacancy: null,
          },
          {
            id: 16,
            code: "arch",
            name: "Архитектура",
            type: "department",
            parent_id: 3,
            children: [],
            vacancies: null,
            empty_vacancy: [
              { city: { code: "msk", name: "Москва" }, position: { code: "architect", name: "Системный архитектор" } },
            ],
          },
        ],
        vacancies: null,
        empty_vacancy: null,
      },
      {
        id: 4,
        code: "hr",
        name: "HR департамент",
        type: "department",
        parent_id: 1,
        children: [
          {
            id: 17,
            code: "recruitment",
            name: "Рекрутмент",
            type: "department",
            parent_id: 4,
            children: [],
            vacancies: [
              { id: 1015, node_id: 17, is_manager: false, city: { code: "msk", name: "Москва" }, position: { code: "recruiter", name: "Рекрутер" }, employer: { id: 115, first_name: "Ольга", second_name: "Дмитриевна", surname: "Васильева", email: "vasilieva@corp.ru" } },
              { id: 1016, node_id: 17, is_manager: false, city: { code: "msk", name: "Москва" }, position: { code: "recruiter_sr", name: "Старший рекрутер" }, employer: { id: 116, first_name: "Татьяна", second_name: "Юрьевна", surname: "Лебедева", email: "lebedeva@corp.ru" } },
            ],
            empty_vacancy: null,
          },
          {
            id: 18,
            code: "learning",
            name: "Обучение и развитие",
            type: "department",
            parent_id: 4,
            children: [],
            vacancies: null,
            empty_vacancy: [
              { city: { code: "msk", name: "Москва" }, position: { code: "trainer", name: "Тренер" } },
            ],
          },
        ],
        vacancies: null,
        empty_vacancy: null,
      },
      {
        id: 5,
        code: "legal",
        name: "Юридический департамент",
        type: "department",
        parent_id: 1,
        children: [
          {
            id: 19,
            code: "compliance",
            name: "Комплаенс",
            type: "department",
            parent_id: 5,
            children: [],
            vacancies: [
              { id: 1017, node_id: 19, is_manager: false, city: { code: "msk", name: "Москва" }, position: { code: "compliance_off", name: "Офицер комплаенса" }, employer: { id: 117, first_name: "Андрей", second_name: "Борисович", surname: "Кузнецов", email: "kuznetsov@corp.ru" } },
            ],
            empty_vacancy: null,
          },
        ],
        vacancies: [
          { id: 1018, node_id: 5, is_manager: true, city: { code: "msk", name: "Москва" }, position: { code: "lawyer_lead", name: "Главный юрист" }, employer: { id: 118, first_name: "Наталья", second_name: "Геннадьевна", surname: "Морозова", email: "morozova@corp.ru" } },
        ],
        empty_vacancy: [
          { city: { code: "msk", name: "Москва" }, position: { code: "lawyer", name: "Юрист" } },
        ],
      },
      {
        id: 6,
        code: "sales",
        name: "Коммерческий департамент",
        type: "department",
        parent_id: 1,
        children: [
          {
            id: 23,
            code: "sales_team",
            name: "Продажи",
            type: "department",
            parent_id: 6,
            children: [],
            vacancies: [
              { id: 1019, node_id: 23, is_manager: false, city: { code: "msk", name: "Москва" }, position: { code: "sales_mgr", name: "Менеджер по продажам" }, employer: { id: 119, first_name: "Виктор", second_name: "Александрович", surname: "Соколов", email: "sokolov@corp.ru" } },
              { id: 1020, node_id: 23, is_manager: false, city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "sales_mgr", name: "Менеджер по продажам" }, employer: { id: 120, first_name: "Юлия", second_name: "Ивановна", surname: "Попова", email: "popova@corp.ru" } },
            ],
            empty_vacancy: [
              { city: { code: "kzn", name: "Казань" }, position: { code: "sales_mgr", name: "Менеджер по продажам" } },
            ],
          },
          {
            id: 24,
            code: "marketing",
            name: "Маркетинг",
            type: "department",
            parent_id: 6,
            children: [],
            vacancies: [
              { id: 1021, node_id: 24, is_manager: true, city: { code: "msk", name: "Москва" }, position: { code: "marketing_lead", name: "Руководитель маркетинга" }, employer: { id: 121, first_name: "Екатерина", second_name: "Михайловна", surname: "Захарова", email: "zaharova@corp.ru" } },
            ],
            empty_vacancy: [
              { city: { code: "msk", name: "Москва" }, position: { code: "smm", name: "SMM специалист" } },
              { city: { code: "msk", name: "Москва" }, position: { code: "designer", name: "Дизайнер" } },
            ],
          },
        ],
        vacancies: null,
        empty_vacancy: null,
      },
    ],
    vacancies: null,
    empty_vacancy: null,
  },
];

function findNode(nodes: OrgNode[] | null, id: number): OrgNode | undefined {
  if (!nodes) return undefined;
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
}

function notFound() {
  return Promise.reject(Object.assign(new Error("Not found"), { code: 404 }));
}

// ---------------------------------------------------------------------------
// Mock API — same shape as services/api.ts (orgNodesApi + vacanciesApi)
// ---------------------------------------------------------------------------

export const orgNodesApi = {
  async getTree(): Promise<OrgNodesResponse> {
    await delay();
    return { code: 200, data: MOCK_TREE };
  },

  async getTreeVacancies(): Promise<OrgNodesResponse> {
    await delay();
    return { code: 200, data: MOCK_TREE };
  },

  async getSubTree(id: number): Promise<OrgNodesResponse> {
    await delay();
    const node = findNode(MOCK_TREE, id);
    if (!node) return notFound();
    return { code: 200, data: [node] };
  },

  async getNode(id: number): Promise<ApiResponse<OrgNodeRow>> {
    await delay();
    const node = findNode(MOCK_TREE, id);
    if (!node) return notFound();
    return {
      code: 200,
      data: {
        id: node.id,
        parent_id: node.parent_id,
        code: node.code,
        name: node.name,
        type_code: node.type,
      },
    };
  },

  async createNode(_body: NodeCreateReq): Promise<ApiResponse<null>> {
    await delay();
    return { code: 201, data: null };
  },

  async updateNode(_id: number, _body: NodeUpdateReq): Promise<ApiResponse<null>> {
    await delay();
    return { code: 200, data: null };
  },

  async deleteNode(_id: number): Promise<void> {
    await delay();
  },
};

export const vacanciesApi = {
  async get(id: number): Promise<ApiResponse<Vacancy>> {
    await delay();
    for (const root of MOCK_TREE) {
      const found = findVacancy(root, id);
      if (found) return { code: 200, data: found };
    }
    return notFound();
  },

  async create(_body: VacancyReq): Promise<ApiResponse<null>> {
    await delay();
    return { code: 201, data: null };
  },

  async update(_id: number, _body: VacancyUpdateReq): Promise<ApiResponse<null>> {
    await delay();
    return { code: 200, data: null };
  },

  async delete(_id: number): Promise<void> {
    await delay();
  },

  async getEmpty(nodeId: number): Promise<ApiResponse<OrgNode>> {
    await delay();
    const node = findNode(MOCK_TREE, nodeId);
    if (!node) return notFound();
    return { code: 200, data: { ...node, vacancies: null } };
  },

  async getFilled(nodeId: number): Promise<ApiResponse<OrgNode>> {
    await delay();
    const node = findNode(MOCK_TREE, nodeId);
    if (!node) return notFound();
    return { code: 200, data: { ...node, empty_vacancy: null } };
  },
};

const MOCK_CITIES: Entity[] = [
  { code: "msk", name: "Москва" },
  { code: "spb", name: "Санкт-Петербург" },
  { code: "kzn", name: "Казань" },
  { code: "nsk", name: "Новосибирск" },
  { code: "ekb", name: "Екатеринбург" },
];

const MOCK_EMPLOYEES: Employer[] = [
  { id: 101, first_name: "Анна", second_name: "Петровна", surname: "Смирнова", email: "smirnova@corp.ru" },
  { id: 102, first_name: "Елена", second_name: "Игоревна", surname: "Фёдорова", email: "fedorova@corp.ru" },
  { id: 103, first_name: "Дмитрий", second_name: "Олегович", surname: "Беляев", email: "belyaev@corp.ru" },
  { id: 110, first_name: "Иван", second_name: "Сергеевич", surname: "Козлов", email: "kozlov@corp.ru" },
  { id: 111, first_name: "Мария", second_name: "Андреевна", surname: "Новикова", email: "novikova@corp.ru" },
  { id: 112, first_name: "Алексей", second_name: "Николаевич", surname: "Громов", email: "gromov@corp.ru" },
  { id: 113, first_name: "Светлана", second_name: "Павловна", surname: "Орлова", email: "orlova@corp.ru" },
  { id: 114, first_name: "Роман", second_name: "Витальевич", surname: "Суворов", email: "suvorov@corp.ru" },
  { id: 115, first_name: "Ольга", second_name: "Дмитриевна", surname: "Васильева", email: "vasilieva@corp.ru" },
  { id: 116, first_name: "Татьяна", second_name: "Юрьевна", surname: "Лебедева", email: "lebedeva@corp.ru" },
  { id: 117, first_name: "Андрей", second_name: "Борисович", surname: "Кузнецов", email: "kuznetsov@corp.ru" },
  { id: 118, first_name: "Наталья", second_name: "Геннадьевна", surname: "Морозова", email: "morozova@corp.ru" },
  { id: 119, first_name: "Виктор", second_name: "Александрович", surname: "Соколов", email: "sokolov@corp.ru" },
  { id: 120, first_name: "Юлия", second_name: "Ивановна", surname: "Попова", email: "popova@corp.ru" },
  { id: 121, first_name: "Екатерина", second_name: "Михайловна", surname: "Захарова", email: "zaharova@corp.ru" },
];

const MOCK_NODE_TYPES: OrgNodeType[] = [
  { id: 1, code: "top", name: "Руководство" },
  { id: 2, code: "department", name: "Департамент" },
  { id: 3, code: "team", name: "Команда" },
  { id: 4, code: "section", name: "Участок" },
];

export const dictApi = {
  async getCities(): Promise<ApiResponse<Entity[]>> {
    await delay();
    return { code: 200, data: MOCK_CITIES };
  },

  async getEmployees(): Promise<ApiResponse<Employer[]>> {
    await delay();
    return { code: 200, data: MOCK_EMPLOYEES };
  },

  async getNodeTypes(): Promise<ApiResponse<OrgNodeType[]>> {
    await delay();
    return { code: 200, data: MOCK_NODE_TYPES };
  },
};

function findVacancy(node: OrgNode, id: number): Vacancy | undefined {
  if (node.vacancies) {
    for (const v of node.vacancies) if (v.id === id) return v;
  }
  if (node.children) {
    for (const c of node.children) {
      const found = findVacancy(c, id);
      if (found) return found;
    }
  }
}
