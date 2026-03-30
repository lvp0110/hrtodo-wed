import type {
  OrgNodeResponse,
  OrgNodesResponse,
  OrgNode,
} from "#/types/api";

const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_TREE: OrgNode[] = [
  {
    ID: 1,
    Code: "ceo",
    Name: "Генеральный директор",
    Type: "top",
    Children: [
      {
        ID: 2,
        Code: "fin",
        Name: "Финансовый департамент",
        Type: "department",
        Children: [
          {
            ID: 10,
            Code: "accounting",
            Name: "Бухгалтерия",
            Type: "department",
            Children: [],
            Vacancies: [
              { city: { code: "msk", name: "Москва" }, position: { code: "acc_lead", name: "Главный бухгалтер" }, employer: { id: 101, firstName: "Анна", secondName: "Петровна", surname: "Смирнова", email: "smirnova@corp.ru" } },
              { city: { code: "msk", name: "Москва" }, position: { code: "acc_jr", name: "Бухгалтер" }, employer: { id: 102, firstName: "Елена", secondName: "Игоревна", surname: "Фёдорова", email: "fedorova@corp.ru" } },
            ],
            EmptyVacancy: null,
          },
          {
            ID: 11,
            Code: "controlling",
            Name: "Контроллинг",
            Type: "department",
            Children: [],
            Vacancies: null,
            EmptyVacancy: [
              { city: { code: "msk", name: "Москва" }, position: { code: "analyst", name: "Финансовый аналитик" } },
              { city: { code: "msk", name: "Москва" }, position: { code: "controller", name: "Контролёр" } },
            ],
          },
          {
            ID: 12,
            Code: "treasury",
            Name: "Казначейство",
            Type: "department",
            Children: [],
            Vacancies: [
              { city: { code: "msk", name: "Москва" }, position: { code: "treasurer", name: "Казначей" }, employer: { id: 103, firstName: "Дмитрий", secondName: "Олегович", surname: "Беляев", email: "belyaev@corp.ru" } },
            ],
            EmptyVacancy: null,
          },
        ],
        Vacancies: null,
        EmptyVacancy: null,
      },
      {
        ID: 3,
        Code: "tech",
        Name: "Технический департамент",
        Type: "department",
        Children: [
          {
            ID: 13,
            Code: "dev",
            Name: "Разработка",
            Type: "department",
            Children: [
              {
                ID: 20,
                Code: "frontend",
                Name: "Frontend",
                Type: "team",
                Children: [],
                Vacancies: [
                  { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "fe_lead", name: "Frontend Lead" }, employer: { id: 110, firstName: "Иван", secondName: "Сергеевич", surname: "Козлов", email: "kozlov@corp.ru" } },
                  { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "fe_mid", name: "Frontend Dev" }, employer: { id: 111, firstName: "Мария", secondName: "Андреевна", surname: "Новикова", email: "novikova@corp.ru" } },
                ],
                EmptyVacancy: [
                  { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "fe_jun", name: "Junior Frontend" } },
                ],
              },
              {
                ID: 21,
                Code: "backend",
                Name: "Backend",
                Type: "team",
                Children: [],
                Vacancies: [
                  { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "be_lead", name: "Backend Lead" }, employer: { id: 112, firstName: "Алексей", secondName: "Николаевич", surname: "Громов", email: "gromov@corp.ru" } },
                ],
                EmptyVacancy: [
                  { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "be_mid", name: "Backend Dev" } },
                  { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "be_jun", name: "Junior Backend" } },
                ],
              },
              {
                ID: 22,
                Code: "mobile",
                Name: "Mobile",
                Type: "team",
                Children: [],
                Vacancies: null,
                EmptyVacancy: [
                  { city: { code: "msk", name: "Москва" }, position: { code: "mob_dev", name: "Mobile Dev" } },
                ],
              },
            ],
            Vacancies: null,
            EmptyVacancy: null,
          },
          {
            ID: 14,
            Code: "qa",
            Name: "Тестирование",
            Type: "department",
            Children: [],
            Vacancies: [
              { city: { code: "msk", name: "Москва" }, position: { code: "qa_lead", name: "QA Lead" }, employer: { id: 113, firstName: "Светлана", secondName: "Павловна", surname: "Орлова", email: "orlova@corp.ru" } },
            ],
            EmptyVacancy: [
              { city: { code: "msk", name: "Москва" }, position: { code: "qa_eng", name: "QA инженер" } },
            ],
          },
          {
            ID: 15,
            Code: "devops",
            Name: "DevOps",
            Type: "department",
            Children: [],
            Vacancies: [
              { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "devops_eng", name: "DevOps инженер" }, employer: { id: 114, firstName: "Роман", secondName: "Витальевич", surname: "Суворов", email: "suvorov@corp.ru" } },
            ],
            EmptyVacancy: null,
          },
          {
            ID: 16,
            Code: "arch",
            Name: "Архитектура",
            Type: "department",
            Children: [],
            Vacancies: null,
            EmptyVacancy: [
              { city: { code: "msk", name: "Москва" }, position: { code: "architect", name: "Системный архитектор" } },
            ],
          },
        ],
        Vacancies: null,
        EmptyVacancy: null,
      },
      {
        ID: 4,
        Code: "hr",
        Name: "HR департамент",
        Type: "department",
        Children: [
          {
            ID: 17,
            Code: "recruitment",
            Name: "Рекрутмент",
            Type: "department",
            Children: [],
            Vacancies: [
              { city: { code: "msk", name: "Москва" }, position: { code: "recruiter", name: "Рекрутер" }, employer: { id: 115, firstName: "Ольга", secondName: "Дмитриевна", surname: "Васильева", email: "vasilieva@corp.ru" } },
              { city: { code: "msk", name: "Москва" }, position: { code: "recruiter_sr", name: "Старший рекрутер" }, employer: { id: 116, firstName: "Татьяна", secondName: "Юрьевна", surname: "Лебедева", email: "lebedeva@corp.ru" } },
            ],
            EmptyVacancy: null,
          },
          {
            ID: 18,
            Code: "learning",
            Name: "Обучение и развитие",
            Type: "department",
            Children: [],
            Vacancies: null,
            EmptyVacancy: [
              { city: { code: "msk", name: "Москва" }, position: { code: "trainer", name: "Тренер" } },
            ],
          },
        ],
        Vacancies: null,
        EmptyVacancy: null,
      },
      {
        ID: 5,
        Code: "legal",
        Name: "Юридический департамент",
        Type: "department",
        Children: [
          {
            ID: 19,
            Code: "compliance",
            Name: "Комплаенс",
            Type: "department",
            Children: [],
            Vacancies: [
              { city: { code: "msk", name: "Москва" }, position: { code: "compliance_off", name: "Офицер комплаенса" }, employer: { id: 117, firstName: "Андрей", secondName: "Борисович", surname: "Кузнецов", email: "kuznetsov@corp.ru" } },
            ],
            EmptyVacancy: null,
          },
        ],
        Vacancies: [
          { city: { code: "msk", name: "Москва" }, position: { code: "lawyer_lead", name: "Главный юрист" }, employer: { id: 118, firstName: "Наталья", secondName: "Геннадьевна", surname: "Морозова", email: "morozova@corp.ru" } },
        ],
        EmptyVacancy: [
          { city: { code: "msk", name: "Москва" }, position: { code: "lawyer", name: "Юрист" } },
        ],
      },
      {
        ID: 6,
        Code: "sales",
        Name: "Коммерческий департамент",
        Type: "department",
        Children: [
          {
            ID: 23,
            Code: "sales_team",
            Name: "Продажи",
            Type: "department",
            Children: [],
            Vacancies: [
              { city: { code: "msk", name: "Москва" }, position: { code: "sales_mgr", name: "Менеджер по продажам" }, employer: { id: 119, firstName: "Виктор", secondName: "Александрович", surname: "Соколов", email: "sokolov@corp.ru" } },
              { city: { code: "spb", name: "Санкт-Петербург" }, position: { code: "sales_mgr", name: "Менеджер по продажам" }, employer: { id: 120, firstName: "Юлия", secondName: "Ивановна", surname: "Попова", email: "popova@corp.ru" } },
            ],
            EmptyVacancy: [
              { city: { code: "kzn", name: "Казань" }, position: { code: "sales_mgr", name: "Менеджер по продажам" } },
            ],
          },
          {
            ID: 24,
            Code: "marketing",
            Name: "Маркетинг",
            Type: "department",
            Children: [],
            Vacancies: [
              { city: { code: "msk", name: "Москва" }, position: { code: "marketing_lead", name: "Руководитель маркетинга" }, employer: { id: 121, firstName: "Екатерина", secondName: "Михайловна", surname: "Захарова", email: "zaharova@corp.ru" } },
            ],
            EmptyVacancy: [
              { city: { code: "msk", name: "Москва" }, position: { code: "smm", name: "SMM специалист" } },
              { city: { code: "msk", name: "Москва" }, position: { code: "designer", name: "Дизайнер" } },
            ],
          },
        ],
        Vacancies: null,
        EmptyVacancy: null,
      },
    ],
    Vacancies: null,
    EmptyVacancy: null,
  },
];

