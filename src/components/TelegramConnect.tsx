import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { formatApiError } from "#/lib/apiError";
import { messagingApi } from "#/services/api";
import type { MessagingAccount, TelegramLink } from "#/types/api";

const STATUS_LABELS: Record<string, string> = {
  pending: "Ссылка создана, сотрудник ещё не подключился",
  connected: "Telegram подключён",
  blocked: "Сотрудник заблокировал бота",
  disconnected: "Подключение отсутствует",
  failed: "Ошибка подключения",
};

function telegramAccount(accounts: MessagingAccount[] | null | undefined): MessagingAccount | null {
  const list = accounts ?? [];
  return list.find((item) => item.provider === "telegram") ?? list[0] ?? null;
}

function statusOf(account: MessagingAccount | null): string | null {
  return account?.connection_status || null;
}

function shouldPoll(status: string | null, watching: boolean): number | false {
  if (status === "connected" || status === "blocked" || status === "failed") return false;
  if (status === "pending" || watching) return 5000;
  return false;
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function isExpired(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

export function TelegramConnect({ employeeId }: { employeeId: number }) {
  const queryClient = useQueryClient();
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [watching, setWatching] = useState(false);
  const [copied, setCopied] = useState(false);

  const accountsQuery = useQuery({
    queryKey: ["hr", "messaging-accounts", employeeId] as const,
    queryFn: () => messagingApi.accounts(employeeId).then((res) => res.data ?? []),
    refetchInterval: (query) => shouldPoll(statusOf(telegramAccount(query.state.data)), watching),
  });

  const account = telegramAccount(accountsQuery.data);
  const status = statusOf(account);

  const linkMutation = useMutation({
    mutationFn: () => messagingApi.createTelegramLink(employeeId),
    onSuccess: (res) => {
      setLink(res.data);
      setCopied(false);
      setWatching(true);
      queryClient.invalidateQueries({ queryKey: ["hr", "messaging-accounts", employeeId] });
    },
  });

  useEffect(() => {
    if (status === "connected" || status === "blocked" || status === "failed") {
      setWatching(false);
    }
  }, [status]);

  const expired = link ? isExpired(link.expires_at) : false;
  const statusText = accountsQuery.isPending
    ? "Проверяем подключение…"
    : status
      ? (STATUS_LABELS[status] ?? status)
      : "Подключение отсутствует";

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 px-3 py-3 dark:border-gray-700">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Telegram</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{statusText}</p>
          {status === "failed" && account?.last_error && (
            <p className="mt-1 text-xs text-red-500">{account.last_error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => linkMutation.mutate()}
          disabled={linkMutation.isPending}
          data-hint="Создаёт одноразовую ссылку для подключения Telegram. Новая ссылка отменяет предыдущую неиспользованную"
          className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {linkMutation.isPending ? "Создаём…" : "Подключить Telegram"}
        </button>
      </div>

      {accountsQuery.isError && (
        <p className="text-sm text-red-500">{formatApiError(accountsQuery.error)}</p>
      )}
      {linkMutation.isError && (
        <p className="text-sm text-red-500">{formatApiError(linkMutation.error)}</p>
      )}

      {link && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {expired
              ? `Срок ссылки истёк ${formatExpiry(link.expires_at)}. Создайте новую.`
              : `Ссылка одноразовая и действует до ${formatExpiry(link.expires_at)}. Новая ссылка отменяет предыдущую неиспользованную.`}
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link.deep_link}
              aria-label="Ссылка подключения Telegram"
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(link.deep_link).then(
                  () => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  },
                  () => setCopied(false),
                );
              }}
              data-hint="Копирует ссылку подключения Telegram"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
          <a
            href={link.deep_link}
            target="_blank"
            rel="noopener noreferrer"
            data-hint="Открывает ссылку подключения в Telegram"
            className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300"
          >
            Открыть ссылку
          </a>
          {!expired && <TelegramQr value={link.deep_link} />}
          {watching && status !== "connected" && (
            <p className="text-xs text-gray-400">Ждём, пока сотрудник откроет бота…</p>
          )}
        </div>
      )}
    </section>
  );
}

function TelegramQr({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: 180, errorCorrectionLevel: "M" }).then(
      (url) => {
        if (!cancelled) setSrc(url);
      },
      () => {
        if (!cancelled) setSrc(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt="QR-код ссылки Telegram"
      width={180}
      height={180}
      className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700"
    />
  );
}
