import { useAuthStore } from '../auth/tokenStore';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Consistent envelope + error shape from the API (see server §6.4).
export class ApiError extends Error {
  constructor(status, shape) {
    super(shape.message);
    this.status = status;
    this.code = shape.code;
    this.details = shape.details;
  }
}

let refreshInFlight = null;

/**
 * Calls /api/auth/refresh with in-flight dedup — React StrictMode mounts
 * effects twice in dev, and two concurrent refreshes would otherwise burn a
 * rotation (the second request presents an already-rotated token).
 * Exposed for the app's session bootstrap.
 */
export function tryRefresh() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const json = await res.json();
        useAuthStore.getState().setSession(json.data.accessToken, json.data.user);
        return json.data;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function api(path, options = {}) {
  const doFetch = async () => {
    const headers = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const token = useAuthStore.getState().accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_URL}${path}`, {
      method: options.method || 'GET',
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  };

  let res = await doFetch();

  // Silent refresh on 401 + exactly one retry (PRD §4.1).
  if (res.status === 401 && !options.skipRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    } else {
      useAuthStore.getState().clear();
    }
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, json?.error ?? { code: 'INTERNAL_ERROR', message: 'Something went wrong' });
  }
  return json;
}

export function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
