import type { ApiResponse, RefreshSession } from "#/types/api";

const BASE_URL = "/api";
const EXPIRY_KEY = "hrtodo.auth_expiry";
const LOCK_KEY = "hrtodo.auth_refresh_lock";
/**
 * access_token на бэке живёт 15 минут, и этот срок из фронта не увеличить.
 * Обновляем сессию за 2 минуты до конца: фоновая вкладка в Chrome тикает
 * не чаще раза в минуту, запаса в 45 секунд не хватало — cookie уже удалялась,
 * запоздалый refresh сталкивался со шквалом 401 и сжигал одноразовый токен.
 */
const LEEWAY_MS = 2 * 60_000;
const HEARTBEAT_MS = 15_000;
const ROTATION_RETRY_MS = 400;
const LOCK_TTL_MS = 10_000;
const MAX_TIMER_MS = 2_147_483_647;

let refreshInFlight: Promise<RefreshSession> | null = null;
let refreshTimer: number | null = null;
let sessionExpired = false;
/** Явный выход. Опоздавший refresh после него сессию не возвращает. */
let explicitLogout = false;
/** Увеличивается при выходе, чтобы опоздавший refresh не вернул сроки сессии. */
let sessionEpoch = 0;

const expiredListeners = new Set<() => void>();
const restoredListeners = new Set<() => void>();

export function subscribeAuthExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

export function subscribeAuthRestored(listener: () => void): () => void {
  restoredListeners.add(listener);
  return () => restoredListeners.delete(listener);
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];

  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }

  return null;
}

function readStored(): RefreshSession | null {
  if (typeof localStorage === "undefined") return null;

  const raw = localStorage.getItem(EXPIRY_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as RefreshSession;
    if (!parsed.expires_at || !parsed.refresh_expires_at) return null;
    return parsed;
  } catch {
    localStorage.removeItem(EXPIRY_KEY);
    return null;
  }
}

function msUntilRefresh(expiresAt: string): number | null {
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return null;
  return expiresMs - Date.now() - LEEWAY_MS;
}

function scheduleRefresh(expiresAt: string): void {
  if (refreshTimer != null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const delay = msUntilRefresh(expiresAt);
  if (delay == null) return;

  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    void refreshSession().catch(() => {
      // Ошибка авторизации уже сбрасывает сессию. Сетевой сбой оставит
      // повтор на ближайший 401.
    });
  }, Math.min(Math.max(delay, 0), MAX_TIMER_MS));
}

function freshStored(): RefreshSession | null {
  const stored = readStored();
  if (!stored) return null;

  const wait = msUntilRefresh(stored.expires_at);
  if (wait == null || wait <= 0) return null;

  scheduleRefresh(stored.expires_at);
  return stored;
}

export function rememberAuthExpiry(expiresAt: string, refreshExpiresAt: string): void {
  explicitLogout = false;
  sessionExpired = false;
  const payload: RefreshSession = {
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
  };
  localStorage.setItem(EXPIRY_KEY, JSON.stringify(payload));
  scheduleRefresh(expiresAt);
}

function dropStoredExpiry(): void {
  if (refreshTimer != null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(LOCK_KEY);
}

export function clearAuthExpiry(): void {
  explicitLogout = true;
  sessionExpired = true;
  sessionEpoch += 1;
  dropStoredExpiry();
}

/** Сбросить локальные сроки и перевести приложение на экран входа. */
export function expireClientSession(): void {
  if (explicitLogout) return;
  dropStoredExpiry();
  if (sessionExpired) return;
  sessionExpired = true;
  for (const listener of expiredListeners) listener();
}

function notifyRestored(): void {
  for (const listener of restoredListeners) listener();
}

function authError(status: number, message: string): Error {
  return Object.assign(new Error(message), { code: status });
}

function acquireLock(): boolean {
  const now = Date.now();
  const existing = Number(localStorage.getItem(LOCK_KEY) || 0);
  if (existing > now) return false;
  localStorage.setItem(LOCK_KEY, String(now + LOCK_TTL_MS));
  return true;
}

function releaseLock(): void {
  localStorage.removeItem(LOCK_KEY);
}

function waitForOtherTab(): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const lock = Number(localStorage.getItem(LOCK_KEY) || 0);
      const stillWaiting = lock > Date.now() && !freshStored();
      if (!stillWaiting || Date.now() - started > LOCK_TTL_MS) {
        window.clearInterval(timer);
        resolve();
      }
    }, 150);
  });
}

function expiryWasRenewed(previousExpiresAt: string | null): RefreshSession | null {
  const stored = readStored();
  if (!stored) return null;

  const nextMs = Date.parse(stored.expires_at);
  if (Number.isNaN(nextMs) || nextMs <= Date.now()) return null;

  if (!previousExpiresAt) return stored;

  const previousMs = Date.parse(previousExpiresAt);
  if (!Number.isNaN(previousMs) && nextMs <= previousMs) return null;

  return stored;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function postRefresh(): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const csrf = readCookie("csrf_token");
  if (csrf) headers["X-CSRF-Token"] = csrf;

  return fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers,
    credentials: "include",
  });
}

