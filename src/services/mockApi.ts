import type {
  ApiResponse,
  City,
  Employer,
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

const e = { id: 0, first_name: "", second_name: "", surname: "", email: "" };
const v = (
  id: number,
  node_id: number,
  name: string,
  cityCode: string,
  cityName: string,
  is_manager = false,
): Vacancy => ({
  id,
  node_id,
  position: { code: name, name },
  city: { code: cityCode, name: cityName },
  employer: e,
  is_manager,
  position_description: "",
  job_offer_link: "",
});

const MOCK_TREE: OrgNode[] = [
  {
    id: 1,
    code: "akustik_group",
    name: "Акустик Групп",
    type: "company",
    parent_id: null,
    vacancies: [],
    empty_vacancy: [],
    children: [
      {
        id: 2,
        code: "business_development",
        name: "Business Development",
        type: "knot",
        parent_id: 1,
        vacancies: [v(1, 2, "Генеральный директор", "moscow", "Москва", true)],
        empty_vacancy: [],
        children: [
          {
            id: 3,
            code: "directorate_for_development",
            name: "Дирекция по развитию",
            type: "department",
            parent_id: 2,
            vacancies: [
              v(2, 3, "Директор по развитию бизнеса", "moscow", "Москва", true),
              v(7, 3, "Менеджер по развити, Екат", "ekaterinburg", "Екатеринбург"),
              v(4, 3, "Менеджер по развитию", "moscow", "Москва"),
              v(3, 3, "Менеджер по развитию сегментов", "moscow", "Москва"),
              v(5, 3, "Руководитель направления по работе с архитекторами", "moscow", "Москва"),
              v(6, 3, "Торговый представитель", "moscow", "Москва"),
              v(8, 3, "Менеджер по развитию, Питер", "st_petersburg", "Санкт-Петербург"),
            ],
            empty_vacancy: [],
            children: [
              {
                id: 4,
                code: "online_store",
                name: "Интернет-магазин",
                type: "site",
                parent_id: 3,
                children: [],
                empty_vacancy: [],
                vacancies: [
                  v(9, 4, "Директор по развитию", "moscow", "Москва", true),
                  v(12, 4, "Frontend разработчик", "moscow", "Москва"),
                  v(10, 4, "Менеджер по развитию интернет-проектов", "moscow", "Москва"),
                  v(11, 4, "Программист Bitrix", "moscow", "Москва"),
                ],
              },
            ],
          },
          {
            id: 5,
            code: "department_digitalization",
            name: "Отдел цифровизации и разработки приложений",
            type: "department",
            parent_id: 2,
            vacancies: [
              v(13, 5, "Заместитель технического директора", "moscow", "Москва", true),
              v(14, 5, "Директор по разработке ПО", "moscow", "Москва"),
              v(16, 5, "Инженер-конструктор, ИИ", "moscow", "Москва"),
              v(15, 5, "Промпт-инженер по созданию визуального контента", "moscow", "Москва"),
            ],
            empty_vacancy: [],
            children: [
              {
                id: 6,
                code: "bim_technologies",
                name: "BIM 3D технологии",
                type: "site",
                parent_id: 5,
                vacancies: [
                  v(17, 6, "Директор по разработке ПО", "moscow", "Москва", true),
                  v(18, 6, "Помощник BIM-менеджера", "moscow", "Москва"),
                ],
                empty_vacancy: [],
                children: [
                  {
                    id: 7,
                    code: "go_build",
                    name: "Go Build",
                    type: "site",
                    parent_id: 6,
                    children: [],
                    empty_vacancy: [],
                    vacancies: [
                      v(19, 7, "проектник 1", "moscow", "Москва"),
                      v(20, 7, "проектник 2", "moscow", "Москва"),
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 8,
            code: "decotec_development_marketing",
            name: "Развитие и маркетинг Декотек",
            type: "department",
            parent_id: 2,
            children: [],
            empty_vacancy: [],
            vacancies: [v(21, 8, "Операционный директор Декотек", "moscow", "Москва")],
          },
          {
            id: 9,
            code: "marketing_directorate_ag",
            name: "Дирекция по маркетингу АГ",
            type: "department",
            parent_id: 2,
            children: [],
            empty_vacancy: [],
            vacancies: [
              v(22, 9, "Директор по маркетингу", "moscow", "Москва", true),
              v(23, 9, "лод", "almaty", "Алматы"),
              v(30, 9, "Менеджер по работе с рекламными материалами", "moscow", "Москва"),
              v(27, 9, "Продакт-менеджер", "moscow", "Москва"),
              v(24, 9, "Руководитель отдела Product Management", "moscow", "Москва"),
              v(32, 9, "Специалист отдела маркетинга", "moscow", "Москва"),
            ],
          },
        ],
      },
      {
        id: 10,
        code: "management_company",
        name: "Управляющая компания",
        type: "knot",
        parent_id: 1,
        vacancies: [v(96, 10, "Генеральный директор", "moscow", "Москва", true)],
        empty_vacancy: [],
        children: [
          {
            id: 11,
            code: "finance_department",
            name: "Финансовый департамент",
            type: "department",
            parent_id: 10,
            children: [],
            empty_vacancy: [],
            vacancies: [
              v(57, 11, "Финансовый директор, заместитель генерального директора", "moscow", "Москва", true),
              v(59, 11, "Ведущий экономист", "moscow", "Москва"),
              v(58, 11, "Заместитель Финансового директора", "moscow", "Москва"),
            ],
          },
          {
            id: 24,
            code: "personnel",
            name: "Отдел Персонала",
            type: "department",
            parent_id: 10,
            children: [],
            empty_vacancy: [],
            vacancies: [
              v(115, 24, "Руководитель службы персонала", "moscow", "Москва", true),
              v(120, 24, "Менеджер по подбору персонала", "moscow", "Москва"),
              v(118, 24, "Специалист по кадровому делопроизводству", "moscow", "Москва"),
            ],
          },
          {
            id: 25,
            code: "legal",
            name: "Юридический отдел",
            type: "department",
            parent_id: 10,
            children: [],
            empty_vacancy: [],
            vacancies: [
              v(121, 25, "Руководитель юридического отдела", "moscow", "Москва", true),
              v(125, 25, "Юрист", "moscow", "Москва"),
            ],
          },
          {
            id: 26,
            code: "it_information_security",
            name: "IT и инф.безопасность",
            type: "department",
            parent_id: 10,
            children: [],
            empty_vacancy: [],
            vacancies: [
              v(126, 26, "Руководитель службы ИТ", "moscow", "Москва", true),
              v(128, 26, "Старший системный администратор", "moscow", "Москва"),
            ],
          },
        ],
      },
      {
        id: 36,
        code: "tex_deportament",
        name: "Технический департамент",
        type: "knot",
        parent_id: 1,
        vacancies: [
          v(410, 36, "Технический Директор", "moscow", "Москва", true),
          v(411, 36, "Зам. Технического директора", "moscow", "Москва"),
          v(412, 36, "Коммерческий директор", "moscow", "Москва"),
        ],
        empty_vacancy: [],
        children: [
          {
            id: 84,
            code: "teh_decotek",
            name: "Тех.отдел Декотек",
            type: "department",
            parent_id: 36,
            children: [],
            empty_vacancy: [],
            vacancies: [
              v(426, 84, "Технический директор Декотек", "moscow", "Москва", true),
              v(427, 84, "Инженер по поддержке проектов", "moscow", "Москва"),
            ],
          },
        ],
      },
      {
        id: 48,
        code: "commercial_department",
        name: "Коммерческий Департамент",
        type: "knot",
        parent_id: 1,
        vacancies: [v(162, 48, "Генеральный директор", "moscow", "Москва", true)],
        empty_vacancy: [],
        children: [
          {
            id: 50,
            code: "decotek",
            name: "Декотек",
            type: "department",
            parent_id: 48,
            children: [],
            empty_vacancy: [],
            vacancies: [
              v(219, 50, "Директор по продажам и маркетингу", "moscow", "Москва", true),
              v(230, 50, "Менеджер по продажам", "moscow", "Москва"),
            ],
          },
          {
            id: 51,
            code: "td_soundblock",
            name: "ТД Саундблок",
            type: "department",
            parent_id: 48,
            children: [],
            empty_vacancy: [],
            vacancies: [
              v(240, 51, "Коммерческий директор ООО ‘Саундблок’", "moscow", "Москва", true),
              v(243, 51, "Менеджер проектных продаж", "moscow", "Москва"),
            ],
          },
        ],
      },
      {
        id: 59,
        code: "production",
        name: "Производство",
        type: "knot",
        parent_id: 1,
        vacancies: [v(245, 59, "Директор по производству", "moscow", "Москва", true)],
        empty_vacancy: [],
        children: [
          {
            id: 60,
            code: "psk_dmd",
            name: "ПCК ДМД",
            type: "department",
            parent_id: 59,
            children: [],
            empty_vacancy: [],
            vacancies: [
              v(246, 60, "Начальник производства", "moscow", "Москва", true),
              v(248, 60, "Начальник цеха", "moscow", "Москва"),
            ],
          },
          {
            id: 70,
            code: "warehouse_complex",
            name: "Складской комплекс",
            type: "department",
            parent_id: 59,
            vacancies: [v(368, 70, "Руководитель", "moscow", "Москва", true)],
            empty_vacancy: [],
            children: [
              {
                id: 71,
                code: "acceptance_placement_tmc",
                name: "Участок приемки и размещения ТМЦ",
                type: "site",
                parent_id: 70,
                children: [],
                empty_vacancy: [],
                vacancies: [
                  v(369, 71, "Руководитель", "moscow", "Москва", true),
                  v(370, 71, "Кладовщик", "moscow", "Москва"),
                ],
              },
            ],
          },
        ],
      },
    ],
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

/** Массив-владелец, в котором лежит узел: `children` родителя либо корень. */
function findOwnerList(id: number): OrgNode[] | undefined {
  if (MOCK_TREE.some((n) => n.id === id)) return MOCK_TREE;
  const stack: OrgNode[] = [...MOCK_TREE];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.children?.some((c) => c.id === id)) return n.children;
    if (n.children) stack.push(...n.children);
  }
  return undefined;
}

/** Является ли `maybeId` потомком `ancestorId` (для запрета переноса в свою ветку). */
function isDescendant(ancestorId: number, maybeId: number): boolean {
  const ancestor = findNode(MOCK_TREE, ancestorId);
  const stack: OrgNode[] = [...(ancestor?.children ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === maybeId) return true;
    if (n.children) stack.push(...n.children);
  }
  return false;
}

function detach(id: number): OrgNode | undefined {
  const owner = findOwnerList(id);
  if (!owner) return undefined;
  const i = owner.findIndex((n) => n.id === id);
  return i >= 0 ? owner.splice(i, 1)[0] : undefined;
}

function notFound() {
  return Promise.reject(Object.assign(new Error("Not found"), { code: 404 }));
}

function fail(message: string, code = 400) {
  return Promise.reject(Object.assign(new Error(message), { code }));
}

// ---------------------------------------------------------------------------
// Mock API — same shape as services/api.ts (orgNodesApi + vacanciesApi)
// ---------------------------------------------------------------------------

export const orgNodesApi = {
  // Чтения отдают свежий клон: мутации меняют MOCK_TREE по месту, и без нового
  // объекта React Query (структурное сравнение) не увидел бы изменений.
  async getTree(): Promise<OrgNodesResponse> {
    await delay();
    return { code: 200, data: structuredClone(MOCK_TREE) };
  },

  async getTreeVacancies(): Promise<OrgNodesResponse> {
    await delay();
    return { code: 200, data: structuredClone(MOCK_TREE) };
  },

  async getSubTree(id: number): Promise<OrgNodesResponse> {
    await delay();
    const node = findNode(MOCK_TREE, id);
    if (!node) return notFound();
    return { code: 200, data: [structuredClone(node)] };
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

  async deleteNode(id: number): Promise<void> {
    await delay();
    detach(id); // удаляет узел вместе с поддеревом
  },

  /** Перенос узла: меняем родителя (на бэке — PUT /node/:id с новым parent_id). */
  async moveNode(id: number, newParentId: number | null): Promise<ApiResponse<null>> {
    await delay();
    if (id === newParentId) return fail("Узел нельзя перенести в самого себя");
    const node = findNode(MOCK_TREE, id);
    if (!node) return notFound();
    if (newParentId !== null) {
      if (!findNode(MOCK_TREE, newParentId)) return notFound();
      if (isDescendant(id, newParentId)) {
        return fail("Нельзя перенести узел в собственного потомка");
      }
    }
    detach(id);
    node.parent_id = newParentId;
    if (newParentId === null) {
      MOCK_TREE.push(node);
    } else {
      const parent = findNode(MOCK_TREE, newParentId)!;
      (parent.children ??= []).push(node);
    }
    return { code: 200, data: null };
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

  async create(body: VacancyReq): Promise<ApiResponse<Vacancy>> {
    await delay();
    return {
      code: 201,
      data: {
        id: Math.floor(Math.random() * 10_000) + 9000,
        node_id: body.node_id,
        position: { code: body.position_code, name: body.position_name },
        city: { code: body.city_code, name: body.city_code },
        employer: { id: 0, first_name: "", second_name: "", surname: "", email: "" },
        is_manager: body.is_manager,
        position_description: body.position_description,
        job_offer_link: body.job_offer_link,
      },
    };
  },

  async update(id: number, body: VacancyUpdateReq): Promise<ApiResponse<Vacancy>> {
    await delay();
    return {
      code: 200,
      data: {
        id,
        node_id: body.node_id,
        position: { code: body.position_code, name: body.position_name },
        city: { code: body.city_code, name: body.city_code },
        employer: { id: body.user_id ?? 0, first_name: "", second_name: "", surname: "", email: "" },
        is_manager: body.is_manager,
        position_description: body.position_description,
        job_offer_link: body.job_offer_link,
      },
    };
  },

  async delete(id: number): Promise<void> {
    await delay();
    const stack: OrgNode[] = [...MOCK_TREE];
    while (stack.length) {
      const n = stack.pop()!;
      const i = n.vacancies?.findIndex((vac) => vac.id === id) ?? -1;
      if (i >= 0) {
        n.vacancies.splice(i, 1);
        return;
      }
      if (n.children) stack.push(...n.children);
    }
  },

  async getEmpty(nodeId: number): Promise<ApiResponse<OrgNode>> {
    await delay();
    const node = findNode(MOCK_TREE, nodeId);
    if (!node) return notFound();
    return { code: 200, data: { ...node, vacancies: [] } };
  },

  async getFilled(nodeId: number): Promise<ApiResponse<OrgNode>> {
    await delay();
    const node = findNode(MOCK_TREE, nodeId);
    if (!node) return notFound();
    return { code: 200, data: { ...node, empty_vacancy: [] } };
  },
};

const MOCK_CITIES: City[] = [
  { id: 1, code: "msk", name: "Москва", country_id: 1 },
  { id: 2, code: "spb", name: "Санкт-Петербург", country_id: 1 },
  { id: 3, code: "kzn", name: "Казань", country_id: 1 },
  { id: 4, code: "nsk", name: "Новосибирск", country_id: 1 },
  { id: 5, code: "ekb", name: "Екатеринбург", country_id: 1 },
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
  async getCities(): Promise<ApiResponse<City[]>> {
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
