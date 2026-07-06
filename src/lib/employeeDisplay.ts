const GENDER_LABELS: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
  unknown: "Не указан",
  m: "Мужской",
  f: "Женский",
};

export const GENDER_OPTIONS = [
  { value: "", label: "Не указан" },
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
] as const;

export function normalizeGender(gender: string | null | undefined): string {
  if (!gender?.trim()) return "";
  const normalized = gender.toLowerCase();
  if (normalized === "m" || normalized === "male") return "male";
  if (normalized === "f" || normalized === "female") return "female";
  if (normalized === "unknown") return "";
  return gender;
}

export function formatGender(gender: string | null | undefined): string {
  if (!gender?.trim()) return "—";
  return GENDER_LABELS[gender.toLowerCase()] ?? gender;
}

export function formatHireDate(date: string | null | undefined): string {
  if (!date?.trim()) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("ru-RU");
}

export function displayValue(value: string | null | undefined): string {
  return value?.trim() || "—";
}
