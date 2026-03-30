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
              { City: { code: "msk", name: "Москва" }, Position: { code: "acc_lead", name: "Главный бухгалтер" }, Employer: { id: 101, firstName: "Анна", secondName: "Петровна", surname: "Смирнова", email: "smirnova@corp.ru" } },
              { City: { code: "msk", name: "Москва" }, Position: { code: "acc_jr", name: "Бухгалтер" }, Employer: { id: 102, firstName: "Елена", secondName: "Игоревна", surname: "Фёдорова", email: "fedorova@corp.ru" } },
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
              { City: { code: "msk", name: "Москва" }, Position: { code: "analyst", name: "Финансовый аналитик" } },
              { City: { code: "msk", name: "Москва" }, Position: { code: "controller", name: "Контролёр" } },
            ],
          },
          {
            ID: 12,
            Code: "treasury",
            Name: "Казначейство",
            Type: "department",
            Children: [],
            Vacancies: [
              { City: { code: "msk", name: "Москва" }, Position: { code: "treasurer", name: "Казначей" }, Employer: { id: 103, firstName: "Дмитрий", secondName: "Олегович", surname: "Беляев", email: "belyaev@corp.ru" } },
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
                  { City: { code: "spb", name: "Санкт-Петербург" }, Position: { code: "fe_lead", name: "Frontend Lead" }, Employer: { id: 110, firstName: "Иван", secondName: "Сергеевич", surname: "Козлов", email: "kozlov@corp.ru" } },
                  { City: { code: "spb", name: "Санкт-Петербург" }, Position: { code: "fe_mid", name: "Frontend Dev" }, Employer: { id: 111, firstName: "Мария", secondName: "Андреевна", surname: "Новикова", email: "novikova@corp.ru" } },
                ],
                EmptyVacancy: [
                  { City: { code: "spb", name: "Санкт-Петербург" }, Position: { code: "fe_jun", name: "Junior Frontend" } },
                ],
              },
              {
                ID: 21,
                Code: "backend",
                Name: "Backend",
                Type: "team",
                Children: [],
                Vacancies: [
                  { City: { code: "spb", name: "Санкт-Петербург" }, Position: { code: "be_lead", name: "Backend Lead" }, Employer: { id: 112, firstName: "Алексей", secondName: "Николаевич", surname: "Громов", email: "gromov@corp.ru" } },
                ],
                EmptyVacancy: [
                  { City: { code: "spb", name: "Санкт-Петербург" }, Position: { code: "be_mid", name: "Backend Dev" } },
                  { City: { code: "spb", name: "Санкт-Петербург" }, Position: { code: "be_jun", name: "Junior Backend" } },
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
                  { City: { code: "msk", name: "Москва" }, Position: { code: "mob_dev", name: "Mobile Dev" } },
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
              { City: { code: "msk", name: "Москва" }, Position: { code: "qa_lead", name: "QA Lead" }, Employer: { id: 113, firstName: "Светлана", secondName: "Павловна", surname: "Орлова", email: "orlova@corp.ru" } },
            ],
            EmptyVacancy: [
              { City: { code: "msk", name: "Москва" }, Position: { code: "qa_eng", name: "QA инженер" } },
            ],
          },
          {
            ID: 15,
            Code: "devops",
            Name: "DevOps",
            Type: "department",
            Children: [],
            Vacancies: [
              { City: { code: "spb", name: "Санкт-Петербург" }, Position: { code: "devops_eng", name: "DevOps инженер" }, Employer: { id: 114, firstName: "Роман", secondName: "Витальевич", surname: "Суворов", email: "suvorov@corp.ru" } },
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
              { City: { code: "msk", name: "Москва" }, Position: { code: "architect", name: "Системный архитектор" } },
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
              { City: { code: "msk", name: "Москва" }, Position: { code: "recruiter", name: "Рекрутер" }, Employer: { id: 115, firstName: "Ольга", secondName: "Дмитриевна", surname: "Васильева", email: "vasilieva@corp.ru" } },
              { City: { code: "msk", name: "Москва" }, Position: { code: "recruiter_sr", name: "Старший рекрутер" }, Employer: { id: 116, firstName: "Татьяна", secondName: "Юрьевна", surname: "Лебедева", email: "lebedeva@corp.ru" } },
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
              { City: { code: "msk", name: "Москва" }, Position: { code: "trainer", name: "Тренер" } },
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
              { City: { code: "msk", name: "Москва" }, Position: { code: "compliance_off", name: "Офицер комплаенса" }, Employer: { id: 117, firstName: "Андрей", secondName: "Борисович", surname: "Кузнецов", email: "kuznetsov@corp.ru" } },
            ],
            EmptyVacancy: null,
          },
        ],
        Vacancies: [
          { City: { code: "msk", name: "Москва" }, Position: { code: "lawyer_lead", name: "Главный юрист" }, Employer: { id: 118, firstName: "Наталья", secondName: "Геннадьевна", surname: "Морозова", email: "morozova@corp.ru" } },
        ],
        EmptyVacancy: [
          { City: { code: "msk", name: "Москва" }, Position: { code: "lawyer", name: "Юрист" } },
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
              { City: { code: "msk", name: "Москва" }, Position: { code: "sales_mgr", name: "Менеджер по продажам" }, Employer: { id: 119, firstName: "Виктор", secondName: "Александрович", surname: "Соколов", email: "sokolov@corp.ru" } },
              { City: { code: "spb", name: "Санкт-Петербург" }, Position: { code: "sales_mgr", name: "Менеджер по продажам" }, Employer: { id: 120, firstName: "Юлия", secondName: "Ивановна", surname: "Попова", email: "popova@corp.ru" } },
            ],
            EmptyVacancy: [
              { City: { code: "kzn", name: "Казань" }, Position: { code: "sales_mgr", name: "Менеджер по продажам" } },
            ],
          },
          {
            ID: 24,
            Code: "marketing",
            Name: "Маркетинг",
            Type: "department",
            Children: [],
            Vacancies: [
              { City: { code: "msk", name: "Москва" }, Position: { code: "marketing_lead", name: "Руководитель маркетинга" }, Employer: { id: 121, firstName: "Екатерина", secondName: "Михайловна", surname: "Захарова", email: "zaharova@corp.ru" } },
            ],
            EmptyVacancy: [
              { City: { code: "msk", name: "Москва" }, Position: { code: "smm", name: "SMM специалист" } },
              { City: { code: "msk", name: "Москва" }, Position: { code: "designer", name: "Дизайнер" } },
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