// Flatten for node lookups
function findNode(nodes: OrgNode[], id: number): OrgNode | undefined {
  for (const n of nodes) {
    if (n.ID === id) return n;
    const found = findNode(n.Children, id);
    if (found) return found;
  }
}

// ---------------------------------------------------------------------------
// Mock API — same interface as orgNodesApi
// ---------------------------------------------------------------------------

export const orgNodesApi = {
  async getTree(): Promise<OrgNodesResponse> {
    await delay();
    return { code: 200, data: MOCK_TREE };
  },

  async getSubTree(id: number): Promise<OrgNodesResponse> {
    await delay();
    const node = findNode(MOCK_TREE, id);
    if (!node) return Promise.reject(Object.assign(new Error("Not found"), { code: 404 }));
    return { code: 200, data: [node] };
  },

  async getNode(id: number): Promise<OrgNodeResponse> {
    await delay();
    const node = findNode(MOCK_TREE, id);
    if (!node) return Promise.reject(Object.assign(new Error("Not found"), { code: 404 }));
    return {
      code: 200,
      data: [{ id: node.ID, code: node.Code, name: node.Name, parentID: 0, typeCode: node.Type }],
    };
  },

  async getEmptyVacancies(id: number): Promise<OrgNode> {
    await delay();
    const node = findNode(MOCK_TREE, id);
    if (!node) return Promise.reject(Object.assign(new Error("Not found"), { code: 404 }));
    return { ...node, Vacancies: null };
  },

  async getFilledVacancies(id: number): Promise<OrgNode> {
    await delay();
    const node = findNode(MOCK_TREE, id);
    if (!node) return Promise.reject(Object.assign(new Error("Not found"), { code: 404 }));
    return { ...node, EmptyVacancy: null };
  },
};
