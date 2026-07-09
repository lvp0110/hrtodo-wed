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
