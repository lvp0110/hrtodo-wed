/** Календарная дата YYYY-MM-DD без сдвига часового пояса. */
export function isoDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? "";
}

/** Число календарных дней, включая обе даты. Сервер считает так же. */
export function inclusiveDays(start: string, end: string): number | null {
  const startMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  const endMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(end);
  if (!startMatch || !endMatch) return null;
  const startUtc = Date.UTC(
    Number(startMatch[1]),
    Number(startMatch[2]) - 1,
    Number(startMatch[3]),
  );
  const endUtc = Date.UTC(
    Number(endMatch[1]),
    Number(endMatch[2]) - 1,
    Number(endMatch[3]),
  );
  const days = Math.round((endUtc - startUtc) / 86_400_000) + 1;
  return days >= 1 ? days : null;
}

export function formatIsoDate(value: string): string {
  const iso = isoDate(value);
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

/** Первое пересечение с другим отпуском того же назначения. */
export function findDateOverlap(
  start: string,
  end: string,
  ranges: { start: string; end: string }[],
): { start: string; end: string } | null {
  if (!isoDate(start) || !isoDate(end) || start > end) return null;
  return (
    ranges.find(
      (range) =>
        Boolean(isoDate(range.start)) &&
        Boolean(isoDate(range.end)) &&
        start <= range.end &&
        range.start <= end,
    ) ?? null
  );
}
