export const HR_BACKGROUND_STORAGE_KEY = "hr-background";

export const HR_BACKGROUNDS = [
  {
    id: "office",
    label: "Кабинет",
    src: "/backgrounds/hr-office.jpg",
  },
  {
    id: "team",
    label: "Команда",
    src: "/backgrounds/hr-team.jpg",
  },
  {
    id: "hiring",
    label: "Подбор",
    src: "/backgrounds/hr-hiring.jpg",
  },
  {
    id: "welcome",
    label: "Приёмная",
    src: "/backgrounds/hr-welcome.jpg",
  },
] as const;

export type HrBackgroundId = (typeof HR_BACKGROUNDS)[number]["id"];

export function readHrBackgroundIndex(): number {
  try {
    const stored = localStorage.getItem(HR_BACKGROUND_STORAGE_KEY);
    const index = HR_BACKGROUNDS.findIndex((item) => item.id === stored);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

export function writeHrBackgroundIndex(index: number) {
  const item = HR_BACKGROUNDS[index];
  if (!item) return;
  try {
    localStorage.setItem(HR_BACKGROUND_STORAGE_KEY, item.id);
  } catch {
    /* приватный режим */
  }
}