async function requestRefresh(
  previousExpiresAt: string | null,
  allowRetry: boolean,
): Promise<RefreshSession> {
  const epoch = sessionEpoch;
  const res = await postRefresh();

  if (explicitLogout || epoch !== sessionEpoch) {
    throw authError(401, "Сессия завершена");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = String(err.error ?? res.statusText);
    const rotatedAway = message.includes("refresh session not found");

    if (rotatedAway) {
      // Победивший refresh мог ещё не записать срок или не успеть обновить cookie.
      if (allowRetry) await delay(ROTATION_RETRY_MS);
      if (explicitLogout || epoch !== sessionEpoch) {
        throw authError(401, "Сессия завершена");
      }
      const renewed = expiryWasRenewed(previousExpiresAt);
      if (renewed) {
        scheduleRefresh(renewed.expires_at);
        return renewed;
      }
      if (allowRetry) return requestRefresh(previousExpiresAt, false);
    }

    if (res.status === 401 || res.status === 403) expireClientSession();
    throw authError(res.status, message);
  }

  const body = (await res.json()) as ApiResponse<RefreshSession>;
  if (explicitLogout || epoch !== sessionEpoch) {
    throw authError(401, "Сессия завершена");
  }
  const wasExpired = sessionExpired;
  rememberAuthExpiry(body.data.expires_at, body.data.refresh_expires_at);
  if (wasExpired) notifyRestored();
  return body.data;
}

function runSingleRefresh(
  task: () => Promise<RefreshSession>,
): Promise<RefreshSession> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) {
    // Типы DOM не разворачивают Promise из callback, сам LockManager — разворачивает.
    return locks.request("hrtodo-auth-refresh", task).then((session) => session);
  }
  return task();
}

async function performRefresh(force: boolean): Promise<RefreshSession> {
  const seenExpiresAt = readStored()?.expires_at ?? null;

  // Таймер может выйти раньше, если другая вкладка уже продлила сессию.
  if (!force) {
    const alreadyFresh = freshStored();
    if (alreadyFresh) return alreadyFresh;
  }

  return runSingleRefresh(async () => {
    const renewed = expiryWasRenewed(seenExpiresAt);
    if (renewed) {
      scheduleRefresh(renewed.expires_at);
      return renewed;
    }

    if (!force) {
      const raced = freshStored();
      if (raced) return raced;
    }

    let locked = false;
    if (typeof navigator === "undefined" || !navigator.locks?.request) {
      locked = acquireLock();
      if (!locked) {
        await waitForOtherTab();
        const refreshedElsewhere = expiryWasRenewed(seenExpiresAt) ?? freshStored();
        if (refreshedElsewhere) return refreshedElsewhere;
        locked = acquireLock();
      }
    }

    try {
      return await requestRefresh(seenExpiresAt, true);
    } finally {
      if (locked) releaseLock();
    }
  });
}

/**
 * Один refresh на все параллельные 401. Пока Promise не завершился,
 * остальные запросы ждут его, а не ротируют cookie ещё раз.
 */
export function refreshSession(options?: { force?: boolean }): Promise<RefreshSession> {
  if (sessionExpired) {
    return Promise.reject(authError(401, "Сессия истекла"));
  }

  const force = options?.force ?? false;

  if (!refreshInFlight) {
    refreshInFlight = performRefresh(force).finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

/** Если срок уже близко или прошёл — один refresh. Иначе держим точный таймер. */
function ensureFreshSession(): void {
  if (sessionExpired || explicitLogout) return;

  const stored = readStored();
  if (!stored) return;

  const wait = msUntilRefresh(stored.expires_at);
  if (wait == null) return;

  if (wait <= 0) {
    void refreshSession().catch(() => {
      // 401 уже переводит на вход. Сетевой сбой повторит следующий пульс.
    });
    return;
  }

  if (refreshTimer == null) scheduleRefresh(stored.expires_at);
}

function onStorage(event: StorageEvent): void {
  if (event.key !== EXPIRY_KEY || explicitLogout) return;

  if (!event.newValue) {
    expireClientSession();
    return;
  }

  try {
    const parsed = JSON.parse(event.newValue) as RefreshSession;
    const wasExpired = sessionExpired;
    sessionExpired = false;
    scheduleRefresh(parsed.expires_at);
    if (wasExpired) notifyRestored();
  } catch {
    /* чужая вкладка записала неJSON — игнорируем */
  }
}

if (typeof window !== "undefined") {
  const onVisible = () => {
    if (document.visibilityState === "visible") ensureFreshSession();
  };

  ensureFreshSession();
  const heartbeat = window.setInterval(ensureFreshSession, HEARTBEAT_MS);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", ensureFreshSession);
  window.addEventListener("pageshow", ensureFreshSession);
  window.addEventListener("storage", onStorage);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.clearInterval(heartbeat);
      if (refreshTimer != null) window.clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", ensureFreshSession);
      window.removeEventListener("pageshow", ensureFreshSession);
      window.removeEventListener("storage", onStorage);
    });
  }
}
