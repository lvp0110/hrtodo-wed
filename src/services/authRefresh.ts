import type { ApiResponse, RefreshSession } from "#/types/api";

const BASE_URL = "/api";
const EXPIRY_KEY = "hrtodo.auth_expiry";
const LOCK_KEY = "hrtodo.auth_refresh_lock";
/** Обновляем access token чуть раньше истечения, чтобы запросы не ловили 401. */
const LEEWAY_MS = 45_000;
const LOCK_TTL_MS = 10_000;
const MAX_TIMER_MS = 2_147_483_647;

let refreshInFlight: Promise<RefreshSession> | null = null;
let refreshTimer: number | null = null;
let sessionExpired = false;
/** Увеличивается при выходе, чтобы опоздавший refresh не вернул сроки сессии. */
let sessionEpoch = 0;

const expiredListeners = new Set<() => void>();

export function subscribeAuthExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
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
  sessionExpired = false;
  const payload: RefreshSession = {
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
  };
  localStorage.setItem(EXPIRY_KEY, JSON.stringify(payload));
  scheduleRefresh(expiresAt);
}

export function clearAuthExpiry(): void {
  sessionEpoch += 1;
  if (refreshTimer != null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(LOCK_KEY);
}

/** Сбросить локальные сроки и перевести приложение на экран входа. */
export function expireClientSession(): void {
  clearAuthExpiry();
  if (sessionExpired) return;
  sessionExpired = true;
  for (const listener of expiredListeners) listener();
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

async function requestRefresh(): Promise<RefreshSession> {
  const epoch = sessionEpoch;
  const headers: Record<string, string> = { Accept: "application/json" };
  const csrf = readCookie("csrf_token");
  if (csrf) headers["X-CSRF-Token"] = csrf;

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers,
    credentials: "include",
  });

  if (epoch !== sessionEpoch) {
    throw authError(401, "Сессия завершена");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401 || res.status === 403) expireClientSession();
    throw authError(res.status, err.error ?? res.statusText);
  }

  const body = (await res.json()) as ApiResponse<RefreshSession>;
  if (epoch !== sessionEpoch) {
    throw authError(401, "Сессия завершена");
  }
  rememberAuthExpiry(body.data.expires_at, body.data.refresh_expires_at);
  return body.data;
}

async function performRefresh(force: boolean): Promise<RefreshSession> {
  // Таймер может выйти раньше, если другая вкладка уже продлила сессию.
  // По 401 так делать нельзя: access cookie уже отвергнута сервером.
  if (!force) {
    const alreadyFresh = freshStored();
    if (alreadyFresh) return alreadyFresh;
  }

  let locked = acquireLock();
  if (!locked) {
    await waitForOtherTab();
    const refreshedElsewhere = freshStored();
    if (refreshedElsewhere) return refreshedElsewhere;
    locked = acquireLock();
  }

  try {
    if (!force) {
      const raced = freshStored();
      if (raced) return raced;
    }
    return await requestRefresh();
  } finally {
    if (locked) releaseLock();
  }
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

function onStorage(event: StorageEvent): void {
  if (event.key !== EXPIRY_KEY) return;

  if (!event.newValue) {
    expireClientSession();
    return;
  }

  try {
    const parsed = JSON.parse(event.newValue) as RefreshSession;
    sessionExpired = false;
    scheduleRefresh(parsed.expires_at);
  } catch {
    /* чужая вкладка записала неJSON — игнорируем */
  }
}

if (typeof window !== "undefined") {
  const stored = readStored();
  if (stored) scheduleRefresh(stored.expires_at);
  window.addEventListener("storage", onStorage);
}
