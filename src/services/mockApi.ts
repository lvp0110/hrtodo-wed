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
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "acc_lead", Name: "Главный бухгалтер" }, Employer: { ID: 101, FirstName: "Анна", SecondName: "Петровна", Surname: "Смирнова", Email: "smirnova@corp.ru" } },
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "acc_jr", Name: "Бухгалтер" }, Employer: { ID: 102, FirstName: "Елена", SecondName: "Игоревна", Surname: "Фёдорова", Email: "fedorova@corp.ru" } },
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
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "analyst", Name: "Финансовый аналитик" } },
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "controller", Name: "Контролёр" } },
            ],
          },
          {
            ID: 12,
            Code: "treasury",
            Name: "Казначейство",
            Type: "department",
            Children: [],
            Vacancies: [
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "treasurer", Name: "Казначей" }, Employer: { ID: 103, FirstName: "Дмитрий", SecondName: "Олегович", Surname: "Беляев", Email: "belyaev@corp.ru" } },
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
                  { City: { Code: "spb", Name: "Санкт-Петербург" }, Position: { Code: "fe_lead", Name: "Frontend Lead" }, Employer: { ID: 110, FirstName: "Иван", SecondName: "Сергеевич", Surname: "Козлов", Email: "kozlov@corp.ru" } },
                  { City: { Code: "spb", Name: "Санкт-Петербург" }, Position: { Code: "fe_mid", Name: "Frontend Dev" }, Employer: { ID: 111, FirstName: "Мария", SecondName: "Андреевна", Surname: "Новикова", Email: "novikova@corp.ru" } },
                ],
                EmptyVacancy: [
                  { City: { Code: "spb", Name: "Санкт-Петербург" }, Position: { Code: "fe_jun", Name: "Junior Frontend" } },
                ],
              },
              {
                ID: 21,
                Code: "backend",
                Name: "Backend",
                Type: "team",
                Children: [],
                Vacancies: [
                  { City: { Code: "spb", Name: "Санкт-Петербург" }, Position: { Code: "be_lead", Name: "Backend Lead" }, Employer: { ID: 112, FirstName: "Алексей", SecondName: "Николаевич", Surname: "Громов", Email: "gromov@corp.ru" } },
                ],
                EmptyVacancy: [
                  { City: { Code: "spb", Name: "Санкт-Петербург" }, Position: { Code: "be_mid", Name: "Backend Dev" } },
                  { City: { Code: "spb", Name: "Санкт-Петербург" }, Position: { Code: "be_jun", Name: "Junior Backend" } },
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
                  { City: { Code: "msk", Name: "Москва" }, Position: { Code: "mob_dev", Name: "Mobile Dev" } },
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
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "qa_lead", Name: "QA Lead" }, Employer: { ID: 113, FirstName: "Светлана", SecondName: "Павловна", Surname: "Орлова", Email: "orlova@corp.ru" } },
            ],
            EmptyVacancy: [
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "qa_eng", Name: "QA инженер" } },
            ],
          },
          {
            ID: 15,
            Code: "devops",
            Name: "DevOps",
            Type: "department",
            Children: [],
            Vacancies: [
              { City: { Code: "spb", Name: "Санкт-Петербург" }, Position: { Code: "devops_eng", Name: "DevOps инженер" }, Employer: { ID: 114, FirstName: "Роман", SecondName: "Витальевич", Surname: "Суворов", Email: "suvorov@corp.ru" } },
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
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "architect", Name: "Системный архитектор" } },
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
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "recruiter", Name: "Рекрутер" }, Employer: { ID: 115, FirstName: "Ольга", SecondName: "Дмитриевна", Surname: "Васильева", Email: "vasilieva@corp.ru" } },
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "recruiter_sr", Name: "Старший рекрутер" }, Employer: { ID: 116, FirstName: "Татьяна", SecondName: "Юрьевна", Surname: "Лебедева", Email: "lebedeva@corp.ru" } },
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
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "trainer", Name: "Тренер" } },
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
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "compliance_off", Name: "Офицер комплаенса" }, Employer: { ID: 117, FirstName: "Андрей", SecondName: "Борисович", Surname: "Кузнецов", Email: "kuznetsov@corp.ru" } },
            ],
            EmptyVacancy: null,
          },
        ],
        Vacancies: [
          { City: { Code: "msk", Name: "Москва" }, Position: { Code: "lawyer_lead", Name: "Главный юрист" }, Employer: { ID: 118, FirstName: "Наталья", SecondName: "Геннадьевна", Surname: "Морозова", Email: "morozova@corp.ru" } },
        ],
        EmptyVacancy: [
          { City: { Code: "msk", Name: "Москва" }, Position: { Code: "lawyer", Name: "Юрист" } },
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
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "sales_mgr", Name: "Менеджер по продажам" }, Employer: { ID: 119, FirstName: "Виктор", SecondName: "Александрович", Surname: "Соколов", Email: "sokolov@corp.ru" } },
              { City: { Code: "spb", Name: "Санкт-Петербург" }, Position: { Code: "sales_mgr", Name: "Менеджер по продажам" }, Employer: { ID: 120, FirstName: "Юлия", SecondName: "Ивановна", Surname: "Попова", Email: "popova@corp.ru" } },
            ],
            EmptyVacancy: [
              { City: { Code: "kzn", Name: "Казань" }, Position: { Code: "sales_mgr", Name: "Менеджер по продажам" } },
            ],
          },
          {
            ID: 24,
            Code: "marketing",
            Name: "Маркетинг",
            Type: "department",
            Children: [],
            Vacancies: [
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "marketing_lead", Name: "Руководитель маркетинга" }, Employer: { ID: 121, FirstName: "Екатерина", SecondName: "Михайловна", Surname: "Захарова", Email: "zaharova@corp.ru" } },
            ],
            EmptyVacancy: [
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "smm", Name: "SMM специалист" } },
              { City: { Code: "msk", Name: "Москва" }, Position: { Code: "designer", Name: "Дизайнер" } },
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

  async getTreeVacancies(): Promise<OrgNodesResponse> {
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
