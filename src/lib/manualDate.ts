const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;
const COMPACT_RE = /^(\d{2})(\d{2})(\d{4})$/;

function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toIso(year: number, month: number, day: number): string | null {
  if (!isRealDate(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Пустая строка — очищенное поле, null — дата ещё не распознана. */
export function parseManualDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const iso = ISO_RE.exec(trimmed);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = DMY_RE.exec(trimmed);
  if (dmy) return toIso(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  const compact = COMPACT_RE.exec(trimmed);
  if (compact) return toIso(Number(compact[3]), Number(compact[2]), Number(compact[1]));

  return null;
}

export function isoToDisplay(iso: string): string {
  const match = ISO_RE.exec(iso);
  if (!match) return "";
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** Оставляет цифры и разделители и сразу показывает распознанную дату как ДД.ММ.ГГГГ. */
export function sanitizeDateTyping(raw: string): string {
  const trimmed = raw.trim();
  const direct = parseManualDate(trimmed);
  if (direct !== null) return direct ? isoToDisplay(direct) : "";

  const cleaned = raw.replace(/[^\d./]/g, "").slice(0, 10);
  const parsed = parseManualDate(cleaned);
  if (parsed) return isoToDisplay(parsed);
  return cleaned;
}
